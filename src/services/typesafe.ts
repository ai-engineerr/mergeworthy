import {
  BACKOFF_BASE_MS,
  BACKOFF_JITTER,
  BACKOFF_MAX_MS,
  JEV_ENDPOINT,
  JEV_MODEL,
  MAX_ATTEMPTS,
  RETRYABLE_STATUSES
} from "@/constants/gateConstants";
import type { Question, SystemOneResponse } from "@/interfaces/gateInterfaces";

export const hasApiKey = (): boolean => Boolean(process.env.TYPESAFE_API_KEY);

export class TypeSafeError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`TypeSafe responded ${status}`);
    this.status = status;
  }

  /** Worded for the person running the scan, not the operator. */
  get forReader(): string {
    if (this.status === 401 || this.status === 403) return "The TypeSafe API key was rejected.";
    if (RETRYABLE_STATUSES.has(this.status)) return "TypeSafe is busy right now. Try again in a moment.";
    return "TypeSafe could not answer that request.";
  }
}

/**
 * One call, many questions over the same state. Retries 429 and 529 (and gateway
 * errors) with exponential backoff, as the API docs direct. A 4xx such as a bad
 * key is not retried: waiting will not fix it.
 */
export async function askJev(state: unknown, questions: Record<string, Question>): Promise<SystemOneResponse> {
  const body = JSON.stringify({ model: JEV_MODEL, state, questions });

  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(JEV_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}` },
      body
    });

    if (response.ok) return (await response.json()) as SystemOneResponse;

    if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
      throw new TypeSafeError(response.status);
    }
    await sleep(backoff(attempt, response.headers.get("retry-after")));
  }
}

/** Honours Retry-After when given; otherwise exponential with jitter so retries do not re-collide. */
export function backoff(attempt: number, retryAfter: string | null): number {
  const told = retryAfter ? Number(retryAfter) * 1000 : Number.NaN;
  if (Number.isFinite(told) && told >= 0) return Math.min(told, BACKOFF_MAX_MS);

  const base = BACKOFF_BASE_MS * 2 ** (attempt - 1);
  return base + Math.random() * base * BACKOFF_JITTER;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
