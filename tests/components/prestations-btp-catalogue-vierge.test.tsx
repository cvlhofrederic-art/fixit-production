// tests/components/prestations-btp-catalogue-vierge.test.tsx
//
// Catalogue Prestations du BTP (pro_societe) vierge à la création du compte, en France comme au Portugal (demande
// de Frédéric du 17/11/2026). Jusque-là, le module Prestations (components/dashboard/PrestationsBTPSection.tsx)
// écrivait 31 prestations et 9 matériaux d'exemple, en français, dès sa première ouverture
// (`fixit_prestations_btp_v5_<fiche>`), et le formulaire de devis et facture BTP (components/DevisFactureFormBTP.tsx)
// en écrivait autant dans son ancienne copie (`fixit_prestations_btp_v4_<fiche>`) pour les proposer dans ses listes.
// Désormais :
//   - compte neuf : catalogue vide dans le module (FR et PT) et dans les listes du formulaire ; rien n'est écrit ni
//     publié ;
//   - compte existant : le catalogue enregistré (ancien catalogue d'exemple compris) s'affiche et reste tel quel ;
//   - la première prestation saisie dans un catalogue parti vide est enregistrée et publiée une seule fois.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { Artisan } from '@/lib/types'
import type { ArtisanBasic } from '@/lib/devis-types'

const h = vi.hoisted(() => ({
  locale: 'fr' as 'fr' | 'pt',
  // Publication d'une prestation sur la fiche publique (table `services`) : refusée comme en production au
  // 17/11/2026 (durée obligatoire, le module l'envoie vide), ou acceptée.
  publication: 'refusee' as 'refusee' | 'acceptee',
  insertions: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: h.locale }),
  useLocale: () => h.locale,
}))
vi.mock('@/lib/supabase', () => {
  const requete = () => {
    let operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
    const executer = () => {
      if (operation === 'insert') {
        return h.publication === 'acceptee'
          ? { data: { id: `svc-${h.insertions.length}` }, error: null }
          : { data: null, error: { code: '23502', message: 'null value in column "duration_minutes"' } }
      }
      return { data: operation === 'select' ? [] : null, error: null }
    }
    const api: Record<string, unknown> = {
      select: () => api,
      eq: () => api,
      in: () => api,
      order: () => api,
      limit: () => api,
      insert: (charge: Record<string, unknown>) => { operation = 'insert'; h.insertions.push(charge); return api },
      update: () => { operation = 'update'; return api },
      delete: () => { operation = 'delete'; return api },
      single: async () => executer(),
      maybeSingle: async () => executer(),
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(executer()).then(ok, ko),
    }
    return api
  }
  return {
    supabase: {
      from: () => requete(),
      rpc: vi.fn(async () => ({ data: null, error: null })),
      auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    },
  }
})
vi.mock('@/lib/fetch-authentifie', () => ({ fetchAuthentifie: vi.fn(async () => new Response('[]', { status: 200 })) }))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn(), loading: vi.fn(() => 'tid'), dismiss: vi.fn() }),
}))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))

import PrestationsBTPSection from '@/components/dashboard/PrestationsBTPSection'
import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'

const FICHE = { id: 'fiche-btp-vierge', user_id: 'compte-btp-vierge', company_name: 'BATIR TEST SAS' } as unknown as Artisan
const FICHE_DEVIS: ArtisanBasic = { id: 'fiche-btp-vierge', company_name: 'BATIR TEST SAS', email: 'contact@batir.test' }
const CLE_MODULE = `fixit_prestations_btp_v5_${FICHE.id}`
const CLE_ANCIENNE = `fixit_prestations_btp_v4_${FICHE.id}`

// Quelques noms de l'ancien catalogue d'exemple (retiré du code le 17/11/2026) : prestations puis matériaux.
const ANCIENS_EXEMPLES = [
  'Démolition cloisons + évacuation gravats', 'Dalle béton', 'Peinture 2 couches intérieure', "Main d'œuvre qualifiée",
  'Enduit monocouche 25 kg', "Béton prêt à l'emploi C25/30",
]
// Catalogue d'un compte existant : deux éléments de l'ancien exemple, gardés, et une prestation à lui.
const CATALOGUE_EXISTANT = JSON.stringify([
  { id: 1, name: 'Démolition cloisons + évacuation gravats', type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 2500, max: 4000 } },
  { id: 30, name: 'Enduit monocouche 25 kg', type: 'mat', lot: 'gros_oeuvre', unit: 'sac', price: { min: 22, max: 26 }, priceAchat: { min: 15.5, max: 15.5 } },
  { id: 40, name: 'Dalle maison', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: { min: 70, max: 70 }, supabase_id: 'svc-existant' },
])

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Clés de catalogue BTP présentes dans le navigateur. */
function clesCatalogue(): string[] {
  const cles: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const cle = localStorage.key(i)
    if (cle?.startsWith('fixit_prestations_btp_')) cles.push(cle)
  }
  return cles.sort()
}

const monterModule = () => render(<PrestationsBTPSection artisan={FICHE} orgRole="pro_societe" />)
const monterFormulaire = () => render(<DevisFactureFormBTP artisan={FICHE_DEVIS} services={[]} bookings={[]} onBack={vi.fn()} />)

