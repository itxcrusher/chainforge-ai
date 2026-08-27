"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { injected } from "wagmi/connectors";
import { useToast } from "@/components/Toasts";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { PlanStreamEvent } from "@/app/api/plan/route";
import { buildDeployAuthorizationMessage } from "@/lib/contracts/authorizationMessages";
import { isPresentationReadyCampaign } from "@/lib/campaigns/presentationReady";
import { useActionOverlay } from "@/components/ActionOverlay";

type AgentStatus = "idle" | "running" | "passed" | "failed";

interface AgentState {
  status: AgentStatus;
  output: string | null;
}

interface AuditCheck {
  name: string;
  passed: boolean;
  reason?: string;
}

interface PlanResult {
  architectOutput: Record<string, unknown>;
  auditResult: { status: string; checks: AuditCheck[]; summary: string; reason?: string; suggestions?: string[]; warnings?: string[] };
  deploymentPlan: Record<string, unknown>;
}

interface ArchitectInsights {
  reasoning: string;
  confidenceScore: number;
  audienceFit: string;
  lifecycleStrategy: string;
  riskNotes: string[];
  suggestions: string[];
}

const CAMPAIGN_TYPES = [
  {
    id: "prediction",
    icon: "🔮",
    label: "Prediction",
    description: "Fans call an outcome. You reveal the winner on-chain.",
    template: "Create a [topic] prediction where fans choose between [Option A] and [Option B]. Deadline: [date or 'no deadline'].",
    color: "border-indigo-600/50 hover:border-indigo-500 bg-indigo-950/20 hover:bg-indigo-950/40",
    activeColor: "border-indigo-500 bg-indigo-950/40",
    dotColor: "bg-indigo-400",
  },
  {
    id: "vote",
    icon: "🗳️",
    label: "Fan Vote",
    description: "Fans pick a side. Best for rankings and preferences.",
    template: "Create a fan vote for [topic]. Options: [Option A], [Option B], [Option C]. No deadline, creator closes manually.",
    color: "border-violet-600/50 hover:border-violet-500 bg-violet-950/20 hover:bg-violet-950/40",
    activeColor: "border-violet-500 bg-violet-950/40",
    dotColor: "bg-violet-400",
  },
  {
    id: "survey",
    icon: "📊",
    label: "Survey",
    description: "Collect opinions and sentiment from your community.",
    template: "Create a sentiment survey about [topic]. Options: [Option A], [Option B], [Option C]. No deadline.",
    color: "border-sky-600/50 hover:border-sky-500 bg-sky-950/20 hover:bg-sky-950/40",
    activeColor: "border-sky-500 bg-sky-950/40",
    dotColor: "bg-sky-400",
  },
  {
    id: "quiz",
    icon: "🧠",
    label: "Quiz",
    description: "Test fan knowledge. One correct answer revealed on-chain.",
    template: "Create a cricket trivia quiz: [question]. Options: [Correct Answer], [Wrong Answer 1], [Wrong Answer 2]. Deadline: [date].",
    color: "border-amber-600/50 hover:border-amber-500 bg-amber-950/20 hover:bg-amber-950/40",
    activeColor: "border-amber-500 bg-amber-950/40",
    dotColor: "bg-amber-400",
  },
  {
    id: "raffle",
    icon: "🎟️",
    label: "Raffle",
    description: "Fans enter once. Winner picked on-chain at random.",
    template: "Create a raffle for fans to win [prize description]. Fans enter once per wallet. Deadline: [date].",
    color: "border-pink-600/50 hover:border-pink-500 bg-pink-950/20 hover:bg-pink-950/40",
    activeColor: "border-pink-500 bg-pink-950/40",
    dotColor: "bg-pink-400",
  },
  {
    id: "bounty",
    icon: "🏆",
    label: "Bounty",
    description: "Post a challenge. Fans register. You pick the winner.",
    template: "Create a bounty challenge: [challenge description]. Fans register their participation. Creator picks the winner after deadline: [date].",
    color: "border-orange-600/50 hover:border-orange-500 bg-orange-950/20 hover:bg-orange-950/40",
    activeColor: "border-orange-500 bg-orange-950/40",
    dotColor: "bg-orange-400",
  },
  {
    id: "fan-pass",
    icon: "🎫",
    label: "Fan Pass",
    description: "Issue tiered soulbound passes. No scalping possible.",
    template: "Create a fan pass for [event name] with [tier name] tier, limited to [supply] passes. Fans claim once, non-transferable.",
    color: "border-teal-600/50 hover:border-teal-500 bg-teal-950/20 hover:bg-teal-950/40",
    activeColor: "border-teal-500 bg-teal-950/40",
    dotColor: "bg-teal-400",
  },
  {
    id: "points-pool",
    icon: "⚡",
    label: "Points Pool",
    description: "Reputation-weighted predictions. No real money.",
    template: "Create a reputation-weighted prediction pool for [event]. Options: [Option A], [Option B]. Fans stake their reputation. Deadline: [date].",
    color: "border-yellow-600/50 hover:border-yellow-500 bg-yellow-950/20 hover:bg-yellow-950/40",
    activeColor: "border-yellow-500 bg-yellow-950/40",
    dotColor: "bg-yellow-400",
  },
  {
    id: "tournament",
    icon: "🏟️",
    label: "Tournament",
    description: "Multi-round bracket. Scores accumulate across matches.",
    template: "Create a [tournament name] prediction bracket. Fans predict each match. First round: [Team A] vs [Team B], [Team C] vs [Team D]. Deadline per round: [date].",
    color: "border-cyan-600/50 hover:border-cyan-500 bg-cyan-950/20 hover:bg-cyan-950/40",
    activeColor: "border-cyan-500 bg-cyan-950/40",
    dotColor: "bg-cyan-400",
  },
  {
    id: "auction",
    icon: "🔨",
    label: "Fan Auction",
    description: "Fans bid on exclusive privileges. On-chain bid ledger.",
    template: "Create a fan privilege auction for [exclusive experience description]. Fans place bid intents on-chain. Creator closes and selects winner after [date].",
    color: "border-rose-600/50 hover:border-rose-500 bg-rose-950/20 hover:bg-rose-950/40",
    activeColor: "border-rose-500 bg-rose-950/40",
    dotColor: "bg-rose-400",
  },
] as const;

