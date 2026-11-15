// @vitest-environment node
// tests/api/artisan-settings-adresse-publique.test.ts — adresse publique de la fiche (slug) à l'enregistrement de
// « Mon profil » (POST /api/artisan-settings), constats inscription-profil-13 et api-coeur-8 de l'audit du 11/11/2026.
//
// Défaut corrigé pour une société BTP (pro_societe) : chaque enregistrement recalculait l'adresse publique à partir du
// seul nom (sans la ville, que le tableau de bord n'envoie jamais), si bien qu'elle changeait avec le nom et que les
// liens déjà indexés ne répondaient plus ; et si une autre fiche portait la même adresse, la base refusait le doublon
// et tout l'enregistrement échouait (RCS, TVA, assurance perdus). Contrat vérifié ici :
// - une fiche qui a une adresse publique la garde, quel que soit le nom envoyé ;
// - une fiche sans adresse la reçoit, à partir du nom et de la ville de la fiche, avec un suffixe si elle est prise ;
// - un doublon découvert à l'écriture n'empêche pas d'enregistrer les autres champs.
// Une fiche sans adresse la reçoit au premier enregistrement venu, quel que soit l'écran (Mon profil, Zones
// d'intervention) : « Mon profil » n'envoie plus le nom s'il n'a pas changé.
// L'artisan et la société inscrite au Portugal (fiche en portugais) gardent le calcul d'avant (témoins).
//
// Faux client Supabase : `profiles_artisan` avec contrainte d'unicité sur `slug`, comme la colonne `slug TEXT UNIQUE`
// des migrations (supabase/migrations/052_baseline_missing_tables.sql).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | { id: string; email: string; app_metadata: Record<string, unknown> },
    fiches: [] as Ligne[],
    // Adresses prises par une fiche créée entre la lecture et l'écriture (invisibles à la lecture)
    prisesEntreTemps: new Set<string>(),
    majs: [] as Ligne[],
  }
  const correspond = (valeur: unknown, motif: string) => {
    const regex = new RegExp(`^${motif.split('%').map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
    return typeof valeur === 'string' && regex.test(valeur)
  }
  const from = (table: string) => {
    if (table !== 'profiles_artisan') throw new Error(`table inattendue : ${table}`)
    const filtres: Array<[string, string, unknown]> = []
    let colonnes = '*'
    let valeurs: Ligne | null = null
    const lignes = () => etat.fiches.filter((l) => filtres.every(([op, col, val]) =>
      op === 'eq' ? l[col] === val : correspond(l[col], String(val))))
    const projeter = (l: Ligne) => (colonnes === '*'
      ? { ...l }
      : Object.fromEntries(colonnes.split(',').map((c) => c.trim()).map((c) => [c, l[c] ?? null])))
    const executer = () => {
      if (!valeurs) return { data: lignes().map(projeter), error: null }
      const cibles = lignes()
      const slug = valeurs.slug
      const doublon = typeof slug === 'string'
        && (etat.prisesEntreTemps.has(slug) || etat.fiches.some((f) => f.slug === slug && !cibles.includes(f)))
      if (doublon) {
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "profiles_artisan_slug_key"' } }
      }
      etat.majs.push({ ...valeurs })
      for (const cible of cibles) Object.assign(cible, valeurs)
      return { data: null, error: null }
    }
    const b: Record<string, unknown> = {}
    b.select = (c = '*') => { colonnes = c; return b }
    b.eq = (col: string, val: unknown) => { filtres.push(['eq', col, val]); return b }
    b.like = (col: string, motif: string) => { filtres.push(['like', col, motif]); return b }
    b.limit = () => b
    b.update = (v: Ligne) => { valeurs = v; return b }
    b.single = async () => {
      const [ligne] = lignes()
      return ligne ? { data: projeter(ligne), error: null } : { data: null, error: { code: 'PGRST116', message: 'aucune ligne' } }
    }
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(executer()).then(ok, ko)
    return b
  }
  return { etat, from }
})

vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))

const { POST } = await import('@/app/api/artisan-settings/route')

const COMPTE = '550e8400-e29b-41d4-a716-446655440000'
const FICHE = '0b9f8c1e-5d4a-4b6f-9e7d-1a2b3c4d5e6f'

const enregistrer = async (corps: Record<string, unknown>) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/artisan-settings', {
    method: 'POST',
    headers: { Authorization: 'Bearer jeton', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

const ficheDuCompte = () => h.etat.fiches.find((f) => f.id === FICHE) as Ligne

function preparer(role: string, fiche: Ligne, autres: Ligne[] = []) {
  h.etat.user = { id: COMPTE, email: 'compte@exemple.fr', app_metadata: { role } }
  h.etat.fiches = [{ id: FICHE, user_id: COMPTE, ...fiche }, ...autres]
}

beforeEach(() => {
  h.etat.majs = []
  h.etat.prisesEntreTemps = new Set()
})

describe('Société BTP : l’adresse publique de la fiche ne change plus une fois posée', () => {
  const FICHE_AVEC_ADRESSE = { company_name: 'Bâtiment Exemple', company_city: 'Exempleville', slug: 'batiment-exemple-exempleville' }

  it('un changement de nom garde l’adresse publique', async () => {
    preparer('pro_societe', FICHE_AVEC_ADRESSE)

    const { status, json } = await enregistrer({ company_name: 'Exemple Construction' })

    expect(status).toBe(200)
    expect(h.etat.majs).toEqual([{ company_name: 'Exemple Construction' }])
    expect(ficheDuCompte().slug).toBe('batiment-exemple-exempleville')
    expect(json.slug).toBeUndefined()
  })

  it('un enregistrement qui renvoie le même nom ne recalcule pas l’adresse sans la ville', async () => {
    preparer('pro_societe', FICHE_AVEC_ADRESSE)

    const { status } = await enregistrer({ company_name: 'Bâtiment Exemple', rcs_number: 'RCS Exempleville 000 000 000' })

    expect(status).toBe(200)
    expect(h.etat.majs).toHaveLength(1)
    expect(h.etat.majs[0]).not.toHaveProperty('slug')
    expect(ficheDuCompte().slug).toBe('batiment-exemple-exempleville')
  })

  it('une fiche sans adresse la reçoit, avec la ville de la fiche, même si le nom n’est pas envoyé', async () => {
    preparer('pro_societe', { company_name: 'Bâtiment Exemple', company_city: 'Exempleville', slug: null })

    const { status, json } = await enregistrer({ tva_intra: 'FR00 000000000' })

    expect(status).toBe(200)
    expect(ficheDuCompte().slug).toBe('batiment-exemple-exempleville')
    expect(json.slug).toBe('batiment-exemple-exempleville')
  })

  it('écran Zones d’intervention (zones seules) : la fiche sans adresse la reçoit une fois, puis la garde', async () => {
    preparer('pro_societe', { company_name: 'Bâtiment Exemple', company_city: 'Exempleville', slug: null, language: 'fr' })
    const zones = { intervention_zones: { regions: [], departments: ['13'], cities: [] } }

    await enregistrer(zones)
    await enregistrer({ ...zones, company_name: 'Exemple Construction' })

    expect(h.etat.majs[0]).toMatchObject({ slug: 'batiment-exemple-exempleville' })
    expect(h.etat.majs[1]).not.toHaveProperty('slug')
    expect(ficheDuCompte().slug).toBe('batiment-exemple-exempleville')
  })

  it('adresse déjà prise par une autre fiche : suffixe, et l’enregistrement réussit', async () => {
    preparer('pro_societe', { company_name: 'Bâtiment Exemple', company_city: 'Exempleville', slug: null }, [
      { id: 'autre-1', user_id: 'autre-compte', slug: 'batiment-exemple-exempleville' },
      { id: 'autre-2', user_id: 'autre-compte-2', slug: 'batiment-exemple-exempleville-2' },
    ])

    const { status } = await enregistrer({ ape_code: '4399C' })

    expect(status).toBe(200)
    expect(ficheDuCompte()).toMatchObject({ ape_code: '4399C', slug: 'batiment-exemple-exempleville-3' })
  })

  it('doublon découvert à l’écriture : les autres champs sont enregistrés, sans adresse', async () => {
    preparer('pro_societe', { company_name: 'Bâtiment Exemple', company_city: 'Exempleville', slug: null })
    // Avant le correctif : adresse calculée sans la ville, refusée par la base, enregistrement entier en erreur 500
    h.etat.prisesEntreTemps.add('batiment-exemple')
    h.etat.prisesEntreTemps.add('batiment-exemple-exempleville')

    const { status, json } = await enregistrer({ company_name: 'Bâtiment Exemple', insurance_name: 'Assureur Exemple' })

    expect(status).toBe(200)
    expect(ficheDuCompte()).toMatchObject({ insurance_name: 'Assureur Exemple', slug: null })
    expect(json.slug).toBeUndefined()
  })
})

describe('Artisan : calcul de l’adresse inchangé (témoin)', () => {
  it('le nom envoyé recalcule l’adresse comme avant, même quand la fiche en a une', async () => {
    preparer('artisan', { company_name: 'Plomberie Exemple', company_city: 'Exempleville', slug: 'plomberie-exemple-exempleville' })

    const { status, json } = await enregistrer({ company_name: 'Plomberie Exemple', bio: 'Dépannage' })

    expect(status).toBe(200)
    expect(h.etat.majs).toEqual([{ company_name: 'Plomberie Exemple', bio: 'Dépannage', slug: 'plomberie-exemple' }])
    expect(json.slug).toBe('plomberie-exemple')
  })
})

describe('Société inscrite au Portugal : calcul de l’adresse d’avant (Portugal hors de ce correctif, témoins)', () => {
  it('le nom envoyé recalcule l’adresse comme avant, même quand la fiche en a une', async () => {
    preparer('pro_societe', { company_name: 'Construções Exemplo', company_city: 'Porto', slug: 'construcoes-exemplo-porto', language: 'pt' })

    const { status, json } = await enregistrer({ company_name: 'Construções Exemplo', bio: 'Remodelações' })

    expect(status).toBe(200)
    expect(h.etat.majs).toEqual([{ company_name: 'Construções Exemplo', bio: 'Remodelações', slug: 'construcoes-exemplo' }])
    expect(json.slug).toBe('construcoes-exemplo')
  })

  it('sans nom envoyé, une fiche sans adresse n’en reçoit pas, comme avant', async () => {
    preparer('pro_societe', { company_name: 'Construções Exemplo', company_city: 'Porto', slug: null, language: 'pt' })

    const { status, json } = await enregistrer({ tva_intra: 'PT000000000' })

    expect(status).toBe(200)
    expect(h.etat.majs).toEqual([{ tva_intra: 'PT000000000' }])
    expect(json.slug).toBeUndefined()
  })
})
