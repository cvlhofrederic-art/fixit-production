// POST /api/email-agent/poll selon le fournisseur de la boîte du cabinet (colonne provider) :
// relève Microsoft Graph ou Gmail, e-mails lus OU non de la boîte de réception (30 jours la
// première fois, 7 ensuite), rafraîchissement par le bon fournisseur (rotation du
// refresh_token Microsoft rangée) et, si le rafraîchissement échoue, AUCUNE suppression de
// la ligne : une erreur est renvoyée pour ce cabinet (avant : la boîte était déconnectée
// sans prévenir, en pleine démonstration).
//
// Échafaudage commun (mocks, builders) : ./email-agent-test-utils.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SYNDIC_ID,
  INTERNAL_TOKEN,
  callPollPOST,
  expectJson,
  makeAlfredoClassifyMock,
  makeAlfredoContextMock,
  makeAlfredoDraftMock,
  makeAlfredoPipelineMock,
  makeAuthHelperSpies,
  makeLoggerMock,
  makeLoggerSpies,
  makeSanitizeContextMock,
  makeSupabaseAdminMock,
  makeValidationMock,
} from './email-agent-test-utils'

vi.mock('@/lib/auth-helpers', () => makeAuthHelperSpies())

// syndic_oauth_tokens : lecture de la ligne (single), mise à jour après rafraîchissement, delete espionné.
const jetons = vi.hoisted(() => ({
  ligne: null as null | Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
  delete: null as null | ReturnType<typeof import('vitest').vi.fn>,
}))
function chaineJetons() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.single = vi.fn(async () => ({ data: jetons.ligne, error: jetons.ligne ? null : { message: 'no rows' } }))
  chain.update = vi.fn((v: Record<string, unknown>) => { jetons.updates.push(v); return { eq: vi.fn(async () => ({ error: null })) } })
  chain.delete = jetons.delete
  return chain
}
// syndic_emails_analysed : dédup (select→eq→in) + upsert→select→single (insertFn du pipeline).
const upserts: Record<string, unknown>[] = []
function chaineEmails() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(async () => ({ data: [], error: null }))
  chain.upsert = vi.fn((v: Record<string, unknown>) => { upserts.push(v); return chain })
  chain.single = vi.fn(async () => ({ data: { id: 'row-1' }, error: null }))
  return chain
}
const mockFrom = vi.fn((table: string) => (table === 'syndic_emails_analysed' ? chaineEmails() : chaineJetons()))
vi.mock('@/lib/supabase-server', () => makeSupabaseAdminMock(mockFrom))

const getDecryptedToken = vi.fn()
const setEncryptedToken = vi.fn()
vi.mock('@/lib/oauth/tokens', () => ({ getDecryptedToken, setEncryptedToken }))

// Pipeline simulé : appelle insertFn comme le vrai (vérifie gmail_thread_id).
const mockProcessIncomingEmail = vi.fn()
vi.mock('@/lib/syndic/alfredo-pipeline', () => makeAlfredoPipelineMock(mockProcessIncomingEmail))
vi.mock('@/lib/syndic/alfredo-load-client-context', () => makeAlfredoContextMock())
vi.mock('@/lib/syndic/alfredo-classify', () => makeAlfredoClassifyMock())
vi.mock('@/lib/syndic/alfredo-draft', () => makeAlfredoDraftMock())
vi.mock('@/lib/ai/sanitize-context', () => makeSanitizeContextMock())
vi.mock('@/lib/validation', () => makeValidationMock())

const logger = makeLoggerSpies()
vi.mock('@/lib/logger', () => makeLoggerMock(logger))

const MAINTENANT = Date.parse('2026-10-11T12:00:00.000Z')
const JOUR = 86_400_000
const PLUS_TARD = new Date(MAINTENANT + 3600_000).toISOString()
const EXPIRE = new Date(MAINTENANT - 60_000).toISOString()

type Appel = { url: string; init?: RequestInit }
let appels: Appel[] = []

interface Reponses {
  rafraichissementMs?: { status?: number; body: unknown }
  rafraichissementGoogle?: { status?: number; body: unknown }
  graph?: { status?: number; body: unknown }
}

const MESSAGE_GRAPH = {
  id: 'AAMkAGI2-1', conversationId: 'AAQkAGI2-c1', subject: 'Fuite colonne', receivedDateTime: '2026-10-11T08:15:00Z',
  from: { emailAddress: { name: 'Julien Rousseau', address: 'j.rousseau@example.fr' } },
  body: { contentType: 'text', content: 'Bonjour, fuite au 3e.' }, bodyPreview: 'Bonjour, fuite au 3e.',
}

