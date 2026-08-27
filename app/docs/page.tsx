import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  title: string;
  items: Item[];
}

interface Item {
  name: string;
  detail: string;
  code?: string;
  tag?: string;
}

// ── Data ───────────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: "architecture",
    title: "System Architecture",
    items: [
      {
        name: "EIP-1167 Clone Factory",
        detail:
          "CampaignFactory V2 deploys minimal proxy clones of registered implementation contracts. Each campaign is a separate on-chain contract sharing logic with the implementation but maintaining independent state. Gas cost per deploy is substantially lower than redeploying full contracts.",
        code: "factory.cloneCampaign(templateName, options, deadline, creator)",
        tag: "Solidity",
      },
      {
        name: "Template Registry",
        detail:
          "Implementations are registered by name via setImplementation(). The factory reads bytecode from the implementation at the registered address and clones it. This separates template logic from campaign data, making upgrades possible for new campaigns without touching existing ones.",
        tag: "Solidity",
      },
      {
        name: "Creator Attribution",
        detail:
          "The connected wallet address is passed explicitly as the creator parameter and recorded on-chain in the factory's creator mapping. The server wallet that pays deployment gas is NOT the creator, your address is.",
        code: "factory.getCreatorCampaigns(creatorAddress) → address[]",
        tag: "On-Chain",
      },
      {
        name: "Lifecycle State Machine",
        detail:
          "Each V2 campaign moves through explicit states: OPEN → CLOSED → REVEALED (predictions) or OPEN → CLOSED (votes/surveys). State transitions are enforced at the contract level, only the creator can close or reveal, and only in valid sequence.",
        code: "enum CampaignState { OPEN, CLOSED, REVEALED }",
        tag: "Solidity",
      },
    ],
  },
  {
    id: "relay",
    title: "Gas Sponsorship & Relay Security",
    items: [
      {
        name: "Relay-Friendly Contract Signatures",
        detail:
          "All V2 contracts accept an explicit voter address parameter instead of relying on msg.sender. This lets the relayer submit transactions while correctly attributing participation to the real user wallet.",
        code: "submitPrediction(address voter, uint256 optionIndex)\ncastVote(address voter, uint256 optionIndex)\nsubmitResponse(address voter, uint256 optionIndex)",
        tag: "V2 Contracts",
      },
      {
        name: "EIP-191 Signature Verification",
        detail:
          "Before the relay submits any transaction, it verifies a signed authorization message from the user. The message includes the contract address, option index, user address, and a timestamp. The relay recovers the signer address and rejects requests where the signer doesn't match the declared user.",
        code: "recoverMessageAddress({ message, signature }) → recoveredAddress\nassert(recoveredAddress === userAddress)",
        tag: "Security",
      },
      {
        name: "5-Minute Authorization Window",
        detail:
          "The issuedAt timestamp in the authorization message must be within 300 seconds of the relay's server time. Replayed or stale signatures are rejected automatically.",
        tag: "Security",
      },
      {
        name: "Rate Limiting",
        detail:
          "Relay: 10 sponsored interactions per wallet per minute. Plan: 5 AI planning requests per IP per minute. Deploy: 3 campaign deployments per wallet per minute. All limits use in-memory sliding windows.",
        tag: "Abuse Prevention",
      },
    ],
  },
  {
    id: "contracts",
    title: "Current Live Contracts",
    items: [
      {
        name: "CampaignFactory V2",
        detail: "EIP-1167 clone factory. Registers templates, deploys clones, tracks creator → campaign mappings.",
        code: "0x596FDe32DDde7e6e471adD72161F455429753c73",
        tag: "WireFluid EVM",
      },
      {
        name: "PredictionLogicV2",
        detail: "Full OPEN → CLOSED → REVEALED lifecycle. One prediction per wallet. Creator reveals a winner index after close.",
        code: "0x16FCFEf59360f1e7d8C615014328bD8419a9Be59",
        tag: "WireFluid EVM",
      },
      {
        name: "VotingLogicV2",
        detail: "OPEN → CLOSED fan vote. One vote per wallet. Deadline-based or creator-controlled close.",
        code: "0x0225592B56BA91f153AE461C829b6fcC7B575B0e",
        tag: "WireFluid EVM",
      },
      {
        name: "SurveyLogic",
        detail: "OPEN → CLOSED survey. No deadline, creator closes manually. One response per wallet.",
        code: "0x582fE72d288aF5621D1B4052D1164403825f7500",
        tag: "WireFluid EVM",
      },
    ],
  },
  {
    id: "ai-pipeline",
    title: "AI Planning Pipeline",
    items: [
      {
        name: "Architect Agent",
        detail:
          "Receives the plain-English prompt and produces a structured campaign plan via OpenAI structured outputs. Determines the template type, options, deadline strategy, and metadata. Falls back gracefully when the requested campaign type is not in the supported template set.",
        tag: "OpenAI",
      },
      {
        name: "Auditor Agent",
        detail:
          "Independently validates the Architect's plan against the supported template registry and deployment constraints. Returns a pass/fail with named checks and a plain-English summary. A failed audit blocks deployment and surfaces the reason to the user.",
        tag: "OpenAI",
      },
      {
        name: "Deployment Agent",
        detail:
          "Converts the validated plan into a ready-to-deploy payload. Selects the implementation address, encodes options, sets deadlines. The user reviews this payload as a structured card before signing and deploying.",
        tag: "Next.js API",
      },
      {
        name: "NDJSON Streaming",
        detail:
          "The plan endpoint streams events as newline-delimited JSON so the UI can show each agent's progress in real time. Each event carries the agent name, status, and output. The stream closes after all three agents complete or any agent fails.",
        code: "POST /api/plan → ReadableStream<NDJSON>",
        tag: "API",
      },
    ],
  },
  {
    id: "caching",
    title: "Caching & Performance",
    items: [
      {
        name: "Upstash Redis Campaign Cache",
        detail:
          "Campaign reads (state, vote counts, creator, template) are cached in Upstash Redis with a 30-second TTL. Cache is invalidated on successful relay or lifecycle actions so counts update promptly after participation.",
        tag: "Redis",
      },
      {
        name: "View Snapshot Cache",
        detail:
          "The explore, profile, and leaderboard pages write their full computed responses to Redis as view snapshots. Subsequent requests within the TTL window are served directly from cache without re-reading contracts, keeping public pages fast under load.",
        tag: "Redis",
      },
      {
        name: "Optimistic UI Updates",
        detail:
          "After relay success, vote counts and participation state are updated locally in React state immediately, before the cache refreshes. This makes the UI responsive without waiting for a round-trip to the chain.",
        tag: "Next.js",
      },
    ],
  },
  {
    id: "roadmap",
    title: "Expansion Roadmap",
    items: [
      {
        name: "Template-Backed Expansion",
        detail:
          "ChainForge AI expands by adding vetted on-chain templates with known input schemas, security constraints, and proof requirements. The AI maps plain-English prompts into those bounded templates instead of generating arbitrary Solidity directly.",
        tag: "Roadmap",
      },
      {
        name: "Phase 1: Builder Depth",
        detail:
          "The next mergeable work is deeper builder intelligence: template-fit rationale, confidence, reveal strategy, editable review fields, Auditor suggestions, and duplicate warnings before deployment.",
        tag: "Live",
      },
      {
        name: "Phase 1: 10 Template Set",
        detail:
          "Phase 1 is complete and live: ChainForge AI now has contracts, tests, ABIs, planner support, deployment encoding, relay actions, campaign reads, and WireFluid registrations for seven expansion templates: Quiz, Raffle, Bounty, Fan Pass, Points Pool, Tournament, and Auction.",
        tag: "Live",
      },
      {
        name: "Phase 2: Capability Registry",
        detail:
          "The high-risk expansion path is a capability registry for more app categories such as fan privilege auctions, access passes, points prediction pools, multi-step prompt building, and bounded generated frontend variants.",
        tag: "Experimental",
      },
    ],
  },
  {
    id: "testing",
    title: "Contract Tests",
    items: [
      {
        name: "262 / 262 tests passing",
        detail:
          "Full Hardhat test suite covering CampaignFactory, current V2 public templates, V1 legacy validation contracts, and seven Phase 1 expansion templates: Quiz, Raffle, Bounty, Fan Pass, Points Pool, Tournament, and Auction.",
        code: "npm run test:contracts",
        tag: "Hardhat",
      },
      {
        name: "Relay-Friendly Signatures Tested",
        detail:
          "All V2 test suites pass voter addresses explicitly, matching the relay model. Tests cover single-vote enforcement, wrong-voter rejection, and lifecycle gate violations.",
        tag: "Hardhat",
      },
    ],
  },
  {
    id: "tech-stack",
    title: "Tech Stack",
    items: [
      { name: "Frontend", detail: "Next.js 14 App Router, TypeScript, Tailwind CSS", tag: "App" },
      { name: "Web3 Client", detail: "viem + wagmi v2, typed contract reads, wallet connect, signature verification", tag: "App" },
      { name: "Contracts", detail: "Solidity, Hardhat, OpenZeppelin (Initializable, access control patterns)", tag: "Contracts" },
      { name: "AI", detail: "OpenAI GPT-4o with structured outputs, Architect and Auditor agents", tag: "AI" },
      { name: "Cache", detail: "Upstash Redis REST API, campaign state cache and view snapshots", tag: "Infra" },
      { name: "Hosting", detail: "Vercel, edge functions for API routes, automatic preview deployments", tag: "Infra" },
      { name: "Network", detail: "WireFluid EVM, Chain ID 92533, 4s finality, 100% EVM compatible", tag: "Chain" },
    ],
  },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <main className="app-shell min-h-screen px-4 sm:px-6 py-12 sm:py-14">
      <div className="max-w-5xl mx-auto motion-surface">

        <PageHeader
          className="mb-14"
          eyebrow="Technical Reference"
          title="How ChainForge AI works"
          description="A technical walkthrough of the architecture, security model, contract system, and AI pipeline behind ChainForge AI."
          links={[
            { href: "/", label: "Back to home" },
            { href: "/proof", label: "On-chain proof record" },
            { href: "https://github.com/itxcrusher/chainforge-ai", label: "GitHub repository", external: true },
          ]}
        />

        {/* Quick nav */}
        <nav className="mb-14 p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-3">On this page</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="text-sm text-slate-400 hover:text-indigo-300 transition-colors">
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Sections */}
        <div className="space-y-20">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id}>
              <h2 className="text-2xl font-bold text-white mb-8 pb-3 border-b border-slate-800">
                {section.title}
              </h2>
              <div className="space-y-6">
                {section.items.map((item) => (
                  <div key={item.name} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="text-white font-semibold">{item.name}</h3>
                      {item.tag && (
                        <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed mb-3">{item.detail}</p>
                    {item.code && (
                      <pre className="text-xs text-indigo-300 bg-slate-950/60 rounded-lg px-4 py-3 font-mono overflow-x-auto border border-slate-800/60 whitespace-pre-wrap">
                        {item.code}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-20 pt-8 border-t border-slate-800 flex flex-wrap gap-4 text-sm text-slate-500">
          <Link href="/proof" className="hover:text-slate-300 transition-colors">On-Chain Proof →</Link>
          <Link href="/explore" className="hover:text-slate-300 transition-colors">Live Campaigns →</Link>
          <Link href="/builder" className="hover:text-slate-300 transition-colors">Try the Builder →</Link>
          <a href="https://wirefluidscan.com" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition-colors">WireFluidScan →</a>
        </div>
      </div>
    </main>
  );
}
