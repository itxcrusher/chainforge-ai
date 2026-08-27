"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import type { ExploreCampaign } from "@/lib/data/getCampaigns";
import { getOutcomeLabel, getParticipationLabel, getTemplateLabel, TEMPLATE_FILTERS } from "@/lib/campaigns/templateLabels";

type CampaignStatus = "OPEN" | "CLOSED" | "REVEALED";
type FilterTab = "ALL" | "OPEN" | "CLOSING_SOON" | "CLOSED" | "REVEALED";
type TemplateFilter = "ALL" | (typeof TEMPLATE_FILTERS)[number]["key"];

function inferStatus(campaign: ExploreCampaign): CampaignStatus {
  if (campaign.state === "REVEALED") return "REVEALED";
  if (campaign.state === "CLOSED") return "CLOSED";
  // For OPEN state always recheck the deadline — it may have passed since last cache
  const d = BigInt(campaign.deadline ?? "0");
  if (d === 0n) return "OPEN"; // no deadline set
  return BigInt(Math.floor(Date.now() / 1000)) < d ? "OPEN" : "CLOSED";
}

function isClosingSoon(campaign: ExploreCampaign) {
  const status = inferStatus(campaign);
  if (status !== "OPEN") return false;
  const deadline = BigInt(campaign.deadline);
  if (deadline === 0n) return false;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const remaining = deadline - now;
  return remaining > 0n && remaining <= 21600n;
}

function formatCountdown(deadline: string) {
  const d = BigInt(deadline);
  if (d === 0n) return "Open-ended";
  const remaining = Number(d - BigInt(Math.floor(Date.now() / 1000)));
  if (remaining <= 0) return "Deadline passed";
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  return `${h}h ${m}m left`;
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  if (status === "OPEN") {
    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-900/60 text-emerald-400 border border-emerald-700">
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
      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-900/50 text-indigo-300 border border-indigo-700">
        REVEALED
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
      CLOSED
    </span>
  );
}

