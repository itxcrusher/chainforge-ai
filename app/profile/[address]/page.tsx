import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getProfileSummary } from "@/lib/reputation/reputation";

export const dynamic = "force-dynamic";

function MetricCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
      {note && <div className="text-xs text-slate-600 mt-1">{note}</div>}
    </div>
  );
}

function ResultBadge({ result }: { result?: string }) {
  const classes: Record<string, string> = {
    correct: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
    wrong: "bg-rose-950/60 text-rose-300 border-rose-700",
    pending: "bg-amber-950/60 text-amber-300 border-amber-700",
    participated: "bg-slate-800 text-slate-300 border-slate-700",
  };

  const label = result === "correct"
    ? "Correct"
    : result === "wrong"
    ? "Wrong"
    : result === "pending"
    ? "Pending"
    : "Participated";

  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${classes[result ?? "participated"]}`}>{label}</span>;
}

export default async function ProfilePage({ params }: { params: { address: string } }) {
  const profile = await getProfileSummary(params.address);

  return (
    <main className="app-shell min-h-screen px-4 sm:px-6 py-10 sm:py-12">
      <div className="max-w-5xl mx-auto motion-surface">
        <PageHeader
          backHref="/explore"
          backLabel="Back to Explore"
          eyebrow="Fan Reputation"
          title="Profile"
          description={<span className="font-mono break-all">{profile.address}</span>}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Accuracy" value={`${profile.accuracyPct}%`} note="resolved predictions only" />
          <MetricCard label="Predictions" value={profile.totalPredictions} />
          <MetricCard label="Correct" value={profile.correctPredictions} />
          <MetricCard label="Current Streak" value={profile.currentStreak} />
          <MetricCard label="Pending" value={profile.pendingPredictions} />
          <MetricCard label="Wrong" value={profile.wrongPredictions} />
          <MetricCard label="Active" value={profile.activeParticipations} note="campaigns still open" />
          <MetricCard label="Total Participation" value={profile.totalParticipations} />
        </div>

        <div className="glass rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-white">Participation History</h2>
              <p className="text-sm text-slate-500">Predictions, votes, and surveys linked to current lifecycle state.</p>
            </div>
            <Link href="/leaderboard" className="text-sm text-indigo-400 hover:text-indigo-300">View Leaderboard →</Link>
          </div>

          {profile.history.length === 0 ? (
            <p className="text-sm text-slate-500">No on-chain participation found for this address yet.</p>
          ) : (
            <div className="space-y-3">
              {profile.history.map((item) => (
                <div key={`${item.address}-${item.selectedOption}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <div>
                      <h3 className="text-white font-semibold text-sm">{item.title}</h3>
                      <p className="text-xs text-slate-500">{item.template} · {item.state}</p>
                    </div>
                    <ResultBadge result={item.result} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Your choice</p>
                      <p className="text-slate-200">{item.selectedOption}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Outcome</p>
                      <p className="text-slate-200">{item.outcomeLabel ?? "Pending"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Campaign</p>
                      <Link href={`/campaigns/${item.address}`} className="text-indigo-400 hover:text-indigo-300 font-mono text-xs break-all">
                        {item.address}
                      </Link>
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

