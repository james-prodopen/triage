import type { GitHubPR } from '@/lib/types/github';

interface FetchPRsOptions {
  owner: string;
  repo: string;
  repoId: string;
  query: string;
  onProgress?: (loaded: number, total: number) => void;
  onWarning?: (message: string, description: string) => void;
}

export async function fetchPRsWithPagination(
  options: FetchPRsOptions
): Promise<GitHubPR[]> {
  const { owner, repo, repoId, query, onProgress, onWarning } = options;
  const allPRs: GitHubPR[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `/api/github/pulls?q=${encodeURIComponent(query)}&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&per_page=${perPage}&page=${page}`
    );
    const data = await response.json();

    if (!data.success) {
      console.error(`Error loading ${repoId}:`, data.error);
      break;
    }

    // Check for warnings (>1000 results, 0 results)
    if (page === 1 && data.total_count > 1000 && onWarning) {
      onWarning(
        `Repository "${repoId}" has ${data.total_count} PRs (exceeds 1000 limit)`,
        'Please refine your query with date filters to get complete results.'
      );
      break;
    }

    if (page === 1 && data.total_count === 0 && onWarning) {
      onWarning(
        `Repository "${repoId}" has no PRs matching query`,
        'Try adjusting your query to match more results.'
      );
      break;
    }

    // Enhance PRs with repo context
    const enhancedPRs = data.data.map((pr: any) => ({
      ...pr,
      repoId,
      owner,
      repo,
    }));

    allPRs.push(...enhancedPRs);

    if (onProgress) {
      onProgress(allPRs.length, data.total_count);
    }

    if (allPRs.length >= data.total_count ||
        allPRs.length >= 1000 ||
        data.data.length < perPage) {
      break;
    }

    page++;
  }

  return allPRs;
}
