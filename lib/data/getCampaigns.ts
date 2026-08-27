import { getPublicClient } from "@/lib/contracts/clients";
import { CAMPAIGN_FACTORY_ABI } from "@/lib/contracts/abis";
import { campaignCache } from "@/lib/cache/campaignCache";
import { getIndexedCampaigns } from "@/lib/indexer/eventIndexer";
import { readCampaignBase } from "@/lib/contracts/campaignReads";
import { getViewCache, setViewCache } from "@/lib/cache/viewCache";
import { isPresentationReadyCampaign } from "@/lib/campaigns/presentationReady";

export interface ExploreCampaign {
  address: string;
  title: string;
  options: string[];
  voteCounts: string[];
  deadline: string;
  template?: string;
  creator?: string;
  state?: string;
  relayCompatible?: boolean;
  compatibilityNote?: string;
  winnerLabel?: string;
}

let lastGoodExploreCampaigns: ExploreCampaign[] = [];
const EXPLORE_CACHE_KEY = "explore:campaigns";

export async function getExploreCampaigns(): Promise<ExploreCampaign[]> {
  const factoryAddress = process.env.FACTORY_ADDRESS as `0x${string}` | undefined;
  if (!factoryAddress) return lastGoodExploreCampaigns;

  const persistedSnapshot = await getViewCache<ExploreCampaign[]>(EXPLORE_CACHE_KEY);
  if (persistedSnapshot?.length) {
    const publicSnapshot = persistedSnapshot.filter(
      (campaign) =>
        campaign.relayCompatible === true &&
        isPresentationReadyCampaign(campaign.title, campaign.options)
    );
    lastGoodExploreCampaigns = publicSnapshot;
    return publicSnapshot;
  }

  try {
    const client = getPublicClient();

    const addresses = (await client.readContract({
      address: factoryAddress,
      abi: CAMPAIGN_FACTORY_ABI,
      functionName: "getCampaigns",
    })) as `0x${string}`[];

    if (addresses.length === 0) {
      return lastGoodExploreCampaigns;
    }

    const creatorMap = new Map<string, string>();
    try {
      const indexed = await getIndexedCampaigns();
      for (const entry of indexed) {
        creatorMap.set(entry.address.toLowerCase(), entry.creator);
      }
    } catch {
      // non-fatal
    }

    const rawCampaigns = await Promise.all(
      addresses.map(async (addr) => {
        try {
          let cached = await campaignCache.get(addr);
          if (cached?.relayCompatible === undefined || !cached?.template || !cached?.state) {
            cached = await readCampaignBase(client, factoryAddress, addr);
            await campaignCache.set(addr, cached);
          }

          return {
            address: addr,
            ...cached,
            creator: cached.creator || creatorMap.get(addr.toLowerCase()),
          } as ExploreCampaign;
        } catch {
          return null;
        }
      })
    );

    const campaigns: ExploreCampaign[] = [];
    for (const campaign of rawCampaigns) {
      if (campaign) campaigns.push(campaign);
    }

    const compatibleCampaigns = campaigns.filter(
      (campaign) => campaign.relayCompatible === true && isPresentationReadyCampaign(campaign.title, campaign.options)
    );
    if (compatibleCampaigns.length > 0) {
      lastGoodExploreCampaigns = compatibleCampaigns;
      await setViewCache(EXPLORE_CACHE_KEY, compatibleCampaigns, 300);
      return compatibleCampaigns;
    }

    return lastGoodExploreCampaigns;
  } catch {
    return lastGoodExploreCampaigns;
  }
}

