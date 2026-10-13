import { reponseSitemapPt } from '@/lib/sitemap-pt-route'

// Sitemap PT « hubs » : les 21 hubs métier /pt/perto-de-mim/{metier}/ (phase 2 SEO PT, point 2.2).
// runtime nodejs : cf. app/sitemap.xml/route.ts.
export const runtime = 'nodejs'

export async function GET() {
  return reponseSitemapPt('hubs')
}
