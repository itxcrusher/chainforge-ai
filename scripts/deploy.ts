import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from:", deployer.address);
  console.log("Network:", hre.network.name);
  console.log("---");

  // ─── V1 Implementations (already deployed — skip if addresses are in .env) ──
  // These are kept in the script for reference. On a fresh deploy, all 5 are deployed.
  // On an upgrade-only run, comment out V1 sections and only deploy V2+.

  // 1. PredictionLogic (V1)
  const PredictionLogic = await hre.ethers.getContractFactory("PredictionLogic");
  const predictionLogic = await PredictionLogic.deploy();
  await predictionLogic.waitForDeployment();
  const predictionLogicAddress = await predictionLogic.getAddress();
  const predictionImplTx = predictionLogic.deploymentTransaction()!.hash;
  console.log("PredictionLogic (V1) deployed:");
  console.log("  Address:", predictionLogicAddress);
  console.log("  Tx hash:", predictionImplTx);
  console.log("---");

  // 2. VotingLogic (V1)
  const VotingLogic = await hre.ethers.getContractFactory("VotingLogic");
  const votingLogic = await VotingLogic.deploy();
  await votingLogic.waitForDeployment();
  const votingLogicAddress = await votingLogic.getAddress();
  const votingImplTx = votingLogic.deploymentTransaction()!.hash;
  console.log("VotingLogic (V1) deployed:");
  console.log("  Address:", votingLogicAddress);
  console.log("  Tx hash:", votingImplTx);
  console.log("---");

  // 3. PredictionLogicV2
  const PredictionLogicV2 = await hre.ethers.getContractFactory("PredictionLogicV2");
  const predictionLogicV2 = await PredictionLogicV2.deploy();
  await predictionLogicV2.waitForDeployment();
  const predictionLogicV2Address = await predictionLogicV2.getAddress();
  const predictionV2ImplTx = predictionLogicV2.deploymentTransaction()!.hash;
  console.log("PredictionLogicV2 deployed:");
  console.log("  Address:", predictionLogicV2Address);
  console.log("  Tx hash:", predictionV2ImplTx);
  console.log("---");

  // 4. VotingLogicV2
  const VotingLogicV2 = await hre.ethers.getContractFactory("VotingLogicV2");
  const votingLogicV2 = await VotingLogicV2.deploy();
  await votingLogicV2.waitForDeployment();
  const votingLogicV2Address = await votingLogicV2.getAddress();
  const votingV2ImplTx = votingLogicV2.deploymentTransaction()!.hash;
  console.log("VotingLogicV2 deployed:");
  console.log("  Address:", votingLogicV2Address);
  console.log("  Tx hash:", votingV2ImplTx);
  console.log("---");

  // 5. SurveyLogic
  const SurveyLogic = await hre.ethers.getContractFactory("SurveyLogic");
  const surveyLogic = await SurveyLogic.deploy();
  await surveyLogic.waitForDeployment();
  const surveyLogicAddress = await surveyLogic.getAddress();
  const surveyImplTx = surveyLogic.deploymentTransaction()!.hash;
  console.log("SurveyLogic deployed:");
  console.log("  Address:", surveyLogicAddress);
  console.log("  Tx hash:", surveyImplTx);
  console.log("---");

  // 6. CampaignFactory
  const CampaignFactory = await hre.ethers.getContractFactory("CampaignFactory");
  const factory = await CampaignFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  const factoryTx = factory.deploymentTransaction()!.hash;
  console.log("CampaignFactory deployed:");
  console.log("  Address:", factoryAddress);
  console.log("  Tx hash:", factoryTx);
  console.log("---");

  // 7. Register all 5 implementations in factory
  const setPredTx = await factory.setImplementation("PredictionLogic", predictionLogicAddress);
  await setPredTx.wait();
  console.log("setImplementation (PredictionLogic):   ", setPredTx.hash);

  const setVoteTx = await factory.setImplementation("VotingLogic", votingLogicAddress);
  await setVoteTx.wait();
  console.log("setImplementation (VotingLogic):       ", setVoteTx.hash);

  const setPredV2Tx = await factory.setImplementation("PredictionLogicV2", predictionLogicV2Address);
  await setPredV2Tx.wait();
  console.log("setImplementation (PredictionLogicV2):", setPredV2Tx.hash);

  const setVoteV2Tx = await factory.setImplementation("VotingLogicV2", votingLogicV2Address);
  await setVoteV2Tx.wait();
  console.log("setImplementation (VotingLogicV2):    ", setVoteV2Tx.hash);

  const setSurveyTx = await factory.setImplementation("SurveyLogic", surveyLogicAddress);
  await setSurveyTx.wait();
  console.log("setImplementation (SurveyLogic):      ", setSurveyTx.hash);
  console.log("---");

  // 8. Print summary — copy into .env.local and PROOF.md
  console.log("=== DEPLOYMENT SUMMARY ===");
  console.log(`FACTORY_ADDRESS=${factoryAddress}`);
  console.log(`PREDICTION_IMPLEMENTATION_ADDRESS=${predictionLogicAddress}`);
  console.log(`VOTING_IMPLEMENTATION_ADDRESS=${votingLogicAddress}`);
  console.log(`PREDICTION_V2_IMPLEMENTATION_ADDRESS=${predictionLogicV2Address}`);
  console.log(`VOTING_V2_IMPLEMENTATION_ADDRESS=${votingLogicV2Address}`);
  console.log(`SURVEY_IMPLEMENTATION_ADDRESS=${surveyLogicAddress}`);
  console.log("");
  console.log("Tx hashes:");
  console.log("  Factory:              ", factoryTx);
  console.log("  PredictionLogic:      ", predictionImplTx);
  console.log("  VotingLogic:          ", votingImplTx);
  console.log("  PredictionLogicV2:    ", predictionV2ImplTx);
  console.log("  VotingLogicV2:        ", votingV2ImplTx);
  console.log("  SurveyLogic:          ", surveyImplTx);
  console.log("  setImpl (Pred):       ", setPredTx.hash);
  console.log("  setImpl (Vote):       ", setVoteTx.hash);
  console.log("  setImpl (PredV2):     ", setPredV2Tx.hash);
  console.log("  setImpl (VoteV2):     ", setVoteV2Tx.hash);
  console.log("  setImpl (Survey):     ", setSurveyTx.hash);
  console.log("");
  console.log("Explorer links:");
  console.log("  Factory:          https://wirefluidscan.com/address/" + factoryAddress);
  console.log("  PredictionLogic:  https://wirefluidscan.com/address/" + predictionLogicAddress);
  console.log("  VotingLogic:      https://wirefluidscan.com/address/" + votingLogicAddress);
  console.log("  PredictionLogicV2 https://wirefluidscan.com/address/" + predictionLogicV2Address);
  console.log("  VotingLogicV2:    https://wirefluidscan.com/address/" + votingLogicV2Address);
  console.log("  SurveyLogic:      https://wirefluidscan.com/address/" + surveyLogicAddress);
  console.log("==========================");
  console.log("");
  console.log("IMPORTANT: Copy the above addresses to PROOF.md and .env.local immediately.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
