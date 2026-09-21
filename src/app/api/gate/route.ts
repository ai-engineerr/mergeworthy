import { MAX_REPO_INPUT_CHARS } from "@/constants/gateConstants";
import { TEXT } from "@/constants/text";
import { parseRepo } from "@/helper/repo";
import { GitHubError } from "@/services/github";
import { runGate } from "@/services/gateRun";
import { hasApiKey, TypeSafeError } from "@/services/typesafe";

export async function POST(request: Request): Promise<Response> {
  let payload: { repo?: unknown };

  try {
    payload = await request.json();
  } catch {
    return problem(TEXT.badBody, 400);
  }

  if (typeof payload.repo !== "string") return problem(TEXT.invalidRepo, 400);
  if (payload.repo.length > MAX_REPO_INPUT_CHARS) return problem(TEXT.tooLong, 413);

  const ref = parseRepo(payload.repo);
  if (!ref) return problem(TEXT.invalidRepo, 400);
  if (!hasApiKey()) return problem(TEXT.keyMissing, 503);

  // Newline-delimited JSON: one event per line, flushed as each PR is judged.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: unknown): void => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        for await (const event of runGate(ref)) send(event);
      } catch (error) {
        console.error("gate_failed", { message: error instanceof Error ? error.message : "unknown" });
        send({ type: "failed", error: readerMessage(error) });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no"
    }
  });
}

const readerMessage = (error: unknown): string =>
  error instanceof TypeSafeError || error instanceof GitHubError ? error.forReader : TEXT.requestFailed;

const problem = (error: string, status: number): Response => Response.json({ type: "failed", error }, { status });
