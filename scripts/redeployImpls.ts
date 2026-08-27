/**
 * redeployImpls.ts — redeploy V2 implementations with relay-friendly signatures
 * and re-register them under the same template names in the existing factory.
 *
 * Usage:
 *   npx hardhat run scripts/redeployImpls.ts --network wirefluid
 *
 * After running:
 *   1. Update PREDICTION_V2_IMPLEMENTATION_ADDRESS, VOTING_V2_IMPLEMENTATION_ADDRESS,
 *      SURVEY_IMPLEMENTATION_ADDRESS in .env.local with the new addresses
 *   2. Re-seed campaigns: npx hardhat run scripts/seed.ts --network wirefluid
 */

import hre from "hardhat";

const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;

async function main() {
  if (!FACTORY_ADDRESS) throw new Error("FACTORY_ADDRESS not set in .env.local");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Factory: ", FACTORY_ADDRESS);
  console.log("---");

  // ─── Deploy PredictionLogicV2 (relay-friendly) ───────────────────────────────
  const PredV2 = await hre.ethers.getContractFactory("PredictionLogicV2");
  const predV2 = await PredV2.deploy();
  await predV2.waitForDeployment();
  const predV2Addr = await predV2.getAddress();
  const predV2Tx   = predV2.deploymentTransaction()!.hash;
  console.log("PredictionLogicV2:", predV2Addr, " tx:", predV2Tx);

  // ─── Deploy VotingLogicV2 (relay-friendly) ──────────────────────────────────
  const VoteV2 = await hre.ethers.getContractFactory("VotingLogicV2");
  const voteV2 = await VoteV2.deploy();
  await voteV2.waitForDeployment();
  const voteV2Addr = await voteV2.getAddress();
  const voteV2Tx   = voteV2.deploymentTransaction()!.hash;
  console.log("VotingLogicV2:    ", voteV2Addr, " tx:", voteV2Tx);

  // ─── Deploy SurveyLogic (relay-friendly) ────────────────────────────────────
  const Survey = await hre.ethers.getContractFactory("SurveyLogic");
  const survey = await Survey.deploy();
  await survey.waitForDeployment();
  const surveyAddr = await survey.getAddress();
  const surveyTx   = survey.deploymentTransaction()!.hash;
  console.log("SurveyLogic:      ", surveyAddr, " tx:", surveyTx);

  // ─── Re-register in factory ──────────────────────────────────────────────────
  const factoryAbi = [
    "function setImplementation(string calldata name, address impl) external",
  ];
  const factory = new hre.ethers.Contract(FACTORY_ADDRESS, factoryAbi, deployer);

  await (await factory.setImplementation("PredictionLogicV2", predV2Addr)).wait();
  console.log("Registered PredictionLogicV2");
  await (await factory.setImplementation("VotingLogicV2", voteV2Addr)).wait();
  console.log("Registered VotingLogicV2");
  await (await factory.setImplementation("SurveyLogic", surveyAddr)).wait();
  console.log("Registered SurveyLogic");

  console.log("\n# Paste into .env.local:");
  console.log(`PREDICTION_V2_IMPLEMENTATION_ADDRESS=${predV2Addr}`);
  console.log(`VOTING_V2_IMPLEMENTATION_ADDRESS=${voteV2Addr}`);
  console.log(`SURVEY_IMPLEMENTATION_ADDRESS=${surveyAddr}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
