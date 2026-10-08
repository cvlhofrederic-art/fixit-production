/**
 * POST /api/auth/logout — déconnexion côté serveur.
 *
 * Avant : aucune déconnexion n'existait côté serveur. Un navigateur dont la session Supabase ne se laissait plus
 * fermer côté client (getUser en échec, page bloquée sur son squelette, aucun bouton) gardait ses cookies sb-* : la
 * page de connexion le renvoyait d'office vers le tableau de bord.
 * La route ferme la session Supabase en portée locale, puis supprime quoi qu'il arrive chaque cookie sb-* de la
 * requête ET de la réponse (y compris les morceaux .0/.1 et ceux que Supabase vient d'écrire). Elle ne touche à aucun
 * autre cookie et à aucune donnée du compte.
 * Le client Supabase est simulé : on teste la réponse HTTP et les en-têtes Set-Cookie.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type CookieAEcrire = { name: string; value: string; options: Record<string, unknown> }
type AdaptateurCookies = {
  getAll: () => { name: string; value: string }[]
  setAll: (cookies: CookieAEcrire[]) => void
}

const simul = vi.hoisted(() => ({
  signOut: vi.fn(),
  warn: vi.fn(),
  adaptateur: null as AdaptateurCookies | null,
  createServerClient: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: (url: string, cle: string, options: { cookies: AdaptateurCookies }) => {
    simul.createServerClient(url, cle, options)
    simul.adaptateur = options.cookies
    return { auth: { signOut: simul.signOut } }
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: simul.warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const { POST, GET } = await import('@/app/api/auth/logout/route')

const SITE = 'https://vitfix.io'
const COOKIES_SESSION = [
  'sb-abcd-auth-token.0=base64-eyJhY2Nlc3NfdG9rZW4i',
  'sb-abcd-auth-token.1=fQ',
  'sb-abcd-auth-token-code-verifier=verif',
]
const NOMS_SESSION = ['sb-abcd-auth-token.0', 'sb-abcd-auth-token.1', 'sb-abcd-auth-token-code-verifier']
const COOKIES_AUTRES = ['locale=fr', '_ga=GA1.1.123', 'fixit_pref=1', 'xsb-faux=1']

type OptionsRequete = {
  methode?: string
  cookies?: string[]
  origin?: string | null
  accept?: string
  json?: unknown
  jsonBrut?: string
  formulaire?: string
}

function requete({
  methode = 'POST',
  cookies = [...COOKIES_SESSION, ...COOKIES_AUTRES],
  origin = SITE,
  accept,
  json,
  jsonBrut,
  formulaire,
}: OptionsRequete = {}): NextRequest {
  const entetes = new Headers()
  if (cookies.length) entetes.set('cookie', cookies.join('; '))
  if (origin !== null) entetes.set('origin', origin)
  if (accept) entetes.set('accept', accept)
  let corps: string | undefined
  if (json !== undefined || jsonBrut !== undefined) {
    entetes.set('content-type', 'application/json')
    corps = jsonBrut ?? JSON.stringify(json)
  } else if (formulaire !== undefined) {
    entetes.set('content-type', 'application/x-www-form-urlencoded')
    corps = formulaire
  }
  return new NextRequest(`${SITE}/api/auth/logout`, { method: methode, headers: entetes, body: corps })
}

/** En-têtes Set-Cookie de la réponse, groupés par nom de cookie. */
function cookiesPoses(reponse: Response): Map<string, string[]> {
  const parNom = new Map<string, string[]>()
  for (const ligne of reponse.headers.getSetCookie()) {
    const nom = ligne.slice(0, ligne.indexOf('='))
    parNom.set(nom, [...(parNom.get(nom) ?? []), ligne])
  }
  return parNom
}

