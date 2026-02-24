import { Resonate } from "@resonatehq/sdk";
import { orchestrate } from "./workflow.js";

// ---------------------------------------------------------------------------
// Resonate setup — two lines
// ---------------------------------------------------------------------------

const resonate = new Resonate();
resonate.register(orchestrate);

// ---------------------------------------------------------------------------
// Run the multi-agent orchestration
// ---------------------------------------------------------------------------

const crashMode = process.argv.includes("--crash");
const topic =
  process.argv.find((a) => a.startsWith("--topic="))?.slice(8) ??
  "The future of durable execution in AI applications";

console.log("=== Resonate Multi-Agent Orchestration ===");
console.log(
  `Mode: ${crashMode ? "CRASH (writer agent fails on first attempt)" : "HAPPY PATH"}`,
);
console.log(`Topic: "${topic}"\n`);
console.log("Pipeline: researcher → writer → reviewer → [human approval] → publish\n");

const runId = `orchestration-${Date.now()}`;

const result = await resonate.run(runId, orchestrate, topic, crashMode);

console.log("\n=== Pipeline Complete ===");
console.log(`Status: ${result.status.toUpperCase()}`);
console.log(`\n--- Research Findings ---\n${result.findings}`);
console.log(`\n--- Draft ---\n${result.draft}`);
console.log(`\n--- Review ---\n${result.review}`);

if (result.status === "published") {
  console.log("\n[orchestrator] Article approved and published.");
} else {
  console.log("\n[orchestrator] Article sent back for revision.");
}

resonate.stop();
