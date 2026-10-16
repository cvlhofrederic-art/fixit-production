// @vitest-environment node
// POST /api/pro/register/parrainage-artisan — lien filleul → parrain de l'inscription
// artisan, sans session (confirmation d'e-mail active : signUp ne renvoie pas de jeton).
// Le filleul est retrouvé à partir de user_id ; mêmes contrôles que /api/referral/signup
// (code valide, anti-auto-parrainage, score de risque). Supabase en mémoire.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const PROFIL_ID = 'profil-filleul'
const PARRAIN_ID = 'profil-parrain'

const PARRAIN = {
  id: PARRAIN_ID,
  user_id: 'user-parrain',
  company_name: 'Martin Électricité',
  email: 'parrain@exemple.fr',
  referral_flagged: false,
}

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  authUser: null as Record<string, unknown> | null,
  checkRateLimit: vi.fn(),
  getParrainByCode: vi.fn(),
  checkAutoParrainage: vi.fn(),
  computeRiskScore: vi.fn(),
  generateReferralCode: vi.fn(),
  emailFilleul: vi.fn(),
  emailParrain: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: h.checkRateLimit,
  getClientIP: vi.fn().mockReturnValue('203.0.113.7'),
  rateLimitResponse: vi.fn(() => new Response(null, { status: 429 })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/referral', () => ({
  getParrainByCode: h.getParrainByCode,
  checkAutoParrainage: h.checkAutoParrainage,
  computeRiskScore: h.computeRiskScore,
  generateReferralCode: h.generateReferralCode,
}))

vi.mock('@/lib/email-referral', () => ({
  sendReferralWelcomeFilleul: h.emailFilleul,
  sendReferralNotifParrain: h.emailParrain,
}))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: vi.fn(async () => (
          h.authUser
            ? { data: { user: h.authUser }, error: null }
            : { data: { user: null }, error: { message: 'User not found' } }
        )),
      },
    },
    from: (t: string) => clientMemoire(h.base).from(t),
  },
}))

function utilisateur(surcharge: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'filleul@exemple.fr',
    created_at: new Date().toISOString(),
    app_metadata: { role: 'artisan' },
    user_metadata: { role: 'artisan', full_name: 'Paul Durand' },
    ...surcharge,
  }
}