function attendreSuppression(reponse: Response, noms: string[]) {
  const poses = cookiesPoses(reponse)
  for (const nom of noms) {
    const lignes = poses.get(nom)
    expect(lignes, `Set-Cookie absent pour ${nom}`).toBeDefined()
    expect(lignes, `un seul Set-Cookie pour ${nom}`).toHaveLength(1)
    const ligne = (lignes as string[])[0]
    expect(ligne.startsWith(`${nom}=;`), ligne).toBe(true)
    expect(ligne).toMatch(/;\s*Path=\/(;|$)/i)
    expect(ligne).toMatch(/;\s*Max-Age=0(;|$)/i)
    expect(ligne).toMatch(/;\s*Secure(;|$)/i)
    expect(ligne).toMatch(/;\s*SameSite=Lax(;|$)/i)
    expect(ligne).not.toMatch(/Domain=/i)
  }
}

function cheminLocation(reponse: Response): string | null {
  const location = reponse.headers.get('location')
  return location === null ? null : new URL(location, SITE).pathname
}

beforeEach(() => {
  simul.signOut.mockReset()
  simul.signOut.mockResolvedValue({ error: null })
  simul.warn.mockReset()
  simul.createServerClient.mockReset()
  simul.adaptateur = null
})

afterEach(() => {
  vi.useRealTimers()
})

