// @vitest-environment node
// tests/api/pro-invitation-equipe.test.ts
//
// Invitation d'un membre d'équipe pro (BTP) : le lien d'invitation part seulement par e-mail, signé côté
// serveur. L'API ne le renvoie pas à l'invitant, et l'acceptation exige la signature : le jeton seul,
// tel qu'il est enregistré dans pro_team_members, ne suffit pas. Un compte existant d'un autre espace
// n'est jamais converti.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { nouvelleBase, clientMemoire, appelsDe, type BaseMemoire } from './syndic-supabase-memoire'
import { jetonDuLien, lireJetonDuLien, signatureValide } from '@/lib/equipe/lien-invitation'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  emailEnvoye: true,
  urlsEmail: [] as string[],
  admin: {
    createUser: vi.fn(),
    listUsers: vi.fn(),
    getUserById: vi.fn(),
    updateUserById: vi.fn(),
  },
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => (h.emailEnvoye ? { success: true } : { success: false, error: 'échec' })),
  templateProTeamInvite: vi.fn((p: { inviteUrl: string }) => {
    h.urlsEmail.push(p.inviteUrl)
    return { subject: 'Invitation', html: `<a href="${p.inviteUrl}">Rejoindre</a>` }
  }),
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({
    id: GERANT_ID, email: 'gerant@societe.fr',
    app_metadata: { role: 'pro_societe' }, user_metadata: { company_name: 'Société Test' },
  })),
  isProSocieteRole: vi.fn(() => true),
  isProGerant: vi.fn(() => true),
  resolveCompanyId: vi.fn(async () => GERANT_ID),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => clientMemoire(h.base).from(table),
    auth: { admin: h.admin },
  },
}))

const GERANT_ID = '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d'
const INVITE_ID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const NONCE = 'a1'.repeat(24)
const CLE_TEST = 'cle-de-service-de-test'

const equipe = await import('@/app/api/pro/team/route')
const invite = await import('@/app/api/pro/invite/route')

const requete = (url: string, init: { method?: string; body?: unknown } = {}) =>
  new NextRequest(url, {
    method: init.method ?? 'GET',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  })

function ligneInvitation(modif: Record<string, unknown> = {}) {
  return {
    id: INVITE_ID,
    company_id: GERANT_ID,
    email: 'claire@exemple.fr',
    full_name: 'Claire Martin',
    role: 'OUVRIER',
    invite_token: NONCE,
    accepted_at: null,
    created_at: new Date().toISOString(),
    ...modif,
  }
}

const jetonSigne = () => jetonDuLien('pro', {
  id: INVITE_ID, email: 'claire@exemple.fr', invite_token: NONCE, equipe_id: GERANT_ID,
})

const accepter = (token: string) => invite.POST(requete('https://vitfix.io/api/pro/invite', {
  method: 'POST', body: { token, password: 'MotDePasse1' },
}))

let cleAvant: string | undefined
beforeEach(() => {
  cleAvant = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = CLE_TEST
  h.base = nouvelleBase()
  h.emailEnvoye = true
  h.urlsEmail = []
  h.admin.createUser.mockReset().mockResolvedValue({ data: { user: { id: 'compte-neuf' } }, error: null })
  h.admin.listUsers.mockReset().mockResolvedValue({ data: { users: [{ id: 'compte-existant', email: 'claire@exemple.fr' }] }, error: null })
  h.admin.getUserById.mockReset().mockResolvedValue({ data: { user: { id: 'compte-existant', app_metadata: {} } }, error: null })
  h.admin.updateUserById.mockReset().mockResolvedValue({ data: {}, error: null })
})
afterEach(() => {
  if (cleAvant === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = cleAvant
})

describe('POST /api/pro/team — le lien part seulement par e-mail', () => {
  const inviter = () => equipe.POST(requete('https://vitfix.io/api/pro/team', {
    method: 'POST', body: { email: 'Claire@Exemple.fr', full_name: 'Claire Martin', memberRole: 'OUVRIER' },
  }))

  it("ne renvoie ni le lien ni le jeton à l'invitant", async () => {
    h.base.inserts.pro_team_members = { id: INVITE_ID, email: 'claire@exemple.fr', invite_token: NONCE, role: 'OUVRIER' }
    const res = await inviter()
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps).not.toHaveProperty('invite_url')
    expect(corps.member).toEqual({ id: INVITE_ID, email: 'claire@exemple.fr', role: 'OUVRIER' })
    expect(corps.email_sent).toBe(true)

    const insere = appelsDe(h.base, 'pro_team_members', 'insert')[0].donnees as Record<string, string>
    expect(JSON.stringify(corps)).not.toContain(insere.invite_token)
  })

  it("envoie un lien signé, lié à la ligne insérée", async () => {
    await inviter()
    const insere = appelsDe(h.base, 'pro_team_members', 'insert')[0].donnees as Record<string, string>
    expect(insere.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(insere.email).toBe('claire@exemple.fr')

    expect(h.urlsEmail).toHaveLength(1)
    const token = new URL(h.urlsEmail[0], 'https://vitfix.io').searchParams.get('token') ?? ''
    const lu = lireJetonDuLien(token)
    expect(lu?.jeton).toBe(insere.invite_token)
    expect(await signatureValide('pro', lu!.signature, {
      id: insere.id, email: insere.email, invite_token: insere.invite_token, equipe_id: GERANT_ID,
    })).toBe(true)
  })

  it("e-mail en échec : message sans lien, l'invitant doit renvoyer l'invitation", async () => {
    h.emailEnvoye = false
    const res = await inviter()
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.email_sent).toBe(false)
    expect(corps).not.toHaveProperty('invite_url')
    expect(corps.message).not.toMatch(/token=|https?:\/\//)
    expect(corps.message).toMatch(/renvoyez l'invitation/i)
  })
})

describe('GET /api/pro/invite — signature exigée', () => {
  const lire = (token: string) => invite.GET(requete(`https://vitfix.io/api/pro/invite?token=${encodeURIComponent(token)}`))

  it('jeton seul (tel que lu en base) : 404', async () => {
    h.base.lignes.pro_team_members = [ligneInvitation()]
    expect((await lire(NONCE)).status).toBe(404)
  })

  it('signature fabriquée : 404', async () => {
    h.base.lignes.pro_team_members = [ligneInvitation()]
    expect((await lire(`${NONCE}.${'c'.repeat(64)}`)).status).toBe(404)
  })

  it("e-mail de la ligne modifié après l'envoi : 404", async () => {
    const token = await jetonSigne()
    h.base.lignes.pro_team_members = [ligneInvitation({ email: 'autre@exemple.fr' })]
    expect((await lire(token)).status).toBe(404)
  })

  it('lien signé : 200, e-mail masqué', async () => {
    h.base.lignes.pro_team_members = [ligneInvitation()]
    const res = await lire(await jetonSigne())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ valid: true, email: 'cl***@exemple.fr', role: 'OUVRIER' })
  })
})

