// Retours OAuth de la boîte e-mail : GET /api/email-agent/callback/microsoft (Outlook /
// Microsoft 365) et GET /api/email-agent/callback (Google, inchangé). Vérification du nonce
// rangé par connect, ligne écrite avec le bon provider, nonce effacé, première relève du
// cabinet lancée après la réponse (after() → ctx.waitUntil), erreurs Microsoft → codes courts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// NextRequest importé à la demande (helper requete) : next/server est simulé ci-dessous et sa
// fabrique lit mockAfter, initialisé après les imports statiques.
import { makeAfterCapture, makeNextServerMockWithAfter } from './email-agent-test-utils'

const CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const NONCE = 'b1946ac9-2f4e-4c1a-9d1e-0f2a3b4c5d6e'
const INTERNAL_TOKEN = 'internal-poll-token-test-0123456789abcdef'

const etat = vi.hoisted(() => ({
  ligne: null as null | Record<string, unknown>,
  upserts: [] as { valeur: Record<string, unknown>; options: unknown }[],
  erreurUpsert: null as null | { message: string },
}))

const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger }))

vi.mock('@/lib/supabase-server', () => {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.single = vi.fn(async () => ({ data: etat.ligne, error: etat.ligne ? null : { message: 'no rows' } }))
  chain.upsert = vi.fn(async (valeur: Record<string, unknown>, options: unknown) => {
    etat.upserts.push({ valeur, options })
    return { error: etat.erreurUpsert }
  })
  return { supabaseAdmin: { from: vi.fn(() => chain) } }
})

// Écriture chiffrée cassée en production : elle échoue, le retour continue (colonnes en clair).
const setEncryptedToken = vi.hoisted(() => vi.fn())
vi.mock('@/lib/oauth/tokens', () => ({ setEncryptedToken, getDecryptedToken: vi.fn() }))

const { mockAfter, flushAfterCallbacks, resetAfterCallbacks } = makeAfterCapture()
vi.mock('next/server', async (importOriginal) => makeNextServerMockWithAfter(importOriginal, mockAfter))

type Appel = { url: string; init?: RequestInit }
let appels: Appel[] = []

/** fetch simulé : point de jeton Microsoft / Google, profils, poll interne. */
function stubFetch(jeton: { status?: number; body: Record<string, unknown> }) {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init })
    if (url.endsWith('/oauth2/v2.0/token') || url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify(jeton.body), { status: jeton.status ?? 200 })
    }
    if (url.startsWith('https://graph.microsoft.com/v1.0/me')) {
      return new Response(JSON.stringify({ mail: 'h.carvalho@ajassocies.fr', userPrincipalName: 'h.carvalho@ajassocies.fr' }))
    }
    if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') return new Response(JSON.stringify({ email: 'frederic@gmail.com' }))
    if (url === 'https://vitfix.io/api/email-agent/poll') return new Response(JSON.stringify({ success: true }))
    throw new Error(`fetch inattendu : ${url}`)
  }))
}

const JETONS_MS = { access_token: 'eyJ-acces', refresh_token: 'M.R3-refresh', expires_in: 3600, scope: 'Mail.Read User.Read' }

async function requete(url: string) {
  const { NextRequest } = await import('next/server')
  return new NextRequest(url)
}

async function retourMicrosoft(query: string) {
  const { GET } = await import('@/app/api/email-agent/callback/microsoft/route')
  return GET(await requete(`https://vitfix.io/api/email-agent/callback/microsoft?${query}`))
}

async function retourGoogle(query: string) {
  const { GET } = await import('@/app/api/email-agent/callback/route')
  return GET(await requete(`https://vitfix.io/api/email-agent/callback?${query}`))
}

