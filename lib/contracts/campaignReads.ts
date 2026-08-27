import {
  AUCTION_LOGIC_ABI,
  BOUNTY_LOGIC_ABI,
  CAMPAIGN_FACTORY_ABI,
  FAN_PASS_LOGIC_ABI,
  POINTS_POOL_LOGIC_ABI,
  PREDICTION_LOGIC_ABI,
  PREDICTION_LOGIC_V2_ABI,
  QUIZ_LOGIC_ABI,
  RAFFLE_LOGIC_ABI,
  SURVEY_LOGIC_ABI,
  TOURNAMENT_LOGIC_ABI,
} from "@/lib/contracts/abis";
import { getPublicClient } from "@/lib/contracts/clients";
import { getCampaignCompatibility } from "@/lib/contracts/campaignCompatibility";

export type CampaignLifecycleState = "OPEN" | "CLOSED" | "REVEALED";

export interface CampaignBaseData {
  title: string;
  options: string[];
  voteCounts: string[];
  deadline: string;
  template: string;
  creator: string;
  state: CampaignLifecycleState;
  relayCompatible: boolean;
  compatibilityNote?: string;
  implementationAddress?: string;
  winnerLabel?: string;
  winningOptionIndex?: string;
}

export interface CampaignParticipationData {
  hasParticipated: boolean;
  userChoice?: string;
}

function inferV1State(template: string, deadline: bigint): CampaignLifecycleState {
  if (template === "PredictionLogic") {
    return BigInt(Math.floor(Date.now() / 1000)) >= deadline ? "CLOSED" : "OPEN";
  }

  if (template === "VotingLogic") {
    if (deadline === 0n) return "OPEN";
    return BigInt(Math.floor(Date.now() / 1000)) >= deadline ? "CLOSED" : "OPEN";
  }

  return "OPEN";
}

function mapStateValue(value: bigint): CampaignLifecycleState {
  if (value === 2n) return "REVEALED";
  if (value === 1n) return "CLOSED";
  return "OPEN";
}

function toStringArray(values: unknown): string[] {
  return Array.isArray(values) ? values.map((v) => String(v)) : [];
}

function toBigIntArray(values: unknown): bigint[] {
  return Array.isArray(values) ? values.map((v) => BigInt(v as bigint | number | string)) : [];
}

function toState(value: unknown): CampaignLifecycleState {
  return mapStateValue(BigInt(value as bigint | number | string));
}

async function readTemplateAndCreator(
  client: ReturnType<typeof getPublicClient>,
  factoryAddress: `0x${string}`,
  campaignAddress: `0x${string}`
) {
  const [template, creator] = await Promise.all([
    client.readContract({
      address: factoryAddress,
      abi: CAMPAIGN_FACTORY_ABI,
      functionName: "campaignTemplate",
      args: [campaignAddress],
    }),
    client.readContract({
      address: factoryAddress,
      abi: CAMPAIGN_FACTORY_ABI,
      functionName: "campaignCreator",
      args: [campaignAddress],
    }),
  ]);

  return { templateName: template as string, creator: creator as string };
}

