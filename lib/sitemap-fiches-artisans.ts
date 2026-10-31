// Sous-sitemap 4 (/sitemap/4.xml) : fiches publiques des artisans vérifiés, lues dans profiles_artisan. L'index
// /sitemap.xml ne le déclare que s'il liste au moins une fiche (même fonction, donc même filtre).
//
// La requête ne nomme que des colonnes présentes en production : une seule colonne absente fait échouer toute la
// lecture (PostgREST 42703) et le sitemap sort vide. Relevé du 31/10/2026 : org_role et is_verified n'existent pas,
// et country, déclarée par les migrations (052), manque dans la table de production.
// - verified + active : fiche vérifiée et publique (la lecture anonyme ne voit de toute façon que active = true, RLS) ;
// - language : 'pt' → fiche PT, sinon FR, comme la canonique de app/fr/artisan/[id]/layout.tsx ;
// - legal_form, en PT seulement : société → /pt/empresa/ (getProfilePath, estFormeSociete). En FR, toute fiche sort
//   sous /fr/artisan/<slug>/, sa canonique.
//
// Règles : une seule URL par fiche ; jamais d'URL noindex (les fiches individuelles PT, /pt/profissional/, sont en
// noindex, app/pt/profissional/[id]/page.tsx) ; pas de `lastmod`, faute de vraie date de contenu (lib/sitemap-helpers.ts) :
// le trigger trg_profiles_artisan_updated_at remet updated_at à l'heure à chaque mise à jour de la ligne, dont
// last_seen_at à chaque ouverture du tableau de bord pro.

import { createServerSupabaseClient } from './supabase-server-component'
import { logger } from './logger'
import { type SitemapUrl } from './sitemap-helpers'
import { estFormeSociete, getProfilePath } from './utils'

interface FicheSitemap {
  id: string
  slug: string | null
  legal_form: string | null
  language: string | null
}

export async function fichesArtisansSitemap(baseUrl: string): Promise<SitemapUrl[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('profiles_artisan')
      .select('id, slug, legal_form, language')
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
      result.push({ url: `${baseUrl}${getProfilePath(fiche, locale)}/` })
    }
    return result
  } catch (error) {
    // Sitemap des fiches vide plutôt qu'en erreur, mais la panne reste visible dans les logs.
    logger.warn('[sitemap] fiches artisans indisponibles', error)
    return []
  }
}