function parametresRedirection(res: Response): Record<string, string> {
  const location = new URL(res.headers.get('location') || '')
  expect(`${location.origin}${location.pathname}`).toBe('https://vitfix.io/syndic/v54')
  return Object.fromEntries(location.searchParams)
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAfterCallbacks()
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  vi.stubEnv('MICROSOFT_CLIENT_ID', 'ms-client-id')
  vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'ms-secret')
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-id')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret')
  vi.stubEnv('INTERNAL_POLL_TOKEN', INTERNAL_TOKEN)
  etat.ligne = { oauth_nonce: NONCE, oauth_nonce_expires_at: new Date(Date.now() + 5 * 60_000).toISOString() }
  etat.upserts = []
  etat.erreurUpsert = null
  setEncryptedToken.mockRejectedValue(new Error('set_config app.oauth_encryption_key failed'))
  stubFetch({ body: JETONS_MS })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('GET /api/email-agent/callback/microsoft', () => {
  it('nonce valide : échange le code, écrit la ligne provider « microsoft », efface le nonce, redirige', async () => {
    const res = await retourMicrosoft(`code=code-ms&state=${CABINET}:${NONCE}&session_state=abc`)
    expect(res.status).toBe(307)
    expect(parametresRedirection(res)).toEqual({ email_connected: 'true', email: 'h.carvalho@ajassocies.fr', email_provider: 'microsoft' })

    const echange = appels.find(a => a.url === 'https://login.microsoftonline.com/common/oauth2/v2.0/token')!
    const corps = new URLSearchParams(String(echange.init?.body))
    expect(corps.get('grant_type')).toBe('authorization_code')
    expect(corps.get('code')).toBe('code-ms')
    expect(corps.get('redirect_uri')).toBe('https://vitfix.io/api/email-agent/callback/microsoft')

    expect(etat.upserts).toHaveLength(1)
    expect(etat.upserts[0].options).toEqual({ onConflict: 'syndic_id' })
    expect(etat.upserts[0].valeur).toMatchObject({
      syndic_id: CABINET,
      provider: 'microsoft',
      access_token: 'eyJ-acces',
      refresh_token: 'M.R3-refresh',
      email_compte: 'h.carvalho@ajassocies.fr',
      scope: 'Mail.Read User.Read',
      oauth_nonce: null,
      oauth_nonce_expires_at: null,
    })
    expect(Date.parse(String(etat.upserts[0].valeur.token_expiry))).toBeGreaterThan(Date.now())
    // L'échec de l'écriture chiffrée ne bloque pas la connexion.
    expect(setEncryptedToken).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('setEncryptedToken indisponible'), expect.anything())
  })

  it('première relève du cabinet lancée APRÈS la réponse (after), en appel interne', async () => {
    await retourMicrosoft(`code=code-ms&state=${CABINET}:${NONCE}`)
    expect(mockAfter).toHaveBeenCalledTimes(1)
    expect(appels.some(a => a.url.endsWith('/api/email-agent/poll'))).toBe(false)

    await flushAfterCallbacks()
    const poll = appels.find(a => a.url === 'https://vitfix.io/api/email-agent/poll')!
    expect(poll.init?.method).toBe('POST')
    expect((poll.init?.headers as Record<string, string>)['x-internal-trigger']).toBe(INTERNAL_TOKEN)
    expect(JSON.parse(String(poll.init?.body))).toEqual({ syndic_id: CABINET, first_run: true })
  })

  it('nonce différent : csrf_failed, aucun échange de code ni écriture', async () => {
    const res = await retourMicrosoft(`code=code-ms&state=${CABINET}:autre-nonce`)
    expect(parametresRedirection(res)).toEqual({ email_error: 'csrf_failed' })
    expect(appels).toHaveLength(0)
    expect(etat.upserts).toHaveLength(0)
  })

  it('nonce expiré : state_expired', async () => {
    etat.ligne = { oauth_nonce: NONCE, oauth_nonce_expires_at: new Date(Date.now() - 60_000).toISOString() }
    const res = await retourMicrosoft(`code=code-ms&state=${CABINET}:${NONCE}`)
    expect(parametresRedirection(res)).toEqual({ email_error: 'state_expired' })
    expect(etat.upserts).toHaveLength(0)
  })

  it('state mal formé : invalid_state ; code absent : missing_code', async () => {
    expect(parametresRedirection(await retourMicrosoft(`code=c&state=pas-un-uuid:${NONCE}`))).toEqual({ email_error: 'invalid_state' })
    expect(parametresRedirection(await retourMicrosoft(`state=${CABINET}:${NONCE}`))).toEqual({ email_error: 'missing_code' })
    expect(etat.upserts).toHaveLength(0)
  })

  it('consentement administrateur exigé par le locataire (AADSTS90094) : admin_approval_required, détail journalisé', async () => {
    const description = 'AADSTS90094: The grant requires admin permission. Trace ID: 1234'
    const res = await retourMicrosoft(`error=access_denied&error_description=${encodeURIComponent(description)}&state=${CABINET}:${NONCE}`)
    expect(parametresRedirection(res)).toEqual({ email_error: 'admin_approval_required' })
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('connexion refusée par Microsoft'),
      expect.objectContaining({ code: 'admin_approval_required', error_description: description }),
    )
    expect(appels).toHaveLength(0)
  })

  it('consentement refusé par l’utilisateur (AADSTS65004) : consent_declined', async () => {
    const res = await retourMicrosoft(`error=access_denied&error_description=${encodeURIComponent('AADSTS65004: User declined to consent.')}`)
    expect(parametresRedirection(res)).toEqual({ email_error: 'consent_declined' })
  })

  it('échange refusé (AADSTS65001, consentement manquant) : consent_required', async () => {
    stubFetch({ status: 400, body: { error: 'invalid_grant', error_description: 'AADSTS65001: The user or administrator has not consented.', error_codes: [65001] } })
    const res = await retourMicrosoft(`code=code-ms&state=${CABINET}:${NONCE}`)
    expect(parametresRedirection(res)).toEqual({ email_error: 'consent_required' })
    expect(etat.upserts).toHaveLength(0)
    expect(mockAfter).not.toHaveBeenCalled()
  })

  it('retour du consentement administrateur (admin_consent=True, sans code) : email_admin_consent', async () => {
    const res = await retourMicrosoft('admin_consent=True&tenant=7c1f0b5e-0000-4000-8000-000000000000')
    expect(parametresRedirection(res)).toEqual({ email_admin_consent: 'true' })
    expect(etat.upserts).toHaveLength(0)
  })

  it('écriture en base refusée : db_error, pas de relève', async () => {
    etat.erreurUpsert = { message: 'db down' }
    const res = await retourMicrosoft(`code=code-ms&state=${CABINET}:${NONCE}`)
    expect(parametresRedirection(res)).toEqual({ email_error: 'db_error' })
    expect(mockAfter).not.toHaveBeenCalled()
  })
})

