// @vitest-environment node
// tests/api/btp-chantier-membres-ids.test.ts — POST /api/btp sur un chantier avec ses employés (membres_ids), avant et
// après la migration 20261116 (pointage BTP, 16/11/2026). Tant que la colonne manque, PostgREST refuse toute
// l'écriture (PGRST204) : le chantier doit s'enregistrer quand même, sans ses employés, au lieu d'échouer.
//
// Réunion avec le lot « données BTP » (17/11/2026) : la route contrôle aussi membres_ids comme les autres rattachements
// (liste d'UUID d'employés du compte, lus dans membres_btp, simulée ici) et traduit les refus de la base. Les données
// d'essai sont donc des UUID d'employés du compte ; fiche introuvable (PGRST116) répond 404 et champ inconnu de la base
// (PGRST204 qui ne nomme pas membres_ids) 400, au lieu de 500. Le repli et ses essais ne changent pas.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | { id: string },
    colonneAbsente: true,
    /** Autre colonne absente (nommée par PostgREST) : le repli ne doit pas s’en mêler. */
    autreColonneAbsente: false,
    /** Colonne alerte_meteo (migration 20261126b) absente : le chantier s'enregistre sans la case. */
    alerteAbsente: false,
    /** Colonne equipe_par_jour (migration 20261128c) absente : une obra sans jour retouché s'enregistre sans elle. */
    equipeAbsente: false,
    chantiers: [] as Ligne[],
    /** Employés (membres_btp) : la route vérifie que ceux affectés au chantier sont du compte. */
    membres: [] as Ligne[],
    envois: [] as Array<{ operation: string; valeur: Ligne }>,
    avertissements: [] as string[],
  }
  const from = (table: string) => {
    let operation = 'select'
    let valeur: Ligne = {}
    const filtres: Ligne = {}
    const dans: Record<string, unknown[]> = {}
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (c: string, v: unknown) => { filtres[c] = v; return b }
    b.in = (c: string, v: unknown[]) => { dans[c] = v; return b }
    b.insert = (v: Ligne) => { operation = 'insert'; valeur = v; return b }
    b.update = (v: Ligne) => { operation = 'update'; valeur = v; return b }
    // Lecture attendue directement (contrôle des employés du chantier) : lignes qui passent les filtres.
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      const lignes = (table === 'membres_btp' ? etat.membres : etat.chantiers).filter(l =>
        Object.entries(filtres).every(([c, v]) => l[c] === v) && Object.entries(dans).every(([c, v]) => v.includes(l[c])))
      return Promise.resolve({ data: lignes, error: null }).then(ok, ko)
    }
    // Lecture d'une fiche (lireFiche) : la ligne du chantier qui passe les filtres, sinon rien.
    b.maybeSingle = async () => ({
      data: etat.chantiers.find(l => Object.entries(filtres).every(([c, v]) => l[c] === v)) ?? null, error: null,
    })
    b.single = async () => {
      if (operation !== 'select') etat.envois.push({ operation, valeur: { ...valeur } })
      if (table === 'chantiers_btp' && etat.autreColonneAbsente && operation !== 'select') {
        return { data: null, error: { code: 'PGRST204', message: "Could not find the 'geo_rayon_m' column of 'chantiers_btp' in the schema cache" } }
      }
      if (table === 'chantiers_btp' && etat.colonneAbsente && 'membres_ids' in valeur) {
        return { data: null, error: { code: 'PGRST204', message: "Could not find the 'membres_ids' column of 'chantiers_btp' in the schema cache" } }
      }
      if (table === 'chantiers_btp' && etat.alerteAbsente && 'alerte_meteo' in valeur) {
        return { data: null, error: { code: 'PGRST204', message: "Could not find the 'alerte_meteo' column of 'chantiers_btp' in the schema cache" } }
      }
      if (table === 'chantiers_btp' && etat.equipeAbsente && 'equipe_par_jour' in valeur) {
        return { data: null, error: { code: 'PGRST204', message: "Could not find the 'equipe_par_jour' column of 'chantiers_btp' in the schema cache" } }
      }
      if (operation === 'insert') return { data: { id: 'nouveau', ...valeur }, error: null }
      const ligne = etat.chantiers.find(l => Object.entries(filtres).every(([c, v]) => l[c] === v))
      return ligne ? { data: { ...ligne, ...valeur }, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    }
    return b
  }
  return { etat, from }
})

