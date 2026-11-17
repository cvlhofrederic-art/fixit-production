// tests/components/prestations-btp-catalogue-vierge.test.tsx
//
// Catalogue Prestations du BTP (pro_societe) vierge à la création du compte, en France comme au Portugal (demande
// de Frédéric du 17/11/2026). Jusque-là, le module Prestations (components/dashboard/PrestationsBTPSection.tsx)
// écrivait 31 prestations et 9 matériaux d'exemple, en français, dès sa première ouverture
// (`fixit_prestations_btp_v5_<fiche>`), et le formulaire de devis et facture BTP (components/DevisFactureFormBTP.tsx)
// en écrivait autant dans son ancienne copie (`fixit_prestations_btp_v4_<fiche>`), la seule qu'il lisait : le
// catalogue saisi dans le module n'y était jamais proposé. Désormais :
//   - compte neuf : catalogue vide dans le module (FR et PT : chaque corps d'état, matériaux, frais divers) et dans
//     les listes du formulaire ; rien n'est écrit ni publié ;
//   - le formulaire propose le catalogue saisi dans le module (à défaut l'ancienne copie), étapes comprises, lu une
//     seule fois : la prestation choisie garde ses étapes même si le catalogue change après l'ouverture ;
//   - compte existant : le catalogue enregistré (ancien catalogue d'exemple compris) s'affiche et reste tel quel ;
//   - la première prestation saisie dans un catalogue parti vide est enregistrée et publiée une seule fois.
// La sauvegarde en ligne du compte (GET /api/user-storage) est simulée sans catalogue : un module qui la consulte
// avant de remplir un catalogue absent ne doit rien y ajouter non plus.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { Artisan } from '@/lib/types'
import type { ArtisanBasic } from '@/lib/devis-types'
import { CHAMP_MATERIAU, CHAMP_PRESTATION, nomPropose, ouvrirListe } from '../helpers/listes-catalogue-devis-btp'

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
vi.mock('@/lib/auth/jeton-acces', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/jeton-acces')>()),
  jetonAcces: async () => 'jeton-test',
  lireJetonAcces: async () => ({ jeton: 'jeton-test', indisponible: false }),
}))
vi.mock('@/lib/fetch-authentifie', () => ({ fetchAuthentifie: vi.fn(async () => new Response('[]', { status: 200 })) }))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn(), loading: vi.fn(() => 'tid'), dismiss: vi.fn() }),
}))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))

import PrestationsBTPSection from '@/components/dashboard/PrestationsBTPSection'
import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'
import { toast } from 'sonner'

const FICHE = { id: 'fiche-btp-vierge', user_id: 'compte-btp-vierge', company_name: 'BATIR TEST SAS' } as unknown as Artisan
const FICHE_DEVIS: ArtisanBasic = { id: 'fiche-btp-vierge', company_name: 'BATIR TEST SAS', email: 'contact@batir.test' }
const CLE_MODULE = `fixit_prestations_btp_v5_${FICHE.id}`
const CLE_ANCIENNE = `fixit_prestations_btp_v4_${FICHE.id}`

// Corps d'état proposés à une société généraliste (aucun mot-clé reconnu dans sa fiche) : tous.
const CORPS_D_ETAT = ['Gros Œuvre', 'Couverture', 'Plomberie / CVC', 'Électricité', 'Menuiseries', 'Peinture / Revêtements']
// Les mêmes lots affichés en portugais (libellés de l'interface PT ; la clé enregistrée du lot ne change pas).
const CORPS_D_ETAT_PT = ['Estrutura e alvenaria', 'Cobertura', 'Canalização / AVAC', 'Eletricidade', 'Carpintaria e caixilharia', 'Pintura / Revestimentos']
// Quelques noms de l'ancien catalogue d'exemple (retiré du code le 17/11/2026) : prestations de plusieurs corps
// d'état, puis matériaux.
const ANCIENS_EXEMPLES = [
  'Démolition cloisons + évacuation gravats', 'Dalle béton', 'Charpente + couverture tuiles', 'Plomberie SDB + cuisine',
  'Peinture 2 couches intérieure', "Main d'œuvre qualifiée", 'Enduit monocouche 25 kg', "Béton prêt à l'emploi C25/30",
]
// Catalogue d'un compte existant : deux éléments de l'ancien exemple, gardés, et une prestation à lui.
const CATALOGUE_EXISTANT = JSON.stringify([
  { id: 1, name: 'Démolition cloisons + évacuation gravats', type: 'prest', lot: 'gros_oeuvre', unit: 'forfait', price: { min: 2500, max: 4000 } },
  { id: 30, name: 'Enduit monocouche 25 kg', type: 'mat', lot: 'gros_oeuvre', unit: 'sac', price: { min: 22, max: 26 }, priceAchat: { min: 15.5, max: 15.5 } },
  { id: 40, name: 'Dalle maison', type: 'prest', lot: 'gros_oeuvre', unit: 'm²', price: { min: 70, max: 70 }, supabase_id: 'svc-existant' },
])
// Catalogue saisi dans le module par la société : une prestation avec ses étapes et un matériau.
const CATALOGUE_MODULE = JSON.stringify([
  { id: 31, name: 'Ravalement maison', type: 'prest', lot: 'peinture', unit: 'm²', price: { min: 48, max: 48 }, description: 'Ravalement complet',
    etapes: [{ label: 'Échafaudage de façade', price: 12, unit: 'm²' }, { label: 'Lavage et enduit', price: 36, unit: 'm²' }] },
  { id: 32, name: 'Béton maison', type: 'mat', lot: 'gros_oeuvre', unit: 'm³', price: { min: 99, max: 99 }, priceAchat: { min: 80, max: 80 } },
])

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))
/**
 * Laisse aboutir le chargement du module : les lectures de la sauvegarde en ligne qu'il a lancées (fetch simulé),
 * puis les rendus qui en découlent. Aucune durée fixe : un module qui consulte le serveur est attendu jusqu'au bout.
 */
async function attendreChargement() {
  await attendre(0)
  await Promise.allSettled(vi.mocked(fetch).mock.results.map((r) => r.value))
  await attendre(0)
}
/** Clés de catalogue BTP présentes dans le navigateur. */
function clesCatalogue(): string[] {
  const cles: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const cle = localStorage.key(i)
    if (cle?.startsWith('fixit_prestations_btp_')) cles.push(cle)
  }
  return cles.sort((a, b) => a.localeCompare(b))
}

const monterModule = () => render(<PrestationsBTPSection artisan={FICHE} orgRole="pro_societe" />)
const monterFormulaire = () => render(<DevisFactureFormBTP artisan={FICHE_DEVIS} services={[]} bookings={[]} onBack={vi.fn()} />)

/** Chaque corps d'état, puis Matériaux et Frais divers : chaque liste du module est vide. */
function verifierModuleVide(textes: { corps?: readonly string[]; prestations: string; materiaux: [RegExp, string]; frais: [RegExp, string] }) {
  for (const corps of textes.corps ?? CORPS_D_ETAT) {
    fireEvent.click(screen.getByRole('button', { name: corps }))
    expect(screen.getByText(textes.prestations)).toBeInTheDocument()
  }
  fireEvent.click(screen.getByRole('button', { name: textes.materiaux[0] }))
  expect(screen.getByText(textes.materiaux[1])).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: textes.frais[0] }))
  expect(screen.getByText(textes.frais[1])).toBeInTheDocument()
  for (const nom of ANCIENS_EXEMPLES) expect(screen.queryByText(nom)).toBeNull()
}