export async function readCampaignBase(
  client: ReturnType<typeof getPublicClient>,
  factoryAddress: `0x${string}`,
  campaignAddress: `0x${string}`
): Promise<CampaignBaseData> {
  const { templateName, creator } = await readTemplateAndCreator(client, factoryAddress, campaignAddress);
  const compatibility = await getCampaignCompatibility(campaignAddress, templateName);

  const read = (abi: unknown, functionName: string, args?: unknown[]) =>
    client.readContract({
      address: campaignAddress,
      abi: abi as any,
      functionName,
      args: args as any,
    });

  let title = "Untitled campaign";
  let options: string[] = [];
  let voteCounts: string[] = [];
  let deadline = "0";
  let state: CampaignLifecycleState = "OPEN";
  let winnerLabel: string | undefined;
  let winningOptionIndex: string | undefined;

  if (templateName === "PredictionLogicV2") {
    const [results, deadlineValue, titleValue, stateValue, winnerIndex, winner] = await Promise.all([
      read(PREDICTION_LOGIC_V2_ABI, "getResults"),
      read(PREDICTION_LOGIC_V2_ABI, "getDeadline"),
      read(PREDICTION_LOGIC_V2_ABI, "title"),
      read(PREDICTION_LOGIC_V2_ABI, "getState"),
      read(PREDICTION_LOGIC_V2_ABI, "winningOption").catch(() => undefined),
      read(PREDICTION_LOGIC_V2_ABI, "getWinner").catch(() => undefined),
    ]);
    const tuple = results as [unknown, unknown];
    title = titleValue as string;
    options = toStringArray(tuple[0]);
    voteCounts = toBigIntArray(tuple[1]).map((v) => v.toString());
    deadline = BigInt(deadlineValue as bigint | number | string).toString();
    state = toState(stateValue);
    winningOptionIndex = winnerIndex !== undefined ? BigInt(winnerIndex as bigint | number | string).toString() : undefined;
    winnerLabel = typeof winner === "string" ? winner : undefined;
  } else if (templateName === "VotingLogicV2" || templateName === "SurveyLogic") {
    const abi = templateName === "SurveyLogic" ? SURVEY_LOGIC_ABI : PREDICTION_LOGIC_ABI;
    const stateAbi = templateName === "SurveyLogic" ? SURVEY_LOGIC_ABI : PREDICTION_LOGIC_V2_ABI;
    const [results, deadlineValue, titleValue, stateValue] = await Promise.all([
      read(abi, "getResults"),
      read(abi, "getDeadline"),
      read(abi, "title"),
      read(stateAbi, "getState"),
    ]);
    const tuple = results as [unknown, unknown];
    title = titleValue as string;
    options = toStringArray(tuple[0]);
    voteCounts = toBigIntArray(tuple[1]).map((v) => v.toString());
    deadline = BigInt(deadlineValue as bigint | number | string).toString();
    state = toState(stateValue);
  } else if (templateName === "QuizLogic") {
    const [results, deadlineValue, titleValue, stateValue, correctIndex, correctLabel] = await Promise.all([
      read(QUIZ_LOGIC_ABI, "getResults"),
      read(QUIZ_LOGIC_ABI, "getDeadline"),
      read(QUIZ_LOGIC_ABI, "title"),
      read(QUIZ_LOGIC_ABI, "getState"),
      read(QUIZ_LOGIC_ABI, "correctOption").catch(() => undefined),
      read(QUIZ_LOGIC_ABI, "getCorrectOptionLabel").catch(() => undefined),
    ]);
    const tuple = results as [unknown, unknown];
    title = titleValue as string;
    options = toStringArray(tuple[0]);
    voteCounts = toBigIntArray(tuple[1]).map((v) => v.toString());
    deadline = BigInt(deadlineValue as bigint | number | string).toString();
    state = toState(stateValue);
    winningOptionIndex = correctIndex !== undefined ? BigInt(correctIndex as bigint | number | string).toString() : undefined;
    winnerLabel = typeof correctLabel === "string" ? correctLabel : undefined;
  } else if (templateName === "RaffleLogic") {
    const [titleValue, deadlineValue, stateValue, participantCount, prize, winner] = await Promise.all([
      read(RAFFLE_LOGIC_ABI, "title"),
      read(RAFFLE_LOGIC_ABI, "getDeadline"),
      read(RAFFLE_LOGIC_ABI, "getState"),
      read(RAFFLE_LOGIC_ABI, "getParticipantCount"),
      read(RAFFLE_LOGIC_ABI, "prizeDescription"),
      read(RAFFLE_LOGIC_ABI, "winner").catch(() => undefined),
    ]);
    title = titleValue as string;
    options = [typeof prize === "string" ? `Enter raffle: ${prize}` : "Enter raffle"];
    voteCounts = [BigInt(participantCount as bigint | number | string).toString()];
    deadline = BigInt(deadlineValue as bigint | number | string).toString();
    state = toState(stateValue);
    winnerLabel = typeof winner === "string" && !/^0x0{40}$/i.test(winner) ? winner : undefined;
  } else if (templateName === "BountyLogic") {
    const [titleValue, deadlineValue, stateValue, participantCount, challenge] = await Promise.all([
      read(BOUNTY_LOGIC_ABI, "title"),
      read(BOUNTY_LOGIC_ABI, "getDeadline"),
      read(BOUNTY_LOGIC_ABI, "getState"),
      read(BOUNTY_LOGIC_ABI, "getParticipantCount"),
      read(BOUNTY_LOGIC_ABI, "challengeDescription"),
    ]);
    title = titleValue as string;
    options = [typeof challenge === "string" ? `Register: ${challenge}` : "Register for bounty"];
    voteCounts = [BigInt(participantCount as bigint | number | string).toString()];
    deadline = BigInt(deadlineValue as bigint | number | string).toString();
    state = toState(stateValue);
  } else if (templateName === "FanPassLogic") {
    const [titleValue, stateValue, tierCount] = await Promise.all([
      read(FAN_PASS_LOGIC_ABI, "title"),
      read(FAN_PASS_LOGIC_ABI, "getState"),
      read(FAN_PASS_LOGIC_ABI, "getTierCount"),
    ]);
    const count = Number(tierCount as bigint | number | string);
    const tiers = await Promise.all(
      Array.from({ length: count }, (_, index) => read(FAN_PASS_LOGIC_ABI, "getTier", [BigInt(index)]))
    );
    title = titleValue as string;
    options = tiers.map((tier) => (tier as [string, bigint, bigint])[0]);
    voteCounts = tiers.map((tier) => (tier as [string, bigint, bigint])[2].toString());
    state = toState(stateValue);
    deadline = "0";
  } else if (templateName === "PointsPoolLogic") {
    const [results, deadlineValue, titleValue, stateValue, winnerIndex, winner] = await Promise.all([
      read(POINTS_POOL_LOGIC_ABI, "getResults"),
      read(POINTS_POOL_LOGIC_ABI, "getDeadline"),
      read(POINTS_POOL_LOGIC_ABI, "title"),
      read(POINTS_POOL_LOGIC_ABI, "getState"),
      read(POINTS_POOL_LOGIC_ABI, "winningOption").catch(() => undefined),
      read(POINTS_POOL_LOGIC_ABI, "getWinnerLabel").catch(() => undefined),
    ]);
    const tuple = results as [unknown, unknown, unknown];
    title = titleValue as string;
    options = toStringArray(tuple[0]);
    voteCounts = toBigIntArray(tuple[2]).map((v) => v.toString());
    deadline = BigInt(deadlineValue as bigint | number | string).toString();
    state = toState(stateValue);
    winningOptionIndex = winnerIndex !== undefined ? BigInt(winnerIndex as bigint | number | string).toString() : undefined;
    winnerLabel = typeof winner === "string" ? winner : undefined;
  } else if (templateName === "TournamentLogic") {
    const [titleValue, stateValue, roundCount] = await Promise.all([
      read(TOURNAMENT_LOGIC_ABI, "title"),
      read(TOURNAMENT_LOGIC_ABI, "getState"),
      read(TOURNAMENT_LOGIC_ABI, "getRoundCount"),
    ]);
    title = titleValue as string;
    const count = Number(roundCount as bigint | number | string);
    if (count > 0) {
      const round = (await read(TOURNAMENT_LOGIC_ABI, "getRound", [0n])) as [string, string[], bigint, boolean, bigint, bigint[]];
      options = round[1];
      voteCounts = round[5].map((v) => v.toString());
      deadline = round[2].toString();
    } else {
      options = ["Tournament initialized, creator adds rounds next"];
      voteCounts = ["0"];
      deadline = "0";
    }
    state = BigInt(stateValue as bigint | number | string) === 1n ? "REVEALED" : "OPEN";
  } else if (templateName === "AuctionLogic") {
    const [titleValue, deadlineValue, stateValue, bidderCount, privilege, highestBid] = await Promise.all([
      read(AUCTION_LOGIC_ABI, "title"),
      read(AUCTION_LOGIC_ABI, "getDeadline"),
      read(AUCTION_LOGIC_ABI, "getState"),
      read(AUCTION_LOGIC_ABI, "getBidderCount"),
      read(AUCTION_LOGIC_ABI, "privilegeDescription"),
      read(AUCTION_LOGIC_ABI, "getHighestBid").catch(() => undefined),
    ]);
    title = titleValue as string;
    options = ["Bid 100 points", "Bid 250 points", "Bid 500 points", "Bid 1000 points"];
    voteCounts = [BigInt(bidderCount as bigint | number | string).toString(), "0", "0", "0"];
    deadline = BigInt(deadlineValue as bigint | number | string).toString();
    state = toState(stateValue);
    if (highestBid) {
      const [topBidder, amount] = highestBid as [string, bigint];
      winnerLabel = /^0x0{40}$/i.test(topBidder) ? undefined : `${topBidder} (${amount.toString()} points)`;
    }
    if (typeof privilege === "string") {
      options[0] = `Bid 100 points: ${privilege}`;
    }
  } else {
    const [results, deadlineValue, titleValue] = await Promise.all([
      read(PREDICTION_LOGIC_ABI, "getResults"),
      read(PREDICTION_LOGIC_ABI, "getDeadline"),
      read(PREDICTION_LOGIC_ABI, "title"),
    ]);
    const tuple = results as [unknown, unknown];
    title = titleValue as string;
    options = toStringArray(tuple[0]);
    voteCounts = toBigIntArray(tuple[1]).map((v) => v.toString());
    deadline = BigInt(deadlineValue as bigint | number | string).toString();
    state = inferV1State(templateName, BigInt(deadline));
  }

  return {
    title,
    options,
    voteCounts,
    deadline,
    template: templateName,
    creator,
    state,
    relayCompatible: compatibility.relayCompatible,
    compatibilityNote: compatibility.compatibilityNote,
    implementationAddress: compatibility.implementationAddress,
    winnerLabel,
    winningOptionIndex,
  };
}

