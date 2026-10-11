import { resolveCampaignLink } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  return resolveCampaignLink(slug, request)
}

export async function HEAD(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  return resolveCampaignLink(slug, request)
}
