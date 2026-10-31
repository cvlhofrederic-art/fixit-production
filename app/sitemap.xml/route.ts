import { formatSitemapIndexXml, SITEMAP_HEADERS } from '@/lib/sitemap-helpers'
import { urlsFichiersSitemapPt } from '@/lib/sitemap-pt-pages'
import { fichesArtisansSitemap } from '@/lib/sitemap-fiches-artisans'

// runtime='nodejs' aligné avec le reste du codebase (toutes les routes API
// utilisent nodejs sur OpenNext + Cloudflare Workers). 'edge' causait un
// 500 Internal Server Error en production (OpenNext ne supporte pas
// pleinement le edge runtime pour les route handlers retournant Response).
export const runtime = 'nodejs'

// Sub-sitemaps fixes (toujours non vides) :
// 0: racine + hubs FR (les URL PT sont dans /pt/sitemap-*.xml depuis la phase 1 SEO PT)
// 2: routes programmatiques FR
// 3: pages investisseurs + EN/NL/ES
// (1 : ancien sous-sitemap PT, retiré de l'index ; la route répond 410)
const STATIC_SUB_SITEMAP_IDS = [0, 2, 3]

// 4: profils artisans vérifiés depuis Supabase (peut être vide selon volume).
// Inclus dynamiquement uniquement s'il liste au moins une fiche (même lecture que
// /sitemap/4.xml, lib/sitemap-fiches-artisans.ts), sinon Google rapporte
// "Couldn't read sitemap" sur un sub-sitemap vide. Une lecture en erreur est
// journalisée par fichesArtisansSitemap et compte comme un sitemap vide.
// Spec : https://www.sitemaps.org/protocol.html (un sitemap doit contenir au moins 1 <url>)
const DYNAMIC_ARTISAN_SITEMAP_ID = 4

// Sitemaps PT (phase 1 SEO PT, point 1.1) : un fichier par modèle (lib/sitemap-pt-pages.ts),
// référencés ici directement. /pt/sitemap.xml est l'index de ces mêmes fichiers pour la
// propriété GSC `https://vitfix.io/pt/` (Google n'accepte pas un index dans un index).

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
  const ids = [...STATIC_SUB_SITEMAP_IDS]
  if ((await fichesArtisansSitemap(baseUrl)).length > 0) {
    ids.push(DYNAMIC_ARTISAN_SITEMAP_ID)
  }
  const sitemapUrls = [
    ...ids.map((id) => `${baseUrl}/sitemap/${id}.xml`),
    ...urlsFichiersSitemapPt(baseUrl),
  ]
  const xml = formatSitemapIndexXml(sitemapUrls)
  return new Response(xml, { headers: SITEMAP_HEADERS })
}
