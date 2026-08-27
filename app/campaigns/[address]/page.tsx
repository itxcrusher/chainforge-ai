"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { useActionOverlay } from "@/components/ActionOverlay";
import { injected } from "wagmi/connectors";
import { getTeamTheme } from "@/lib/data/demo-teams";
import type { CampaignData } from "@/lib/cache/campaignCache";
import { buildCreatorActionMessage } from "@/lib/contracts/creatorActions";
import { buildParticipationAuthorizationMessage } from "@/lib/contracts/authorizationMessages";
import {
  getActionVerb,
  getOutcomeLabel,
  getParticipationLabel,
  getTemplateLabel,
  getWinnerBadgeLabel,
  isPredictionTemplate,
} from "@/lib/campaigns/templateLabels";
import VoteShareChart from "@/components/VoteShareChart";
import { useToast } from "@/components/Toasts";
import { CopyButton } from "@/components/copy-button";

type CampaignStatus = "PENDING" | "OPEN" | "CLOSED" | "REVEALED";

interface CampaignPageProps {
  params: { address: string };
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
      />
    </svg>
  );
}

function useCountdown(deadline: number) {
  const [remaining, setRemaining] = useState<number>(deadline - Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(deadline - Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (deadline === 0) return "Open voting, no deadline";
  if (remaining <= 0) return "Deadline passed";

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return `${h}h ${m}m ${s}s remaining`;
}

function isParticipationWindowOpen(status: CampaignStatus, template: string | undefined, deadline: number) {
  if (status !== "OPEN") return false;
  if (template === "SurveyLogic") return true;
  if (deadline === 0) return true;
  return Math.floor(Date.now() / 1000) < deadline;
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  if (status === "PENDING") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-900/50 text-amber-400 border border-amber-700">
        PENDING
      </span>
    );
  }

  if (status === "OPEN") {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-900/60 text-emerald-400 border border-emerald-700">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        OPEN
      </span>
    );
  }

  if (status === "REVEALED") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-900/50 text-indigo-300 border border-indigo-700">
        REVEALED
      </span>
    );
  }

  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
      CLOSED
    </span>
  );
}

function OptionCard({
  option,
  index,
  voteCount,
  total,
  onVote,
  disabled,
  userChose,
  winner,
  template,
}: {
  option: string;
  index: number;
  voteCount: bigint;
  total: bigint;
  onVote: (index: number) => void;
  disabled: boolean;
  userChose: boolean;
  winner: boolean;
  template?: string;
}) {
  const theme = getTeamTheme(option);
  const pct = total > 0n ? Number((voteCount * 100n) / total) : 0;
  const borderColor = theme?.primary ?? "#6366F1";
  const accentColor = theme?.accent ?? "#6366F1";
  const participationLabel = getParticipationLabel(template, voteCount);
  const actionVerb = getActionVerb(template);
  const winnerBadge = getWinnerBadgeLabel(template);

  return (
    <div
      className={`flex-1 rounded-xl border-2 p-5 flex flex-col gap-3 transition-all duration-300 ${
        userChose || winner ? "shadow-lg" : ""
      }`}
      style={{
        borderColor: winner ? "#818cf8" : borderColor,
        boxShadow: userChose || winner ? `0 0 20px 2px ${(winner ? "#818cf8" : borderColor)}40` : undefined,
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {theme && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded self-start"
            style={{ backgroundColor: borderColor, color: theme.secondary }}
          >
            {theme.tag}
          </span>
        )}
        {winner && (
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/50">
            {winnerBadge}
          </span>
        )}
      </div>
      <h2 className="text-lg font-bold text-white">{option}</h2>
      <div className="text-sm text-slate-400">
        {voteCount.toString()} {participationLabel}
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: accentColor }}
        />
      </div>
      <div className="text-xs text-slate-500">{pct}%</div>
      {!disabled && (
        <button
          type="button"
          onClick={() => onVote(index)}
          className="mt-2 py-2 px-4 rounded-lg font-semibold text-sm text-white transition-colors"
          style={{ backgroundColor: borderColor }}
        >
          {actionVerb} {option}
        </button>
      )}
      {userChose && <div className="mt-2 text-xs font-semibold text-emerald-400">Your choice</div>}
    </div>
  );
}