beforeEach(() => {
  localStorage.clear()
  h.locale = 'fr'
  h.publication = 'refusee'
  h.insertions = []
  vi.mocked(toast.error).mockClear()
  // Sauvegarde en ligne du compte : aucun catalogue (compte neuf).
  vi.stubGlobal('fetch', vi.fn(async (url: unknown) => (String(url).startsWith('/api/user-storage')
    ? new Response(JSON.stringify({ entries: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    : new Response('{}', { status: 404 }))))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('module Prestations BTP — compte neuf', () => {
  it('France : ni prestation, ni matériau, ni frais d\'exemple ; rien n\'est écrit ni publié', async () => {
    monterModule()
    await attendreChargement()
    verifierModuleVide({
      prestations: 'Aucune prestation dans ce lot.',
      materiaux: [/Matériaux/, 'Aucun matériau référencé.'],
      frais: [/Frais divers/, 'Aucun frais divers enregistré.'],
    })
    expect(clesCatalogue()).toEqual([])
    expect(h.insertions).toHaveLength(0)
    // Un module en échec de chargement afficherait aussi des listes vides : il le signalerait par un message.
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('Portugal : ni prestação, ni material, ni despesa d\'exemple ; rien n\'est écrit ni publié', async () => {
    h.locale = 'pt'
    monterModule()
    await attendreChargement()
    verifierModuleVide({
      corps: CORPS_D_ETAT_PT,
      prestations: 'Nenhum serviço neste lote.',
      materiaux: [/Materiais/, 'Nenhum material referenciado.'],
      frais: [/Despesas diversas/, 'Nenhuma despesa registada.'],
    })
    expect(clesCatalogue()).toEqual([])
    expect(h.insertions).toHaveLength(0)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('la première prestation saisie est enregistrée et publiée une seule fois', async () => {
    h.publication = 'acceptee'
    monterModule()
    await attendreChargement()
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
    expect(toast.error).not.toHaveBeenCalled()
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
    expect(ouvrirListe(CHAMP_PRESTATION)).toEqual([])
    expect(ouvrirListe(CHAMP_MATERIAU)).toEqual(['Aucun matériau dans le catalogue'])
    expect(clesCatalogue()).toEqual([])
  })

  it('propose le catalogue saisi dans le module, avant l\'ancienne copie, sans rien réécrire', () => {
    localStorage.setItem(CLE_MODULE, CATALOGUE_MODULE)
    localStorage.setItem(CLE_ANCIENNE, CATALOGUE_EXISTANT)
    monterFormulaire()
    expect(ouvrirListe(CHAMP_PRESTATION).map(nomPropose)).toEqual(['Ravalement maison'])
    expect(ouvrirListe(CHAMP_MATERIAU).map(nomPropose)).toEqual(['Béton maison'])
    expect(localStorage.getItem(CLE_MODULE)).toBe(CATALOGUE_MODULE)
    expect(localStorage.getItem(CLE_ANCIENNE)).toBe(CATALOGUE_EXISTANT)
  })

  it('la prestation choisie apporte ses propres étapes, prises dans le même catalogue', async () => {
    localStorage.setItem(CLE_MODULE, CATALOGUE_MODULE)
    // Ancienne copie au même identifiant 31 : ses étapes ne doivent pas être reprises.
    localStorage.setItem(CLE_ANCIENNE, JSON.stringify([
      { id: 31, name: 'Autre prestation', type: 'prest', lot: 'gros_oeuvre', unit: 'u', price: { min: 10, max: 10 }, etapes: [{ label: 'Étape étrangère' }] },
    ]))
    monterFormulaire()
    const champ = screen.getByPlaceholderText(CHAMP_PRESTATION)
    fireEvent.click(champ.nextElementSibling as HTMLElement)
    fireEvent.click(screen.getByText(/^Ravalement maison/))
    expect(await screen.findByDisplayValue('Échafaudage de façade')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Lavage et enduit')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Étape étrangère')).toBeNull()
  })

  it('catalogue changé après l\'ouverture : la prestation choisie garde ses étapes, pas celles d\'une autre', async () => {
    localStorage.setItem(CLE_ANCIENNE, JSON.stringify([
      { id: 31, name: 'Autre prestation', type: 'prest', lot: 'gros_oeuvre', unit: 'u', price: { min: 10, max: 10 }, etapes: [{ label: 'Étape étrangère' }] },
    ]))
    monterFormulaire()
    // Catalogue du module recopié après l'ouverture (restauration tardive, autre onglet), au même identifiant 31.
    localStorage.setItem(CLE_MODULE, CATALOGUE_MODULE)
    const champ = screen.getByPlaceholderText(CHAMP_PRESTATION)
    fireEvent.click(champ.nextElementSibling as HTMLElement)
    fireEvent.click(screen.getByText(/^Autre prestation/))
    expect(await screen.findByDisplayValue('Étape étrangère')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Échafaudage de façade')).toBeNull()
    expect(screen.queryByDisplayValue('Ravalement complet')).toBeNull()
  })

  it('compte existant sans catalogue du module : l\'ancienne copie reste proposée, sans être réécrite', () => {
    localStorage.setItem(CLE_ANCIENNE, CATALOGUE_EXISTANT)
    monterFormulaire()
    expect(ouvrirListe(CHAMP_PRESTATION).map(nomPropose)).toEqual(['Démolition cloisons + évacuation gravats', 'Dalle maison'])
    expect(ouvrirListe(CHAMP_MATERIAU).map(nomPropose)).toEqual(['Enduit monocouche 25 kg'])
    expect(localStorage.getItem(CLE_ANCIENNE)).toBe(CATALOGUE_EXISTANT)
    expect(clesCatalogue()).toEqual([CLE_ANCIENNE])
  })
})
