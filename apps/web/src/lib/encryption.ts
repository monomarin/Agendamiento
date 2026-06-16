import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const SALT_LENGTH = 16
const KEY_LENGTH = 32
const ITERATIONS = 10000

const getSecretKey = (): Buffer => {
  const secret = process.env.ENCRYPTION_KEY || "default-secret-key-32-chars-long!!"
  // Derive key using PBKDF2 to ensure it is exactly 32 bytes
  return crypto.pbkdf2Sync(secret, "salt-for-key-derivation", ITERATIONS, KEY_LENGTH, "sha256")
}

export function encrypt(text: string): string {
  if (!text) return ""
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = getSecretKey()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  
  const authTag = cipher.getAuthTag().toString("hex")
  
  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ""
  const parts = ciphertext.split(":")
  if (parts.length !== 3) {
    throw new Error("Formato de texto encriptado inválido")
  }
  
  const [ivHex, authTagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const key = getSecretKey()
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encryptedHex, "hex", "utf8")
  decrypted += decipher.final("utf8")
  
  return decrypted
}