export async function readCampaignParticipation(
  client: ReturnType<typeof getPublicClient>,
  campaignAddress: `0x${string}`,
  template: string,
  userAddress: `0x${string}`
): Promise<CampaignParticipationData> {
  const read = (abi: unknown, functionName: string, args?: unknown[]) =>
    client.readContract({
      address: campaignAddress,
      abi: abi as any,
      functionName,
      args: args as any,
    });

  if (template === "SurveyLogic") {
    const hasParticipated = (await read(SURVEY_LOGIC_ABI, "hasUserResponded", [userAddress])) as boolean;
    if (!hasParticipated) return { hasParticipated: false };
    const userChoice = await read(SURVEY_LOGIC_ABI, "getUserChoice", [userAddress]);
    return { hasParticipated: true, userChoice: BigInt(userChoice as bigint | number | string).toString() };
  }

  if (template === "QuizLogic") {
    const hasParticipated = (await read(QUIZ_LOGIC_ABI, "hasUserAnswered", [userAddress])) as boolean;
    if (!hasParticipated) return { hasParticipated: false };
    const userChoice = await read(QUIZ_LOGIC_ABI, "getUserAnswer", [userAddress]);
    return { hasParticipated: true, userChoice: BigInt(userChoice as bigint | number | string).toString() };
  }

  if (template === "RaffleLogic") {
    const hasParticipated = (await read(RAFFLE_LOGIC_ABI, "hasEntered", [userAddress])) as boolean;
    return { hasParticipated, userChoice: hasParticipated ? "0" : undefined };
  }

  if (template === "BountyLogic") {
    const hasParticipated = (await read(BOUNTY_LOGIC_ABI, "hasRegistered", [userAddress])) as boolean;
    return { hasParticipated, userChoice: hasParticipated ? "0" : undefined };
  }

  if (template === "FanPassLogic") {
    const tierCount = Number(await read(FAN_PASS_LOGIC_ABI, "getTierCount"));
    for (let index = 0; index < tierCount; index++) {
      const hasClaimed = (await read(FAN_PASS_LOGIC_ABI, "hasClaimed", [userAddress, BigInt(index)])) as boolean;
      if (hasClaimed) return { hasParticipated: true, userChoice: String(index) };
    }
    return { hasParticipated: false };
  }

  if (template === "PointsPoolLogic") {
    const hasParticipated = (await read(POINTS_POOL_LOGIC_ABI, "hasPredicted", [userAddress])) as boolean;
    if (!hasParticipated) return { hasParticipated: false };
    const [optionIndex] = (await read(POINTS_POOL_LOGIC_ABI, "getUserPrediction", [userAddress])) as [bigint, bigint];
    return { hasParticipated: true, userChoice: optionIndex.toString() };
  }

  if (template === "TournamentLogic") {
    const hasParticipated = (await read(TOURNAMENT_LOGIC_ABI, "hasPredictedRound", [userAddress, 0n])) as boolean;
    if (!hasParticipated) return { hasParticipated: false };
    const userChoice = await read(TOURNAMENT_LOGIC_ABI, "getRoundPrediction", [userAddress, 0n]);
    return { hasParticipated: true, userChoice: BigInt(userChoice as bigint | number | string).toString() };
  }

  if (template === "AuctionLogic") {
    const [amount] = (await read(AUCTION_LOGIC_ABI, "getBid", [userAddress])) as [bigint, bigint];
    return { hasParticipated: amount > 0n, userChoice: amount > 0n ? "0" : undefined };
  }

  const sharedAbi = PREDICTION_LOGIC_ABI;
  const hasParticipated = (await read(sharedAbi, "hasUserVoted", [userAddress])) as boolean;

  if (!hasParticipated) {
    return { hasParticipated: false };
  }

  const userChoice = await read(sharedAbi, "getUserChoice", [userAddress]);

  return {
    hasParticipated: true,
    userChoice: BigInt(userChoice as bigint | number | string).toString(),
  };
}
