/**
 * Cache HTML des pages publiques dans le Worker Cloudflare (lot 7 de l'analyse Sentry du 28/10/2026).
 *
 * Constat : le layout racine lit cookies() et headers(), donc toutes les pages sont rendues à chaque requête ;
 * OpenNext tourne sans cache incrémental (dummy) et un Worker sur route s'exécute avant le cache CDN, si bien
 * que `Cache-Control: public, s-maxage=3600` n'était qu'un en-tête : TTFB p75 de 2,3 à 3,2 s sur les pages PT.
 *
 * Ici, pour un GET anonyme (aucun cookie de session) vers une page publique (lib/seo/routes-publiques.ts) :
 * - réponse 200 text/html sans Set-Cookie de session → copie stockée dans le Cache API du Worker, clé = URL
 *   sans chaîne de requête + identifiant de déploiement (VITFIX_BUILD_ID, posé par `wrangler deploy --var`) :
 *   un déploiement repart de zéro, l'ancien contenu n'est jamais resservi ;
 * - requête suivante → réponse depuis le cache (HIT) ; au-delà de `rafraichirApresS`, elle est servie quand même
 *   (STALE) et rafraîchie en arrière-plan (ctx.waitUntil) ;
 * - `Cache-Control` du navigateur : celui d'origine s'il est public, sinon celui de la politique (plus de
 *   `private, no-store` sur /pt/ pour un visiteur anonyme) ;
 * - `x-vitfix-cache` (HIT, STALE, MISS, BYPASS) et `Server-Timing` sur chaque réponse pour mesurer.
 *
 * Passent au Worker OpenNext sans que le cache soit lu ni écrit (BYPASS) :
 * - toute méthode autre que GET, tout chemin hors liste, toute requête avec un cookie `sb-*` / `supabase-auth` ;
 * - toute requête du routeur client Next (navigation douce, préchargement de lien) : en-têtes `RSC`,
 *   `Next-Router-State-Tree`, `Next-Router-Prefetch`, `Next-Router-Segment-Prefetch`, `Next-HMR-Refresh`, ou
 *   paramètre `_rsc`. La même URL rend alors un flux RSC (text/x-component) ; la copie HTML servie à sa place
 *   forcerait une navigation complète et ferait télécharger tout le HTML à chaque préchargement ;
 * - tout déploiement sans VITFIX_BUILD_ID (absent ou vide : `wrangler deploy` manuel, sans `--var`) : une clé de
 *   repli serait commune à tous ces déploiements, et le HTML d'un ancien build (aux chunks disparus) resservi.
 * Une réponse qui n'est pas un 200 HTML n'est jamais stockée.
 */
import { politiqueCachePage, type PolitiqueCachePage } from '../lib/seo/routes-publiques'

export const EN_TETE_CACHE = 'x-vitfix-cache'
export const EN_TETE_DATE_CACHE = 'x-vitfix-cache-date'
export const EN_TETE_CACHE_CONTROL_ORIGINE = 'x-vitfix-cache-control-origine'

const COOKIES_SESSION = /(^|;\s*)(sb-|supabase-auth)/i
const EN_TETES_RAFRAICHISSEMENT = ['accept', 'accept-language', 'user-agent', 'cf-connecting-ip', 'cf-ipcountry', 'x-forwarded-proto'] as const

/**
 * Marques d'une requête du routeur client Next, qui attend un flux RSC et non le HTML de la page : `FLIGHT_HEADERS`
 * et `NEXT_RSC_UNION_QUERY` de next/dist/client/components/app-router-headers.js (next 16.4.2). Le test du Worker
 * compare cette liste à celle du next installé, montées de version comprises.
 */
export const EN_TETES_ROUTEUR_NEXT = ['rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-hmr-refresh', 'next-router-segment-prefetch'] as const
export const PARAMETRE_RSC = '_rsc'

export type DecisionRequete =
  | { cacheable: true; politique: PolitiqueCachePage; cle: string; forcerRafraichissement: boolean }
  | { cacheable: false; raison: 'methode' | 'chemin' | 'rsc' | 'session' | 'deploiement' }

/**
 * Clé de cache : origine + chemin, sans chaîne de requête (les pages publiques ne la lisent pas, et les requêtes RSC,
 * `_rsc` compris, sont écartées avant), plus le déploiement.
 */
export function cleCache(url: URL, buildId: string): string {
  return `${url.origin}${url.pathname}?__vitfix_build=${encodeURIComponent(buildId)}`
}

/** Requête du routeur client Next (navigation douce, préchargement) : un en-tête de la liste ou le paramètre `_rsc`. */
function requeteRouteurNext(request: Request, url: URL): boolean {
  return url.searchParams.has(PARAMETRE_RSC) || EN_TETES_ROUTEUR_NEXT.some((nom) => request.headers.has(nom))
}

