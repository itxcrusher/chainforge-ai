import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const wirefluid = {
  id: 92533,
  name: "WireFluid",
  nativeCurrency: { name: "WIRE", symbol: "WIRE", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.WIREFLUID_RPC_URL ?? "https://evm.wirefluid.com"] },
  },
  blockExplorers: {
    default: { name: "WireFluidScan", url: "https://wirefluidscan.com" },
  },
} as const;

export function getPublicClient() {
  return createPublicClient({
    chain: wirefluid,
    transport: http(process.env.WIREFLUID_RPC_URL ?? "https://evm.wirefluid.com"),
  });
}

export function getDeployerWalletClient() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set in environment");
  const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, "")}`);
  return createWalletClient({
    account,
    chain: wirefluid,
    transport: http(process.env.WIREFLUID_RPC_URL ?? "https://evm.wirefluid.com"),
  });
}

export function getRelayerWalletClient() {
  const privateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("RELAYER_PRIVATE_KEY not set in environment");
  const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, "")}`);
  return createWalletClient({
    account,
    chain: wirefluid,
    transport: http(process.env.WIREFLUID_RPC_URL ?? "https://evm.wirefluid.com"),
  });
}