describe('POST /api/auth/logout', () => {
  it('ferme la session Supabase en portée locale et redirige en 303 vers /fr/auth/login/, sans cache', async () => {
    const reponse = await POST(requete())
    expect(reponse.status).toBe(303)
    expect(cheminLocation(reponse)).toBe('/fr/auth/login/')
    expect(reponse.headers.get('cache-control')).toContain('no-store')
    expect(simul.signOut).toHaveBeenCalledTimes(1)
    expect(simul.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('ne redirige que vers un chemin du site, jamais vers un autre hôte', async () => {
    const reponse = await POST(requete({ json: { locale: 'pt' } }))
    const location = reponse.headers.get('location') as string
    expect(new URL(location, 'https://autre.example').host).toBe('autre.example')
  })

  it('donne au client Supabase les cookies de la requête', async () => {
    await POST(requete())
    expect(simul.createServerClient).toHaveBeenCalledTimes(1)
    const noms = simul.adaptateur?.getAll().map((c) => c.name) ?? []
    expect(noms).toEqual(expect.arrayContaining([...NOMS_SESSION, 'locale']))
  })

  it('supprime chaque cookie sb-* de la requête, morceaux .0/.1 et code-verifier compris', async () => {
    const reponse = await POST(requete())
    attendreSuppression(reponse, NOMS_SESSION)
  })

  it('ne touche à aucun autre cookie (langue, mesure d’audience, préférences)', async () => {
    const reponse = await POST(requete())
    const poses = cookiesPoses(reponse)
    for (const nom of ['locale', '_ga', 'fixit_pref', 'xsb-faux']) {
      expect(poses.has(nom), nom).toBe(false)
    }
  })

  it('reprend sur la réponse les cookies écrits par Supabase, sans doublon', async () => {
    simul.signOut.mockImplementation(async () => {
      simul.adaptateur?.setAll([
        { name: 'sb-abcd-auth-token', value: '', options: { path: '/', maxAge: 0, sameSite: 'lax' } },
        { name: 'sb-abcd-auth-token.0', value: '', options: { path: '/', maxAge: 0, sameSite: 'lax' } },
      ])
      return { error: null }
    })
    const reponse = await POST(requete())
    const poses = cookiesPoses(reponse)
    expect(poses.get('sb-abcd-auth-token')?.[0]).toMatch(/Max-Age=0/i)
    attendreSuppression(reponse, NOMS_SESSION)
  })

  it('supprime aussi un cookie sb-* que Supabase a posé sur la réponse sous un nom absent de la requête, puis erreur', async () => {
    // Jeton expiré : signOut rafraîchit d'abord la session (TOKEN_REFRESHED → setAll avec un nouveau découpage), puis
    // /logout échoue. Sans suppression forcée des noms de la RÉPONSE, la nouvelle session resterait dans le navigateur.
    simul.signOut.mockImplementation(async () => {
      simul.adaptateur?.setAll([
        { name: 'sb-abcd-auth-token', value: 'base64-nouvelle-session', options: { path: '/', maxAge: 34_560_000, sameSite: 'lax' } },
      ])
      return { error: { name: 'AuthRetryableFetchError', message: 'Service Unavailable', status: 503 } }
    })
    const reponse = await POST(requete({ accept: 'application/json' }))
    expect(reponse.status).toBe(200)
    attendreSuppression(reponse, ['sb-abcd-auth-token', ...NOMS_SESSION])
    expect(reponse.headers.getSetCookie().join('\n')).not.toContain('nouvelle-session')
    expect(simul.warn).toHaveBeenCalled()
  })

  it('supprime les cookies même si signOut lève une exception, et le journalise', async () => {
    simul.signOut.mockRejectedValue(new TypeError('fetch failed'))
    const reponse = await POST(requete())
    expect(reponse.status).toBe(303)
    expect(cheminLocation(reponse)).toBe('/fr/auth/login/')
    attendreSuppression(reponse, NOMS_SESSION)
    expect(simul.warn).toHaveBeenCalled()
  })

  it('supprime les cookies même si signOut renvoie une erreur, et la journalise', async () => {
    simul.signOut.mockResolvedValue({ error: { name: 'AuthRetryableFetchError', message: 'fetch failed', status: 0 } })
    const reponse = await POST(requete())
    expect(reponse.status).toBe(303)
    attendreSuppression(reponse, NOMS_SESSION)
    expect(simul.warn).toHaveBeenCalled()
  })

  it('supprime les cookies même si Supabase ne répond jamais', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    simul.signOut.mockReturnValue(new Promise(() => {}))
    let reponse: Response | undefined
    void POST(requete()).then((r) => { reponse = r })
    for (let i = 0; i < 30 && !reponse; i++) await vi.advanceTimersByTimeAsync(1000)
    expect(reponse, 'la route doit répondre sans attendre Supabase indéfiniment').toBeDefined()
    expect((reponse as Response).status).toBe(303)
    attendreSuppression(reponse as Response, NOMS_SESSION)
    expect(simul.warn).toHaveBeenCalled()
  })

  it('répond sans erreur quand la requête n’a aucun cookie de session', async () => {
    const reponse = await POST(requete({ cookies: ['locale=fr'] }))
    expect(reponse.status).toBe(303)
    expect(cookiesPoses(reponse).has('locale')).toBe(false)
  })

  describe('langue de la redirection', () => {
    it('prend la langue du corps JSON', async () => {
      expect(cheminLocation(await POST(requete({ json: { locale: 'pt' } })))).toBe('/pt/auth/login/')
      expect(cheminLocation(await POST(requete({ json: { locale: 'es' } })))).toBe('/es/auth/login/')
    })

    it('prend la langue d’un formulaire', async () => {
      expect(cheminLocation(await POST(requete({ formulaire: 'locale=pt' })))).toBe('/pt/auth/login/')
      expect(cheminLocation(await POST(requete({ formulaire: 'locale=nl' })))).toBe('/nl/auth/login/')
    })

    it.each([
      ['une langue non prise en charge', { locale: 'de' }],
      ['une majuscule', { locale: 'PT' }],
      ['un chemin', { locale: '../../evil' }],
      ['une URL sans schéma', { locale: '//evil.example' }],
      ['une URL', { locale: 'https://evil.example' }],
      ['un nombre', { locale: 12 }],
      ['null', { locale: null }],
      ['un tableau', { locale: ['pt'] }],
    ])('revient au français pour %s', async (_cas, corps) => {
      // Sans cookie locale : c'est bien la langue par défaut qui s'applique, pas le cookie.
      const reponse = await POST(requete({ cookies: COOKIES_SESSION, json: corps }))
      expect(reponse.status).toBe(303)
      expect(cheminLocation(reponse)).toBe('/fr/auth/login/')
      attendreSuppression(reponse, NOMS_SESSION)
    })

    it('revient au français pour un corps illisible ou qui n’est pas un objet', async () => {
      const sansCookieLocale = { cookies: COOKIES_SESSION }
      expect(cheminLocation(await POST(requete({ ...sansCookieLocale, jsonBrut: '{locale:' })))).toBe('/fr/auth/login/')
      expect(cheminLocation(await POST(requete({ ...sansCookieLocale, jsonBrut: '"pt"' })))).toBe('/fr/auth/login/')
      expect(cheminLocation(await POST(requete({ ...sansCookieLocale, formulaire: 'locale=%2F%2Fevil.example' })))).toBe('/fr/auth/login/')
      expect(cheminLocation(await POST(requete({ ...sansCookieLocale })))).toBe('/fr/auth/login/')
    })

    it('sans langue valide dans le corps, reprend le cookie locale s’il est valide', async () => {
      const avecCookiePt = requete({ cookies: [...COOKIES_SESSION, 'locale=pt'] })
      expect(cheminLocation(await POST(avecCookiePt))).toBe('/pt/auth/login/')
      const corpsFauxCookiePt = requete({ cookies: [...COOKIES_SESSION, 'locale=pt'], json: { locale: '//evil.example' } })
      expect(cheminLocation(await POST(corpsFauxCookiePt))).toBe('/pt/auth/login/')
      const avecCookieFaux = requete({ cookies: [...COOKIES_SESSION, 'locale=%2F%2Fevil.example'] })
      expect(cheminLocation(await POST(avecCookieFaux))).toBe('/fr/auth/login/')
    })

    it('la langue du corps l’emporte sur le cookie', async () => {
      const reponse = await POST(requete({ cookies: [...COOKIES_SESSION, 'locale=pt'], json: { locale: 'fr' } }))
      expect(cheminLocation(reponse)).toBe('/fr/auth/login/')
    })
  })

  describe('appel en fetch JSON', () => {
    it('répond 200 { ok: true } avec les mêmes suppressions de cookies, sans redirection', async () => {
      const reponse = await POST(requete({ accept: 'application/json', json: { locale: 'pt' } }))
      expect(reponse.status).toBe(200)
      expect(await reponse.json()).toEqual({ ok: true })
      expect(reponse.headers.get('location')).toBeNull()
      expect(reponse.headers.get('cache-control')).toContain('no-store')
      attendreSuppression(reponse, NOMS_SESSION)
    })
  })

  describe('protection CSRF', () => {
    it.each([
      ['un autre site', 'https://evil.example'],
      ['un sous-domaine imité', 'https://vitfix.io.evil.example'],
      ['le site en http', 'http://vitfix.io'],
      ['une origine opaque', 'null'],
    ])('refuse en 403 une requête venant d’%s, sans fermer la session', async (_cas, origin) => {
      const reponse = await POST(requete({ origin }))
      expect(reponse.status).toBe(403)
      expect(reponse.headers.get('cache-control')).toContain('no-store')
      expect(reponse.headers.getSetCookie()).toEqual([])
      expect(simul.signOut).not.toHaveBeenCalled()
    })

    it('accepte une requête du site ou sans en-tête Origin', async () => {
      expect((await POST(requete({ origin: SITE }))).status).toBe(303)
      expect((await POST(requete({ origin: null }))).status).toBe(303)
    })
  })
})

describe('GET /api/auth/logout', () => {
  it('répond 405 sans fermer la session ni toucher aux cookies', async () => {
    const reponse = await GET()
    expect(reponse.status).toBe(405)
    expect(reponse.headers.get('allow')).toBe('POST')
    expect(reponse.headers.get('cache-control')).toContain('no-store')
    expect(reponse.headers.getSetCookie()).toEqual([])
    expect(simul.signOut).not.toHaveBeenCalled()
  })
})