describe('POST /api/pro/invite — acceptation', () => {
  it('jeton seul : 404, aucun compte créé ni modifié', async () => {
    h.base.lignes.pro_team_members = [ligneInvitation()]
    const res = await accepter(NONCE)
    expect(res.status).toBe(404)
    expect(h.admin.createUser).not.toHaveBeenCalled()
    expect(h.admin.updateUserById).not.toHaveBeenCalled()
    expect(appelsDe(h.base, 'pro_team_members', 'update')).toHaveLength(0)
  })

  it("signature valide mais e-mail de la ligne modifié : 404, aucun compte créé", async () => {
    const token = await jetonSigne()
    h.base.lignes.pro_team_members = [ligneInvitation({ email: 'autre@exemple.fr' })]
    expect((await accepter(token)).status).toBe(404)
    expect(h.admin.createUser).not.toHaveBeenCalled()
  })

  it("lien signé, compte neuf : créé pour l'e-mail invité et invitation acceptée", async () => {
    h.base.lignes.pro_team_members = [ligneInvitation()]
    const res = await accepter(await jetonSigne())
    expect(res.status).toBe(200)
    expect(h.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'claire@exemple.fr',
      app_metadata: { role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: GERANT_ID },
    }))
    const maj = appelsDe(h.base, 'pro_team_members', 'update')[0]
    expect(maj.donnees).toMatchObject({ user_id: 'compte-neuf', invite_token: null })
    expect(maj.eq).toContainEqual(['id', INVITE_ID])
  })

  describe('compte existant', () => {
    beforeEach(() => {
      h.base.lignes.pro_team_members = [ligneInvitation()]
      h.admin.createUser.mockResolvedValue({ data: { user: null }, error: { message: 'A user with this email address has already been registered' } })
    })

    it.each([
      ['artisan', { role: 'artisan' }],
      ['client', { role: 'client' }],
      ['gérant de société', { role: 'pro_societe' }],
      ['gérant de société (GERANT)', { role: 'pro_societe', pro_team_role: 'GERANT' }],
      ['cabinet syndic', { role: 'syndic' }],
      ['super_admin', { role: 'super_admin' }],
    ])("d'un autre espace (%s) : 409, rien n'est modifié", async (_cas, appMetadata) => {
      h.admin.getUserById.mockResolvedValue({ data: { user: { id: 'compte-existant', app_metadata: appMetadata } }, error: null })
      const res = await accepter(await jetonSigne())
      expect(res.status).toBe(409)
      expect((await res.json()).error).toMatch(/autre espace/)
      expect(h.admin.updateUserById).not.toHaveBeenCalled()
      expect(appelsDe(h.base, 'pro_team_members', 'update')).toHaveLength(0)
    })

    it("sous-compte d'une autre équipe pro : rattaché à la nouvelle société", async () => {
      h.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'compte-existant', app_metadata: { role: 'pro_societe', pro_team_role: 'CHEF_CHANTIER', company_id: 'ancienne', provider: 'email' } } },
        error: null,
      })
      const res = await accepter(await jetonSigne())
      expect(res.status).toBe(200)
      expect(h.admin.updateUserById).toHaveBeenCalledWith('compte-existant', {
        app_metadata: { role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: GERANT_ID, provider: 'email' },
      })
      expect(appelsDe(h.base, 'pro_team_members', 'update')[0].donnees).toMatchObject({ user_id: 'compte-existant' })
    })

    it('compte sans rôle : rattaché', async () => {
      const res = await accepter(await jetonSigne())
      expect(res.status).toBe(200)
      expect(h.admin.updateUserById).toHaveBeenCalledTimes(1)
    })

    it("lecture du compte en échec : 500, rien n'est modifié", async () => {
      h.admin.getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'timeout' } })
      const res = await accepter(await jetonSigne())
      expect(res.status).toBe(500)
      expect(h.admin.updateUserById).not.toHaveBeenCalled()
      expect(appelsDe(h.base, 'pro_team_members', 'update')).toHaveLength(0)
    })
  })
})
