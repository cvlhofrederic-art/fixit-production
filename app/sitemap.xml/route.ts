import { formatSitemapIndexXml, SITEMAP_HEADERS } from '@/lib/sitemap-helpers'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'

// runtime='nodejs' aligné avec le reste du codebase (toutes les routes API
// utilisent nodejs sur OpenNext + Cloudflare Workers). 'edge' causait un
// 500 Internal Server Error en production (OpenNext ne supporte pas
// pleinement le edge runtime pour les route handlers retournant Response).
export const runtime = 'nodejs'

// Sub-sitemaps fixes (toujours non vides) :
// 0: hub statiques + landing pages
// 1: routes programmatiques PT (cidade × services)
// 2: routes programmatiques FR
// 3: pages investisseurs + EN/NL/ES
const STATIC_SUB_SITEMAP_IDS = [0, 1, 2, 3]

// 4: profils artisans vérifiés depuis Supabase (peut être vide selon volume).
// Inclus dynamiquement uniquement s'il y a au moins 1 artisan vérifié,
// sinon Google rapporte "Couldn't read sitemap" sur un sub-sitemap vide.
// Spec : https://www.sitemaps.org/protocol.html (un sitemap doit contenir au moins 1 <url>)
const DYNAMIC_ARTISAN_SITEMAP_ID = 4

// Sitemaps additionnels par marché (URL prefix pattern) :
// - /pt/sitemap.xml : sitemap PT-only soumis à la propriété GSC URL prefix
//   `https://vitfix.io/pt/`. Référencé ici pour que la propriété racine puisse
//   aussi suivre l'état PT et conserver un reporting granulaire en cas de
//   problème transient sur les sub-sitemaps numériques.
// - À ajouter quand on lancera FR/EN comme propriétés GSC séparées.
const MARKET_SITEMAPS = ['/pt/sitemap.xml']

async function hasVerifiedArtisans(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient()
    const { count, error } = await supabase
      .from('profiles_artisan')
      .select('id', { count: 'exact', head: true })
      .eq('is_verified', true)
    if (error) return false
    return (count ?? 0) > 0
  } catch {
    return false
  }
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
  const ids = [...STATIC_SUB_SITEMAP_IDS]
  if (await hasVerifiedArtisans()) {
    ids.push(DYNAMIC_ARTISAN_SITEMAP_ID)
  }
  const sitemapUrls = [
    ...ids.map((id) => `${baseUrl}/sitemap/${id}.xml`),
    ...MARKET_SITEMAPS.map((path) => `${baseUrl}${path}`),
  ]
  const xml = formatSitemapIndexXml(sitemapUrls)
  return new Response(xml, { headers: SITEMAP_HEADERS })
}
