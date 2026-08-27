/**
 * Network validation script — run this before deploying.
 *
 * Confirms:
 * - WireFluid RPC is reachable
 * - Chain ID is 92533
 * - Deployer wallet is funded (WIRE balance > 0)
 *
 * Usage:
 *   npm run test:rpc
 *   or
 *   npx ts-node scripts/test-rpc.ts
 */

import * as dotenv from "dotenv";
import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

dotenv.config({ path: ".env.local" });

const RPC_URL = process.env.WIREFLUID_RPC_URL || "https://evm.wirefluid.com";
const EXPECTED_CHAIN_ID = 92533;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const wirefluid = {
  id: EXPECTED_CHAIN_ID,
  name: "WireFluid",
  nativeCurrency: { name: "Wire", symbol: "WIRE", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

async function main() {
  console.log("\n=== ChainForge AI — WireFluid RPC Validation ===\n");

  const client = createPublicClient({ chain: wirefluid, transport: http(RPC_URL) });

  // 1. Check connectivity
  console.log(`RPC URL:       ${RPC_URL}`);
  try {
    const block = await client.getBlockNumber();
    console.log(`Block number:  ${block} ✓`);
  } catch (e) {
    console.error(`RPC unreachable: ${e}`);
    process.exit(1);
  }

  // 2. Confirm chain ID
  const chainId = await client.getChainId();
  const chainOk = chainId === EXPECTED_CHAIN_ID;
  console.log(`Chain ID:      ${chainId} ${chainOk ? "✓" : `✗ (expected ${EXPECTED_CHAIN_ID})`}`);
  if (!chainOk) process.exit(1);

  // 3. Check deployer wallet balance
  if (!PRIVATE_KEY) {
    console.warn("\nWARNING: PRIVATE_KEY not set in .env.local — skipping balance check");
  } else {
    const account = privateKeyToAccount(`0x${PRIVATE_KEY}` as `0x${string}`);
    const balance = await client.getBalance({ address: account.address });
    const formatted = formatEther(balance);
    const funded = balance > 0n;
    console.log(`\nDeployer:      ${account.address}`);
    console.log(`Balance:       ${formatted} WIRE ${funded ? "✓" : "✗ — fund via https://faucet.wirefluid.com"}`);
    if (!funded) {
      console.error("\nDeployer wallet is empty. Get WIRE from the faucet before the sprint.");
      process.exit(1);
    }
  }

  console.log("\n✓ WireFluid RPC validation passed. Ready to deploy.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