vi.mock('@/lib/auth-helpers', async (io) => (await import('../helpers/mocks-routes-api')).authHelpersReels(io, () => h.etat.user))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn((message: string) => { h.etat.avertissements.push(message) }) },
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))

const { POST } = await import('@/app/api/btp/route')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const AUTRE_SOCIETE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const M1 = 'd4d4d4d4-0000-4000-8000-000000000001'
const M2 = 'd4d4d4d4-0000-4000-8000-000000000002'
/** Employé de l'autre société. */
const M_AUTRE = 'e5e5e5e5-0000-4000-8000-000000000001'

const ecrire = async (corps: Ligne) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/btp', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 'chantiers_btp', ...corps }),
  }))
  return { status: res.status, json: await res.json() as Ligne }
}

beforeEach(() => {
  h.etat.user = { id: SOCIETE }
  h.etat.colonneAbsente = true
  h.etat.autreColonneAbsente = false
  h.etat.alerteAbsente = false
  h.etat.equipeAbsente = false
  h.etat.chantiers = [{ id: 'villa', owner_id: SOCIETE, titre: 'Villa', statut: 'En cours' }]
  h.etat.membres = [
    { id: M1, owner_id: SOCIETE }, { id: M2, owner_id: SOCIETE }, { id: M_AUTRE, owner_id: AUTRE_SOCIETE },
  ]
  h.etat.envois = []
  h.etat.avertissements = []
})

describe('POST /api/btp — employés d’un chantier (membres_ids)', () => {
  it('colonne absente : la modification est réécrite sans membres_ids et réussit, avec un avertissement', async () => {
    const res = await ecrire({ action: 'update', id: 'villa', data: { statut: 'En cours', geo_rayon_m: 150, membres_ids: [M1] } })
    expect(res.status).toBe(200)
    expect(h.etat.envois).toEqual([
      { operation: 'update', valeur: { statut: 'En cours', geo_rayon_m: 150, membres_ids: [M1], updated_at: expect.any(String) } },
      { operation: 'update', valeur: { statut: 'En cours', geo_rayon_m: 150, updated_at: expect.any(String) } },
    ])
    expect(h.etat.avertissements).toEqual([expect.stringContaining('migration 20261116')])
  })

  it('colonne absente et seuls les employés changent : seule la date de mise à jour est écrite, chez le propriétaire', async () => {
    const res = await ecrire({ action: 'update', id: 'villa', data: { membres_ids: [M1] } })
    expect(res.status).toBe(200)
    expect(res.json.row).toMatchObject({ id: 'villa', titre: 'Villa' })
    expect(h.etat.envois).toEqual([
      { operation: 'update', valeur: { membres_ids: [M1], updated_at: expect.any(String) } },
      { operation: 'update', valeur: { updated_at: expect.any(String) } },
    ])
  })

  it('colonne absente : un chantier d’une autre société reste introuvable (404), même au second essai', async () => {
    // L'autre société affecte un de SES employés : le contrôle des employés passe, la fiche reste introuvable.
    h.etat.user = { id: AUTRE_SOCIETE }
    const res = await ecrire({ action: 'update', id: 'villa', data: { membres_ids: [M_AUTRE] } })
    expect(res.status).toBe(404)
    expect(h.etat.envois).toHaveLength(2)
  })

  it('colonne absente : une création passe aussi, sans les employés', async () => {
    const res = await ecrire({ action: 'insert', data: { titre: 'Garage', membres_ids: [M1] } })
    expect(res.status).toBe(201)
    expect(h.etat.envois.map(e => 'membres_ids' in e.valeur)).toEqual([true, false])
    expect(res.json.row).toMatchObject({ titre: 'Garage', owner_id: SOCIETE })
  })

  it('colonne présente : les employés sont écrits du premier coup', async () => {
    h.etat.colonneAbsente = false
    const res = await ecrire({ action: 'update', id: 'villa', data: { membres_ids: [M1, M2] } })
    expect(res.status).toBe(200)
    expect(h.etat.envois).toEqual([{ operation: 'update', valeur: { membres_ids: [M1, M2], updated_at: expect.any(String) } }])
    expect(h.etat.avertissements).toEqual([])
  })

  it('une autre erreur n’est pas masquée : fiche introuvable (404), aucun second essai', async () => {
    h.etat.colonneAbsente = false
    const res = await ecrire({ action: 'update', id: 'inconnu', data: { membres_ids: [M1] } })
    expect(res.status).toBe(404)
    expect(h.etat.envois).toHaveLength(1)
  })

  it('autre colonne absente (PGRST204 qui ne nomme pas membres_ids) : erreur rendue (400), aucun second essai', async () => {
    h.etat.colonneAbsente = false
    h.etat.autreColonneAbsente = true
    const res = await ecrire({ action: 'update', id: 'villa', data: { geo_rayon_m: 150, membres_ids: [M1] } })
    expect(res.status).toBe(400)
    expect(h.etat.envois).toHaveLength(1)
    expect(h.etat.avertissements).toEqual([])
  })
})

