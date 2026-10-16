// @vitest-environment node
// POST /api/kyc-orchestrate — authentification et propriété ; le pipeline
// (lib/kyc-orchestrate.ts) est testé dans tests/lib/kyc-orchestrate.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  runKycPipeline: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: mocks.getAuthUser }))
vi.mock('@/lib/kyc-orchestrate', () => ({ runKycPipeline: mocks.runKycPipeline }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ logger: { api: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function requete(body: unknown) {
  return new Request('http://localhost/api/kyc-orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jeton' },
    body: JSON.stringify(body),
  })
}

async function appeler(body: unknown) {
  const { POST } = await import('@/app/api/kyc-orchestrate/route')
  return POST(requete(body) as never)
}

beforeEach(() => {
  mocks.getAuthUser.mockReset().mockResolvedValue({ id: USER_ID })
  mocks.runKycPipeline.mockReset()
})

describe('POST /api/kyc-orchestrate', () => {
  it('401 sans session : le pipeline n\'est pas lancé', async () => {
    mocks.getAuthUser.mockResolvedValue(null)
    const res = await appeler({ artisan_id: 'profil-1' })
    expect(res.status).toBe(401)
    expect(mocks.runKycPipeline).not.toHaveBeenCalled()
  })

  it('400 sans artisan_id', async () => {
    const res = await appeler({})
    expect(res.status).toBe(400)
    expect(mocks.runKycPipeline).not.toHaveBeenCalled()
  })

  it('lance le pipeline pour l\'utilisateur connecté et renvoie son résultat tel quel', async () => {
    const result = { score: 72, decision: 'manual_review', checks: {}, details: [], market: 'fr_btp' }
    mocks.runKycPipeline.mockResolvedValue({ ok: true, result })

    const res = await appeler({ artisan_id: 'profil-1' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(result)
    expect(mocks.runKycPipeline).toHaveBeenCalledWith('profil-1', USER_ID)
  })

  it('404 quand le profil est introuvable', async () => {
    mocks.runKycPipeline.mockResolvedValue({ ok: false, status: 404 })
    const res = await appeler({ artisan_id: 'profil-x' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Artisan not found' })
  })

  it('403 quand le profil appartient à quelqu\'un d\'autre', async () => {
    mocks.runKycPipeline.mockResolvedValue({ ok: false, status: 403 })
    const res = await appeler({ artisan_id: 'profil-autre' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
  })
})
