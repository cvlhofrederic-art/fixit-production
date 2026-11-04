// @vitest-environment node
// tests/api/syndic-invitation-equipe.test.ts
//
// Invitation d'un membre d'équipe syndic : même règle que côté pro. Le lien part seulement par e-mail,
// signé côté serveur. L'acceptation exige la signature, et un compte existant d'un autre espace n'est
// jamais converti.

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
  templateTeamInvite: vi.fn((p: { inviteUrl: string }) => {
    h.urlsEmail.push(p.inviteUrl)
    return { subject: 'Invitation', html: `<a href="${p.inviteUrl}">Rejoindre</a>` }
  }),
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({
    id: CABINET_ID, email: 'cabinet@syndic.fr', app_metadata: { role: 'syndic' }, user_metadata: { cabinet_name: 'Cabinet Test' },
  })),
  getUserRole: vi.fn(() => 'syndic'),
  isSyndicRole: vi.fn(() => true),
  resolveCabinetId: vi.fn(async () => CABINET_ID),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => clientMemoire(h.base).from(table),
    auth: { admin: h.admin },
  },
}))

const CABINET_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f'
const INVITE_ID = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d'
const NONCE = 'b2'.repeat(24)
const CLE_TEST = 'cle-de-service-de-test'

const equipe = await import('@/app/api/syndic/team/route')
const invite = await import('@/app/api/syndic/invite/route')

const requete = (url: string, init: { method?: string; body?: unknown } = {}) =>
  new NextRequest(url, {
    method: init.method ?? 'GET',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  })

function ligneInvitation(modif: Record<string, unknown> = {}) {
  return {
    id: INVITE_ID,
    cabinet_id: CABINET_ID,
    email: 'paul@exemple.fr',
    full_name: 'Paul Durand',
    role: 'syndic_gestionnaire',
    invite_token: NONCE,
    accepted_at: null,
    created_at: new Date().toISOString(),
    ...modif,
  }
}

const jetonSigne = () => jetonDuLien('syndic', {
  id: INVITE_ID, email: 'paul@exemple.fr', invite_token: NONCE, equipe_id: CABINET_ID,
})

const accepter = (token: string) => invite.POST(requete('https://vitfix.io/api/syndic/invite', {
  method: 'POST', body: { token, password: 'motdepasse1' },
}))

let cleAvant: string | undefined
beforeEach(() => {
  cleAvant = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = CLE_TEST
  h.base = nouvelleBase()
  h.emailEnvoye = true
  h.urlsEmail = []
  h.admin.createUser.mockReset().mockResolvedValue({ data: { user: { id: 'compte-neuf' } }, error: null })
  h.admin.listUsers.mockReset().mockResolvedValue({ data: { users: [{ id: 'compte-existant', email: 'paul@exemple.fr' }] }, error: null })
  h.admin.getUserById.mockReset().mockResolvedValue({ data: { user: { id: 'compte-existant', app_metadata: {} } }, error: null })
  h.admin.updateUserById.mockReset().mockResolvedValue({ data: {}, error: null })
})
afterEach(() => {
  if (cleAvant === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = cleAvant
})

describe('POST /api/syndic/team — le lien part seulement par e-mail', () => {
  const inviter = () => equipe.POST(requete('https://vitfix.io/api/syndic/team', {
    method: 'POST', body: { email: 'paul@exemple.fr', full_name: 'Paul Durand', memberRole: 'syndic_gestionnaire' },
  }))

  it("ne renvoie ni le lien ni le jeton à l'invitant", async () => {
    h.base.inserts.syndic_team_members = { id: INVITE_ID, email: 'paul@exemple.fr', invite_token: NONCE }
    const res = await inviter()
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps).not.toHaveProperty('invite_url')
    expect(corps.member).toEqual({ id: INVITE_ID, email: 'paul@exemple.fr' })
    const insere = appelsDe(h.base, 'syndic_team_members', 'insert')[0].donnees as Record<string, string>
    expect(JSON.stringify(corps)).not.toContain(insere.invite_token)
  })

  it('envoie un lien signé, lié à la ligne insérée', async () => {
    await inviter()
    const insere = appelsDe(h.base, 'syndic_team_members', 'insert')[0].donnees as Record<string, string>
    expect(insere.id).toMatch(/^[0-9a-f-]{36}$/)
    const token = new URL(h.urlsEmail[0], 'https://vitfix.io').searchParams.get('token') ?? ''
    const lu = lireJetonDuLien(token)
    expect(lu?.jeton).toBe(insere.invite_token)
    expect(await signatureValide('syndic', lu!.signature, {
      id: insere.id, email: insere.email, invite_token: insere.invite_token, equipe_id: CABINET_ID,
    })).toBe(true)
  })

  it('e-mail en échec : message sans lien', async () => {
    h.emailEnvoye = false
    const corps = await (await inviter()).json()
    expect(corps.email_sent).toBe(false)
    expect(corps).not.toHaveProperty('invite_url')
    expect(corps.message).not.toMatch(/token=|https?:\/\//)
    expect(corps.message).toMatch(/invitez à nouveau/i)
  })
})

describe('GET /api/syndic/invite — signature exigée', () => {
  const lire = (token: string) => invite.GET(requete(`https://vitfix.io/api/syndic/invite?token=${encodeURIComponent(token)}`))

  it('jeton seul : 404', async () => {
    h.base.lignes.syndic_team_members = [ligneInvitation()]
    expect((await lire(NONCE)).status).toBe(404)
  })

  it('lien signé : 200', async () => {
    h.base.lignes.syndic_team_members = [ligneInvitation()]
    const res = await lire(await jetonSigne())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ valid: true, email: 'pa***@exemple.fr' })
  })
})

