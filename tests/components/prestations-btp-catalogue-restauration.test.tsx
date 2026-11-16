// Module Prestations du BTP (components/dashboard/PrestationsBTPSection.tsx) : le catalogue de la société vit dans
// le navigateur (`fixit_prestations_btp_v5_<fiche>`), recopié sur le serveur par le miroir du stockage ; ses
// prestations sont publiées sur la fiche publique (table `services`). Constat stockage-local-miroir-5 de l'audit du
// 11/11/2026 : sur un appareil où le catalogue n'était pas (encore) revenu du serveur, l'écran partait du jeu par
// défaut, l'écrivait, publiait une seconde fois les prestations par défaut, puis réécrivait la clé depuis l'écran
// par-dessus le catalogue restauré entre-temps.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react'
import type { Artisan } from '@/lib/types'

// Table `services` simulée : lignes de la base, insertions, mises à jour et suppressions observées, crochet avant
// insertion.
const base = vi.hoisted(() => ({
  lignes: [] as Array<Record<string, unknown>>,
  insertions: [] as Array<Record<string, unknown>>,
  misesAJour: [] as Array<Record<string, unknown>>,
  suppressions: [] as Array<Array<[string, unknown]>>,
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
      if (etat.op === 'delete') {
        base.suppressions.push(etat.filtres)
        return { data: null, error: null }
      }
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
const AUTRE_FICHE = { id: 'fiche-btp-autre', user_id: 'compte-btp-autre', company_name: 'BATIR TEST SAS' } as unknown as Artisan
const CLE_AUTRE_FICHE = `fixit_prestations_btp_v5_${AUTRE_FICHE.id}`
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
/** Texte du n-ième message d'erreur affiché (à partir de 0). */
const messageErreur = (n: number) => String(vi.mocked(toast.error).mock.calls[n]?.[0])

beforeEach(() => {
  localStorage.clear()
  base.lignes = []
  base.insertions = []
  base.misesAJour = []
  base.suppressions = []
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

  it('serveur injoignable : rien n\'est écrit ni publié, un message le dit ; une création refusée relance la lecture', async () => {
    serveur('panne')
    monter()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.queryByText(PREMIERE_PAR_DEFAUT)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/^\+ Ajouter$/))
    fireEvent.change(screen.getByPlaceholderText('Ex: Dalle béton'), { target: { value: 'Prestation saisie trop tôt' } })
    fireEvent.click(screen.getByText('Créer'))
    // Le refus annonce une nouvelle lecture ; le serveur ne répond toujours pas : le message de l'échec revient.
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(3))
    expect(messageErreur(1)).toMatch(/indisponible.*nouvelle tentative de chargement.*recommencez/i)
    expect(messageErreur(2)).toMatch(/indisponible.*rechargez la page/i)
    expect(fetch).toHaveBeenCalledTimes(2)
    await attendre(50)
    expect(stocke()).toBeNull()
    expect(base.insertions).toHaveLength(0)
    expect(screen.queryByText(PREMIERE_PAR_DEFAUT)).not.toBeInTheDocument()
  })

  it('pendant le chargement : une création est refusée, le message invite à patienter, rien n\'est écrit ni publié', async () => {
    let repondre: (reponse: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resoudre) => { repondre = resoudre })))
    monter()
    fireEvent.click(screen.getByText(/^\+ Ajouter$/))
    fireEvent.change(screen.getByPlaceholderText('Ex: Dalle béton'), { target: { value: 'Prestation saisie trop tôt' } })
    fireEvent.click(screen.getByText('Créer'))
    await attendre(50)
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(messageErreur(0)).toMatch(/en cours de chargement.*patientez/)
    expect(stocke()).toBeNull()
    expect(base.insertions).toHaveLength(0)
    // La réponse arrive ensuite : le catalogue du serveur s'affiche.
    repondre(new Response(JSON.stringify({ entries: { [CLE]: CATALOGUE_SERVEUR } }), { status: 200 }))
    expect(await screen.findByText('Dalle maison')).toBeInTheDocument()
  })

  it('catalogue recopié par la restauration pendant la question au serveur (réponse « absent ») : il s\'affiche, le jeu par défaut ne l\'écrase pas', async () => {
    const restaure = [{ id: 1, name: 'Dalle maison', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(70), supabase_id: 'svc-existant-1' }]
    vi.stubGlobal('fetch', vi.fn(async () => {
      // La restauration depuis le serveur écrit la clé pendant que l'écran attend sa propre réponse.
      localStorage.setItem(CLE, JSON.stringify(restaure))
      return new Response(JSON.stringify({ entries: {} }), { status: 200 })
    }))
    monter()
    expect(await screen.findByText('Dalle maison')).toBeInTheDocument()
    await attendre(50)
    expect(screen.queryByText(PREMIERE_PAR_DEFAUT)).not.toBeInTheDocument()
    expect(stocke()).toEqual(restaure)
    expect(base.insertions).toHaveLength(0)
  })

  it('valeur enregistrée illisible et rien au serveur : le jeu par défaut s\'affiche sans écraser cette valeur', async () => {
    const illisible = '[{"id":1,"name":'
    localStorage.setItem(CLE, illisible)
    serveur({ entries: {} })
    monter()
    expect(await screen.findByText(PREMIERE_PAR_DEFAUT)).toBeInTheDocument()
    // Fin de la publication des prestations affichées : leurs identifiants ne s'écrivent pas non plus par-dessus.
    await waitFor(() => expect(base.insertions).toHaveLength(SEED_PREST.length))
    await attendre(50)
    expect(localStorage.getItem(CLE)).toBe(illisible)
  })
})

