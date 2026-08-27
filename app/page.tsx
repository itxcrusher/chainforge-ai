import Link from "next/link";
import LiveMetrics from "@/components/LiveMetrics";
import HomeCampaignFeed from "@/components/HomeCampaignFeed";

function PromptIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChainIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function RelayIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function ProofIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

const HOW_IT_WORKS = [
  {
    step: "01",
    Icon: PromptIcon,
    title: "Describe the experience",
    desc: "Write what you want to build in plain English, no technical knowledge required. The AI Architect turns your idea into a structured on-chain plan.",
    color: "text-cyan-300",
  },
  {
    step: "02",
    Icon: ChainIcon,
    title: "Deploy your app on-chain",
    desc: "Connect your wallet and deploy. ChainForge AI mints a dedicated smart contract on WireFluid with your address recorded as the creator.",
    color: "text-indigo-300",
  },
  {
    step: "03",
    Icon: RelayIcon,
    title: "Your users participate gas-free",
    desc: "Fans sign once to prove identity. ChainForge AI's relayer covers the gas, so users need zero crypto to interact with your app.",
    color: "text-emerald-300",
  },
  {
    step: "04",
    Icon: ProofIcon,
    title: "Every outcome lives on-chain forever",
    desc: "Close the app, reveal results, and share a permanent proof link. Every state change is a real on-chain transaction anyone can verify.",
    color: "text-violet-300",
  },
];

const TEMPLATE_CARDS = [
  {
    name: "Prediction Markets",
    state: "OPEN → CLOSED → REVEALED",
    tone: "bg-indigo-500/10 border-indigo-400/20 text-indigo-200",
    bullets: [
      "Set an event and let fans pick a side",
      "Reveal the real outcome after close",
    ],
  },
  {
    name: "Fan Votes",
    state: "OPEN → CLOSED",
    tone: "bg-cyan-500/10 border-cyan-400/20 text-cyan-200",
    bullets: [
      "Community vote your audience actually trusts",
      "Deadline-based or creator-controlled",
    ],
  },
  {
    name: "Audience Surveys",
    state: "OPEN → CLOSED",
    tone: "bg-emerald-500/10 border-emerald-400/20 text-emerald-200",
    bullets: [
      "Collect honest, uneditable audience feedback",
      "Open as long as you want, close when you're done",
    ],
  },
  {
    name: "On-Chain Quiz",
    state: "OPEN → CLOSED → REVEALED",
    tone: "bg-amber-500/10 border-amber-400/20 text-amber-200",
    bullets: [
      "Creator posts trivia, fans answer on-chain",
      "Creator reveals the correct answer after close",
    ],
  },
  {
    name: "Raffle",
    state: "OPEN → CLOSED → REVEALED",
    tone: "bg-purple-500/10 border-purple-400/20 text-purple-200",
    bullets: [
      "Fans enter by submitting their address",
      "Winner selected via tamper-proof on-chain randomness",
    ],
  },
  {
    name: "Bounty",
    state: "OPEN → CLOSED → REVEALED",
    tone: "bg-orange-500/10 border-orange-400/20 text-orange-200",
    bullets: [
      "Post a challenge, fans register interest on-chain",
      "Creator picks the winner, attribution is permanent",
    ],
  },
  {
    name: "Fan Pass",
    state: "OPEN → CLOSED",
    tone: "bg-rose-500/10 border-rose-400/20 text-rose-200",
    bullets: [
      "Tiered soulbound access passes with supply caps",
      "Wallet-bound, non-transferable, gasless claims",
    ],
  },
  {
    name: "Points Pool",
    state: "OPEN → CLOSED → REVEALED",
    tone: "bg-teal-500/10 border-teal-400/20 text-teal-200",
    bullets: [
      "Reputation-weighted prediction pool",
      "Points tracked on-chain per wallet, no real money",
    ],
  },
  {
    name: "Tournament Bracket",
    state: "OPEN → CLOSED → REVEALED",
    tone: "bg-lime-500/10 border-lime-400/20 text-lime-200",
    bullets: [
      "Multi-round bracket predictions with cumulative scoring",
      "Creator advances brackets on-chain round by round",
    ],
  },
  {
    name: "Fan Privilege Auction",
    state: "OPEN → CLOSED → REVEALED",
    tone: "bg-yellow-500/10 border-yellow-400/20 text-yellow-200",
    bullets: [
      "Fans bid for privileges with on-chain pledges",
      "Creator selects winning bid, no token transfers required",
    ],
  },
];

