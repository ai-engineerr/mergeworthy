"use client";

import { useCallback, useRef, useState } from "react";

import { TEXT } from "@/constants/text";
import type { Decision, GateEvent, GateMetrics, PullSummary } from "@/interfaces/gateInterfaces";

export interface GateState {
  repo: string;
  hasContributing: boolean;
  githubMs: number;
  pulls: PullSummary[];
  decisions: Record<number, Decision>;
  /** The PR whose result landed most recently, so the evidence panel can follow the scan. */
  latest?: number;
  metrics?: GateMetrics;
}

/**
 * Reads the newline-delimited scan stream and folds it into state as it arrives,
 * so PRs are judged and ranked one by one rather than after the whole scan.
 */
export function useGate() {
  const [state, setState] = useState<GateState | undefined>();
  const [problem, setProblem] = useState<string>("");
  const [scanning, setScanning] = useState<boolean>(false);
  const aborter = useRef<AbortController | undefined>(undefined);

  const start = useCallback(async (repo: string): Promise<void> => {
    aborter.current?.abort();
    const controller = new AbortController();
    aborter.current = controller;

    setScanning(true);
    setProblem("");
    setState(undefined);

    try {
      const response = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? TEXT.requestFailed);
      }

      for await (const event of readEvents(response.body, controller.signal)) {
        if (event.type === "failed") throw new Error(event.error);

        setState((current) => fold(current, event));
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      setProblem(caught instanceof Error ? caught.message : TEXT.requestFailed);
    } finally {
      if (!controller.signal.aborted) setScanning(false);
    }
  }, []);

  return { state, problem, scanning, start };
}

function fold(current: GateState | undefined, event: GateEvent): GateState | undefined {
  if (event.type === "meta") {
    return {
      repo: event.repo,
      hasContributing: event.hasContributing,
      githubMs: event.githubMs,
      pulls: event.pulls,
      decisions: {}
    };
  }
  if (!current) return current;
  if (event.type === "result") {
    return { ...current, decisions: { ...current.decisions, [event.number]: event.decision }, latest: event.number };
  }
  if (event.type === "done") return { ...current, metrics: event.metrics };
  return current;
}

/** Splits the response body on newlines; a chunk can hold part of a line or several. */
async function* readEvents(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<GateEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as GateEvent;
      }
    }
    if (buffer.trim()) yield JSON.parse(buffer) as GateEvent;
  } finally {
    reader.releaseLock();
  }
}
