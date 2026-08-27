import { NextRequest, NextResponse } from "next/server";
import { encodeFunctionData, parseEventLogs, recoverMessageAddress } from "viem";
import { getPublicClient, getDeployerWalletClient } from "@/lib/contracts/clients";
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
import { parseDeadlineStrategy } from "@/lib/agents/deadlineParser";
import type { ArchitectOutput } from "@/lib/agents/architect";
import { buildDeployAuthorizationMessage } from "@/lib/contracts/authorizationMessages";
import { isPresentationReadyCampaign } from "@/lib/campaigns/presentationReady";

const SUPPORTED_TEMPLATES = [
  "PredictionLogicV2",
  "VotingLogicV2",
  "SurveyLogic",
  "QuizLogic",
  "RaffleLogic",
  "BountyLogic",
  "FanPassLogic",
  "PointsPoolLogic",
  "TournamentLogic",
  "AuctionLogic",
] as const;
type TemplateName = (typeof SUPPORTED_TEMPLATES)[number];

const AUTH_WINDOW_SECONDS = 300;
const deployRateLimitMap = new Map<string, { count: number; windowStart: number }>();
const DEPLOY_WINDOW_MS = 60_000;
const DEPLOY_MAX = 3;

function resolveTemplate(templateSelected: string): TemplateName {
  if (SUPPORTED_TEMPLATES.includes(templateSelected as TemplateName)) {
    return templateSelected as TemplateName;
  }
  return "PredictionLogicV2";
}

function resolveDeadline(config: ArchitectOutput, fallbackSeconds = 172800) {
  const deadlineSeconds = parseDeadlineStrategy(config.deadlineStrategy ?? "48h");
  if (deadlineSeconds > 0) return BigInt(deadlineSeconds);
  return BigInt(Math.floor(Date.now() / 1000) + fallbackSeconds);
}

function resolveDescription(config: ArchitectOutput, fallback: string) {
  const description = typeof config.description === "string" ? config.description.trim() : "";
  return description.length > 0 ? description : fallback;
}

function resolveFanPassTiers(options: string[]) {
  const tierNames = options.length > 0 ? options.slice(0, 5) : ["General"];
  const tierMaxSupplies = tierNames.map((_, index) => BigInt(index === 0 ? 250 : 100));
  return { tierNames, tierMaxSupplies };
}

function encodeInitData(
  templateName: TemplateName,
  config: ArchitectOutput,
  ownerAddress: `0x${string}`
) {
  if (templateName === "SurveyLogic") {
    return encodeFunctionData({
      abi: SURVEY_LOGIC_ABI,
      functionName: "initialize",
      args: [ownerAddress, config.campaignTitle, config.options],
    });
  }

  if (templateName === "VotingLogicV2") {
    const deadlineSeconds = parseDeadlineStrategy(config.deadlineStrategy ?? "creator_controlled_close");
    return encodeFunctionData({
      abi: VOTING_LOGIC_V2_ABI,
      functionName: "initialize",
      args: [ownerAddress, config.campaignTitle, config.options, BigInt(deadlineSeconds)],
    });
  }

  if (templateName === "PredictionLogicV2") {
    return encodeFunctionData({
      abi: PREDICTION_LOGIC_V2_ABI,
      functionName: "initialize",
      args: [ownerAddress, config.campaignTitle, config.options, resolveDeadline(config)],
    });
  }

  if (templateName === "QuizLogic") {
    return encodeFunctionData({
      abi: QUIZ_LOGIC_ABI,
      functionName: "initialize",
      args: [ownerAddress, config.campaignTitle, config.options, resolveDeadline(config)],
    });
  }

  if (templateName === "RaffleLogic") {
    return encodeFunctionData({
      abi: RAFFLE_LOGIC_ABI,
      functionName: "initialize",
      args: [ownerAddress, config.campaignTitle, resolveDescription(config, "Fan prize raffle"), resolveDeadline(config)],
    });
  }

  if (templateName === "BountyLogic") {
    const deadlineSeconds = parseDeadlineStrategy(config.deadlineStrategy ?? "creator_controlled_close");
    return encodeFunctionData({
      abi: BOUNTY_LOGIC_ABI,
      functionName: "initialize",
      args: [ownerAddress, config.campaignTitle, resolveDescription(config, "Fan challenge bounty"), BigInt(deadlineSeconds)],
    });
  }

  if (templateName === "FanPassLogic") {
    const { tierNames, tierMaxSupplies } = resolveFanPassTiers(config.options);
    return encodeFunctionData({
      abi: FAN_PASS_LOGIC_ABI,
      functionName: "initialize",
      args: [ownerAddress, config.campaignTitle, tierNames, tierMaxSupplies],
    });
  }

  if (templateName === "PointsPoolLogic") {
    return encodeFunctionData({
      abi: POINTS_POOL_LOGIC_ABI,
      functionName: "initialize",
      args: [ownerAddress, config.campaignTitle, config.options, resolveDeadline(config)],
    });
  }

  if (templateName === "TournamentLogic") {
    return encodeFunctionData({
      abi: TOURNAMENT_LOGIC_ABI,
      functionName: "initialize",
      args: [ownerAddress, config.campaignTitle],
    });
  }

  if (templateName === "AuctionLogic") {
    return encodeFunctionData({
      abi: AUCTION_LOGIC_ABI,
      functionName: "initialize",
      args: [ownerAddress, config.campaignTitle, resolveDescription(config, "Exclusive fan privilege"), resolveDeadline(config)],
    });
  }

  throw new Error(`Unsupported template for deploy: ${templateName}`);
}

