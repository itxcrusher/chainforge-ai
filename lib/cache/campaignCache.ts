import { Redis } from "@upstash/redis";
import type { CampaignBaseData, CampaignLifecycleState } from "@/lib/contracts/campaignReads";

export interface CampaignData extends CampaignBaseData {
  hasParticipated?: boolean;
  userChoice?: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
}

const TTL_SECONDS = 30;
const KEY_PREFIX = "campaign:";

let hits = 0;
let misses = 0;

class CampaignCache {
  private redis: Redis;

  constructor() {
    this.redis = Redis.fromEnv();
  }

  private getKey(address: string) {
    return KEY_PREFIX + address.toLowerCase();
  }

  async get(address: string): Promise<CampaignData | null> {
    const value = await this.redis.get<CampaignData>(this.getKey(address));
    if (value) {
      hits += 1;
      return value;
    }
    misses += 1;
    return null;
  }

  async set(address: string, data: CampaignData): Promise<void> {
    await this.redis.setex(this.getKey(address), TTL_SECONDS, data);
  }

  async invalidate(address: string): Promise<void> {
    await this.redis.del(this.getKey(address));
  }

  getStats(): CacheStats {
    return { hits, misses, entries: 0 };
  }
}

export const campaignCache = new CampaignCache();
export type { CampaignLifecycleState };
