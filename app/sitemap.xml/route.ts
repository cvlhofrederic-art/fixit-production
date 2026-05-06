import { formatSitemapIndexXml, SITEMAP_HEADERS } from '@/lib/sitemap-helpers'

// runtime='nodejs' aligné avec le reste du codebase (toutes les routes API
// utilisent nodejs sur OpenNext + Cloudflare Workers). 'edge' causait un
// 500 Internal Server Error en production (OpenNext ne supporte pas
// pleinement le edge runtime pour les route handlers retournant Response).
export const runtime = 'nodejs'

const SUB_SITEMAP_IDS = [0, 1, 2, 3, 4]

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
  const xml = formatSitemapIndexXml(SUB_SITEMAP_IDS.map((id) => `${baseUrl}/sitemap/${id}.xml`))
  return new Response(xml, { headers: SITEMAP_HEADERS })
}
