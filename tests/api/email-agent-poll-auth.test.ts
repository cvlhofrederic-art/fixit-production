// Tests d'auth du POST /api/email-agent/poll (audit ENV-04).
//
// Trois chemins d'auth quand syndic_id est fourni :
//   1. Header x-internal-trigger présent → comparaison temps constant avec
//      INTERNAL_POLL_TOKEN (appel interne webhook Gmail, pas de cookies).
//      Invalide/vide/serveur non configuré → 401, jamais de fallback cookie.
//   2. Pas de header → auth cookie inchangée (getAuthUser + resolveCabinetId).
//   3. Pas de syndic_id → chemin cron (x-cron-key), hors scope ici.
//
// Échafaudage commun (mocks, builders, helpers) : ./email-agent-test-utils.ts.

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
  makeOauthTokensMock,
  makePollRequest,
  makeSanitizeContextMock,
  makeSupabaseAdminMock,
  makeTokensChain,
  makeValidationMock,
} from './email-agent-test-utils'

// ── Mocks des dépendances lourdes de la route ────────────────────────────────
// vi.mock est hoisté par fichier : les appels restent ici, mais les factories
// viennent du module partagé (exécution paresseuse à l'import de la route).
const auth = makeAuthHelperSpies()
vi.mock('@/lib/auth-helpers', () => auth)

// supabaseAdmin chaînable — le fallback "plain token" retourne data:null
// → la boucle `continue` immédiatement, aucun appel Gmail.
const tokens = makeTokensChain()
vi.mock('@/lib/supabase-server', () => makeSupabaseAdminMock(() => tokens.chain))

vi.mock('@/lib/oauth/tokens', () => makeOauthTokensMock())
vi.mock('@/lib/syndic/alfredo-pipeline', () => makeAlfredoPipelineMock())
vi.mock('@/lib/syndic/alfredo-load-client-context', () => makeAlfredoContextMock())
vi.mock('@/lib/syndic/alfredo-classify', () => makeAlfredoClassifyMock())
vi.mock('@/lib/syndic/alfredo-draft', () => makeAlfredoDraftMock())
vi.mock('@/lib/ai/sanitize-context', () => makeSanitizeContextMock())
vi.mock('@/lib/validation', () => makeValidationMock())

const logger = makeLoggerSpies()
vi.mock('@/lib/logger', () => makeLoggerMock(logger))

beforeEach(() => {
  vi.clearAllMocks()
  tokens.single.mockResolvedValue({ data: null, error: null })
  vi.stubEnv('INTERNAL_POLL_TOKEN', INTERNAL_TOKEN)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/email-agent/poll — auth interne x-internal-trigger', () => {
  it('token valide → autorisé (200), sans passer par l\'auth cookie', async () => {
    const res = await callPollPOST(makePollRequest({ internalToken: INTERNAL_TOKEN }))
    const data = await expectJson(res, 200)
    expect(data.success).toBe(true)
    // Bypass cookie : getAuthUser ne doit jamais être appelé
    expect(auth.getAuthUser).not.toHaveBeenCalled()
  })

  it('token valide → scopé au seul syndic_id transmis', async () => {
    const res = await callPollPOST(makePollRequest({ internalToken: INTERNAL_TOKEN }))
    expect(res.status).toBe(200)
    // La boucle ne traite que ce syndic : 1 seul lookup token plain
    expect(tokens.chain.eq).toHaveBeenCalledWith('syndic_id', SYNDIC_ID)
    expect(tokens.single).toHaveBeenCalledTimes(1)
  })

  it('token invalide → 401', async () => {
    const res = await callPollPOST(makePollRequest({ internalToken: 'mauvais-token' }))
    expect(res.status).toBe(401)
    expect(auth.getAuthUser).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('token de même longueur mais différent → 401 (comparaison réelle du contenu)', async () => {
    const sameLength = 'X'.repeat(INTERNAL_TOKEN.length)
    const res = await callPollPOST(makePollRequest({ internalToken: sameLength }))
    expect(res.status).toBe(401)
  })

  it('header vide → 401 (jamais traité comme absent)', async () => {
    const res = await callPollPOST(makePollRequest({ internalToken: '' }))
    expect(res.status).toBe(401)
    expect(auth.getAuthUser).not.toHaveBeenCalled()
  })

  it('INTERNAL_POLL_TOKEN non configuré côté serveur → 401 même avec un header', async () => {
    vi.stubEnv('INTERNAL_POLL_TOKEN', '')
    const res = await callPollPOST(makePollRequest({ internalToken: 'nimporte-quoi' }))
    expect(res.status).toBe(401)
  })

  it('vide==vide refusé : env vide + header vide → 401', async () => {
    vi.stubEnv('INTERNAL_POLL_TOKEN', '')
    const res = await callPollPOST(makePollRequest({ internalToken: '' }))
    expect(res.status).toBe(401)
  })

  it('header invalide ne retombe PAS sur l\'auth cookie (pas de fallback silencieux)', async () => {
    // Même avec un user cookie valide, un header invalide doit refuser
    auth.getAuthUser.mockResolvedValue({ id: 'user-1' })
    auth.isSyndicRole.mockReturnValue(true)
    auth.getUserRole.mockReturnValue('syndic')
    auth.resolveCabinetId.mockResolvedValue(SYNDIC_ID)
    const res = await callPollPOST(makePollRequest({ internalToken: 'mauvais-token' }))
    expect(res.status).toBe(401)
    expect(auth.getAuthUser).not.toHaveBeenCalled()
  })
})

describe('POST /api/email-agent/poll — chemin cookie inchangé (pas de header)', () => {
  it('pas de header + pas de session → 401', async () => {
    auth.getAuthUser.mockResolvedValue(null)
    const res = await callPollPOST(makePollRequest())
    expect(res.status).toBe(401)
    expect(auth.getAuthUser).toHaveBeenCalledTimes(1)
  })

  it('pas de header + user non syndic → 403', async () => {
    auth.getAuthUser.mockResolvedValue({ id: 'user-1' })
    auth.isSyndicRole.mockReturnValue(false)
    auth.getUserRole.mockReturnValue('artisan')
    const res = await callPollPOST(makePollRequest())
    expect(res.status).toBe(403)
  })

  it('pas de header + syndic d\'un autre cabinet → 403', async () => {
    auth.getAuthUser.mockResolvedValue({ id: 'user-1' })
    auth.isSyndicRole.mockReturnValue(true)
    auth.getUserRole.mockReturnValue('syndic')
    auth.resolveCabinetId.mockResolvedValue('autre-cabinet')
    const res = await callPollPOST(makePollRequest())
    expect(res.status).toBe(403)
  })

  it('pas de header + syndic du bon cabinet → 200', async () => {
    auth.getAuthUser.mockResolvedValue({ id: 'user-1' })
    auth.isSyndicRole.mockReturnValue(true)
    auth.getUserRole.mockReturnValue('syndic')
    auth.resolveCabinetId.mockResolvedValue(SYNDIC_ID)
    const res = await callPollPOST(makePollRequest())
    const data = await expectJson(res, 200)
    expect(data.success).toBe(true)
  })
})
