// Colonnes de profiles_artisan que les pages publiques lisent avec la clé publique du site (rôle anon) : fiche
// (/fr/artisan, /fr/societe, /pt/profissional, /pt/empresa), recherche, réservation, confirmation, métadonnées et
// JSON-LD des fiches, sitemap. Chaque page ne lit plus que les colonnes qu'elle affiche, jamais `select('*')`.
//
// Uniquement des colonnes présentes en production (relevé du 31/10/2026, repris dans
// tests/helpers/colonnes-profiles-artisan.ts) : une seule colonne absente fait échouer toute la lecture (PostgREST
// 42703). portfolio_photos et city, que la fiche sait afficher, n'existent pas en production : la fiche les recevait
// déjà vides, elles restent hors liste.
//
// email et phone : affichés sur la carte de visite de la fiche publique, donc dans la liste tant que la fiche les
// montre (les retirer de la fiche est une décision de produit, pas un correctif).
//
// COLONNES_LECTURE_ANONYME est ce que la migration 20261115_profiles_artisan_lecture_anonyme.sql laisse lire au rôle
// anon : une nouvelle lecture publique doit s'y limiter, ou la migration doit être complétée avant son déploiement.
//
// Les sélections sont écrites en toutes lettres : supabase-js ne type le résultat que d'une chaîne littérale.

/** Fiche publique (app/fr/artisan/[id]/page.tsx, partagée par les quatre adresses de fiche). */
export const SELECT_FICHE_PUBLIQUE = 'id, slug, company_name, bio, categories, legal_form, siret, naf_code, naf_label, company_address, company_city, company_postal_code, phone, email, profile_photo_url, rating_avg, rating_count, verified, zone_radius_km, intervention_zones'

/** Recherche (app/fr/recherche/page.tsx) : carte d'un pro, distance, zones, fiche d'annuaire sans compte. */
export const SELECT_RECHERCHE_PUBLIQUE = 'id, user_id, slug, company_name, bio, categories, hourly_rate, rating_avg, rating_count, verified, active, zone_radius_km, profile_photo_url, latitude, longitude, legal_form, intervention_zones, company_city, company_postal_code, phone, language, services(*)'

/** Réservation (app/fr/reserver/page.tsx) : nom du pro. */
export const SELECT_RESERVATION_PUBLIQUE = 'id, company_name'

/** Confirmation de réservation (app/(commun)/confirmation/page.tsx) : nom, métiers, note. */
export const SELECT_CONFIRMATION_PUBLIQUE = 'id, company_name, categories, rating_avg, rating_count'

/** Colonnes de profiles_artisan d'une sélection (les tables jointes, comme services(*), sont écartées). */
export function colonnesSelection(selection: string): string[] {
  return selection.split(',').map((c) => c.trim()).filter((c) => c && !c.includes('('))
}

export const COLONNES_FICHE_PUBLIQUE = colonnesSelection(SELECT_FICHE_PUBLIQUE)
export const COLONNES_RECHERCHE_PUBLIQUE = colonnesSelection(SELECT_RECHERCHE_PUBLIQUE)
export const COLONNES_RESERVATION_PUBLIQUE = colonnesSelection(SELECT_RESERVATION_PUBLIQUE)
export const COLONNES_CONFIRMATION_PUBLIQUE = colonnesSelection(SELECT_CONFIRMATION_PUBLIQUE)

/** Lectures serveur avec la clé publique : métadonnées, JSON-LD et existence des fiches (lib/seo/fiche-artisan.ts),
 * sitemap des fiches (lib/sitemap-fiches-artisans.ts, colonnes lues et filtrées). */
export const COLONNES_LECTURES_SERVEUR_PUBLIQUES: readonly string[] = [
  'id', 'slug', 'language', 'legal_form', 'company_name', 'bio', 'categories', 'company_city', 'rating_avg',
  'rating_count', 'profile_photo_url', 'latitude', 'longitude', 'phone', 'verified', 'active',
]

/**
 * Union des colonnes ci-dessus, triée : ce que le rôle anon peut lire une fois la migration appliquée.
 * Tri par ordre des caractères, identique au tri par défaut (comparateur explicite, SonarCloud S2871).
 */
export const COLONNES_LECTURE_ANONYME: readonly string[] = [...new Set([
  ...COLONNES_FICHE_PUBLIQUE,
  ...COLONNES_RECHERCHE_PUBLIQUE,
  ...COLONNES_RESERVATION_PUBLIQUE,
  ...COLONNES_CONFIRMATION_PUBLIQUE,
  ...COLONNES_LECTURES_SERVEUR_PUBLIQUES,
])].sort((a, b) => { if (a === b) return 0; return a < b ? -1 : 1 })
