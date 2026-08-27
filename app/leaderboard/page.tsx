import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getLeaderboard } from "@/lib/reputation/reputation";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const entries = await getLeaderboard();

  return (
    <main className="app-shell min-h-screen px-4 sm:px-6 py-10 sm:py-12">
      <div className="max-w-5xl mx-auto motion-surface">
        <PageHeader
          backHref="/explore"
          backLabel="Back to Explore"
          eyebrow="Fan Reputation"
          title="Leaderboard"
          description="Top predictors by resolved accuracy. Minimum 1 prediction to qualify."
        />

        <div className="glass rounded-2xl p-6">
          {entries.length === 0 ? (
            <div className="text-sm text-slate-500">
              No addresses qualify yet. Once users submit at least 1 prediction, ranking will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.address} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-sm">
                      #{entry.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${entry.address}`} className="text-sm text-white hover:text-indigo-300 font-mono break-all">
                        {entry.address}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {entry.correctPredictions} correct · {entry.wrongPredictions} wrong · {entry.pendingPredictions} pending
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center sm:text-right w-full sm:w-auto shrink-0">
                    <div>
                      <div className="text-base sm:text-lg font-bold text-white">{entry.accuracyPct}%</div>
                      <div className="text-xs text-slate-500">Accuracy</div>
                    </div>
                    <div>
                      <div className="text-base sm:text-lg font-bold text-white">{entry.totalPredictions}</div>
                      <div className="text-xs text-slate-500">Predictions</div>
                    </div>
                    <div>
                      <div className="text-base sm:text-lg font-bold text-white">{entry.correctPredictions}</div>
                      <div className="text-xs text-slate-500">Correct</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}


