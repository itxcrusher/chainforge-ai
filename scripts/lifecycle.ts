/**
 * lifecycle.ts — close and reveal the first PredictionLogicV2 campaign.
 *
 * Usage (after the 15-minute deadline has passed):
 *   npx hardhat run scripts/lifecycle.ts --network wirefluid
 *
 * The PredictionLogicV2 campaign seeded by seed.ts has a 15-min deadline.
 * Run this script at least 15 minutes after seeding to complete the first
 * full on-chain lifecycle: OPEN → CLOSED → REVEALED.
 *
 * Set CAMPAIGN_ADDRESS below (from seed.ts output) before running.
 */

import hre from "hardhat";

// ─── Set this to the PredictionLogicV2 clone address from seed output ─────────
const CAMPAIGN_ADDRESS = "0x30569C7487bE75b82F2De64A8d6D145f7Fd496e2";
// Reveal Northern Falcons (index 0). Change if Desert Sultans won.
const WINNING_OPTION_INDEX = 0;

const PRED_V2_ABI = [
  "function state() external view returns (uint8)",
  "function deadline() external view returns (uint256)",
  "function closeCampaign() external",
  "function revealResult(uint256 optionIndex) external",
  "function getResults() external view returns (string[], uint256[])",
  "function getWinner() external view returns (string)",
  "function options(uint256) external view returns (string)",
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const campaign    = await hre.ethers.getContractAt(PRED_V2_ABI, CAMPAIGN_ADDRESS);
  const explorer    = "https://wirefluidscan.com";

  console.log("Lifecycle smoke test");
  console.log("Deployer:", deployer.address);
  console.log("Campaign:", CAMPAIGN_ADDRESS);
  console.log("---");

  // Check current state
  const state = await campaign.state() as bigint;
  const deadline = await campaign.deadline() as bigint;
  const now = BigInt(Math.floor(Date.now() / 1000));

  const STATE_LABELS = ["OPEN", "CLOSED", "REVEALED"];
  console.log("Current state:   ", STATE_LABELS[Number(state)] ?? state);
  console.log("Deadline:        ", new Date(Number(deadline) * 1000).toISOString());
  console.log("Block timestamp: ~", new Date(Number(now) * 1000).toISOString());

  if (now < deadline) {
    const remaining = Number(deadline - now);
    console.log(`\nDeadline not yet passed. Wait ${remaining}s (${Math.ceil(remaining / 60)} min) then re-run.`);
    return;
  }

  // ─── CLOSE ─────────────────────────────────────────────────────────────────
  if (Number(state) === 0) { // OPEN
    console.log("\nClosing campaign…");
    const closeTx = await (campaign as typeof campaign & {
      closeCampaign(): Promise<{ hash: string; wait(): Promise<unknown> }>;
    }).closeCampaign();
    await closeTx.wait();
    console.log("  CampaignClosed tx:", closeTx.hash);
    console.log("  Explorer:         ", `${explorer}/tx/${closeTx.hash}`);
  } else {
    console.log("\nAlready closed — skipping closeCampaign.");
  }

  // ─── REVEAL ────────────────────────────────────────────────────────────────
  const stateAfterClose = await campaign.state() as bigint;
  if (Number(stateAfterClose) === 1) { // CLOSED
    console.log(`\nRevealing winner (option ${WINNING_OPTION_INDEX})…`);
    const revealTx = await (campaign as typeof campaign & {
      revealResult(idx: number): Promise<{ hash: string; wait(): Promise<unknown> }>;
    }).revealResult(WINNING_OPTION_INDEX);
    await revealTx.wait();
    console.log("  ResultRevealed tx:", revealTx.hash);
    console.log("  Explorer:         ", `${explorer}/tx/${revealTx.hash}`);

    // Print final state
    const winner = await (campaign as typeof campaign & {
      getWinner(): Promise<string>;
    }).getWinner();
    const [opts, counts] = await (campaign as typeof campaign & {
      getResults(): Promise<[string[], bigint[]]>;
    }).getResults();
    console.log("\n=== RESULT ===");
    console.log("Winner:", winner);
    for (let i = 0; i < opts.length; i++) {
      console.log(`  [${i}] ${opts[i]}: ${counts[i].toString()} votes`);
    }
    console.log("==============");
    console.log("\nLifecycle complete: OPEN → CLOSED → REVEALED");
    console.log("Copy the two tx hashes above into PROOF.md.");
  } else {
    const finalLabel = STATE_LABELS[Number(stateAfterClose)] ?? stateAfterClose;
    console.log(`\nState is ${finalLabel} — nothing to reveal.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
