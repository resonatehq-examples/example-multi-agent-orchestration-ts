import type { Context } from "@resonatehq/sdk";
import { researcher, writer, reviewer } from "./agents.js";

// ---------------------------------------------------------------------------
// Multi-Agent Orchestration Workflow
// ---------------------------------------------------------------------------
// An orchestrator delegates to three specialist agents in sequence:
//   1. Researcher — gathers findings on the topic
//   2. Writer     — drafts an article from the findings
//   3. Reviewer   — reviews the draft and suggests improvements
//
// Each agent call is a durable checkpoint via ctx.run(). If any agent fails
// (API error, timeout, crash), Resonate retries it automatically. Completed
// agents are NOT re-run — only the failed step retries.
//
// Human-in-the-loop: the orchestrator waits for explicit approval before
// "publishing". In this demo, approval is simulated (see index.ts).
// With the Resonate server, ctx.promise() provides real blocking across
// process restarts — see the human-in-the-loop example.

export interface OrchestrationResult {
  status: "published" | "rejected";
  topic: string;
  findings: string;
  draft: string;
  review: string;
}

export function* orchestrate(
  ctx: Context,
  topic: string,
  crashOnWriter: boolean,
): Generator<any, OrchestrationResult, any> {
  // Step 1: Research — gather findings
  const findings = yield* ctx.run(researcher, topic);

  // Step 2: Write — produce a draft from findings
  // If crashOnWriter=true, the writer fails on first attempt and retries.
  // The researcher does NOT re-run on retry — its result is cached.
  const draft = yield* ctx.run(writer, topic, findings, crashOnWriter);

  // Step 3: Review — check the draft quality
  const review = yield* ctx.run(reviewer, draft);

  // Step 4: Human approval (simulated in demo)
  // In production: yield* ctx.promise({ id: `approval/${topic}` })
  // This blocks until an external system resolves the promise.
  // Example: POST /approve/:promiseId → resonate.promises.resolve(id, true)
  const approved = review.toUpperCase().includes("APPROVED");

  return {
    status: approved ? "published" : "rejected",
    topic,
    findings,
    draft,
    review,
  };
}
