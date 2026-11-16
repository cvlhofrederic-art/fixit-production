// Module Prestations du BTP (components/dashboard/PrestationsBTPSection.tsx) : le catalogue de la société vit dans
// le navigateur (`fixit_prestations_btp_v5_<fiche>`), recopié sur le serveur par le miroir du stockage ; ses
// prestations sont publiées sur la fiche publique (table `services`). Constat stockage-local-miroir-5 de l'audit du
// 11/11/2026 : sur un appareil où le catalogue n'était pas (encore) revenu du serveur, l'écran partait du jeu par
// défaut, l'écrivait, publiait une seconde fois les prestations par défaut, puis réécrivait la clé depuis l'écran
// par-dessus le catalogue restauré entre-temps.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import type { Artisan } from '@/lib/types'

// Table `services` simulée : lignes de la base, insertions et mises à jour observées, crochet avant insertion.
const base = vi.hoisted(() => ({
  lignes: [] as Array<Record<string, unknown>>,
  insertions: [] as Array<Record<string, unknown>>,
  misesAJour: [] as Array<Record<string, unknown>>,
  avantInsertion: null as null | (() => void),
  compteur: 0,
}))

vi.mock('@/lib/supabase', () => {
  const requete = () => {
    const etat: { op: 'select' | 'insert' | 'update' | 'delete'; filtres: Array<[string, unknown]>; charge?: Record<string, unknown> } = { op: 'select', filtres: [] }
    const executer = (une: boolean) => {
      if (etat.op === 'insert') {
        base.avantInsertion?.()
        const id = `svc-nouveau-${++base.compteur}`
        base.lignes.push({ id, ...etat.charge })
        base.insertions.push({ ...etat.charge })
        return { data: { id }, error: null }
      }
      const visees = base.lignes.filter((l) => etat.filtres.every(([c, v]) => l[c] === v))
      if (etat.op === 'update') {
        base.misesAJour.push({ ...etat.charge, filtres: etat.filtres })
        return { data: visees[0] ? { id: visees[0].id } : null, error: null }
      }
      if (etat.op === 'delete') return { data: null, error: null }
      // Politique de lecture de la table : lignes actives seulement.
      const actives = visees.filter((l) => l.active !== false)
      return une ? { data: actives[0] ?? null, error: null } : { data: actives, error: null }
    }
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => { etat.filtres.push([c, v]); return api },
      limit: () => api,
      order: () => api,
      insert: (charge: Record<string, unknown>) => { etat.op = 'insert'; etat.charge = charge; return api },
      update: (charge: Record<string, unknown>) => { etat.op = 'update'; etat.charge = charge; return api },
      delete: () => { etat.op = 'delete'; return api },
      single: async () => executer(true),
      maybeSingle: async () => executer(true),
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(executer(false)).then(ok, ko),
    }
    return api
  }
  return { supabase: { from: () => requete(), auth: { getSession: async () => ({ data: { session: null } }) } } }
})
vi.mock('@/lib/auth/jeton-acces', () => ({ jetonAcces: async () => 'jeton-test' }))
vi.mock('@/lib/i18n/context', async () => (await import('../helpers/mocks-formulaires-devis')).traductions())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())

import PrestationsBTPSection, { SEED_PREST, SEED_MAT } from '@/components/dashboard/PrestationsBTPSection'
import { toast } from 'sonner'

const ARTISAN = { id: 'fiche-btp-prest', user_id: 'compte-btp-prest', company_name: 'BATIR TEST SAS' } as unknown as Artisan
const CLE = `fixit_prestations_btp_v5_${ARTISAN.id}`
const PREMIERE_PAR_DEFAUT = SEED_PREST[0].name

const prix = (n: number) => ({ min: n, max: n })
const CATALOGUE_SERVEUR = [
  { id: 1, name: 'Dalle maison', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(70), supabase_id: 'svc-existant-1' },
  { id: 2, name: 'Béton maison', type: 'mat', lot: 'gros_oeuvre', unit: 'm³', price: prix(160), priceAchat: prix(120) },
]

