/**
 * GitHub REST API Client using Octokit
 *
 * Required environment variables:
 * - GITHUB_TOKEN: Personal Access Token with scopes: repo, read:org, read:user
 */
import { Octokit } from 'octokit';

export function createGitHubClient() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('Missing GITHUB_TOKEN in environment variables');
  }

  const octokit = new Octokit({
    auth: token
  });

  /**
   * Make a request to the GitHub REST API
   * @param endpoint - The API endpoint (e.g., "GET /repos/{owner}/{repo}/pulls")
   * @param params - Parameters for the request
   */
  async function fetchGitHub<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    try {
      const response = await octokit.request(endpoint, params);
      return response.data as T;
    } catch (error: any) {
      throw new Error(`GitHub API error: ${error.status} ${error.message}`);
    }
  }

  return {
    fetchGitHub,
    octokit // Expose the full octokit instance for advanced usage
  };
}
