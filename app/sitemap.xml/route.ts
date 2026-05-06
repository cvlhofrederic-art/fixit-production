import { formatSitemapIndexXml, SITEMAP_HEADERS } from '@/lib/sitemap-helpers'

export const runtime = 'edge'
export const revalidate = 3600

const SUB_SITEMAP_IDS = [0, 1, 2, 3, 4]

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
  const xml = formatSitemapIndexXml(SUB_SITEMAP_IDS.map((id) => `${baseUrl}/sitemap/${id}.xml`))
  return new Response(xml, { headers: SITEMAP_HEADERS })
}
