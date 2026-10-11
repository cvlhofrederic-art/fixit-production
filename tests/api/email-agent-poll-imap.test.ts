// POST /api/email-agent/poll pour une boîte « autre messagerie » (provider 'imap') : ligne
// avec refresh_token vide et token_expiry lointain NON ignorée, jamais de rafraîchissement
// OAuth, identifiants déchiffrés pour la relève IMAP (30 jours puis 7, 20 au plus), e-mails
// transmis au pipeline Alfredo, refus d'identifiants renvoyé avec son code (reconnexion).
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
  makeSanitizeContextMock,
  makeSupabaseAdminMock,
  makeValidationMock,
} from './email-agent-test-utils'

vi.mock('@/lib/auth-helpers', () => makeAuthHelperSpies())

const jetons = vi.hoisted(() => ({
  ligne: null as null | Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
}))
function chaineJetons() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.single = vi.fn(async () => ({ data: jetons.ligne, error: jetons.ligne ? null : { message: 'no rows' } }))
  chain.update = vi.fn((v: Record<string, unknown>) => { jetons.updates.push(v); return { eq: vi.fn(async () => ({ error: null })) } })
  chain.delete = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
  return chain
}
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

const { getDecryptedToken, setEncryptedToken } = vi.hoisted(() => ({ getDecryptedToken: vi.fn(), setEncryptedToken: vi.fn() }))
vi.mock('@/lib/oauth/tokens', async (importOriginal) => ({
  // getEncryptionKey réel : il sert au chiffrement AES-GCM des identifiants IMAP.
  ...(await importOriginal<typeof import('@/lib/oauth/tokens')>()),
  getDecryptedToken,
  setEncryptedToken,
}))

const mockProcessIncomingEmail = vi.hoisted(() => vi.fn())
vi.mock('@/lib/syndic/alfredo-pipeline', () => makeAlfredoPipelineMock(mockProcessIncomingEmail))
vi.mock('@/lib/syndic/alfredo-load-client-context', () => makeAlfredoContextMock())
vi.mock('@/lib/syndic/alfredo-classify', () => makeAlfredoClassifyMock())
vi.mock('@/lib/syndic/alfredo-draft', () => makeAlfredoDraftMock())
vi.mock('@/lib/ai/sanitize-context', () => makeSanitizeContextMock())
vi.mock('@/lib/validation', () => makeValidationMock())

// vi.hoisted : les imports statiques plus bas chargent le logger avant le corps du fichier.
const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/logger', () => makeLoggerMock(logger))

vi.mock('@/lib/email-agent/imap/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email-agent/imap/client')>()),
  releverBoiteImap: vi.fn(),
}))

import { ErreurImap, releverBoiteImap } from '@/lib/email-agent/imap/client'
import { chiffrerIdentifiantsImap } from '@/lib/email-agent/chiffrement'
import { EXPIRATION_IMAP } from '@/lib/email-agent/fournisseurs'

const MAINTENANT = Date.parse('2026-10-11T12:00:00.000Z')
const IDENTIFIANTS = { hote: 'ssl0.ovh.net', port: 993, utilisateur: 'gestion@cabinet-exemple.fr', motDePasse: 'mdp-secret-ovh' }
const MESSAGE = {
  id: 'abc123@mail.example.fr', threadId: null, from: 'Mme Béatrice Roué <beatrice.roue@example.fr>',
  subject: 'Fuite d\'eau à la cave', bodyText: 'Bonjour, fuite au sous-sol.', receivedAt: '2026-10-09T06:15:00.000Z',
}

function requetePoll(corps: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/email-agent/poll', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-trigger': INTERNAL_TOKEN },
    body: JSON.stringify({ syndic_id: SYNDIC_ID, ...corps }),
  })
}

const fetchMock = vi.fn()

beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubEnv('INTERNAL_POLL_TOKEN', INTERNAL_TOKEN)
  vi.stubEnv('OAUTH_TOKENS_ENCRYPTION_KEY', 'cle-de-test-de-32-caracteres-min!!')
  vi.stubGlobal('fetch', fetchMock)
  jetons.ligne = {
    provider: 'imap',
    access_token: await chiffrerIdentifiantsImap(IDENTIFIANTS),
    refresh_token: '',
    token_expiry: EXPIRATION_IMAP,
  }
  jetons.updates = []
  upserts.length = 0
  getDecryptedToken.mockResolvedValue(null)
  vi.mocked(releverBoiteImap).mockResolvedValue([MESSAGE])
  mockProcessIncomingEmail.mockImplementation(async (p: { insertFn: (row: Record<string, unknown>) => Promise<unknown>; email: Record<string, unknown> }) => {
    await p.insertFn({ syndic_id: SYNDIC_ID, gmail_message_id: p.email.gmail_message_id })
    return { status: 'drafted', email_id: 'row-1' }
  })
  vi.useFakeTimers({ now: MAINTENANT, toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('POST /api/email-agent/poll — boîte IMAP', () => {
  it('ligne IMAP (refresh_token vide) relevée : identifiants déchiffrés, e-mail transmis au pipeline, aucun appel OAuth', async () => {
    const data = await expectJson(await callPollPOST(requetePoll({ first_run: true })), 200)

    expect(releverBoiteImap).toHaveBeenCalledTimes(1)
    expect(vi.mocked(releverBoiteImap).mock.calls[0][0]).toEqual(IDENTIFIANTS)
    expect(vi.mocked(releverBoiteImap).mock.calls[0][1]).toEqual({
      depuis: new Date(MAINTENANT - 30 * 86_400_000), max: 20, longueurCorps: 1000,
    })
    // Ni rafraîchissement OAuth (fetch), ni réécriture de la ligne, ni repli chiffré RPC.
    expect(fetchMock).not.toHaveBeenCalled()
    expect(jetons.updates).toEqual([])
    expect(getDecryptedToken).not.toHaveBeenCalled()

    expect(mockProcessIncomingEmail.mock.calls[0][0].email).toEqual({
      from: MESSAGE.from,
      subject: MESSAGE.subject,
      body_text: MESSAGE.bodyText,
      gmail_message_id: MESSAGE.id,
      received_at: MESSAGE.receivedAt,
    })
    expect(upserts[0]).toMatchObject({ gmail_message_id: MESSAGE.id, gmail_thread_id: null })
    expect(data.results[0]).toMatchObject({ syndic_id: SYNDIC_ID, provider: 'imap', emails_processed: 1, new_emails: 1 })
  })

  it('relève régulière : 7 derniers jours', async () => {
    await expectJson(await callPollPOST(requetePoll({})), 200)
    expect(vi.mocked(releverBoiteImap).mock.calls[0][1].depuis).toEqual(new Date(MAINTENANT - 7 * 86_400_000))
  })

  it('mot de passe changé : code identifiants_refuses renvoyé, ligne conservée, pipeline non appelé, mot de passe absent des journaux', async () => {
    vi.mocked(releverBoiteImap).mockRejectedValueOnce(new ErreurImap('identifiants_refuses', 'Identifiant ou mot de passe refusé', 'NO [AUTHENTICATIONFAILED]'))
    const data = await expectJson(await callPollPOST(requetePoll({})), 200)
    expect(data.results[0]).toMatchObject({ syndic_id: SYNDIC_ID, provider: 'imap', code: 'identifiants_refuses', error: 'Lecture de la boîte e-mail impossible' })
    expect(mockProcessIncomingEmail).not.toHaveBeenCalled()
    expect(jetons.updates).toEqual([])
    expect(JSON.stringify([logger.error.mock.calls, logger.warn.mock.calls, logger.info.mock.calls])).not.toContain(IDENTIFIANTS.motDePasse)
  })

  it('ligne OAuth sans refresh_token (connexion abandonnée) : toujours ignorée', async () => {
    jetons.ligne = { provider: 'microsoft', access_token: 'acces-1', refresh_token: '', token_expiry: EXPIRATION_IMAP }
    const data = await expectJson(await callPollPOST(requetePoll({})), 200)
    expect(data.results).toEqual([])
    expect(releverBoiteImap).not.toHaveBeenCalled()
  })
})
