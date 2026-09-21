const SEGMENT = /^(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;
const GITHUB_URL = /^https?:\/\/(www\.)?github\.com\//i;

export interface RepoRef {
  owner: string;
  repo: string;
}

/**
 * Accepts `owner/repo` or a github.com URL, including one that points deeper
 * (`/pulls`, `/tree/main`). The result is used to build API paths, so every
 * segment is checked rather than trusted.
 */
export function parseRepo(input: string): RepoRef | undefined {
  const [owner, repo] = input.trim().replace(GITHUB_URL, "").split("/");
  const cleaned = repo?.replace(/\.git$/i, "");

  if (!owner || !cleaned) return undefined;

  return SEGMENT.test(owner) && SEGMENT.test(cleaned) ? { owner, repo: cleaned } : undefined;
}
