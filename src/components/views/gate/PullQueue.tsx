"use client";
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
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

export function rankPulls(
  pulls: PullSummary[],
  decisions: Record<number, Decision>,
): PullSummary[] {
  const judged = pulls
    .filter((pull) => decisions[pull.number])
    .sort((a, b) => compareRank(decisions[a.number], decisions[b.number]));

  return [...judged, ...pulls.filter((pull) => !decisions[pull.number])];
}

export function PullQueue({
  pulls,
  decisions,
  selected,
  onSelect,
}: PullQueueProps) {
  const rankedPulls = useMemo(
    () => rankPulls(pulls, decisions),
    [pulls, decisions],
  );

  const buttonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (selected === undefined) return;

    buttonRefs.current[selected]?.focus();
  }, [selected, rankedPulls]);

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentNumber: number,
  ): void => {
    const currentIndex = rankedPulls.findIndex(
      (pull) => pull.number === currentNumber,
    );

    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    switch (event.key) {
      case "ArrowDown":
        nextIndex = Math.min(currentIndex + 1, rankedPulls.length - 1);
        break;

      case "ArrowUp":
        nextIndex = Math.max(currentIndex - 1, 0);
        break;

      case "Home":
        nextIndex = 0;
        break;

      case "End":
        nextIndex = rankedPulls.length - 1;
        break;

      default:
        return;
    }

    event.preventDefault();

    const nextPull = rankedPulls[nextIndex];

    if (nextPull.number !== currentNumber) {
      onSelect(nextPull.number);
    } else {
      buttonRefs.current[currentNumber]?.focus();
    }
  };

  return (
    <ol className={styles.queue}>
      {rankedPulls.map((pull) => {
        const decision = decisions[pull.number];

        return (
          <li key={pull.number}>
            <button
              ref={(element) => {
                buttonRefs.current[pull.number] = element;
              }}
              type="button"
              className={styles.row}
              aria-pressed={selected === pull.number}
              tabIndex={selected === pull.number ? 0 : -1}
              onClick={() => onSelect(pull.number)}
              onKeyDown={(event) => handleKeyDown(event, pull.number)}
            >
              {decision ? (
                <span className={`${styles.badge} ${styles[decision.verdict]}`}>
                  {VERDICT_SHORT[decision.verdict]}
                </span>
              ) : (
                <span className={`${styles.badge} ${styles.pending}`}>
                  {TEXT.checking}
                </span>
              )}

              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  <span className={styles.number}>#{pull.number}</span>{" "}
                  {pull.title}
                </span>

                <span className={styles.rowMeta}>
                  {pull.author} · {pull.files}{" "}
                  {pull.files === 1 ? "file" : "files"} · +{pull.additions} −
                  {pull.deletions}
                  {pull.draft ? ` · ${TEXT.draft}` : ""}
                  {decision ? ` · ${EFFORT_LABELS[decision.effortLevel]}` : ""}
                </span>
              </span>

              {decision ? (
                <span className={styles.latency}>
                  {formatMs(decision.latencyMs)}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
