/**
 * Routes publiques dont le HTML peut être mis en cache pour un visiteur sans session.
 *
 * Une seule liste, partagée par le middleware (en-tête Cache-Control) et par le Worker Cloudflare (cache HTML du
 * Worker, worker/cache-pages-publiques.ts). Module sans dépendance : importé par le middleware (edge) et par le
 * point d'entrée du Worker (bundle wrangler, sans alias « @/ »).
 *
 * Sécurité (review #138) :
 * - Préfixes volontairement limités à des sous-routes publiques identifiables (pas de wildcard sur une racine de
 *   locale entière) ;
 * - /fr/simulateur-devis/ EXCLU : peut contenir des résultats personnalisés ;
 * - /en/, /nl/, /es/ EXCLUS comme wildcards ; les sous-routes EN à cacher sont listées explicitement.
 */
export const SEO_PUBLIC_PREFIXES = [
  '/pt/servicos/', '/pt/cidade/', '/pt/blog/', '/pt/urgencia/',
  '/pt/perto-de-mim/', '/pt/precos/', '/pt/especialidades/',
  '/pt/condominio/', '/pt/avaliacoes/',
  '/fr/services/', '/fr/ville/', '/fr/blog/', '/fr/urgence/',
  '/fr/pres-de-chez-moi/', '/fr/specialites/', '/fr/copropriete/',
  '/en/services/', '/en/blog/', '/en/emergency-home-repair-porto/',
] as const

export function isSeoPublicRoute(pathname: string): boolean {
  return SEO_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/** Politique de cache HTML dans le Worker (durées en secondes) et Cache-Control envoyé au navigateur. */
export interface PolitiqueCachePage {
  /** Durée de conservation dans le cache du Worker. */
  conservationS: number
  /** Au-delà de cet âge, une réponse servie depuis le cache est rafraîchie en arrière-plan. */
  rafraichirApresS: number
  /** Cache-Control public envoyé au navigateur quand le rendu Next l'a laissé en `private, no-store`. */
  cacheControl: string
}

/** Pages SEO programmatiques (contenu dans des fichiers, aucune donnée de session). */
export const CACHE_PAGES_SEO: PolitiqueCachePage = {
  conservationS: 86_400,
  rafraichirApresS: 3_600,
  cacheControl: 'public, s-maxage=3600, stale-while-revalidate=86400',
}

/** Accueils par langue (rendu dynamique par le layout racine, contenu identique pour tout visiteur anonyme). */
export const CACHE_ACCUEILS: PolitiqueCachePage = {
  conservationS: 3_600,
  rafraichirApresS: 600,
  cacheControl: 'public, s-maxage=600, stale-while-revalidate=3600',
}

/** Fiches artisan publiques : coquille HTML + métadonnées ; le contenu est relu côté client. */
export const CACHE_FICHES_ARTISAN: PolitiqueCachePage = {
  conservationS: 600,
  rafraichirApresS: 120,
  cacheControl: 'public, s-maxage=120, stale-while-revalidate=600',
}

const ACCUEILS = new Set(['/fr/', '/pt/', '/en/', '/nl/', '/es/'])
const PREFIXES_FICHES_ARTISAN = ['/fr/artisan/', '/pt/profissional/', '/fr/societe/', '/pt/empresa/'] as const

/** Politique de cache d'un chemin, ou null si le HTML ne doit jamais être mis en cache. */
export function politiqueCachePage(pathname: string): PolitiqueCachePage | null {
  if (isSeoPublicRoute(pathname)) return CACHE_PAGES_SEO
  if (ACCUEILS.has(pathname)) return CACHE_ACCUEILS
  if (PREFIXES_FICHES_ARTISAN.some((prefix) => pathname.startsWith(prefix) && pathname.length > prefix.length)) {
    return CACHE_FICHES_ARTISAN
  }
  return null
}
