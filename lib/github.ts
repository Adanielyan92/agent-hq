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
  triggering_actor: { login: string; type: string } | null;
  event: string;         // "push" | "schedule" | "workflow_run" | etc.
}

export interface GHJobStep {
  name: string;
  status: string;   // "queued" | "in_progress" | "completed"
  conclusion: string | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface GHRunJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  steps: GHJobStep[];
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

export async function fetchRunJobs(repo: string, runId: number, token: string) {
  return ghFetch<{ jobs: GHRunJob[] }>(
    `/repos/${repo}/actions/runs/${runId}/jobs`,
    token
  );
}

/**
 * Fetches the last ~4KB of job logs for an in-progress run.
 * Returns a cleaned snippet (timestamps/markers stripped) or null on failure.
 */
export async function fetchJobLogsSnippet(
  repo: string,
  jobId: number,
  token: string
): Promise<string | null> {
  try {
    // Step 1: GitHub redirects us to a signed blob URL
    const redirectRes = await fetch(`${BASE}/repos/${repo}/actions/jobs/${jobId}/logs`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'manual',
      cache: 'no-store',
    });

    const logUrl = redirectRes.headers.get('location');
    if (!logUrl) return null;

    // Step 2: Fetch only the tail of the log (avoids downloading megabytes)
    const logRes = await fetch(logUrl, {
      headers: { Range: 'bytes=-4096' },
      cache: 'no-store',
    });
    if (!logRes.ok && logRes.status !== 206) return null;

    const raw = await logRes.text();

    // Step 3: Strip GitHub Actions log format:
    // "2024-01-15T10:23:45.1234567Z ##[group]Step name\n"
    const lines = raw
      .split('\n')
      .map(line =>
        line
          .replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /, '')
          .replace(/^##\[(?:group|endgroup|section|endsection|command|debug|warning|error|notice|add-matcher|remove-matcher)\]/, '')
          .trim()
      )
      .filter(line => line.length > 1);

    const snippet = lines.slice(-10).join('\n');
    return snippet || null;
  } catch {
    return null;
  }
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
