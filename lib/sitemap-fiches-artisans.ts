// Sous-sitemap 4 (/sitemap/4.xml) : fiches publiques des artisans vérifiés, lues dans profiles_artisan. L'index
// /sitemap.xml ne le déclare que s'il liste au moins une fiche (même fonction, donc même filtre).
//
// La requête ne nomme que des colonnes présentes en production : une seule colonne absente fait échouer toute la
// lecture (PostgREST 42703) et le sitemap sort vide. Relevé du 31/10/2026 : org_role et is_verified n'existent pas,
// et country, déclarée par les migrations (052), manque dans la table de production.
// - verified + active : fiche vérifiée et publique (la lecture anonyme ne voit de toute façon que active = true, RLS) ;
// - language : 'pt' → fiche PT, sinon FR, comme la canonique de app/fr/artisan/[id]/layout.tsx ;
// - legal_form : société → /fr/societe/ ou /pt/empresa/, sinon fiche artisan (getProfilePath, estFormeSociete).
//
// Règles : une seule URL par fiche ; jamais d'URL noindex (les fiches individuelles PT, /pt/profissional/, sont en
// noindex, app/pt/profissional/[id]/page.tsx) ; `lastmod` seulement si updated_at est renseigné.

import { createServerSupabaseClient } from './supabase-server-component'
import { logger } from './logger'
import { type SitemapUrl } from './sitemap-helpers'
import { estFormeSociete, getProfilePath } from './utils'

interface FicheSitemap {
  id: string
  slug: string | null
  updated_at: string | null
  legal_form: string | null
  language: string | null
}

export async function fichesArtisansSitemap(baseUrl: string): Promise<SitemapUrl[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('profiles_artisan')
      .select('id, slug, updated_at, legal_form, language')
      .eq('verified', true)
      .eq('active', true)
    // supabase-js ne lève pas d'exception sur une erreur de requête : elle arrive dans `error`.
    if (error) {
      logger.warn('[sitemap] fiches artisans indisponibles', error)
      return []
    }
    const result: SitemapUrl[] = []
    for (const fiche of (data || []) as FicheSitemap[]) {
      const locale = fiche.language === 'pt' ? 'pt' : 'fr'
      if (locale === 'pt' && !estFormeSociete(fiche.legal_form)) continue
      result.push({
        url: `${baseUrl}${getProfilePath(fiche, locale)}/`,
        lastModified: fiche.updated_at ? new Date(fiche.updated_at) : undefined,
      })
    }
    return result
  } catch (error) {
    // Sitemap des fiches vide plutôt qu'en erreur, mais la panne reste visible dans les logs.
    logger.warn('[sitemap] fiches artisans indisponibles', error)
    return []
  }
}
