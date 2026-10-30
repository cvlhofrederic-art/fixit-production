// @vitest-environment node
// tests/worker/cache-pages-publiques.test.ts — cache HTML des pages publiques dans le Worker (lot 7 Sentry du
// 28/10/2026) : décisions, copie stockée, réponse servie, rafraîchissement, et l'enveloppe complète avec un Worker
// OpenNext et un Cache API simulés.

import { describe, expect, it, vi } from 'vitest'
import { FLIGHT_HEADERS, NEXT_RSC_UNION_QUERY } from 'next/dist/client/components/app-router-headers'
import {
  CACHE_ACCUEILS,
  CACHE_FICHES_ARTISAN,
  CACHE_PAGES_SEO,
  politiqueCachePage,
} from '@/lib/seo/routes-publiques'
import {
  EN_TETE_CACHE,
  EN_TETE_CACHE_CONTROL_ORIGINE,
  EN_TETE_DATE_CACHE,
  EN_TETES_ROUTEUR_NEXT,
  PARAMETRE_RSC,
  cacheControlNavigateur,
  cleCache,
  copiePourCache,
  creerGestionnaireAvecCache,
  decisionRequete,
  reponseDepuisCache,
  reponseStockable,
  requeteDeRafraichissement,
  type CacheMinimal,
  type EnvCache,
} from '@/worker/cache-pages-publiques'

const ORIGINE = 'https://vitfix.io'
const requete = (chemin: string, init: RequestInit = {}) => new Request(`${ORIGINE}${chemin}`, { method: 'GET', ...init })
const html = (corps = '<html>page</html>', entetes: Record<string, string> = {}) =>
  new Response(corps, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...entetes } })

describe('politiqueCachePage', () => {
  it('pages SEO, accueils et fiches artisan ont chacune leur politique ; le reste jamais', () => {
    expect(politiqueCachePage('/pt/servicos/canalizador-porto/')).toBe(CACHE_PAGES_SEO)
    expect(politiqueCachePage('/fr/blog/un-article/')).toBe(CACHE_PAGES_SEO)
    expect(politiqueCachePage('/pt/')).toBe(CACHE_ACCUEILS)
    expect(politiqueCachePage('/fr/')).toBe(CACHE_ACCUEILS)
    expect(politiqueCachePage('/fr/artisan/lepore-sebastien-la-ciotat/')).toBe(CACHE_FICHES_ARTISAN)
    expect(politiqueCachePage('/pt/profissional/abc/')).toBe(CACHE_FICHES_ARTISAN)
    for (const chemin of ['/', '/pt', '/fr/artisan/', '/fr/pro/dashboard/', '/api/health', '/fr/client/dashboard/', '/pt/pesquisar/', '/fr/simulateur-devis/']) {
      expect(politiqueCachePage(chemin), chemin).toBeNull()
    }
  })
})

