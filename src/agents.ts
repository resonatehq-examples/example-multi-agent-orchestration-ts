import Anthropic from "@anthropic-ai/sdk";
import type { Context } from "@resonatehq/sdk";

const client = new Anthropic();

// Track agent call attempts for crash demo (same pattern as food-delivery)
const agentAttempts: Record<string, number> = {};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Researcher Agent
// ---------------------------------------------------------------------------
// Researches a topic and returns a structured set of findings.
// In a production system, this would call search APIs, RAG databases, etc.

export async function researcher(_ctx: Context, topic: string): Promise<string> {
  console.log(`[researcher]  Researching: "${topic}"...`);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system:
      "You are a research specialist. Given a topic, provide 3-5 concise key findings that would be useful for writing an article. Format as a numbered list. Be factual and concise.",
    messages: [{ role: "user", content: `Research this topic: ${topic}` }],
  });

  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response");

  const findings = content.text;
  console.log(`[researcher]  Complete (${findings.length} chars)`);
  return findings;
}

// ---------------------------------------------------------------------------
// Writer Agent
// ---------------------------------------------------------------------------
// Takes research findings and writes a short article draft.
// Simulates a failure on first attempt in crash demo mode.

export async function writer(
  _ctx: Context,
  topic: string,
  research: string,
  crashOnFirst: boolean,
): Promise<string> {
  const key = `writer:${topic}`;
  agentAttempts[key] = (agentAttempts[key] ?? 0) + 1;
  const attempt = agentAttempts[key]!;

  console.log(`[writer]      Writing article (attempt ${attempt})...`);

  if (crashOnFirst && attempt === 1) {
    await sleep(200);
    throw new Error("Writer agent connection reset (simulated)");
  }

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system:
      "You are a professional writer. Write a concise 2-paragraph article based on the provided research. Use clear, engaging language. Include a title.",
    messages: [
      {
        role: "user",
        content: `Topic: ${topic}\n\nResearch findings:\n${research}\n\nWrite a short article.`,
      },
    ],
  });

  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response");

  const draft = content.text;
  console.log(`[writer]      Complete (${draft.length} chars)`);
  return draft;
}

// ---------------------------------------------------------------------------
// Reviewer Agent
// ---------------------------------------------------------------------------
// Reviews the draft and provides structured feedback.

export async function reviewer(_ctx: Context, draft: string): Promise<string> {
  console.log(`[reviewer]    Reviewing draft...`);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system:
      "You are an editorial reviewer. Review the provided article draft. Give a brief approval decision (APPROVED or NEEDS_REVISION) with 1-2 sentences of reasoning.",
    messages: [{ role: "user", content: `Review this article:\n\n${draft}` }],
  });

  const content = response.content[0];
  if (!content || content.type !== "text") throw new Error("Unexpected response");

  const review = content.text;
  console.log(`[reviewer]    ${review.slice(0, 60)}...`);
  return review;
}
