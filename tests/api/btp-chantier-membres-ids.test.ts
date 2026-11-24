// @vitest-environment node
// tests/api/btp-chantier-membres-ids.test.ts — POST /api/btp sur un chantier avec ses employés (membres_ids), avant et
// après la migration 20261116 (pointage BTP, 16/11/2026). Tant que la colonne manque, PostgREST refuse toute
// l'écriture (PGRST204) : le chantier doit s'enregistrer quand même, sans ses employés, au lieu d'échouer.
//
// Réunion avec le lot « données BTP » (17/11/2026) : la route contrôle aussi membres_ids comme les autres rattachements
// (liste d'UUID d'employés du compte, lus dans membres_btp, simulée ici) et traduit les refus de la base. Les données
// d'essai sont donc des UUID d'employés du compte ; fiche introuvable (PGRST116) répond 404 et champ inconnu de la base
// (PGRST204 qui ne nomme pas membres_ids) 400, au lieu de 500. Le repli et ses essais ne changent pas.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | { id: string },
    colonneAbsente: true,
    /** Autre colonne absente (nommée par PostgREST) : le repli ne doit pas s’en mêler. */
    autreColonneAbsente: false,
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
    b.single = async () => {
      if (operation !== 'select') etat.envois.push({ operation, valeur: { ...valeur } })
      if (table === 'chantiers_btp' && etat.autreColonneAbsente && operation !== 'select') {
        return { data: null, error: { code: 'PGRST204', message: "Could not find the 'geo_rayon_m' column of 'chantiers_btp' in the schema cache" } }
      }
      if (table === 'chantiers_btp' && etat.colonneAbsente && 'membres_ids' in valeur) {
        return { data: null, error: { code: 'PGRST204', message: "Could not find the 'membres_ids' column of 'chantiers_btp' in the schema cache" } }
      }
      if (operation === 'insert') return { data: { id: 'nouveau', ...valeur }, error: null }
      const ligne = etat.chantiers.find(l => Object.entries(filtres).every(([c, v]) => l[c] === v))
      return ligne ? { data: { ...ligne, ...valeur }, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    }
    return b
  }
  return { etat, from }
})

// Seul getAuthUser est simulé : la route lit aussi getUserRole, isProGerant et resolveCompanyId pour établir le
// périmètre de la société (lib/btp/perimetre-compte.ts, 24/11/2026), et c'est bien ce vrai code qu'on éprouve ici.
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))
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
