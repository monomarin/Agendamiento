import crypto from "crypto"

export function generateApiKey(environment: "live" | "test" = "live"): {
  rawKey: string
  keyHash: string
} {
  const prefix = environment === "live" ? "res_live_" : "res_test_"
  const randomBytes = crypto.randomBytes(32).toString("hex")
  const rawKey = `${prefix}${randomBytes}`
  const keyHash = hashApiKey(rawKey)

  return { rawKey, keyHash }
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex")
}
