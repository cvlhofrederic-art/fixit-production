// @vitest-environment node
// tests/api/equipe-invitation.test.ts
//
// Invitation d'un membre d'équipe, pro BTP (/api/pro/team, /api/pro/invite) et syndic (/api/syndic/team,
// /api/syndic/invite) : le lien d'invitation part seulement par e-mail, signé côté serveur. L'API ne le
// renvoie pas à l'invitant, et l'acceptation exige la signature : le jeton seul, tel qu'il est enregistré
// en base, ne suffit pas. Un compte existant d'un autre espace n'est jamais converti. Le rôle est signé
// (format v2, 15/11/2026, R36) ; les liens v1 envoyés avant restent acceptés jusqu'à FIN_FORMAT_V1.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { nouvelleBase, clientMemoire, appelsDe, type BaseMemoire } from './syndic-supabase-memoire'
import { FIN_FORMAT_V1, jetonDuLien, lireJetonDuLien, signatureValide, type EspaceEquipe } from '@/lib/equipe/lien-invitation'
import { masquerEmail } from '@/lib/equipe/invitation-serveur'
import { signatureV1 } from '../helpers/lien-invitation-v1'

const h = vi.hoisted(() => ({
  espace: 'pro' as 'pro' | 'syndic',
  base: null as unknown as BaseMemoire,
  emailEnvoye: true,
  urlsEmail: [] as string[],
  admin: { createUser: vi.fn(), listUsers: vi.fn(), getUserById: vi.fn(), updateUserById: vi.fn() },
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/email', () => {
  const modele = (p: { inviteUrl: string }) => {
    h.urlsEmail.push(p.inviteUrl)
    return { subject: 'Invitation', html: `<a href="${p.inviteUrl}">Rejoindre</a>` }
  }
  return {
    sendEmail: vi.fn(async () => (h.emailEnvoye ? { success: true } : { success: false, error: 'échec' })),
    templateTeamInvite: vi.fn(modele),
    templateProTeamInvite: vi.fn(modele),
  }
})
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({
    id: EQUIPE_ID,
    email: 'titulaire@equipe.fr',
    app_metadata: { role: h.espace === 'pro' ? 'pro_societe' : 'syndic' },
    user_metadata: { company_name: 'Société Test', cabinet_name: 'Cabinet Test' },
  })),
  getUserRole: vi.fn(() => (h.espace === 'pro' ? 'pro_societe' : 'syndic')),
  isSyndicRole: vi.fn(() => true),
  isProSocieteRole: vi.fn(() => true),
  isProGerant: vi.fn(() => true),
  // Le compte appelant est le titulaire de son équipe (aucune société d'un autre compte).
  societeDunAutreCompte: vi.fn(() => false),
  estTitulaireSociete: vi.fn(() => true),
  resolveCabinetId: vi.fn(async () => EQUIPE_ID),
  resolveCompanyId: vi.fn(async () => EQUIPE_ID),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => clientMemoire(h.base).from(table),
    auth: { admin: h.admin },
  },
}))

const EQUIPE_ID = '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d'
const AUTRE_EQUIPE = '99999999-8888-4777-8666-555555555555'
const INVITE_ID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const NONCE = 'a1'.repeat(24)
const EMAIL = 'claire@exemple.fr'
const DEJA_INSCRIT = { data: { user: null }, error: { message: 'A user with this email address has already been registered' } }

const routes = {
  pro: { equipe: await import('@/app/api/pro/team/route'), invite: await import('@/app/api/pro/invite/route') },
  syndic: { equipe: await import('@/app/api/syndic/team/route'), invite: await import('@/app/api/syndic/invite/route') },
}

interface CasEspace {
  // Espaces à routes d'équipe (pro, syndic) ; aj_signalement (11/11/2026) n'a ni route /team ni /invite en PR 1.
  espace: Exclude<EspaceEquipe, 'aj_signalement'>
  table: string
  colonneEquipe: string
  role: string
  /** Rôle le plus élevé de l'espace : celui d'une ligne dont le rôle aurait changé après l'envoi. */
  autreRole: string
  /** Autre rôle ordinaire de l'espace, pour un changement de rôle sur une ligne. */
  roleModifie: string
  motDePasse: string
  metadonneesEquipe: Record<string, unknown>
  echecEmail: RegExp
  autresEspaces: Array<[string, Record<string, unknown>]>
  membreAilleurs: Record<string, unknown>
}

