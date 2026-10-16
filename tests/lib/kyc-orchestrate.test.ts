// @vitest-environment node
// runKycPipeline (lib/kyc-orchestrate.ts) : propriété du profil et rejet immédiat
// d'un identifiant au mauvais format, sans appel réseau.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

const mocks = vi.hoisted(() => ({
  artisan: null as Record<string, unknown> | null,
  update: vi.fn(),
  updateEq: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => (mocks.artisan
            ? { data: mocks.artisan, error: null }
            : { data: null, error: { message: 'not found' } }),
        }),
      }),
      update: mocks.update,
    }),
  },
}))

beforeEach(() => {
  mocks.artisan = {
    id: 'profil-1',
    user_id: USER_ID,
    siret: '123',
    company_name: 'PROVENCE PRO',
    kbis_url: null,
    id_document_url: null,
    kyc_market: 'fr_btp',
  }
  mocks.updateEq.mockReset().mockResolvedValue({ error: null })
  mocks.update.mockReset().mockReturnValue({ eq: mocks.updateEq })
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('aucun appel réseau attendu') }))
})

describe('runKycPipeline', () => {
  it('404 quand le profil est introuvable', async () => {
    mocks.artisan = null
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    expect(await runKycPipeline('profil-x', USER_ID)).toEqual({ ok: false, status: 404 })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('403 quand le profil appartient à un autre utilisateur', async () => {
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    expect(await runKycPipeline('profil-1', 'autre-utilisateur')).toEqual({ ok: false, status: 403 })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('rejette un SIRET au mauvais format et écrit le résultat dans le profil', async () => {
    const { runKycPipeline } = await import('@/lib/kyc-orchestrate')
    const issue = await runKycPipeline('profil-1', USER_ID)

    expect(issue.ok).toBe(true)
    if (!issue.ok) return
    expect(issue.result.decision).toBe('rejected')
    expect(issue.result.market).toBe('fr_btp')
    expect(issue.result.checks.identifiantFormatValid).toBe(false)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      kyc_status: 'rejected',
      kyc_market: 'fr_btp',
      kyc_score: issue.result.score,
    }))
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'profil-1')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
