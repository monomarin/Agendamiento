import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const prismaClientSingleton = () => {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://placeholder:placeholder@localhost:5432/placeholder"

  // En desarrollo local o entorno Node.js estándar, usamos el adaptador nativo pg
  // para evitar errores de WebSockets de Neon y cumplir con el tipo de motor "client"
  if (process.env.NODE_ENV === "development" || !process.env.VERCEL) {
    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ adapter })
  }

  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma
export { prisma }

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma
