import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

const hasRedis = !!(
  url && 
  token && 
  url !== "placeholder_redis_url" &&
  token !== "placeholder_redis_token" &&
  !url.includes("placeholder") &&
  !token.includes("placeholder")
)

const rawRedis = hasRedis
  ? new Redis({
      url: url!,
      token: token!,
    })
  : null

export const redis = rawRedis
  ? new Proxy(rawRedis, {
      get(target, prop, receiver) {
        const val = Reflect.get(target, prop, receiver)
        if (typeof val === "function" && prop !== "then") {
          return async (...args: any[]) => {
            try {
              return await val.apply(target, args)
            } catch (err) {
              console.error(`[Redis Client Error on "${String(prop)}"]:`, err)
              // Return safe defaults on error
              if (prop === "set" && args[2]?.nx) {
                // If it's a lock acquisition with NX, return "OK" (truthy) to bypass lock rather than block the user
                return "OK"
              }
              return null
            }
          }
        }
        return val
      }
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