function VoteBar({ label, count, total, winner }: { label: string; count: bigint; total: bigint; winner?: boolean }) {
  const pct = total > 0n ? Number((count * 100n) / total) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400 gap-2">
        <span className="truncate max-w-[70%]">
          {label}
          {winner && <span className="ml-1 text-indigo-300 font-semibold">• winner</span>}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${winner ? "bg-indigo-400" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TemplateBadge({ template }: { template?: string }) {
  if (!template) return null;
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
      {getTemplateLabel(template)}
    </span>
  );
}

function CampaignCard({ campaign }: { campaign: ExploreCampaign }) {
  const status = inferStatus(campaign);
  const voteCounts = campaign.voteCounts.map(BigInt);
  const totalVotes = voteCounts.reduce((acc, v) => acc + v, 0n);
  const winnerIndex = campaign.winnerLabel ? campaign.options.findIndex((option) => option === campaign.winnerLabel) : -1;
  const outcomeLabel = getOutcomeLabel(campaign.template);
  const participationLabel = getParticipationLabel(campaign.template, totalVotes);

  return (
    <Link
      href={`/campaigns/${campaign.address}`}
      className="group block glass glass-hover rounded-2xl p-5 transition-all hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <StatusBadge status={status} />
            <TemplateBadge template={campaign.template} />
          </div>
          <h2 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors leading-snug">
            {campaign.title}
          </h2>
        </div>
      </div>

      {status === "OPEN" && isClosingSoon(campaign) && (
        <div className="mb-3 text-xs text-amber-300 border border-amber-700/50 bg-amber-950/20 rounded-lg px-3 py-2">
          Closing soon · {formatCountdown(campaign.deadline)}
        </div>
      )}

      {status === "REVEALED" && campaign.winnerLabel && (
        <div className="mb-3 text-xs text-indigo-200 border border-indigo-700/50 bg-indigo-950/20 rounded-lg px-3 py-2">
          {outcomeLabel}: <span className="font-semibold">{campaign.winnerLabel}</span>
        </div>
      )}

      <div className="space-y-3 mb-4">
        {campaign.options.map((opt, i) => (
          <VoteBar
            key={opt}
            label={opt}
            count={voteCounts[i] ?? 0n}
            total={totalVotes}
            winner={winnerIndex === i}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 mt-3">
        <span>{totalVotes.toString()} {participationLabel}</span>
        <span className="font-mono truncate max-w-[55%] text-slate-600">
          {campaign.address.slice(0, 6)}…{campaign.address.slice(-4)}
        </span>
      </div>

      {campaign.creator && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-600 font-mono">
          by {campaign.creator.slice(0, 6)}…{campaign.creator.slice(-4)}
        </div>
      )}
    </Link>
  );
}

export default function ExploreClient({
  initialCampaigns,
}: {
  initialCampaigns: ExploreCampaign[];
}) {
  const [campaigns, setCampaigns] = useState<ExploreCampaign[]>(initialCampaigns);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [templateFilter, setTemplateFilter] = useState<TemplateFilter>("ALL");

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/explore", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as ExploreCampaign[];
      if (data.length === 0 && campaigns.length > 0) return;
      setCampaigns(data);
      setLastRefresh(new Date());
    } catch {
      // keep existing data on error
    }
  }, [campaigns.length]);

  useEffect(() => {
    const interval = setInterval(fetchCampaigns, 30_000);
    return () => clearInterval(interval);
  }, [fetchCampaigns]);

  const statusCounts = useMemo(() => {
    const open = campaigns.filter((c) => inferStatus(c) === "OPEN").length;
    const closed = campaigns.filter((c) => inferStatus(c) === "CLOSED").length;
    const revealed = campaigns.filter((c) => inferStatus(c) === "REVEALED").length;
    const closingSoon = campaigns.filter((c) => isClosingSoon(c)).length;
    return { open, closed, revealed, closingSoon };
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    let list = campaigns;
    // Status filter
    switch (activeTab) {
      case "OPEN":       list = list.filter((c) => inferStatus(c) === "OPEN"); break;
      case "CLOSING_SOON": list = list.filter((c) => isClosingSoon(c)); break;
      case "CLOSED":     list = list.filter((c) => inferStatus(c) === "CLOSED"); break;
      case "REVEALED":   list = list.filter((c) => inferStatus(c) === "REVEALED"); break;
    }
    // Template filter
    if (templateFilter !== "ALL") {
      list = list.filter((c) => c.template === templateFilter);
    }
    return list;
  }, [activeTab, templateFilter, campaigns]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: campaigns.length },
    { key: "OPEN", label: "Live", count: statusCounts.open },
    { key: "CLOSING_SOON", label: "Closing Soon", count: statusCounts.closingSoon },
    { key: "CLOSED", label: "Closed", count: statusCounts.closed },
    { key: "REVEALED", label: "Revealed", count: statusCounts.revealed },
  ];

  return (
    <main className="app-shell min-h-screen px-4 sm:px-6 py-10 sm:py-12">
      <div className="max-w-5xl mx-auto motion-surface">
        <PageHeader
          eyebrow="Flagship Demo · the demo league Campaigns"
          title="Explore"
          description="Discover deployed ChainForge campaigns by lifecycle state and template type."
        />

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2 mb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                  : "bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
            >
              {tab.label} <span className="text-xs opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Template type filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {([{ key: "ALL" as TemplateFilter, label: "All types" }, ...TEMPLATE_FILTERS]).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setTemplateFilter(f.key)}
              className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                templateFilter === f.key
                  ? "bg-slate-700 text-slate-200 border-slate-500"
                  : "bg-transparent text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="text-slate-500 text-sm">
            No campaigns in this state yet. {activeTab === "ALL" ? (
              <Link href="/builder" className="text-indigo-400 hover:text-indigo-300">
                Create the first one →
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCampaigns.map((c) => (
              <CampaignCard key={c.address} campaign={c} />
            ))}
          </div>
        )}

        <p className="mt-8 text-xs text-slate-600 text-right">
          {lastRefresh
            ? `Last updated ${lastRefresh.toLocaleTimeString()} · auto-refreshes every 30s`
            : "Data loaded server-side · auto-refreshes every 30s"}
        </p>
      </div>
    </main>
  );
}