async function appeler(body: unknown) {
  const { POST } = await import('@/app/api/pro/register/parrainage-artisan/route')
  // Aucun en-tête Authorization : c'est tout l'objet de la route.
  return POST(new Request('http://localhost/api/pro/register/parrainage-artisan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as never)
}

const ecritures = () => h.base.appels.filter((a) => a.op !== 'select')
const majProfil = () => appelsDe(h.base, 'profiles_artisan', 'update')

beforeEach(() => {
  h.base = nouvelleBase()
  h.base.lignes.profiles_artisan = [
    { id: PROFIL_ID, user_id: USER_ID, email: 'filleul@exemple.fr', company_name: 'Durand Plomberie', referral_parrain_id: null, referral_code: null },
    { id: PARRAIN_ID, user_id: 'user-parrain', email: 'parrain@exemple.fr', company_name: 'Martin Électricité', referral_code: 'PARRAIN1' },
  ]
  h.base.lignes.referrals = []
  h.authUser = utilisateur()
  h.checkRateLimit.mockReset().mockResolvedValue(true)
  h.getParrainByCode.mockReset().mockImplementation(async (code: string) => (code.toUpperCase() === 'PARRAIN1' ? PARRAIN : null))
  h.checkAutoParrainage.mockReset().mockResolvedValue(false)
  h.computeRiskScore.mockReset().mockResolvedValue(0)
  h.generateReferralCode.mockReset().mockResolvedValue('FILLEUL9')
  h.emailFilleul.mockReset().mockResolvedValue(undefined)
  h.emailParrain.mockReset().mockResolvedValue(undefined)
})

describe('POST /api/pro/register/parrainage-artisan — parrainage sans session', () => {
  it('rattache le filleul au clic en attente et renvoie le nom du parrain pour le bandeau', async () => {
    h.base.lignes.referrals = [
      { id: 'ref-1', code: 'PARRAIN1', parrain_id: PARRAIN_ID, statut: 'en_attente', filleul_id: null, ip_clic: '203.0.113.7' },
    ]

    const res = await appeler({ user_id: USER_ID, code: 'PARRAIN1' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, referral: true, parrain_name: 'Martin Électricité' })

    expect(h.checkAutoParrainage).toHaveBeenCalledWith(PARRAIN_ID, PROFIL_ID)
    const majReferral = appelsDe(h.base, 'referrals', 'update')[0]
    expect(majReferral.donnees).toMatchObject({
      filleul_id: PROFIL_ID, statut: 'inscrit', ip_inscription: '203.0.113.7', meme_ip_que_parrain: true,
    })
    expect(majReferral.eq).toEqual([['id', 'ref-1']])
    expect(h.computeRiskScore).toHaveBeenCalledWith('ref-1')
    expect(appelsDe(h.base, 'referral_risk_log', 'insert')[0].donnees).toEqual({
      referral_id: 'ref-1', artisan_id: PROFIL_ID, type_evenement: 'inscription', ip: '203.0.113.7',
    })

    expect(majProfil().map((a) => [a.donnees, a.eq])).toEqual([
      [{ referral_parrain_id: PARRAIN_ID }, [['id', PROFIL_ID]]],
      [{ referral_code: 'FILLEUL9' }, [['id', PROFIL_ID]]],
    ])
    expect(h.emailFilleul).toHaveBeenCalledWith(expect.objectContaining({ filleulEmail: 'filleul@exemple.fr', parrainName: 'Martin Électricité' }))
    expect(h.emailParrain).toHaveBeenCalledWith(expect.objectContaining({ parrainEmail: 'parrain@exemple.fr', referralCode: 'PARRAIN1' }))
  })

  it("crée le referral quand aucun clic n'est en attente", async () => {
    const res = await appeler({ user_id: USER_ID, code: 'parrain1' })

    expect(await res.json()).toEqual({ success: true, referral: true, parrain_name: 'Martin Électricité' })
    expect(appelsDe(h.base, 'referrals', 'insert')[0].donnees).toMatchObject({
      parrain_id: PARRAIN_ID, filleul_id: PROFIL_ID, code: 'PARRAIN1', statut: 'inscrit',
      ip_inscription: '203.0.113.7', meme_ip_que_parrain: false,
    })
    expect(h.computeRiskScore).toHaveBeenCalledWith('referrals-nouveau')
    expect(majProfil()[0].donnees).toEqual({ referral_parrain_id: PARRAIN_ID })
  })

  it("e-mails envoyés même si profiles_artisan n'a pas de colonne first_name (absente des migrations)", async () => {
    h.base.colonnesAbsentes = { profiles_artisan: ['first_name'] }

    const res = await appeler({ user_id: USER_ID, code: 'PARRAIN1' })

    expect(await res.json()).toEqual({ success: true, referral: true, parrain_name: 'Martin Électricité' })
    expect(h.emailFilleul).toHaveBeenCalledWith({
      filleulEmail: 'filleul@exemple.fr', filleulName: 'Durand Plomberie', parrainName: 'Martin Électricité',
    })
    expect(h.emailParrain).toHaveBeenCalledWith({
      parrainEmail: 'parrain@exemple.fr', parrainName: 'Martin Électricité', filleulName: 'Durand Plomberie', referralCode: 'PARRAIN1',
    })
  })

  it('le filleul est toujours le profil du compte qui s\'inscrit : un artisan_id envoyé est ignoré', async () => {
    await appeler({ user_id: USER_ID, code: 'PARRAIN1', artisan_id: PARRAIN_ID })

    expect(h.checkAutoParrainage).toHaveBeenCalledWith(PARRAIN_ID, PROFIL_ID)
    expect(majProfil().every((a) => a.eq[0][1] === PROFIL_ID)).toBe(true)
    expect(appelsDe(h.base, 'referrals', 'insert')[0].donnees).toMatchObject({ filleul_id: PROFIL_ID })
  })

  it('code inconnu ou parrain signalé : inscription normale, aucun lien', async () => {
    const res = await appeler({ user_id: USER_ID, code: 'INCONNU' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, referral: false })
    expect(ecritures()).toEqual([])
    expect(h.emailParrain).not.toHaveBeenCalled()
  })

  it('auto-parrainage : bloqué en silence, sans lien ni bandeau', async () => {
    h.checkAutoParrainage.mockResolvedValue(true)
    h.base.lignes.referrals = [
      { id: 'ref-1', code: 'PARRAIN1', parrain_id: PARRAIN_ID, statut: 'en_attente', filleul_id: null, ip_clic: '203.0.113.7' },
    ]

    const res = await appeler({ user_id: USER_ID, code: 'PARRAIN1' })

    expect(await res.json()).toEqual({ success: true, referral: false })
    expect(appelsDe(h.base, 'referrals', 'update')[0].donnees).toMatchObject({
      statut: 'bloque', filleul_id: PROFIL_ID, risk_flags: ['auto_parrainage'], risk_score: 10,
    })
    expect(appelsDe(h.base, 'referral_risk_log', 'insert')[0].donnees).toMatchObject({
      referral_id: 'ref-1', artisan_id: PROFIL_ID, type_evenement: 'auto_parrainage_bloque',
    })
    expect(majProfil()).toEqual([])
    expect(h.emailFilleul).not.toHaveBeenCalled()
  })

  it("un filleul déjà rattaché ne l'est jamais une seconde fois", async () => {
    h.base.lignes.profiles_artisan[0].referral_parrain_id = 'profil-premier-parrain'

    const res = await appeler({ user_id: USER_ID, code: 'PARRAIN1' })

    expect(await res.json()).toEqual({ success: true, referral: false })
    expect(h.getParrainByCode).not.toHaveBeenCalled()
    expect(ecritures()).toEqual([])
  })

  it('500 sans détail interne quand le contrôle du code échoue', async () => {
    h.getParrainByCode.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.3:5432'))

    const res = await appeler({ user_id: USER_ID, code: 'PARRAIN1' })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Erreur interne' })
  })
})

describe('POST /api/pro/register/parrainage-artisan — gardes', () => {
  it('429 au-delà de la limite de requêtes', async () => {
    h.checkRateLimit.mockResolvedValue(false)
    expect((await appeler({ user_id: USER_ID, code: 'PARRAIN1' })).status).toBe(429)
    expect(h.getParrainByCode).not.toHaveBeenCalled()
  })

  it('400 pour un corps invalide (code manquant ou trop court, user_id absent ou mal formé, JSON illisible)', async () => {
    expect((await appeler({ user_id: USER_ID })).status).toBe(400)
    expect((await appeler({ user_id: USER_ID, code: 'AB' })).status).toBe(400)
    expect((await appeler({ code: 'PARRAIN1' })).status).toBe(400)
    expect((await appeler({ user_id: 'pas-un-uuid', code: 'PARRAIN1' })).status).toBe(400)
    expect((await appeler('{pas du json')).status).toBe(400)
    expect(h.getParrainByCode).not.toHaveBeenCalled()
  })

  it('404 pour un utilisateur inconnu', async () => {
    h.authUser = null
    expect((await appeler({ user_id: USER_ID, code: 'PARRAIN1' })).status).toBe(404)
    expect(h.getParrainByCode).not.toHaveBeenCalled()
  })

  it('403 quand le compte a plus de 10 minutes', async () => {
    h.authUser = utilisateur({ created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString() })
    expect((await appeler({ user_id: USER_ID, code: 'PARRAIN1' })).status).toBe(403)
    expect(h.getParrainByCode).not.toHaveBeenCalled()
  })

  it('403 pour une société BTP', async () => {
    h.authUser = utilisateur({ app_metadata: { role: 'pro_societe' } })
    expect((await appeler({ user_id: USER_ID, code: 'PARRAIN1' })).status).toBe(403)
    expect(h.getParrainByCode).not.toHaveBeenCalled()
  })

  it('403 hors artisan, même si user_metadata (modifiable par le client) dit artisan', async () => {
    h.authUser = utilisateur({ app_metadata: {}, user_metadata: { role: 'artisan' } })
    expect((await appeler({ user_id: USER_ID, code: 'PARRAIN1' })).status).toBe(403)
    expect(h.getParrainByCode).not.toHaveBeenCalled()
  })

  it('404 sans profil (create-profile pas encore passé)', async () => {
    h.base.lignes.profiles_artisan = h.base.lignes.profiles_artisan.filter((p) => p.id !== PROFIL_ID)
    expect((await appeler({ user_id: USER_ID, code: 'PARRAIN1' })).status).toBe(404)
    expect(h.getParrainByCode).not.toHaveBeenCalled()
  })

  it('500 sans détail interne quand la lecture du profil échoue', async () => {
    h.base.erreurs['profiles_artisan.select'] = { message: 'column "country" does not exist' }
    const res = await appeler({ user_id: USER_ID, code: 'PARRAIN1' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Erreur serveur' })
  })
})
