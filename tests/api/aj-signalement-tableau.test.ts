// tests/api/aj-signalement-tableau.test.ts
//
// Routes du tableau de bord « AJ Signalement » (super admin seulement) :
//   GET  /api/aj-signalement/tableau            — copropriétés (compteurs) et signalements (nom de copropriété) ;
//   POST /api/aj-signalement/coproprietes       — nouvelle copropriété, jeton tiré par le serveur ;
//   PATCH /api/aj-signalement/coproprietes/[id] — modification, nouveau jeton ;
//   PATCH /api/aj-signalement/signalements/[id] — statut.
// Droits : jeton Bearer (getAuthUser) puis cookies (createServerSupabaseClient) ; 401 sans session, 403 sans
// être super admin. estSuperAdmin est simulé (allowlist d'e-mails du déploiement).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const etat = {
    userBearer: null as null | Record<string, unknown>,
    userCookie: null as null | Record<string, unknown>,
    superAdmin: true,
    coproprietes: [] as Array<Record<string, unknown>>,
    signalements: [] as Array<Record<string, unknown>>,
    erreur: null as null | { code: string; message: string },
    ligneMaj: null as null | Record<string, unknown>,
    insertions: [] as Array<Record<string, unknown>>,
    misesAJour: [] as Array<{ table: string; valeurs: Record<string, unknown>; filtres: Array<[string, unknown]> }>,
  }
  const from = (table: string) => {
    const q: Record<string, unknown> = {}
    const maj = { table, valeurs: {} as Record<string, unknown>, filtres: [] as Array<[string, unknown]> }
    let enMaj = false
    let insertion: Record<string, unknown> | null = null
    for (const m of ['select', 'order', 'limit']) q[m] = () => q
    q.eq = (col: string, val: unknown) => { if (enMaj) maj.filtres.push([col, val]); return q }
    q.insert = (ligne: Record<string, unknown>) => { insertion = ligne; etat.insertions.push({ table, ...ligne }); return q }
    q.update = (ligne: Record<string, unknown>) => { enMaj = true; maj.valeurs = ligne; etat.misesAJour.push(maj); return q }
    q.single = async () => (etat.erreur
      ? { data: null, error: etat.erreur }
      : { data: { id: 'c0000000-0000-4000-8000-000000000009', created_at: '2026-11-04T10:00:00.000Z', actif: true, adresse: '', emails_destinataires: [], ...insertion }, error: null })
    q.maybeSingle = async () => (etat.erreur ? { data: null, error: etat.erreur } : { data: etat.ligneMaj, error: null })
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      const data = etat.erreur ? null : table === 'signalements_qr_coproprietes' ? etat.coproprietes : etat.signalements
      return Promise.resolve({ data, error: etat.erreur }).then(ok, ko)
    }
    return q
  }
  return { etat, from }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => h.from(table) } }))
vi.mock('@/lib/supabase-server-component', () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: h.etat.userCookie } }) } })),
}))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.etat.userBearer) }))
vi.mock('@/lib/coproprietaire/acces', () => ({ estSuperAdmin: vi.fn(() => h.etat.superAdmin) }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))

const { GET } = await import('@/app/api/aj-signalement/tableau/route')
const { POST } = await import('@/app/api/aj-signalement/coproprietes/route')
const { PATCH: PATCH_COPRO } = await import('@/app/api/aj-signalement/coproprietes/[id]/route')
const { PATCH: PATCH_SIGNALEMENT } = await import('@/app/api/aj-signalement/signalements/[id]/route')

const ADMIN = { id: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4', email: 'admin@vitfix.io', app_metadata: { role: 'super_admin' } }
const ID_COPRO = 'c0000000-0000-4000-8000-000000000001'
const ID_SIGNALEMENT = '5f2c9a1e-1111-4222-8333-444444444444'
const JETON = '0123456789abcdef0123456789abcdef'

type Init = ConstructorParameters<typeof NextRequest>[1]
const requete = (url: string, init?: Init) => new NextRequest(`https://vitfix.io${url}`, init)
const json = (corps: unknown, methode = 'POST'): Init => ({ method: methode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) })

