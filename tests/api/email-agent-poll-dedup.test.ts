// Tests d'idempotence du POST /api/email-agent/poll (audit ALF-2).
//
// Le poll requête Gmail `is:unread` et rien ne retire jamais le label UNREAD
// (pas de scope gmail.modify). Sans garde, chaque exécution (cron + push temps
// réel) relancerait classify + draft (2 appels Groq) sur les MÊMES emails et
// l'upsert écraserait draft_status → 'pending_review' (brouillons revus perdus).
// La route doit donc charger en UNE requête les gmail_message_id déjà en base
// pour le syndic et SAUTER les messages connus, quel que soit leur statut.
//
// Échafaudage commun (mocks, builders, fixtures Gmail) : ./email-agent-test-utils.ts.

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
  makeDedupChain,
  makeLoggerMock,
  makeLoggerSpies,
  makeOauthTokensMock,
  makePollRequest,
  makeSanitizeContextMock,
  makeSupabaseAdminMock,
  makeTokensChain,
  makeValidationMock,
  stubGmailFetch,
} from './email-agent-test-utils'

// ── Mocks des dépendances lourdes de la route ────────────────────────────────
// vi.mock est hoisté par fichier : les appels restent ici, mais les factories
// viennent du module partagé (exécution paresseuse à l'import de la route).
vi.mock('@/lib/auth-helpers', () => makeAuthHelperSpies())

// supabaseAdmin : deux chaînes distinctes —
//   syndic_oauth_tokens  → select/eq/single + update/delete (chemin tokens)
//   syndic_emails_analysed → select→eq→in (requête de dédup ALF-2)
const dedup = makeDedupChain()
const tokens = makeTokensChain()
const mockFrom = vi.fn((table: string) =>
  table === 'syndic_emails_analysed' ? dedup.chain : tokens.chain,
)
vi.mock('@/lib/supabase-server', () => makeSupabaseAdminMock(mockFrom))

// Token OAuth valide non expiré → pas de refresh, on va droit au fetch Gmail
const mockGetDecryptedToken = vi.fn()
vi.mock('@/lib/oauth/tokens', () => makeOauthTokensMock(mockGetDecryptedToken))

// Pipeline Alfredo mocké : c'est LUI qui porte classify + draft + upsert —
// s'il n'est pas appelé, aucun appel Groq ni upsert ne peut avoir lieu.
const mockProcessIncomingEmail = vi.fn()
vi.mock('@/lib/syndic/alfredo-pipeline', () => makeAlfredoPipelineMock(mockProcessIncomingEmail))
vi.mock('@/lib/syndic/alfredo-load-client-context', () => makeAlfredoContextMock())
vi.mock('@/lib/syndic/alfredo-classify', () => makeAlfredoClassifyMock())
vi.mock('@/lib/syndic/alfredo-draft', () => makeAlfredoDraftMock())
vi.mock('@/lib/ai/sanitize-context', () => makeSanitizeContextMock())
vi.mock('@/lib/validation', () => makeValidationMock())

const logger = makeLoggerSpies()
vi.mock('@/lib/logger', () => makeLoggerMock(logger))

