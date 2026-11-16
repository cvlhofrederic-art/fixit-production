// @vitest-environment node
// tests/api/btp-pointage.test.ts — GET et POST /api/btp/pointage (pointage géolocalisé BTP, 16/11/2026).
//
// Base simulée en mémoire (filtres eq / is / gte, tri, limite, insertion, upsert, modification, index « un pointage
// ouvert par employé » de la migration 20261116, table absente) ; la société du compte est résolue par le VRAI
// resolveCompanyId (lib/auth-helpers.ts) sur cette base. Comptes et données fictifs.

import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { NOTE_A_REGULARISER, NOTE_DEPART_APRES_COUPURE, NOTE_DOUBLON } from '@/lib/btp/pointage-regles'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | Record<string, unknown>,
    tables: {} as Record<string, Ligne[]>,
    liaisons: [] as Array<{ equipe_id: string; membre_id: string }>,
    indexUnique: true,
    tablesAbsentes: new Set<string>(),
    /** Simule un second envoi qui ouvre le pointage entre la vérification de la route et son insertion. */
    courseAvantInsertion: null as null | Ligne,
    ecritures: [] as Array<{ table: string; op: 'insert' | 'update' | 'upsert'; valeur: Ligne; filtres: string[] }>,
  }

  function requete(table: string) {
    const filtres: Array<{ texte: string; test: (l: Ligne) => boolean }> = []
    const tri: Array<[string, boolean]> = []
    let op: 'select' | 'insert' | 'update' | 'upsert' = 'select'
    let valeur: Ligne = {}
    let limite = Number.POSITIVE_INFINITY
    let avecLiaison = false
    const lignes = () => (etat.tables[table] ??= [])
    const correspondantes = () => lignes().filter(l => filtres.every(f => f.test(l)))

    const executer = (): { data: unknown; error: unknown } => {
      if (etat.tablesAbsentes.has(table)) {
        return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` } }
      }
      if (op === 'insert') {
        if (table === 'pointages_btp' && etat.courseAvantInsertion) {
          lignes().push(etat.courseAvantInsertion)
          etat.courseAvantInsertion = null
        }
        const ligne: Ligne = { id: randomUUID(), created_at: new Date().toISOString(), ...valeur }
        const conflit = table === 'pointages_btp' && etat.indexUnique && ligne.heure_depart == null && ligne.membre_id
          && lignes().some(l => l.owner_id === ligne.owner_id && l.membre_id === ligne.membre_id && l.heure_depart == null)
        if (conflit) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "pointages_btp_un_ouvert_par_membre"' } }
        lignes().push(ligne)
        etat.ecritures.push({ table, op, valeur, filtres: [] })
        return { data: [ligne], error: null }
      }
      if (op === 'upsert') {
        const existante = lignes().find(l => l.owner_id === valeur.owner_id)
        if (existante) Object.assign(existante, valeur)
        else lignes().push({ ...valeur })
        etat.ecritures.push({ table, op, valeur, filtres: [] })
        return { data: null, error: null }
      }
      if (op === 'update') {
        const cibles = correspondantes()
        for (const l of cibles) Object.assign(l, valeur)
        etat.ecritures.push({ table, op, valeur, filtres: filtres.map(f => f.texte) })
        return { data: cibles.map(l => ({ ...l })), error: null }
      }
      let resultat: Ligne[] = correspondantes().map(l => (avecLiaison
        ? { ...l, equipe_membres_btp: etat.liaisons.filter(x => x.equipe_id === l.id).map(x => ({ membre_id: x.membre_id })) }
        : { ...l }))
      for (const [colonne, croissant] of [...tri].reverse()) {
        resultat = [...resultat].sort((a, b) => {
          const [x, y] = [String(a[colonne] ?? ''), String(b[colonne] ?? '')]
          return (x < y ? -1 : x > y ? 1 : 0) * (croissant ? 1 : -1)
        })
      }
      return { data: resultat.slice(0, limite), error: null }
    }

    const b: Record<string, unknown> = {}
    b.select = (colonnes?: string) => { if (colonnes?.includes('equipe_membres_btp')) avecLiaison = true; return b }
    b.eq = (c: string, v: unknown) => { filtres.push({ texte: `${c}=${String(v)}`, test: l => l[c] === v }); return b }
    b.is = (c: string, v: unknown) => { filtres.push({ texte: `${c} is ${String(v)}`, test: l => (l[c] ?? null) === v }); return b }
    b.gte = (c: string, v: unknown) => { filtres.push({ texte: `${c}>=${String(v)}`, test: l => String(l[c]) >= String(v) }); return b }
    b.order = (c: string, o?: { ascending?: boolean }) => { tri.push([c, o?.ascending !== false]); return b }
    b.limit = (n: number) => { limite = n; return b }
    b.insert = (v: Ligne) => { op = 'insert'; valeur = v; return b }
    b.upsert = (v: Ligne) => { op = 'upsert'; valeur = v; return b }
    b.update = (v: Ligne) => { op = 'update'; valeur = v; return b }
    b.single = async () => {
      const r = executer()
      if (r.error) return r
      const premiere = Array.isArray(r.data) ? r.data[0] : r.data
      return premiere ? { data: premiere, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    }
    b.maybeSingle = async () => {
      const r = executer()
      return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error }
    }
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(executer()).then(ok, ko)
    return b
  }
  return { etat, requete }
})

vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.requete(t) } }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/auth-helpers', async (original) => ({
  ...(await original<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))

const { GET, POST } = await import('@/app/api/btp/pointage/route')

// ── Société A (celle qu'on teste) et société B (qui ne doit jamais apparaître) ──
const SOC_A = '0b6c1a4e-6f1d-4c39-9a51-2f0d8f6e1a01'
const SOC_B = '0b6c1a4e-6f1d-4c39-9a51-2f0d8f6e1a02'
const U_PAUL = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01'
const U_INACTIF = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e02'
const U_SANS_FICHE = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e03'
const M_PAUL = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f01'
const M_JEAN = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f02'
const M_GERANT = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f03'
const M_LUC = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f04'
const C_VILLA = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a01'
const C_GARAGE = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a02'
const C_IMMEUBLE = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a03'
const C_FINI = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a04'
const C_JEAN = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a05'
const C_SOC_B = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a06'
const EQ_MACONS = '4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b01'

const GERANT_A = { id: SOC_A, email: 'gerant@a.example', app_metadata: { role: 'pro_societe' } }
const OUVRIER_PAUL = { id: U_PAUL, email: 'paul@a.example', app_metadata: { role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: SOC_A } }
const OUVRIER_INACTIF = { id: U_INACTIF, email: 'jean@a.example', app_metadata: { role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: SOC_A } }
const OUVRIER_SANS_FICHE = { id: U_SANS_FICHE, email: 'sans.fiche@a.example', app_metadata: { role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: SOC_A } }

// 16/11/2026 07:30:00 UTC = 08:30:00 à Paris, 07:30:00 à Lisbonne.
const MAINTENANT = Date.UTC(2026, 10, 16, 7, 30, 0)
const HEURE = 3_600_000

function donnees() {
  h.etat.tables = {
    pro_team_members: [
      { id: randomUUID(), company_id: SOC_A, user_id: U_PAUL, email: 'paul@a.example', role: 'OUVRIER', is_active: true },
      { id: randomUUID(), company_id: SOC_A, user_id: U_INACTIF, email: 'jean@a.example', role: 'OUVRIER', is_active: false },
      { id: randomUUID(), company_id: SOC_A, user_id: U_SANS_FICHE, email: 'sans.fiche@a.example', role: 'OUVRIER', is_active: true },
      { id: randomUUID(), company_id: SOC_A, user_id: null, email: 'invite@a.example', role: 'OUVRIER', is_active: true },
      // Compte désactivé dont l'adresse est celle de la fiche de Luc : Luc n'a PAS de compte actif.
      { id: randomUUID(), company_id: SOC_A, user_id: randomUUID(), email: 'luc@a.example', role: 'OUVRIER', is_active: false },
    ],
    membres_btp: [
      { id: M_PAUL, owner_id: SOC_A, prenom: 'Paul', nom: 'Exemple', email: ' Paul@A.example', type_compte: 'ouvrier', actif: true },
      { id: M_JEAN, owner_id: SOC_A, prenom: 'Jean', nom: 'Test', email: 'invite@a.example', type_compte: 'ouvrier', actif: true },
      { id: M_GERANT, owner_id: SOC_A, prenom: 'Gérard', nom: 'Gérant', email: '', type_compte: 'gerant', actif: true },
      { id: M_LUC, owner_id: SOC_A, prenom: 'Luc', nom: 'Parti', email: 'luc@a.example', type_compte: 'ouvrier', actif: true },
      // Même adresse que Paul, dans une autre société : ne doit jamais être prise pour lui.
      { id: randomUUID(), owner_id: SOC_B, prenom: 'Paul', nom: 'Homonyme', email: 'paul@a.example', actif: true },
    ],
    chantiers_btp: [
      { id: C_VILLA, owner_id: SOC_A, titre: 'Villa', statut: 'En cours', adresse: '1 rue des Lilas', ville: 'Marseille', code_postal: '13008', latitude: 43.25, longitude: 5.38, geo_rayon_m: 150, budget: 45000, client: 'Mme X', membres_ids: [M_PAUL] },
      { id: C_GARAGE, owner_id: SOC_A, titre: 'Garage', statut: 'En cours', latitude: null, longitude: null, geo_rayon_m: 100, membres_ids: [M_PAUL] },
      { id: C_IMMEUBLE, owner_id: SOC_A, titre: 'Immeuble', statut: 'En cours', latitude: 43.3, longitude: 5.4, geo_rayon_m: 100, membres_ids: [] },
      { id: C_FINI, owner_id: SOC_A, titre: 'Fini', statut: 'Terminé', latitude: 43.3, longitude: 5.4, geo_rayon_m: 100, membres_ids: [M_PAUL] },
      { id: C_JEAN, owner_id: SOC_A, titre: 'Chantier de Jean', statut: 'En cours', latitude: 43.3, longitude: 5.4, geo_rayon_m: 100, membres_ids: [M_JEAN] },
      { id: C_SOC_B, owner_id: SOC_B, titre: 'Chantier B', statut: 'En cours', latitude: 43.3, longitude: 5.4, geo_rayon_m: 100, membres_ids: [M_PAUL] },
    ],
    equipes_btp: [{ id: EQ_MACONS, owner_id: SOC_A, nom: 'Maçons', chantier_id: C_IMMEUBLE }],
    pointage_reglages_btp: [{ owner_id: SOC_A, auto_active: true }],
    settings_btp: [],
    pointages_btp: [
      { id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', employe: 'Paul Exemple', date: '2026-11-13', heure_arrivee: '08:00:00', heure_depart: '16:00:00', pause_minutes: 60, heures_travaillees: 7, mode: 'manuel', arrivee_lat: 43.25, arrivee_lng: 5.38, distance_m: 12, created_at: '2026-11-13T07:00:00Z' },
      { id: randomUUID(), owner_id: SOC_A, membre_id: M_JEAN, chantier_id: C_JEAN, chantier_nom: 'Chantier de Jean', employe: 'Jean Test', date: '2026-11-13', heure_arrivee: '08:00:00', heure_depart: '12:00:00', pause_minutes: 0, heures_travaillees: 4, mode: 'manuel', created_at: '2026-11-13T07:00:00Z' },
      { id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', employe: 'Paul Exemple', date: '2026-09-01', heure_arrivee: '08:00:00', heure_depart: '12:00:00', pause_minutes: 0, heures_travaillees: 4, mode: 'manuel', created_at: '2026-09-01T07:00:00Z' },
    ],
  }
  h.etat.liaisons = [{ equipe_id: EQ_MACONS, membre_id: M_PAUL }]
}

const lire = async (fuseau = 'Europe/Paris') => {
  const res = await GET(new NextRequest(`https://vitfix.io/api/btp/pointage?fuseau=${encodeURIComponent(fuseau)}`, { headers: { Authorization: 'Bearer tok' } }))
  return { status: res.status, json: await res.json() as Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any -- réponse JSON lue par les tests
}
const envoyer = async (corps: Record<string, unknown>) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/btp/pointage', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any -- réponse JSON lue par les tests
}
const pointagesDe = (membreId: string) => (h.etat.tables.pointages_btp ?? []).filter(p => p.membre_id === membreId)
const ouvertsDe = (membreId: string) => pointagesDe(membreId).filter(p => p.heure_depart == null)
const duJour = (membreId: string, date = '2026-11-16') => pointagesDe(membreId).filter(p => p.date === date)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAINTENANT)
  donnees()
  h.etat.user = OUVRIER_PAUL
  h.etat.indexUnique = true
  h.etat.tablesAbsentes = new Set()
  h.etat.courseAvantInsertion = null
  h.etat.ecritures = []
})
afterEach(() => { vi.useRealTimers() })

