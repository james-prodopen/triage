import { NextRequest, NextResponse } from 'next/server';
import { createGitHubClient } from '@/lib/github-client';
import {
  GET_REVIEW_COMMENTS_RECEIVED,
  GetReviewCommentsReceivedResponse,
} from '@/lib/graphql/queries';
import { ReviewCommentStats } from '@/lib/types/github';

interface Repository {
  owner: string;
  repo: string;
  id: string;
}

/**
 * Count review comments on PRs authored by a specific user
 */
async function countCommentsReceived(
  fetchGraphQL: <T = any>(query: string, variables?: Record<string, any>) => Promise<T>,
  owner: string,
  repo: string,
  author: string
): Promise<{ commentsReceived: number; prsAuthored: number }> {
  // Build search query: PRs authored by user, in repo, sorted by most recent first (will get first 100)
  const searchQuery = `repo:${owner}/${repo} is:pr author:${author} sort:created-desc`;

  // Fetch first 100 PRs (no pagination)
  const response = await fetchGraphQL<GetReviewCommentsReceivedResponse>(
    GET_REVIEW_COMMENTS_RECEIVED,
    { searchQuery }
  );

  const prs = response.search.nodes;
  const prsAuthored = prs.length;

  // Count review comments on these PRs
  let commentsReceived = 0;
  for (const pr of prs) {
    if (pr.reviews?.nodes) {
      for (const review of pr.reviews.nodes) {
        commentsReceived += review.comments?.totalCount || 0;
      }
    }
  }

  return { commentsReceived, prsAuthored };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const repositoriesParam = searchParams.get('repositories');
    const authorsParam = searchParams.get('authors');

    if (!repositoriesParam || !authorsParam) {
      return NextResponse.json(
        { error: 'Missing repositories or authors parameter' },
        { status: 400 }
      );
    }

    const repositories: Repository[] = JSON.parse(repositoriesParam);
    const authors: string[] = JSON.parse(authorsParam);

    const github = createGitHubClient();

    // Process all author/repo combinations in parallel
    const promises = authors.flatMap(author =>
      repositories.map(async (repository) => ({
        author,
        repoId: repository.id,
        data: await countCommentsReceived(
          github.fetchGraphQL,
          repository.owner,
          repository.repo,
          author
        ).catch(error => {
          console.error(
            `Error fetching review comments for ${author} in ${repository.id}:`,
            error.message
          );
          return { commentsReceived: 0, prsAuthored: 0 };
        }),
      }))
    );

    const results = await Promise.all(promises);

    // Aggregate by author
    const stats: ReviewCommentStats[] = authors.map(author => {
      const authorResults = results.filter(r => r.author === author);
      return {
        author,
        commentsReceived: authorResults.reduce((sum, r) => sum + r.data.commentsReceived, 0),
        prsAuthored: authorResults.reduce((sum, r) => sum + r.data.prsAuthored, 0),
      };
    });

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error('Error in review-comments API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch review comments' },
      { status: 500 }
    );
  }
}