function checkDeployRateLimit(address: string): boolean {
  const now = Date.now();
  const entry = deployRateLimitMap.get(address);
  if (!entry || now - entry.windowStart > DEPLOY_WINDOW_MS) {
    deployRateLimitMap.set(address, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= DEPLOY_MAX) return false;
  entry.count += 1;
  return true;
}

function isValidAddress(addr: unknown): addr is `0x${string}` {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function isValidSignature(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value);
}

function isFreshIssuedAt(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - value) <= AUTH_WINDOW_SECONDS;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { config, creatorAddress, signature, issuedAt } = body as {
    config?: ArchitectOutput;
    creatorAddress?: unknown;
    signature?: unknown;
    issuedAt?: unknown;
  };

  if (!config || !config.campaignTitle || !Array.isArray(config.options)) {
    return NextResponse.json({ error: "Valid approved config is required" }, { status: 400 });
  }

  if (!isPresentationReadyCampaign(config.campaignTitle, config.options)) {
    return NextResponse.json(
      { error: "Replace the bracketed placeholder text before deploying" },
      { status: 400 }
    );
  }

  if (!isValidAddress(creatorAddress)) {
    return NextResponse.json(
      { error: "creatorAddress is required, connect your wallet before deploying" },
      { status: 400 }
    );
  }

  if (!isValidSignature(signature)) {
    return NextResponse.json({ error: "signature is required" }, { status: 400 });
  }

  if (!isFreshIssuedAt(issuedAt)) {
    return NextResponse.json({ error: "authorization expired, sign again" }, { status: 400 });
  }

  if (!checkDeployRateLimit(creatorAddress)) {
    return NextResponse.json(
      { error: "Rate limit exceeded, max 3 deploys per minute per wallet" },
      { status: 429 }
    );
  }

  const factoryAddress = process.env.FACTORY_ADDRESS as `0x${string}` | undefined;
  if (!factoryAddress) {
    return NextResponse.json({ error: "FACTORY_ADDRESS not configured" }, { status: 500 });
  }

  const templateName = resolveTemplate(config.templateSelected ?? "PredictionLogicV2");

  try {
    const walletClient = getDeployerWalletClient();
    const publicClient = getPublicClient();
    const message = buildDeployAuthorizationMessage({
      creatorAddress,
      templateName,
      campaignTitle: config.campaignTitle,
      options: config.options,
      deadlineStrategy: config.deadlineStrategy,
      issuedAt,
    });
    const recovered = await recoverMessageAddress({ message, signature });
    if (recovered.toLowerCase() !== creatorAddress.toLowerCase()) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
    }

    // The server wallet remains owner so sponsored lifecycle/follow-up actions can be routed safely.
    const ownerAddress = walletClient.account.address;
    const initData = encodeInitData(templateName, config, ownerAddress);

    const txHash = await walletClient.writeContract({
      address: factoryAddress,
      abi: CAMPAIGN_FACTORY_ABI,
      functionName: "cloneCampaign",
      args: [templateName, initData, creatorAddress],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    const logs = parseEventLogs({
      abi: CAMPAIGN_FACTORY_ABI,
      eventName: "CampaignCreated",
      logs: receipt.logs,
    });

    const campaignAddress = logs[0]?.args?.clone;
    if (!campaignAddress) {
      return NextResponse.json(
        { error: "CampaignCreated event not found in receipt" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      campaignAddress,
      txHash,
      template: templateName,
      explorerUrl: `https://wirefluidscan.com/address/${campaignAddress}`,
      txExplorerUrl: `https://wirefluidscan.com/tx/${txHash}`,
      config,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deployment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
