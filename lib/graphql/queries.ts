/**
 * GitHub GraphQL queries for review comments
 */

/**
 * Query to fetch review comments received on PRs authored by a specific user
 * Returns PRs with their reviews and review thread comments
 */
export const GET_REVIEW_COMMENTS_RECEIVED = `
  query GetReviewCommentsReceived($searchQuery: String!) {
    search(type: ISSUE, query: $searchQuery, first: 100) {
      nodes {
        ... on PullRequest {
          author {
            login
          }
          additions
          deletions
          reviews(first: 10) {
            totalCount
            nodes {
              comments {
                totalCount
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL response types
 */

export interface GraphQLAuthor {
  login: string;
}

export interface GraphQLComments {
  totalCount: number;
}

export interface GraphQLReview {
  comments: GraphQLComments;
}

export interface GraphQLPullRequest {
  author: GraphQLAuthor;
  additions: number;
  deletions: number;
  reviews: {
    totalCount: number;
    nodes: GraphQLReview[];
  };
}

export interface GetReviewCommentsReceivedResponse {
  search: {
    nodes: GraphQLPullRequest[];
  };
}
