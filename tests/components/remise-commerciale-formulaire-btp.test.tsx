// Remise commerciale dans le vrai formulaire BTP (components/DevisFactureFormBTP.tsx) : colonne Remise
// et totaux remisés en français ; en portugais (hors lot), saisie masquée mais remise d'un document
// existant conservée, appliquée et réenregistrée telle quelle par la sauvegarde automatique.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'

const h = vi.hoisted(() => ({ locale: 'fr' as 'fr' | 'pt' }))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: h.locale }),
  useLocale: () => h.locale,
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock('@/lib/fetch-authentifie', () => ({ fetchAuthentifie: vi.fn().mockResolvedValue(new Response('[]', { status: 200 })) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'tid'), dismiss: vi.fn() } }))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))

import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'

const ARTISAN: ArtisanBasic = { id: 'art-btp-remise', company_name: 'BATIR TEST SAS', email: 'contact@batir.test' }

// Brouillon de devis : 2 × 1 500 € à 20 % remisés de 10 % (2 700 €), remise globale de 10 % (2 430 € HT).
const BROUILLON = {
  id: '6f1c2a34-0000-4000-8000-00000000e001', docType: 'devis', docNumber: '', status: 'brouillon',
  docTitle: 'Ravalement', clientName: 'SCI Test', savedAt: '2026-11-13T10:00:00.000Z',
  lines: [{ id: 1, description: 'Ravalement de façade', qty: 2, unit: 'u', priceHT: 1500, tvaRate: 20, totalHT: 2700, remise: { type: 'pourcentage', valeur: 10 } }],
  materialLines: [], fraisLines: [],
  remiseGlobale: { type: 'pourcentage', valeur: 10 },
}

const monter = () => render(
  <DevisFactureFormBTP artisan={ARTISAN} services={[]} bookings={[]} onBack={vi.fn()} initialData={BROUILLON as never} />,
)
const resume = () => (screen.getByText('RÉSUMÉ').closest('.dv-sidebar-card') as HTMLElement).textContent || ''
const sansEspaces = (s: string) => s.replace(/\s/g, '')

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  h.locale = 'fr'
})

describe('formulaire BTP — remise commerciale', () => {
  it('français : colonne Remise, total de ligne remisé en lecture seule, remise globale au résumé', () => {
    monter()
    expect(screen.getAllByText('REMISE').length).toBeGreaterThan(0)
    // Ligne remisée : total HT calculé (2 × 1 500 − 10 %), affiché sans champ de saisie.
    const cellule = screen.getAllByTitle('Total après remise')[0]
    expect(cellule.tagName).toBe('TD')
    expect(cellule.textContent).toBe('2700,00')
    expect(screen.getByLabelText('Unité de la remise commerciale')).toBeTruthy()
    const texte = sansEspaces(resume())
    expect(texte).toContain('Sous-totalbrut2700,00€')
    expect(texte).toContain('Remisecommerciale(10%)-270,00€')
    expect(texte).toContain('TotalHT2430,00€')
  })

  it('facture de solde : 170 € TTC tapés touche par touche, déduction ajoutée à la main hors de la base', () => {
    // Travaux 1 000 € à 20 % et 1 000 € à 10 %, déduction de 500 € à 20 % sans marque horsRemise
    // (ajoutée à la main) : 1 700 € TTC sans remise, 1 530 € avec 170 € TTC de remise sur les travaux.
    const SOLDE = {
      id: '6f1c2a34-0000-4000-8000-00000000e002', docType: 'facture', docNumber: '', status: 'brouillon',
      docTitle: 'Ravalement', clientName: 'SCI Test', savedAt: '2026-11-13T10:00:00.000Z', regimeTva: 'classique', tvaEnabled: true,
      lines: [
        { id: 1, description: 'Ravalement', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 20, totalHT: 1000 },
        { id: 2, description: 'Échafaudage', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 10, totalHT: 1000 },
      ],
      materialLines: [], fraisLines: [],
      customTables: [{ id: 'acomptes-deduits', name: 'Acomptes déjà facturés (à déduire)', lines: [
        { id: 3, description: 'Acompte versé', qty: 1, unit: 'u', priceHT: -500, tvaRate: 20, totalHT: -500 },
      ] }],
    }
    render(<DevisFactureFormBTP artisan={ARTISAN} services={[]} bookings={[]} onBack={vi.fn()} initialData={SOLDE as never} />)
    expect(sansEspaces(resume())).toContain('TOTALTTC1700,00€')
    const unite = screen.getByLabelText('Unité de la remise commerciale') as HTMLSelectElement
    const champ = screen.getByTitle('Remise commerciale sur le total') as HTMLInputElement
    fireEvent.change(unite, { target: { value: 'ttc' } })
    fireEvent.focus(champ)
    for (const frappe of ['1', '17', '170']) fireEvent.change(champ, { target: { value: frappe } })
    expect(unite.value).toBe('ttc')
    expect(sansEspaces(resume())).toContain('TOTALTTC1530,00€')
  })

  it('portugais : saisie masquée, remise du document appliquée et conservée à l enregistrement', async () => {
    h.locale = 'pt'
    monter()
    expect(screen.queryByText('REMISE')).toBeNull()
    expect(screen.queryByLabelText('Unité de la remise commerciale')).toBeNull()
    expect(sansEspaces(resume())).toContain('TotalHT2430,00€')
    // Sauvegarde automatique (1,5 s après l'ouverture) : la remise n'est pas effacée.
    await waitFor(() => {
      const brouillons = JSON.parse(localStorage.getItem(`fixit_drafts_${ARTISAN.id}`) || '[]') as Array<Record<string, unknown>>
      expect(brouillons[0]?.remiseGlobale).toEqual({ type: 'pourcentage', valeur: 10 })
      expect((brouillons[0]?.lines as Array<Record<string, unknown>>)[0].remise).toEqual({ type: 'pourcentage', valeur: 10 })
    }, { timeout: 5000 })
  })
})
