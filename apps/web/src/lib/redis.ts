import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

const hasRedis = !!(
  process.env.UPSTASH_REDIS_REST_URL && 
  process.env.UPSTASH_REDIS_REST_TOKEN
)

export const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

export function getRatelimit(limitCount: number, duration: `${number} ${"s" | "m" | "h" | "d"}`, prefix: string) {
  if (!redis) {
    return {
      limit: async () => ({
        success: true,
        limit: limitCount,
        remaining: limitCount,
        reset: Date.now() + 60000,
      }),
    }
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limitCount, duration),
    prefix,
  })
}
