// @vitest-environment node
// POST /api/referral/signup — lien filleul → parrain pour un artisan connecté (Bearer
// obligatoire, user_id et artisan_id contrôlés contre la session). Logique de
// parrainage dans lib/referral-signup.ts, partagée avec /api/pro/register/parrainage-artisan.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const ARTISAN_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8'
const AUTRE_ARTISAN_ID = '6ba7b811-9dad-41d1-80b4-00c04fd430c8'
const PARRAIN = { id: 'profil-parrain', user_id: 'user-parrain', company_name: 'Martin Électricité', email: '', referral_flagged: false }

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  sessionUser: null as { id: string } | null,
  getParrainByCode: vi.fn(),
  checkAutoParrainage: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response(null, { status: 429 })),
}))

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.sessionUser) }))

vi.mock('@/lib/referral', () => ({
  getParrainByCode: h.getParrainByCode,
  checkAutoParrainage: h.checkAutoParrainage,
  computeRiskScore: vi.fn().mockResolvedValue(0),
  generateReferralCode: vi.fn().mockResolvedValue('FILLEUL9'),
}))

vi.mock('@/lib/email-referral', () => ({
  sendReferralWelcomeFilleul: vi.fn(),
  sendReferralNotifParrain: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: (t: string) => clientMemoire(h.base).from(t) },
}))

async function appeler(body: unknown) {
  const { POST } = await import('@/app/api/referral/signup/route')
  return POST(new Request('http://localhost/api/referral/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jeton' },
    body: JSON.stringify(body),
  }) as never)
}

const corps = (surcharge: Record<string, unknown> = {}) => ({ code: 'PARRAIN1', artisan_id: ARTISAN_ID, user_id: USER_ID, ...surcharge })

beforeEach(() => {
  h.base = nouvelleBase()
  h.base.lignes.profiles_artisan = [
    { id: ARTISAN_ID, user_id: USER_ID, email: 'filleul@exemple.fr' },
    { id: AUTRE_ARTISAN_ID, user_id: 'autre-user' },
  ]
  h.sessionUser = { id: USER_ID }
  h.getParrainByCode.mockReset().mockImplementation(async (code: string) => (code === 'PARRAIN1' ? PARRAIN : null))
  h.checkAutoParrainage.mockReset().mockResolvedValue(false)
})

describe('POST /api/referral/signup', () => {
  it("rattache l'artisan de la session à son parrain", async () => {
    const res = await appeler(corps())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, referral: true, parrain_name: 'Martin Électricité' })
    expect(h.checkAutoParrainage).toHaveBeenCalledWith('profil-parrain', ARTISAN_ID)
    expect(appelsDe(h.base, 'profiles_artisan', 'update')[0].donnees).toEqual({ referral_parrain_id: 'profil-parrain' })
  })

  it('code inconnu : aucun lien', async () => {
    const res = await appeler(corps({ code: 'INCONNU' }))
    expect(await res.json()).toEqual({ success: true, referral: false })
    expect(h.base.appels.filter((a) => a.op !== 'select')).toEqual([])
  })

  it('auto-parrainage : aucun lien', async () => {
    h.checkAutoParrainage.mockResolvedValue(true)
    const res = await appeler(corps())
    expect(await res.json()).toEqual({ success: true, referral: false })
    expect(appelsDe(h.base, 'profiles_artisan', 'update')).toEqual([])
  })

  it('401 sans session', async () => {
    h.sessionUser = null
    expect((await appeler(corps())).status).toBe(401)
    expect(h.getParrainByCode).not.toHaveBeenCalled()
  })

  it("403 quand user_id n'est pas celui de la session", async () => {
    h.sessionUser = { id: 'autre-user' }
    expect((await appeler(corps())).status).toBe(403)
    expect(h.getParrainByCode).not.toHaveBeenCalled()
  })

  it("403 pour l'artisan d'un autre compte", async () => {
    expect((await appeler(corps({ artisan_id: AUTRE_ARTISAN_ID }))).status).toBe(403)
    expect(h.getParrainByCode).not.toHaveBeenCalled()
  })

  it('400 pour un code trop court', async () => {
    expect((await appeler(corps({ code: 'AB' }))).status).toBe(400)
  })
})