describe('POST /api/email-agent/poll — dédup gmail_message_id (ALF-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('INTERNAL_POLL_TOKEN', INTERNAL_TOKEN)
    mockGetDecryptedToken.mockResolvedValue({
      access_token: 'access-token-valide',
      refresh_token: 'refresh-token',
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    tokens.single.mockResolvedValue({ data: null, error: null })
    mockProcessIncomingEmail.mockResolvedValue({ status: 'drafted', email_id: 'row-1' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('(a) message déjà en base → pipeline NON appelé, pas d\'upsert, compte skippé loggé', async () => {
    stubGmailFetch(['msg-1', 'msg-2'])
    dedup.mockIn.mockResolvedValue({
      data: [{ gmail_message_id: 'msg-1' }, { gmail_message_id: 'msg-2' }],
      error: null,
    })

    const res = await callPollPOST(makePollRequest({ internalToken: INTERNAL_TOKEN }))
    const data = await expectJson(res, 200)

    // Aucun retraitement : pas de classify/draft (Groq) ni d'upsert
    expect(mockProcessIncomingEmail).not.toHaveBeenCalled()
    expect(data.results[0]).toMatchObject({
      syndic_id: SYNDIC_ID,
      emails_processed: 2,
      new_emails: 0,
      skipped_known: 2,
    })
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('2 message(s)'))

    // La dédup est faite en UNE requête, scopée syndic + ids du batch
    expect(mockFrom).toHaveBeenCalledWith('syndic_emails_analysed')
    expect(dedup.chain.eq).toHaveBeenCalledWith('syndic_id', SYNDIC_ID)
    expect(dedup.mockIn).toHaveBeenCalledTimes(1)
    expect(dedup.mockIn).toHaveBeenCalledWith('gmail_message_id', ['msg-1', 'msg-2'])
  })

  it('(b) message nouveau → pipeline appelé comme avant', async () => {
    stubGmailFetch(['msg-new'])
    dedup.mockIn.mockResolvedValue({ data: [], error: null })

    const res = await callPollPOST(makePollRequest({ internalToken: INTERNAL_TOKEN }))
    const data = await expectJson(res, 200)

    expect(mockProcessIncomingEmail).toHaveBeenCalledTimes(1)
    const params = mockProcessIncomingEmail.mock.calls[0][0]
    expect(params.syndicId).toBe(SYNDIC_ID)
    expect(params.email.gmail_message_id).toBe('msg-new')
    expect(params.email.from).toBe('client-msg-new@example.com')
    expect(params.email.subject).toBe('Sujet msg-new')
    expect(data.results[0]).toMatchObject({
      emails_processed: 1,
      new_emails: 1,
      skipped_known: 0,
    })
  })

  it('(c) mix connu/nouveau → pipeline appelé UNIQUEMENT pour les nouveaux', async () => {
    stubGmailFetch(['msg-known', 'msg-new-1', 'msg-new-2'])
    // msg-known déjà en base — statut indifférent (brouillon revu, refusé…)
    dedup.mockIn.mockResolvedValue({ data: [{ gmail_message_id: 'msg-known' }], error: null })

    const res = await callPollPOST(makePollRequest({ internalToken: INTERNAL_TOKEN }))
    const data = await expectJson(res, 200)

    expect(mockProcessIncomingEmail).toHaveBeenCalledTimes(2)
    const processedIds = mockProcessIncomingEmail.mock.calls.map(
      c => (c[0] as { email: { gmail_message_id: string } }).email.gmail_message_id,
    )
    expect(processedIds).toEqual(['msg-new-1', 'msg-new-2'])
    expect(processedIds).not.toContain('msg-known')
    expect(data.results[0]).toMatchObject({
      emails_processed: 3,
      new_emails: 2,
      skipped_known: 1,
    })
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('1 message(s)'))
  })

  it('aucun message Gmail → pas de requête de dédup', async () => {
    stubGmailFetch([])
    const res = await callPollPOST(makePollRequest({ internalToken: INTERNAL_TOKEN }))
    expect(res.status).toBe(200)
    expect(dedup.mockIn).not.toHaveBeenCalled()
    expect(mockProcessIncomingEmail).not.toHaveBeenCalled()
  })

  it('échec de la requête de dédup → RIEN n\'est traité (pas d\'écrasement possible)', async () => {
    stubGmailFetch(['msg-1'])
    dedup.mockIn.mockResolvedValue({ data: null, error: { message: 'db down' } })

    const res = await callPollPOST(makePollRequest({ internalToken: INTERNAL_TOKEN }))
    const data = await expectJson(res, 200)

    expect(mockProcessIncomingEmail).not.toHaveBeenCalled()
    expect(data.results[0]).toMatchObject({ syndic_id: SYNDIC_ID, error: 'Erreur de déduplication' })
    expect(logger.error).toHaveBeenCalled()
  })
})
