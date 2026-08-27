import * as dotenv from "dotenv";
import OpenAI from "openai";
import { runArchitect } from "../lib/agents/architect";
import { runAuditor } from "../lib/agents/auditor";

dotenv.config({ path: ".env.local" });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const prompts = [
  ["Prediction", "Create a prediction campaign for the demo league Final 2026: Who will win? Options: Northern Falcons, Desert Sultans. Deadline: 10 minutes from now.", "PredictionLogicV2"],
  ["Vote", "Create a fan vote for the demo league Player of the Season. Options: Babar Azam, Shaheen Afridi, Shadab Khan, Mohammad Rizwan.", "VotingLogicV2"],
  ["Survey", "Create a survey asking the demo league fans: What was the best moment of the season? Options: Super over finish, Last-ball six, Hat-trick, Century under pressure.", "SurveyLogic"],
  ["Quiz", "Create a quiz for the demo league fans: Who won the the demo league 2024 final? Options: Northern Falcons, Desert Sultans, Riverside Rangers, Coastal Kings. Deadline: 10 minutes from now.", "QuizLogic"],
  ["Raffle", "Create a raffle for the demo league fans to win a signed team jersey. Fans can enter once. Prize: Signed Northern Falcons jersey. Deadline: 10 minutes from now.", "RaffleLogic"],
  ["Bounty", "Create a bounty challenge for the demo league fans: Submit your best match-day chant idea. The creator will pick the best chant as the winner. Deadline: 30 minutes from now.", "BountyLogic"],
  ["FanPass", "Create a fan pass campaign for the demo league Final Night. Tiers: General Fan Pass with 50 supply, Super Fan Pass with 20 supply, VIP Dugout Pass with 5 supply. Fans can claim one pass per tier.", "FanPassLogic"],
  ["PointsPool", "Create a points pool prediction for the demo league Final MVP. Options: Babar Azam, Shaheen Afridi, Shadab Khan, Mohammad Rizwan. Fans predict with reputation weight. Deadline: 10 minutes from now.", "PointsPoolLogic"],
  ["Tournament", "Create a tournament bracket for the the demo league playoffs. Rounds: Qualifier, Eliminator, Final. Fans predict winners across rounds and earn cumulative scores.", "TournamentLogic"],
  ["Auction", "Create an auction for a the demo league fan privilege: winner gets a virtual meet-and-greet with the player of the match. Fans place pledge bids on-chain. Deadline: 15 minutes from now.", "AuctionLogic"],
] as const;

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");

  let failures = 0;
  for (const [label, prompt, expectedTemplate] of prompts) {
    const architect = await runArchitect(client, prompt);
    const audit = await runAuditor(client, architect);
    const templateOk = architect.templateSelected === expectedTemplate;
    const auditOk = audit.status === "approved";

    console.log(`${templateOk && auditOk ? "OK" : "FAIL"} ${label}`);
    console.log(`  template: ${architect.templateSelected} (expected ${expectedTemplate})`);
    console.log(`  useCase: ${architect.useCase}`);
    console.log(`  options: ${architect.options.join(" | ")}`);
    console.log(`  audit: ${audit.status}`);
    if (!templateOk || !auditOk) {
      failures += 1;
      console.log(`  checks: ${JSON.stringify(audit.checks)}`);
      console.log(`  reason: ${audit.reason ?? ""}`);
    }
  }

  if (failures > 0) {
    throw new Error(`${failures} Phase 1 prompt(s) failed`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
