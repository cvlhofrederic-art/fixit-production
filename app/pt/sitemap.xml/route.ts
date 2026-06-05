import { formatSitemapXml, SITEMAP_HEADERS } from '@/lib/sitemap-helpers'
import { getAllPtSitemapUrls } from '@/lib/sitemap-pt-pages'

// Sitemap dédié au marché PT (lancement Vitfix Portugal en premier).
// Soumis à la propriété GSC URL prefix `https://vitfix.io/pt/` pour reporting
// PT-only (queries Portugal, indexation, CWV) séparé du master `vitfix.io/`.
//
// runtime='nodejs' aligné avec les autres routes sitemap (cf. app/sitemap.xml/route.ts).
// 'edge' causait un 500 sur OpenNext + Cloudflare Workers.
//
// Pas de CONTENT_LAST_UPDATED hardcodé : le helper omet `<lastmod>` quand on
// n'a pas de vraie date par URL. Cf. lib/sitemap-pt-pages.ts.
export const runtime = 'nodejs'

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
  const urls = getAllPtSitemapUrls(baseUrl)
  return new Response(formatSitemapXml(urls), { headers: SITEMAP_HEADERS })
}
