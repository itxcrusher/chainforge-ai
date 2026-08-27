import { NextResponse } from "next/server";
import { campaignCache } from "@/lib/cache/campaignCache";

export async function GET() {
  const { hits, misses, entries } = campaignCache.getStats();
  return NextResponse.json({
    hits,
    misses,
    totalRequests: hits + misses,
    estimatedRPCReadsAvoided: hits, // labeled as estimated
    entries,
  });
}
