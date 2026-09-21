"use client";

import { useState, type FormEvent } from "react";

import { SAMPLE_REPOS } from "@/constants/gateConstants";
import { TEXT, VERDICT_SHORT } from "@/constants/text";
import { formatMs, formatUsd } from "@/helper/format";
import { useGate } from "@/hooks/useGate";
import type { Verdict } from "@/interfaces/gateInterfaces";

import { Evidence } from "./Evidence";
import styles from "./Gate.module.css";
import { PullQueue } from "./PullQueue";

const VERDICTS: Verdict[] = ["ready", "changes", "unchecked", "lowValue"];

export function GateView() {
  const { state, problem, scanning, start } = useGate();
  const [repo, setRepo] = useState<string>("");
  const [pinned, setPinned] = useState<number | undefined>();

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!repo.trim() || scanning) return;
    setPinned(undefined);
    void start(repo);
  };

  const scan = (sample: string): void => {
    setRepo(sample);
    setPinned(undefined);
    void start(sample);
  };

  const shown = pinned ?? state?.latest;
  const shownPull = state?.pulls.find((pull) => pull.number === shown);
  const counts = VERDICTS.map((verdict) => ({
    verdict,
    count: Object.values(state?.decisions ?? {}).filter((decision) => decision.verdict === verdict).length
  }));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{TEXT.title}</h1>
        <p>{TEXT.tagline}</p>
      </header>

      <form className={styles.form} onSubmit={submit}>
        <label htmlFor="repo">{TEXT.repoLabel}</label>
        <div className={styles.formRow}>
          <input
            id="repo"
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            placeholder={TEXT.repoPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className={styles.primary} disabled={scanning || !repo.trim()}>
            {scanning ? TEXT.scanning : TEXT.scan}
          </button>
        </div>
        <div className={styles.samples}>
          <span>{TEXT.samples}</span>
          {SAMPLE_REPOS.map((sample) => (
            <button key={sample} type="button" className={styles.chip} disabled={scanning} onClick={() => scan(sample)}>
              {sample}
            </button>
          ))}
        </div>
      </form>

      {problem ? (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      ) : null}

      {!state && !problem ? <p className={styles.idle}>{scanning ? TEXT.scanning : TEXT.idle}</p> : null}

      {state ? (
        <>
          <ul className={styles.summary} aria-label={state.repo}>
            <li className={styles.repoName}>{state.repo}</li>
            {counts.map(({ verdict, count }) => (
              <li key={verdict}>
                <span className={`${styles.badge} ${styles[verdict]}`}>{VERDICT_SHORT[verdict]}</span> {count}
              </li>
            ))}
          </ul>

          {state.pulls.length === 0 ? (
            <p className={styles.idle}>{TEXT.empty}</p>
          ) : (
            <div className={styles.columns}>
              <section aria-labelledby="queue-heading">
                <h2 id="queue-heading">{TEXT.queue}</h2>
                <PullQueue
                  pulls={state.pulls}
                  decisions={state.decisions}
                  selected={shown}
                  onSelect={setPinned}
                />
              </section>
              <section className={styles.sticky} aria-labelledby="evidence-heading" aria-live="polite">
                <h2 id="evidence-heading">{TEXT.evidence}</h2>
                {shownPull ? (
                  <Evidence
                    pull={shownPull}
                    decision={state.decisions[shownPull.number]}
                    hasContributing={state.hasContributing}
                  />
                ) : (
                  <p className={styles.hint}>{TEXT.idleEvidence}</p>
                )}
              </section>
            </div>
          )}

          {state.metrics ? (
            <dl className={styles.metrics}>
              <div>
                <dt>{TEXT.metrics.pulls}</dt>
                <dd>{state.metrics.pulls}</dd>
              </div>
              <div>
                <dt>{TEXT.metrics.latency}</dt>
                <dd>{formatMs(state.metrics.averageMs)}</dd>
              </div>
              <div>
                <dt>{TEXT.metrics.cost}</dt>
                <dd>{formatUsd(state.metrics.costUsd)}</dd>
              </div>
              <div>
                <dt>{TEXT.metrics.github}</dt>
                <dd>{formatMs(state.metrics.githubMs)}</dd>
              </div>
              <div>
                <dt>{TEXT.metrics.schema}</dt>
                <dd>{state.metrics.typeErrors}</dd>
              </div>
            </dl>
          ) : null}
        </>
      ) : null}

      <footer className={styles.footer}>{TEXT.guardrail}</footer>
    </main>
  );
}