/** Réponse simulée de GET /api/user-storage. */
function serveur(reponse: { entries: Record<string, unknown> } | 'panne') {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!String(url).startsWith('/api/user-storage')) return new Response('{}', { status: 404 })
    if (reponse === 'panne') return new Response('{"error":"Erreur lors du chargement"}', { status: 500 })
    return new Response(JSON.stringify(reponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
}

const stocke = () => {
  const brut = localStorage.getItem(CLE)
  return brut === null ? null : (JSON.parse(brut) as Array<Record<string, unknown>>)
}
const monter = () => render(<PrestationsBTPSection artisan={ARTISAN} orgRole="pro_societe" />)
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  localStorage.clear()
  base.lignes = []
  base.insertions = []
  base.misesAJour = []
  base.avantInsertion = null
  base.compteur = 0
  vi.mocked(toast.error).mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Prestations BTP — catalogue absent de ce navigateur', () => {
  it('présent au serveur (restauration pas encore arrivée) : le catalogue du serveur s\'affiche, le jeu par défaut n\'est ni écrit ni publié', async () => {
    serveur({ entries: { [CLE]: CATALOGUE_SERVEUR } })
    monter()
    expect(await screen.findByText('Dalle maison')).toBeInTheDocument()
    await attendre(50)
    expect(screen.queryByText(PREMIERE_PAR_DEFAUT)).not.toBeInTheDocument()
    expect(stocke()).toBeNull()
    expect(base.insertions).toHaveLength(0)
  })

  it('rien au serveur non plus : le jeu par défaut est écrit et ses prestations publiées une fois', async () => {
    serveur({ entries: {} })
    monter()
    expect(await screen.findByText(PREMIERE_PAR_DEFAUT)).toBeInTheDocument()
    expect(stocke()).toHaveLength(SEED_PREST.length + SEED_MAT.length)
    await waitFor(() => expect(base.insertions).toHaveLength(SEED_PREST.length))
    // Les identifiants de services sont reportés dans le catalogue enregistré.
    await waitFor(() => expect(stocke()!.filter((p) => p.supabase_id)).toHaveLength(SEED_PREST.length))
  })

  it('serveur injoignable : rien n\'est écrit ni publié, un message le dit, une création est refusée', async () => {
    serveur('panne')
    monter()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.queryByText(PREMIERE_PAR_DEFAUT)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/^\+ Ajouter$/))
    fireEvent.change(screen.getByPlaceholderText('Ex: Dalle béton'), { target: { value: 'Prestation saisie trop tôt' } })
    fireEvent.click(screen.getByText('Créer'))
    await attendre(50)
    expect(stocke()).toBeNull()
    expect(base.insertions).toHaveLength(0)
    expect(toast.error).toHaveBeenCalledTimes(2)
  })
})

describe('Prestations BTP — publication des prestations sans identifiant de service', () => {
  it('l\'identifiant est reporté dans le catalogue relu, sans écraser ce qui y a été restauré entre-temps', async () => {
    serveur({ entries: {} })
    localStorage.setItem(CLE, JSON.stringify([{ id: 1, name: 'Dalle maison', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(70) }]))
    // Pendant la publication, la restauration du serveur réécrit le catalogue (version d'un autre appareil).
    base.avantInsertion = () => {
      localStorage.setItem(CLE, JSON.stringify([
        { id: 1, name: 'Dalle maison', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(75) },
        { id: 2, name: 'Enduit ajouté ailleurs', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(40), supabase_id: 'svc-9' },
      ]))
    }
    monter()
    await waitFor(() => expect(base.insertions).toHaveLength(1))
    await waitFor(() => expect(stocke()![0].supabase_id).toBe('svc-nouveau-1'))
    const apres = stocke()!
    expect(apres).toHaveLength(2)
    expect(apres[0].price).toEqual(prix(75))
    expect(apres[1]).toMatchObject({ name: 'Enduit ajouté ailleurs', supabase_id: 'svc-9' })
  })

  it('création : l\'identifiant du service n\'écrase pas le catalogue restauré pendant la publication', async () => {
    serveur({ entries: {} })
    localStorage.setItem(CLE, JSON.stringify([{ id: 1, name: 'Dalle maison', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(70), supabase_id: 'svc-existant-1' }]))
    monter()
    expect(await screen.findByText('Dalle maison')).toBeInTheDocument()
    // Pendant la publication, la restauration du serveur réécrit le catalogue ; l'identifiant 2 y désigne un autre
    // élément que la prestation créée.
    const restaure = [
      { id: 1, name: 'Dalle maison', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(75), supabase_id: 'svc-existant-1' },
      { id: 2, name: 'Enduit ajouté ailleurs', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(40), supabase_id: 'svc-9' },
    ]
    base.avantInsertion = () => { localStorage.setItem(CLE, JSON.stringify(restaure)) }
    fireEvent.click(screen.getByText(/^\+ Ajouter$/))
    fireEvent.change(screen.getByPlaceholderText('Ex: Dalle béton'), { target: { value: 'Chape liquide' } })
    fireEvent.click(screen.getByText('Créer'))
    await waitFor(() => expect(base.insertions).toHaveLength(1))
    await attendre(50)
    expect(stocke()).toEqual(restaure)
  })

  it('une prestation du même nom déjà publiée pour la fiche est reliée, pas recréée ni modifiée', async () => {
    serveur({ entries: {} })
    base.lignes.push({ id: 'svc-ancien', artisan_id: ARTISAN.id, name: 'Dalle béton', active: true })
    localStorage.setItem(CLE, JSON.stringify([{ id: 4, name: 'Dalle béton', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(65) }]))
    monter()
    await waitFor(() => expect(stocke()![0].supabase_id).toBe('svc-ancien'))
    expect(base.insertions).toHaveLength(0)
    expect(base.misesAJour).toHaveLength(0)
  })
})
