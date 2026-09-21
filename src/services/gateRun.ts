import { JEV_INPUT_COST_PER_TOKEN } from "@/constants/gateConstants";
import { buildQuestions, decide, summarize } from "@/helper/gate";
import { buildPullState, type RawFile, type RawPull } from "@/helper/pullState";
import type { RepoRef } from "@/helper/repo";
import type { Decision, GateEvent } from "@/interfaces/gateInterfaces";
import { fetchContributing, fetchOpenPulls, fetchPullFiles } from "@/services/github";
import { askJev } from "@/services/typesafe";

interface Judged {
  number: number;
  decision: Decision;
  inputTokens: number;
  failure?: unknown;
}

/** Yields each promise's value as it settles, so one slow PR never holds up the rest. */
async function* inCompletionOrder<T>(promises: Promise<T>[]): AsyncGenerator<T> {
  const pending = new Map(promises.map((promise, index) => [index, promise.then((value) => ({ index, value }))]));

  while (pending.size) {
    const { index, value } = await Promise.race(pending.values());
    pending.delete(index);
    yield value;
  }
}

/** A PR Jev could not judge fails closed to "unchecked": it must never look like a clean one. */
const unchecked = (number: number, latencyMs: number, failure: unknown): Judged => ({
  number,
  inputTokens: 0,
  failure,
  decision: {
    verdict: "unchecked",
    findings: [],
    effortLevel: 0,
    effortScore: 0,
    typeErrors: 0,
    latencyMs
  }
});

/**
 * Streams a scan: the PR list first, then one result per PR as its judgment lands.
 * Every PR is one Jev call carrying all of its questions, all PRs in parallel.
 */
export async function* runGate(ref: RepoRef): AsyncGenerator<GateEvent> {
  const fetchStarted = performance.now();
  const [contributing, pulls] = await Promise.all([fetchContributing(ref), fetchOpenPulls(ref)]);
  const withFiles: { pull: RawPull; files: RawFile[] }[] = await Promise.all(
    pulls.map(async (pull) => ({ pull, files: await fetchPullFiles(ref, pull.number) }))
  );
  const githubMs = Math.round(performance.now() - fetchStarted);
  const hasContributing = contributing !== undefined;

  yield {
    type: "meta",
    repo: `${ref.owner}/${ref.repo}`,
    hasContributing,
    githubMs,
    pulls: withFiles.map(({ pull, files }) => ({
      number: pull.number,
      title: pull.title,
      author: pull.user.login,
      url: pull.html_url,
      draft: pull.draft,
      files: files.length,
      additions: files.reduce((total, file) => total + file.additions, 0),
      deletions: files.reduce((total, file) => total + file.deletions, 0)
    }))
  };

  const questions = buildQuestions(hasContributing);
  const jobs = withFiles.map(async ({ pull, files }): Promise<Judged> => {
    const started = performance.now();
    try {
      const response = await askJev(buildPullState(pull, files, contributing), questions);
      const latencyMs = Math.round(performance.now() - started);
      return {
        number: pull.number,
        inputTokens: response.usage?.input_tokens ?? 0,
        decision: { ...decide(response.answers, hasContributing), latencyMs }
      };
    } catch (failure) {
      return unchecked(pull.number, Math.round(performance.now() - started), failure);
    }
  });

  const judged: Judged[] = [];
  for await (const result of inCompletionOrder(jobs)) {
    judged.push(result);
    yield { type: "result", number: result.number, decision: result.decision, inputTokens: result.inputTokens };
  }

  // A bad key or an outage fails every PR alike. That is an error to report, not a queue of "unchecked".
  const failure = judged.find((result) => result.failure)?.failure;
  if (failure && judged.every((result) => result.failure)) throw failure;

  yield { type: "done", metrics: summarize(judged, githubMs, JEV_INPUT_COST_PER_TOKEN) };
}
