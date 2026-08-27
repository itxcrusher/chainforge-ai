import { getExploreCampaigns } from "@/lib/data/getCampaigns";
import { getPublicClient } from "@/lib/contracts/clients";
import { getContractEventsChunked } from "@/lib/contracts/logs";
import {
  readCampaignParticipation,
  type CampaignParticipationData,
} from "@/lib/contracts/campaignReads";
import { PREDICTION_LOGIC_V2_ABI } from "@/lib/contracts/abis";
import { getViewCache, setViewCache } from "@/lib/cache/viewCache";

export interface ProfileHistoryItem {
  address: string;
  title: string;
  template: string;
  state: string;
  deadline: string;
  selectedOption: string;
  outcomeLabel?: string;
  result?: "correct" | "wrong" | "pending" | "participated";
}

export interface ProfileSummary {
  address: string;
  totalParticipations: number;
  totalPredictions: number;
  resolvedPredictions: number;
  correctPredictions: number;
  wrongPredictions: number;
  pendingPredictions: number;
  activeParticipations: number;
  currentStreak: number;
  accuracyPct: number;
  history: ProfileHistoryItem[];
}

export interface LeaderboardEntry {
  address: string;
  rank: number;
  totalPredictions: number;
  resolvedPredictions: number;
  correctPredictions: number;
  wrongPredictions: number;
  pendingPredictions: number;
  accuracyPct: number;
}

interface LeaderboardAccumulator {
  totalPredictions: number;
  correctPredictions: number;
  wrongPredictions: number;
  pendingPredictions: number;
}

const PROFILE_CACHE_TTL_MS = 300_000;
const LEADERBOARD_CACHE_TTL_MS = 600_000;
const PROFILE_CACHE_TTL_SECONDS = 300;
const LEADERBOARD_CACHE_TTL_SECONDS = 600;
const profileCache = new Map<string, { expiresAt: number; value: ProfileSummary }>();
let leaderboardCache: { expiresAt: number; value: LeaderboardEntry[] } | null = null;

function isPredictionTemplate(template: string): boolean {
  return template === "PredictionLogicV2";
}

function normalizeAddress(address: string): `0x${string}` {
  return address as `0x${string}`;
}

async function getRecentStartBlock() {
  const client = getPublicClient();
  const latestBlock = await client.getBlockNumber();
  return latestBlock > 50_000n ? latestBlock - 50_000n : 0n;
}

async function getPredictionLogs(address: `0x${string}`, fromBlock: bigint) {
  const client = getPublicClient();
  const logs = await getContractEventsChunked(client, {
    address,
    abi: PREDICTION_LOGIC_V2_ABI,
    eventName: "PredictionSubmitted",
    fromBlock,
  });

  return logs.map((log) => ({
    user: String(log.args.user).toLowerCase(),
    optionIndex: Number(log.args.optionIndex),
  }));
}

async function getRevealedPredictionTimeline(fromBlock: bigint) {
  const campaigns = await getExploreCampaigns();
  const client = getPublicClient();

  const revealedPredictions = await Promise.all(
    campaigns
      .filter((campaign) => campaign.template === "PredictionLogicV2" && campaign.state === "REVEALED")
      .map(async (campaign) => {
        const logs = await getContractEventsChunked(client, {
          address: normalizeAddress(campaign.address),
          abi: PREDICTION_LOGIC_V2_ABI,
          eventName: "ResultRevealed",
          fromBlock,
        });
        const lastLog = logs.at(-1);
        return {
          ...campaign,
          revealBlockNumber: Number(lastLog?.blockNumber ?? 0n),
          winningOptionIndex: campaign.winnerLabel
            ? campaign.options.findIndex((option) => option === campaign.winnerLabel)
            : -1,
        };
      })
  );

  return revealedPredictions.sort((a, b) => a.revealBlockNumber - b.revealBlockNumber);
}

