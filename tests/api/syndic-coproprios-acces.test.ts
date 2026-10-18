// tests/api/syndic-coproprios-acces.test.ts
//
// POST /api/syndic/coproprios/[id]/acces — le syndic ouvre l'accès au portail à l'occupant d'un lot :
//   - compte créé par invitation (inviteUserByEmail, lien vers /coproprietaire/dashboard) ou, si l'e-mail
//     a déjà un compte (« already »), compte retrouvé par listUsers paginé ;
//   - rôle coproprio (propriétaire) ou locataire posé dans app_metadata, jamais par-dessus un rôle
//     syndic / artisan / super_admin (409 compte_autre_role) ;
//   - fiche : acces_portail (propriétaire) ou acces_portail_locataire (locataire ; colonne absente → 409).
// isSyndicRole / resolveCabinetId sont les vrais ; le jeton et Supabase sont simulés.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Erreur = { code?: string; message: string; status?: number } | null

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | Record<string, unknown>,
    fiche: null as null | Record<string, unknown>,
    erreurFiche: null as Erreur,
    erreurUpdate: null as Erreur,
    lectures: [] as Array<Array<[string, unknown]>>,
    updates: [] as Array<{ valeurs: Record<string, unknown>; filtres: Array<[string, unknown]> }>,
    invitation: { data: { user: null as null | Record<string, unknown> }, error: null as Erreur },
    invites: [] as Array<[string, Record<string, unknown>]>,
    comptes: [] as Array<Record<string, unknown>>,
    rolesPoses: [] as Array<[string, Record<string, unknown>]>,
    erreurRole: null as Erreur,
  }
  const from = (_table: string) => {
    const filtres: Array<[string, unknown]> = []
    let valeurs: Record<string, unknown> | null = null
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.eq = (col: string, val: unknown) => { filtres.push([col, val]); return q }
    q.update = (v: Record<string, unknown>) => { valeurs = v; return q }
    q.maybeSingle = async () => {
      etat.lectures.push(filtres)
      return { data: etat.erreurFiche ? null : etat.fiche, error: etat.erreurFiche }
    }
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      if (valeurs) etat.updates.push({ valeurs, filtres })
      return Promise.resolve({ data: null, error: etat.erreurUpdate }).then(ok, ko)
    }
    return q
  }
  const auth = {
    admin: {
      inviteUserByEmail: vi.fn(async (email: string, options: Record<string, unknown>) => {
        etat.invites.push([email, options])
        return etat.invitation
      }),
      listUsers: vi.fn(async ({ page }: { page: number; perPage: number }) =>
        ({ data: { users: page === 1 ? etat.comptes : [] }, error: null })),
      updateUserById: vi.fn(async (id: string, attrs: Record<string, unknown>) => {
        etat.rolesPoses.push([id, attrs])
        return { data: { user: null }, error: etat.erreurRole }
      }),
    },
  }
  return { etat, from, auth, loggerError: vi.fn(), loggerWarn: vi.fn(), loggerInfo: vi.fn() }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: h.loggerWarn, info: h.loggerInfo, debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => h.from(table), auth: h.auth } }))

const { POST } = await import('@/app/api/syndic/coproprios/[id]/acces/route')

const ID_CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const ID_FICHE = '0b6d2c1e-5f1a-4b7e-9c3d-2a1b3c4d5e6f'
const SYNDIC = { id: ID_CABINET, email: 'syndic@exemple.fr', app_metadata: { role: 'syndic' } }

const FICHE = {
  id: ID_FICHE, cabinet_id: ID_CABINET, immeuble: 'Résidence Le Prado',
  nom_proprietaire: 'Martin', prenom_proprietaire: 'Sophie', email_proprietaire: 'Sophie.Martin@Example.fr ',
  nom_locataire: 'Dubois', prenom_locataire: 'Claire', email_locataire: 'claire.dubois@example.fr',
  acces_portail: false,
}

