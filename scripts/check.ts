/**
 * The smallest thing that fails if the non-trivial logic breaks.
 * Run with: npm run check
 */
import assert from "node:assert/strict";

import {
  CHECKS,
  EFFORT_QUESTION,
  EFFORT_QUESTION_ID,
  MAX_CONTRIBUTING_CHARS,
  MAX_DESCRIPTION_CHARS,
  MAX_DIFF_FILES,
  MAX_PATCH_CHARS,
  NO_CONTRIBUTING,
  NO_DESCRIPTION
} from "../src/constants/gateConstants.ts";
import { buildQuestions, compareRank, decide, failedCount, scoreLevel, summarize, tierFor } from "../src/helper/gate.ts";
import { buildPullState, type RawFile, type RawPull } from "../src/helper/pullState.ts";
import { parseRepo } from "../src/helper/repo.ts";
import type { Answer, Decision } from "../src/interfaces/gateInterfaces.ts";
import { backoff } from "../src/services/typesafe.ts";

/** A clean PR: every healthy check answers yes, low-value answers no. */
const healthy = (overrides: Record<string, Answer> = {}, hasContributing = true) => {
  const answers: Record<string, Answer> = {};
  for (const check of CHECKS) {
    if (check.needsContributing && !hasContributing) continue;
    answers[check.id] = { type: "noul", noul: check.healthyWhenTrue ? 0.97 : 0.03 };
  }
  answers[EFFORT_QUESTION_ID] = { type: "score", score: 1.2, confidence: 0.8 };
  return { ...answers, ...overrides };
};

const noul = (probability: number): Answer => ({ type: "noul", noul: probability });

// --- repository parsing: the result builds API paths, so it must be strict ---
assert.deepEqual(parseRepo("expressjs/express"), { owner: "expressjs", repo: "express" });
assert.deepEqual(parseRepo("  https://github.com/psf/requests/pulls  "), { owner: "psf", repo: "requests" });
assert.deepEqual(parseRepo("https://github.com/a/b.git"), { owner: "a", repo: "b" });
assert.equal(parseRepo("just-a-name"), undefined);
assert.equal(parseRepo("../etc/passwd"), undefined);
assert.equal(parseRepo("a/b c"), undefined);
assert.equal(parseRepo("a/.."), undefined);
assert.equal(parseRepo(""), undefined);

// --- questions: only the ones that apply are asked ---
const withGuide = buildQuestions(true);
const withoutGuide = buildQuestions(false);
assert.ok("followsContributing" in withGuide);
assert.ok(!("followsContributing" in withoutGuide), "no CONTRIBUTING file, no question against it");
assert.ok(EFFORT_QUESTION_ID in withGuide && EFFORT_QUESTION_ID in withoutGuide);
assert.equal(Object.keys(withGuide).length, Object.keys(withoutGuide).length + 1);
assert.ok(EFFORT_QUESTION.criteria.length >= 2 && EFFORT_QUESTION.criteria.length <= 10, "Score takes 2-10 levels");

// --- gates ---
assert.equal(tierFor(0.9), "confident");
assert.equal(tierFor(0.85), "confident");
assert.equal(tierFor(0.7), "possible");
assert.equal(tierFor(0.59), undefined);
assert.equal(scoreLevel(1.43, 4), 1, "a fractional score rounds to the nearest level");
assert.equal(scoreLevel(2.6, 4), 3);
assert.equal(scoreLevel(9, 4), 3, "never an out-of-range index");

// --- verdicts ---
const ready = decide(healthy(), true);
assert.equal(ready.verdict, "ready");
assert.equal(ready.comment, undefined);
assert.equal(ready.effortLevel, 1);
assert.equal(ready.typeErrors, 0);

const changes = decide(healthy({ describesChange: noul(0.1), testingEvidence: noul(0.2) }), true);
assert.equal(changes.verdict, "changes");
assert.equal(failedCount(changes as Decision), 2);
assert.ok(changes.comment?.includes("- Could you add a short description"), "one fixed sentence per failed check");
assert.ok(changes.comment?.includes("- Could you add or update tests"));
assert.ok(!changes.comment?.includes("split"), "a passing check adds nothing to the comment");

const uncertain = decide(healthy({ matchesDiff: noul(0.35) }), true);
assert.equal(uncertain.verdict, "changes", "a 65% problem is worth raising");
assert.equal(uncertain.findings.find((finding) => finding.checkId === "matchesDiff")?.tier, "possible");

const shrug = decide(healthy({ matchesDiff: noul(0.5) }), true);
assert.equal(shrug.verdict, "ready", "a coin-flip is not a finding");

