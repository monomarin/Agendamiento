import { PrismaClient } from "@prisma/client"
console.log("DATABASE_URL:", process.env.DATABASE_URL)
try {
  const prisma = new PrismaClient({})
  console.log("Success with empty object!")
} catch (e) {
  console.error(e)
}
