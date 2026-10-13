import { reponseSitemapPt } from '@/lib/sitemap-pt-route'

// Sitemap PT « servicos » (phase 1 SEO PT, point 1.1). runtime nodejs : cf. app/sitemap.xml/route.ts.
export const runtime = 'nodejs'

export async function GET() {
  return reponseSitemapPt('servicos')
}
