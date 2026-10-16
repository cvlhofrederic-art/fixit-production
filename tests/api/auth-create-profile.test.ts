import { describe, it, expect, vi, beforeEach } from 'vitest'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

const mocks = vi.hoisted(() => ({
  existingProfile: null as { id: string } | null,
  authUser: {} as Record<string, unknown>,
  profileInsert: vi.fn(),
  specialtiesIn: vi.fn(),
  specialtiesUpsert: vi.fn(),
  teamUpsert: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({
          data: { user: { id: USER_ID, created_at: new Date().toISOString(), ...mocks.authUser } },
          error: null,
        })),
      },
    },
    from: mocks.from,
  },
}))

function requete(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/create-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.existingProfile = null
  mocks.authUser = {}
  mocks.teamUpsert.mockReset().mockResolvedValue({ error: null })
  mocks.profileInsert.mockReset().mockReturnValue({
    select: () => ({ single: async () => ({ data: { id: 'profil-nouveau' }, error: null }) }),
  })
  mocks.specialtiesIn.mockReset().mockResolvedValue({
    data: [
      { id: 'spec-1', slug: 'gros-oeuvre' },
      { id: 'spec-2', slug: 'renovation-generale' },
    ],
    error: null,
  })
  mocks.specialtiesUpsert.mockReset().mockResolvedValue({ error: null })
  mocks.from.mockReset().mockImplementation((table: string) => {
    if (table === 'profiles_artisan') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.existingProfile }) }) }),
        insert: mocks.profileInsert,
      }
    }
    if (table === 'specialties') return { select: () => ({ in: mocks.specialtiesIn }) }
    if (table === 'profile_specialties') return { upsert: mocks.specialtiesUpsert }
    if (table === 'pro_team_members') return { upsert: mocks.teamUpsert }
    return {}
  })
})

describe('POST /api/auth/create-profile — spécialités BTP', () => {
  it('enregistre les spécialités sans session, en self_declared', async () => {
    const { POST } = await import('@/app/api/auth/create-profile/route')
    const res = await POST(requete({
      user_id: USER_ID,
      company_name: 'PROVENCE PRO',
      kyc_market: 'fr_btp',
      specialty_slugs: ['gros-oeuvre', 'renovation-generale'],
    }) as never)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'profil-nouveau' })
    expect(mocks.specialtiesIn).toHaveBeenCalledWith('slug', ['gros-oeuvre', 'renovation-generale'])
    expect(mocks.specialtiesUpsert).toHaveBeenCalledWith(
      [
        { user_id: USER_ID, specialty_id: 'spec-1', verified_source: 'self_declared' },
        { user_id: USER_ID, specialty_id: 'spec-2', verified_source: 'self_declared' },
      ],
      { onConflict: 'user_id,specialty_id', ignoreDuplicates: true },
    )
  })

  it("n'envoie pas specialty_slugs dans la fiche profiles_artisan", async () => {
    const { POST } = await import('@/app/api/auth/create-profile/route')
    await POST(requete({ user_id: USER_ID, company_name: 'X', specialty_slugs: ['gros-oeuvre'] }) as never)
    expect(mocks.profileInsert).toHaveBeenCalledWith({ user_id: USER_ID, company_name: 'X' })
  })

  it('complète les spécialités même si la fiche existe déjà', async () => {
    mocks.existingProfile = { id: 'profil-existant' }
    const { POST } = await import('@/app/api/auth/create-profile/route')
    const res = await POST(requete({ user_id: USER_ID, specialty_slugs: ['gros-oeuvre'] }) as never)

    expect(await res.json()).toEqual({ id: 'profil-existant' })
    expect(mocks.profileInsert).not.toHaveBeenCalled()
    expect(mocks.specialtiesUpsert).toHaveBeenCalledTimes(1)
  })

  it('ne touche pas aux spécialités sans specialty_slugs', async () => {
    const { POST } = await import('@/app/api/auth/create-profile/route')
    const res = await POST(requete({ user_id: USER_ID, company_name: 'X' }) as never)

    expect(res.status).toBe(200)
    expect(mocks.specialtiesIn).not.toHaveBeenCalled()
    expect(mocks.specialtiesUpsert).not.toHaveBeenCalled()
  })

  it('ignore une liste mal formée', async () => {
    const { POST } = await import('@/app/api/auth/create-profile/route')
    const res = await POST(requete({ user_id: USER_ID, specialty_slugs: 'gros-oeuvre' }) as never)

    expect(res.status).toBe(200)
    expect(mocks.specialtiesIn).not.toHaveBeenCalled()
  })

  it("répond quand même avec l'id si l'écriture des spécialités échoue", async () => {
    mocks.specialtiesUpsert.mockResolvedValue({ error: { message: 'boom' } })
    const { POST } = await import('@/app/api/auth/create-profile/route')
    const res = await POST(requete({ user_id: USER_ID, specialty_slugs: ['gros-oeuvre'] }) as never)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'profil-nouveau' })
  })
})