export default function CampaignPage({ params }: CampaignPageProps) {
  const address = params.address as `0x${string}`;
  const { address: userAddress, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const { showOverlay, hideOverlay } = useActionOverlay();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function handleConnectWallet() {
    showOverlay("Connect wallet", "Approve the wallet connection request to continue.");
    try {
      await connectAsync({ connector: injected() });
    } finally {
      hideOverlay();
    }
  }

  const [submittedTx, setSubmittedTx] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [relaying, setRelaying] = useState(false);
  const [relayError, setRelayError] = useState<string | null>(null);
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [lifecycleTx, setLifecycleTx] = useState<string | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [revealOption, setRevealOption] = useState<string>("");

  const fetchCampaignData = useCallback(async () => {
    try {
      const searchParams = new URLSearchParams({ address });
      if (userAddress) searchParams.set("userAddress", userAddress);

      const res = await fetch(`/api/campaigns?${searchParams.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as CampaignData;
        setCampaignData(data);
        if (data.winningOptionIndex !== undefined) {
          setRevealOption(data.winningOptionIndex);
        }
      }
    } catch {
      // Retry on next poll.
    }
  }, [address, userAddress]);

  useEffect(() => {
    fetchCampaignData();
  }, [fetchCampaignData]);

  useEffect(() => {
    const interval = setInterval(fetchCampaignData, 15000);
    return () => clearInterval(interval);
  }, [fetchCampaignData]);

  useEffect(() => {
    if (!submittedTx) {
      setSuccessVisible(false);
      return;
    }
    const timeout = setTimeout(() => setSuccessVisible(true), 30);
    return () => clearTimeout(timeout);
  }, [submittedTx]);

  async function handleVote(optionIndex: number) {
    if (!userAddress || !campaignData) return;

    const deadlinePassed = campaignData.template !== "SurveyLogic" && Number(campaignData.deadline) > 0 && Number(campaignData.deadline) <= Math.floor(Date.now() / 1000);
    if (campaignData.state !== "OPEN" || deadlinePassed) {
      const msg = deadlinePassed
        ? "Deadline passed, waiting for creator to close this campaign"
        : "Campaign is closed for participation";
      setRelayError(msg);
      toast("error", msg);
      return;
    }

    setSelectedOption(optionIndex);
    setRelaying(true);
    setRelayError(null);

    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const message = buildParticipationAuthorizationMessage({
        contractAddress: address,
        userAddress,
        optionIndex,
        issuedAt,
      });
      showOverlay("Confirm participation", "Approve the signature request in your wallet to authorize this gas-sponsored interaction.");
      const signature = await signMessageAsync({ message });

      showOverlay("Submitting interaction", "Sending your choice on-chain through the sponsor relayer. This can take a few seconds.");
      const res = await fetch("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress: address, optionIndex, userAddress, signature, issuedAt }),
      });

      const data = (await res.json()) as { txHash?: string; error?: string };
      if (!res.ok || !data.txHash) {
        const msg = data.error ?? "Relay failed";
        setRelayError(msg);
        toast("error", msg);
        return;
      }

      setSubmittedTx(data.txHash);
      toast("success", "Submitted on-chain, gas sponsored by ChainForge AI");

      // Optimistic update: immediately reflect participation in local state
      setCampaignData((prev) => {
        if (!prev) return prev;
        const updatedCounts = [...(prev.voteCounts ?? [])];
        updatedCounts[optionIndex] = (Number(updatedCounts[optionIndex] ?? 0) + 1).toString();
        return {
          ...prev,
          voteCounts: updatedCounts,
          hasParticipated: true,
          userChoice: String(optionIndex),
        };
      });

      // Reconcile with on-chain truth after a brief delay
      setTimeout(() => { fetchCampaignData(); }, 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error, could not reach /api/relay";
      setRelayError(msg);
      toast("error", msg);
    } finally {
      hideOverlay();
      setRelaying(false);
    }
  }

  async function handleCreatorAction(action: "close" | "reveal") {
    if (!userAddress) return;

    const winnerIndex = action === "reveal" ? Number(revealOption) : undefined;
    if (action === "reveal" && (winnerIndex === undefined || !Number.isInteger(winnerIndex) || winnerIndex < 0)) {
      const msg = "Select a winning option first";
      setLifecycleError(msg);
      toast("error", msg);
      return;
    }

    if (action === "close" && campaignData?.template === "PredictionLogicV2" && Number(campaignData.deadline) > Math.floor(Date.now() / 1000)) {
      const msg = "Prediction campaigns can only close after the deadline passes.";
      setLifecycleError(msg);
      toast("error", msg);
      return;
    }

    setLifecycleLoading(true);
    setLifecycleError(null);

    try {
      const message = buildCreatorActionMessage(address, action, winnerIndex);
      showOverlay(action === "close" ? "Confirm close" : "Confirm reveal", action === "close" ? "Approve the signature request in your wallet to close this campaign." : "Approve the signature request in your wallet to reveal the result.");
      const signature = await signMessageAsync({ message });

      showOverlay(action === "close" ? "Closing campaign" : "Revealing result", "Submitting the lifecycle transaction on-chain. This can take a few seconds.");
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: address,
          requesterAddress: userAddress,
          signature,
          action,
          winnerIndex,
        }),
      });

      const data = (await res.json()) as { txHash?: string; error?: string };
      if (!res.ok || !data.txHash) {
        const msg = data.error ?? "Creator action failed";
        setLifecycleError(msg);
        toast("error", msg);
        return;
      }

      setLifecycleTx(data.txHash);
      toast("success", action === "close" ? "Campaign closed on-chain" : "Result revealed on-chain");

      // Optimistic state update
      setCampaignData((prev) => {
        if (!prev) return prev;
        if (action === "close") return { ...prev, state: "CLOSED" };
        return {
          ...prev,
          state: "REVEALED",
          winningOptionIndex: winnerIndex !== undefined ? String(winnerIndex) : undefined,
          winnerLabel: winnerIndex !== undefined ? prev.options?.[winnerIndex] : undefined,
        };
      });

      setTimeout(() => { fetchCampaignData(); }, 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signature or network error";
      setLifecycleError(msg);
      toast("error", msg);
    } finally {
      hideOverlay();
      setLifecycleLoading(false);
    }
  }

  const options = campaignData?.options ?? [];
  const voteCounts = useMemo(() => (campaignData?.voteCounts ?? []).map(BigInt), [campaignData?.voteCounts]);
  const totalVotes = voteCounts.reduce((acc, v) => acc + v, 0n);
  const deadlineNum = campaignData?.deadline ? Number(campaignData.deadline) : 0;
  const countdown = useCountdown(deadlineNum);
  const campaignStatus: CampaignStatus = (campaignData?.state as CampaignStatus | undefined) ?? "PENDING";
  const hasParticipated = campaignData?.hasParticipated ?? false;
  const userChoice = campaignData?.userChoice !== undefined ? BigInt(campaignData.userChoice) : undefined;
  const winnerIndex = campaignData?.winningOptionIndex !== undefined ? BigInt(campaignData.winningOptionIndex) : undefined;
  const template = campaignData?.template;
  const participationLabel = getParticipationLabel(template, totalVotes);
  const outcomeLabel = getOutcomeLabel(template);
  const predictionTemplate = isPredictionTemplate(template);
  const participationWindowOpen = isParticipationWindowOpen(campaignStatus, template, deadlineNum);
  const canVote = mounted && isConnected && participationWindowOpen && !hasParticipated && !relaying && !submittedTx;
  const isCreator = mounted && !!userAddress && !!campaignData?.creator && userAddress.toLowerCase() === campaignData.creator.toLowerCase();
  const deadlineLockedCloseTemplates = ["PredictionLogicV2", "QuizLogic", "RaffleLogic", "PointsPoolLogic", "AuctionLogic"];
  const predictionCloseLocked = !!campaignData?.template && deadlineLockedCloseTemplates.includes(campaignData.template) && deadlineNum > 0 && deadlineNum > Math.floor(Date.now() / 1000);
  const closeUnlockLabel = predictionCloseLocked
    ? new Date(deadlineNum * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
  const closeableTemplates = ["PredictionLogicV2", "VotingLogicV2", "SurveyLogic", "QuizLogic", "RaffleLogic", "BountyLogic", "FanPassLogic", "PointsPoolLogic", "AuctionLogic"];
  const showCloseSection = isCreator && closeableTemplates.includes(campaignData?.template ?? "") && campaignStatus === "OPEN";
  const canClose = showCloseSection && !predictionCloseLocked;
  const revealWithOptionTemplates = ["PredictionLogicV2", "QuizLogic", "PointsPoolLogic"];
  const canReveal = isCreator && revealWithOptionTemplates.includes(campaignData?.template ?? "") && campaignStatus === "CLOSED";

  function handleExportProof() {
    const deadlineIso = deadlineNum > 0 ? new Date(deadlineNum * 1000).toISOString() : "open, no deadline";

    const proof = {
      exportedAt: new Date().toISOString(),
      generator: "ChainForge AI",
      network: {
        name: "WireFluid EVM",
        chainId: 92533,
        rpc: "https://evm.wirefluid.com",
        explorer: "https://wirefluidscan.com",
      },
      campaign: {
        address,
        title: campaignData?.title ?? "",
        template: campaignData?.template ?? "",
        creator: campaignData?.creator ?? "",
        status: campaignStatus,
        options,
        voteCounts: voteCounts.map((v) => v.toString()),
        totalVotes: totalVotes.toString(),
        deadline: campaignData?.deadline ?? "0",
        deadlineHuman: deadlineIso,
        winnerLabel: campaignData?.winnerLabel,
        winningOptionIndex: campaignData?.winningOptionIndex,
      },
      links: {
        contract: `https://wirefluidscan.com/address/${address}`,
        app: `${window.location.origin}/campaigns/${address}`,
      },
      ...(submittedTx
        ? {
            relayedTx: {
              hash: submittedTx,
              explorer: `https://wirefluidscan.com/tx/${submittedTx}`,
              note: "gas-sponsored interaction, submitted via ChainForge AI relayer",
            },
          }
        : {}),
      ...(lifecycleTx
        ? {
            lifecycleTx: {
              hash: lifecycleTx,
              explorer: `https://wirefluidscan.com/tx/${lifecycleTx}`,
            },
          }
        : {}),
    };

    const blob = new Blob([JSON.stringify(proof, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chainforge-proof-${address.slice(0, 8)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell min-h-screen px-4 sm:px-6 py-10 sm:py-12">
      <div className="max-w-5xl mx-auto motion-surface">
        <PageHeader
          backHref="/explore"
          backLabel="Back to Explore"
          eyebrow="Campaign"
          title={campaignData?.title ?? "Campaign"}
          description={(
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 font-mono break-all">{address}</span>
                <CopyButton text={address} />
              </div>
              <div className="text-sm">
                {campaignStatus === "PENDING" ? (
                  <span className="text-slate-500">Fetching campaign data…</span>
                ) : campaignStatus === "REVEALED" ? (
                  <span className="text-indigo-300">{outcomeLabel} revealed{campaignData?.winnerLabel ? `, ${campaignData.winnerLabel}` : ""}</span>
                ) : campaignStatus === "CLOSED" ? (
                  <span className="text-slate-400">
                    {campaignData?.template === "PredictionLogicV2" ? "Predictions closed, outcome pending" : "Participation closed"}
                  </span>
                ) : (
                  <span className="text-emerald-400">{countdown}</span>
                )}
              </div>
            </div>
          )}
          meta={(
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={campaignStatus} />
              {campaignData?.template && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {getTemplateLabel(campaignData.template)}
                </span>
              )}
            </div>
          )}
        />

        {campaignStatus === "REVEALED" && campaignData?.winnerLabel && (
          <div className="px-4 py-3 bg-indigo-950/40 border border-indigo-700 rounded-lg text-indigo-200 text-sm mb-6">
            {outcomeLabel}: <span className="font-semibold">{campaignData.winnerLabel}</span>
            {predictionTemplate && totalVotes === 0n && (
              <span className="ml-2 text-xs text-slate-300">No predictions were submitted before close.</span>
            )}
            {hasParticipated && userChoice !== undefined && winnerIndex !== undefined && (
              <span className="ml-2 text-xs text-slate-300">
                {userChoice === winnerIndex ? "You predicted correctly." : "Your pick did not win."}
              </span>
            )}
          </div>
        )}

        {(showCloseSection || canReveal || lifecycleTx || lifecycleError) && (
          <div className="mb-6 rounded-xl border border-indigo-700/50 bg-indigo-950/20 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Creator Controls</h2>
                <p className="text-xs text-slate-400">Signed actions route through the server owner wallet and are verified against the recorded creator address.</p>
                {campaignData?.creator && (
                  <Link href={`/manage/${campaignData.creator}`} className="text-xs text-indigo-400 hover:text-indigo-300 mt-0.5 inline-block">
                    View all your campaigns →
                  </Link>
                )}
              </div>
              {isCreator && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Creator
                </span>
              )}
            </div>

            {canReveal && (
              <div className="flex flex-col sm:flex-row gap-3 mb-3">
                <select
                  aria-label="Select winning option"
                  value={revealOption}
                  onChange={(e) => setRevealOption(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none"
                >
                  <option value="">Select winning option</option>
                  {options.map((option, index) => (
                    <option key={option} value={index}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleCreatorAction("reveal")}
                  disabled={lifecycleLoading || revealOption === ""}
                  className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {lifecycleLoading ? "Signing…" : "Reveal Result"}
                </button>
              </div>
            )}

            {showCloseSection && (
              predictionCloseLocked ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled
                    className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed opacity-50"
                  >
                    Close Campaign
                  </button>
                  <span className="text-xs text-amber-400">Opens after deadline · {closeUnlockLabel}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCreatorAction("close")}
                  disabled={lifecycleLoading}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {lifecycleLoading ? "Signing…" : campaignData?.template === "SurveyLogic" ? "Close Survey" : campaignData?.template === "FanPassLogic" ? "Close Event" : "Close Campaign"}
                </button>
              )
            )}

            {lifecycleTx && (
              <div className="mt-3 text-xs text-emerald-300">
                Lifecycle tx submitted: <a className="text-indigo-300 hover:text-indigo-200" href={`https://wirefluidscan.com/tx/${lifecycleTx}`} target="_blank" rel="noreferrer">{lifecycleTx}</a>
              </div>
            )}

            {lifecycleError && (
              <div className="mt-3 text-xs text-red-300">{lifecycleError}</div>
            )}
          </div>
        )}

        {options.length > 0 ? (
          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            {options.map((option, i) => (
              <OptionCard
                key={option}
                option={option}
                index={i}
                voteCount={voteCounts[i] ?? 0n}
                total={totalVotes}
                onVote={handleVote}
                disabled={!canVote}
                userChose={hasParticipated && userChoice === BigInt(i)}
                winner={winnerIndex !== undefined && winnerIndex === BigInt(i)}
                template={template}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            {[0, 1].map((i) => (
              <div key={i} className="flex-1 rounded-xl border-2 border-slate-700 bg-slate-800/40 p-5 animate-pulse">
                <div className="h-5 bg-slate-700 rounded w-3/4 mb-3" />
                <div className="h-4 bg-slate-700 rounded w-1/2 mb-4" />
                <div className="h-2 bg-slate-700 rounded w-full" />
              </div>
            ))}
          </div>
        )}

        {options.length > 0 && <VoteShareChart options={options} voteCounts={voteCounts} template={template} />}

        {campaignStatus === "OPEN" && !hasParticipated && participationWindowOpen && (
          <div className="mb-4 rounded-lg border border-cyan-700/40 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-200">
            <span className="font-semibold">How participation works:</span> choose an option, sign once with your wallet, and the relayer submits the transaction. You pay zero gas and your wallet is still recorded as the participant.
          </div>
        )}

        {mounted && !isConnected && (
          <button
            type="button"
            onClick={() => void handleConnectWallet()}
            className="w-full py-3 bg-[#6366F1] hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors mb-4"
          >
            Connect Wallet to Participate
          </button>
        )}

        {mounted && isConnected && campaignStatus === "OPEN" && !hasParticipated && !participationWindowOpen && (
          <div className="px-4 py-3 bg-amber-950/40 border border-amber-700 rounded-lg text-amber-300 text-sm mb-4">
            Deadline passed, waiting for the creator to close this campaign before the final state updates.
          </div>
        )}

        {mounted && isConnected && hasParticipated && !submittedTx && (
          <div className="px-4 py-3 bg-indigo-950/50 border border-indigo-700 rounded-lg text-indigo-300 text-sm mb-4">
            You chose <span className="font-semibold">{userChoice !== undefined ? options[Number(userChoice)] : "…"}</span>
          </div>
        )}

        {relaying && (
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-indigo-700/50 rounded-lg text-slate-300 text-sm mb-4">
            <Spinner />
            <span>Submitting via gas-sponsored relayer…</span>
          </div>
        )}

        {submittedTx && (
          <div
            className={`px-4 py-4 bg-emerald-950/40 border border-emerald-600 rounded-lg text-sm mb-4 transition-all duration-500 ${
              successVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-emerald-500 text-white text-[10px] font-bold">✓</span>
              </span>
              <p className="text-emerald-300 font-semibold">
                Interaction submitted, you chose <span className="font-bold">{selectedOption !== null ? options[selectedOption] : ""}</span>
              </p>
            </div>
            <p className="text-xs text-purple-400 mb-2 ml-6">gas-sponsored, you paid zero gas</p>
            <p className="text-slate-400 text-xs mb-2 ml-6 font-mono break-all">Tx: {submittedTx}</p>
            <a
              href={`https://wirefluidscan.com/tx/${submittedTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-6 text-xs text-indigo-400 hover:text-indigo-300"
            >
              View on WireFluidScan
            </a>
          </div>
        )}

        {relayError && (
          <div className="px-4 py-3 bg-red-950/40 border border-red-700 rounded-lg text-red-300 text-sm mb-4">
            {relayError}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap gap-4 items-center text-sm text-slate-500">
          <span>Total {participationLabel}: <span className="text-slate-300">{totalVotes.toString()}</span></span>
          {campaignStatus === "OPEN" && (
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live
            </span>
          )}
          <span>
            <a
              href={`https://wirefluidscan.com/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300"
            >
              Explorer
            </a>
          </span>

          {campaignData && (
            <button
              type="button"
              onClick={handleExportProof}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-medium transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2v8m0 0-3-3m3 3 3-3M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export Proof
            </button>
          )}
        </div>
      </div>
    </main>
  );
}















