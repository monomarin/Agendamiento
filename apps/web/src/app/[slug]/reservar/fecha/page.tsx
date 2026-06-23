import { redirect } from "next/navigation"

interface FechaPageProps {
  params: Promise<{ slug: string }>
}

export default async function FechaPage({ params }: FechaPageProps) {
  const { slug } = await params
  redirect(`/${slug}/reservar/personas`)
}
