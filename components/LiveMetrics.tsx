"use client";

import { useEffect, useState, useCallback } from "react";
import type { ExploreCampaign } from "@/app/api/explore/route";

interface Metrics {
  totalCampaigns: number;
  liveCampaigns: number;
  settledCampaigns: number;
  totalVotes: bigint;
}

type CampaignStatus = "OPEN" | "CLOSED" | "REVEALED";

function inferStatus(campaign: ExploreCampaign): CampaignStatus {
  if (campaign.state === "REVEALED") return "REVEALED";
  if (campaign.state === "CLOSED") return "CLOSED";
  const deadline = BigInt(campaign.deadline ?? "0");
  if (deadline === 0n) return "OPEN";
  return BigInt(Math.floor(Date.now() / 1000)) < deadline ? "OPEN" : "CLOSED";
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: "indigo" | "emerald" | "amber";
}) {
  const color =
    accent === "indigo"
      ? "text-indigo-300"
      : accent === "emerald"
      ? "text-emerald-300"
      : accent === "amber"
      ? "text-amber-300"
      : "text-white";

  return (
    <div className="flex min-w-[110px] flex-col items-center gap-1 px-5 py-2 text-center">
      <span className={`text-3xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[11px] text-slate-500 uppercase tracking-[0.22em]">{label}</span>
    </div>
  );
}

export default function LiveMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/explore", { cache: "no-store" });
      if (!res.ok) return;
      const campaigns = await res.json() as ExploreCampaign[];
      const liveCampaigns = campaigns.filter((campaign) => inferStatus(campaign) === "OPEN").length;
      const settledCampaigns = campaigns.filter((campaign) => inferStatus(campaign) !== "OPEN").length;
      const totalVotes = campaigns.reduce((acc, campaign) => {
        return acc + campaign.voteCounts.reduce((sum, value) => sum + BigInt(value), 0n);
      }, 0n);
      setMetrics({
        totalCampaigns: campaigns.length,
        liveCampaigns,
        settledCampaigns,
        totalVotes,
      });
    } catch {
      // keep last good metrics on screen
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    const interval = setInterval(() => void fetchMetrics(), 30_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (!metrics) {
    return (
      <div className="mt-10 flex justify-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-4 backdrop-blur-xl">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex min-w-[110px] flex-col items-center gap-2 px-5 py-2">
              <div className="h-8 w-14 shimmer rounded" />
              <div className="h-3 w-20 shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10 flex justify-center">
      <div className="inline-flex flex-wrap items-center justify-center divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 backdrop-blur-xl sm:divide-x sm:divide-y-0">
        <Stat value={metrics.totalCampaigns.toString()} label="Campaigns" accent="indigo" />
        <Stat value={metrics.liveCampaigns.toString()} label="Live Now" accent={metrics.liveCampaigns > 0 ? "emerald" : undefined} />
        <Stat value={metrics.settledCampaigns.toString()} label="Closed or Revealed" accent={metrics.settledCampaigns > 0 ? "amber" : undefined} />
        <Stat value={metrics.totalVotes.toString()} label="Participation" />
      </div>
    </div>
  );
}