beforeEach(() => {
  h.etat.userBearer = ADMIN
  h.etat.userCookie = null
  h.etat.superAdmin = true
  h.etat.erreur = null
  h.etat.ligneMaj = null
  h.etat.insertions = []
  h.etat.misesAJour = []
  h.etat.coproprietes = [
    { id: ID_COPRO, nom: 'Parc Belle Ombre', adresse: '', jeton: JETON, emails_destinataires: [], actif: true, created_at: '2026-11-04T10:00:00.000Z' },
    { id: 'c0000000-0000-4000-8000-000000000002', nom: 'Les Oliviers', adresse: 'Aubagne', jeton: 'f'.repeat(32), emails_destinataires: ['o@example.com'], actif: false, created_at: '2026-11-04T11:00:00.000Z' },
  ]
  h.etat.signalements = [
    {
      id: ID_SIGNALEMENT, copropriete_id: ID_COPRO, prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie@example.com',
      batiment: '', etage: '4', num_lot: '12', est_partie_commune: false, zone_signalee: '', type_intervention: 'Plomberie', description: 'Fuite sous l’évier',
      priorite: 'urgente', statut: 'en_attente', langue: 'fr', email_envoye_le: null, email_erreur: 'boom', created_at: '2026-11-04T14:05:00.000Z', updated_at: null,
    },
    {
      id: '6a000000-0000-4000-8000-000000000002', copropriete_id: ID_COPRO, prenom: 'Paul', nom: 'Martin', telephone: '0491000000', email: 'paul@example.com',
      batiment: 'A', etage: '1', num_lot: '3', est_partie_commune: true, zone_signalee: 'Hall d’entrée', type_intervention: 'Ascenseur', description: 'Ascenseur bloqué au rez-de-chaussée',
      priorite: 'normale', statut: 'terminee', langue: 'fr', email_envoye_le: '2026-11-03T09:00:00.000Z', email_erreur: null, created_at: '2026-11-03T08:59:00.000Z', updated_at: '2026-11-03T12:00:00.000Z',
    },
  ]
})

describe('droits', () => {
  it('401 sans session (ni jeton, ni cookies)', async () => {
    h.etat.userBearer = null
    const res = await GET(requete('/api/aj-signalement/tableau'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'non_authentifie' })
  })

  it('403 pour un compte qui n’est pas super admin', async () => {
    h.etat.superAdmin = false
    expect((await GET(requete('/api/aj-signalement/tableau'))).status).toBe(403)
    expect((await POST(requete('/api/aj-signalement/coproprietes', json({ nom: 'X' })))).status).toBe(403)
  })

  it('la session par cookies (Administrateur judiciaire) suffit', async () => {
    h.etat.userBearer = null
    h.etat.userCookie = ADMIN
    expect((await GET(requete('/api/aj-signalement/tableau'))).status).toBe(200)
  })
})