const CAS: CasEspace[] = [
  {
    espace: 'pro',
    table: 'pro_team_members',
    colonneEquipe: 'company_id',
    role: 'OUVRIER',
    autreRole: 'GERANT',
    roleModifie: 'SECRETAIRE',
    motDePasse: 'MotDePasse1',
    metadonneesEquipe: { role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: EQUIPE_ID },
    echecEmail: /renvoyez l'invitation/i,
    autresEspaces: [
      ['artisan', { role: 'artisan' }],
      ['client', { role: 'client' }],
      ['gérant de société', { role: 'pro_societe' }],
      ['gérant de société (GERANT)', { role: 'pro_societe', pro_team_role: 'GERANT' }],
      ['cabinet syndic', { role: 'syndic' }],
      ['super_admin', { role: 'super_admin' }],
    ],
    membreAilleurs: { role: 'pro_societe', pro_team_role: 'CHEF_CHANTIER', company_id: AUTRE_EQUIPE, provider: 'email' },
  },
  {
    espace: 'syndic',
    table: 'syndic_team_members',
    colonneEquipe: 'cabinet_id',
    role: 'syndic_gestionnaire',
    autreRole: 'syndic_admin',
    roleModifie: 'syndic_comptable',
    motDePasse: 'motdepasse1',
    metadonneesEquipe: { role: 'syndic_gestionnaire', cabinet_id: EQUIPE_ID },
    echecEmail: /invitez à nouveau/i,
    autresEspaces: [
      ['cabinet syndic', { role: 'syndic' }],
      ['artisan', { role: 'artisan' }],
      ['sous-compte pro', { role: 'pro_societe', pro_team_role: 'OUVRIER' }],
      ['super_admin', { role: 'super_admin' }],
    ],
    membreAilleurs: { role: 'syndic_tech', cabinet_id: AUTRE_EQUIPE, provider: 'email' },
  },
]

const requete = (url: string, init: { method?: string; body?: unknown } = {}) =>
  new NextRequest(url, {
    method: init.method ?? 'GET',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  })

