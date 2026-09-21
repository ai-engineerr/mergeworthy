import {
  CONTRIBUTING_PATHS,
  GITHUB_API,
  GITHUB_API_VERSION,
  MAX_CONTRIBUTING_CHARS,
  MAX_PULLS
} from "@/constants/gateConstants";
import type { RawFile, RawPull } from "@/helper/pullState";
import type { RepoRef } from "@/helper/repo";

const FILES_PER_PAGE = 100;
const RAW_CONTENT = "application/vnd.github.raw+json";

export class GitHubError extends Error {
  readonly status: number;
  readonly rateLimited: boolean;

  constructor(status: number, rateLimited: boolean) {
    super(`GitHub responded ${status}`);
    this.status = status;
    this.rateLimited = rateLimited;
  }

  /** Worded for the person running the scan, not the operator. */
  get forReader(): string {
    if (this.status === 401) return "GitHub rejected the GITHUB_TOKEN. Check it, or remove it to scan without one.";
    if (this.rateLimited) return "GitHub's rate limit was reached. Add a GITHUB_TOKEN to .env.local to raise it.";
    if (this.status === 404) return "That repository was not found, or it is not public.";
    return "GitHub could not be reached. Try again in a moment.";
  }
}

/** The token is optional: unauthenticated requests work for public repositories, at a lower limit. */
async function github(path: string, accept = "application/vnd.github+json"): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: accept,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": "mergeworthy",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    cache: "no-store"
  });

  if (response.ok) return response;

  const exhausted = response.headers.get("x-ratelimit-remaining") === "0";
  throw new GitHubError(response.status, response.status === 429 || (response.status === 403 && exhausted));
}

const repoPath = ({ owner, repo }: RepoRef): string => `/repos/${owner}/${repo}`;

export async function fetchOpenPulls(ref: RepoRef): Promise<RawPull[]> {
  const response = await github(`${repoPath(ref)}/pulls?state=open&sort=updated&per_page=${MAX_PULLS}`);
  return (await response.json()) as RawPull[];
}

export async function fetchPullFiles(ref: RepoRef, number: number): Promise<RawFile[]> {
  const response = await github(`${repoPath(ref)}/pulls/${number}/files?per_page=${FILES_PER_PAGE}`);
  return (await response.json()) as RawFile[];
}

/** The first CONTRIBUTING file found in the usual places, or undefined when the project has none. */
export async function fetchContributing(ref: RepoRef): Promise<string | undefined> {
  for (const path of CONTRIBUTING_PATHS) {
    try {
      const response = await github(`${repoPath(ref)}/contents/${path}`, RAW_CONTENT);
      return (await response.text()).slice(0, MAX_CONTRIBUTING_CHARS);
    } catch (error) {
      // A missing file just means try the next location; anything else is a real failure.
      if (!(error instanceof GitHubError) || error.status !== 404) throw error;
    }
  }
  return undefined;
}