function poster(corps: unknown, id = ID_FICHE, jeton = true) {
  const req = new NextRequest(`https://vitfix.io/api/syndic/coproprios/${id}/acces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer jeton-test' } : {}) },
    body: typeof corps === 'string' ? corps : JSON.stringify(corps),
  })
  return POST(req, { params: Promise.resolve({ id }) })
}

const compteInvite = (id: string, email: string, role?: string) => ({ id, email, app_metadata: role ? { role } : {}, user_metadata: {} })

beforeEach(() => {
  Object.assign(h.etat, {
    user: SYNDIC, fiche: FICHE, erreurFiche: null, erreurUpdate: null, lectures: [], updates: [],
    invitation: { data: { user: compteInvite('u-nouveau', 'sophie.martin@example.fr') }, error: null },
    invites: [], comptes: [], rolesPoses: [], erreurRole: null,
  })
  h.loggerError.mockClear()
  h.loggerWarn.mockClear()
  h.loggerInfo.mockClear()
  delete process.env.NEXT_PUBLIC_APP_URL
})

describe('POST /api/syndic/coproprios/[id]/acces — garde', () => {
  it('sans jeton : 401, rien n’est fait', async () => {
    h.etat.user = null
    const res = await poster({ occupant: 'proprietaire' })
    expect(res.status).toBe(401)
    expect(h.etat.invites).toHaveLength(0)
  })

  it('rôle non syndic (artisan) : 403', async () => {
    h.etat.user = { id: 'id-artisan', email: 'a@b.fr', app_metadata: { role: 'artisan' } }
    expect((await poster({ occupant: 'proprietaire' })).status).toBe(403)
  })

  it('id non uuid : 400 ; corps invalide : 400', async () => {
    expect((await poster({ occupant: 'proprietaire' }, 'pas-un-uuid')).status).toBe(400)
    expect((await poster({ occupant: 'voisin' })).status).toBe(400)
    expect((await poster('{pas du json')).status).toBe(400)
    expect(h.etat.invites).toHaveLength(0)
  })

  it('fiche d’un autre cabinet (introuvable avec le filtre cabinet_id) : 404', async () => {
    h.etat.fiche = null
    const res = await poster({ occupant: 'proprietaire' })
    expect(res.status).toBe(404)
    expect(h.etat.lectures[0]).toEqual(expect.arrayContaining([['id', ID_FICHE], ['cabinet_id', ID_CABINET]]))
  })

  it('lecture en erreur : 500 journalisé', async () => {
    h.etat.erreurFiche = { code: '57014', message: 'timeout' }
    expect((await poster({ occupant: 'proprietaire' })).status).toBe(500)
    expect(h.loggerError).toHaveBeenCalledWith(expect.stringContaining('fiche'), expect.objectContaining({ code: '57014' }))
  })

  it('e-mail de l’occupant vide : 400 email_manquant', async () => {
    h.etat.fiche = { ...FICHE, email_locataire: '  ' }
    const res = await poster({ occupant: 'locataire' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'email_manquant', occupant: 'locataire' })
    expect(h.etat.invites).toHaveLength(0)
  })
})

describe('POST /api/syndic/coproprios/[id]/acces — propriétaire', () => {
  it('nouveau compte : invitation (e-mail normalisé, nom complet, lien vers le tableau de bord), rôle coproprio, acces_portail', async () => {
    const res = await poster({ occupant: 'proprietaire' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, invite: true, email: 'sophie.martin@example.fr' })
    expect(h.etat.invites).toEqual([['sophie.martin@example.fr', { data: { full_name: 'Sophie Martin' }, redirectTo: 'https://vitfix.io/coproprietaire/dashboard' }]])
    expect(h.etat.rolesPoses).toEqual([['u-nouveau', { app_metadata: { role: 'coproprio' } }]])
    expect(h.etat.updates).toEqual([{ valeurs: { acces_portail: true }, filtres: [['id', ID_FICHE], ['cabinet_id', ID_CABINET]] }])
    expect(h.auth.admin.listUsers).not.toHaveBeenCalled()
    expect(h.loggerInfo).toHaveBeenCalledWith(expect.stringContaining('activé'), expect.objectContaining({ occupant: 'proprietaire', role: 'coproprio', invite: true }))
  })

  it('lien d’invitation construit depuis NEXT_PUBLIC_APP_URL quand elle est définie', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.vitfix.io'
    await poster({ occupant: 'proprietaire' })
    expect(h.etat.invites[0][1]).toMatchObject({ redirectTo: 'https://staging.vitfix.io/coproprietaire/dashboard' })
  })

  it('compte existant (« already ») : retrouvé par listUsers, rôle posé sans écraser le reste de app_metadata, invite:false', async () => {
    h.etat.invitation = { data: { user: null }, error: { message: 'A user with this email address has already been registered', status: 422 } }
    h.etat.comptes = [
      compteInvite('u-autre', 'autre@example.fr', 'client'),
      { id: 'u-existant', email: 'Sophie.Martin@example.fr', app_metadata: { provider: 'email' }, user_metadata: {} },
    ]
    const res = await poster({ occupant: 'proprietaire' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, invite: false, email: 'sophie.martin@example.fr' })
    expect(h.etat.rolesPoses).toEqual([['u-existant', { app_metadata: { provider: 'email', role: 'coproprio' } }]])
    expect(h.etat.updates[0].valeurs).toEqual({ acces_portail: true })
  })

  it('compte existant déjà coproprio : rôle inchangé (aucun updateUserById), fiche mise à jour', async () => {
    h.etat.invitation = { data: { user: null }, error: { message: 'User already registered' } }
    h.etat.comptes = [compteInvite('u-copro', 'sophie.martin@example.fr', 'coproprio')]
    const res = await poster({ occupant: 'proprietaire' })
    expect(res.status).toBe(200)
    expect(h.etat.rolesPoses).toHaveLength(0)
    expect(h.etat.updates).toHaveLength(1)
  })

  it('compte existant d’un autre espace (syndic) : 409 compte_autre_role, rôle et fiche intacts', async () => {
    h.etat.invitation = { data: { user: null }, error: { message: 'User already registered' } }
    h.etat.comptes = [compteInvite('u-syndic', 'sophie.martin@example.fr', 'syndic')]
    const res = await poster({ occupant: 'proprietaire' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'compte_autre_role', role: 'syndic' })
    expect(h.etat.rolesPoses).toHaveLength(0)
    expect(h.etat.updates).toHaveLength(0)
    expect(h.loggerWarn).toHaveBeenCalled()
  })

  it('compte existant introuvable après « already » : 500 journalisé, fiche intacte', async () => {
    h.etat.invitation = { data: { user: null }, error: { message: 'User already registered' } }
    h.etat.comptes = []
    const res = await poster({ occupant: 'proprietaire' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'compte_introuvable' })
    expect(h.etat.updates).toHaveLength(0)
    expect(h.loggerError).toHaveBeenCalled()
  })

  it('invitation refusée pour une autre raison : 500 invitation_impossible, journalisé sans secret', async () => {
    h.etat.invitation = { data: { user: null }, error: { message: 'Error sending invite email', status: 500 } }
    const res = await poster({ occupant: 'proprietaire' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'invitation_impossible' })
    expect(h.loggerError).toHaveBeenCalledWith(expect.stringContaining('invitation'), expect.objectContaining({ message: 'Error sending invite email', coproprioId: ID_FICHE }))
    expect(h.etat.updates).toHaveLength(0)
  })

  it('attribution du rôle en erreur : 500, fiche intacte', async () => {
    h.etat.erreurRole = { message: 'auth down' }
    const res = await poster({ occupant: 'proprietaire' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'role_impossible' })
    expect(h.etat.updates).toHaveLength(0)
  })

  it('mise à jour de la fiche en erreur : 500 journalisé', async () => {
    h.etat.erreurUpdate = { code: '57014', message: 'timeout' }
    expect((await poster({ occupant: 'proprietaire' })).status).toBe(500)
    expect(h.loggerError).toHaveBeenCalledWith(expect.stringContaining('fiche'), expect.objectContaining({ code: '57014' }))
  })
})

describe('POST /api/syndic/coproprios/[id]/acces — locataire', () => {
  it('e-mail du locataire, rôle locataire, acces_portail_locataire', async () => {
    h.etat.invitation = { data: { user: compteInvite('u-loc', 'claire.dubois@example.fr') }, error: null }
    const res = await poster({ occupant: 'locataire' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, invite: true, email: 'claire.dubois@example.fr' })
    expect(h.etat.invites[0]).toEqual(['claire.dubois@example.fr', { data: { full_name: 'Claire Dubois' }, redirectTo: 'https://vitfix.io/coproprietaire/dashboard' }])
    expect(h.etat.rolesPoses).toEqual([['u-loc', { app_metadata: { role: 'locataire' } }]])
    expect(h.etat.updates[0].valeurs).toEqual({ acces_portail_locataire: true })
  })

  it('compte déjà propriétaire (coproprio) activé comme locataire : jamais rétrogradé', async () => {
    h.etat.invitation = { data: { user: null }, error: { message: 'User already registered' } }
    h.etat.comptes = [compteInvite('u-copro', 'claire.dubois@example.fr', 'coproprio')]
    const res = await poster({ occupant: 'locataire' })
    expect(res.status).toBe(200)
    expect(h.etat.rolesPoses).toHaveLength(0)
    expect(h.etat.updates[0].valeurs).toEqual({ acces_portail_locataire: true })
  })

  it('colonne acces_portail_locataire absente (42703) : 409 migration_requise', async () => {
    h.etat.invitation = { data: { user: compteInvite('u-loc', 'claire.dubois@example.fr') }, error: null }
    h.etat.erreurUpdate = { code: '42703', message: 'column "acces_portail_locataire" does not exist' }
    const res = await poster({ occupant: 'locataire' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'migration_requise' })
    expect(h.loggerWarn).toHaveBeenCalledWith(expect.stringContaining('migration'), expect.objectContaining({ coproprioId: ID_FICHE }))
  })
})
