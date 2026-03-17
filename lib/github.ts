const BASE = 'https://api.github.com';

async function ghFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    next: { revalidate: 0 }, // always fresh
  });
  if (!res.ok) throw new Error(`GitHub API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export interface GHWorkflowRun {
  id: number;
  name: string;
  path: string;          // e.g. ".github/workflows/ci.yml"
  status: string;        // "queued" | "in_progress" | "completed"
  conclusion: string | null;
  html_url: string;
  created_at: string;
  run_started_at: string | null;
}

export interface GHIssue {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  labels: Array<{ name: string }>;
}

export interface GHPR {
  number: number;
  title: string;
  html_url: string;
  state: string;
  merged_at: string | null;
  created_at: string;
}

export interface GHRepo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
}

export interface GHContentFile {
  name: string;
  path: string;
  type: string;
  download_url: string | null;
}

export async function fetchWorkflowRuns(repo: string, token: string) {
  return ghFetch<{ workflow_runs: GHWorkflowRun[] }>(
    `/repos/${repo}/actions/runs?per_page=20`,
    token
  );
}

export async function fetchOpenIssues(repo: string, token: string) {
  return ghFetch<GHIssue[]>(
    `/repos/${repo}/issues?labels=agent-ready,status%2Fin-progress&state=open&per_page=10`,
    token
  );
}

export async function fetchOpenPRs(repo: string, token: string) {
  return ghFetch<GHPR[]>(
    `/repos/${repo}/pulls?state=open&per_page=10`,
    token
  );
}

export async function fetchRecentlyMergedPRs(repo: string, token: string) {
  const prs = await ghFetch<GHPR[]>(
    `/repos/${repo}/pulls?state=closed&per_page=5`,
    token
  );
  return prs.filter((pr) => pr.merged_at !== null);
}

export async function fetchWorkflowFiles(repo: string, token: string) {
  return ghFetch<GHContentFile[]>(
    `/repos/${repo}/contents/.github/workflows`,
    token
  );
}

export async function fetchFileContent(
  repo: string,
  path: string,
  token: string
): Promise<string> {
  const res = await fetch(`${BASE}/repos/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.raw+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`GitHub contents ${path} → ${res.status}`);
  return res.text();
}

export async function fetchUserRepos(token: string) {
  return ghFetch<GHRepo[]>(
    '/user/repos?sort=updated&per_page=50&type=all',
    token
  );
}
