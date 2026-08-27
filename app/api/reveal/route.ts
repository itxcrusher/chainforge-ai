import { NextRequest, NextResponse } from "next/server";
import { encodeFunctionData, recoverMessageAddress } from "viem";
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
  VOTING_LOGIC_V2_ABI,
} from "@/lib/contracts/abis";
import { campaignCache } from "@/lib/cache/campaignCache";
import { getDeployerWalletClient, getPublicClient } from "@/lib/contracts/clients";
import { buildCreatorActionMessage, type CreatorAction } from "@/lib/contracts/creatorActions";
import { invalidateViewCache } from "@/lib/cache/viewCache";

type RevealRequest = {
  contractAddress?: string;
  requesterAddress?: string;
  signature?: string;
  action?: CreatorAction;
  winnerIndex?: number;
};

function isAddress(value: string | undefined): value is `0x${string}` {
  return !!value && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isSignature(value: string | undefined): value is `0x${string}` {
  return !!value && /^0x[0-9a-fA-F]+$/.test(value);
}

function requiresWinnerIndexForReveal(templateName: string) {
  return ["PredictionLogicV2", "QuizLogic", "PointsPoolLogic"].includes(templateName);
}

function encodeCloseCalldata(templateName: string): `0x${string}` | null {
  if (templateName === "SurveyLogic") return encodeFunctionData({ abi: SURVEY_LOGIC_ABI, functionName: "closeSurvey" });
  if (templateName === "VotingLogicV2") return encodeFunctionData({ abi: VOTING_LOGIC_V2_ABI, functionName: "closeCampaign" });
  if (templateName === "PredictionLogicV2") return encodeFunctionData({ abi: PREDICTION_LOGIC_V2_ABI, functionName: "closeCampaign" });
  if (templateName === "QuizLogic") return encodeFunctionData({ abi: QUIZ_LOGIC_ABI, functionName: "closeCampaign" });
  if (templateName === "RaffleLogic") return encodeFunctionData({ abi: RAFFLE_LOGIC_ABI, functionName: "closeCampaign" });
  if (templateName === "BountyLogic") return encodeFunctionData({ abi: BOUNTY_LOGIC_ABI, functionName: "closeCampaign" });
  if (templateName === "FanPassLogic") return encodeFunctionData({ abi: FAN_PASS_LOGIC_ABI, functionName: "closeEvent" });
  if (templateName === "PointsPoolLogic") return encodeFunctionData({ abi: POINTS_POOL_LOGIC_ABI, functionName: "closeCampaign" });
  if (templateName === "AuctionLogic") return encodeFunctionData({ abi: AUCTION_LOGIC_ABI, functionName: "closeCampaign" });
  return null;
}

function encodeRevealCalldata(templateName: string, winnerIndex?: number): `0x${string}` | null {
  if (templateName === "PredictionLogicV2" && winnerIndex !== undefined) {
    return encodeFunctionData({ abi: PREDICTION_LOGIC_V2_ABI, functionName: "revealResult", args: [BigInt(winnerIndex)] });
  }
  if (templateName === "QuizLogic" && winnerIndex !== undefined) {
    return encodeFunctionData({ abi: QUIZ_LOGIC_ABI, functionName: "revealAnswer", args: [BigInt(winnerIndex)] });
  }
  if (templateName === "PointsPoolLogic" && winnerIndex !== undefined) {
    return encodeFunctionData({ abi: POINTS_POOL_LOGIC_ABI, functionName: "revealResult", args: [BigInt(winnerIndex)] });
  }
  if (templateName === "RaffleLogic") {
    return encodeFunctionData({ abi: RAFFLE_LOGIC_ABI, functionName: "selectWinner" });
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: RevealRequest;
  try {
    body = (await req.json()) as RevealRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { contractAddress, requesterAddress, signature, action, winnerIndex } = body;

  if (!isAddress(contractAddress) || !isAddress(requesterAddress) || !isSignature(signature)) {
    return NextResponse.json(
      { error: "contractAddress, requesterAddress, and signature are required" },
      { status: 400 }
    );
  }

  if (action !== "close" && action !== "reveal") {
    return NextResponse.json({ error: "action must be close or reveal" }, { status: 400 });
  }

  const factoryAddress = process.env.FACTORY_ADDRESS as `0x${string}` | undefined;
  if (!factoryAddress) {
    return NextResponse.json({ error: "FACTORY_ADDRESS not configured" }, { status: 500 });
  }

  try {
    const publicClient = getPublicClient();
    const deployerClient = getDeployerWalletClient();

    const [creator, template] = await Promise.all([
      publicClient.readContract({
        address: factoryAddress,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: "campaignCreator",
        args: [contractAddress],
      }),
      publicClient.readContract({
        address: factoryAddress,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: "campaignTemplate",
        args: [contractAddress],
      }),
    ]);

    const creatorAddress = (creator as string).toLowerCase();
    const requester = requesterAddress.toLowerCase();
    if (creatorAddress !== requester) {
      return NextResponse.json({ error: "Only the campaign creator can perform this action" }, { status: 403 });
    }

    const templateName = template as string;
    if (action === "reveal" && requiresWinnerIndexForReveal(templateName) && (!Number.isInteger(winnerIndex) || winnerIndex! < 0)) {
      return NextResponse.json({ error: "winnerIndex is required for reveal" }, { status: 400 });
    }

    const message = buildCreatorActionMessage(contractAddress, action, winnerIndex);
    const recovered = await recoverMessageAddress({ message, signature });
    if (recovered.toLowerCase() !== requester) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
    }

    const data = action === "close"
      ? encodeCloseCalldata(templateName)
      : encodeRevealCalldata(templateName, winnerIndex);

    if (!data) {
      return NextResponse.json(
        { error: `Lifecycle action ${action} is not supported for template ${templateName}` },
        { status: 400 }
      );
    }

    const txHash = await deployerClient.sendTransaction({ to: contractAddress, data });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    await campaignCache.invalidate(contractAddress);
    await invalidateViewCache("explore:campaigns", "leaderboard", `profile:${requester.toLowerCase()}`);

    return NextResponse.json({
      txHash,
      template: templateName,
      action,
      explorerUrl: `https://wirefluidscan.com/tx/${txHash}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lifecycle action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