describe('GET tableau', () => {
  it('copropriétés avec compteurs, signalements du plus récent au plus ancien avec le nom de la copropriété', async () => {
    const res = await GET(requete('/api/aj-signalement/tableau'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const { tableau } = await res.json()
    expect(tableau.coproprietes).toEqual([
      { id: ID_COPRO, nom: 'Parc Belle Ombre', adresse: '', jeton: JETON, emailsDestinataires: [], actif: true, creeLe: '2026-11-04T10:00:00.000Z', nbSignalements: 2, nbEnAttente: 1 },
      expect.objectContaining({ nom: 'Les Oliviers', actif: false, emailsDestinataires: ['o@example.com'], nbSignalements: 0, nbEnAttente: 0 }),
    ])
    expect(tableau.signalements).toHaveLength(2)
    expect(tableau.signalements[0]).toEqual({
      id: ID_SIGNALEMENT, coproprieteId: ID_COPRO, coproprieteNom: 'Parc Belle Ombre', prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78',
      email: 'marie@example.com', batiment: '', etage: '4', numLot: '12', estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie',
      description: 'Fuite sous l’évier', priorite: 'urgente', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: 'boom',
      creeLe: '2026-11-04T14:05:00.000Z', misAJourLe: '2026-11-04T14:05:00.000Z',
    })
    expect(tableau.signalements[1]).toMatchObject({ estPartieCommune: true, zoneSignalee: 'Hall d’entrée', statut: 'terminee', misAJourLe: '2026-11-03T12:00:00.000Z' })
  })

  it('503 base_absente quand les tables manquent', async () => {
    h.etat.erreur = { code: '42P01', message: 'relation does not exist' }
    const res = await GET(requete('/api/aj-signalement/tableau'))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
  })
})

describe('POST coproprietes', () => {
  it('crée la copropriété avec un jeton de 32 hexadécimaux, l’auteur et les e-mails en minuscules', async () => {
    const res = await POST(requete('/api/aj-signalement/coproprietes', json({ nom: 'Parc Belle Ombre', adresse: 'Marseille', emailsDestinataires: ['Cabinet@Example.com'] })))
    expect(res.status).toBe(201)
    expect(h.etat.insertions).toHaveLength(1)
    expect(h.etat.insertions[0]).toMatchObject({ table: 'signalements_qr_coproprietes', nom: 'Parc Belle Ombre', adresse: 'Marseille', emails_destinataires: ['cabinet@example.com'], cree_par: ADMIN.id })
    expect(h.etat.insertions[0].jeton).toMatch(/^[0-9a-f]{32}$/)
    const { copropriete } = await res.json()
    expect(copropriete).toMatchObject({ nom: 'Parc Belle Ombre', jeton: h.etat.insertions[0].jeton, nbSignalements: 0 })
  })

  it('400 sans nom', async () => {
    expect((await POST(requete('/api/aj-signalement/coproprietes', json({ nom: '' })))).status).toBe(400)
    expect(h.etat.insertions).toHaveLength(0)
  })
})

describe('PATCH coproprietes/[id]', () => {
  const contexte = (id: string) => ({ params: Promise.resolve({ id }) })

  it('modifie nom, adresse, destinataires et activation, puis renvoie la fiche avec ses compteurs', async () => {
    h.etat.ligneMaj = { id: ID_COPRO, nom: 'Parc Belle Ombre (B)', adresse: 'Allée des Pins', jeton: JETON, emails_destinataires: ['a@b.fr'], actif: false, created_at: '2026-11-04T10:00:00.000Z' }
    const res = await PATCH_COPRO(requete(`/api/aj-signalement/coproprietes/${ID_COPRO}`, json({ nom: 'Parc Belle Ombre (B)', adresse: 'Allée des Pins', emailsDestinataires: ['A@b.fr'], actif: false }, 'PATCH')), contexte(ID_COPRO))
    expect(res.status).toBe(200)
    expect(h.etat.misesAJour[0]).toMatchObject({ table: 'signalements_qr_coproprietes', valeurs: { nom: 'Parc Belle Ombre (B)', adresse: 'Allée des Pins', emails_destinataires: ['a@b.fr'], actif: false }, filtres: [['id', ID_COPRO]] })
    expect(h.etat.misesAJour[0].valeurs.jeton).toBeUndefined()
    const { copropriete } = await res.json()
    expect(copropriete).toMatchObject({ nom: 'Parc Belle Ombre (B)', actif: false, nbSignalements: 2, nbEnAttente: 1 })
  })

  it('regenererJeton tire un nouveau jeton ; sans modification → 400 ; identifiant inconnu → 404', async () => {
    h.etat.ligneMaj = { id: ID_COPRO, nom: 'Parc Belle Ombre', adresse: '', jeton: 'e'.repeat(32), emails_destinataires: [], actif: true, created_at: '2026-11-04T10:00:00.000Z' }
    const res = await PATCH_COPRO(requete(`/api/aj-signalement/coproprietes/${ID_COPRO}`, json({ regenererJeton: true }, 'PATCH')), contexte(ID_COPRO))
    expect(res.status).toBe(200)
    expect(h.etat.misesAJour[0].valeurs.jeton).toMatch(/^[0-9a-f]{32}$/)
    expect(h.etat.misesAJour[0].valeurs.jeton).not.toBe(JETON)
    expect((await PATCH_COPRO(requete(`/api/aj-signalement/coproprietes/${ID_COPRO}`, json({}, 'PATCH')), contexte(ID_COPRO))).status).toBe(400)
    h.etat.ligneMaj = null
    expect((await PATCH_COPRO(requete('/api/aj-signalement/coproprietes/c0000000-0000-4000-8000-00000000dead', json({ nom: 'X' }, 'PATCH')), contexte('c0000000-0000-4000-8000-00000000dead'))).status).toBe(404)
    expect((await PATCH_COPRO(requete('/api/aj-signalement/coproprietes/pas-un-uuid', json({ nom: 'X' }, 'PATCH')), contexte('pas-un-uuid'))).status).toBe(404)
  })
})

describe('PATCH signalements/[id]', () => {
  const contexte = (id: string) => ({ params: Promise.resolve({ id }) })

  it('change le statut et renvoie la date de mise à jour', async () => {
    h.etat.ligneMaj = { id: ID_SIGNALEMENT, statut: 'acceptee', updated_at: '2026-11-04T15:00:00.000Z' }
    const res = await PATCH_SIGNALEMENT(requete(`/api/aj-signalement/signalements/${ID_SIGNALEMENT}`, json({ statut: 'acceptee' }, 'PATCH')), contexte(ID_SIGNALEMENT))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ signalement: { id: ID_SIGNALEMENT, statut: 'acceptee', misAJourLe: '2026-11-04T15:00:00.000Z' } })
    expect(h.etat.misesAJour[0]).toMatchObject({ table: 'signalements_qr', valeurs: { statut: 'acceptee' }, filtres: [['id', ID_SIGNALEMENT]] })
  })

  it('statut inconnu → 400 ; signalement inconnu → 404 ; sans session → 401', async () => {
    expect((await PATCH_SIGNALEMENT(requete(`/api/aj-signalement/signalements/${ID_SIGNALEMENT}`, json({ statut: 'perdu' }, 'PATCH')), contexte(ID_SIGNALEMENT))).status).toBe(400)
    h.etat.ligneMaj = null
    expect((await PATCH_SIGNALEMENT(requete(`/api/aj-signalement/signalements/${ID_SIGNALEMENT}`, json({ statut: 'terminee' }, 'PATCH')), contexte(ID_SIGNALEMENT))).status).toBe(404)
    h.etat.userBearer = null
    expect((await PATCH_SIGNALEMENT(requete(`/api/aj-signalement/signalements/${ID_SIGNALEMENT}`, json({ statut: 'terminee' }, 'PATCH')), contexte(ID_SIGNALEMENT))).status).toBe(401)
  })
})
