import type { Repository } from '@/lib/types/github';

export function parseRepositories(input: string): Repository[] {
  return input
    .split(/[\n,]/) // Split on newlines or commas
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      // Support multiple formats:
      // - owner/repo
      // - https://github.com/owner/repo
      // - github.com/owner/repo

      let cleaned = line;
      if (line.includes('github.com/')) {
        cleaned = line.split('github.com/')[1];
      }
      cleaned = cleaned.replace(/\.git$/, '');

      const parts = cleaned.split('/').filter(p => p.length > 0);
      if (parts.length < 2) return null;

      const [owner, repo] = parts.slice(-2); // Take last two parts
      if (!owner || !repo) return null;

      return { owner, repo, id: `${owner}/${repo}` };
    })
    .filter((repo): repo is Repository => repo !== null);
}

export function parseAuthors(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map(author => author.trim())
    .filter(author => author.length > 0);
}
