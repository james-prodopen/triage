import type { ReviewCommentStats } from '@/lib/types/github';

interface Repository {
  owner: string;
  repo: string;
  id: string;
}

export async function fetchReviewComments(
  repositories: Repository[],
  authors: string[]
): Promise<ReviewCommentStats[]> {
  try {
    const response = await fetch(
      `/api/github/review-comments?repositories=${encodeURIComponent(JSON.stringify(repositories))}&authors=${encodeURIComponent(JSON.stringify(authors))}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch review comments');
    }

    const data = await response.json();
    return data.stats;
  } catch (error: any) {
    console.error('Error fetching review comments:', error);
    throw error;
  }
}