describe('POST /api/auth/create-profile — gérant de la société BTP', () => {
  it('ajoute le gérant à son équipe, sans session', async () => {
    mocks.authUser = {
      email: 'Secretariat.ProvencePro@gmail.com',
      app_metadata: { role: 'pro_societe' },
      user_metadata: { full_name: ' Hasni BOUHALI ', phone: '06 13 84 22 89' },
    }
    const { POST } = await import('@/app/api/auth/create-profile/route')
    const res = await POST(requete({ user_id: USER_ID, company_name: 'PROVENCE PRO' }) as never)

    expect(res.status).toBe(200)
    expect(mocks.teamUpsert).toHaveBeenCalledWith(
      {
        company_id: USER_ID,
        user_id: USER_ID,
        email: 'secretariat.provencepro@gmail.com',
        full_name: 'Hasni BOUHALI',
        phone: '06 13 84 22 89',
        role: 'GERANT',
        assigned_chantiers: [],
        invite_token: null,
        invite_sent_at: null,
        accepted_at: expect.any(String),
        is_active: true,
      },
      { onConflict: 'company_id,email', ignoreDuplicates: true },
    )
  })

  it("reprend l'e-mail comme nom quand full_name manque", async () => {
    mocks.authUser = { email: 'gerant@exemple.fr', app_metadata: { role: 'pro_societe' }, user_metadata: {} }
    const { POST } = await import('@/app/api/auth/create-profile/route')
    await POST(requete({ user_id: USER_ID }) as never)

    expect(mocks.teamUpsert.mock.calls[0][0]).toMatchObject({ full_name: 'gerant@exemple.fr', phone: '' })
  })

  it('ajoute aussi le gérant quand la fiche existe déjà', async () => {
    mocks.existingProfile = { id: 'profil-existant' }
    mocks.authUser = { email: 'gerant@exemple.fr', app_metadata: { role: 'pro_societe' }, user_metadata: {} }
    const { POST } = await import('@/app/api/auth/create-profile/route')
    await POST(requete({ user_id: USER_ID }) as never)

    expect(mocks.teamUpsert).toHaveBeenCalledTimes(1)
  })

  it("n'ajoute pas de gérant pour un artisan", async () => {
    mocks.authUser = { email: 'artisan@exemple.fr', app_metadata: { role: 'artisan' }, user_metadata: {} }
    const { POST } = await import('@/app/api/auth/create-profile/route')
    await POST(requete({ user_id: USER_ID }) as never)

    expect(mocks.teamUpsert).not.toHaveBeenCalled()
  })

  it("ne se fie pas au rôle déclaré dans user_metadata", async () => {
    mocks.authUser = { email: 'x@exemple.fr', app_metadata: {}, user_metadata: { role: 'pro_societe' } }
    const { POST } = await import('@/app/api/auth/create-profile/route')
    await POST(requete({ user_id: USER_ID }) as never)

    expect(mocks.teamUpsert).not.toHaveBeenCalled()
  })

  it("répond quand même avec l'id si l'ajout du gérant échoue", async () => {
    mocks.authUser = { email: 'gerant@exemple.fr', app_metadata: { role: 'pro_societe' }, user_metadata: {} }
    mocks.teamUpsert.mockResolvedValue({ error: { message: 'boom' } })
    const { POST } = await import('@/app/api/auth/create-profile/route')
    const res = await POST(requete({ user_id: USER_ID }) as never)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'profil-nouveau' })
  })
})
