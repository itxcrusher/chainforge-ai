/**
 * seed.ts — seeds current V2 demo campaigns into the deployed CampaignFactory.
 *
 * Usage:
 *   npx hardhat run scripts/seed.ts --network wirefluid
 *
 * Requires FACTORY_ADDRESS to be set in .env.local.
 *
 * Campaigns seeded:
 *   1. PredictionLogicV2 — short deadline (15 min) → ready to close/reveal quickly
 *   2. VotingLogicV2     — open vote, no hard deadline
 *   3. SurveyLogic       — open survey, no deadline
 */

import hre from "hardhat";

const V2_PRED_IFACE = new hre.ethers.Interface([
  "function initialize(address,string,string[],uint256)",
]);
const V2_VOTE_IFACE = new hre.ethers.Interface([
  "function initialize(address,string,string[],uint256)",
]);
const SURVEY_IFACE = new hre.ethers.Interface([
  "function initialize(address,string,string[])",
]);

async function main() {
  const factoryAddress = process.env.FACTORY_ADDRESS;
  if (!factoryAddress) {
    throw new Error("FACTORY_ADDRESS is not set in .env.local");
  }

  const [deployer] = await hre.ethers.getSigners();
  const nowSeconds = Math.floor(Date.now() / 1000);

  console.log("Seeding from:", deployer.address);
  console.log("Factory:     ", factoryAddress);
  console.log("Network:     ", hre.network.name);
  console.log("---");

  const factory = await hre.ethers.getContractAt("CampaignFactory", factoryAddress);

  type CampaignEntry = {
    label: string;
    template: string;
    initData: string;
  };

  const shortDeadline = BigInt(nowSeconds + 15 * 60);
  const longDeadline = BigInt(nowSeconds + 48 * 60 * 60);

  const campaigns: CampaignEntry[] = [
    {
      label: "PredictionLogicV2 — the demo league Final 2026",
      template: "PredictionLogicV2",
      initData: V2_PRED_IFACE.encodeFunctionData("initialize", [
        deployer.address,
        "the demo league Final 2026: Who will win?",
        ["Northern Falcons", "Desert Sultans"],
        shortDeadline,
      ]),
    },
    {
      label: "VotingLogicV2 — the demo league Player of the Season",
      template: "VotingLogicV2",
      initData: V2_VOTE_IFACE.encodeFunctionData("initialize", [
        deployer.address,
        "the demo league Player of the Season 2026",
        ["Babar Azam", "Shaheen Afridi", "Mohammad Rizwan", "Fakhar Zaman"],
        longDeadline,
      ]),
    },
    {
      label: "SurveyLogic — the demo league Best Moment",
      template: "SurveyLogic",
      initData: SURVEY_IFACE.encodeFunctionData("initialize", [
        deployer.address,
        "What was the best moment of the demo league 2026?",
        ["Century in Final", "Hat-trick by Shaheen", "Chase in Qualifier", "Opening Partnership Record"],
      ]),
    },
  ];

  const results: { label: string; template: string; clone: string; txHash: string }[] = [];

  for (const c of campaigns) {
    console.log(`Deploying: ${c.label}…`);
    const tx = await factory.cloneCampaign(c.template, c.initData, deployer.address);
    const receipt = await tx.wait();

    const parsed = receipt?.logs
      .map((log: { topics: readonly string[]; data: string }) => {
        try {
          return factory.interface.parseLog(
            log as Parameters<typeof factory.interface.parseLog>[0]
          );
        } catch {
          return null;
        }
      })
      .find((e: { name: string } | null) => e?.name === "CampaignCreated");

    const cloneAddress = parsed?.args.clone as string;
    console.log("  Clone:", cloneAddress);
    console.log("  Tx:   ", tx.hash);
    console.log("---");

    results.push({ label: c.label, template: c.template, clone: cloneAddress, txHash: tx.hash });
  }

  const explorer = "https://wirefluidscan.com";

  console.log("=== SEED SUMMARY ===");
  for (const r of results) {
    console.log(`[${r.template}] ${r.label}`);
    console.log(`  Clone:    ${r.clone}`);
    console.log(`  Tx:       ${r.txHash}`);
    console.log(`  Explorer: ${explorer}/address/${r.clone}`);
  }
  console.log("====================");
  console.log("");
  console.log("NOTE: Campaign #1 (PredictionLogicV2) has a 15-minute deadline.");
  console.log("After 15 minutes you can call /api/close then /api/reveal to demonstrate");
  console.log("the full lifecycle: OPEN → CLOSED → REVEALED.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
