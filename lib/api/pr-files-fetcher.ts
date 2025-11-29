import type { GitHubPR, PRFilesMap } from '@/lib/types/github';

export async function fetchFilesForPRs(prs: GitHubPR[]): Promise<PRFilesMap> {
  const filesMap: PRFilesMap = {};

  const filePromises = prs.map(async (pr) => {
    try {
      const response = await fetch(
        `/api/github/pulls/${pr.number}/files?owner=${encodeURIComponent(pr.owner)}&repo=${encodeURIComponent(pr.repo)}`
      );
      const data = await response.json();

      if (data.success) {
        const key = `${pr.repoId}#${pr.number}`;
        const enhancedFiles = data.data.map((file: any) => ({
          ...file,
          repoId: pr.repoId,
        }));
        filesMap[key] = enhancedFiles;
      }
    } catch (err) {
      console.error(`Failed to load files for PR #${pr.number}:`, err);
    }
  });

  await Promise.all(filePromises);
  return filesMap;
}