/** `buildId` : identifiant du déploiement, ou null s'il manque (le cache n'est alors ni lu ni écrit). */
export function decisionRequete(request: Request, buildId: string | null): DecisionRequete {
  if (request.method !== 'GET') return { cacheable: false, raison: 'methode' }
  const url = new URL(request.url)
  const politique = politiqueCachePage(url.pathname)
  if (!politique) return { cacheable: false, raison: 'chemin' }
  // Flux RSC attendu : la copie HTML ne doit jamais le remplacer (navigation complète, HTML entier téléchargé).
  if (requeteRouteurNext(request, url)) return { cacheable: false, raison: 'rsc' }
  if (COOKIES_SESSION.test(request.headers.get('cookie') ?? '')) return { cacheable: false, raison: 'session' }
  if (!buildId) return { cacheable: false, raison: 'deploiement' }
  // Rechargement forcé par l'utilisateur (Ctrl+F5) : on rend la page et on remplace la copie en cache.
  const cacheControl = request.headers.get('cache-control') ?? ''
  const forcerRafraichissement = /no-cache|no-store/i.test(cacheControl) || request.headers.get('pragma') === 'no-cache'
  return { cacheable: true, politique, cle: cleCache(url, buildId), forcerRafraichissement }
}

function setCookies(entetes: Headers): string[] {
  const avecGetSetCookie = entetes as Headers & { getSetCookie?: () => string[] }
  if (typeof avecGetSetCookie.getSetCookie === 'function') return avecGetSetCookie.getSetCookie()
  const brut = entetes.get('set-cookie')
  return brut ? [brut] : []
}

/** Une réponse n'est stockée que si c'est un 200 HTML sans cookie de session. */
export function reponseStockable(response: Response): boolean {
  if (response.status !== 200) return false
  if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('text/html')) return false
  return !setCookies(response.headers).some((cookie) => /^\s*(sb-|supabase-auth)/i.test(cookie))
}

/**
 * Copie à stocker : sans Set-Cookie (le cookie `locale` est resservi par le middleware à la prochaine visite non
 * cachée), Cache-Control fixé pour le Cache API, date de stockage et Cache-Control d'origine mémorisés.
 */
export function copiePourCache(response: Response, politique: PolitiqueCachePage, maintenant: number = Date.now()): Response {
  const entetes = new Headers(response.headers)
  entetes.delete('set-cookie')
  entetes.set(EN_TETE_CACHE_CONTROL_ORIGINE, response.headers.get('cache-control') ?? '')
  entetes.set('cache-control', `public, max-age=${politique.conservationS}`)
  entetes.set(EN_TETE_DATE_CACHE, String(maintenant))
  entetes.delete(EN_TETE_CACHE)
  entetes.delete('server-timing')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: entetes })
}

/** Cache-Control envoyé au navigateur : l'en-tête d'origine s'il est public, sinon celui de la politique. */
export function cacheControlNavigateur(origine: string | null, politique: PolitiqueCachePage): string {
  if (origine && /\bpublic\b/i.test(origine)) return origine
  return politique.cacheControl
}

export interface ReponseServieDepuisCache {
  reponse: Response
  ageS: number
  perimee: boolean
}

/** Réponse servie depuis le cache : en-têtes d'origine rétablis, état (HIT ou STALE) et âge visibles. */
export function reponseDepuisCache(enCache: Response, politique: PolitiqueCachePage, maintenant: number = Date.now()): ReponseServieDepuisCache {
  const brut = enCache.headers.get(EN_TETE_DATE_CACHE)
  const date = brut === null ? Number.NaN : Number(brut)
  const ageS = Number.isFinite(date) ? Math.max(0, Math.round((maintenant - date) / 1000)) : 0
  const perimee = ageS >= politique.rafraichirApresS
  const entetes = new Headers(enCache.headers)
  entetes.set('cache-control', cacheControlNavigateur(entetes.get(EN_TETE_CACHE_CONTROL_ORIGINE), politique))
  entetes.delete(EN_TETE_CACHE_CONTROL_ORIGINE)
  entetes.delete(EN_TETE_DATE_CACHE)
  entetes.set(EN_TETE_CACHE, perimee ? 'STALE' : 'HIT')
  entetes.set('age', String(ageS))
  return {
    reponse: new Response(enCache.body, { status: enCache.status, statusText: enCache.statusText, headers: entetes }),
    ageS,
    perimee,
  }
}

