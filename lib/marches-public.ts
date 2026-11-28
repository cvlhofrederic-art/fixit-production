/**
 * Ce qu'un appel d'offres montre SANS connexion : la liste (`GET /api/marches`) et la fiche (`GET /api/marches/[id]`).
 *
 * Liste blanche, une seule fois pour les deux routes. N'y figurent jamais : la clé de gestion (`access_token`),
 * les coordonnées du publieur (`publisher_email`, `publisher_phone`), les identifiants de compte
 * (`publisher_user_id`, `matched_artisans`, `btp_company_id`) ni l'adresse précise des travaux
 * (`location_address`, `immeuble_adresse`). Une colonne ajoutée à la table reste donc privée tant qu'elle n'est pas
 * inscrite ici.
 */
export const COLONNES_PUBLIQUES_MARCHE = [
  'id', 'title', 'description', 'category', 'publisher_name', 'publisher_type', 'location_city', 'location_postal',
  'location_lat', 'location_lng', 'budget_min', 'budget_max', 'deadline', 'urgency', 'photos', 'candidatures_count',
  'max_candidatures', 'require_rc_pro', 'require_decennale', 'require_rge', 'require_qualibat', 'preferred_work_mode',
  'status', 'created_at', 'pays', 'zone_test', 'district', 'concelho', 'departement', 'source', 'source_id',
  'url_source', 'acheteur', 'procedure_type', 'montant_estime', 'langue', 'source_type', 'btp_company_name',
  'mission_type', 'start_date', 'duration_text', 'nb_intervenants_souhaite',
] as const

/** Les mêmes colonnes, au format attendu par `.select()`. */
export const SELECT_PUBLIC_MARCHE = COLONNES_PUBLIQUES_MARCHE.join(', ')

/** Ne garde d'une ligne de `marches` que ses colonnes publiques. */
export function vuePubliqueMarche(marche: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(COLONNES_PUBLIQUES_MARCHE.filter(colonne => colonne in marche).map(colonne => [colonne, marche[colonne]]))
}

/**
 * À l'inverse, l'en-tête `Cache-Control` de toute réponse propre à un compte sur `/api/marches` et ses sous-routes
 * (ses offres et leurs clés de gestion, ses candidatures, ses messages, ses évaluations) : elle n'est gardée par
 * aucun cache, ni navigateur ni mandataire.
 */
export const CACHE_PERSONNEL = 'private, no-store'