assert.equal(decide(healthy({ lowValue: noul(0.95) }), true).verdict, "lowValue");
assert.equal(
  decide(healthy({ lowValue: noul(0.7) }), true).verdict,
  "ready",
  "low-value needs confidence, not a hunch"
);

// --- fail closed: a missing or off-schema answer is never a clean PR ---
const missing = healthy();
delete missing.focused;
const failedClosed = decide(missing, true);
assert.equal(failedClosed.verdict, "unchecked");
assert.equal(failedClosed.typeErrors, 1);

assert.equal(decide(healthy({ describesChange: { type: "score", score: 1, confidence: 1 } }), true).verdict, "unchecked");
assert.equal(decide(healthy({ describesChange: noul(1.4) }), true).verdict, "unchecked");
assert.equal(
  decide(healthy({ [EFFORT_QUESTION_ID]: { type: "score", score: 7, confidence: 1 } }), true).typeErrors,
  1,
  "a score beyond its own levels is off-schema, not clamped"
);

// A project with no CONTRIBUTING file is not marked down for missing an answer it was never asked.
assert.equal(decide(healthy({}, false), false).verdict, "ready");

// --- ranking: ready first, then fewest failures, then least effort ---
const decision = (verdict: Decision["verdict"], failing = 0, effortLevel = 0): Decision => ({
  verdict,
  findings: Array.from({ length: failing }, () => ({ checkId: "focused" as const, problem: 0.9, tier: "confident" as const })),
  effortLevel,
  effortScore: effortLevel,
  typeErrors: 0,
  latencyMs: 0
});
const ranked = [
  decision("lowValue"),
  decision("changes", 2),
  decision("ready", 0, 3),
  decision("changes", 1),
  decision("ready", 0, 0),
  decision("unchecked")
].sort(compareRank);
assert.deepEqual(
  ranked.map((item) => `${item.verdict}:${failedCount(item)}:${item.effortLevel}`),
  ["ready:0:0", "ready:0:3", "changes:1:0", "changes:2:0", "unchecked:0:0", "lowValue:0:0"]
);

// --- metrics ---
const metrics = summarize(
  [
    { decision: { ...decision("ready"), latencyMs: 300 }, inputTokens: 1000 },
    { decision: { ...decision("changes", 1), latencyMs: 500 }, inputTokens: 3000 }
  ],
  1200,
  0.042 / 1_000_000
);
assert.equal(metrics.pulls, 2);
assert.equal(metrics.averageMs, 400);
assert.equal(metrics.inputTokens, 4000);
assert.ok(Math.abs(metrics.costUsd - 0.000168) < 1e-9);
assert.equal(summarize([], 0, 1).averageMs, 0, "no PRs is zero, not NaN");

// --- what Jev reads is bounded, and never claims an absent description is a real one ---
const pull: RawPull = { number: 1, title: "Fix", body: null, draft: false, user: { login: "a" }, html_url: "https://x" };
const files: RawFile[] = Array.from({ length: MAX_DIFF_FILES + 3 }, (_, index) => ({
  filename: `f${index}.ts`,
  additions: 2,
  deletions: 1,
  patch: "x".repeat(MAX_PATCH_CHARS * 2)
}));
const state = buildPullState(pull, files, "y".repeat(MAX_CONTRIBUTING_CHARS * 2));
assert.equal(state.pullRequest.description, NO_DESCRIPTION);
assert.equal(state.pullRequest.changedFiles, files.length);
assert.equal(state.pullRequest.additions, files.length * 2);
assert.equal(state.diff.length, files.length, "every file is listed even when its patch is not");
assert.ok(state.diff[0].patch.length <= MAX_PATCH_CHARS + 20);
assert.equal(state.diff[MAX_DIFF_FILES].patch, "", "patches past the cap are dropped, the file is still named");
assert.ok(state.contributing.length <= MAX_CONTRIBUTING_CHARS + 20);
assert.equal(buildPullState(pull, [], undefined).contributing, NO_CONTRIBUTING);
assert.ok(
  buildPullState({ ...pull, body: "z".repeat(MAX_DESCRIPTION_CHARS * 2) }, [], undefined).pullRequest.description.length <=
    MAX_DESCRIPTION_CHARS + 20
);

// --- retry: honour Retry-After, otherwise back off with jitter ---
assert.equal(backoff(1, "2"), 2000);
assert.equal(backoff(1, "999"), 10_000, "Retry-After is capped");
assert.ok(backoff(1, null) >= 400 && backoff(1, null) < 500);
assert.ok(backoff(3, null) >= 1600);

console.log("check: all assertions passed");
