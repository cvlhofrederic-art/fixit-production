// Formulaire de devis et facture BTP (components/DevisFactureFormBTP.tsx) : les prestations, les matériaux et les
// étapes proposés viennent du catalogue que la société tient dans le module Prestations
// (`fixit_prestations_btp_v5_<fiche>`). Constat stockage-local-miroir-10 de l'audit du 11/11/2026 : le formulaire
// lisait une ancienne copie (`fixit_prestations_btp_v4_<fiche>`), qu'il remplissait lui-même du jeu par défaut ;
// matériaux et prix de la société absents, prestations supprimées toujours proposées. L'ancienne copie reste lue
// quand le module n'a encore rien enregistré ; le formulaire n'écrit plus aucun catalogue.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'

vi.mock('@/lib/i18n/context', async () => (await import('../helpers/mocks-formulaires-devis')).traductions())
vi.mock('@/lib/supabase', async () => (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur())
vi.mock('@/lib/fetch-authentifie', async () => (await import('../helpers/mocks-formulaires-devis')).fetchAuthentifieVide())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))

import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'
import { SEED_PREST, SEED_MAT } from '@/components/dashboard/PrestationsBTPSection'

const ARTISAN: ArtisanBasic = { id: 'fiche-btp-catalogue', company_name: 'BATIR TEST SAS', email: 'contact@batir.test' }
const CLE_MODULE = `fixit_prestations_btp_v5_${ARTISAN.id}`
const CLE_ANCIENNE = `fixit_prestations_btp_v4_${ARTISAN.id}`

const prix = (n: number) => ({ min: n, max: n })
// Catalogue de la société : prestations par défaut supprimées, une prestation et un matériau à elle.
const CATALOGUE_MODULE = [
  { id: 31, name: 'Ravalement maison', type: 'prest', lot: 'peinture', unit: 'm²', price: prix(48), description: 'Ravalement complet',
    etapes: [{ label: 'Échafaudage de façade', price: 12, unit: 'm²' }, { label: 'Lavage et enduit', price: 36, unit: 'm²' }] },
  { id: 32, name: 'Béton maison', type: 'mat', lot: 'gros_oeuvre', unit: 'm³', price: prix(99), priceAchat: prix(80) },
]

const monter = () => render(<DevisFactureFormBTP artisan={ARTISAN} services={[]} bookings={[]} onBack={vi.fn()} />)

/** Ouvre la liste déroulante attachée au champ (bouton ▾ voisin) et rend les libellés proposés. */
function ouvrirListe(placeholder: string): string[] {
  const champ = screen.getByPlaceholderText(placeholder)
  fireEvent.click(champ.nextElementSibling as HTMLElement)
  const liste = champ.parentElement!.querySelector('div') as HTMLElement
  return Array.from(liste.children).map((n) => n.textContent || '')
}
const PRESTATION = 'Saisissez ou sélectionnez une prestation…'
const MATERIAU = 'Saisissez ou sélectionnez un matériau…'
/** Libellé proposé sans son prix (« Nom — 12,00 € » ; un nom peut lui-même contenir « — »). */
const nomPropose = (libelle: string) => {
  const fin = libelle.lastIndexOf(' — ')
  return fin < 0 ? libelle : libelle.slice(0, fin)
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('formulaire BTP — catalogue du module Prestations', () => {
  it('propose les matériaux du module, pas ceux du jeu par défaut', () => {
    localStorage.setItem(CLE_MODULE, JSON.stringify(CATALOGUE_MODULE))
    monter()
    const proposes = ouvrirListe(MATERIAU).map(nomPropose)
    expect(proposes).toEqual(['Béton maison'])
  })

  it('propose les prestations du module : celles qu\'elle a supprimées n\'y sont plus', () => {
    localStorage.setItem(CLE_MODULE, JSON.stringify(CATALOGUE_MODULE))
    monter()
    const proposes = ouvrirListe(PRESTATION).map(nomPropose)
    expect(proposes).toEqual(['Ravalement maison'])
  })

  it('les étapes reprises sont celles de la prestation choisie, dans le même catalogue', async () => {
    localStorage.setItem(CLE_MODULE, JSON.stringify(CATALOGUE_MODULE))
    // Ancienne copie au même identifiant 31 : ses étapes ne doivent pas être reprises.
    localStorage.setItem(CLE_ANCIENNE, JSON.stringify([{ id: 31, name: 'Autre prestation', type: 'prest', lot: 'gros_oeuvre', unit: 'u', price: prix(10), etapes: [{ label: 'Étape étrangère' }] }]))
    monter()
    const champ = screen.getByPlaceholderText(PRESTATION)
    fireEvent.click(champ.nextElementSibling as HTMLElement)
    fireEvent.click(screen.getByText(/^Ravalement maison/))
    expect(await screen.findByDisplayValue('Échafaudage de façade')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Lavage et enduit')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Étape étrangère')).not.toBeInTheDocument()
  })

  it('n\'écrit aucun catalogue dans le navigateur', () => {
    localStorage.setItem(CLE_MODULE, JSON.stringify(CATALOGUE_MODULE))
    monter()
    ouvrirListe(MATERIAU)
    expect(localStorage.getItem(CLE_ANCIENNE)).toBeNull()
    expect(JSON.parse(localStorage.getItem(CLE_MODULE)!)).toEqual(CATALOGUE_MODULE)
  })
})

describe('formulaire BTP — module encore jamais enregistré', () => {
  it('l\'ancienne copie reste lue', () => {
    localStorage.setItem(CLE_ANCIENNE, JSON.stringify([{ id: 1, name: 'Ancien matériau', type: 'mat', lot: 'gros_oeuvre', unit: 'u', price: prix(5) }]))
    monter()
    expect(ouvrirListe(MATERIAU).map(nomPropose)).toEqual(['Ancien matériau'])
  })

  it('rien d\'enregistré : le jeu par défaut est proposé, étapes comprises, sans rien écrire', async () => {
    monter()
    expect(ouvrirListe(MATERIAU).map(nomPropose)).toEqual(SEED_MAT.map((m) => m.name))
    const champ = screen.getByPlaceholderText(PRESTATION)
    fireEvent.click(champ.nextElementSibling as HTMLElement)
    const premiere = SEED_PREST[0]
    fireEvent.click(screen.getByText(new RegExp(`^${premiere.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)))
    const premiereEtape = typeof premiere.etapes![0] === 'string' ? premiere.etapes![0] : premiere.etapes![0].label
    await waitFor(() => expect(screen.getByDisplayValue(premiereEtape)).toBeInTheDocument())
    expect(localStorage.getItem(CLE_ANCIENNE)).toBeNull()
    expect(localStorage.getItem(CLE_MODULE)).toBeNull()
  })
})