function stubFetch(r: Reponses = {}) {
  appels = []
  const repondre = (x: { status?: number; body: unknown }) => new Response(JSON.stringify(x.body), { status: x.status ?? 200 })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, init })
    if (url === 'https://login.microsoftonline.com/common/oauth2/v2.0/token') {
      return repondre(r.rafraichissementMs ?? { body: { access_token: 'acces-2', refresh_token: 'refresh-2', expires_in: 3600 } })
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      return repondre(r.rafraichissementGoogle ?? { body: { access_token: 'ya29-neuf', expires_in: 3599 } })
    }
    if (url.startsWith('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?')) {
      return repondre(r.graph ?? { body: { value: [MESSAGE_GRAPH] } })
    }
    if (url.startsWith('https://gmail.googleapis.com/gmail/v1/users/me/messages?')) return repondre({ body: { messages: [] } })
    throw new Error(`fetch inattendu : ${url}`)
  }))
}

function requetePoll(corps: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/email-agent/poll', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-trigger': INTERNAL_TOKEN },
    body: JSON.stringify({ syndic_id: SYNDIC_ID, ...corps }),
  })
}

const appelsVers = (prefixe: string) => appels.filter(a => a.url.startsWith(prefixe))
const entete = (a: Appel, nom: string) => (a.init?.headers as Record<string, string>)[nom]

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: MAINTENANT, toFake: ['Date'] })
  vi.stubEnv('INTERNAL_POLL_TOKEN', INTERNAL_TOKEN)
  vi.stubEnv('MICROSOFT_CLIENT_ID', 'ms-client-id')
  vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'ms-secret')
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-id')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret')
  jetons.ligne = { provider: 'microsoft', access_token: 'acces-1', refresh_token: 'refresh-1', token_expiry: PLUS_TARD }
  jetons.updates = []
  jetons.delete = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
  upserts.length = 0
  getDecryptedToken.mockResolvedValue(null)
  setEncryptedToken.mockRejectedValue(new Error('set_config failed'))
  mockProcessIncomingEmail.mockImplementation(async (p: { insertFn: (row: Record<string, unknown>) => Promise<unknown>; email: Record<string, unknown> }) => {
    await p.insertFn({ syndic_id: SYNDIC_ID, gmail_message_id: p.email.gmail_message_id })
    return { status: 'drafted', email_id: 'row-1' }
  })
  stubFetch()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('POST /api/email-agent/poll — boîte Outlook / Microsoft 365', () => {
  it('relève Graph avec le jeton en place ; e-mail normalisé transmis au pipeline, fil = conversationId', async () => {
    const data = await expectJson(await callPollPOST(requetePoll({})), 200)

    const graph = appelsVers('https://graph.microsoft.com/')
    expect(graph).toHaveLength(1)
    expect(entete(graph[0], 'Authorization')).toBe('Bearer acces-1')
    expect(entete(graph[0], 'Prefer')).toBe('outlook.body-content-type="text"')
    expect(appelsVers('https://gmail.googleapis.com/')).toHaveLength(0)
    expect(appelsVers('https://login.microsoftonline.com/')).toHaveLength(0)
    // Colonnes en clair = source de vérité : pas de lecture chiffrée quand elles sont remplies.
    expect(getDecryptedToken).not.toHaveBeenCalled()

    expect(mockProcessIncomingEmail).toHaveBeenCalledTimes(1)
    expect(mockProcessIncomingEmail.mock.calls[0][0].email).toEqual({
      from: 'Julien Rousseau <j.rousseau@example.fr>',
      subject: 'Fuite colonne',
      body_text: 'Bonjour, fuite au 3e.',
      gmail_message_id: 'AAMkAGI2-1',
      received_at: '2026-10-11T08:15:00.000Z',
    })
    expect(upserts[0]).toMatchObject({ gmail_message_id: 'AAMkAGI2-1', gmail_thread_id: 'AAQkAGI2-c1' })
    expect(data.results[0]).toMatchObject({ syndic_id: SYNDIC_ID, provider: 'microsoft', emails_processed: 1, new_emails: 1, skipped_known: 0 })
  })

  it('première relève : 30 derniers jours ; relève régulière : 7 jours — lus ou non, 20 au plus', async () => {
    await callPollPOST(requetePoll({ first_run: true }))
    await callPollPOST(requetePoll({}))
    const [premiere, reguliere] = appelsVers('https://graph.microsoft.com/').map(a => new URL(a.url).searchParams)
    expect(premiere.get('$filter')).toBe(`receivedDateTime ge ${new Date(MAINTENANT - 30 * JOUR).toISOString().replace('.000Z', 'Z')}`)
    expect(reguliere.get('$filter')).toBe(`receivedDateTime ge ${new Date(MAINTENANT - 7 * JOUR).toISOString().replace('.000Z', 'Z')}`)
    expect(premiere.get('$top')).toBe('20')
    expect(premiere.get('$orderby')).toBe('receivedDateTime desc')
    // Aucun filtre isRead : un e-mail déjà lu est relevé.
    expect(premiere.get('$filter')).not.toContain('isRead')
  })

  it('jeton expiré : rafraîchi chez Microsoft, NOUVEAU refresh_token rangé, relève avec le nouveau jeton', async () => {
    jetons.ligne = { provider: 'microsoft', access_token: 'acces-1', refresh_token: 'refresh-1', token_expiry: EXPIRE }
    const data = await expectJson(await callPollPOST(requetePoll({})), 200)

    const rafraichissement = appelsVers('https://login.microsoftonline.com/common/oauth2/v2.0/token')
    expect(rafraichissement).toHaveLength(1)
    const corps = new URLSearchParams(String(rafraichissement[0].init?.body))
    expect(corps.get('grant_type')).toBe('refresh_token')
    expect(corps.get('refresh_token')).toBe('refresh-1')

    expect(jetons.updates).toHaveLength(1)
    expect(jetons.updates[0]).toMatchObject({ access_token: 'acces-2', refresh_token: 'refresh-2', token_expiry: new Date(MAINTENANT + 3600_000).toISOString() })
    expect(entete(appelsVers('https://graph.microsoft.com/')[0], 'Authorization')).toBe('Bearer acces-2')
    expect(data.results[0]).toMatchObject({ provider: 'microsoft', new_emails: 1 })
  })

  it('rafraîchissement refusé : la ligne n’est PAS supprimée, erreur renvoyée pour ce cabinet, aucune relève', async () => {
    jetons.ligne = { provider: 'microsoft', access_token: 'acces-1', refresh_token: 'refresh-1', token_expiry: EXPIRE }
    stubFetch({ rafraichissementMs: { status: 400, body: { error: 'invalid_grant', error_description: 'AADSTS70008: The refresh token has expired.', error_codes: [70008] } } })
    const data = await expectJson(await callPollPOST(requetePoll({})), 200)

    expect(jetons.delete).not.toHaveBeenCalled()
    expect(jetons.updates).toHaveLength(0)
    expect(appelsVers('https://graph.microsoft.com/')).toHaveLength(0)
    expect(mockProcessIncomingEmail).not.toHaveBeenCalled()
    expect(data.results[0]).toMatchObject({ syndic_id: SYNDIC_ID, provider: 'microsoft', code: 'refresh_failed', error: expect.stringContaining('reconnectez') })
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('rafraîchissement du jeton microsoft refusé'), expect.objectContaining({ code: 'invalid_grant' }))
  })

  it('boîte sans Exchange Online : erreur de lecture renvoyée (code boite_indisponible), pipeline non appelé', async () => {
    stubFetch({ graph: { status: 404, body: { error: { code: 'MailboxNotEnabledForRESTAPI', message: 'hosted on-premise' } } } })
    const data = await expectJson(await callPollPOST(requetePoll({})), 200)
    expect(mockProcessIncomingEmail).not.toHaveBeenCalled()
    expect(data.results[0]).toMatchObject({ provider: 'microsoft', code: 'boite_indisponible', error: 'Lecture de la boîte e-mail impossible' })
  })

  it('nouveaux e-mails analysés par lots parallèles de 4 au plus, tous traités', async () => {
    stubFetch({ graph: { body: { value: Array.from({ length: 6 }, (_, i) => ({ ...MESSAGE_GRAPH, id: `AAMk-${i}` })) } } })
    let enCours = 0
    let maximum = 0
    mockProcessIncomingEmail.mockImplementation(async () => {
      enCours++
      maximum = Math.max(maximum, enCours)
      await new Promise(r => setTimeout(r, 5))
      enCours--
      return { status: 'drafted', email_id: 'row' }
    })
    const data = await expectJson(await callPollPOST(requetePoll({ first_run: true })), 200)
    expect(maximum).toBe(4)
    expect(mockProcessIncomingEmail.mock.calls.map(c => c[0].email.gmail_message_id)).toEqual(['AAMk-0', 'AAMk-1', 'AAMk-2', 'AAMk-3', 'AAMk-4', 'AAMk-5'])
    expect(data.results[0]).toMatchObject({ emails_processed: 6, new_emails: 6, deferred: 0 })
  })

  it('budget de temps dépassé : les lots suivants sont reportés à la relève suivante (réponse avant le délai Cloudflare)', async () => {
    stubFetch({ graph: { body: { value: Array.from({ length: 6 }, (_, i) => ({ ...MESSAGE_GRAPH, id: `AAMk-${i}` })) } } })
    // Chaque analyse « dure » 50 s : le premier lot épuise le budget de 45 s.
    mockProcessIncomingEmail.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 50_000)
      return { status: 'drafted', email_id: 'row' }
    })
    const data = await expectJson(await callPollPOST(requetePoll({ first_run: true })), 200)
    expect(mockProcessIncomingEmail).toHaveBeenCalledTimes(4)
    expect(data.results[0]).toMatchObject({ emails_processed: 6, new_emails: 4, deferred: 2 })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('2 e-mail(s) reporté(s)'))
  })

  it('fournisseur inconnu : erreur pour ce cabinet, aucun appel réseau', async () => {
    jetons.ligne = { provider: 'exchange-ews', access_token: 'x', refresh_token: 'y', token_expiry: PLUS_TARD }
    const data = await expectJson(await callPollPOST(requetePoll({})), 200)
    expect(appels).toHaveLength(0)
    expect(data.results[0]).toMatchObject({ provider: 'exchange-ews', error: 'Fournisseur de boîte non pris en charge' })
  })
})