// Alerte météo par notification (migration 20261126b, 26/11/2026). Déployé avant que la migration soit appliquée : une
// case décochée (valeur par défaut de la colonne, envoyée par toute nouvelle fiche) est retirée comme les employés ; une
// case COCHÉE n'est jamais perdue en silence, l'écriture est refusée avec un message et la fiche reste ouverte.
describe('POST /api/btp — alerte météo d’un chantier (alerte_meteo)', () => {
  it('colonne absente, case décochée : la modification est réécrite sans alerte_meteo et réussit, avec un avertissement', async () => {
    h.etat.colonneAbsente = false
    h.etat.alerteAbsente = true
    const res = await ecrire({ action: 'update', id: 'villa', data: { statut: 'En cours', alerte_meteo: false } })
    expect(res.status).toBe(200)
    expect(h.etat.envois).toEqual([
      { operation: 'update', valeur: { statut: 'En cours', alerte_meteo: false, updated_at: expect.any(String) } },
      { operation: 'update', valeur: { statut: 'En cours', updated_at: expect.any(String) } },
    ])
    expect(h.etat.avertissements).toEqual([expect.stringContaining('migration 20261126b')])
  })

  it('colonne absente, case cochée : refus 409 qui le dit (français et portugais), rien d’autre n’est réécrit', async () => {
    h.etat.colonneAbsente = false
    h.etat.alerteAbsente = true
    const res = await ecrire({ action: 'update', id: 'villa', data: { statut: 'En cours', alerte_meteo: true } })
    expect(res.status).toBe(409)
    expect(String(res.json.error)).toContain('Chantier non enregistré : l’alerte météo attend une mise à jour de la base')
    expect(String(res.json.error)).toContain('Obra não guardada')
    expect(h.etat.envois).toHaveLength(1)
  })

  it('les deux colonnes absentes, case décochée : retirées l’une après l’autre, le chantier est créé', async () => {
    h.etat.alerteAbsente = true
    const res = await ecrire({ action: 'insert', data: { titre: 'Dalle', membres_ids: [M1], alerte_meteo: false } })
    expect(res.status).toBe(201)
    expect(h.etat.envois.map(e => Object.keys(e.valeur).filter(c => c === 'membres_ids' || c === 'alerte_meteo'))).toEqual([
      ['membres_ids', 'alerte_meteo'], ['alerte_meteo'], [],
    ])
    expect(h.etat.avertissements).toHaveLength(2)
  })

  it('les deux colonnes absentes, case cochée : création refusée (409) plutôt qu’un chantier sans son alerte', async () => {
    h.etat.alerteAbsente = true
    const res = await ecrire({ action: 'insert', data: { titre: 'Dalle', membres_ids: [M1], alerte_meteo: true } })
    expect(res.status).toBe(409)
    expect(h.etat.envois).toHaveLength(2)
  })

  it('colonne présente : la case est écrite du premier coup', async () => {
    h.etat.colonneAbsente = false
    const res = await ecrire({ action: 'update', id: 'villa', data: { alerte_meteo: true } })
    expect(res.status).toBe(200)
    expect(h.etat.envois).toEqual([{ operation: 'update', valeur: { alerte_meteo: true, updated_at: expect.any(String) } }])
  })
})

