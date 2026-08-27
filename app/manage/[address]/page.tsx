"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { useActionOverlay } from "@/components/ActionOverlay";
import { injected } from "wagmi/connectors";
import { buildCreatorActionMessage } from "@/lib/contracts/creatorActions";
import { useToast } from "@/components/Toasts";
import type { CampaignData } from "@/lib/cache/campaignCache";
import { getOutcomeLabel, getParticipationLabel } from "@/lib/campaigns/templateLabels";

type CampaignStatus = "OPEN" | "CLOSED" | "REVEALED" | "PENDING";

interface ManagedCampaign {
  address: string;
  data: CampaignData | null;
  loading: boolean;
  lifecycleLoading: boolean;
  lifecycleTx: string | null;
  lifecycleError: string | null;
  revealOption: string;
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const classes: Record<CampaignStatus, string> = {
    OPEN: "bg-emerald-900/60 text-emerald-400 border-emerald-700",
    CLOSED: "bg-slate-800 text-slate-400 border-slate-700",
    REVEALED: "bg-indigo-900/50 text-indigo-300 border-indigo-700",
    PENDING: "bg-amber-900/50 text-amber-400 border-amber-700",
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${classes[status]}`}>
      {status}
    </span>
  );
}

interface PageProps {
  params: { address: string };
}

export default function ManagePage({ params }: PageProps) {
  const creatorAddress = params.address as `0x${string}`;
  const { address: connectedAddress } = useAccount();
  const { connectAsync } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const { showOverlay, hideOverlay } = useActionOverlay();

  const [campaigns, setCampaigns] = useState<ManagedCampaign[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  async function handleConnectWallet() {
    showOverlay("Connect wallet", "Approve the wallet connection request to continue.");
    try {
      await connectAsync({ connector: injected() });
    } finally {
      hideOverlay();
    }
  }

  const isOwner =
    !!connectedAddress &&
    connectedAddress.toLowerCase() === creatorAddress.toLowerCase();

  // ─── Fetch creator campaign list from /api/manage ────────────────────────
  const fetchCampaignList = useCallback(async () => {
    try {
      const res = await fetch(`/api/manage?creator=${creatorAddress}`, { cache: "no-store" });
      if (!res.ok) return;
      const { campaigns: addrs } = (await res.json()) as { campaigns: string[] };
      setCampaigns((prev) =>
        addrs.map((addr) => {
          const existing = prev.find((campaign) => campaign.address === addr);
          return {
            address: addr,
            data: existing?.data ?? null,
            loading: true,
            lifecycleLoading: false,
            lifecycleTx: existing?.lifecycleTx ?? null,
            lifecycleError: null,
            revealOption: existing?.revealOption ?? "",
          };
        })
      );
    } catch {
      // non-fatal
    } finally {
      setLoadingList(false);
    }
  }, [creatorAddress]);

  const fetchCampaignData = useCallback(async (campaignAddr: string) => {
    try {
      const res = await fetch(`/api/campaigns?address=${campaignAddr}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to refresh campaign");
      const data = (await res.json()) as CampaignData;
      setCampaigns((prev) =>
        prev.map((campaign) =>
          campaign.address === campaignAddr
            ? {
                ...campaign,
                data,
                loading: false,
                lifecycleLoading: false,
                lifecycleError: null,
              }
            : campaign
        )
      );
    } catch {
      setCampaigns((prev) =>
        prev.map((campaign) =>
          campaign.address === campaignAddr ? { ...campaign, loading: false } : campaign
        )
      );
    }
  }, []);

  const refreshAllCampaigns = useCallback(async () => {
    setLoadingList(true);
    await fetchCampaignList();
  }, [fetchCampaignList]);

  useEffect(() => {
    void fetchCampaignList();
  }, [fetchCampaignList]);

  const pendingCampaignAddresses = campaigns
    .filter((campaign) => campaign.loading)
    .map((campaign) => campaign.address)
    .join("|");

  // ─── Fetch each campaign's data from /api/campaigns ──────────────────────
  useEffect(() => {
    if (!pendingCampaignAddresses) return;
    pendingCampaignAddresses.split("|").forEach((campaignAddr) => {
      if (campaignAddr) {
        void fetchCampaignData(campaignAddr);
      }
    });
  }, [fetchCampaignData, pendingCampaignAddresses]);

  // ─── Creator action (close / reveal) ─────────────────────────────────────
  async function handleLifecycleAction(
    campaignAddr: string,
    action: "close" | "reveal",
    winnerIndex?: number
  ) {
    if (!connectedAddress) return;

    setCampaigns((prev) =>
      prev.map((c) =>
        c.address === campaignAddr
          ? { ...c, lifecycleLoading: true, lifecycleError: null }
          : c
      )
    );

    try {
      const message = buildCreatorActionMessage(
        campaignAddr as `0x${string}`,
        action,
        winnerIndex
      );
      showOverlay(action === "close" ? "Confirm close" : "Confirm reveal", action === "close" ? "Approve the signature request in your wallet to close this campaign." : "Approve the signature request in your wallet to reveal the result.");
      const signature = await signMessageAsync({ message });

      showOverlay(action === "close" ? "Closing campaign" : "Revealing result", "Submitting the lifecycle transaction on-chain. This can take a few seconds.");
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: campaignAddr,
          requesterAddress: connectedAddress,
          signature,
          action,
          winnerIndex,
        }),
      });

      const result = (await res.json()) as { txHash?: string; error?: string };

      if (!res.ok || !result.txHash) {
        const msg = result.error ?? "Action failed";
        setCampaigns((prev) =>
          prev.map((c) =>
            c.address === campaignAddr
              ? { ...c, lifecycleLoading: false, lifecycleError: msg }
              : c
          )
        );
        toast("error", msg);
        return;
      }

      setCampaigns((prev) =>
        prev.map((c) =>
          c.address === campaignAddr
            ? { ...c, lifecycleLoading: false, lifecycleTx: result.txHash!, loading: true, lifecycleError: null }
            : c
        )
      );
      toast(
        "success",
        action === "close" ? "Campaign closed on-chain" : "Result revealed on-chain"
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signature or network error";
      setCampaigns((prev) =>
        prev.map((c) =>
          c.address === campaignAddr
            ? { ...c, lifecycleLoading: false, lifecycleError: msg }
            : c
        )
      );
      toast("error", msg);
    } finally {
      hideOverlay();
    }
  }

  const explorerBase = "https://wirefluidscan.com";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="app-shell min-h-screen px-4 sm:px-6 py-10 sm:py-12">
      <div className="max-w-5xl mx-auto motion-surface">
        <PageHeader
          backHref="/explore"
          backLabel="Back to Explore"
          eyebrow="Creator Tools"
          title="Creator Dashboard"
          description={<span className="font-mono break-all">{creatorAddress}</span>}
          actions={(
            <button
              type="button"
              onClick={() => void refreshAllCampaigns()}
              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
            >
              Refresh campaigns
            </button>
          )}
        />

        {!connectedAddress && (
          <div className="mb-8 rounded-xl border border-slate-700 bg-slate-800/40 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div>
              <p className="text-sm text-slate-300 font-semibold">Connect your wallet</p>
              <p className="text-xs text-slate-500">You must be connected as the creator to use lifecycle controls.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleConnectWallet()}
              className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {connectedAddress && !isOwner && (
          <div className="mb-8 rounded-xl border border-amber-700/50 bg-amber-950/20 p-4 text-sm text-amber-300">
            Connected as <span className="font-mono">{connectedAddress.slice(0, 8)}…</span>. Lifecycle controls are only active for the creator address shown above.
          </div>
        )}

        {loadingList ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/2 mb-3" />
                <div className="h-3 bg-slate-700 rounded w-full" />
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-slate-500">
            <p className="text-sm">No campaigns found for this creator address.</p>
            <Link href="/builder" className="mt-4 inline-block text-indigo-400 hover:text-indigo-300 text-sm">
              Go to Builder →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => {
              const status = (c.data?.state ?? "PENDING") as CampaignStatus;
              const template = c.data?.template ?? "";
              const options = c.data?.options ?? [];
              const voteCounts = (c.data?.voteCounts ?? []).map(Number);
              const totalVotes = voteCounts.reduce((a, b) => a + b, 0);
              const outcomeLabel = getOutcomeLabel(template);

              const deadline = BigInt(c.data?.deadline ?? "0");
              const now = BigInt(Math.floor(Date.now() / 1000));
              const isPrediction = template === "PredictionLogicV2";
              const deadlineNotPassed = isPrediction && deadline > 0n && now < deadline;
              const deadlineDate = deadline > 0n
                ? new Date(Number(deadline) * 1000).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })
                : null;

              const showCloseSection =
                isOwner &&
                status === "OPEN" &&
                ["PredictionLogicV2", "VotingLogicV2", "SurveyLogic"].includes(template);

              const canClose = showCloseSection && !deadlineNotPassed;

              const canReveal =
                isOwner &&
                status === "CLOSED" &&
                template === "PredictionLogicV2";

              return (
                <div
                  key={c.address}
                  className="glass rounded-xl p-5 flex flex-col gap-4"
                >
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={status} />
                    {template && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {template}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-xs text-slate-600 truncate max-w-[160px]">
                      {c.address}
                    </span>
                  </div>

                  {c.loading ? (
                    <div className="h-5 bg-slate-700 rounded w-2/3 animate-pulse" />
                  ) : (
                    <h2 className="text-white font-semibold text-base leading-snug">
                      {c.data?.title ?? "(unknown title)"}
                    </h2>
                  )}

                  {/* Vote breakdown */}
                  {!c.loading && options.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {options.map((opt, i) => {
                        const pct = totalVotes > 0 ? Math.round((voteCounts[i] / totalVotes) * 100) : 0;
                        return (
                          <div key={opt} className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{opt}</span>
                            <span className="text-xs text-slate-200 font-semibold">{voteCounts[i]} {getParticipationLabel(template, voteCounts[i])} ({pct}%)</span>
                          </div>
                        );
                      })}
                      <span className="text-xs text-slate-600 ml-auto">{totalVotes} total {getParticipationLabel(template, totalVotes)}</span>
                    </div>
                  )}

                  {/* Revealed result */}
                  {status === "REVEALED" && c.data?.winnerLabel && (
                    <div className="text-xs text-indigo-300 font-semibold">
                      {outcomeLabel}: {c.data.winnerLabel}
                    </div>
                  )}

                  {/* Lifecycle controls */}
                  {(showCloseSection || canReveal) && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/50">
                      {canReveal && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            aria-label="Select winning option"
                            value={c.revealOption}
                            onChange={(e) =>
                              setCampaigns((prev) =>
                                prev.map((p) =>
                                  p.address === c.address
                                    ? { ...p, revealOption: e.target.value }
                                    : p
                                )
                              )
                            }
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none"
                          >
                            <option value="">Select winning option</option>
                            {options.map((opt, i) => (
                              <option key={opt} value={String(i)}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={c.lifecycleLoading || c.revealOption === ""}
                            onClick={() =>
                              handleLifecycleAction(
                                c.address,
                                "reveal",
                                Number(c.revealOption)
                              )
                            }
                            className="shrink-0 rounded-lg bg-indigo-500 hover:bg-indigo-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {c.lifecycleLoading ? "Signing…" : "Reveal Result"}
                          </button>
                        </div>
                      )}

                      {showCloseSection && (
                        deadlineNotPassed ? (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              disabled
                              className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed w-fit opacity-50"
                            >
                              Close Campaign
                            </button>
                            <span className="text-xs text-amber-400">
                              Opens after deadline · {deadlineDate}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={c.lifecycleLoading}
                            onClick={() => handleLifecycleAction(c.address, "close")}
                            className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed w-fit"
                          >
                            {c.lifecycleLoading
                              ? "Signing…"
                              : template === "SurveyLogic"
                              ? "Close Survey"
                              : "Close Campaign"}
                          </button>
                        )
                      )}

                      {c.lifecycleError && (
                        <p className="text-xs text-red-300">{c.lifecycleError}</p>
                      )}

                      {c.lifecycleTx && (
                        <a
                          href={`${explorerBase}/tx/${c.lifecycleTx}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          Tx submitted → {c.lifecycleTx.slice(0, 16)}…
                        </a>
                      )}
                    </div>
                  )}

                  {/* Footer links */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                    <Link
                      href={`/campaigns/${c.address}`}
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      View campaign →
                    </Link>
                    <a
                      href={`${explorerBase}/address/${c.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-slate-300"
                    >
                      Explorer
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}



