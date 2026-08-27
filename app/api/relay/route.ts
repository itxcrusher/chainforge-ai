import { NextRequest, NextResponse } from "next/server";
import { encodeFunctionData, recoverMessageAddress } from "viem";
import { getPublicClient, getRelayerWalletClient } from "@/lib/contracts/clients";
import {
  AUCTION_LOGIC_ABI,
  BOUNTY_LOGIC_ABI,
  CAMPAIGN_FACTORY_ABI,
  FAN_PASS_LOGIC_ABI,
  POINTS_POOL_LOGIC_ABI,
  PREDICTION_LOGIC_V2_ABI,
  QUIZ_LOGIC_ABI,
  RAFFLE_LOGIC_ABI,
  SURVEY_LOGIC_ABI,
  TOURNAMENT_LOGIC_ABI,
  VOTING_LOGIC_V2_ABI,
} from "@/lib/contracts/abis";
import { buildParticipationAuthorizationMessage } from "@/lib/contracts/authorizationMessages";
import { getCampaignCompatibility } from "@/lib/contracts/campaignCompatibility";
import { campaignCache } from "@/lib/cache/campaignCache";
import { readCampaignBase } from "@/lib/contracts/campaignReads";
import { invalidateViewCache } from "@/lib/cache/viewCache";
import { clearLeaderboardCache } from "@/lib/reputation/reputation";

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const AUTH_WINDOW_SECONDS = 300;

function checkRateLimit(userAddress: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userAddress);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(userAddress, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) return false;

  entry.count += 1;
  return true;
}

function isValidAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isValidSignature(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value);
}

function isFreshIssuedAt(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - value) <= AUTH_WINDOW_SECONDS;
}

function isValidOptionIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function resolveRelayCalldata(template: string, userAddress: `0x${string}`, optionIndex: number) {
  const option = BigInt(optionIndex);

  if (template === "VotingLogicV2") {
    return encodeFunctionData({ abi: VOTING_LOGIC_V2_ABI, functionName: "castVote", args: [userAddress, option] });
  }
  if (template === "SurveyLogic") {
    return encodeFunctionData({ abi: SURVEY_LOGIC_ABI, functionName: "submitResponse", args: [userAddress, option] });
  }
  if (template === "PredictionLogicV2") {
    return encodeFunctionData({ abi: PREDICTION_LOGIC_V2_ABI, functionName: "submitPrediction", args: [userAddress, option] });
  }
  if (template === "QuizLogic") {
    return encodeFunctionData({ abi: QUIZ_LOGIC_ABI, functionName: "submitAnswer", args: [userAddress, option] });
  }
  if (template === "RaffleLogic") {
    return encodeFunctionData({ abi: RAFFLE_LOGIC_ABI, functionName: "enter", args: [userAddress] });
  }
  if (template === "BountyLogic") {
    return encodeFunctionData({ abi: BOUNTY_LOGIC_ABI, functionName: "register", args: [userAddress] });
  }
  if (template === "FanPassLogic") {
    return encodeFunctionData({ abi: FAN_PASS_LOGIC_ABI, functionName: "claimPass", args: [userAddress, option] });
  }
  if (template === "PointsPoolLogic") {
    return encodeFunctionData({ abi: POINTS_POOL_LOGIC_ABI, functionName: "stakeWeight", args: [userAddress, option, 100n] });
  }
  if (template === "TournamentLogic") {
    return encodeFunctionData({ abi: TOURNAMENT_LOGIC_ABI, functionName: "submitPrediction", args: [userAddress, 0n, option] });
  }
  if (template === "AuctionLogic") {
    const bidLevels = [100n, 250n, 500n, 1000n, 2500n];
    const amount = bidLevels[optionIndex] ?? BigInt((optionIndex + 1) * 100);
    return encodeFunctionData({ abi: AUCTION_LOGIC_ABI, functionName: "placeBid", args: [userAddress, amount] });
  }

  return null;
}

function templateHasDeadline(template: string) {
  return !["SurveyLogic", "FanPassLogic", "TournamentLogic"].includes(template);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { contractAddress, optionIndex, userAddress, signature, issuedAt } = body as {
    contractAddress?: unknown;
    optionIndex?: unknown;
    userAddress?: unknown;
    signature?: unknown;
    issuedAt?: unknown;
  };

  if (!isValidAddress(contractAddress) || !isValidOptionIndex(optionIndex) || !isValidAddress(userAddress)) {
    return NextResponse.json(
      { error: "contractAddress, optionIndex, and userAddress are required" },
      { status: 400 }
    );
  }

  if (!isValidSignature(signature)) {
    return NextResponse.json({ error: "signature is required" }, { status: 400 });
  }

  if (!isFreshIssuedAt(issuedAt)) {
    return NextResponse.json({ error: "authorization expired, sign again" }, { status: 400 });
  }

  if (!checkRateLimit(userAddress)) {
    return NextResponse.json(
      { error: "Rate limit exceeded, max 10 sponsored interactions per minute" },
      { status: 429 }
    );
  }

  const factoryAddress = process.env.FACTORY_ADDRESS as `0x${string}` | undefined;
  if (!factoryAddress) {
    return NextResponse.json({ error: "FACTORY_ADDRESS not configured" }, { status: 500 });
  }

  try {
    const relayerClient = getRelayerWalletClient();
    const publicClient = getPublicClient();
    const template = (await publicClient.readContract({
      address: factoryAddress,
      abi: CAMPAIGN_FACTORY_ABI,
      functionName: "campaignTemplate",
      args: [contractAddress],
    })) as string;

    const compatibility = await getCampaignCompatibility(contractAddress, template);
    if (!compatibility.relayCompatible) {
      return NextResponse.json({ error: compatibility.compatibilityNote ?? "Campaign is not relay-compatible" }, { status: 400 });
    }

    const campaignData = await readCampaignBase(publicClient, factoryAddress, contractAddress);
    if (campaignData.state !== "OPEN") {
      return NextResponse.json({ error: "Campaign is closed for participation" }, { status: 400 });
    }

    const deadline = BigInt(campaignData.deadline);
    if (templateHasDeadline(template) && deadline > 0n && BigInt(Math.floor(Date.now() / 1000)) >= deadline) {
      return NextResponse.json({ error: "Deadline passed, waiting for creator to close this campaign" }, { status: 400 });
    }

    if (optionIndex >= campaignData.options.length && !["RaffleLogic", "BountyLogic"].includes(template)) {
      return NextResponse.json({ error: "Invalid option for this campaign" }, { status: 400 });
    }

    const message = buildParticipationAuthorizationMessage({
      contractAddress,
      userAddress,
      optionIndex,
      issuedAt,
    });
    const recovered = await recoverMessageAddress({ message, signature });
    if (recovered.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
    }

    const calldata = resolveRelayCalldata(template, userAddress, optionIndex);
    if (!calldata) {
      return NextResponse.json({ error: "Unsupported template for sponsored participation" }, { status: 400 });
    }

    const txHash = await relayerClient.sendTransaction({
      to: contractAddress,
      data: calldata,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    await campaignCache.invalidate(contractAddress);
    await invalidateViewCache("explore:campaigns", "leaderboard", `profile:${userAddress.toLowerCase()}`);
    clearLeaderboardCache();

    return NextResponse.json({
      txHash,
      template,
      explorerUrl: `https://wirefluidscan.com/tx/${txHash}`,
      relayerAddress: relayerClient.account.address,
      message: "gas-sponsored interaction, user paid zero gas",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Relay failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