describe('GET /api/btp/pointage', () => {
  it('sans session : 401 ; compte artisan : 403', async () => {
    h.etat.user = null
    expect((await lire()).status).toBe(401)
    h.etat.user = { id: randomUUID(), email: 'artisan@example.test', app_metadata: { role: 'artisan' } }
    expect((await lire()).status).toBe(403)
  })

  it('employé (sous-compte actif) : sa fiche par e-mail, ses chantiers en cours affectés, rien d’une autre société', async () => {
    const { status, json } = await lire()
    expect(status).toBe(200)
    expect(json.gerant).toBe(false)
    expect(json.rattachement).toBe('relie')
    expect(json.moi).toEqual({ id: M_PAUL, nom: 'Paul Exemple' })
    // Villa et Garage directement, Immeuble par l'équipe ; pas le chantier terminé, ni celui de Jean, ni celui de B.
    expect(json.chantiers.map((c: { id: string }) => c.id)).toEqual([C_VILLA, C_GARAGE, C_IMMEUBLE])
    expect(json.chantiers[0]).toEqual({ id: C_VILLA, titre: 'Villa', adresse: '1 rue des Lilas, 13008 Marseille', latitude: 43.25, longitude: 5.38, rayonM: 150 })
    expect(json).toMatchObject({ pointageAutoActive: true, reglageDisponible: true, pointageEnCours: null, pointagesOublies: [] })
    expect(json.comptes).toBeUndefined()
    expect(json.affectationIndividuelle).toBeUndefined()
  })

  it('historique : ses seuls pointages des 31 derniers jours, sans position ni distance', async () => {
    const { json } = await lire()
    expect(json.historique).toEqual([{
      id: expect.any(String), chantierId: C_VILLA, chantierNom: 'Villa', date: '2026-11-13',
      heureArrivee: '08:00:00', heureDepart: '16:00:00', heuresTravaillees: 7, mode: 'manuel',
    }])
    expect(JSON.stringify(json)).not.toMatch(/arrivee_lat|distance|owner_id|budget|client/)
  })

  it('pointage automatique : coupé sans ligne de réglage ; migration absente : signalée, toujours coupé', async () => {
    h.etat.tables.pointage_reglages_btp = []
    expect((await lire()).json).toMatchObject({ pointageAutoActive: false, reglageDisponible: true })
    h.etat.tablesAbsentes.add('pointage_reglages_btp')
    expect((await lire()).json).toMatchObject({ pointageAutoActive: false, reglageDisponible: false })
  })

  it('pointage resté ouvert la veille : listé comme oublié, pas comme en cours ; GET n’écrit rien', async () => {
    h.etat.tables.pointages_btp.push({ id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', employe: 'Paul Exemple', date: '2026-11-15', heure_arrivee: '08:30:00', heure_depart: null, pause_minutes: 0, mode: 'geo_auto', created_at: '2026-11-15T07:30:00.000Z' })
    const { json } = await lire()
    expect(json.pointageEnCours).toBeNull()
    expect(json.pointagesOublies).toEqual([expect.objectContaining({ date: '2026-11-15', heureDepart: null })])
    expect(h.etat.ecritures).toEqual([])
  })

  it('sous-compte désactivé : aucune donnée de la société', async () => {
    h.etat.user = OUVRIER_INACTIF
    const { status, json } = await lire()
    expect(status).toBe(200)
    expect(json).toMatchObject({ rattachement: 'aucun', moi: null, chantiers: [], historique: [], pointageEnCours: null })
  })

  it('compte sans fiche à son adresse : non relié ; deux fiches à la même adresse : ambigu', async () => {
    h.etat.user = OUVRIER_SANS_FICHE
    expect((await lire()).json).toMatchObject({ rattachement: 'aucun', moi: null, chantiers: [] })
    h.etat.tables.membres_btp.push({ id: randomUUID(), owner_id: SOC_A, prenom: 'Sans', nom: 'Fiche', email: 'sans.fiche@a.example', actif: true })
    h.etat.tables.membres_btp.push({ id: randomUUID(), owner_id: SOC_A, prenom: 'Sans', nom: 'Fiche bis', email: 'SANS.FICHE@a.example', actif: true })
    expect((await lire()).json).toMatchObject({ rattachement: 'ambigu', moi: null, chantiers: [] })
  })

  it('gérant : état des comptes (un compte désactivé ne compte pas), affectation individuelle disponible', async () => {
    h.etat.user = GERANT_A
    const { json } = await lire()
    expect(json.gerant).toBe(true)
    expect(json.rattachement).toBe('aucun')
    expect(json.comptes).toEqual({ [M_PAUL]: 'actif', [M_JEAN]: 'invitation', [M_GERANT]: 'aucun', [M_LUC]: 'aucun' })
    expect(json.affectationIndividuelle).toBe(true)
  })

  it('gérant : sans la colonne membres_ids (migration non appliquée), l’affectation individuelle est signalée indisponible', async () => {
    h.etat.user = GERANT_A
    h.etat.tables.chantiers_btp = h.etat.tables.chantiers_btp.map(({ membres_ids: _sans, ...reste }) => reste)
    expect((await lire()).json.affectationIndividuelle).toBe(false)
  })
})

describe('POST /api/btp/pointage — arrivée', () => {
  it('à la main sur un chantier affecté : pointage ouvert pour la société et la fiche résolues par le serveur', async () => {
    const { status, json } = await envoyer({ action: 'arrivee', chantierId: C_GARAGE, mode: 'manuel', owner_id: SOC_B, membre_id: M_JEAN })
    expect(status).toBe(201)
    expect(json.pointage).toMatchObject({ chantierId: C_GARAGE, chantierNom: 'Garage', date: '2026-11-16', heureArrivee: '08:30:00', heureDepart: null, mode: 'manuel' })
    const [cree] = ouvertsDe(M_PAUL)
    expect(cree).toMatchObject({ owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_GARAGE, employe: 'Paul Exemple', pause_minutes: 0, heures_travaillees: null, created_at: new Date(MAINTENANT).toISOString() })
    expect(cree).not.toHaveProperty('arrivee_lat')
    expect(cree).not.toHaveProperty('distance_m')
    expect(ouvertsDe(M_JEAN)).toEqual([])
  })

  it('automatique : heure de l’entrée dans la zone (passée, moins de 10 min) dans le fuseau du téléphone', async () => {
    const { json } = await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto', observeA: MAINTENANT - 5 * 60_000, fuseau: 'Europe/Lisbon' })
    expect(json.pointage).toMatchObject({ date: '2026-11-16', heureArrivee: '07:25:00', mode: 'geo_auto' })
    expect(ouvertsDe(M_PAUL)[0].created_at).toBe(new Date(MAINTENANT - 5 * 60_000).toISOString())
  })

  it('heure du téléphone refusée : trop ancienne, dans le futur, ou pointage à la main', async () => {
    expect((await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto', observeA: MAINTENANT - 3 * HEURE })).json.pointage.heureArrivee).toBe('08:30:00')
    await envoyer({ action: 'depart', mode: 'manuel' })
    expect((await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'geo_auto', observeA: MAINTENANT + 5 * 60_000 })).json.pointage.heureArrivee).toBe('08:30:00')
    await envoyer({ action: 'depart', mode: 'manuel' })
    expect((await envoyer({ action: 'arrivee', chantierId: C_GARAGE, mode: 'manuel', observeA: MAINTENANT - 5 * 60_000 })).json.pointage.heureArrivee).toBe('08:30:00')
  })

  it('fuseau hors liste : celui de la France métropolitaine', async () => {
    const { json } = await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel', fuseau: 'America/Sao_Paulo' })
    expect(json.pointage.heureArrivee).toBe('08:30:00')
  })

  it('automatique refusé tant que le gérant ne l’a pas activé (ou sans la migration) ; à la main, toujours possible', async () => {
    h.etat.tables.pointage_reglages_btp = [{ owner_id: SOC_A, auto_active: false }]
    expect(await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })).toEqual({ status: 403, json: { error: 'pointage_auto_desactive' } })
    h.etat.tablesAbsentes.add('pointage_reglages_btp')
    expect(await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })).toEqual({ status: 403, json: { error: 'pointage_auto_desactive' } })
    expect(ouvertsDe(M_PAUL)).toEqual([])
    expect((await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })).status).toBe(201)
  })

  it('automatique sur un chantier sans position GPS : 422', async () => {
    expect(await envoyer({ action: 'arrivee', chantierId: C_GARAGE, mode: 'geo_auto' })).toEqual({ status: 422, json: { error: 'chantier_sans_position' } })
  })

  it('chantier non affecté, terminé ou d’une autre société : 403, rien d’écrit', async () => {
    for (const chantierId of [C_JEAN, C_FINI, C_SOC_B, randomUUID()]) {
      expect(await envoyer({ action: 'arrivee', chantierId, mode: 'manuel' })).toEqual({ status: 403, json: { error: 'chantier_non_affecte' } })
    }
    expect(h.etat.ecritures).toEqual([])
  })

  it('déjà en cours aujourd’hui sur ce chantier : le même pointage, aucun doublon', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    const second = await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    expect(second.status).toBe(200)
    expect(second.json.deja).toBe(true)
    expect(ouvertsDe(M_PAUL)).toHaveLength(1)
  })

  it('arrivée à la main sur un autre chantier : le pointage en cours est clos d’abord, heures calculées', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 2 * HEURE + 15 * 60_000)
    const { status } = await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'manuel' })
    expect(status).toBe(201)
    expect(duJour(M_PAUL).find(p => p.chantier_id === C_VILLA)).toMatchObject({ heure_depart: '10:45:00', heures_travaillees: 2.25 })
    expect(ouvertsDe(M_PAUL).map(p => p.chantier_id)).toEqual([C_IMMEUBLE])
  })

  it('arrivée automatique pendant un autre pointage du jour (à la main, ou sur un autre chantier) : 409, rien de clos', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })
    vi.setSystemTime(MAINTENANT + 2 * HEURE)
    expect(await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'geo_auto' })).toEqual({ status: 409, json: { error: 'pointage_different' } })
    expect(ouvertsDe(M_PAUL)).toEqual([expect.objectContaining({ chantier_id: C_VILLA, mode: 'manuel', heure_depart: null })])
    await envoyer({ action: 'depart', mode: 'manuel' })
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    expect(await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'geo_auto' })).toEqual({ status: 409, json: { error: 'pointage_different' } })
    expect(ouvertsDe(M_PAUL).map(p => [p.chantier_id, p.mode])).toEqual([[C_VILLA, 'geo_auto']])
  })

  it('départ oublié la veille, arrivée le lendemain sur le même chantier : la veille refermée sans heures, la journée ouverte', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 24 * HEURE)
    const { status, json } = await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    expect(status).toBe(201)
    expect(json.deja).toBeUndefined()
    expect(json.pointage).toMatchObject({ date: '2026-11-17', heureArrivee: '08:30:00' })
    expect(duJour(M_PAUL, '2026-11-16')).toEqual([expect.objectContaining({ heure_depart: '08:30:00', heures_travaillees: 0, notes: NOTE_A_REGULARISER })])
    expect(ouvertsDe(M_PAUL).map(p => p.date)).toEqual(['2026-11-17'])
  })

  it('double envoi simultané (index unique) : le pointage déjà ouvert est rendu', async () => {
    const deja: Ligne = { id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', employe: 'Paul Exemple', date: '2026-11-16', heure_arrivee: '08:29:58', heure_depart: null, pause_minutes: 0, mode: 'geo_auto', created_at: new Date(MAINTENANT - 2000).toISOString() }
    h.etat.courseAvantInsertion = deja
    const { status, json } = await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    expect(status).toBe(200)
    expect(json).toMatchObject({ deja: true, pointage: { id: deja.id, heureArrivee: '08:29:58' } })
    expect(ouvertsDe(M_PAUL)).toHaveLength(1)
  })

  it('compte non relié : 409 fiche_absente ; corps invalide : 400', async () => {
    h.etat.user = OUVRIER_SANS_FICHE
    expect(await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })).toEqual({ status: 409, json: { error: 'fiche_absente' } })
    h.etat.user = OUVRIER_PAUL
    expect((await envoyer({ action: 'arrivee', chantierId: 'pas-un-uuid', mode: 'manuel' })).status).toBe(400)
    expect((await envoyer({ action: 'supprimer', chantierId: C_VILLA, mode: 'manuel' })).status).toBe(400)
    expect((await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_confirme' })).status).toBe(400)
  })
})

