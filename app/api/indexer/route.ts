import { NextResponse } from "next/server";
import { getIndexedCampaigns } from "@/lib/indexer/eventIndexer";

export async function GET() {
  try {
    const campaigns = await getIndexedCampaigns();
    return NextResponse.json(campaigns);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexer failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