const PLATFORM_CARDS = [
  {
    title: "Tamper-proof by design",
    body: "Every vote, prediction, and survey response is written directly to the blockchain. Nobody, not even the creator, can change or delete it after the fact.",
  },
  {
    title: "Gas-free for your users",
    body: "ChainForge AI sponsors every fan interaction through its relayer. Users connect a wallet and sign once. No tokens, no fees, no friction.",
  },
  {
    title: "You own what you build",
    body: "Your wallet address is recorded as the creator on-chain the moment you deploy. The manage dashboard and lifecycle controls are tied to that ownership.",
  },
  {
    title: "Built to grow beyond today",
    body: "Fan engagement apps are the first vertical. The same prompt-to-deploy system can power governance, token launches, DAO voting, and more.",
  },
];

const WIREFLUID_CARDS = [
  {
    label: "4-second transaction finality",
    body: "Participation, closes, and reveals confirm in seconds, not minutes. Fast enough to work in real-time during live events.",
  },
  {
    label: "100% EVM compatible",
    body: "Every tool in the Ethereum ecosystem works here. Solidity contracts, MetaMask wallets, Hardhat tests. No custom tooling required.",
  },
  {
    label: "Low fees that make gasless UX practical",
    body: "ChainForge AI can sponsor gas for every user interaction because WireFluid's fees stay low. Gasless UX is a product feature, not a gimmick.",
  },
];

const PROOF_ITEMS = [
  {
    label: "Live factory contract",
    value: "0x596FDe32DDde7e6e471adD72161F455429753c73",
    href: "https://wirefluidscan.com/address/0x596FDe32DDde7e6e471adD72161F455429753c73",
  },
  {
    label: "Relay-friendly PredictionLogicV2",
    value: "0x16FCFEf59360f1e7d8C615014328bD8419a9Be59",
    href: "https://wirefluidscan.com/address/0x16FCFEf59360f1e7d8C615014328bD8419a9Be59",
  },
  {
    label: "First full lifecycle on-chain",
    value: "0x03f76a918c260c9c1ace0ca70091281f6e9271c33cd2e22a46ce5cf881fd9bd8",
    href: "https://wirefluidscan.com/tx/0x03f76a918c260c9c1ace0ca70091281f6e9271c33cd2e22a46ce5cf881fd9bd8",
  },
];