describe('decisionRequete', () => {
  it('GET anonyme sur une page publique : cacheable, clé sans chaîne de requête, avec le déploiement', () => {
    const decision = decisionRequete(requete('/pt/servicos/canalizador-porto/?utm_source=x', { headers: { cookie: 'locale=pt' } }), 'abc123')
    expect(decision).toMatchObject({ cacheable: true, politique: CACHE_PAGES_SEO, forcerRafraichissement: false })
    expect((decision as { cle: string }).cle).toBe('https://vitfix.io/pt/servicos/canalizador-porto/?__vitfix_build=abc123')
    expect(cleCache(new URL('https://www.vitfix.io/fr/?a=1'), 'v2')).toBe('https://www.vitfix.io/fr/?__vitfix_build=v2')
  })

  it('cookie de session, méthode non GET, ou chemin hors liste : jamais de cache', () => {
    expect(decisionRequete(requete('/pt/servicos/x/', { headers: { cookie: 'sb-irluhepekbqgquveaett-auth-token=abc' } }), 'b')).toEqual({ cacheable: false, raison: 'session' })
    expect(decisionRequete(requete('/pt/servicos/x/', { headers: { cookie: 'locale=pt; sb-xyz-auth-token.0=abc' } }), 'b')).toEqual({ cacheable: false, raison: 'session' })
    expect(decisionRequete(requete('/pt/servicos/x/', { method: 'HEAD' }), 'b')).toEqual({ cacheable: false, raison: 'methode' })
    expect(decisionRequete(requete('/pt/servicos/x/', { method: 'POST' }), 'b')).toEqual({ cacheable: false, raison: 'methode' })
    expect(decisionRequete(requete('/fr/pro/dashboard/'), 'b')).toEqual({ cacheable: false, raison: 'chemin' })
  })

  it('rechargement forcé (Cache-Control: no-cache) : la page est rendue et remplace la copie', () => {
    const decision = decisionRequete(requete('/pt/', { headers: { 'cache-control': 'no-cache' } }), 'b')
    expect(decision).toMatchObject({ cacheable: true, forcerRafraichissement: true })
  })

  it('requête du routeur client Next (en-têtes RSC et de préchargement, paramètre _rsc) : jamais de cache', () => {
    const enTetes: Array<[string, string]> = [
      ['RSC', '1'],
      ['Next-Router-State-Tree', '%5B%22%22%2C%7B%7D%5D'],
      ['Next-Router-Prefetch', '1'],
      ['Next-Router-Segment-Prefetch', '/_tree'],
      ['Next-HMR-Refresh', '1'],
    ]
    for (const [nom, valeur] of enTetes) {
      expect(decisionRequete(requete('/pt/servicos/x/', { headers: { [nom]: valeur } }), 'b'), nom).toEqual({ cacheable: false, raison: 'rsc' })
    }
    for (const chemin of ['/pt/servicos/x/?_rsc=1a2b3', '/pt/servicos/x/?_rsc', '/pt/?utm_source=x&_rsc=abc']) {
      expect(decisionRequete(requete(chemin), 'b'), chemin).toEqual({ cacheable: false, raison: 'rsc' })
    }
    expect(decisionRequete(requete('/pt/servicos/x/?rsc=1'), 'b')).toMatchObject({ cacheable: true })
  })

  it('en-têtes et paramètre du routeur identiques à ceux de next installé (revérifiés à chaque montée de version)', () => {
    expect(new Set(EN_TETES_ROUTEUR_NEXT)).toEqual(new Set(FLIGHT_HEADERS))
    expect(PARAMETRE_RSC).toBe(NEXT_RSC_UNION_QUERY)
  })

  it('sans identifiant de déploiement : jamais de cache', () => {
    expect(decisionRequete(requete('/pt/servicos/x/'), null)).toEqual({ cacheable: false, raison: 'deploiement' })
    expect(decisionRequete(requete('/pt/servicos/x/'), '')).toEqual({ cacheable: false, raison: 'deploiement' })
  })
})

describe('reponseStockable et copiePourCache', () => {
  it('seul un 200 HTML sans cookie de session est stockable', () => {
    expect(reponseStockable(html())).toBe(true)
    expect(reponseStockable(html('', { 'set-cookie': 'locale=pt; Path=/' }))).toBe(true)
    expect(reponseStockable(html('', { 'set-cookie': 'sb-abc-auth-token=xyz; Path=/' }))).toBe(false)
    expect(reponseStockable(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))).toBe(false)
    expect(reponseStockable(new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } }))).toBe(false)
    expect(reponseStockable(new Response(null, { status: 302, headers: { location: '/fr/' } }))).toBe(false)
  })

  it('la copie stockée perd Set-Cookie, prend une conservation longue et mémorise l’en-tête d’origine', async () => {
    const origine = html('<html>x</html>', { 'set-cookie': 'locale=pt; Path=/', 'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate', 'server-timing': 'worker;dur=5' })
    const copie = copiePourCache(origine, CACHE_PAGES_SEO, 1_000_000)
    expect(copie.headers.get('set-cookie')).toBeNull()
    expect(copie.headers.get('cache-control')).toBe('public, max-age=86400')
    expect(copie.headers.get(EN_TETE_CACHE_CONTROL_ORIGINE)).toBe('private, no-cache, no-store, max-age=0, must-revalidate')
    expect(copie.headers.get(EN_TETE_DATE_CACHE)).toBe('1000000')
    expect(copie.headers.get('server-timing')).toBeNull()
    expect(copie.headers.get('content-type')).toContain('text/html')
    await expect(copie.text()).resolves.toBe('<html>x</html>')
  })
})

