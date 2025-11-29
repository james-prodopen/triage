import { NextResponse } from 'next/server';
import { createGitHubClient } from '@/lib/github-client';

export async function GET(
  request: Request,
  context: { params: Promise<{ pull_number: string }> }
) {
  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const per_page = searchParams.get('per_page') || '100';

    if (!owner || !repo) {
      return NextResponse.json(
        { success: false, error: 'owner and repo query parameters are required' },
        { status: 400 }
      );
    }

    const github = createGitHubClient();

    // Fetch files changed in the PR
    const files = await github.fetchGitHub('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
      owner,
      repo,
      pull_number: parseInt(params.pull_number),
      per_page: parseInt(per_page),
    });

    return NextResponse.json({
      success: true,
      data: files,
    });
  } catch (error) {
    console.error('Error fetching PR files:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