const PLATFORM_VISION = [
  "Describe any on-chain experience: predictions, votes, surveys, governance, and beyond",
  "AI plans, audits, and deploys the contract. You review and sign.",
  "Today live: fan engagement apps on WireFluid with gasless participation",
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060a12]">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-0 hero-glow pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.12),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.18),transparent_38%),radial-gradient(circle_at_50%_30%,rgba(16,185,129,0.08),transparent_30%)] pointer-events-none" />

      {/* ── Hero ── */}
      <section className="relative px-6 pt-16 pb-14 sm:pt-20 sm:pb-20">
        <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-start">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 text-xs font-medium tracking-wide mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse" />
              Live on WireFluid · the demo league fan engagement demo active now
            </div>

            <h1 className="text-5xl sm:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.02] text-white">
              Build AI-powered
              <br />
              <span className="gradient-text">dApps on WireFluid</span>
              <br />
              in minutes.
            </h1>

            <p className="mt-6 max-w-3xl text-lg sm:text-xl text-slate-300 leading-relaxed">
              ChainForge AI is a prompt-to-deploy platform for WireFluid.
              Describe an experience in plain English, review the AI plan, and launch a live on-chain app with zero-gas participation for your users.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/builder"
                className="px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/20"
              >
                Start Building
              </Link>
              <Link
                href="/explore"
                className="px-7 py-3.5 rounded-xl glass glass-hover text-white font-semibold transition-all hover:-translate-y-0.5"
              >
                See Live Apps
              </Link>
              <Link
                href="/docs"
                className="px-7 py-3.5 rounded-xl border border-emerald-400/20 bg-emerald-400/8 hover:bg-emerald-400/12 text-emerald-200 font-semibold transition-all hover:-translate-y-0.5"
              >
                How It Works
              </Link>
            </div>

          </div>

          {/* Vision card */}
          <div className="animate-fade-up glass rounded-3xl border border-white/8 p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 mb-4">
              The Platform Vision
            </p>
            <div className="space-y-3">
              {PLATFORM_VISION.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-indigo-300 shrink-0" />
                  <p className="text-sm text-slate-300 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-indigo-400/15 bg-indigo-400/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300 mb-2">
                Why on-chain?
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">
                On-chain apps give creators real ownership and give users real proof.
                Votes can't be deleted. Results can't be altered. Participation is permanently
                attributable to a real wallet, not a username.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <LiveMetrics />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="glass rounded-3xl border border-white/8 p-6 sm:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 mb-3">
                  How It Works
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">From prompt to on-chain app in four steps</h2>
              </div>
              <p className="max-w-xl text-sm text-slate-400">
                No smart contract experience required. If you can describe what you want, ChainForge AI can build and deploy it.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {HOW_IT_WORKS.map(({ step, Icon, title, desc, color }) => (
                <div key={step} className="rounded-2xl border border-white/6 bg-white/[0.02] p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] font-bold tracking-[0.25em] text-slate-600">{step}</span>
                    <div className={color}>
                      <Icon />
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WireFluid + Templates ── */}
      <section className="relative px-6 pb-16">
        <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="glass rounded-3xl border border-white/8 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 mb-3">
              Built on WireFluid
            </p>
            <h2 className="text-2xl font-bold text-white mb-4">The right chain for real-time apps</h2>
            <div className="space-y-4">
              {WIREFLUID_CARDS.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
                  <p className="text-sm font-semibold text-white mb-1">{item.label}</p>
                  <p className="text-xs leading-relaxed text-slate-400">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-3xl border border-white/8 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 mb-3">
              Live Templates
            </p>
            <h2 className="text-2xl font-bold text-white mb-3">10 app types. Deploy any of them today.</h2>
            <p className="mb-6 text-sm leading-relaxed text-slate-400">
              From quick fan engagement to richer access, auction, tournament, and points-based experiences.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {TEMPLATE_CARDS.map((card) => (
                <div
                  key={card.name}
                  className="rounded-2xl border border-white/6 bg-white/[0.02] p-3.5 transition-colors hover:border-white/14 hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold leading-snug text-white">{card.name}</h3>
                    <div className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${card.tone}`}>
                      {card.state.includes("REVEALED") ? "Reveal" : "Close"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof strip ── */}
      <section className="relative px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="glass rounded-3xl border border-emerald-400/12 p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Live on WireFluid. Verify it yourself.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {PROOF_ITEMS.map((item) => (
                <a
                  key={item.value}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-white/6 bg-white/[0.02] p-4 transition-colors hover:border-emerald-400/25"
                >
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{item.label}</p>
                  <p className="mt-2 font-mono text-xs text-slate-300 break-all">{item.value}</p>
                  <p className="mt-3 text-xs text-indigo-400">Open on WireFluidScan →</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
      {/* ── Live campaigns ── */}
      <section className="relative px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 mb-3">
                Live Campaigns
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">See what the platform is powering right now</h2>
            </div>
            <p className="max-w-xl text-sm text-slate-400">
              These campaigns are already live on WireFluid. Open one, inspect the contract state, and see how participation looks in a real deployment.
            </p>
          </div>
          <HomeCampaignFeed />
        </div>


      </section>
      {/* ── Platform features ── */}
      <section className="relative px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 mb-3">
              What sets it apart
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Built for real use, not just demos</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLATFORM_CARDS.map((card) => (
              <div key={card.title} className="glass rounded-2xl border border-white/8 p-5">
                <h3 className="text-sm font-semibold text-white mb-2">{card.title}</h3>
                <p className="text-xs leading-relaxed text-slate-400">{card.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/proof" className="text-sm font-medium text-indigo-300 hover:text-indigo-200 transition-colors">
              See the full on-chain proof record: contract addresses, transaction hashes, live campaigns →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-3xl border border-indigo-400/15 px-8 py-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300 mb-3">
              Start building
            </p>
            <h2 className="text-3xl font-bold text-white mb-4">
              Your first on-chain app,
              <br />
              deployed in minutes.
            </h2>
            <p className="max-w-2xl mx-auto text-sm sm:text-base leading-relaxed text-slate-400 mb-8">
              ChainForge AI is live and ready. Describe the experience you want to create,
              let the AI design it, and deploy it directly to WireFluid. No developers, no contracts to write.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/builder"
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all hover:-translate-y-0.5"
              >
                Open the Builder
              </Link>
              <Link
                href="/explore"
                className="px-6 py-3 rounded-xl glass glass-hover text-white font-semibold transition-all hover:-translate-y-0.5"
              >
                Browse Live Apps
              </Link>
              <Link
                href="/docs"
                className="px-6 py-3 rounded-xl border border-emerald-400/20 bg-emerald-400/8 hover:bg-emerald-400/12 text-emerald-200 font-semibold transition-all hover:-translate-y-0.5"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}







