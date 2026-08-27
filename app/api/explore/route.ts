import { NextResponse } from "next/server";
import { getExploreCampaigns } from "@/lib/data/getCampaigns";

export type { ExploreCampaign } from "@/lib/data/getCampaigns";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function GET() {
  try {
    const campaigns = await getExploreCampaigns();
    return NextResponse.json(campaigns, { headers: CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch campaigns";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