describe('POST /api/syndic/invite — acceptation', () => {
  it('jeton seul : 404, aucun compte créé', async () => {
    h.base.lignes.syndic_team_members = [ligneInvitation()]
    expect((await accepter(NONCE)).status).toBe(404)
    expect(h.admin.createUser).not.toHaveBeenCalled()
  })

  it("équipe de la ligne modifiée après l'envoi : 404", async () => {
    const token = await jetonSigne()
    h.base.lignes.syndic_team_members = [ligneInvitation({ cabinet_id: '99999999-8888-4777-8666-555555555555' })]
    expect((await accepter(token)).status).toBe(404)
    expect(h.admin.createUser).not.toHaveBeenCalled()
  })

  it('lien signé, compte neuf : créé et invitation acceptée', async () => {
    h.base.lignes.syndic_team_members = [ligneInvitation()]
    const res = await accepter(await jetonSigne())
    expect(res.status).toBe(200)
    expect(h.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'paul@exemple.fr', app_metadata: { role: 'syndic_gestionnaire', cabinet_id: CABINET_ID },
    }))
    expect(appelsDe(h.base, 'syndic_team_members', 'update')[0].donnees).toMatchObject({ user_id: 'compte-neuf', invite_token: null })
  })

  describe('compte existant', () => {
    beforeEach(() => {
      h.base.lignes.syndic_team_members = [ligneInvitation()]
      h.admin.createUser.mockResolvedValue({ data: { user: null }, error: { message: 'A user with this email address has already been registered' } })
    })

    it.each([
      ['cabinet syndic', { role: 'syndic' }],
      ['artisan', { role: 'artisan' }],
      ['sous-compte pro', { role: 'pro_societe', pro_team_role: 'OUVRIER' }],
      ['super_admin', { role: 'super_admin' }],
    ])("d'un autre espace (%s) : 409, rien n'est modifié", async (_cas, appMetadata) => {
      h.admin.getUserById.mockResolvedValue({ data: { user: { id: 'compte-existant', app_metadata: appMetadata } }, error: null })
      const res = await accepter(await jetonSigne())
      expect(res.status).toBe(409)
      expect((await res.json()).error).toMatch(/autre espace/)
      expect(h.admin.updateUserById).not.toHaveBeenCalled()
      expect(appelsDe(h.base, 'syndic_team_members', 'update')).toHaveLength(0)
    })

    it("membre d'un autre cabinet : rattaché au nouveau cabinet", async () => {
      h.admin.getUserById.mockResolvedValue({ data: { user: { id: 'compte-existant', app_metadata: { role: 'syndic_tech', cabinet_id: 'ancien' } } }, error: null })
      const res = await accepter(await jetonSigne())
      expect(res.status).toBe(200)
      expect(h.admin.updateUserById).toHaveBeenCalledWith('compte-existant', {
        app_metadata: { role: 'syndic_gestionnaire', cabinet_id: CABINET_ID },
      })
    })

    it("lecture du compte en échec : 500, rien n'est modifié", async () => {
      h.admin.getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'timeout' } })
      expect((await accepter(await jetonSigne())).status).toBe(500)
      expect(h.admin.updateUserById).not.toHaveBeenCalled()
    })
  })
})
