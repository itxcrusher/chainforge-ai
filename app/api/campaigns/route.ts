import { NextRequest, NextResponse } from "next/server";
import { getPublicClient } from "@/lib/contracts/clients";
import { campaignCache } from "@/lib/cache/campaignCache";
import { readCampaignBase, readCampaignParticipation } from "@/lib/contracts/campaignReads";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  const userAddress = req.nextUrl.searchParams.get("userAddress");

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: "Valid contract address required" }, { status: 400 });
  }

  const factoryAddress = process.env.FACTORY_ADDRESS as `0x${string}` | undefined;
  if (!factoryAddress) {
    return NextResponse.json({ error: "FACTORY_ADDRESS not configured" }, { status: 500 });
  }

  try {
    const client = getPublicClient();
    const contractAddress = address as `0x${string}`;

    let data = await campaignCache.get(address);
    if (data?.relayCompatible === undefined || !data?.template || !data?.state) {
      data = await readCampaignBase(client, factoryAddress, contractAddress);
      await campaignCache.set(address, data);
    }

    if (userAddress && /^0x[0-9a-fA-F]{40}$/.test(userAddress) && data.relayCompatible) {
      const participation = await readCampaignParticipation(
        client,
        contractAddress,
        data.template,
        userAddress as `0x${string}`
      );

      return NextResponse.json(
        { ...data, ...participation },
        { headers: { "X-Cache": data ? "HIT" : "MISS" } }
      );
    }

    return NextResponse.json(data, {
      headers: { "X-Cache": data ? "HIT" : "MISS" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
