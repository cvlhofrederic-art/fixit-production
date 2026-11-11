// tests/lib/use-btp-data-modification-partielle.test.tsx
//
// Audit des fondations BTP du 11/11/2026 : `update(id, { statut })` passait par mapToSupabase, qui donne une
// valeur par défaut à tout champ absent. Changer le statut d'un chantier, le prolonger, ajouter un poste à une
// situation, demander une mainlevée, agréer un sous-traitant ou simplement ouvrir « Météo chantiers » (qui
// enregistre des coordonnées) réécrivait donc à vide tous les autres champs de la fiche.
// Une modification n'envoie plus que les champs fournis ; une création garde ses valeurs par défaut.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))

import { SOURCES_DES_COLONNES, colonnesModifiees, mapToSupabase, useBTPData } from '@/lib/hooks/use-btp-data'

type Table = Parameters<typeof colonnesModifiees>[0]

describe('colonnesModifiees — une modification partielle n’envoie que ce qui change', () => {
  it('chantier : statut seul, prolongation seule, coordonnées seules (page Météo)', () => {
    expect(colonnesModifiees('chantiers', { statut: 'En cours' })).toEqual({ statut: 'En cours' })
    expect(colonnesModifiees('chantiers', { dateFin: '2026-12-01' })).toEqual({ date_fin: '2026-12-01' })
    expect(colonnesModifiees('chantiers', { latitude: 43.3, longitude: 5.4 })).toEqual({ latitude: 43.3, longitude: 5.4 })
  })

  it('situation de travaux : ajout d’un poste, changement de statut', () => {
    const travaux = [{ poste: 'Gros œuvre', quantite: 1 }]
    expect(colonnesModifiees('situations', { travaux })).toEqual({ travaux: JSON.stringify(travaux) })
    expect(colonnesModifiees('situations', { statut: 'validée' })).toEqual({ statut: 'validée' })
  })

  it('retenue de garantie : mainlevée demandée puis libération', () => {
    // RetenuesGarantieSection envoie toujours la clé dateLiberation, undefined tant que la retenue n'est pas libérée.
    expect(colonnesModifiees('retenues', { statut: 'mainlevée demandée', dateLiberation: undefined }))
      .toEqual({ statut: 'mainlevée demandée', date_liberation: null })
    expect(colonnesModifiees('retenues', { statut: 'libérée', dateLiberation: '2026-11-11' }))
      .toEqual({ statut: 'libérée', date_liberation: '2026-11-11' })
  })

  it('sous-traitant : agrément, DC4 généré ; analyse DCE : résultat', () => {
    expect(colonnesModifiees('dc4', { statut: 'agréé', dateAgrement: '2026-11-11' })).toEqual({ statut: 'agréé', date_agrement: '2026-11-11' })
    expect(colonnesModifiees('dc4', { dc4Genere: true })).toEqual({ dc4_genere: true })
    expect(colonnesModifiees('dce_analyses', { result: { lots: 3 }, status: 'done' })).toEqual({ result: '{"lots":3}', status: 'done' })
  })

  it('appel d’offres (DPGF) : ajout d’un lot, statut', () => {
    expect(colonnesModifiees('dpgf', { lots: [{ numero: 1 }] })).toEqual({ lots: '[{"numero":1}]' })
    expect(colonnesModifiees('dpgf', { statut: 'remis' })).toEqual({ statut: 'remis' })
  })

  it('salarié : désactivation seule ; équipe : renommage sans toucher à ses membres', () => {
    expect(colonnesModifiees('membres', { actif: false })).toEqual({ actif: false })
    expect(colonnesModifiees('equipes', { nom: 'Maçons' })).toEqual({ nom: 'Maçons' })
    expect(colonnesModifiees('equipes', { nom: 'Maçons', membreIds: ['m1'] })).toEqual({ nom: 'Maçons', membreIds: ['m1'] })
  })

  it('pointage et dépense : un seul champ ; le mode de pointage posé à la création n’est pas réécrit', () => {
    expect(colonnesModifiees('pointages', { notes: 'pluie' })).toEqual({ notes: 'pluie' })
    expect(colonnesModifiees('depenses', { amount: '120.50' })).toEqual({ amount: 120.5 })
  })

  it('les deux écritures d’un même champ sont reconnues (codePostal / code_postal, montantMarche / montant_marche)', () => {
    expect(colonnesModifiees('chantiers', { codePostal: '13001' })).toEqual({ code_postal: '13001' })
    expect(colonnesModifiees('chantiers', { code_postal: '13002' })).toEqual({ code_postal: '13002' })
    expect(colonnesModifiees('retenues', { montant_marche: 5000 })).toEqual({ montant_marche: 5000 })
  })

  it('un champ fourni vide est bien vidé ; un champ inconnu ou aucun champ n’écrit rien', () => {
    expect(colonnesModifiees('chantiers', { client: '', description: '' })).toEqual({ client: null, description: null })
    expect(colonnesModifiees('membres', { salaire_brut_mensuel: undefined })).toEqual({ salaire_brut_mensuel: null })
    expect(colonnesModifiees('chantiers', { id: 'x', geoRayonM: 100 })).toEqual({})
    expect(colonnesModifiees('chantiers', {})).toEqual({})
  })

  it('un formulaire complet écrit les mêmes colonnes qu’avant', () => {
    const formulaire = {
      titre: 'Villa Dupré', client: 'Mme Dupré', adresse: '1 rue des Lilas', ville: 'Marseille', codePostal: '13008',
      dateDebut: '2026-11-01', dateFin: '2026-12-15', budget: '45000', statut: 'En cours', description: 'Extension',
      equipe: 'Maçons', latitude: 43.25, longitude: 5.38,
    }
    expect(colonnesModifiees('chantiers', formulaire)).toEqual(mapToSupabase('chantiers', formulaire))
  })
})