// L'équipe habituelle change (fiche de l'obra ou onglet Affectations) : les jours passés gardent l'ancienne équipe
// (figerJoursPasses). Aujourd'hui simulé au mercredi 02/12/2026 ; l'obra a commencé le lundi 30/11.
describe('POST /api/btp — équipe habituelle changée : le passé ne bouge pas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-12-02T10:00:00Z') })
    h.etat.colonneAbsente = false
    h.etat.chantiers = [{ id: 'villa', owner_id: SOCIETE, titre: 'Villa', statut: 'En cours', date_debut: '2026-11-30', membres_ids: [M1], equipe_par_jour: {} }]
  })
  afterEach(() => { vi.useRealTimers() })

  it('M2 ajouté à l’équipe habituelle (onglet Affectations, sans equipe_par_jour) : lundi et mardi gardent M1 seul', async () => {
    const res = await ecrire({ action: 'update', id: 'villa', data: { membres_ids: [M1, M2] } })
    expect(res.status).toBe(200)
    expect(h.etat.envois[0].valeur).toMatchObject({ membres_ids: [M1, M2], equipe_par_jour: { '2026-11-30': [M1], '2026-12-01': [M1] } })
  })

  it('jours déjà inscrits envoyés par la fiche : gardés tels quels, les autres jours passés figés', async () => {
    const res = await ecrire({ action: 'update', id: 'villa', data: { membres_ids: [M2], equipe_par_jour: { '2026-12-01': [M1, M2] } } })
    expect(res.status).toBe(200)
    expect(h.etat.envois[0].valeur.equipe_par_jour).toEqual({ '2026-11-30': [M1], '2026-12-01': [M1, M2] })
  })

  it('colonne equipe_par_jour encore absente de la base : rien n’est figé, l’équipe s’enregistre comme avant', async () => {
    h.etat.chantiers = [{ id: 'villa', owner_id: SOCIETE, titre: 'Villa', statut: 'En cours', date_debut: '2026-11-30', membres_ids: [M1] }]
    const res = await ecrire({ action: 'update', id: 'villa', data: { membres_ids: [M1, M2] } })
    expect(res.status).toBe(200)
    expect('equipe_par_jour' in h.etat.envois[0].valeur).toBe(false)
  })
})

