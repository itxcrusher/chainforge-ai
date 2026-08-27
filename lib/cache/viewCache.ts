import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const PREFIX = "view:";

function key(name: string) {
  return PREFIX + name;
}

export async function getViewCache<T>(name: string): Promise<T | null> {
  try {
    return await redis.get<T>(key(name));
  } catch {
    return null;
  }
}

export async function setViewCache<T>(name: string, value: T, ttlSeconds = 30): Promise<void> {
  try {
    await redis.setex(key(name), ttlSeconds, value);
  } catch {
    // non-fatal
  }
}

export async function invalidateViewCache(...names: string[]): Promise<void> {
  if (names.length === 0) return;
  try {
    await redis.del(...names.map(key));
  } catch {
    // non-fatal
  }
}