/** Requête de rafraîchissement en arrière-plan : même URL, GET, sans cookie ni en-tête conditionnel. */
export function requeteDeRafraichissement(request: Request): Request {
  const entetes = new Headers()
  for (const nom of EN_TETES_RAFRAICHISSEMENT) {
    const valeur = request.headers.get(nom)
    if (valeur) entetes.set(nom, valeur)
  }
  return new Request(request.url, { method: 'GET', headers: entetes })
}

export interface CacheMinimal {
  match(cle: Request | string): Promise<Response | undefined>
  put(cle: Request | string, reponse: Response): Promise<void>
}

export interface ContexteExecution {
  waitUntil(promesse: Promise<unknown>): void
}

export interface Gestionnaire<Env> {
  fetch(request: Request, env: Env, ctx: ContexteExecution): Promise<Response>
}

export interface EnvCache {
  /** Posé par `wrangler deploy --var VITFIX_BUILD_ID:<sha>` (deploy-cloudflare.yml) ; absent → cache contourné. */
  VITFIX_BUILD_ID?: unknown
}

function avecEntetes(reponse: Response, entetes: Record<string, string>): Response {
  const copie = new Response(reponse.body, reponse)
  for (const [nom, valeur] of Object.entries(entetes)) copie.headers.set(nom, valeur)
  return copie
}

/**
 * Identifiant du déploiement (VITFIX_BUILD_ID non vide), sinon null. Jamais de valeur de repli : elle serait commune
 * à tous les déploiements faits sans `--var`, et le HTML d'un ancien build serait resservi pendant sa conservation.
 */
function identifiantDeploiement(env: EnvCache): string | null {
  const valeur = env.VITFIX_BUILD_ID
  if (typeof valeur !== 'string') return null
  const identifiant = valeur.trim()
  return identifiant.length > 0 ? identifiant : null
}

/**
 * Enveloppe le Worker OpenNext : cache HTML des pages publiques, en-têtes de mesure, et rien d'autre. Toute
 * erreur du cache lui-même est ignorée : au pire la page est rendue comme avant.
 */
export function creerGestionnaireAvecCache<Env extends EnvCache>(
  opennext: Gestionnaire<Env>,
  cacheParDefaut: () => CacheMinimal,
  horloge: () => number = Date.now,
): Gestionnaire<Env> {
  async function rafraichir(request: Request, env: Env, ctx: ContexteExecution, cle: string, politique: PolitiqueCachePage): Promise<void> {
    try {
      const reponse = await opennext.fetch(requeteDeRafraichissement(request), env, ctx)
      if (reponseStockable(reponse)) await cacheParDefaut().put(cle, copiePourCache(reponse, politique, horloge()))
    } catch (erreur) {
      console.warn('[cache-pages] rafraîchissement en arrière-plan impossible :', erreur instanceof Error ? erreur.message : erreur)
    }
  }

  return {
    async fetch(request, env, ctx) {
      const debut = horloge()
      const decision = decisionRequete(request, identifiantDeploiement(env))

      if (!decision.cacheable) {
        const reponse = await opennext.fetch(request, env, ctx)
        return avecEntetes(reponse, { [EN_TETE_CACHE]: 'BYPASS', 'server-timing': `cache;desc=BYPASS, worker;dur=${horloge() - debut}` })
      }

      let cache: CacheMinimal | null = null
      let enCache: Response | undefined
      try {
        cache = cacheParDefaut()
        if (!decision.forcerRafraichissement) enCache = await cache.match(decision.cle)
      } catch (erreur) {
        console.warn('[cache-pages] cache indisponible :', erreur instanceof Error ? erreur.message : erreur)
        cache = null
      }

      if (enCache) {
        const servie = reponseDepuisCache(enCache, decision.politique, horloge())
        if (servie.perimee) ctx.waitUntil(rafraichir(request, env, ctx, decision.cle, decision.politique))
        const etat = servie.perimee ? 'STALE' : 'HIT'
        return avecEntetes(servie.reponse, { 'server-timing': `cache;desc=${etat}, worker;dur=${horloge() - debut}` })
      }

      const reponse = await opennext.fetch(request, env, ctx)
      const dureeMs = horloge() - debut
      if (cache && reponseStockable(reponse)) {
        const copie = copiePourCache(reponse.clone(), decision.politique, horloge())
        const cacheCible = cache
        ctx.waitUntil(cacheCible.put(decision.cle, copie).catch((erreur: unknown) => {
          console.warn('[cache-pages] mise en cache impossible :', erreur instanceof Error ? erreur.message : erreur)
        }))
      }
      return avecEntetes(reponse, { [EN_TETE_CACHE]: 'MISS', 'server-timing': `cache;desc=MISS, worker;dur=${dureeMs}` })
    },
  }
}
