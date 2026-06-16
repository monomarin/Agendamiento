import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: {
      restaurant: {
        include: { paymentSettings: true },
      },
    },
  })

  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 })
  }

  const ps = branch.restaurant.paymentSettings
  return NextResponse.json({
    requireDeposit: ps?.requireDeposit ?? false,
    depositAmount: Number(ps?.depositAmount ?? 0),
    depositType: ps?.depositType ?? "FIXED",
    currency: ps?.currency ?? "COP",
    stripeEnabled: ps?.stripeEnabled ?? false,
    wompiEnabled: ps?.wompiEnabled ?? false,
  })
}
