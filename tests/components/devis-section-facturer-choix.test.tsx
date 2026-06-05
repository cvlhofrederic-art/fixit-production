// tests/components/devis-section-facturer-choix.test.tsx
//
// « Facturer » côté DEVIS (méthode pro 2026) : ouvre un choix
//   « Facture totale » (conversion directe existante) ou « Facture d'acompte »
//   (lit l'échéancier du devis / % choisi → émet direct une facture d'acompte
//   reliée au devis). BTP uniquement (orgRole === 'pro_societe').

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'fr' }),
  useLocale: () => 'fr',
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock('@/components/dashboard/useThemeVars', () => ({
  useThemeVars: () => ({
    bg: '#fff', surface: '#fff', surfaceAlt: '#f5f5f5', border: '#e5e5e5',
    text: '#000', textMuted: '#666', accent: '#000', accentText: '#fff',
    red: '#dc2626', green: '#16a34a',
  }),
}))
vi.mock('@/lib/hooks/useOrgRoleContext', () => ({
  useOrgRoleContext: () => ({ orgRole: 'pro_societe', isV5: true, useBtpDesign: true }),
}))
vi.mock('@/components/DevisFactureForm', () => ({ default: () => null }))
vi.mock('@/components/DevisFactureFormBTP', () => ({ default: () => null }))
vi.mock('@/components/DocumentCancelModal', () => ({ default: () => null }))
vi.mock('@/components/ConfirmDraftDeleteDialog', () => ({ default: () => null }))
vi.mock('@/lib/pdf/download-saved-devis', () => ({ downloadSavedDevis: vi.fn() }))
vi.mock('@/components/dashboard/useDocumentCancel', () => ({
  useDocumentCancel: () => ({ cancellingDoc: null, setCancellingDoc: vi.fn(), handleRemoveDoc: vi.fn(), handleCancelled: vi.fn() }),
  isDocDraftStatus: () => false,
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'tid') } }))
vi.mock('@/lib/doc-number', () => ({
  fetchNextDocNumber: vi.fn().mockResolvedValue('AC-2026-020'),
  localFallbackDocNumber: vi.fn(() => 'AC-2026-020'),
}))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))

import DevisSection from '@/components/dashboard/DevisSection'
import { computeDocumentTotalHT } from '@/lib/devis-totals'

const ARTISAN = {
  id: 'art-1', user_id: 'u-1', company_name: 'SUD TRAVAUX', email: 's@test.fr', phone: '', bio: '',
} as Parameters<typeof DevisSection>[0]['artisan']

const DEVIS = {
  id: 'dev-1', docNumber: 'DEV-2026-009', docType: 'devis', status: 'accepte',
  clientName: 'A & W SAS', docTitle: 'Rénovation appartement',
  regimeTva: 'classique', tvaEnabled: true,
  acomptesEnabled: true,
  acomptes: [
    { id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 50, declencheur: 'À la signature' },
    { id: 'a2', ordre: 2, label: 'Acompte 2', pourcentage: 30, declencheur: 'À mi-chantier' },
    { id: 'a3', ordre: 3, label: 'Acompte 3', pourcentage: 20, declencheur: 'À la livraison' },
  ],
  lines: [{ id: 1, description: 'Rénovation', qty: 1, priceHT: 10000, tvaRate: 20, totalHT: 10000 }],
}

function props(convertDevisToFacture = vi.fn(), setSavedDocuments = vi.fn()) {
  return {
    artisan: ARTISAN, services: [], bookings: [],
    savedDocuments: [DEVIS] as unknown as Parameters<typeof DevisSection>[0]['savedDocuments'],
    setSavedDocuments,
    showDevisForm: false, setShowDevisForm: vi.fn(),
    convertingDevis: null, setConvertingDevis: vi.fn(), openDevisForm: vi.fn(),
    convertDevisToFacture,
  } as unknown as Parameters<typeof DevisSection>[0]
}

describe('DevisSection — « Facturer » propose Totale ou Acompte (BTP)', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { cleanup() })

  it('« Facturer » ouvre le choix Totale / Acompte', async () => {
    render(<DevisSection {...props()} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    expect(screen.getByRole('button', { name: /Facture totale/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Facture d'acompte/i })).toBeInTheDocument()
  })

  it('« Facture totale » → conversion directe existante', async () => {
    const convert = vi.fn()
    render(<DevisSection {...props(convert)} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture totale/i }))
    expect(convert).toHaveBeenCalledTimes(1)
    expect((convert.mock.calls[0][0] as { docNumber: string }).docNumber).toBe('DEV-2026-009')
  })

  it('« Facture d\'acompte » → échéancier du devis → clic Acompte 1 émet (AC-, reliée au devis)', async () => {
    const setSavedDocuments = vi.fn()
    render(<DevisSection {...props(vi.fn(), setSavedDocuments)} />)
    await waitFor(() => expect(screen.getByText('DEV-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    // L'échéancier du devis s'affiche dans la modale acompte
    fireEvent.click(screen.getByRole('button', { name: /Acompte 1.*50/ }))

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    const emitted = (setSavedDocuments.mock.calls[0][0] as (p: unknown[]) => unknown[])([])[0] as Record<string, unknown>
    expect(emitted.factureSubType).toBe('acompte')
    expect(emitted.acomptePourcentage).toBe(50)
    expect(emitted.docNumber).toBe('AC-2026-020')
    expect(emitted.status).toBe('envoye')
    expect(emitted.parentInvoiceNumber).toBe('DEV-2026-009')
    expect(emitted.sourceDevisNumber).toBe('DEV-2026-009')
    // 50 % de 10 000 = 5 000
    expect(computeDocumentTotalHT(emitted as Parameters<typeof computeDocumentTotalHT>[0])).toBeCloseTo(5000, 2)
  })
})
