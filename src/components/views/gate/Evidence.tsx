"use client";

import { useState } from "react";

import { CHECKS, GATE } from "@/constants/gateConstants";
import {
  CHECK_TEXT,
  EFFORT_LABELS,
  TEXT,
  VERDICT_HELP,
  VERDICT_SHORT,
  VERDICT_TEXT
} from "@/constants/text";
import { formatMs, formatPercent } from "@/helper/format";
import type { Decision, PullSummary } from "@/interfaces/gateInterfaces";

import styles from "./Gate.module.css";

interface EvidenceProps {
  pull: PullSummary;
  decision?: Decision;
  hasContributing: boolean;
}

const COPIED_MS = 1500;

export function Evidence({ pull, decision, hasContributing }: EvidenceProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const copy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard access can be blocked; the comment is still selectable on screen.
    }
  };

  return (
    <div className={styles.evidence}>
      <header>
        <a className={styles.pullLink} href={pull.url} target="_blank" rel="noreferrer">
          #{pull.number} {pull.title}
          <span className={styles.visuallyHidden}> ({TEXT.openPull})</span>
        </a>
        <p className={styles.rowMeta}>
          {pull.author} · {pull.files} {pull.files === 1 ? "file" : "files"} · +{pull.additions} −{pull.deletions}
          {pull.draft ? ` · ${TEXT.draft}` : ""}
        </p>
      </header>

      {!decision ? (
        <p className={styles.hint}>{TEXT.checking}</p>
      ) : (
        <>
          <div className={styles.verdictLine}>
            <span className={`${styles.badge} ${styles[decision.verdict]}`}>{VERDICT_SHORT[decision.verdict]}</span>
            <strong>{VERDICT_TEXT[decision.verdict]}</strong>
            <span className={styles.latency}>
              {TEXT.latency}: {formatMs(decision.latencyMs)}
            </span>
          </div>
          <p className={styles.hint}>{VERDICT_HELP[decision.verdict]}</p>

          <ul className={styles.checks}>
            {CHECKS.map((check) => {
              const finding = decision.findings.find((candidate) => candidate.checkId === check.id);
              if (!finding) {
                return check.needsContributing && !hasContributing ? (
                  <li key={check.id} className={styles.skipped}>
                    {CHECK_TEXT[check.id].label}: {TEXT.noContributing}
                  </li>
                ) : null;
              }
              return (
                <li key={check.id}>
                  <div className={styles.checkHead}>
                    <span>{CHECK_TEXT[check.id].label}</span>
                    <span className={finding.tier ? styles[finding.tier] : styles.fine}>
                      {formatPercent(finding.problem)} problem
                    </span>
                  </div>
                  <div
                    className={styles.bar}
                    role="img"
                    aria-label={`${formatPercent(finding.problem)} probability of a problem`}
                    style={
                      {
                        "--value": finding.problem,
                        "--possible": GATE.possible,
                        "--confident": GATE.confident
                      } as React.CSSProperties
                    }
                  >
                    <span className={`${styles.fill} ${finding.tier ? styles[finding.tier] : styles.fine}`} />
                  </div>
                  {finding.tier ? <p className={styles.failing}>{CHECK_TEXT[check.id].failing}</p> : null}
                </li>
              );
            })}
          </ul>

          <p className={styles.effort}>
            {TEXT.effort}: <strong>{EFFORT_LABELS[decision.effortLevel]}</strong>
          </p>

          {decision.comment ? (
            <section className={styles.comment}>
              <h3>{TEXT.suggested}</h3>
              <pre>{decision.comment}</pre>
              <p className={styles.hint}>{TEXT.suggestedNote}</p>
              <button type="button" className={styles.secondary} onClick={() => copy(decision.comment ?? "")}>
                {copied ? TEXT.copied : TEXT.copyComment}
              </button>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
