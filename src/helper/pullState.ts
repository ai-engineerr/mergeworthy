import {
  MAX_CONTRIBUTING_CHARS,
  MAX_DESCRIPTION_CHARS,
  MAX_DIFF_FILES,
  MAX_PATCH_CHARS,
  NO_CONTRIBUTING,
  NO_DESCRIPTION
} from "@/constants/gateConstants";
import type { PullState } from "@/interfaces/gateInterfaces";

export interface RawPull {
  number: number;
  title: string;
  body: string | null;
  draft: boolean;
  user: { login: string };
  html_url: string;
}

export interface RawFile {
  filename: string;
  additions: number;
  deletions: number;
  /** Absent for binary files and very large diffs. */
  patch?: string;
}

const truncate = (text: string, limit: number): string =>
  text.length > limit ? `${text.slice(0, limit)}\n[truncated]` : text;

/**
 * What Jev reads for one PR. Every long field is bounded: tokens are the cost, and
 * a smaller state is a faster and cheaper call. The file list is complete even when
 * the patches are not, so a change is never silently absent from the picture.
 */
export function buildPullState(pull: RawPull, files: RawFile[], contributing?: string): PullState {
  return {
    contributing: contributing ? truncate(contributing, MAX_CONTRIBUTING_CHARS) : NO_CONTRIBUTING,
    pullRequest: {
      title: pull.title,
      description: pull.body?.trim() ? truncate(pull.body.trim(), MAX_DESCRIPTION_CHARS) : NO_DESCRIPTION,
      changedFiles: files.length,
      additions: files.reduce((total, file) => total + file.additions, 0),
      deletions: files.reduce((total, file) => total + file.deletions, 0)
    },
    diff: files.map((file, index) => ({
      file: file.filename,
      additions: file.additions,
      deletions: file.deletions,
      patch: index < MAX_DIFF_FILES ? truncate(file.patch ?? "", MAX_PATCH_CHARS) : ""
    }))
  };
}