describe('GET /api/email-agent/callback (Google, inchangé)', () => {
  it('écrit la ligne provider « gmail » et lance la première relève', async () => {
    stubFetch({ body: { access_token: 'ya29', refresh_token: '1//r', expires_in: 3599, scope: 'gmail.readonly' } })
    const res = await retourGoogle(`code=code-g&state=${CABINET}:${NONCE}`)
    expect(parametresRedirection(res)).toEqual({ email_connected: 'true', email: 'frederic@gmail.com', email_provider: 'gmail' })
    expect(etat.upserts[0].valeur).toMatchObject({ syndic_id: CABINET, provider: 'gmail', access_token: 'ya29', refresh_token: '1//r', email_compte: 'frederic@gmail.com', oauth_nonce: null })
    const echange = appels.find(a => a.url === 'https://oauth2.googleapis.com/token')!
    expect(new URLSearchParams(String(echange.init?.body)).get('redirect_uri')).toBe('https://vitfix.io/api/email-agent/callback')
    expect(mockAfter).toHaveBeenCalledTimes(1)
  })

  it('refus Google (error=access_denied) : code relayé', async () => {
    const res = await retourGoogle('error=access_denied')
    expect(parametresRedirection(res)).toEqual({ email_error: 'access_denied' })
  })
})
