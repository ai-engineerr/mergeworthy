import { EFFORT_LABELS, TEXT, VERDICT_SHORT } from "@/constants/text";
import { formatMs } from "@/helper/format";
import { compareRank } from "@/helper/gate";
import type { Decision, PullSummary } from "@/interfaces/gateInterfaces";

import styles from "./Gate.module.css";

interface PullQueueProps {
  pulls: PullSummary[];
  decisions: Record<number, Decision>;
  selected?: number;
  onSelect: (number: number) => void;
}

/** Judged PRs first, ranked; PRs still being checked keep their order underneath. */
export function rankPulls(pulls: PullSummary[], decisions: Record<number, Decision>): PullSummary[] {
  const judged = pulls
    .filter((pull) => decisions[pull.number])
    .sort((a, b) => compareRank(decisions[a.number], decisions[b.number]));

  return [...judged, ...pulls.filter((pull) => !decisions[pull.number])];
}

export function PullQueue({ pulls, decisions, selected, onSelect }: PullQueueProps) {
  return (
    <ol className={styles.queue}>
      {rankPulls(pulls, decisions).map((pull) => {
        const decision = decisions[pull.number];

        return (
          <li key={pull.number}>
            <button
              type="button"
              className={styles.row}
              aria-pressed={selected === pull.number}
              onClick={() => onSelect(pull.number)}
            >
              {decision ? (
                <span className={`${styles.badge} ${styles[decision.verdict]}`}>{VERDICT_SHORT[decision.verdict]}</span>
              ) : (
                <span className={`${styles.badge} ${styles.pending}`}>{TEXT.checking}</span>
              )}
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  <span className={styles.number}>#{pull.number}</span> {pull.title}
                </span>
                <span className={styles.rowMeta}>
                  {pull.author} · {pull.files} {pull.files === 1 ? "file" : "files"} · +{pull.additions} −{pull.deletions}
                  {pull.draft ? ` · ${TEXT.draft}` : ""}
                  {decision ? ` · ${EFFORT_LABELS[decision.effortLevel]}` : ""}
                </span>
              </span>
              {decision ? <span className={styles.latency}>{formatMs(decision.latencyMs)}</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
