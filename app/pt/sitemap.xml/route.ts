import { formatSitemapXml, SITEMAP_HEADERS } from '@/lib/sitemap-helpers'
import { getAllPtSitemapUrls } from '@/lib/sitemap-pt-pages'

// Sitemap dédié au marché PT (lancement Vitfix Portugal en premier).
// Soumis à la propriété GSC URL prefix `https://vitfix.io/pt/` pour reporting
// PT-only (queries Portugal, indexation, CWV) séparé du master `vitfix.io/`.
//
// runtime='nodejs' aligné avec les autres routes sitemap (cf. app/sitemap.xml/route.ts).
// 'edge' causait un 500 sur OpenNext + Cloudflare Workers.
export const runtime = 'nodejs'

const CONTENT_LAST_UPDATED = new Date('2026-05-09T00:00:00Z')

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
  const urls = getAllPtSitemapUrls(baseUrl, CONTENT_LAST_UPDATED)
  return new Response(formatSitemapXml(urls), { headers: SITEMAP_HEADERS })
}
