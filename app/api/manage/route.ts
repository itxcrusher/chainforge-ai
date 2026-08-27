import { NextRequest, NextResponse } from "next/server";
import { getPublicClient } from "@/lib/contracts/clients";
import { CAMPAIGN_FACTORY_ABI } from "@/lib/contracts/abis";
import { campaignCache } from "@/lib/cache/campaignCache";
import { readCampaignBase } from "@/lib/contracts/campaignReads";

export async function GET(req: NextRequest) {
  const creator = req.nextUrl.searchParams.get("creator");

  if (!creator || !/^0x[0-9a-fA-F]{40}$/.test(creator)) {
    return NextResponse.json({ error: "Valid creator address required" }, { status: 400 });
  }

  const factoryAddress = process.env.FACTORY_ADDRESS as `0x${string}` | undefined;
  if (!factoryAddress) {
    return NextResponse.json({ error: "FACTORY_ADDRESS not configured" }, { status: 500 });
  }

  try {
    const client = getPublicClient();
    const campaigns = (await client.readContract({
      address: factoryAddress,
      abi: CAMPAIGN_FACTORY_ABI,
      functionName: "getCreatorCampaigns",
      args: [creator as `0x${string}`],
    })) as `0x${string}`[];

    const compatible = await Promise.all(
      [...campaigns].reverse().map(async (address) => {
        let data = await campaignCache.get(address);
        if (data?.relayCompatible === undefined || !data?.template || !data?.state) {
          data = await readCampaignBase(client, factoryAddress, address);
          await campaignCache.set(address, data);
        }
        return data.relayCompatible ? address : null;
      })
    );

    return NextResponse.json({ campaigns: compatible.filter(Boolean) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch creator campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
