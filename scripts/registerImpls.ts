/**
 * registerImpls.ts — re-register new V2 implementations in the existing factory.
 * Run after redeployImpls.ts has already deployed the new contracts.
 */
import hre from "hardhat";

const FACTORY  = "0x596FDe32DDde7e6e471adD72161F455429753c73";
const PRED_V2  = "0x16FCFEf59360f1e7d8C615014328bD8419a9Be59";
const VOTE_V2  = "0x0225592B56BA91f153AE461C829b6fcC7B575B0e";
const SURVEY   = "0x582fE72d288aF5621D1B4052D1164403825f7500";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const factory = new hre.ethers.Contract(
    FACTORY,
    ["function setImplementation(string calldata name, address impl) external"],
    deployer
  );

  let tx = await factory.setImplementation("PredictionLogicV2", PRED_V2);
  await tx.wait();
  console.log("PredictionLogicV2 registered:", tx.hash);

  tx = await factory.setImplementation("VotingLogicV2", VOTE_V2);
  await tx.wait();
  console.log("VotingLogicV2 registered:", tx.hash);

  tx = await factory.setImplementation("SurveyLogic", SURVEY);
  await tx.wait();
  console.log("SurveyLogic registered:", tx.hash);

  console.log("\nDone. New campaigns using these templates will be relay-friendly.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
