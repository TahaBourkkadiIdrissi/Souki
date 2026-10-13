import routes from "./campaign-routes.json"

const reserved = new Set(routes.reserved)
export function isCampaignRootSlug(slug: string) {
  const normalized = slug.toLowerCase()
  return /^[a-z0-9][a-z0-9-]{2,47}$/.test(normalized) && !reserved.has(normalized)
}

export function isCampaignPath(path: string) {
  const parts = path.replace(/\/$/, "").split("/").slice(1)
  return parts.length === 1 ? isCampaignRootSlug(parts[0]) : parts.length === 2 && parts[0] === "r" && /^[a-z0-9][a-z0-9-]{2,47}$/i.test(parts[1])
}