describe('POST /api/btp/pointage — départ', () => {
  it('clôt le pointage en cours de l’employé, heures calculées sur les instants', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 4 * HEURE + 6 * 60_000)
    const { status, json } = await envoyer({ action: 'depart', chantierId: C_VILLA, mode: 'geo_auto' })
    expect(status).toBe(200)
    expect(json.pointage).toMatchObject({ heureArrivee: '08:30:00', heureDepart: '12:36:00', heuresTravaillees: 4.1 })
    expect(ouvertsDe(M_PAUL)).toEqual([])
    // La clôture ne touche que la ligne ouverte de la société et de l'employé.
    const cloture = h.etat.ecritures.find(e => e.op === 'update')
    expect(cloture?.filtres).toEqual(expect.arrayContaining([`owner_id=${SOC_A}`, 'heure_depart is null']))
  })

  it('changer le fuseau du téléphone entre l’arrivée et le départ ne change pas la durée', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel', fuseau: 'Europe/Lisbon' })
    vi.setSystemTime(MAINTENANT + 8 * HEURE)
    const { json } = await envoyer({ action: 'depart', mode: 'manuel', fuseau: 'Indian/Reunion' })
    expect(json.pointage).toMatchObject({ heureArrivee: '07:30:00', heureDepart: '15:30:00', heuresTravaillees: 8 })
  })

  it('départ automatique daté de la sortie vue par le téléphone (envoi retardé), jamais avant l’arrivée ni après maintenant', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 11 * HEURE)
    const { json } = await envoyer({ action: 'depart', chantierId: C_VILLA, mode: 'geo_auto', observeA: MAINTENANT + 8 * HEURE + 30 * 60_000 })
    expect(json.pointage).toMatchObject({ heureDepart: '17:00:00', heuresTravaillees: 8.5 })
  })

  it('le téléphone ne termine pas tout seul un pointage commencé à la main, ni un autre chantier', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })
    expect(await envoyer({ action: 'depart', chantierId: C_VILLA, mode: 'geo_auto' })).toEqual({ status: 409, json: { error: 'pointage_different' } })
    await envoyer({ action: 'depart', mode: 'manuel' })
    await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'geo_auto' })
    expect(await envoyer({ action: 'depart', chantierId: C_VILLA, mode: 'geo_auto' })).toEqual({ status: 409, json: { error: 'pointage_different' } })
    expect(await envoyer({ action: 'depart', mode: 'geo_auto' })).toEqual({ status: 409, json: { error: 'pointage_different' } })
    expect(ouvertsDe(M_PAUL).map(p => p.chantier_id)).toEqual([C_IMMEUBLE])
  })

  it('fin à la main après une coupure du suivi : départ à l’heure du serveur, note au gérant avec la dernière présence vue', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 4 * HEURE + 30 * 60_000)
    const { json } = await envoyer({ action: 'depart', mode: 'manuel', derniereVue: MAINTENANT + 35 * 60_000 })
    expect(json.pointage).toMatchObject({ heureDepart: '13:00:00', heuresTravaillees: 4.5 })
    expect(duJour(M_PAUL)[0].notes).toBe(`${NOTE_DEPART_APRES_COUPURE} ; dernière présence vue sur le chantier à 09:05 : à vérifier.`)
  })

  it('dernière présence hors de l’arrivée et du départ : ignorée, pas de note', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 4 * HEURE)
    await envoyer({ action: 'depart', mode: 'manuel', derniereVue: MAINTENANT - HEURE })
    expect(duJour(M_PAUL)[0].notes ?? null).toBeNull()
    expect((await envoyer({ action: 'depart', mode: 'manuel', derniereVue: 'hier' })).status).toBe(400)
  })

  it('sans pointage en cours : 404, rien d’écrit', async () => {
    expect(await envoyer({ action: 'depart', mode: 'manuel' })).toEqual({ status: 404, json: { error: 'aucun_pointage_en_cours' } })
    expect(h.etat.ecritures).toEqual([])
  })

  it('départ oublié jusqu’au lendemain : refermé sans heures et à régulariser, plus rien en cours', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })
    vi.setSystemTime(MAINTENANT + 24 * HEURE)
    expect(await envoyer({ action: 'depart', mode: 'manuel' })).toEqual({ status: 404, json: { error: 'aucun_pointage_en_cours' } })
    expect(duJour(M_PAUL)).toEqual([expect.objectContaining({ heure_depart: '08:30:00', heures_travaillees: 0, notes: NOTE_A_REGULARISER })])
  })

  it('sans l’index de la migration, deux pointages ouverts : le plus ancien porte les heures, l’autre est refermé sans heures', async () => {
    h.etat.indexUnique = false
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })
    h.etat.tables.pointages_btp.push({ id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', employe: 'Paul Exemple', date: '2026-11-16', heure_arrivee: '08:30:01', heure_depart: null, pause_minutes: 0, mode: 'manuel', created_at: new Date(MAINTENANT + 1000).toISOString() })
    vi.setSystemTime(MAINTENANT + 8 * HEURE)
    const { json } = await envoyer({ action: 'depart', mode: 'manuel' })
    expect(json.pointage).toMatchObject({ heureArrivee: '08:30:00', heuresTravaillees: 8 })
    expect(ouvertsDe(M_PAUL)).toEqual([])
    expect(duJour(M_PAUL).map(p => [p.heure_arrivee, p.heures_travaillees, p.notes ?? null])).toEqual([
      ['08:30:00', 8, null],
      ['08:30:01', 0, NOTE_DOUBLON],
    ])
  })

  it('le pointage en cours apparaît dans GET, puis disparaît après le départ', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'manuel' })
    expect((await lire()).json.pointageEnCours).toMatchObject({ chantierId: C_IMMEUBLE, heureDepart: null })
    await envoyer({ action: 'depart', mode: 'manuel' })
    expect((await lire()).json.pointageEnCours).toBeNull()
  })
})

