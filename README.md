# Multi-Agent Orchestration

An orchestrator coordinates three specialist AI agents in sequence: researcher collects findings, writer drafts an article, reviewer approves it. Each agent handoff is a durable checkpoint.

If the writer fails mid-generation -- API timeout, crash, rate limit -- Resonate retries it automatically. The researcher does NOT re-run. The orchestrator resumes exactly at the failed step.

## What This Demonstrates

- **Sequential agent delegation**: orchestrator calls researcher -> writer -> reviewer in order
- **Durable handoffs**: each agent result is cached -- no agent re-runs on partial failure
- **Crash recovery**: writer fails on first attempt in crash mode, retries without re-running researcher
- **Human-in-the-loop hook**: natural extension point for approval before publishing (see workflow.ts)

## Prerequisites

- [Bun](https://bun.sh) v1.0+
- Anthropic API key: `export ANTHROPIC_API_KEY=sk-ant-...`

No external services required. Resonate runs in embedded mode.

## Setup

```bash
git clone https://github.com/resonatehq-examples/example-multi-agent-orchestration-ts
cd example-multi-agent-orchestration-ts
bun install
export ANTHROPIC_API_KEY=sk-ant-...
```

## Run It

**Happy path** -- full pipeline runs to completion:
```bash
bun start
```

```
=== Resonate Multi-Agent Orchestration ===
Mode: HAPPY PATH
Topic: "The future of durable execution in AI applications"

Pipeline: researcher -> writer -> reviewer -> [human approval] -> publish

[researcher]  Researching: "The future of durable execution..."...
[researcher]  Complete (312 chars)
[writer]      Writing article (attempt 1)...
[writer]      Complete (487 chars)
[reviewer]    Reviewing draft...
[reviewer]    APPROVED: The article clearly explains the concept...

=== Pipeline Complete ===
Status: PUBLISHED
...
[orchestrator] Article approved and published.
```

**Crash mode** -- writer fails on first attempt, retries while researcher result is preserved:
```bash
bun start:crash
```

```
=== Resonate Multi-Agent Orchestration ===
Mode: CRASH (writer agent fails on first attempt)

[researcher]  Researching: "The future of durable execution..."...
[researcher]  Complete (312 chars)
[writer]      Writing article (attempt 1)...
Runtime. Function 'writer' failed with 'Error: Writer agent connection reset (simulated)' (retrying in 2 secs)
[writer]      Writing article (attempt 2)...
[writer]      Complete (487 chars)
[reviewer]    Reviewing draft...
[reviewer]    APPROVED: ...

=== Pipeline Complete ===
Status: PUBLISHED
```

**Notice**: researcher runs once. Writer retries once. Reviewer runs once. The retry message comes from Resonate -- you wrote no retry logic.

**Custom topic**:
```bash
bun start --topic="Distributed systems in 2026"
```

## What to Observe

1. **Researcher does not re-run on writer failure**: its result is cached at the `yield*` checkpoint
2. **No retry code in the orchestrator**: `orchestrate` is pure sequential logic
3. **Each yield* is a checkpoint**: add `process.exit(1)` after any agent call and restart -- resumes from there
4. **Human approval hook**: see the comment in `src/workflow.ts` for how to add `ctx.promise()` blocking

## The Code

The entire orchestrator is 15 lines in `src/workflow.ts`:

```typescript
export function* orchestrate(ctx: Context, topic: string, crashOnWriter: boolean) {
  // Each yield* is a durable checkpoint
  // If any agent fails, Resonate retries that step only
  const findings = yield* ctx.run(researcher, topic);
  const draft    = yield* ctx.run(writer, topic, findings, crashOnWriter);
  const review   = yield* ctx.run(reviewer, draft);

  // Human-in-the-loop (production pattern):
  // const approvalPromise = yield* ctx.promise({ id: `approval/${topic}` });
  // const approved = yield* approvalPromise;

  return { status: review.includes('APPROVED') ? 'published' : 'rejected', ... };
}
```

## Extending with Human-in-the-Loop

The orchestrator has a comment showing how to add real human approval. Replace the simulated approval with:

```typescript
// Inside orchestrate():
const approvalPromise = yield* ctx.promise({ id: `approval/${topic}` });
console.log(`Waiting for approval. Resolve at: POST /approve/${approvalPromise.id}`);
const approved = yield* approvalPromise;
```

Then resolve it externally:
```bash
curl -X POST http://localhost:8001/promises/approval/my-topic/resolve \
  -H 'content-type: application/json' \
  -d '{"data": true}'
```

The workflow blocks until the promise is resolved, survives restarts, and works across services.

## File Structure

```
example-multi-agent-orchestration-ts/
|-  src/
|   |-  index.ts      Entry point -- topic selection and pipeline display
|   |-  workflow.ts   orchestrate() -- coordinates the three agents
|   |-  agents.ts     researcher(), writer(), reviewer() -- Claude API calls
|-  package.json
|-  tsconfig.json
```

**Lines of code**: ~150 total. The orchestrator itself is 15 lines.

## Comparison

Trigger.dev's agent patterns require a hosted platform (trigger.dev cloud or self-hosted), event-based function invocations, and explicit retry configuration. Inngest's AgentKit provides similar agent orchestration but is opinionated about the network/routing layer.

| | Resonate | Trigger.dev | Inngest AgentKit |
|---|---|---|---|
| Source files | 3 | 5+ | 5+ |
| Server required | No (embedded) | Yes (hosted/self-hosted) | Yes (hosted/self-hosted) |
| Agent pattern | Generator function calling agents | Steps in a Task | Network of agents |
| Retry model | Automatic on any `ctx.run()` failure | Configured per-task | Configured per-step |
| Human-in-the-loop | `ctx.promise()` built-in | waitForEvent | Custom |
| Multi-LLM fan-out | `ctx.beginRun()` | Parallel steps | Parallel agents |

Where Trigger.dev and Inngest win: cloud hosting, dashboard observability, and managed infrastructure mean zero DevOps burden for teams that don't want to run their own server.

Where Resonate wins: no hosted dependency for development, generator-native sequencing, and `ctx.promise()` for human-in-the-loop without any additional infrastructure.

## Learn More

- [Resonate documentation](https://docs.resonatehq.io)
- [Human-in-the-loop example](https://github.com/resonatehq-examples/example-human-in-the-loop-ts)
- [Deep research agent](https://github.com/resonatehq-examples/example-openai-deep-research-agent-ts) -- recursive fan-out pattern