export async function getProfileSummary(address: string): Promise<ProfileSummary> {
  const cacheKey = address.toLowerCase();
  const cachedProfile = profileCache.get(cacheKey);
  if (cachedProfile && cachedProfile.expiresAt > Date.now()) {
    return cachedProfile.value;
  }

  const persistedProfile = await getViewCache<ProfileSummary>(`profile:${cacheKey}`);
  if (persistedProfile) {
    profileCache.set(cacheKey, { expiresAt: Date.now() + PROFILE_CACHE_TTL_MS, value: persistedProfile });
    return persistedProfile;
  }

  const campaigns = await getExploreCampaigns();
  const fromBlock = await getRecentStartBlock();
  const client = getPublicClient();

  const history: ProfileHistoryItem[] = [];
  let totalParticipations = 0;
  let totalPredictions = 0;
  let correctPredictions = 0;
  let wrongPredictions = 0;
  let pendingPredictions = 0;
  let activeParticipations = 0;

  for (const campaign of campaigns) {
    const participation = await readCampaignParticipation(
      client,
      normalizeAddress(campaign.address),
      campaign.template ?? "",
      normalizeAddress(address)
    ).catch((): CampaignParticipationData => ({ hasParticipated: false }));

    if (!participation.hasParticipated || participation.userChoice === undefined) {
      continue;
    }

    totalParticipations += 1;
    if (campaign.state === "OPEN") activeParticipations += 1;

    const userChoiceIndex = Number(participation.userChoice);
    const selectedOption = campaign.options[userChoiceIndex] ?? `Option ${userChoiceIndex}`;
    let result: ProfileHistoryItem["result"] = "participated";

    if (isPredictionTemplate(campaign.template ?? "")) {
      totalPredictions += 1;

      if (campaign.state === "REVEALED" && campaign.winnerLabel) {
        const winningIndex = campaign.options.findIndex((option) => option === campaign.winnerLabel);
        if (winningIndex === userChoiceIndex) {
          correctPredictions += 1;
          result = "correct";
        } else {
          wrongPredictions += 1;
          result = "wrong";
        }
      } else {
        pendingPredictions += 1;
        result = "pending";
      }
    }

    history.push({
      address: campaign.address,
      title: campaign.title,
      template: campaign.template ?? "",
      state: campaign.state ?? "OPEN",
      deadline: campaign.deadline,
      selectedOption,
      outcomeLabel: campaign.winnerLabel,
      result,
    });
  }

  const resolvedPredictions = correctPredictions + wrongPredictions;
  const accuracyPct = resolvedPredictions > 0
    ? Math.round((correctPredictions / resolvedPredictions) * 100)
    : 0;

  const timeline = await getRevealedPredictionTimeline(fromBlock);
  let currentStreak = 0;
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const campaign = timeline[i];
    const participation = history.find((entry) => entry.address.toLowerCase() === campaign.address.toLowerCase());
    if (!participation || participation.result !== "correct") {
      if (participation?.result === "wrong") break;
      continue;
    }
    currentStreak += 1;
  }

  history.sort((a, b) => Number(b.deadline) - Number(a.deadline));

  const summary = {
    address,
    totalParticipations,
    totalPredictions,
    resolvedPredictions,
    correctPredictions,
    wrongPredictions,
    pendingPredictions,
    activeParticipations,
    currentStreak,
    accuracyPct,
    history,
  };

  profileCache.set(cacheKey, { expiresAt: Date.now() + PROFILE_CACHE_TTL_MS, value: summary });
  await setViewCache(`profile:${cacheKey}`, summary, PROFILE_CACHE_TTL_SECONDS);
  return summary;
}

export function clearLeaderboardCache(): void {
  leaderboardCache = null;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  if (leaderboardCache && leaderboardCache.expiresAt > Date.now()) {
    return leaderboardCache.value;
  }

  const persistedLeaderboard = await getViewCache<LeaderboardEntry[]>("leaderboard");
  if (persistedLeaderboard) {
    leaderboardCache = { expiresAt: Date.now() + LEADERBOARD_CACHE_TTL_MS, value: persistedLeaderboard };
    return persistedLeaderboard;
  }

  const campaigns = await getExploreCampaigns();
  const fromBlock = await getRecentStartBlock();
  const accumulators = new Map<string, LeaderboardAccumulator>();

  for (const campaign of campaigns) {
    if (!isPredictionTemplate(campaign.template ?? "")) continue;

    const submissions = await getPredictionLogs(
      normalizeAddress(campaign.address),
      fromBlock
    );
    const winningIndex = campaign.state === "REVEALED" && campaign.winnerLabel
      ? campaign.options.findIndex((option) => option === campaign.winnerLabel)
      : -1;
    const resolved = campaign.state === "REVEALED" && winningIndex >= 0;

    for (const submission of submissions) {
      const existing = accumulators.get(submission.user) ?? {
        totalPredictions: 0,
        correctPredictions: 0,
        wrongPredictions: 0,
        pendingPredictions: 0,
      };

      existing.totalPredictions += 1;
      if (resolved) {
        if (submission.optionIndex === winningIndex) {
          existing.correctPredictions += 1;
        } else {
          existing.wrongPredictions += 1;
        }
      } else {
        existing.pendingPredictions += 1;
      }

      accumulators.set(submission.user, existing);
    }
  }

  const entries = Array.from(accumulators.entries())
    .map(([address, stats]) => {
      const resolvedPredictions = stats.correctPredictions + stats.wrongPredictions;
      const accuracyPct = resolvedPredictions > 0
        ? Math.round((stats.correctPredictions / resolvedPredictions) * 100)
        : 0;

      return {
        address,
        rank: 0,
        totalPredictions: stats.totalPredictions,
        resolvedPredictions,
        correctPredictions: stats.correctPredictions,
        wrongPredictions: stats.wrongPredictions,
        pendingPredictions: stats.pendingPredictions,
        accuracyPct,
      } satisfies LeaderboardEntry;
    })
    .filter((entry) => entry.totalPredictions >= 1)
    .sort((a, b) => {
      if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
      if (b.totalPredictions !== a.totalPredictions) return b.totalPredictions - a.totalPredictions;
      return b.correctPredictions - a.correctPredictions;
    })
    .slice(0, 20)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  leaderboardCache = { expiresAt: Date.now() + LEADERBOARD_CACHE_TTL_MS, value: entries };
  await setViewCache("leaderboard", entries, LEADERBOARD_CACHE_TTL_SECONDS);
  return entries;
}