// Équipe jour par jour (migration 20261128c, 28/11/2026). Même règle que l'alerte météo : sans la colonne, une obra sans
// jour retouché (objet vide, valeur par défaut, envoyé par toute nouvelle fiche) s'enregistre sans elle ; une retouche
// n'est jamais perdue en silence. Et chaque employé désigné un jour doit être un employé de la société.
describe('POST /api/btp — équipe d’une obra jour par jour (equipe_par_jour)', () => {
  it('colonne absente, aucun jour retouché : la création réussit sans la colonne, avec un avertissement', async () => {
    h.etat.colonneAbsente = false
    h.etat.equipeAbsente = true
    const res = await ecrire({ action: 'insert', data: { titre: 'Moradia', membres_ids: [M1], equipe_par_jour: {} } })
    expect(res.status).toBe(201)
    expect(h.etat.envois.map(e => 'equipe_par_jour' in e.valeur)).toEqual([true, false])
    expect(h.etat.avertissements).toEqual([expect.stringContaining('migration 20261128c')])
  })

  it('colonne absente, un jour retouché : refus 409 qui le dit (français et portugais), rien n’est réécrit', async () => {
    h.etat.colonneAbsente = false
    h.etat.equipeAbsente = true
    const res = await ecrire({ action: 'update', id: 'villa', data: { equipe_par_jour: { '2026-12-01': [M1, M2] } } })
    expect(res.status).toBe(409)
    expect(String(res.json.error)).toContain('l’équipe par jour attend une mise à jour de la base')
    expect(String(res.json.error)).toContain('a equipa por dia aguarda uma atualização')
    expect(h.etat.envois).toHaveLength(1)
  })

  it('colonne présente : les jours retouchés sont écrits tels quels', async () => {
    h.etat.colonneAbsente = false
    const equipe = { '2026-12-01': [M1, M2], '2026-12-06': [] }
    const res = await ecrire({ action: 'update', id: 'villa', data: { equipe_par_jour: equipe } })
    expect(res.status).toBe(200)
    expect(h.etat.envois).toEqual([{ operation: 'update', valeur: { equipe_par_jour: equipe, updated_at: expect.any(String) } }])
  })

  it('employé d’une autre société désigné un jour : refus 400, rien n’est écrit', async () => {
    h.etat.colonneAbsente = false
    // À la création (la modification relit d'abord la fiche, que ce banc ne simule pas).
    const res = await ecrire({ action: 'insert', data: { titre: 'Moradia', equipe_par_jour: { '2026-12-01': [M1, M_AUTRE] } } })
    expect(res.status).toBe(400)
    expect(String(res.json.error)).toContain('membre de l\'équipe introuvable dans votre compte')
    expect(h.etat.envois).toEqual([])
  })

  it('employé supprimé encore dans l’équipe habituelle : inscrit à un jour, la fiche s’enregistre quand même', async () => {
    h.etat.colonneAbsente = false
    h.etat.chantiers = [{ id: 'villa', owner_id: SOCIETE, titre: 'Villa', statut: 'En cours', membres_ids: [M1, M_AUTRE], equipe_par_jour: {} }]
    const res = await ecrire({ action: 'update', id: 'villa', data: { equipe_par_jour: { '2026-12-01': [M_AUTRE] } } })
    expect(res.status).toBe(200)
  })

  it('identifiants écrits en minuscules, sans doublon, jours triés ; clé « __proto__ » refusée', async () => {
    h.etat.colonneAbsente = false
    const res = await ecrire({ action: 'update', id: 'villa', data: { equipe_par_jour: { '2026-12-02': [M1], '2026-12-01': [M2.toUpperCase(), M2] } } })
    expect(res.status).toBe(200)
    expect(h.etat.envois[0].valeur.equipe_par_jour).toEqual({ '2026-12-01': [M2], '2026-12-02': [M1] })
    expect(Object.keys(h.etat.envois[0].valeur.equipe_par_jour as Ligne)).toEqual(['2026-12-01', '2026-12-02'])
    const piege = await POST(new NextRequest('https://vitfix.io/api/btp', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: `{"table":"chantiers_btp","action":"update","id":"villa","data":{"equipe_par_jour":{"2026-12-01":[],"__proto__":{"x":1}}}}`,
    }))
    expect(piege.status).toBe(400)
  })

  it('jour impossible ou identifiant mal formé : refus 400 qui nomme la colonne', async () => {
    h.etat.colonneAbsente = false
    for (const equipe of [{ '2026-02-30': [M1] }, { '2026-12-01': ['m1'] }, [M1]]) {
      const res = await ecrire({ action: 'update', id: 'villa', data: { equipe_par_jour: equipe } })
      expect(res.status).toBe(400)
      expect(String(res.json.error)).toContain('equipe_par_jour')
    }
    expect(h.etat.envois).toEqual([])
  })
})
