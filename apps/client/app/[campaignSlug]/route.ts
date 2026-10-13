import { resolveCampaignLink } from "@/lib/api"
import { isCampaignRootSlug } from "@/lib/campaign-links"

export const dynamic = "force-dynamic"

// Static application routes take precedence over this one-segment fallback.
export async function GET(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params
  if (!isCampaignRootSlug(campaignSlug)) return new Response("Lien introuvable", { status: 404, headers: { "Cache-Control": "no-store" } })
  return resolveCampaignLink(campaignSlug, request)
}

export const HEAD = GET