describe('SOURCES_DES_COLONNES reste aligné sur mapToSupabase', () => {
  // Colonnes posées d'office à la création, volontairement absentes des modifications.
  const POSEES_A_LA_CREATION: Record<string, string[]> = { pointages: ['mode'] }

  for (const [table, sources] of Object.entries(SOURCES_DES_COLONNES)) {
    it(`${table} : chaque colonne écrite à la création a ses champs source, et inversement`, () => {
      // Tous les champs source à la fois : la modification doit alors porter sur toutes les colonnes de la création.
      const tousLesChamps = Object.fromEntries(Object.values(sources).flat().map(champ => [champ, 'x']))
      const creation = Object.keys(mapToSupabase(table as Table, tousLesChamps)).sort((a, b) => a.localeCompare(b))
      const attendues = [...Object.keys(sources), ...(POSEES_A_LA_CREATION[table] ?? [])].sort((a, b) => a.localeCompare(b))
      expect(creation).toEqual(attendues)
      expect(Object.keys(colonnesModifiees(table as Table, tousLesChamps)).sort((a, b) => a.localeCompare(b)))
        .toEqual(Object.keys(sources).sort((a, b) => a.localeCompare(b)))
    })
  }

  it('les tables sans correspondance (charges fixes) envoient leurs champs tels quels', () => {
    expect(colonnesModifiees('charges_fixes', { montant: 300 })).toEqual({ montant: 300 })
  })
})

describe('useBTPData.update — ce qui part réellement vers /api/btp', () => {
  let envois: Array<{ table: string; action: string; id?: string; data?: Record<string, unknown> }>

  beforeEach(() => {
    envois = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (init?.method === 'POST') {
        envois.push(JSON.parse(String(init.body)))
        return new Response(JSON.stringify({ row: { id: 'c1' } }), { status: 200 })
      }
      const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
      return new Response(JSON.stringify({ [table]: [{ id: 'c1', titre: 'Villa Dupré', statut: 'En attente' }] }), { status: 200 })
    })
  })
  afterEach(() => { vi.restoreAllMocks() })

  const monter = async (table: 'chantiers' | 'situations') => {
    const hook = renderHook(() => useBTPData({ table, artisanId: 'a1', userId: `u-${table}-${Date.now()}`, autoImport: false }))
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook.result
  }

  it('changer le statut d’un chantier n’envoie que le statut', async () => {
    const hook = await monter('chantiers')
    let ok = false
    await act(async () => { ok = await hook.current.update('c1', { statut: 'En cours' }) })
    expect(ok).toBe(true)
    expect(envois).toEqual([{ table: 'chantiers_btp', action: 'update', id: 'c1', data: { statut: 'En cours' } }])
  })

  it('enregistrer des coordonnées (page Météo) n’envoie que la latitude et la longitude', async () => {
    const hook = await monter('chantiers')
    await act(async () => { await hook.current.update('c1', { latitude: 43.3, longitude: 5.4 }) })
    expect(envois).toEqual([{ table: 'chantiers_btp', action: 'update', id: 'c1', data: { latitude: 43.3, longitude: 5.4 } }])
  })

  it('une modification sans aucun champ reconnu n’appelle pas le serveur', async () => {
    const hook = await monter('chantiers')
    let ok = false
    await act(async () => { ok = await hook.current.update('c1', { geoRayonM: 100 }) })
    expect(ok).toBe(true)
    expect(envois).toEqual([])
  })

  it('une création garde ses valeurs par défaut', async () => {
    const hook = await monter('situations')
    await act(async () => { await hook.current.add({ chantier: 'Villa Dupré' }) })
    expect(envois).toHaveLength(1)
    expect(envois[0]).toMatchObject({ table: 'situations_btp', action: 'insert', data: { chantier: 'Villa Dupré', numero: 1, statut: 'brouillon', travaux: '[]' } })
  })
})