/** Ouvre la liste attachée au champ (bouton ▾ voisin) et rend ses lignes. */
function ouvrirListe(placeholder: string): string[] {
  const champ = screen.getByPlaceholderText(placeholder)
  fireEvent.click(champ.nextElementSibling as HTMLElement)
  const liste = champ.parentElement!.querySelector('div') as HTMLElement
  return Array.from(liste.children).map((n) => n.textContent || '')
}
const PRESTATION = 'Saisissez ou sélectionnez une prestation…'
const MATERIAU = 'Saisissez ou sélectionnez un matériau…'
/** Libellé proposé sans son prix (« Nom — 12,00 € »). */
const nomPropose = (libelle: string) => {
  const fin = libelle.lastIndexOf(' — ')
  return fin < 0 ? libelle : libelle.slice(0, fin)
}

beforeEach(() => {
  localStorage.clear()
  h.locale = 'fr'
  h.publication = 'refusee'
  h.insertions = []
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('module Prestations BTP — compte neuf', () => {
  it('France : ni prestation ni matériau d\'exemple ; rien n\'est écrit ni publié', async () => {
    monterModule()
    expect(screen.getByText('Aucune prestation dans ce lot.')).toBeInTheDocument()
    await attendre(30)
    expect(screen.getByText('Aucune prestation dans ce lot.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Matériaux/ }))
    expect(screen.getByText('Aucun matériau référencé.')).toBeInTheDocument()
    for (const nom of ANCIENS_EXEMPLES) expect(screen.queryByText(nom)).toBeNull()
    expect(clesCatalogue()).toEqual([])
    expect(h.insertions).toHaveLength(0)
  })

  it('Portugal : ni prestação ni material d\'exemple ; rien n\'est écrit ni publié', async () => {
    h.locale = 'pt'
    monterModule()
    expect(screen.getByText('Nenhuma prestação neste lote.')).toBeInTheDocument()
    await attendre(30)
    expect(screen.getByText('Nenhuma prestação neste lote.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Materiais/ }))
    expect(screen.getByText('Nenhum material referenciado.')).toBeInTheDocument()
    for (const nom of ANCIENS_EXEMPLES) expect(screen.queryByText(nom)).toBeNull()
    expect(clesCatalogue()).toEqual([])
    expect(h.insertions).toHaveLength(0)
  })

  it('la première prestation saisie est enregistrée et publiée une seule fois', async () => {
    h.publication = 'acceptee'
    monterModule()
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter' }))
    fireEvent.change(screen.getByPlaceholderText('Ex: Dalle béton'), { target: { value: 'Chape liquide' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(await screen.findByText('Chape liquide')).toBeInTheDocument()
    await waitFor(() => expect(h.insertions).toHaveLength(1))
    await attendre(50)
    expect(h.insertions).toHaveLength(1)
    expect(h.insertions[0]).toMatchObject({ artisan_id: FICHE.id, name: 'Chape liquide' })
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CLE_MODULE) || '[]')).toEqual([
      expect.objectContaining({ name: 'Chape liquide', type: 'prest', supabase_id: 'svc-1' }),
    ]))
  })
})

describe('module Prestations BTP — compte existant', () => {
  it('le catalogue enregistré (ancien exemple compris) s\'affiche et reste tel quel', async () => {
    localStorage.setItem(CLE_MODULE, CATALOGUE_EXISTANT)
    monterModule()
    expect(await screen.findByText('Démolition cloisons + évacuation gravats')).toBeInTheDocument()
    expect(screen.getByText('Dalle maison')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Matériaux/ }))
    expect(screen.getByText('Enduit monocouche 25 kg')).toBeInTheDocument()
    await attendre(30)
    expect(localStorage.getItem(CLE_MODULE)).toBe(CATALOGUE_EXISTANT)
    expect(clesCatalogue()).toEqual([CLE_MODULE])
  })
})

describe('formulaire de devis BTP — listes du catalogue', () => {
  it('compte neuf : aucune prestation ni aucun matériau d\'exemple proposé, aucun catalogue écrit', () => {
    monterFormulaire()
    expect(ouvrirListe(PRESTATION)).toEqual([])
    expect(ouvrirListe(MATERIAU)).toEqual(['Aucun matériau dans le catalogue'])
    expect(clesCatalogue()).toEqual([])
  })

  it('compte existant : le catalogue déjà enregistré reste proposé, sans être réécrit', () => {
    localStorage.setItem(CLE_ANCIENNE, CATALOGUE_EXISTANT)
    monterFormulaire()
    expect(ouvrirListe(PRESTATION).map(nomPropose)).toEqual(['Démolition cloisons + évacuation gravats', 'Dalle maison'])
    expect(ouvrirListe(MATERIAU).map(nomPropose)).toEqual(['Enduit monocouche 25 kg'])
    expect(localStorage.getItem(CLE_ANCIENNE)).toBe(CATALOGUE_EXISTANT)
    expect(clesCatalogue()).toEqual([CLE_ANCIENNE])
  })
})
