import { formatSitemapIndexXml, SITEMAP_HEADERS } from '@/lib/sitemap-helpers'
import { urlsFichiersSitemapPt } from '@/lib/sitemap-pt-pages'

// Index des sitemaps PT (phase 1 SEO PT, point 1.1), soumis à la propriété GSC URL prefix
// `https://vitfix.io/pt/`. Les URL elles-mêmes sont dans /pt/sitemap-*.xml (un fichier par
// modèle : servicos, urgencia, perto-de-mim, cidades, blog, paginas), que /sitemap.xml
// référence aussi directement (Google n'accepte pas un index dans un index).
//
// runtime='nodejs' aligné avec les autres routes sitemap (cf. app/sitemap.xml/route.ts).
export const runtime = 'nodejs'

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
  return new Response(formatSitemapIndexXml(urlsFichiersSitemapPt(baseUrl)), { headers: SITEMAP_HEADERS })
}
