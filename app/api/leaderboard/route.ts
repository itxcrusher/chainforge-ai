import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/reputation/reputation";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
};

export async function GET() {
  try {
    const leaderboard = await getLeaderboard();
    return NextResponse.json(leaderboard, { headers: CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build leaderboard";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
