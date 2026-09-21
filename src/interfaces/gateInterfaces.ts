export type CheckId =
  | "describesChange"
  | "matchesDiff"
  | "testingEvidence"
  | "followsContributing"
  | "focused"
  | "lowValue";

export type Verdict = "ready" | "changes" | "lowValue" | "unchecked";

/** `confident` and `possible` are gates on the probability that a check has a problem. */
export type Tier = "confident" | "possible";

export interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
}

export interface ScoreQuestion {
  type: "score";
  instructions: string;
  criteria: string[];
}

export type Question = NoulQuestion | ScoreQuestion;

export interface NoulAnswer {
  type: "noul";
  noul: number;
}

/** `score` is a probability-weighted position on 0-based levels, so it is usually fractional. */
export interface ScoreAnswer {
  type: "score";
  score: number;
  confidence: number;
  probabilities?: Record<string, number>;
}

export type Answer = NoulAnswer | ScoreAnswer | { type: "choice" };

export interface SystemOneResponse {
  model?: string;
  answers: Record<string, Answer | undefined>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** A check's answer, normalised so a higher number always means a bigger problem. */
export interface Finding {
  checkId: CheckId;
  problem: number;
  tier?: Tier;
}

export interface Decision {
  verdict: Verdict;
  findings: Finding[];
  effortLevel: number;
  effortScore: number;
  /** Answers that were missing or off-schema. Any of these fails the PR closed to "unchecked". */
  typeErrors: number;
  latencyMs: number;
  /** Assembled from fixed sentences, one per failed check. Nothing is generated. */
  comment?: string;
}

export interface PullSummary {
  number: number;
  title: string;
  author: string;
  url: string;
  draft: boolean;
  files: number;
  additions: number;
  deletions: number;
}

/** What Jev reads for one pull request. Long fields are truncated to bound cost and latency. */
export interface PullState {
  contributing: string;
  pullRequest: { title: string; description: string; changedFiles: number; additions: number; deletions: number };
  diff: { file: string; additions: number; deletions: number; patch: string }[];
}

export interface GateMetrics {
  pulls: number;
  ready: number;
  changes: number;
  lowValue: number;
  unchecked: number;
  averageMs: number;
  inputTokens: number;
  costUsd: number;
  typeErrors: number;
  githubMs: number;
}

export type GateEvent =
  | { type: "meta"; repo: string; hasContributing: boolean; pulls: PullSummary[]; githubMs: number }
  | { type: "result"; number: number; decision: Decision; inputTokens: number }
  | { type: "done"; metrics: GateMetrics }
  | { type: "failed"; error: string };
