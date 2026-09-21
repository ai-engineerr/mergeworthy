import type { CheckId, Verdict } from "@/interfaces/gateInterfaces";

export const TEXT = {
  title: "Mergeworthy",
  tagline: "Rank a repository's open pull requests by how ready they are for review.",
  repoLabel: "Public GitHub repository",
  repoPlaceholder: "owner/repo or a github.com URL",
  scan: "Scan open PRs",
  scanning: "Scanning…",
  samples: "Try:",
  queue: "Review queue",
  evidence: "Evidence",
  idle: "Enter a public repository to rank its open pull requests.",
  idleEvidence: "Select a pull request to see how each check was judged.",
  empty: "This repository has no open pull requests.",
  checking: "Checking…",
  noProblems: "No check crossed a threshold.",
  copyComment: "Copy suggested comment",
  copied: "Copied",
  openPull: "Open on GitHub",
  draft: "Draft",
  suggested: "Suggested comment",
  suggestedNote: "Assembled from fixed sentences, one per failed check. Nothing here is generated.",
  effort: "Review effort",
  latency: "Jev latency",
  noContributing: "No CONTRIBUTING file, so that check was skipped.",
  guardrail:
    "Mergeworthy never comments, labels or closes anything. It judges the contribution, not who wrote it, and reads text only: it cannot run tests. A person decides.",
  metrics: {
    pulls: "PRs judged",
    latency: "Avg Jev latency",
    cost: "Jev cost",
    github: "GitHub fetch",
    schema: "Off-schema"
  },
  requestFailed: "The scan did not finish. Try again.",
  invalidRepo: "Enter a repository as owner/repo or a github.com URL.",
  tooLong: "That is too long to be a repository.",
  keyMissing: "TYPESAFE_API_KEY is not set. Copy .env.example to .env.local and add your key.",
  badBody: "Expected a JSON body."
} as const;

export const VERDICT_TEXT: Record<Verdict, string> = {
  ready: "Ready for review",
  changes: "Needs author changes",
  lowValue: "Likely low-value",
  unchecked: "Needs a human look"
};

export const VERDICT_SHORT: Record<Verdict, string> = {
  ready: "READY",
  changes: "CHANGES",
  lowValue: "LOW VALUE",
  unchecked: "LOOK"
};

export const VERDICT_HELP: Record<Verdict, string> = {
  ready: "Nothing crossed a threshold.",
  changes: "One or more checks look like problems the author can fix.",
  lowValue: "Jev is confident the change has little clear benefit. A maintainer decides what to do.",
  unchecked: "An answer was missing or off-schema, or the call failed, so it is not called clean."
};

export const CHECK_TEXT: Record<CheckId, { label: string; failing: string }> = {
  describesChange: { label: "Explains what and why", failing: "The description does not say what changes or why." },
  matchesDiff: { label: "Description matches the diff", failing: "The description and the diff disagree." },
  testingEvidence: { label: "Shows how it was tested", failing: "No tests, and no account of how it was checked." },
  followsContributing: { label: "Follows CONTRIBUTING", failing: "It appears to skip a requirement in the contributing guide." },
  focused: { label: "One focused change", failing: "It mixes changes that could be reviewed separately." },
  lowValue: { label: "Has a clear benefit", failing: "The change looks cosmetic or adds noise." }
};

export const EFFORT_LABELS: string[] = ["Tiny", "Small", "Substantial", "Large"];
