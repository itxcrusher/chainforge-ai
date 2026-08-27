/**
 * deployPhase1Templates.ts — deploy and register Phase 1 template implementations.
 *
 * Usage:
 *   npx hardhat run scripts/deployPhase1Templates.ts --network wirefluid
 *
 * Requires FACTORY_ADDRESS in .env.local.
 */

import hre from "hardhat";

const TEMPLATES = [
  { name: "QuizLogic", contract: "QuizLogic", env: "QUIZ_IMPLEMENTATION_ADDRESS" },
  { name: "RaffleLogic", contract: "RaffleLogic", env: "RAFFLE_IMPLEMENTATION_ADDRESS" },
  { name: "BountyLogic", contract: "BountyLogic", env: "BOUNTY_IMPLEMENTATION_ADDRESS" },
  { name: "FanPassLogic", contract: "FanPassLogic", env: "FAN_PASS_IMPLEMENTATION_ADDRESS" },
  { name: "PointsPoolLogic", contract: "PointsPoolLogic", env: "POINTS_POOL_IMPLEMENTATION_ADDRESS" },
  { name: "TournamentLogic", contract: "TournamentLogic", env: "TOURNAMENT_IMPLEMENTATION_ADDRESS" },
  { name: "AuctionLogic", contract: "AuctionLogic", env: "AUCTION_IMPLEMENTATION_ADDRESS" },
] as const;

async function main() {
  const factoryAddress = process.env.FACTORY_ADDRESS;
  if (!factoryAddress) throw new Error("FACTORY_ADDRESS is not set");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Factory: ", factoryAddress);
  console.log("Network: ", hre.network.name);
  console.log("---");

  const factory = await hre.ethers.getContractAt("CampaignFactory", factoryAddress);
  const deployed: Array<{ name: string; env: string; address: string; deployTx: string; registerTx: string }> = [];

  for (const template of TEMPLATES) {
    console.log(`Deploying ${template.contract}...`);
    const Contract = await hre.ethers.getContractFactory(template.contract);
    const implementation = await Contract.deploy();
    await implementation.waitForDeployment();

    const address = await implementation.getAddress();
    const deployTx = implementation.deploymentTransaction()?.hash ?? "";
    console.log(`  Address: ${address}`);
    console.log(`  Deploy tx: ${deployTx}`);

    const register = await factory.setImplementation(template.name, address);
    await register.wait();
    console.log(`  Register tx: ${register.hash}`);
    console.log("---");

    deployed.push({ name: template.name, env: template.env, address, deployTx, registerTx: register.hash });
  }

  console.log("=== PHASE 1 TEMPLATE SUMMARY ===");
  for (const item of deployed) {
    console.log(`${item.name}: ${item.address}`);
    console.log(`  deploy:   ${item.deployTx}`);
    console.log(`  register: ${item.registerTx}`);
  }

  console.log("\n=== .env.local additions ===");
  for (const item of deployed) {
    console.log(`${item.env}=${item.address}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
