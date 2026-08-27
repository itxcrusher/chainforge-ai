import { NextRequest, NextResponse } from "next/server";
import { getProfileSummary } from "@/lib/reputation/reputation";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
};

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: "Valid address required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const profile = await getProfileSummary(address);
    return NextResponse.json(profile, { headers: CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build profile";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
