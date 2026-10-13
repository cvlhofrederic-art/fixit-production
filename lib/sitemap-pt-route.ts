// Fabrique commune des 6 routes /pt/sitemap-*.xml (phase 1 SEO PT, point 1.1).
import { formatSitemapXml, SITEMAP_HEADERS } from './sitemap-helpers'
import { sitemapsPt, type GroupeSitemapPt } from './sitemap-pt-pages'

export function reponseSitemapPt(groupe: GroupeSitemapPt): Response {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
  return new Response(formatSitemapXml(sitemapsPt(baseUrl)[groupe]), { headers: SITEMAP_HEADERS })
}
