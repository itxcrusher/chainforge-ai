import { NextRequest } from "next/server";
import OpenAI from "openai";
import { runArchitect } from "@/lib/agents/architect";
import { runAuditor } from "@/lib/agents/auditor";
import { runDeploymentAgent } from "@/lib/agents/deployment";
import type { ArchitectOutput } from "@/lib/agents/architect";
import type { AuditorOutput } from "@/lib/agents/auditor";
import type { DeploymentPlan } from "@/lib/agents/deployment";

const planRateLimitMap = new Map<string, { count: number; windowStart: number }>();
const PLAN_WINDOW_MS = 60_000;
const PLAN_MAX = 5;

function checkPlanRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = planRateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > PLAN_WINDOW_MS) {
    planRateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= PLAN_MAX) return false;
  entry.count += 1;
  return true;
}

// ─── Event types emitted over the stream ─────────────────────────────────────

export type PlanStreamEvent =
  | { type: "architect:start" }
  | { type: "architect:done"; data: ArchitectOutput }
  | { type: "auditor:start" }
  | { type: "auditor:done"; data: AuditorOutput }
  | { type: "deployment:start" }
  | { type: "deployment:done"; data: DeploymentPlan }
  | { type: "error"; message: string; auditResult?: AuditorOutput }
  | {
      type: "complete";
      architectOutput: ArchitectOutput;
      auditResult: AuditorOutput;
      deploymentPlan: DeploymentPlan;
    };

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkPlanRateLimit(ip)) {
    return Response.json(
      { error: "Rate limit exceeded — max 5 plans per minute" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt } = body as { prompt?: string };
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = async (event: PlanStreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        await Promise.resolve();
      };

      try {
        // ── Architect ────────────────────────────────────────────────────────
        await send({ type: "architect:start" });
        const architectOutput = await runArchitect(client, prompt.trim());
        await send({ type: "architect:done", data: architectOutput });

        // ── Auditor ──────────────────────────────────────────────────────────
        await send({ type: "auditor:start" });
        const auditResult = await runAuditor(client, architectOutput);
        await send({ type: "auditor:done", data: auditResult });

        if (auditResult.status === "rejected") {
          await send({
            type: "error",
            message: auditResult.reason ?? "Auditor rejected this campaign",
            auditResult,
          });
          controller.close();
          return;
        }

        // ── Deployment Agent (sync) ──────────────────────────────────────────
        await send({ type: "deployment:start" });
        const deploymentPlan = runDeploymentAgent(architectOutput);
        await send({ type: "deployment:done", data: deploymentPlan });

        // ── Final payload ────────────────────────────────────────────────────
        await send({ type: "complete", architectOutput, auditResult, deploymentPlan });
      } catch (err) {
        await send({
          type: "error",
          message: err instanceof Error ? err.message : "Planning failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no", // disable Nginx/Vercel response buffering
    },
  });
}
