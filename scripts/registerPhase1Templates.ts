/**
 * registerPhase1Templates.ts — register already deployed Phase 1 implementations.
 *
 * Usage:
 *   npx hardhat run scripts/registerPhase1Templates.ts --network wirefluid
 *
 * Requires FACTORY_ADDRESS and all *_IMPLEMENTATION_ADDRESS values in .env.local.
 */

import hre from "hardhat";

const TEMPLATES = [
  { name: "QuizLogic", env: "QUIZ_IMPLEMENTATION_ADDRESS" },
  { name: "RaffleLogic", env: "RAFFLE_IMPLEMENTATION_ADDRESS" },
  { name: "BountyLogic", env: "BOUNTY_IMPLEMENTATION_ADDRESS" },
  { name: "FanPassLogic", env: "FAN_PASS_IMPLEMENTATION_ADDRESS" },
  { name: "PointsPoolLogic", env: "POINTS_POOL_IMPLEMENTATION_ADDRESS" },
  { name: "TournamentLogic", env: "TOURNAMENT_IMPLEMENTATION_ADDRESS" },
  { name: "AuctionLogic", env: "AUCTION_IMPLEMENTATION_ADDRESS" },
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

  for (const template of TEMPLATES) {
    const address = process.env[template.env];
    if (!address) throw new Error(`${template.env} is not set`);

    const tx = await factory.setImplementation(template.name, address);
    await tx.wait();
    console.log(`${template.name} registered: ${address}`);
    console.log(`  tx: ${tx.hash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
