// Formulaire de devis et facture BTP (components/DevisFactureFormBTP.tsx) : les prestations, les matériaux et les
// étapes proposés viennent du catalogue que la société tient dans le module Prestations
// (`fixit_prestations_btp_v5_<fiche>`). Constat stockage-local-miroir-10 de l'audit du 11/11/2026 : le formulaire
// lisait une ancienne copie (`fixit_prestations_btp_v4_<fiche>`), qu'il remplissait lui-même du jeu par défaut ;
// matériaux et prix de la société absents, prestations supprimées toujours proposées. L'ancienne copie reste lue
// quand le module n'a encore rien enregistré ; le formulaire n'écrit plus aucun catalogue. Rien d'enregistré : aucun
// catalogue proposé, jamais d'exemple (catalogue vierge à la création du compte depuis le 17/11/2026).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ArtisanBasic, ServiceBasic } from '@/lib/devis-types'
import { CHAMP_MATERIAU, CHAMP_PRESTATION, nomPropose, ouvrirListe } from '../helpers/listes-catalogue-devis-btp'

vi.mock('@/lib/i18n/context', async () => (await import('../helpers/mocks-formulaires-devis')).traductions())
vi.mock('@/lib/supabase', async () => (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur())
vi.mock('@/lib/fetch-authentifie', async () => (await import('../helpers/mocks-formulaires-devis')).fetchAuthentifieVide())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))

import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'

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

const monter = (services: ServiceBasic[] = []) =>
  render(<DevisFactureFormBTP artisan={ARTISAN} services={services} bookings={[]} onBack={vi.fn()} />)

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
  it('propose les matériaux du module, et eux seuls', () => {
    localStorage.setItem(CLE_MODULE, JSON.stringify(CATALOGUE_MODULE))
    monter()
    const proposes = ouvrirListe(CHAMP_MATERIAU).map(nomPropose)
    expect(proposes).toEqual(['Béton maison'])
  })

  it('propose les prestations du module : celles qu\'elle a supprimées n\'y sont plus', () => {
    localStorage.setItem(CLE_MODULE, JSON.stringify(CATALOGUE_MODULE))
    monter()
    const proposes = ouvrirListe(CHAMP_PRESTATION).map(nomPropose)
    expect(proposes).toEqual(['Ravalement maison'])
  })

  it('les étapes reprises sont celles de la prestation choisie, dans le même catalogue', async () => {
    localStorage.setItem(CLE_MODULE, JSON.stringify(CATALOGUE_MODULE))
    // Ancienne copie au même identifiant 31 : ses étapes ne doivent pas être reprises.
    localStorage.setItem(CLE_ANCIENNE, JSON.stringify([{ id: 31, name: 'Autre prestation', type: 'prest', lot: 'gros_oeuvre', unit: 'u', price: prix(10), etapes: [{ label: 'Étape étrangère' }] }]))
    monter()
    const champ = screen.getByPlaceholderText(CHAMP_PRESTATION)
    fireEvent.click(champ.nextElementSibling as HTMLElement)
    fireEvent.click(screen.getByText(/^Ravalement maison/))
    expect(await screen.findByDisplayValue('Échafaudage de façade')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Lavage et enduit')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Étape étrangère')).not.toBeInTheDocument()
  })

  it('n\'écrit aucun catalogue dans le navigateur', () => {
    localStorage.setItem(CLE_MODULE, JSON.stringify(CATALOGUE_MODULE))
    monter()
    ouvrirListe(CHAMP_MATERIAU)
    expect(localStorage.getItem(CLE_ANCIENNE)).toBeNull()
    expect(JSON.parse(localStorage.getItem(CLE_MODULE)!)).toEqual(CATALOGUE_MODULE)
  })
})

describe('formulaire BTP — module encore jamais enregistré', () => {
  it('l\'ancienne copie reste lue', () => {
    localStorage.setItem(CLE_ANCIENNE, JSON.stringify([{ id: 1, name: 'Ancien matériau', type: 'mat', lot: 'gros_oeuvre', unit: 'u', price: prix(5) }]))
    monter()
    expect(ouvrirListe(CHAMP_MATERIAU).map(nomPropose)).toEqual(['Ancien matériau'])
  })

  it('rien d\'enregistré : aucune prestation ni aucun matériau de catalogue, jamais d\'exemple ; les prestations publiées de la fiche restent proposées, rien n\'est écrit', () => {
    monter([{ id: 'svc-publie', name: 'Dalle publiée', price_ht: 50 }])
    expect(ouvrirListe(CHAMP_PRESTATION).map(nomPropose)).toEqual(['Dalle publiée'])
    expect(ouvrirListe(CHAMP_MATERIAU)).toEqual(['Aucun matériau dans le catalogue'])
    expect(localStorage.getItem(CLE_ANCIENNE)).toBeNull()
    expect(localStorage.getItem(CLE_MODULE)).toBeNull()
  })
})