describe('reponseDepuisCache', () => {
  it('HIT frais : Cache-Control public d’origine conservé, âge exposé', () => {
    const stockee = copiePourCache(html('<html>y</html>', { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400', 'vary': 'Cookie, Accept-Language' }), CACHE_PAGES_SEO, 1_000_000)
    const servie = reponseDepuisCache(stockee, CACHE_PAGES_SEO, 1_000_000 + 120_000)
    expect(servie).toMatchObject({ ageS: 120, perimee: false })
    expect(servie.reponse.headers.get(EN_TETE_CACHE)).toBe('HIT')
    expect(servie.reponse.headers.get('age')).toBe('120')
    expect(servie.reponse.headers.get('cache-control')).toBe('public, s-maxage=3600, stale-while-revalidate=86400')
    expect(servie.reponse.headers.get('vary')).toBe('Cookie, Accept-Language')
    expect(servie.reponse.headers.get(EN_TETE_CACHE_CONTROL_ORIGINE)).toBeNull()
    expect(servie.reponse.headers.get(EN_TETE_DATE_CACHE)).toBeNull()
  })

  it('STALE au-delà du délai de rafraîchissement ; `private, no-store` d’origine remplacé par la politique', () => {
    const stockee = copiePourCache(html('<html>accueil</html>', { 'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate' }), CACHE_ACCUEILS, 0)
    const servie = reponseDepuisCache(stockee, CACHE_ACCUEILS, 601_000)
    expect(servie).toMatchObject({ ageS: 601, perimee: true })
    expect(servie.reponse.headers.get(EN_TETE_CACHE)).toBe('STALE')
    expect(servie.reponse.headers.get('cache-control')).toBe(CACHE_ACCUEILS.cacheControl)
  })

  it('cacheControlNavigateur garde un en-tête public et remplace tout le reste', () => {
    expect(cacheControlNavigateur('public, s-maxage=60', CACHE_PAGES_SEO)).toBe('public, s-maxage=60')
    expect(cacheControlNavigateur('private, no-store', CACHE_PAGES_SEO)).toBe(CACHE_PAGES_SEO.cacheControl)
    expect(cacheControlNavigateur(null, CACHE_FICHES_ARTISAN)).toBe(CACHE_FICHES_ARTISAN.cacheControl)
  })
})

describe('requeteDeRafraichissement', () => {
  it('même URL, GET, sans cookie ni en-tête conditionnel, langue et agent conservés', () => {
    const r = requeteDeRafraichissement(requete('/pt/servicos/x/', {
      headers: { cookie: 'locale=pt', 'accept-language': 'pt-PT', 'user-agent': 'Mozilla/5.0', 'if-none-match': '"abc"', 'cache-control': 'no-cache' },
    }))
    expect(r.url).toBe('https://vitfix.io/pt/servicos/x/')
    expect(r.method).toBe('GET')
    expect(r.headers.get('cookie')).toBeNull()
    expect(r.headers.get('if-none-match')).toBeNull()
    expect(r.headers.get('cache-control')).toBeNull()
    expect(r.headers.get('accept-language')).toBe('pt-PT')
    expect(r.headers.get('user-agent')).toBe('Mozilla/5.0')
  })
})

// ── Enveloppe complète : Worker OpenNext et Cache API simulés ──
function cacheFactice(): CacheMinimal & { entrees: Map<string, Response> } {
  const entrees = new Map<string, Response>()
  const cle = (c: Request | string) => (typeof c === 'string' ? c : c.url)
  return {
    entrees,
    async match(c) { const r = entrees.get(cle(c)); return r ? r.clone() : undefined },
    async put(c, reponse) { entrees.set(cle(c), reponse) },
  }
}

function contexteFactice() {
  const attentes: Promise<unknown>[] = []
  return { ctx: { waitUntil: (p: Promise<unknown>) => { attentes.push(p) } }, async terminer() { await Promise.all(attentes) }, attentes }
}

describe('creerGestionnaireAvecCache', () => {
  const env = { VITFIX_BUILD_ID: 'build-1' }

  it('MISS puis HIT : le Worker OpenNext n’est appelé qu’une fois, le second visiteur reçoit la copie', async () => {
    const rendu = vi.fn(async () => html('<html>servicos</html>', { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400', 'set-cookie': 'locale=pt; Path=/' }))
    const cache = cacheFactice()
    let maintenant = 1_000_000
    const gestionnaire = creerGestionnaireAvecCache({ fetch: rendu }, () => cache, () => maintenant)

    const { ctx, terminer } = contexteFactice()
    const premiere = await gestionnaire.fetch(requete('/pt/servicos/canalizador-porto/'), env, ctx)
    await terminer()
    expect(premiere.headers.get(EN_TETE_CACHE)).toBe('MISS')
    expect(premiere.headers.get('server-timing')).toMatch(/^cache;desc=MISS, worker;dur=\d+$/)
    expect(premiere.headers.get('set-cookie')).toBe('locale=pt; Path=/')
    await expect(premiere.text()).resolves.toBe('<html>servicos</html>')
    expect(cache.entrees.has('https://vitfix.io/pt/servicos/canalizador-porto/?__vitfix_build=build-1')).toBe(true)

    maintenant += 10_000
    const seconde = await gestionnaire.fetch(requete('/pt/servicos/canalizador-porto/?utm=1'), env, contexteFactice().ctx)
    expect(rendu).toHaveBeenCalledTimes(1)
    expect(seconde.headers.get(EN_TETE_CACHE)).toBe('HIT')
    expect(seconde.headers.get('age')).toBe('10')
    expect(seconde.headers.get('set-cookie')).toBeNull()
    expect(seconde.headers.get('cache-control')).toBe('public, s-maxage=3600, stale-while-revalidate=86400')
    await expect(seconde.text()).resolves.toBe('<html>servicos</html>')
  })

  it('STALE : servie depuis le cache et rafraîchie en arrière-plan sans cookie', async () => {
    let version = 1
    const rendu = vi.fn(async (r: Request) => {
      expect(r.headers.get('cookie')).toBeNull()
      return html(`<html>v${version++}</html>`)
    })
    const cache = cacheFactice()
    let maintenant = 0
    const gestionnaire = creerGestionnaireAvecCache({ fetch: rendu }, () => cache, () => maintenant)

    const c1 = contexteFactice()
    await gestionnaire.fetch(requete('/pt/'), env, c1.ctx)
    await c1.terminer()

    maintenant = (CACHE_ACCUEILS.rafraichirApresS + 1) * 1000
    const c2 = contexteFactice()
    const perimee = await gestionnaire.fetch(requete('/pt/', { headers: { cookie: 'locale=pt' } }), env, c2.ctx)
    expect(perimee.headers.get(EN_TETE_CACHE)).toBe('STALE')
    await expect(perimee.text()).resolves.toBe('<html>v1</html>')
    expect(c2.attentes).toHaveLength(1)
    await c2.terminer()
    expect(rendu).toHaveBeenCalledTimes(2)

    const fraiche = await gestionnaire.fetch(requete('/pt/'), env, contexteFactice().ctx)
    expect(fraiche.headers.get(EN_TETE_CACHE)).toBe('HIT')
    await expect(fraiche.text()).resolves.toBe('<html>v2</html>')
  })

  it('BYPASS : session, méthode HEAD, chemin privé ; rien n’est stocké', async () => {
    const rendu = vi.fn(async () => html())
    const cache = cacheFactice()
    const gestionnaire = creerGestionnaireAvecCache({ fetch: rendu }, () => cache)
    const { ctx, terminer } = contexteFactice()
    const connecte = await gestionnaire.fetch(requete('/pt/servicos/x/', { headers: { cookie: 'sb-a-auth-token=1' } }), env, ctx)
    const prive = await gestionnaire.fetch(requete('/fr/pro/dashboard/'), env, ctx)
    const head = await gestionnaire.fetch(requete('/pt/servicos/x/', { method: 'HEAD' }), env, ctx)
    await terminer()
    for (const r of [connecte, prive, head]) {
      expect(r.headers.get(EN_TETE_CACHE)).toBe('BYPASS')
      expect(r.headers.get('server-timing')).toMatch(/^cache;desc=BYPASS, worker;dur=\d+$/)
    }
    expect(cache.entrees.size).toBe(0)
    expect(rendu).toHaveBeenCalledTimes(3)
  })

  it('routeur client Next (RSC: 1, ?_rsc=, Next-Router-Prefetch) sur une page en cache : BYPASS, réponse d’OpenNext telle quelle', async () => {
    const fluxRsc = '0:{"b":"build-1","f":[]}\n'
    const varyRsc = 'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
    const rendu = vi.fn(async (_requete: Request) => new Response(fluxRsc, { status: 200, headers: { 'content-type': 'text/x-component', vary: varyRsc } }))
    rendu.mockImplementationOnce(async () => html('<html>servicos</html>'))
    const cache = cacheFactice()
    const gestionnaire = creerGestionnaireAvecCache({ fetch: rendu }, () => cache)
    const c0 = contexteFactice()
    await gestionnaire.fetch(requete('/pt/servicos/canalizador-porto/'), env, c0.ctx)
    await c0.terminer()
    expect(cache.entrees.size).toBe(1)

    const requetesRouteur = [
      requete('/pt/servicos/canalizador-porto/', { headers: { RSC: '1', 'Next-Router-State-Tree': '%5B%22%22%5D' } }),
      requete('/pt/servicos/canalizador-porto/?_rsc=1a2b3'),
      requete('/pt/servicos/canalizador-porto/', { headers: { 'Next-Router-Prefetch': '1' } }),
    ]
    for (const [i, requeteRouteur] of requetesRouteur.entries()) {
      const c = contexteFactice()
      const r = await gestionnaire.fetch(requeteRouteur, env, c.ctx)
      await c.terminer()
      expect(r.headers.get(EN_TETE_CACHE), requeteRouteur.url).toBe('BYPASS')
      expect(r.headers.get('server-timing')).toMatch(/^cache;desc=BYPASS, worker;dur=\d+$/)
      expect(r.status).toBe(200)
      expect(r.headers.get('content-type')).toBe('text/x-component')
      expect(r.headers.get('vary')).toBe(varyRsc)
      await expect(r.text()).resolves.toBe(fluxRsc)
      // OpenNext reçoit la requête d'origine, en-têtes et `_rsc` compris.
      expect(rendu.mock.calls[i + 1][0]).toBe(requeteRouteur)
    }
    expect(rendu).toHaveBeenCalledTimes(1 + requetesRouteur.length)

    // La copie HTML n'a été ni resservie ni remplacée : la visite HTML suivante reste un HIT.
    expect(cache.entrees.size).toBe(1)
    const suivante = await gestionnaire.fetch(requete('/pt/servicos/canalizador-porto/'), env, contexteFactice().ctx)
    expect(suivante.headers.get(EN_TETE_CACHE)).toBe('HIT')
    await expect(suivante.text()).resolves.toBe('<html>servicos</html>')
  })

  it('un 404, une redirection ou un Set-Cookie de session ne sont jamais stockés', async () => {
    const reponses = [
      new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } }),
      new Response(null, { status: 302, headers: { location: '/fr/' } }),
      html('<html>x</html>', { 'set-cookie': 'sb-a-auth-token=1' }),
    ]
    const rendu = vi.fn(async () => reponses.shift()!)
    const cache = cacheFactice()
    const gestionnaire = creerGestionnaireAvecCache({ fetch: rendu }, () => cache)
    const { ctx, terminer } = contexteFactice()
    for (let i = 0; i < 3; i++) await gestionnaire.fetch(requete('/pt/servicos/x/'), env, ctx)
    await terminer()
    expect(cache.entrees.size).toBe(0)
  })

  it('cache indisponible : la page est rendue comme avant', async () => {
    const rendu = vi.fn(async () => html())
    const gestionnaire = creerGestionnaireAvecCache({ fetch: rendu }, () => { throw new Error('caches indisponible') })
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = await gestionnaire.fetch(requete('/pt/servicos/x/'), env, contexteFactice().ctx)
    expect(r.status).toBe(200)
    expect(r.headers.get(EN_TETE_CACHE)).toBe('MISS')
    expect(avertissement).toHaveBeenCalled()
    avertissement.mockRestore()
  })

  it('env sans VITFIX_BUILD_ID → BYPASS, cache jamais lu ni écrit', async () => {
    // Deux déploiements faits sans `--var` (déploiement manuel) partagent le même Cache API : avec une clé de repli
    // commune, le nouveau resservait le HTML de l'ancien, dont les chunks ont disparu.
    const cache = cacheFactice()
    const lecture = vi.spyOn(cache, 'match')
    const ecriture = vi.spyOn(cache, 'put')
    const ouvertureCache = vi.fn(() => cache)
    const ancienBuild = creerGestionnaireAvecCache({ fetch: async () => html('<html>ancien build</html>') }, ouvertureCache)
    const nouveauBuild = creerGestionnaireAvecCache({ fetch: async () => html('<html>nouveau build</html>') }, ouvertureCache)
    const envsSansBuild: EnvCache[] = [{}, { VITFIX_BUILD_ID: '' }, { VITFIX_BUILD_ID: '   ' }, { VITFIX_BUILD_ID: 42 }]
    for (const envSansBuild of envsSansBuild) {
      for (const [gestionnaire, attendu] of [[ancienBuild, '<html>ancien build</html>'], [nouveauBuild, '<html>nouveau build</html>']] as const) {
        const { ctx, terminer } = contexteFactice()
        const r = await gestionnaire.fetch(requete('/pt/servicos/canalizador-porto/'), envSansBuild, ctx)
        await terminer()
        expect(r.headers.get(EN_TETE_CACHE), JSON.stringify(envSansBuild)).toBe('BYPASS')
        expect(r.headers.get('server-timing')).toMatch(/^cache;desc=BYPASS, worker;dur=\d+$/)
        await expect(r.text()).resolves.toBe(attendu)
      }
    }
    expect(ouvertureCache).not.toHaveBeenCalled()
    expect(lecture).not.toHaveBeenCalled()
    expect(ecriture).not.toHaveBeenCalled()
    expect(cache.entrees.size).toBe(0)
  })

  it('rechargement forcé : la copie est remplacée, puis resservie', async () => {
    let version = 1
    const rendu = vi.fn(async () => html(`<html>v${version++}</html>`))
    const cache = cacheFactice()
    const gestionnaire = creerGestionnaireAvecCache({ fetch: rendu }, () => cache)
    const c1 = contexteFactice()
    await gestionnaire.fetch(requete('/fr/blog/a/'), env, c1.ctx)
    await c1.terminer()
    const c2 = contexteFactice()
    const forcee = await gestionnaire.fetch(requete('/fr/blog/a/', { headers: { 'cache-control': 'no-cache' } }), env, c2.ctx)
    await c2.terminer()
    expect(forcee.headers.get(EN_TETE_CACHE)).toBe('MISS')
    const suivante = await gestionnaire.fetch(requete('/fr/blog/a/'), env, contexteFactice().ctx)
    await expect(suivante.text()).resolves.toBe('<html>v2</html>')
  })
})
