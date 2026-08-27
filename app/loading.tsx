export default function GlobalLoading() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-transparent px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center pt-20 text-center">
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-indigo-500/20 bg-indigo-500/10 blur-xl" />
          <div className="h-16 w-16 animate-spin rounded-full border-2 border-white/10 border-t-pink-300 border-r-orange-300" />
          <div className="absolute h-5 w-5 rounded-full bg-gradient-to-br from-pink-300 to-orange-300 shadow-[0_0_24px_rgba(251,146,60,0.35)]" />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Loading</p>
        <h1 className="mb-3 text-2xl font-semibold text-white">Bringing the next view on-chain</h1>
        <p className="max-w-md text-sm leading-relaxed text-slate-400">
          Fetching campaign state, leaderboard data, and live proof so the next page opens with the latest verified information.
        </p>
      </div>
    </main>
  );
}