describe('POST /api/btp/pointage — interrupteur du pointage automatique', () => {
  beforeEach(() => { h.etat.tables.pointage_reglages_btp = [] })

  it('réservé au gérant ; activation seulement avec la confirmation d’information des salariés', async () => {
    expect(await envoyer({ action: 'reglage_auto', actif: true, confirmation: true })).toEqual({ status: 403, json: { error: 'reserve_au_gerant' } })
    h.etat.user = GERANT_A
    expect(await envoyer({ action: 'reglage_auto', actif: true })).toEqual({ status: 422, json: { error: 'confirmation_requise' } })
    expect(h.etat.tables.pointage_reglages_btp).toEqual([])
  })

  it('activation : qui et quand gardés ; coupure : la trace de la confirmation reste ; settings_btp jamais touché', async () => {
    h.etat.user = GERANT_A
    expect(await envoyer({ action: 'reglage_auto', actif: true, confirmation: true })).toEqual({ status: 200, json: { pointageAutoActive: true } })
    const confirmeLe = new Date(MAINTENANT).toISOString()
    expect(h.etat.tables.pointage_reglages_btp).toEqual([{ owner_id: SOC_A, auto_active: true, confirme_le: confirmeLe, confirme_par: SOC_A, modifie_le: confirmeLe }])
    vi.setSystemTime(MAINTENANT + HEURE)
    await envoyer({ action: 'reglage_auto', actif: false })
    expect(h.etat.tables.pointage_reglages_btp[0]).toMatchObject({ auto_active: false, confirme_le: confirmeLe, confirme_par: SOC_A })
    expect(h.etat.ecritures.filter(e => e.table === 'settings_btp')).toEqual([])
    expect(h.etat.tables.settings_btp).toEqual([])
  })

  it('migration non appliquée : 409 migration_requise', async () => {
    h.etat.user = GERANT_A
    h.etat.tablesAbsentes.add('pointage_reglages_btp')
    expect(await envoyer({ action: 'reglage_auto', actif: true, confirmation: true })).toEqual({ status: 409, json: { error: 'migration_requise' } })
  })
})
