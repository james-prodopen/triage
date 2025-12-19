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
 * Count reviews and review comments on PRs authored by a specific user
 */
async function countCommentsReceived(
  fetchGraphQL: <T = any>(query: string, variables?: Record<string, any>) => Promise<T>,
  owner: string,
  repo: string,
  author: string
): Promise<{ reviewsReceived: number; commentsReceived: number; prsAuthored: number; totalChanges: number; totalFilesChanged: number }> {
  // Build search query: PRs authored by user, in repo, sorted by most recent first (will get first 100)
  const searchQuery = `repo:${owner}/${repo} is:pr author:${author} sort:created-desc`;

  // Fetch first 100 PRs (no pagination)
  const response = await fetchGraphQL<GetReviewCommentsReceivedResponse>(
    GET_REVIEW_COMMENTS_RECEIVED,
    { searchQuery }
  );

  const prs = response.search.nodes;
  const prsAuthored = prs.length;

  // Count reviews, review comments, total changes, and files changed on these PRs
  let reviewsReceived = 0;
  let commentsReceived = 0;
  let totalChanges = 0;
  let totalFilesChanged = 0;
  for (const pr of prs) {
    if (pr.reviews) {
      reviewsReceived += pr.reviews.totalCount || 0;
      if (pr.reviews.nodes) {
        for (const review of pr.reviews.nodes) {
          commentsReceived += review.comments?.totalCount || 0;
        }
      }
    }
    totalChanges += (pr.additions || 0) + (pr.deletions || 0);
    totalFilesChanged += pr.changedFiles || 0;
  }

  return { reviewsReceived, commentsReceived, prsAuthored, totalChanges, totalFilesChanged };
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
          return { reviewsReceived: 0, commentsReceived: 0, prsAuthored: 0, totalChanges: 0, totalFilesChanged: 0 };
        }),
      }))
    );

    const results = await Promise.all(promises);

    // Aggregate by author
    const stats = authors.map(author => {
      const authorResults = results.filter(r => r.author === author);
      const reviewsReceived = authorResults.reduce((sum, r) => sum + r.data.reviewsReceived, 0);
      const commentsReceived = authorResults.reduce((sum, r) => sum + r.data.commentsReceived, 0);
      const prsAuthored = authorResults.reduce((sum, r) => sum + r.data.prsAuthored, 0);
      const totalChanges = authorResults.reduce((sum, r) => sum + r.data.totalChanges, 0);
      const totalFilesChanged = authorResults.reduce((sum, r) => sum + r.data.totalFilesChanged, 0);
      const averagePRSize = prsAuthored > 0 ? Math.round(totalChanges / prsAuthored) : 0;
      const averageFilesChanged = prsAuthored > 0 ? Math.round((totalFilesChanged / prsAuthored) * 100) / 100 : 0;

      return {
        author,
        reviewsReceived,
        commentsReceived,
        prsAuthored,
        totalChanges,
        averagePRSize,
        totalFilesChanged,
        averageFilesChanged,
      };
    });

    // Calculate min-max normalized PR size scores (smaller is better)
    const prSizes = stats.map(s => s.averagePRSize).filter(size => size > 0);
    const minSize = prSizes.length > 0 ? Math.min(...prSizes) : 0;
    const maxSize = prSizes.length > 0 ? Math.max(...prSizes) : 0;

    const statsWithScores: ReviewCommentStats[] = stats.map(stat => {
      let prSizeScore = 0;
      if (stat.averagePRSize > 0 && maxSize > minSize) {
        // Normalize between 0-1, then subtract from 1 (smaller PRs get higher scores)
        const normalized = (stat.averagePRSize - minSize) / (maxSize - minSize);
        prSizeScore = 1 - normalized;
      } else if (stat.averagePRSize > 0 && maxSize === minSize) {
        // All PR sizes are the same
        prSizeScore = 0.5;
      }

      return {
        ...stat,
        prSizeScore,
      };
    });

    return NextResponse.json({ stats: statsWithScores });
  } catch (error: any) {
    console.error('Error in review-comments API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch review comments' },
      { status: 500 }
    );
  }
}