type CampaignTypeId = typeof CAMPAIGN_TYPES[number]["id"];

const EXAMPLE_PROMPTS = [
  "Create a gas-sponsored the demo league match winner prediction for Northern Falcons vs Desert Sultans on WireFluid",
  "Create a the demo league player of the season fan vote with three options",
  "Create a cricket trivia quiz about the demo league 2026 facts with one correct answer",
  "Create a fan raffle to win a signed cricket bat from Babar Azam",
  "Create a fan pass for the demo league Final 2026 with VIP tier, limited to 100 passes",
  "Create a the demo league season prediction tournament bracket for all matches",
];

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "border-white/8 bg-white/[0.02]",
  running: "border-indigo-500/60 bg-indigo-950/30 animate-pulse",
  passed: "border-emerald-500/60 bg-emerald-950/20",
  failed: "border-red-500/60 bg-red-950/20",
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "Idle",
  running: "Running...",
  passed: "Passed",
  failed: "Failed",
};

const STATUS_DOTS: Record<AgentStatus, string> = {
  idle: "bg-slate-600",
  running: "bg-indigo-400",
  passed: "bg-emerald-400",
  failed: "bg-red-400",
};

const CHECK_LABELS: Record<string, string> = {
  supported_use_case: "Supported use case",
  valid_template: "Valid template",
  title_present: "Title present",
  minimum_two_options: "Minimum 2 options",
  no_placeholder_options: "No placeholder options",
  deadline_present: "Deadline strategy present",
};

function ConfidenceBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  const label =
    score >= 80 ? "text-emerald-300" : score >= 60 ? "text-amber-300" : "text-red-300";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${label}`}>{score}%</span>
    </div>
  );
}

function AgentCard({
  title,
  subtitle,
  status,
  output,
}: {
  title: string;
  subtitle: string;
  status: AgentStatus;
  output: string | null;
}) {
  return (
    <div className={`rounded-xl border px-4 py-4 transition-all ${STATUS_COLORS[status]}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOTS[status]}`} />
          <span className="text-sm font-semibold text-slate-100">{title}</span>
        </div>
        <span className="text-xs text-slate-400">{STATUS_LABELS[status]}</span>
      </div>
      <p className="text-xs text-slate-500">{subtitle}</p>
      {output && status === "passed" && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-300 transition-colors">
            Show raw agent output
          </summary>
          <pre className="mt-2 max-h-32 overflow-x-auto rounded-lg bg-black/30 p-3 text-xs text-emerald-300">
            {output}
          </pre>
        </details>
      )}
    </div>
  );
}

export default function BuilderPage() {
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { showOverlay, hideOverlay } = useActionOverlay();

  const [mounted, setMounted] = useState(false);
  const [selectedType, setSelectedType] = useState<CampaignTypeId | null>(null);
  const [prompt, setPrompt] = useState("");
  const [architect, setArchitect] = useState<AgentState>({ status: "idle", output: null });
  const [auditor, setAuditor] = useState<AgentState>({ status: "idle", output: null });
  const [auditChecks, setAuditChecks] = useState<AuditCheck[] | null>(null);
  const [deployment, setDeployment] = useState<AgentState>({ status: "idle", output: null });
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [architectInsights, setArchitectInsights] = useState<ArchitectInsights | null>(null);
  const [auditSuggestions, setAuditSuggestions] = useState<{ suggestions: string[]; warnings: string[] } | null>(null);
  const [editableTitle, setEditableTitle] = useState("");
  const [editableOptions, setEditableOptions] = useState<string[]>([]);
  const [editableDeadline, setEditableDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [planning, setPlanning] = useState(false);
  const pipelineRef = useRef<HTMLDivElement | null>(null);
  const deploySectionRef = useRef<HTMLDivElement | null>(null);
  const [deployResult, setDeployResult] = useState<{
    campaignAddress: string;
    txHash: string;
    template: string;
    explorerUrl: string;
    txExplorerUrl: string;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!planResult || deployResult) return;
    let cancelled = false;
    let attempts = 0;
    const scrollWhenReady = () => {
      if (cancelled) return;
      const top = deploySectionRef.current?.getBoundingClientRect().top;
      if (top !== undefined) {
        window.scrollTo({ top: window.scrollY + top - 96, behavior: "smooth" });
        return;
      }
      attempts += 1;
      if (attempts < 12) window.setTimeout(scrollWhenReady, 80);
    };
    window.setTimeout(scrollWhenReady, 120);
    return () => { cancelled = true; };
  }, [planResult, deployResult]);

  function resetAgents() {
    setArchitect({ status: "idle", output: null });
    setAuditor({ status: "idle", output: null });
    setAuditChecks(null);
    setDeployment({ status: "idle", output: null });
    setPlanResult(null);
    setArchitectInsights(null);
    setAuditSuggestions(null);
    setEditableTitle("");
    setEditableOptions([]);
    setEditableDeadline("");
    setError(null);
    setPlanning(false);
    setDeployResult(null);
  }

  async function handleConnectWallet() {
    showOverlay("Connect wallet", "Approve the wallet connection request to continue.");
    try {
      await connectAsync({ connector: injected() });
    } finally {
      hideOverlay();
    }
  }

  function handleTypeSelect(typeId: CampaignTypeId) {
    const type = CAMPAIGN_TYPES.find((t) => t.id === typeId);
    if (!type) return;
    setSelectedType(typeId);
    setPrompt(type.template);
    resetAgents();
  }

  const handleUpdateOption = useCallback((index: number, value: string) => {
    setEditableOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }, []);

  async function handlePlan() {
    if (!prompt.trim()) return;
    resetAgents();
    setPlanning(true);
    setTimeout(() => {
      const top = pipelineRef.current?.getBoundingClientRect().top;
      if (top === undefined) return;
      window.scrollTo({ top: window.scrollY + top - 96, behavior: "smooth" });
    }, 90);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.body) {
        setArchitect({ status: "failed", output: null });
        setError("No stream body returned");
        setPlanning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: PlanStreamEvent;
          try {
            event = JSON.parse(line) as PlanStreamEvent;
          } catch {
            continue;
          }

          switch (event.type) {
            case "architect:start":
              setArchitect({ status: "running", output: null });
              break;
            case "architect:done":
              setArchitect({ status: "passed", output: JSON.stringify(event.data, null, 2) });
              setArchitectInsights({
                reasoning: event.data.reasoning ?? "",
                confidenceScore: event.data.confidenceScore ?? 0,
                audienceFit: event.data.audienceFit ?? "",
                lifecycleStrategy: event.data.lifecycleStrategy ?? "",
                riskNotes: event.data.riskNotes ?? [],
                suggestions: event.data.suggestions ?? [],
              });
              break;
            case "auditor:start":
              setAuditor({ status: "running", output: null });
              break;
            case "auditor:done":
              setAuditChecks(event.data.checks);
              setAuditor({ status: "passed", output: null });
              setAuditSuggestions({
                suggestions: event.data.suggestions ?? [],
                warnings: event.data.warnings ?? [],
              });
              break;
            case "deployment:start":
              setDeployment({ status: "running", output: null });
              break;
            case "deployment:done":
              setDeployment({ status: "passed", output: JSON.stringify(event.data, null, 2) });
              break;
            case "complete":
              setPlanResult({
                architectOutput: event.architectOutput as unknown as Record<string, unknown>,
                auditResult: event.auditResult as PlanResult["auditResult"],
                deploymentPlan: event.deploymentPlan as unknown as Record<string, unknown>,
              });
              setEditableTitle(event.architectOutput.campaignTitle ?? "");
              setEditableOptions(event.architectOutput.options ?? []);
              setEditableDeadline(event.architectOutput.deadlineStrategy ?? "");
              setPlanning(false);
              break;
            case "error":
              if (event.auditResult) {
                setAuditChecks(event.auditResult.checks);
                setAuditor({ status: "failed", output: null });
              } else {
                setArchitect((prev) => (prev.status === "running" ? { status: "failed", output: null } : prev));
              }
              setError(event.message);
              setPlanning(false);
              break;
          }
        }
      }
    } catch {
      setArchitect({ status: "failed", output: null });
      setError("Network error: could not reach /api/plan");
      setPlanning(false);
    }
  }

  async function handleDeploy() {
    if (!planResult || !isConnected || !address) return;
    setDeploying(true);
    setError(null);

    try {
      const config = {
        ...planResult.architectOutput,
        campaignTitle: editableTitle || planResult.architectOutput.campaignTitle,
        options: editableOptions.length > 0 ? editableOptions : planResult.architectOutput.options,
        deadlineStrategy: editableDeadline || planResult.architectOutput.deadlineStrategy,
      };

      const issuedAt = Math.floor(Date.now() / 1000);
      const templateName = (planResult.architectOutput.templateSelected as string | undefined) ?? "PredictionLogicV2";
      const campaignTitle = config.campaignTitle as string | undefined;
      const options = config.options as string[] | undefined;

      if (!campaignTitle || !Array.isArray(options) || options.length < 2) {
        const msg = "Plan result is incomplete. Run planning again.";
        setError(msg);
        toast("error", msg);
        return;
      }

      if (!isPresentationReadyCampaign(campaignTitle, options)) {
        const msg = "Replace the bracketed placeholder text before deploying.";
        setError(msg);
        toast("error", msg);
        return;
      }

      const message = buildDeployAuthorizationMessage({
        creatorAddress: address,
        templateName,
        campaignTitle,
        options,
        deadlineStrategy: config.deadlineStrategy as string | undefined,
        issuedAt,
      });
      showOverlay("Confirm deploy", "Approve the signature request in your wallet. This proves you are the creator.");
      const signature = await signMessageAsync({ message });
      showOverlay("Deploying campaign", "Submitting your campaign on-chain through the server sponsor wallet. This can take a few seconds.");

      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, creatorAddress: address, signature, issuedAt }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: "Deploy failed" }))) as { error?: string };
        const msg = body.error ?? "Deploy failed";
        setError(msg);
        toast("error", msg);
        return;
      }

      const data = await res.json() as typeof deployResult;
      setDeployResult(data);
      toast("success", "Campaign deployed on WireFluid");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error: could not reach /api/deploy";
      setError(msg);
      toast("error", msg);
    } finally {
      hideOverlay();
      setDeploying(false);
    }
  }

  const tpl = (planResult?.architectOutput.templateSelected ?? "") as string;
  const templateColor =
    tpl === "VotingLogicV2" ? "bg-violet-900/50 text-violet-300 border-violet-700"
    : tpl === "SurveyLogic" ? "bg-sky-900/50 text-sky-300 border-sky-700"
    : tpl === "QuizLogic" ? "bg-amber-900/50 text-amber-300 border-amber-700"
    : tpl === "RaffleLogic" ? "bg-pink-900/50 text-pink-300 border-pink-700"
    : tpl === "BountyLogic" ? "bg-orange-900/50 text-orange-300 border-orange-700"
    : tpl === "FanPassLogic" ? "bg-teal-900/50 text-teal-300 border-teal-700"
    : tpl === "PointsPoolLogic" ? "bg-yellow-900/50 text-yellow-300 border-yellow-700"
    : tpl === "TournamentLogic" ? "bg-cyan-900/50 text-cyan-300 border-cyan-700"
    : tpl === "AuctionLogic" ? "bg-rose-900/50 text-rose-300 border-rose-700"
    : "bg-indigo-900/50 text-indigo-300 border-indigo-700";

  const allSuggestions = [
    ...(architectInsights?.suggestions ?? []),
    ...(auditSuggestions?.suggestions ?? []),
  ].filter(Boolean);
  const allWarnings = auditSuggestions?.warnings ?? [];

  return (
    <ErrorBoundary>
      <main className="app-shell min-h-screen px-4 sm:px-6 py-10 sm:py-12">
        <div className="max-w-5xl mx-auto motion-surface">

          {/* Hero + How it works */}
          <div className="mb-12 grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Builder workflow
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
                Plan the app.<br /> Launch it on-chain.
              </h1>
              <p className="text-slate-400 text-base leading-relaxed mb-6">
                Choose from 10 app types or write your own prompt. The AI pipeline structures it, validates it, and prepares a deployment you can review and edit before publishing to WireFluid.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "10 app types", dot: "bg-indigo-400" },
                  { label: "Fans pay zero gas", dot: "bg-emerald-400" },
                  { label: "Fully on-chain", dot: "bg-violet-400" },
                  { label: "Verifiable on WireFluidScan", dot: "bg-sky-400" },
                ].map((pill) => (
                  <span key={pill.label} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/8 text-xs text-slate-300">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pill.dot}`} />
                    {pill.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl border border-white/8 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-5">How it works</p>
              <div className="space-y-0">
                {[
                  { num: "1", title: "Describe the experience", body: "Choose an app type or write your own prompt. The AI selects the right template and explains why.", dot: "bg-indigo-500", line: true },
                  { num: "2", title: "Review the AI plan", body: "Three agents run live: Architect plans it with full reasoning, Auditor validates it with suggestions, Deployment Agent prepares the contract.", dot: "bg-violet-500", line: true },
                  { num: "3", title: "Edit and deploy as creator", body: "Edit the title, options, and deadline before deploying. Connect your wallet and sign once. Your address is recorded on-chain as creator.", dot: "bg-emerald-500", line: false },
                ].map((step) => (
                  <div key={step.num} className="flex gap-4">
                    <div className="flex flex-col items-center shrink-0">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${step.dot}`}>
                        {step.num}
                      </span>
                      {step.line && <div className="w-px flex-1 bg-white/8 my-2 min-h-[24px]" />}
                    </div>
                    <div className={step.line ? "pb-5" : "pb-0"}>
                      <p className="text-sm font-semibold text-white mb-1">{step.title}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Campaign type picker — 10 types */}
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3">
              Start with an app type <span className="normal-case text-slate-600">(optional, or write your own below)</span>
            </p>
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {CAMPAIGN_TYPES.map((type) => {
                const active = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleTypeSelect(type.id)}
                    className={`text-left rounded-xl border px-3 py-3 transition-all ${active ? type.activeColor : type.color}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{type.icon}</span>
                      <span className="text-xs font-semibold text-white leading-tight">{type.label}</span>
                      {active && <span className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${type.dotColor}`} />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{type.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt input */}
          <div className="glass rounded-2xl border border-white/8 p-5 mb-8">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">
                {selectedType ? "Customize the prompt" : "Describe the app"}
              </p>
              {selectedType && (
                <p className="text-xs text-slate-500 mb-2">
                  Replace the bracketed placeholders with your details, then click Plan.
                </p>
              )}
              <textarea
                className="w-full rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500/60 transition-colors"
                rows={4}
                placeholder="Example: Create a the demo league final winner prediction for Northern Falcons vs Desert Sultans"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {!selectedType && (
              <div className="flex flex-wrap gap-2 mb-5">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    type="button"
                    key={example}
                    onClick={() => setPrompt(example)}
                    className="text-xs px-3 py-1.5 rounded-full glass glass-hover text-slate-300 transition-colors"
                  >
                    {example.length > 60 ? `${example.slice(0, 60)}…` : example}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                The AI selects the right template, explains its reasoning, and lets you edit before deploying.
              </p>
              <button
                type="button"
                onClick={handlePlan}
                disabled={!prompt.trim() || planning}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
              >
                {planning ? "Planning..." : "Plan App"}
              </button>
            </div>
            {planning && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-950/25 px-4 py-3 text-sm text-indigo-200">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                AI agents are running below. Scrolling to the live pipeline.
              </div>
            )}
          </div>

          {/* Agent pipeline */}
          <div ref={pipelineRef} className="mb-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">AI Agent Pipeline</h2>
            <div className="grid gap-3 lg:grid-cols-3">
              <AgentCard
                title="Architect Agent"
                subtitle="Selects the right template. Explains reasoning, confidence, and lifecycle strategy."
                status={architect.status}
                output={architect.output}
              />
              <div className={`rounded-xl border px-4 py-4 transition-all ${STATUS_COLORS[auditor.status]}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOTS[auditor.status]}`} />
                    <span className="text-sm font-semibold text-slate-100">Auditor Agent</span>
                  </div>
                  <span className="text-xs text-slate-400">{STATUS_LABELS[auditor.status]}</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Checks template fit, title, options, deadline. Provides suggestions.</p>
                {auditChecks ? (
                  <ul className="flex flex-col gap-1.5">
                    {auditChecks.map((check) => (
                      <li key={check.name} className="flex items-start gap-2 text-xs">
                        <span className={check.passed ? "text-emerald-400" : "text-red-400"}>
                          {check.passed ? "✓" : "✗"}
                        </span>
                        <span className={check.passed ? "text-slate-300" : "text-red-300"}>
                          {CHECK_LABELS[check.name] ?? check.name}
                          {!check.passed && check.reason ? <span className="text-red-500 ml-1">— {check.reason}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">Validation results will appear here.</p>
                )}
              </div>
              <AgentCard
                title="Deployment Agent"
                subtitle="Prepares calldata and deployment details for the selected template."
                status={deployment.status}
                output={deployment.output}
              />
            </div>
          </div>

          {/* Architect Insights card — shown after architect runs */}
          {architectInsights && (
            <div className="mb-6 rounded-xl border border-indigo-500/20 bg-indigo-950/10 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Why this plan?</p>
                <div className="flex items-center gap-2 min-w-[140px]">
                  <span className="text-xs text-slate-500">Confidence</span>
                  <div className="flex-1">
                    <ConfidenceBar score={architectInsights.confidenceScore} />
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mb-3">{architectInsights.reasoning}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {architectInsights.audienceFit && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">Audience fit</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{architectInsights.audienceFit}</p>
                  </div>
                )}
                {architectInsights.lifecycleStrategy && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">Lifecycle strategy</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{architectInsights.lifecycleStrategy}</p>
                  </div>
                )}
              </div>
              {architectInsights.riskNotes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/6">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 mb-2">Risk notes</p>
                  <ul className="space-y-1">
                    {architectInsights.riskNotes.map((note, i) => (
                      <li key={i} className="text-xs text-amber-300/80 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">⚠</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Suggestions from architect + auditor */}
          {allSuggestions.length > 0 && (
            <div className="mb-6 rounded-xl border border-emerald-500/15 bg-emerald-950/10 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 mb-2">Suggestions</p>
              <ul className="space-y-1.5">
                {allSuggestions.map((s, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5 text-emerald-400">›</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings from auditor */}
          {allWarnings.length > 0 && (
            <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-950/10 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 mb-2">Warnings</p>
              <ul className="space-y-1.5">
                {allWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-300 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">⚠</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Review and deploy section */}
          {planResult && (
            <div className="mb-6 glass rounded-2xl border border-white/8 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-5">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-2">Review and edit before deploy</p>
                  <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                    {planResult.auditResult.summary || "This plan is ready for deployment review."}
                  </p>
                </div>
                {tpl && (
                  <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold border ${templateColor}`}>
                    {tpl}
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_0.95fr]">
                {/* Editable fields */}
                <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4 space-y-4">
                  <p className="text-xs text-slate-500 uppercase tracking-[0.2em]">Edit before deploying</p>

                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">Campaign title</label>
                    <input
                      type="text"
                      value={editableTitle}
                      onChange={(e) => setEditableTitle(e.target.value)}
                      className="w-full rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/60 transition-colors"
                    />
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Options</p>
                    <div className="space-y-2">
                      {editableOptions.map((option, i) => (
                        <input
                          key={i}
                          type="text"
                          value={option}
                          onChange={(e) => handleUpdateOption(i, e.target.value)}
                          placeholder={`Option ${i + 1}`}
                          className="w-full rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/60 transition-colors"
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">Deadline strategy</label>
                    <input
                      type="text"
                      value={editableDeadline}
                      onChange={(e) => setEditableDeadline(e.target.value)}
                      className="w-full rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500/60 transition-colors"
                    />
                  </div>
                </div>

                {/* What happens next */}
                <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-3">What happens next</p>
                  <div className="space-y-3 text-sm text-slate-300">
                    <div><span className="text-indigo-300 font-semibold">1.</span> Sign the deploy intent with your wallet.</div>
                    <div><span className="text-indigo-300 font-semibold">2.</span> ChainForge AI deploys the clone on WireFluid and records you as creator.</div>
                    <div><span className="text-indigo-300 font-semibold">3.</span> Open the campaign, share it, and use Manage to close or reveal it.</div>
                  </div>
                  <details className="mt-4">
                    <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-300 transition-colors">
                      Show raw config
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-black/30 p-3 text-xs text-slate-400">
                      {JSON.stringify(planResult.architectOutput, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            </div>
          )}

          {planResult && !deployResult && (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => { resetAgents(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-2"
              >
                Revise prompt and re-plan
              </button>
            </div>
          )}

          {planResult && !deployResult && (
            <div ref={deploySectionRef} className="mb-8">
              {mounted && !isConnected ? (
                <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-amber-300">Connect your wallet to deploy. Your address will be recorded on-chain as the campaign creator.</p>
                  <button
                    type="button"
                    onClick={() => void handleConnectWallet()}
                    className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : mounted && isConnected ? (
                <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>
                    Deploying as <span className="font-mono text-slate-300">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
                  </span>
                  <button type="button" onClick={() => disconnect()} className="text-slate-600 transition-colors hover:text-slate-400">
                    disconnect
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleDeploy}
                disabled={deploying || !mounted || !isConnected}
                className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deploying ? "Deploying on-chain..." : "Deploy On-Chain"}
              </button>
            </div>
          )}

          {deployResult && (
            <div className="glass rounded-2xl border border-emerald-600 bg-emerald-950/30 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
                <div>
                  <p className="text-emerald-300 font-semibold text-base">Campaign deployed successfully.</p>
                  <p className="text-sm text-slate-300 mt-1">Your campaign is now live on WireFluid and ready to share.</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${templateColor}`}>
                  {deployResult.template}
                </span>
              </div>
              <div className="space-y-2 mb-4 text-xs text-slate-400">
                <p>Address: <span className="font-mono text-slate-200 break-all">{deployResult.campaignAddress}</span></p>
                <p>Tx: <span className="font-mono text-slate-200 break-all">{deployResult.txHash}</span></p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <a href={`/campaigns/${deployResult.campaignAddress}`} className="rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-500">
                  Open Campaign
                </a>
                <a href={`/manage/${address}`} className="rounded-lg bg-slate-800 px-3 py-2 text-center text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700">
                  Manage Campaigns
                </a>
                <a href={deployResult.txExplorerUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-slate-800 px-3 py-2 text-center text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700">
                  View Tx
                </a>
                <Link href="/proof" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/15">
                  Proof Surface
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </ErrorBoundary>
  );
}