describe('Prestations BTP — après un échec du chargement, une modification refusée relance la lecture', () => {
  /** Ouvre la saisie d'une prestation et demande sa création. */
  const creer = (nom: string) => {
    fireEvent.click(screen.getByText(/^\+ Ajouter$/))
    fireEvent.change(screen.getByPlaceholderText('Ex: Dalle béton'), { target: { value: nom } })
    fireEvent.click(screen.getByText('Créer'))
  }

  it('catalogue recopié entre-temps par la restauration : il s\'affiche sans rien écrire, puis la création recommencée s\'y ajoute', async () => {
    serveur('panne')
    monter()
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    // La restauration depuis le serveur recopie le catalogue dans ce navigateur après l'échec de l'écran.
    localStorage.setItem(CLE, JSON.stringify(CATALOGUE_SERVEUR))
    creer('Chape liquide')
    expect(await screen.findByText('Dalle maison')).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledTimes(2)
    expect(messageErreur(1)).toMatch(/nouvelle tentative de chargement.*recommencez/i)
    expect(stocke()).toEqual(CATALOGUE_SERVEUR)
    expect(base.insertions).toHaveLength(0)
    // La saisie est restée ouverte : recommencée, la création s'ajoute au catalogue restauré, sans rien en retirer.
    fireEvent.click(screen.getByText('Créer'))
    await waitFor(() => expect(base.insertions).toHaveLength(1))
    await waitFor(() => expect(stocke()!.map((p) => p.name)).toEqual(['Dalle maison', 'Béton maison', 'Chape liquide']))
    expect(stocke()!.slice(0, 2)).toEqual(CATALOGUE_SERVEUR)
  })

  it('serveur de nouveau joignable : son catalogue s\'affiche, rien n\'est écrit ni publié', async () => {
    serveur('panne')
    monter()
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    serveur({ entries: { [CLE]: CATALOGUE_SERVEUR } })
    creer('Chape liquide')
    expect(await screen.findByText('Dalle maison')).toBeInTheDocument()
    await attendre(50)
    expect(toast.error).toHaveBeenCalledTimes(2)
    expect(stocke()).toBeNull()
    expect(base.insertions).toHaveLength(0)
  })

  it('valeur illisible dans ce navigateur comme au serveur : la modification reste refusée, la valeur est conservée', async () => {
    const illisible = '[{"id":1,"name":'
    localStorage.setItem(CLE, illisible)
    serveur({ entries: { [CLE]: illisible } })
    monter()
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    creer('Chape liquide')
    // Refus, puis nouvel échec de la lecture : rien n'est affiché à la place du catalogue ni écrit par-dessus.
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(3))
    await attendre(50)
    expect(localStorage.getItem(CLE)).toBe(illisible)
    expect(base.insertions).toHaveLength(0)
    expect(screen.queryByText(PREMIERE_PAR_DEFAUT)).not.toBeInTheDocument()
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

  it('une prestation du même nom déjà publiée par le module pour la fiche est reliée, pas recréée ni modifiée', async () => {
    serveur({ entries: {} })
    // Service tel que le module le publie : balise de fourchette en fin de description, durée vide.
    base.lignes.push({ id: 'svc-ancien', artisan_id: ARTISAN.id, name: 'Dalle béton', description: 'Dalle coulée [unit:m²|min:65|max:65]', duration_minutes: null, active: true })
    localStorage.setItem(CLE, JSON.stringify([{ id: 4, name: 'Dalle béton', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(65) }]))
    monter()
    await waitFor(() => expect(stocke()![0].supabase_id).toBe('svc-ancien'))
    expect(base.insertions).toHaveLength(0)
    expect(base.misesAJour).toHaveLength(0)
  })

  it('un service du même nom créé ailleurs pour la fiche n\'est pas repris : la prestation est publiée à part, ce service reste intact', async () => {
    serveur({ entries: {} })
    // Service créé par l'assistant ou l'application mobile : une durée, pas de balise du module.
    base.lignes.push({ id: 'svc-ailleurs', artisan_id: ARTISAN.id, name: 'Dalle béton', description: '', duration_minutes: 60, active: true })
    localStorage.setItem(CLE, JSON.stringify([{ id: 4, name: 'Dalle béton', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(65) }]))
    monter()
    await waitFor(() => expect(stocke()![0].supabase_id).toBe('svc-nouveau-1'))
    expect(base.insertions).toHaveLength(1)
    expect(base.misesAJour).toHaveLength(0)
  })
})

describe('Prestations BTP — aucune modification tant que le catalogue de la fiche n\'est pas chargé', () => {
  it('changement de fiche, serveur injoignable : une suppression est refusée, rien n\'est écrit ni retiré de la fiche publique', async () => {
    const catalogue = [{ id: 1, name: 'Dalle maison', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: prix(70), supabase_id: 'svc-existant-1' }]
    localStorage.setItem(CLE, JSON.stringify(catalogue))
    serveur('panne')
    const { rerender } = monter()
    expect(await screen.findByText('Dalle maison')).toBeInTheDocument()
    // Autre fiche : son catalogue n'est pas dans ce navigateur et le serveur ne répond pas. La liste de la fiche
    // précédente est encore à l'écran.
    rerender(<PrestationsBTPSection artisan={AUTRE_FICHE} orgRole="pro_societe" />)
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    fireEvent.click(within(screen.getByText('Dalle maison').closest('tr') as HTMLElement).getByText('✕'))
    // Refusée ; la nouvelle lecture qu'elle relance échoue encore (serveur injoignable).
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(3))
    expect(messageErreur(1)).toMatch(/indisponible.*nouvelle tentative de chargement/i)
    await attendre(50)
    expect(localStorage.getItem(CLE_AUTRE_FICHE)).toBeNull()
    expect(stocke()).toEqual(catalogue)
    expect(base.suppressions).toHaveLength(0)
  })
})
