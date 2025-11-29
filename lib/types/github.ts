export interface Repository {
  owner: string;
  repo: string;
  id: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  closed_at: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  repoId: string;
  owner: string;
  repo: string;
}

export interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  repoId: string;
}

export interface PRFilesMap {
  [key: string]: PRFile[];
}

export interface LoadingProgress {
  totalRepos: number;
  loadedRepos: number;
  totalPRs: number;
}
