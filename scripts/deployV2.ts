/**
 * deployV2.ts — deploys V2 implementations + new CampaignFactory.
 *
 * V1 contracts (PredictionLogic, VotingLogic) are already live on WireFluid.
 * Their addresses are read from .env.local so they can be registered in the
 * new factory without re-deploying.
 *
 * Usage:
 *   npx hardhat run scripts/deployV2.ts --network wirefluid
 *
 * After running:
 *   1. Copy the printed env block into .env.local
 *   2. Update PROOF.md with the new addresses and tx hashes
 *   3. Run scripts/seed.ts to seed demo campaigns in the new factory
 */

import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from:", deployer.address);
  console.log("Network:       ", hre.network.name);
  console.log("---");

  // ─── Read existing V1 addresses from env ────────────────────────────────────
  const v1PredictionAddress = process.env.PREDICTION_IMPLEMENTATION_ADDRESS;
  const v1VotingAddress     = process.env.VOTING_IMPLEMENTATION_ADDRESS;

  if (!v1PredictionAddress || !v1VotingAddress) {
    throw new Error(
      "PREDICTION_IMPLEMENTATION_ADDRESS and VOTING_IMPLEMENTATION_ADDRESS must be set in .env.local\n" +
      "These are the live V1 implementation addresses already deployed on WireFluid."
    );
  }

  console.log("V1 PredictionLogic (existing):", v1PredictionAddress);
  console.log("V1 VotingLogic     (existing):", v1VotingAddress);
  console.log("---");

  // ─── Deploy PredictionLogicV2 ────────────────────────────────────────────────
  const PredictionLogicV2 = await hre.ethers.getContractFactory("PredictionLogicV2");
  const predictionLogicV2 = await PredictionLogicV2.deploy();
  await predictionLogicV2.waitForDeployment();
  const predV2Address = await predictionLogicV2.getAddress();
  const predV2Tx      = predictionLogicV2.deploymentTransaction()!.hash;
  console.log("PredictionLogicV2 deployed:");
  console.log("  Address:", predV2Address);
  console.log("  Tx:     ", predV2Tx);
  console.log("---");

  // ─── Deploy VotingLogicV2 ────────────────────────────────────────────────────
  const VotingLogicV2 = await hre.ethers.getContractFactory("VotingLogicV2");
  const votingLogicV2 = await VotingLogicV2.deploy();
  await votingLogicV2.waitForDeployment();
  const voteV2Address = await votingLogicV2.getAddress();
  const voteV2Tx      = votingLogicV2.deploymentTransaction()!.hash;
  console.log("VotingLogicV2 deployed:");
  console.log("  Address:", voteV2Address);
  console.log("  Tx:     ", voteV2Tx);
  console.log("---");

  // ─── Deploy SurveyLogic ──────────────────────────────────────────────────────
  const SurveyLogic = await hre.ethers.getContractFactory("SurveyLogic");
  const surveyLogic = await SurveyLogic.deploy();
  await surveyLogic.waitForDeployment();
  const surveyAddress = await surveyLogic.getAddress();
  const surveyTx      = surveyLogic.deploymentTransaction()!.hash;
  console.log("SurveyLogic deployed:");
  console.log("  Address:", surveyAddress);
  console.log("  Tx:     ", surveyTx);
  console.log("---");

  // ─── Deploy new CampaignFactory ──────────────────────────────────────────────
  const CampaignFactory = await hre.ethers.getContractFactory("CampaignFactory");
  const factory         = await CampaignFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  const factoryTx      = factory.deploymentTransaction()!.hash;
  console.log("CampaignFactory deployed:");
  console.log("  Address:", factoryAddress);
  console.log("  Tx:     ", factoryTx);
  console.log("---");

  // ─── Register all 5 templates ────────────────────────────────────────────────
  console.log("Registering implementations in factory…");

  const tx1 = await factory.setImplementation("PredictionLogic", v1PredictionAddress);
  await tx1.wait();
  console.log("  setImplementation(PredictionLogic):  ", tx1.hash);

  const tx2 = await factory.setImplementation("VotingLogic", v1VotingAddress);
  await tx2.wait();
  console.log("  setImplementation(VotingLogic):      ", tx2.hash);

  const tx3 = await factory.setImplementation("PredictionLogicV2", predV2Address);
  await tx3.wait();
  console.log("  setImplementation(PredictionLogicV2):", tx3.hash);

  const tx4 = await factory.setImplementation("VotingLogicV2", voteV2Address);
  await tx4.wait();
  console.log("  setImplementation(VotingLogicV2):    ", tx4.hash);

  const tx5 = await factory.setImplementation("SurveyLogic", surveyAddress);
  await tx5.wait();
  console.log("  setImplementation(SurveyLogic):      ", tx5.hash);
  console.log("---");

  // ─── Summary ─────────────────────────────────────────────────────────────────
  const explorer = "https://wirefluidscan.com";

  console.log("");
  console.log("=== COPY TO .env.local ===");
  console.log(`FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`PREDICTION_V2_IMPLEMENTATION_ADDRESS=${predV2Address}`);
  console.log(`VOTING_V2_IMPLEMENTATION_ADDRESS=${voteV2Address}`);
  console.log(`SURVEY_IMPLEMENTATION_ADDRESS=${surveyAddress}`);
  console.log("# V1 (unchanged — do not remove)");
  console.log(`# PREDICTION_IMPLEMENTATION_ADDRESS=${v1PredictionAddress}`);
  console.log(`# VOTING_IMPLEMENTATION_ADDRESS=${v1VotingAddress}`);
  console.log("==========================");
  console.log("");
  console.log("=== TX HASHES FOR PROOF.md ===");
  console.log("Factory deploy:          ", factoryTx);
  console.log("PredictionLogicV2 deploy:", predV2Tx);
  console.log("VotingLogicV2 deploy:    ", voteV2Tx);
  console.log("SurveyLogic deploy:      ", surveyTx);
  console.log("setImpl (PredV2):        ", tx3.hash);
  console.log("setImpl (VoteV2):        ", tx4.hash);
  console.log("setImpl (Survey):        ", tx5.hash);
  console.log("==============================");
  console.log("");
  console.log("=== EXPLORER LINKS ===");
  console.log("Factory:          ", `${explorer}/address/${factoryAddress}`);
  console.log("PredictionLogicV2:", `${explorer}/address/${predV2Address}`);
  console.log("VotingLogicV2:    ", `${explorer}/address/${voteV2Address}`);
  console.log("SurveyLogic:      ", `${explorer}/address/${surveyAddress}`);
  console.log("======================");
  console.log("");
  console.log("Next: run  npx hardhat run scripts/seed.ts --network wirefluid");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