describe('POST /api/email-agent/poll — boîte Gmail', () => {
  beforeEach(() => {
    jetons.ligne = { provider: 'gmail', access_token: 'ya29', refresh_token: '1//r', token_expiry: PLUS_TARD }
  })

  it('requête Gmail : boîte de réception lus OU non (plus de is:unread), 30 jours puis 7', async () => {
    await callPollPOST(requetePoll({ first_run: true }))
    await callPollPOST(requetePoll({}))
    const [premiere, reguliere] = appelsVers('https://gmail.googleapis.com/').map(a => new URL(a.url).searchParams)
    expect(premiere.get('q')).toBe(`in:inbox after:${(MAINTENANT - 30 * JOUR) / 1000}`)
    expect(reguliere.get('q')).toBe(`in:inbox after:${(MAINTENANT - 7 * JOUR) / 1000}`)
    expect(premiere.get('q')).not.toContain('is:unread')
    expect(premiere.get('maxResults')).toBe('20')
    expect(appelsVers('https://graph.microsoft.com/')).toHaveLength(0)
  })

  it('ligne sans provider (ancienne ligne) : traitée comme Gmail', async () => {
    jetons.ligne = { provider: null, access_token: 'ya29', refresh_token: '1//r', token_expiry: PLUS_TARD }
    const data = await expectJson(await callPollPOST(requetePoll({})), 200)
    expect(appelsVers('https://gmail.googleapis.com/')).toHaveLength(1)
    expect(data.results[0]).toMatchObject({ provider: 'gmail' })
  })

  it('jeton expiré : rafraîchi chez Google, refresh_token en place conservé', async () => {
    jetons.ligne = { provider: 'gmail', access_token: 'ya29', refresh_token: '1//r', token_expiry: EXPIRE }
    await callPollPOST(requetePoll({}))
    expect(appelsVers('https://oauth2.googleapis.com/token')).toHaveLength(1)
    expect(jetons.updates[0]).toMatchObject({ access_token: 'ya29-neuf' })
    expect(jetons.updates[0]).not.toHaveProperty('refresh_token')
    expect(entete(appelsVers('https://gmail.googleapis.com/')[0], 'Authorization')).toBe('Bearer ya29-neuf')
  })

  it('rafraîchissement Google refusé : pas de suppression de la ligne, erreur renvoyée', async () => {
    jetons.ligne = { provider: 'gmail', access_token: 'ya29', refresh_token: '1//r', token_expiry: EXPIRE }
    stubFetch({ rafraichissementGoogle: { status: 400, body: { error: 'invalid_grant' } } })
    const data = await expectJson(await callPollPOST(requetePoll({})), 200)
    expect(jetons.delete).not.toHaveBeenCalled()
    expect(appelsVers('https://gmail.googleapis.com/')).toHaveLength(0)
    expect(data.results[0]).toMatchObject({ provider: 'gmail', code: 'refresh_failed' })
  })

  it('colonnes en clair vides : repli sur les colonnes chiffrées (Gmail)', async () => {
    jetons.ligne = null
    getDecryptedToken.mockResolvedValue({ access_token: 'ya29-chiffre', refresh_token: '1//r', expires_at: PLUS_TARD })
    await callPollPOST(requetePoll({}))
    expect(getDecryptedToken).toHaveBeenCalledTimes(1)
    expect(entete(appelsVers('https://gmail.googleapis.com/')[0], 'Authorization')).toBe('Bearer ya29-chiffre')
  })
})
