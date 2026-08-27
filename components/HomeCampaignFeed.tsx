"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ExploreCampaign } from "@/app/api/explore/route";
import { getParticipationLabel, getOutcomeLabel } from "@/lib/campaigns/templateLabels";

type CampaignStatus = "OPEN" | "CLOSED" | "REVEALED";

function inferStatus(campaign: ExploreCampaign): CampaignStatus {
  if (campaign.state === "REVEALED") return "REVEALED";
  if (campaign.state === "CLOSED") return "CLOSED";
  const deadline = BigInt(campaign.deadline ?? "0");
  if (deadline === 0n) return "OPEN";
  return BigInt(Math.floor(Date.now() / 1000)) < deadline ? "OPEN" : "CLOSED";
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const styles: Record<CampaignStatus, string> = {
    OPEN: "bg-emerald-900/50 text-emerald-300 border-emerald-700/60",
    CLOSED: "bg-slate-800 text-slate-300 border-slate-700",
    REVEALED: "bg-indigo-900/50 text-indigo-300 border-indigo-700/60",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function HomeCampaignFeed() {
  const [campaigns, setCampaigns] = useState<ExploreCampaign[]>([]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/explore", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as ExploreCampaign[];
      setCampaigns(data.slice(0, 3));
    } catch {
      // keep last good state on screen
    }
  }, []);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    const interval = setInterval(() => void fetchCampaigns(), 30_000);
    return () => clearInterval(interval);
  }, [fetchCampaigns]);

  const renderedCampaigns = useMemo(() => {
    return campaigns.map((campaign) => {
      const status = inferStatus(campaign);
      const totalParticipation = campaign.voteCounts.reduce((sum, value) => sum + BigInt(value), 0n);
      return {
        ...campaign,
        status,
        totalParticipation,
      };
    });
  }, [campaigns]);

  if (renderedCampaigns.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="glass rounded-2xl border border-white/8 p-5 animate-pulse">
            <div className="mb-4 h-5 w-20 rounded-full bg-white/10" />
            <div className="mb-3 h-5 w-3/4 rounded bg-white/10" />
            <div className="mb-6 h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-1/2 rounded bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {renderedCampaigns.map((campaign) => (
        <Link
          key={campaign.address}
          href={`/campaigns/${campaign.address}`}
          className="glass glass-hover rounded-2xl border border-white/8 p-5 transition-all hover:-translate-y-0.5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={campaign.status} />
              {campaign.template && (
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  {campaign.template.replace("LogicV2", "").replace("Logic", "")}
                </span>
              )}
            </div>
            <span className="font-mono text-[11px] text-slate-600">
              {campaign.address.slice(0, 6)}…{campaign.address.slice(-4)}
            </span>
          </div>

          <h3 className="mb-3 text-base font-semibold leading-snug text-white">
            {campaign.title}
          </h3>

          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            {campaign.status === "REVEALED" && campaign.winnerLabel
              ? `${getOutcomeLabel(campaign.template)}: ${campaign.winnerLabel}`
              : `${campaign.totalParticipation.toString()} ${getParticipationLabel(campaign.template, campaign.totalParticipation)} recorded on-chain.`}
          </p>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {campaign.options.length} option{campaign.options.length === 1 ? "" : "s"}
            </span>
            <span className="text-indigo-300">Open campaign →</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
