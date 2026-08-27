/**
 * AI agent dry-run script — validates the real Architect/Auditor code paths.
 */

import * as dotenv from "dotenv";
import OpenAI from "openai";
import { runArchitect } from "../lib/agents/architect";
import { runAuditor } from "../lib/agents/auditor";

dotenv.config({ path: ".env.local" });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function pass(label: string) {
  console.log(`  ✓ ${label}`);
}

function fail(label: string, detail?: unknown) {
  console.error(`  ✗ ${label}`);
  if (detail) console.error("   ", JSON.stringify(detail, null, 2));
}

async function testArchitectValid() {
  console.log("\n[1] Architect — valid flagship prompt");
  const result = await runArchitect(
    client,
    "Create a gas-sponsored the demo league match winner prediction campaign for Northern Falcons vs Desert Sultans on WireFluid."
  );

  const checks = {
    hasUseCase: typeof result.useCase === "string",
    hasTemplate: typeof result.templateSelected === "string",
    hasTitle: typeof result.campaignTitle === "string",
    hasOptions: Array.isArray(result.options) && result.options.length >= 2,
    hasDeadline: typeof result.deadlineStrategy === "string",
    hasNotes: Array.isArray(result.deploymentNotes),
    hasTheme: typeof result.theme === "object",
  };

  let allPassed = true;
  for (const [key, ok] of Object.entries(checks)) {
    if (ok) pass(key); else { fail(key, result); allPassed = false; }
  }
  if (allPassed) console.log("  → Full output:", JSON.stringify(result, null, 2));
  return allPassed;
}

async function testArchitectSurvey() {
  console.log("\n[2] Architect — survey prompt should normalize to supported config");
  const result = await runArchitect(
    client,
    "Create a launch-day fan sentiment survey with three options"
  );

  const ok =
    result.templateSelected === "SurveyLogic" &&
    result.useCase === "event_engagement" &&
    typeof result.deadlineStrategy === "string" &&
    result.options.length >= 2;

  if (ok) pass("survey prompt normalized correctly");
  else fail("survey prompt normalization failed", result);
  return ok;
}

async function testArchitectInvalid() {
  console.log("\n[3] Architect — unsupported use case (NFT marketplace)");
  const result = await runArchitect(client, "Create an NFT marketplace for digital collectibles.");
  const rejected = String(result.useCase).toLowerCase().includes("unsupported");

  if (rejected) pass("correctly marked unsupported use case");
  else fail("did not reject unsupported use case", result);
  return rejected;
}

async function testAuditorApprove() {
  console.log("\n[4] Auditor — valid config (should approve)");
  const architectResult = await runArchitect(
    client,
    "Create a gas-sponsored the demo league match winner prediction campaign for Northern Falcons vs Desert Sultans on WireFluid."
  );
  const result = await runAuditor(client, architectResult);

  const approved = result.status === "approved";
  if (approved) pass("status is approved");
  else fail("expected approved", result);
  return approved;
}

async function testAuditorReject() {
  console.log("\n[5] Auditor — unsupported config (should reject)");
  const result = await runAuditor(client, {
    useCase: "unsupported",
    templateSelected: "PredictionLogicV2",
    campaignTitle: "Unsupported",
    description: "Unsupported",
    options: ["A", "B"],
    deadlineStrategy: "48h",
    reasoning: "Test fixture",
    confidenceScore: 0,
    audienceFit: "Not applicable",
    lifecycleStrategy: "Not applicable",
    riskNotes: [],
    suggestions: [],
    theme: {
      primaryColor: "#000000",
      secondaryColor: "#111111",
      accentColor: "#222222",
      logoTags: [],
    },
    deploymentNotes: ["noop"],
  });

  const rejected = result.status === "rejected";
  if (rejected) pass("status is rejected as expected");
  else fail("expected rejected", result);
  return rejected;
}

async function main() {
  console.log("\n=== ChainForge AI — Agent Prompt Dry Run ===");

  if (!process.env.OPENAI_API_KEY) {
    console.error("\nERROR: OPENAI_API_KEY not set in .env.local");
    process.exit(1);
  }

  const results = await Promise.all([
    testArchitectValid(),
    testArchitectSurvey(),
    testArchitectInvalid(),
    testAuditorApprove(),
    testAuditorReject(),
  ]);

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Agent prompt tests: ${passed}/${total} passed`);

  if (passed === total) {
    console.log("✓ All agent prompts validated. Prompts are ready for build day.\n");
  } else {
    console.error("✗ Some prompts need refinement.\n");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
