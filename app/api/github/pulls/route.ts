import { NextResponse } from 'next/server';
import { createGitHubClient } from '@/lib/github-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q'); // Raw search query
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const sort = searchParams.get('sort') || 'created'; // created, updated, comments, reactions, interactions
    const order = searchParams.get('order') || 'desc'; // asc, desc
    const per_page = searchParams.get('per_page') || '30';
    const page = searchParams.get('page') || '1';

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'q parameter is required (e.g., "is:pr is:closed in:title fix")' },
        { status: 400 }
      );
    }

    if (!owner || !repo) {
      return NextResponse.json(
        { success: false, error: 'owner and repo parameters are required' },
        { status: 400 }
      );
    }

    const github = createGitHubClient();

    // Add repo filter to the query
    const fullQuery = `repo:${owner}/${repo} ${query}`;

    // Search for pull requests using GitHub Search API
    const result = await github.fetchGitHub('GET /search/issues', {
      q: fullQuery,
      sort,
      order,
      per_page: parseInt(per_page),
      page: parseInt(page),
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      total_count: result.total_count,
      incomplete_results: result.incomplete_results,
    });
  } catch (error) {
    console.error('Error fetching GitHub pull requests:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
