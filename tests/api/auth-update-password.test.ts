// @vitest-environment node
/**
 * POST /api/auth/update-password (app/api/auth/update-password/route.ts) : fin du parcours « mot de passe oublié »
 * ouvert par le lien de l'e-mail, sur n'importe quel appareil. Le jeton vient du cookie httpOnly posé par
 * /auth/confirm/ ; vérification et changement du mot de passe côté serveur, sans jamais poser de session dans le
 * navigateur (un lien piégé avec le jeton d'un autre compte ne doit connecter personne).
 *
 * supabase-js est le vrai ; seul GoTrue est simulé (fetch) : le test prouve l'enchaînement réel verify → PUT /user
 * (avec la session issue de verify) → logout, et qu'aucun cookie de session ne part vers le navigateur.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({ limiteAtteinte: false, warn: vi.fn(), error: vi.fn() }))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => !h.limiteAtteinte),
  getClientIP: vi.fn(() => '203.0.113.7'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'Too many requests' }, { status: 429 })),
}))
vi.mock('@/lib/logger', () => ({
  logger: { warn: h.warn, error: h.error, info: vi.fn(), debug: vi.fn() },
}))

const URL_SUPABASE = 'https://projet-test.supabase.co'
const JETON = 'pkce_0b3c6c1f1d0e4a7c9f2e5d8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e'
const MOT_DE_PASSE = 'NouveauMotDePasse2026'
const JETON_ACCES = 'jeton-acces-de-recuperation'
// Horloge figée : la session simulée expire dans une heure à partir de cet instant.
const MAINTENANT_S = 1_794_268_800

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_SUPABASE)
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'cle-anon-de-test')

const { POST } = await import('@/app/api/auth/update-password/route')

type Appel = { methode: string; chemin: string; corps: Record<string, unknown>; autorisation: string | null }
type Reponses = { verify: () => Response; user: () => Response }
let appels: Appel[] = []
let reponses: Reponses

const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' },
  })

const sessionDeRecuperation = () =>
  json({
    access_token: JETON_ACCES,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: MAINTENANT_S + 3600,
    refresh_token: 'jeton-rafraichissement-de-recuperation',
    user: { id: '7d0c3b6e-1a2b-4c5d-8e9f-0a1b2c3d4e5f', aud: 'authenticated', role: 'authenticated', email: 'titulaire@example.fr', app_metadata: {}, user_metadata: {} },
  })
const utilisateur = () => json({ id: '7d0c3b6e-1a2b-4c5d-8e9f-0a1b2c3d4e5f', aud: 'authenticated', role: 'authenticated', email: 'titulaire@example.fr' })
const erreurGoTrue = (statut: number, code: string, message: string) => () => json({ code, error_code: code, msg: message, message }, statut)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAINTENANT_S * 1000)
  appels = []
  reponses = { verify: sessionDeRecuperation, user: utilisateur }
  h.limiteAtteinte = false
  h.warn.mockClear()
  h.error.mockClear()
  vi.stubGlobal('fetch', vi.fn(async (entree: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url)
    const entetes = new Headers(init?.headers)
    appels.push({
      methode: init?.method ?? 'GET',
      chemin: url.pathname + url.search,
      corps: init?.body ? JSON.parse(String(init.body)) : {},
      autorisation: entetes.get('authorization'),
    })
    if (url.pathname === '/auth/v1/verify') return reponses.verify()
    if (url.pathname === '/auth/v1/user') return reponses.user()
    if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 })
    throw new Error(`appel réseau inattendu : ${url.href}`)
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

afterAll(() => {
  vi.unstubAllEnvs()
})

function requete(corps: unknown, cookies: string | null = `vitfix_reinit_mdp=${JETON}`): NextRequest {
  const entetes: Record<string, string> = { 'content-type': 'application/json', origin: 'https://vitfix.io' }
  if (cookies) entetes.cookie = cookies
  return new NextRequest('https://vitfix.io/api/auth/update-password/', {
    method: 'POST',
    headers: entetes,
    body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  })
}

/** Le cookie du jeton est-il effacé par la réponse ? (Set-Cookie vide, Max-Age=0, même chemin) */
function cookieJetonEfface(reponse: Response): boolean {
  return reponse.headers.getSetCookie().some((ligne) => /^vitfix_reinit_mdp=;/.test(ligne) && /Max-Age=0/i.test(ligne) && /Path=\/api\/auth\//.test(ligne))
}

function sansSecretAuJournal() {
  const journal = JSON.stringify([h.warn.mock.calls, h.error.mock.calls])
  expect(journal).not.toContain(JETON)
  expect(journal).not.toContain(MOT_DE_PASSE)
}

describe('POST /api/auth/update-password — lien ouvert sur un autre appareil', () => {
  it('vérifie le jeton, change le mot de passe avec la session de récupération, la révoque, sans cookie de session', async () => {
    // Le navigateur garde éventuellement la session de quelqu'un d'autre : elle ne doit pas bouger.
    const reponse = await POST(requete({ password: MOT_DE_PASSE }, `vitfix_reinit_mdp=${JETON}; sb-projet-test-auth-token=base64-autre-session`))

    expect(reponse.status).toBe(200)
    expect(await reponse.json()).toEqual({ ok: true })
    expect(appels.map(({ methode, chemin }) => `${methode} ${chemin}`)).toEqual([
      'POST /auth/v1/verify',
      'PUT /auth/v1/user',
      'POST /auth/v1/logout?scope=local',
    ])
    expect(appels[0].corps).toMatchObject({ type: 'recovery', token_hash: JETON })
    expect(appels[1]).toMatchObject({ corps: { password: MOT_DE_PASSE }, autorisation: `Bearer ${JETON_ACCES}` })
    expect(appels[2].autorisation).toBe(`Bearer ${JETON_ACCES}`)

    expect(cookieJetonEfface(reponse)).toBe(true)
    expect(reponse.headers.getSetCookie().filter((ligne) => ligne.startsWith('sb-'))).toEqual([])
    expect(reponse.headers.get('cache-control')).toBe('private, no-store')
    sansSecretAuJournal()
  })
})

describe('POST /api/auth/update-password — refus avant tout appel à Supabase', () => {
  it('sans cookie de jeton : lien invalide', async () => {
    const reponse = await POST(requete({ password: MOT_DE_PASSE }, null))
    expect(reponse.status).toBe(400)
    expect(await reponse.json()).toEqual({ erreur: 'lien-invalide' })
    expect(appels).toEqual([])
  })

  it('cookie de jeton malformé : lien invalide, cookie effacé', async () => {
    const reponse = await POST(requete({ password: MOT_DE_PASSE }, 'vitfix_reinit_mdp=abc'))
    expect(await reponse.json()).toEqual({ erreur: 'lien-invalide' })
    expect(cookieJetonEfface(reponse)).toBe(true)
    expect(appels).toEqual([])
  })

  it.each(['abc', 'motdepasse1', 'MOTDEPASSE1', 'MotDePasse', `Ab1${'x'.repeat(70)}`])(
    'mot de passe hors règle (%j) : jeton gardé, rien de consommé',
    async (motDePasse) => {
      const reponse = await POST(requete({ password: motDePasse }))
      expect(reponse.status).toBe(400)
      expect(await reponse.json()).toEqual({ erreur: 'mot-de-passe-faible' })
      expect(reponse.headers.getSetCookie()).toEqual([])
      expect(appels).toEqual([])
    },
  )

  it.each([
    ['JSON illisible', '{"password":'],
    ['mot de passe absent', { motDePasse: MOT_DE_PASSE }],
    ['mot de passe non textuel', { password: 12345678 }],
  ])('%s : requête invalide', async (_cas, corps) => {
    const reponse = await POST(requete(corps))
    expect(reponse.status).toBe(400)
    expect(await reponse.json()).toEqual({ erreur: 'requete-invalide' })
    expect(appels).toEqual([])
  })

  it('limite par visiteur atteinte : aucun appel à Supabase', async () => {
    h.limiteAtteinte = true
    const reponse = await POST(requete({ password: MOT_DE_PASSE }))
    expect(reponse.status).toBe(429)
    expect(await reponse.json()).toEqual({ erreur: 'trop-de-tentatives' })
    expect(appels).toEqual([])
  })
})

describe('POST /api/auth/update-password — réponses de Supabase', () => {
  it('jeton expiré ou déjà utilisé : lien invalide, cookie effacé, mot de passe inchangé', async () => {
    reponses.verify = erreurGoTrue(403, 'otp_expired', 'Email link is invalid or has expired')
    const reponse = await POST(requete({ password: MOT_DE_PASSE }))
    expect(reponse.status).toBe(400)
    expect(await reponse.json()).toEqual({ erreur: 'lien-invalide' })
    expect(cookieJetonEfface(reponse)).toBe(true)
    expect(appels.map(({ chemin }) => chemin)).toEqual(['/auth/v1/verify'])
    expect(h.warn).toHaveBeenCalledWith('[auth/update-password] lien refusé par Supabase', { code: 'otp_expired', statut: 403 })
    sansSecretAuJournal()
  })

  it.each([
    ['GoTrue saturé (429)', erreurGoTrue(429, 'over_request_rate_limit', 'Request rate limit reached'), 429, 'trop-de-tentatives'],
    ['GoTrue en erreur (500)', erreurGoTrue(500, 'unexpected_failure', 'Unexpected failure'), 503, 'reessayer'],
    ['GoTrue injoignable', () => { throw new TypeError('fetch failed') }, 503, 'reessayer'],
  ])('%s : jeton intact, cookie gardé pour réessayer', async (_cas, verify, statut, erreur) => {
    reponses.verify = verify
    const reponse = await POST(requete({ password: MOT_DE_PASSE }))
    expect(reponse.status).toBe(statut)
    expect(await reponse.json()).toEqual({ erreur })
    expect(reponse.headers.getSetCookie()).toEqual([])
    expect(appels.map(({ chemin }) => chemin)).toEqual(['/auth/v1/verify'])
    sansSecretAuJournal()
  })

  it.each([
    ['même mot de passe que l’actuel', erreurGoTrue(422, 'same_password', 'New password should be different from the old password.'), 422, 'meme-mot-de-passe'],
    ['mot de passe refusé par GoTrue', erreurGoTrue(422, 'weak_password', 'Password is known to be weak and easy to guess'), 422, 'mot-de-passe-refuse'],
    ['échec inattendu', erreurGoTrue(500, 'unexpected_failure', 'Unexpected failure'), 500, 'lien-invalide'],
  ])('%s après vérification : jeton consommé, cookie effacé', async (_cas, user, statut, erreur) => {
    reponses.user = user
    const reponse = await POST(requete({ password: MOT_DE_PASSE }))
    expect(reponse.status).toBe(statut)
    expect(await reponse.json()).toEqual({ erreur })
    expect(cookieJetonEfface(reponse)).toBe(true)
    expect(reponse.headers.getSetCookie().filter((ligne) => ligne.startsWith('sb-'))).toEqual([])
    sansSecretAuJournal()
  })
})
