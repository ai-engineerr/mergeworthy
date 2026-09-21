import {
  CHECKS,
  COMMENT_GREETING,
  EFFORT_QUESTION,
  EFFORT_QUESTION_ID,
  GATE,
  LOW_VALUE_GATE,
  VERDICT_RANK,
  type Check
} from "@/constants/gateConstants";
import type {
  Answer,
  Decision,
  Finding,
  GateMetrics,
  Question,
  SystemOneResponse,
  Tier,
  Verdict
} from "@/interfaces/gateInterfaces";

const activeChecks = (hasContributing: boolean): Check[] =>
  CHECKS.filter((check) => !check.needsContributing || hasContributing);

/** Only the questions that apply: a project with no CONTRIBUTING file is not judged against one. */
export const buildQuestions = (hasContributing: boolean): Record<string, Question> => ({
  ...Object.fromEntries(activeChecks(hasContributing).map((check) => [check.id, check.question])),
  [EFFORT_QUESTION_ID]: EFFORT_QUESTION
});

export const tierFor = (problem: number): Tier | undefined => {
  if (problem >= GATE.confident) return "confident";
  if (problem >= GATE.possible) return "possible";
  return undefined;
};

/**
 * A Score is a probability-weighted position on 0-based levels (1.43 sits between
 * levels 1 and 2), so the nearest level is found by rounding, never by using the
 * score as an index.
 */
export const scoreLevel = (score: number, levels: number): number =>
  Math.min(Math.max(Math.round(score), 0), levels - 1);

const readNoul = (answer: Answer | undefined): number | undefined =>
  answer?.type === "noul" && Number.isFinite(answer.noul) && answer.noul >= 0 && answer.noul <= 1
    ? answer.noul
    : undefined;

/** A score outside its own levels is off-schema, not something to clamp quietly. */
const readScore = (answer: Answer | undefined, levels: number): number | undefined =>
  answer?.type === "score" && Number.isFinite(answer.score) && answer.score >= 0 && answer.score <= levels - 1
    ? answer.score
    : undefined;

const buildComment = (findings: Finding[]): string | undefined => {
  const asks = findings
    .filter((finding) => finding.tier)
    .map((finding) => CHECKS.find((check) => check.id === finding.checkId)?.ask)
    .filter((ask): ask is string => Boolean(ask));

  return asks.length ? [COMMENT_GREETING, ...asks.map((ask) => `- ${ask}`)].join("\n") : undefined;
};

/**
 * Turns raw judgments into a verdict. The model says what is true of the PR; this
 * says what to do about it. A missing or off-schema answer fails closed to
 * "unchecked" and is counted, so it never reads as a clean PR.
 */
export function decide(
  answers: SystemOneResponse["answers"],
  hasContributing: boolean
): Omit<Decision, "latencyMs"> {
  const findings: Finding[] = [];
  let typeErrors = 0;

  for (const check of activeChecks(hasContributing)) {
    const answer = readNoul(answers[check.id]);
    if (answer === undefined) {
      typeErrors += 1;
      continue;
    }
    const problem = check.healthyWhenTrue ? 1 - answer : answer;
    findings.push({ checkId: check.id, problem, tier: tierFor(problem) });
  }

  const effort = readScore(answers[EFFORT_QUESTION_ID], EFFORT_QUESTION.criteria.length);
  if (effort === undefined) typeErrors += 1;

  const effortScore = effort ?? 0;
  const base = {
    findings,
    typeErrors,
    effortScore,
    effortLevel: scoreLevel(effortScore, EFFORT_QUESTION.criteria.length)
  };

  if (typeErrors) return { ...base, verdict: "unchecked" };

  const lowValue = findings.find((finding) => finding.checkId === "lowValue");
  if (lowValue && lowValue.problem >= LOW_VALUE_GATE) return { ...base, verdict: "lowValue" };

  const failing = findings.filter((finding) => finding.tier && finding.checkId !== "lowValue");
  return failing.length
    ? { ...base, verdict: "changes", comment: buildComment(failing) }
    : { ...base, verdict: "ready" };
}

/** Findings that crossed a gate, excluding the low-value signal that has its own verdict. */
export const failedCount = (decision: Decision): number =>
  decision.findings.filter((finding) => finding.tier && finding.checkId !== "lowValue").length;

/** Ready first, then by fewest failed checks, then by least review effort. */
export const compareRank = (a: Decision, b: Decision): number =>
  VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] ||
  failedCount(a) - failedCount(b) ||
  a.effortLevel - b.effortLevel;

export const summarize = (
  results: { decision: Decision; inputTokens: number }[],
  githubMs: number,
  costPerToken: number
): GateMetrics => {
  const count = (verdict: Verdict): number => results.filter((result) => result.decision.verdict === verdict).length;
  const inputTokens = results.reduce((total, result) => total + result.inputTokens, 0);
  const latencies = results.map((result) => result.decision.latencyMs);

  return {
    pulls: results.length,
    ready: count("ready"),
    changes: count("changes"),
    lowValue: count("lowValue"),
    unchecked: count("unchecked"),
    averageMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
    inputTokens,
    costUsd: inputTokens * costPerToken,
    typeErrors: results.reduce((total, result) => total + result.decision.typeErrors, 0),
    githubMs
  };
};