let cleAvant: string | undefined
beforeEach(() => {
  cleAvant = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-service-de-test'
  h.base = nouvelleBase()
  h.emailEnvoye = true
  h.urlsEmail = []
  h.admin.createUser.mockReset().mockResolvedValue({ data: { user: { id: 'compte-neuf' } }, error: null })
  h.admin.listUsers.mockReset().mockResolvedValue({ data: { users: [{ id: 'compte-existant', email: EMAIL }] }, error: null })
  h.admin.getUserById.mockReset().mockResolvedValue({ data: { user: { id: 'compte-existant', app_metadata: {} } }, error: null })
  h.admin.updateUserById.mockReset().mockResolvedValue({ data: {}, error: null })
})
afterEach(() => {
  if (cleAvant === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = cleAvant
})

describe.each(CAS)('invitation d\'équipe $espace', (cas) => {
  const { espace, table } = cas
  const { equipe, invite } = routes[espace]

  const ligne = (modif: Record<string, unknown> = {}) => ({
    id: INVITE_ID, [cas.colonneEquipe]: EQUIPE_ID, email: EMAIL, full_name: 'Claire Martin', role: cas.role,
    invite_token: NONCE, accepted_at: null, created_at: new Date().toISOString(), ...modif,
  })
  const designation = { id: INVITE_ID, email: EMAIL, invite_token: NONCE, equipe_id: EQUIPE_ID }
  const jetonSigne = () => jetonDuLien(espace, { ...designation, role: cas.role })
  /** Lien envoyé avant le format v2 : même jeton de ligne, signature sans le rôle. */
  const jetonV1 = async () => `${NONCE}.${await signatureV1(espace, designation)}`
  const inviter = () => equipe.POST(requete(`https://vitfix.io/api/${espace}/team`, {
    method: 'POST', body: { email: 'Claire@Exemple.fr', full_name: 'Claire Martin', memberRole: cas.role },
  }))
  const lire = (token: string) => invite.GET(requete(`https://vitfix.io/api/${espace}/invite?token=${encodeURIComponent(token)}`))
  const accepter = (token: string) => invite.POST(requete(`https://vitfix.io/api/${espace}/invite`, {
    method: 'POST', body: { token, password: cas.motDePasse },
  }))
  const misesAJour = () => appelsDe(h.base, table, 'update')

  beforeEach(() => { h.espace = espace })

  describe('POST team : le lien part seulement par e-mail', () => {
    it("ne renvoie ni le lien ni le jeton à l'invitant", async () => {
      h.base.inserts[table] = { id: INVITE_ID, email: EMAIL, invite_token: NONCE }
      const res = await inviter()
      expect(res.status).toBe(200)
      const corps = await res.json()
      expect(corps).not.toHaveProperty('invite_url')
      expect(corps.member).toEqual({ id: INVITE_ID, email: EMAIL })
      expect(corps.email_sent).toBe(true)
      const insere = appelsDe(h.base, table, 'insert')[0].donnees as Record<string, string>
      expect(JSON.stringify(corps)).not.toContain(insere.invite_token)
    })

    it('envoie un lien signé, lié à la ligne insérée, rôle compris', async () => {
      await inviter()
      const insere = appelsDe(h.base, table, 'insert')[0].donnees as Record<string, string>
      expect(insere.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(insere.email).toBe(EMAIL)
      expect(insere.role).toBe(cas.role)
      expect(h.urlsEmail).toHaveLength(1)
      const lu = lireJetonDuLien(new URL(h.urlsEmail[0], 'https://vitfix.io').searchParams.get('token') ?? '')
      expect(lu?.jeton).toBe(insere.invite_token)
      const ligneInseree = { id: insere.id, email: insere.email, invite_token: insere.invite_token, equipe_id: EQUIPE_ID }
      expect(await signatureValide(espace, lu!.signature, { ...ligneInseree, role: insere.role })).toBe(true)
      expect(await signatureValide(espace, lu!.signature, { ...ligneInseree, role: cas.autreRole })).toBe(false)
    })

    it('e-mail en échec : message sans lien', async () => {
      h.emailEnvoye = false
      const corps = await (await inviter()).json()
      expect(corps.email_sent).toBe(false)
      expect(corps).not.toHaveProperty('invite_url')
      expect(corps.message).not.toMatch(/token=|https?:\/\//)
      expect(corps.message).toMatch(cas.echecEmail)
    })
  })

  describe('GET invite : signature exigée', () => {
    it('jeton seul (tel que lu en base) : 404', async () => {
      h.base.lignes[table] = [ligne()]
      expect((await lire(NONCE)).status).toBe(404)
    })

    it('signature fabriquée : 404', async () => {
      h.base.lignes[table] = [ligne()]
      expect((await lire(`${NONCE}.${'c'.repeat(64)}`)).status).toBe(404)
    })

    it("e-mail de la ligne modifié après l'envoi : 404", async () => {
      const token = await jetonSigne()
      h.base.lignes[table] = [ligne({ email: 'autre@exemple.fr' })]
      expect((await lire(token)).status).toBe(404)
    })

    it("rôle de la ligne modifié après l'envoi : 404", async () => {
      const token = await jetonSigne()
      h.base.lignes[table] = [ligne({ role: cas.autreRole })]
      expect((await lire(token)).status).toBe(404)
    })

    it('lien signé : 200, e-mail masqué', async () => {
      h.base.lignes[table] = [ligne()]
      const res = await lire(await jetonSigne())
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ valid: true, email: 'cl***@exemple.fr', role: cas.role })
    })

    it('invitation expirée : 410', async () => {
      h.base.lignes[table] = [ligne({ created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString() })]
      expect((await lire(await jetonSigne())).status).toBe(410)
    })

    it('invitation désactivée par le gérant : 410 à la lecture comme à l’acceptation, aucun compte créé ni rattaché', async () => {
      // Avant le 25/11/2026 : « Désactiver » laissait le lien valable ; le compte recevait rôle et société.
      h.base.lignes[table] = [ligne({ is_active: false })]
      const token = await jetonSigne()
      expect((await lire(token)).status).toBe(410)
      expect((await accepter(token)).status).toBe(410)
      expect(h.admin.createUser).not.toHaveBeenCalled()
      expect(h.admin.updateUserById).not.toHaveBeenCalled()
    })
  })

  describe('POST invite : acceptation', () => {
    it('jeton seul : 404, aucun compte créé ni modifié', async () => {
      h.base.lignes[table] = [ligne()]
      expect((await accepter(NONCE)).status).toBe(404)
      expect(h.admin.createUser).not.toHaveBeenCalled()
      expect(h.admin.updateUserById).not.toHaveBeenCalled()
      expect(misesAJour()).toHaveLength(0)
    })

    it.each([
      ['e-mail', { email: 'autre@exemple.fr' }],
      ['équipe', { [cas.colonneEquipe]: AUTRE_EQUIPE }],
      // R36 : avant le format v2, ce lien restait valable et le compte recevait le rôle réécrit.
      ['rôle', { role: cas.autreRole }],
    ])("%s de la ligne modifié après l'envoi : 404, aucun compte créé ni modifié", async (_champ, modif) => {
      const token = await jetonSigne()
      h.base.lignes[table] = [ligne(modif)]
      expect((await accepter(token)).status).toBe(404)
      expect(h.admin.createUser).not.toHaveBeenCalled()
      expect(h.admin.updateUserById).not.toHaveBeenCalled()
      expect(misesAJour()).toHaveLength(0)
    })

    it("lien signé, compte neuf : créé pour l'e-mail invité et invitation acceptée", async () => {
      h.base.lignes[table] = [ligne()]
      const res = await accepter(await jetonSigne())
      expect(res.status).toBe(200)
      expect(h.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({
        email: EMAIL, email_confirm: true, app_metadata: cas.metadonneesEquipe,
      }))
      expect(misesAJour()[0].donnees).toMatchObject({ user_id: 'compte-neuf', invite_token: null })
      expect(misesAJour()[0].eq).toContainEqual(['id', INVITE_ID])
      expect(await res.json()).not.toHaveProperty('compte_existant')
    })

    // AJ Signalement (PR 2, relecture 4 du lot 6) lit le code de l'erreur : la réponse des routes pro et syndic ne change pas.
    it('mot de passe refusé par Supabase Auth (weak_password) : réponse de la route inchangée (500), rien accepté', async () => {
      h.base.lignes[table] = [ligne()]
      h.admin.createUser.mockResolvedValue({ data: { user: null }, error: { message: 'Password is known to be weak', code: 'weak_password', status: 422 } })
      const res = await accepter(await jetonSigne())
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'Erreur lors de la création du compte' })
      expect(misesAJour()).toHaveLength(0)
    })

    describe('compte existant', () => {
      beforeEach(() => {
        h.base.lignes[table] = [ligne()]
        h.admin.createUser.mockResolvedValue(DEJA_INSCRIT)
      })

      it.each(cas.autresEspaces)("d'un autre espace (%s) : 409, rien n'est modifié", async (_cas, appMetadata) => {
        h.admin.getUserById.mockResolvedValue({ data: { user: { id: 'compte-existant', app_metadata: appMetadata } }, error: null })
        const res = await accepter(await jetonSigne())
        expect(res.status).toBe(409)
        expect((await res.json()).error).toMatch(/autre espace/)
        expect(h.admin.updateUserById).not.toHaveBeenCalled()
        expect(misesAJour()).toHaveLength(0)
      })

      it("membre d'une autre équipe du même espace : rattaché à la nouvelle équipe", async () => {
        h.admin.getUserById.mockResolvedValue({ data: { user: { id: 'compte-existant', app_metadata: cas.membreAilleurs } }, error: null })
        const res = await accepter(await jetonSigne())
        expect(res.status).toBe(200)
        expect(h.admin.updateUserById).toHaveBeenCalledWith('compte-existant', {
          app_metadata: { ...cas.membreAilleurs, ...cas.metadonneesEquipe },
        })
        expect(misesAJour()[0].donnees).toMatchObject({ user_id: 'compte-existant', invite_token: null })
      })

      it('compte sans rôle : rattaché', async () => {
        expect((await accepter(await jetonSigne())).status).toBe(200)
        expect(h.admin.updateUserById).toHaveBeenCalledTimes(1)
      })

      // 26-27/11/2026 : la page disait « Compte créé, connectez-vous avec vos identifiants » ; l'invité essayait le mot de
      // passe qu'il venait de taper, que personne n'avait enregistré, et sa connexion était refusée.
      it("rattaché : la réponse dit que le compte existait et que le mot de passe saisi n'est pas enregistré", async () => {
        const res = await accepter(await jetonSigne())
        expect(res.status).toBe(200)
        const corps = await res.json()
        expect(corps).toMatchObject({ success: true, compte_existant: true })
        expect(corps.message).toMatch(/mot de passe habituel/)
        // Le mot de passe du compte n'est jamais changé par une invitation.
        expect(h.admin.updateUserById).toHaveBeenCalledWith('compte-existant', { app_metadata: expect.any(Object) })
        expect(h.admin.updateUserById.mock.calls[0][1]).not.toHaveProperty('password')
      })

      // Avant le 28/11/2026, l'échec de cette écriture était ignoré : 200 « rattaché » sans ligne d'équipe liée.
      it("ligne d'équipe non marquée acceptée : 207, la réponse ne prétend pas que le compte est rattaché", async () => {
        h.base.erreurs[`${table}.update`] = { message: 'timeout' }
        const res = await accepter(await jetonSigne())
        expect(res.status).toBe(207)
        const corps = await res.json()
        expect(corps.success).toBe(false)
        expect(corps).not.toHaveProperty('compte_existant')
        expect(corps.message).toMatch(/support/)
      })

      it("lecture du compte en échec : 500, rien n'est modifié", async () => {
        h.admin.getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'timeout' } })
        expect((await accepter(await jetonSigne())).status).toBe(500)
        expect(h.admin.updateUserById).not.toHaveBeenCalled()
        expect(misesAJour()).toHaveLength(0)
      })

      it("mise à jour du compte en échec : 500, invitation non acceptée", async () => {
        h.admin.updateUserById.mockResolvedValue({ data: null, error: { message: 'timeout' } })
        expect((await accepter(await jetonSigne())).status).toBe(500)
        expect(misesAJour()).toHaveLength(0)
      })
    })
  })

  // Invitations envoyées avant le format v2 : acceptées le temps qu'elles expirent, jamais à partir de FIN_FORMAT_V1.
  describe('lien au format v1 (envoyé avant le rôle signé)', () => {
    afterEach(() => { vi.useRealTimers() })

    it('avant FIN_FORMAT_V1 : lu et accepté, avec le rôle de sa ligne', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(FIN_FORMAT_V1 - 24 * 3600 * 1000)
      h.base.lignes[table] = [ligne()]
      expect((await lire(await jetonV1())).status).toBe(200)
      expect((await accepter(await jetonV1())).status).toBe(200)
      expect(h.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({ app_metadata: cas.metadonneesEquipe }))
    })

    it('à partir de FIN_FORMAT_V1 : 404, aucun compte créé', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(FIN_FORMAT_V1)
      h.base.lignes[table] = [ligne()]
      expect((await accepter(await jetonV1())).status).toBe(404)
      expect(h.admin.createUser).not.toHaveBeenCalled()
    })
  })

  // Le rôle d'une invitation en cours est signé dans le lien déjà envoyé : le changer rendrait ce lien inutilisable.
  describe('PATCH team : invitation en cours', () => {
    const modifier = (body: Record<string, unknown>) =>
      equipe.PATCH(requete(`https://vitfix.io/api/${espace}/team`, { method: 'PATCH', body }))

    it("changement de rôle : 409, rien n'est écrit", async () => {
      h.base.lignes[table] = [ligne()]
      const res = await modifier({ member_id: INVITE_ID, role: cas.autreRole })
      expect(res.status).toBe(409)
      expect((await res.json()).error).toMatch(/invitez à nouveau/)
      expect(misesAJour()).toHaveLength(0)
      expect(h.admin.updateUserById).not.toHaveBeenCalled()
    })

    it('rôle inconnu : 400 « Rôle invalide » (validé avant le 409), rien n’est écrit', async () => {
      h.base.lignes[table] = [ligne()]
      const res = await modifier({ member_id: INVITE_ID, role: 'role_inconnu' })
      expect(res.status).toBe(400)
      expect(misesAJour()).toHaveLength(0)
    })

    it('statut seul : accepté, la ligne change', async () => {
      h.base.lignes[table] = [ligne()]
      const res = await modifier({ member_id: INVITE_ID, is_active: false })
      expect(res.status).toBe(200)
      expect(misesAJour()[0].donnees).toEqual({ is_active: false })
    })

    it('ligne sans compte ni invitation (ajout direct, gérant ancien) : rôle changé sur la ligne seule', async () => {
      h.base.lignes[table] = [ligne({ invite_token: null, accepted_at: '2026-04-01T10:00:00.000Z' })]
      const res = await modifier({ member_id: INVITE_ID, role: cas.roleModifie })
      expect(res.status).toBe(200)
      expect(misesAJour()[0].donnees).toEqual({ role: cas.roleModifie })
      expect(h.admin.getUserById).not.toHaveBeenCalled()
      expect(h.admin.updateUserById).not.toHaveBeenCalled()
    })
  })
})

describe('masquerEmail', () => {
  // Mêmes résultats que l'ancien masquage par expression régulière, vérifiés cas par cas.
  it.each([
    ['claire@exemple.fr', 'cl***@exemple.fr'],
    ['ab@x.fr', 'ab***@x.fr'],
    ['a@b.fr', 'a@b.fr'],
    ['a@b@c.fr', 'a@***@c.fr'],
    ['pr.nom+tag@sous.domaine.pt', 'pr***@sous.domaine.pt'],
    ['sansarobase', 'sansarobase'],
    ['@x.fr', '@x.fr'],
  ])('%s → %s', (email, attendu) => {
    expect(masquerEmail(email)).toBe(attendu)
  })

  it('vide ou absent : chaîne vide', () => {
    expect(masquerEmail('')).toBe('')
    expect(masquerEmail(null)).toBe('')
    expect(masquerEmail(undefined)).toBe('')
  })
})
