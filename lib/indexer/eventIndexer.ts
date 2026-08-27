import { Redis } from "@upstash/redis";
import { getPublicClient } from "@/lib/contracts/clients";
import { CAMPAIGN_FACTORY_ABI } from "@/lib/contracts/abis";

export interface IndexedCampaign {
  address: string;
  creator: string;
  blockNumber: string;
}

const CACHE_KEY = "chainforge:event-index";
const TTL_SECONDS = 60;

const redis = Redis.fromEnv();

export async function getIndexedCampaigns(): Promise<IndexedCampaign[]> {
  const factoryAddress = process.env.FACTORY_ADDRESS as `0x${string}` | undefined;
  if (!factoryAddress) return [];

  const cached = await redis.get<IndexedCampaign[]>(CACHE_KEY);
  if (cached) return cached;

  const client = getPublicClient();
  const addresses = await client.readContract({
    address: factoryAddress,
    abi: CAMPAIGN_FACTORY_ABI,
    functionName: "getCampaigns",
  }) as `0x${string}`[];

  const campaigns = await Promise.all(
    addresses.map(async (address) => {
      const creator = await client.readContract({
        address: factoryAddress,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: "campaignCreator",
        args: [address],
      }) as string;

      return {
        address: address.toLowerCase(),
        creator: creator.toLowerCase(),
        blockNumber: "0",
      } satisfies IndexedCampaign;
    })
  );

  await redis.setex(CACHE_KEY, TTL_SECONDS, campaigns);
  return campaigns;
}
