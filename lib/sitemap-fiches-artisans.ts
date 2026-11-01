// Sous-sitemap 4 (/sitemap/4.xml) : fiches publiques FR des artisans vérifiés, lues dans profiles_artisan. L'index
// /sitemap.xml ne le déclare que s'il liste au moins une fiche (même fonction, donc même filtre).
//
// La requête ne nomme que des colonnes présentes en production : une seule colonne absente fait échouer toute la
// lecture (PostgREST 42703) et le sitemap sort vide. Relevé du 31/10/2026 : org_role et is_verified n'existent pas,
// et country, déclarée par les migrations (052), manque dans la table de production.
// - verified + active : fiche vérifiée et publique (la lecture anonyme ne voit de toute façon que active = true, RLS) ;
// - language : les fiches PT ('pt') sont hors de ce sitemap : une URL PT n'a sa place que dans un /pt/sitemap-*.xml,
//   et aucun ne liste de fiche pour l'instant (/pt/profissional/ est en noindex ; un sitemap PT des sociétés,
//   /pt/empresa/, reste à décider). Les autres sortent sous /fr/artisan/<slug>/, leur canonique
//   (app/fr/artisan/[id]/layout.tsx), société comprise.
//
// Règles : une seule URL par fiche ; pas de `lastmod`, faute de vraie date de contenu (lib/sitemap-helpers.ts) : le
// trigger trg_profiles_artisan_updated_at remet updated_at à l'heure à chaque mise à jour de la ligne, dont
// last_seen_at à chaque ouverture du tableau de bord pro.

import { createServerSupabaseClient } from './supabase-server-component'
import { logger } from './logger'
import { type SitemapUrl } from './sitemap-helpers'
import { getProfilePath } from './utils'

interface FicheSitemap {
  id: string
  slug: string | null
  language: string | null
}

export async function fichesArtisansSitemap(baseUrl: string): Promise<SitemapUrl[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('profiles_artisan')
      .select('id, slug, language')
      .eq('verified', true)
      .eq('active', true)
    // supabase-js ne lève pas d'exception sur une erreur de requête : elle arrive dans `error`.
    if (error) {
      logger.warn('[sitemap] fiches artisans indisponibles', error)
      return []
    }
    return ((data || []) as FicheSitemap[])
      .filter((fiche) => fiche.language !== 'pt')
      .map((fiche) => ({ url: `${baseUrl}${getProfilePath(fiche, 'fr')}/` }))
  } catch (error) {
    // Sitemap des fiches vide plutôt qu'en erreur, mais la panne reste visible dans les logs.
    logger.warn('[sitemap] fiches artisans indisponibles', error)
    return []
  }
}
