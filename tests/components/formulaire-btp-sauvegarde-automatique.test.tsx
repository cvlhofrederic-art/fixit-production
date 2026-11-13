// Sauvegarde automatique du vrai formulaire BTP (components/DevisFactureFormBTP.tsx) : toute saisie
// enregistrée la déclenche — tables personnalisées et notes comprises (avant : client, lignes,
// matériaux, frais, titre, sous-type et remise seulement ; le reste était perdu si l'utilisateur
// quittait sans « Enregistrer »). Un document émis n'est jamais réenregistré automatiquement.
// Colonne TVA des tableaux de lignes à 12 % (accord de Frédéric du 13/11/2026).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'

vi.mock('@/lib/i18n/context', async () => (await import('../helpers/mocks-formulaires-devis')).traductions())
vi.mock('@/lib/supabase', async () => (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur())
vi.mock('@/lib/fetch-authentifie', async () => (await import('../helpers/mocks-formulaires-devis')).fetchAuthentifieVide())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))

import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'

const ARTISAN: ArtisanBasic = { id: 'art-btp-autosave', company_name: 'BATIR TEST SAS', email: 'contact@batir.test' }
const CLE_BROUILLONS = `fixit_drafts_${ARTISAN.id}`

const BROUILLON = {
  id: '6f1c2a34-0000-4000-8000-00000000d001', docType: 'devis', docNumber: '', status: 'brouillon',
  docTitle: 'Ravalement', clientName: 'SCI Test', savedAt: '2026-11-13T10:00:00.000Z',
  lines: [{ id: 1, description: 'Ravalement de façade', qty: 1, unit: 'f', priceHT: 2000, tvaRate: 20, totalHT: 2000 }],
  materialLines: [], fraisLines: [],
  customTables: [{ id: 'ct1', name: 'ISOLATION', category: 'labor', lines: [{ id: 7, description: 'Isolant façade', qty: 1, unit: 'u', priceHT: 500, tvaRate: 5.5, totalHT: 500 }] }],
  notes: '',
}

const brouillons = () => JSON.parse(localStorage.getItem(CLE_BROUILLONS) || '[]') as Array<Record<string, unknown>>
const monter = (initialData: unknown) => render(
  <DevisFactureFormBTP artisan={ARTISAN} services={[]} bookings={[]} onBack={vi.fn()} initialData={initialData as never} />,
)

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('formulaire BTP — sauvegarde automatique', () => {
  it('une ligne de table personnalisée modifiée est enregistrée sans clic', async () => {
    monter(BROUILLON)
    await waitFor(() => expect(brouillons()).toHaveLength(1), { timeout: 5000 })
    fireEvent.change(screen.getByDisplayValue('Isolant façade'), { target: { value: 'Isolant fibre de bois' } })
    await waitFor(() => {
      const tables = brouillons()[0].customTables as Array<{ lines: Array<{ description: string }> }>
      expect(tables[0].lines[0].description).toBe('Isolant fibre de bois')
    }, { timeout: 5000 })
  })

  it('les notes aussi', async () => {
    monter(BROUILLON)
    await waitFor(() => expect(brouillons()).toHaveLength(1), { timeout: 5000 })
    fireEvent.change(screen.getByPlaceholderText(/Notes optionnelles visibles par le client/), { target: { value: 'Accès par la cour' } })
    await waitFor(() => expect(brouillons()[0].notes).toBe('Accès par la cour'), { timeout: 5000 })
  })

  it('colonne TVA à 12 % (taux lisible), 4 points pris sur la désignation', () => {
    const { container } = monter(BROUILLON)
    const largeurs = (table: Element) => Array.from(table.querySelectorAll('colgroup col')).map((c) => (c as HTMLElement).style.width)
    const tables = Array.from(container.querySelectorAll('table.dv-presta-table'))
    // Tableaux fixes (main-d'œuvre, matériaux, frais) puis table personnalisée.
    expect(largeurs(tables[0])).toEqual(['20%', '7%', '9%', '11%', '11%', '12%', '13%', '13%', '4%'])
    expect(largeurs(tables.at(-1)!)).toEqual(['18%', '7%', '9%', '11%', '11%', '12%', '13%', '13%', '6%'])
  })

  it('document émis : jamais réenregistré automatiquement', async () => {
    monter({ ...BROUILLON, status: 'envoye', docNumber: 'DEV-2026-120' })
    fireEvent.change(screen.getByDisplayValue('Isolant façade'), { target: { value: 'Isolant modifié' } })
    await new Promise((r) => setTimeout(r, 2000))
    expect(brouillons()).toHaveLength(0)
    expect(localStorage.getItem(`fixit_documents_${ARTISAN.id}`)).toBeNull()
  })
})
