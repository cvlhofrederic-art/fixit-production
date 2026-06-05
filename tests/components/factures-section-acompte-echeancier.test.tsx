// tests/components/factures-section-acompte-echeancier.test.tsx
//
// Échéancier d'acomptes hérité du devis (méthode pro 2026) :
//   un devis définit un échéancier (ex. 50/30/20) ; la facture qui en découle
//   le porte. « → Acompte » sur cette facture liste « Acompte 1 — 50% »,
//   « Acompte 2 — 30% », « Acompte 3 — 20% » et émet en un clic l'acompte
//   choisi, au % exact noté sur le devis. Un acompte déjà émis est désactivé.

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
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'tid') } }))
vi.mock('@/lib/doc-number', () => ({
  fetchNextDocNumber: vi.fn().mockResolvedValue('AC-2026-007'),
  localFallbackDocNumber: vi.fn(() => 'AC-2026-007'),
}))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))

import FacturesSection from '@/components/dashboard/FacturesSection'
import { computeDocumentTotalHT } from '@/lib/devis-totals'

const ARTISAN = {
  id: 'art-1', user_id: 'u-1', company_name: 'SUD TRAVAUX',
  email: 's@test.fr', phone: '', bio: '',
} as Parameters<typeof FacturesSection>[0]['artisan']

// Facture issue d'un devis avec échéancier 50/30/20. Total 45 687 € HT.
const ECHEANCIER = [
  { id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 50, declencheur: 'À la signature' },
  { id: 'a2', ordre: 2, label: 'Acompte 2', pourcentage: 30, declencheur: 'À mi-chantier' },
  { id: 'a3', ordre: 3, label: 'Acompte 3', pourcentage: 20, declencheur: 'À la livraison' },
]
const FACTURE = {
  id: 'doc-009', docNumber: 'FACT-2026-009', docType: 'facture' as const,
  status: 'pending', clientName: 'Aractingi', regimeTva: 'classique', tvaEnabled: true,
  sourceDevisNumber: 'DEV-2026-003',
  acomptesEnabled: true,
  acomptes: ECHEANCIER,
  lines: [{ id: 1, description: 'MO', qty: 1, priceHT: 5250, tvaRate: 20, totalHT: 5250 }],
  customTables: [{ id: 't', name: 'Gros œuvre', lines: [
    { id: 2, description: 'Maçonnerie', qty: 1, priceHT: 40437, tvaRate: 10, totalHT: 40437 },
  ] }],
}

function props(extraDocs: unknown[] = [], setSavedDocuments = vi.fn()) {
  return {
    artisan: ARTISAN, services: [], bookings: [],
    savedDocuments: [FACTURE, ...extraDocs] as unknown as Parameters<typeof FacturesSection>[0]['savedDocuments'],
    setSavedDocuments,
    showFactureForm: false, setShowFactureForm: vi.fn(),
    convertingDevis: null, setConvertingDevis: vi.fn(), openFactureForm: vi.fn(),
  } as unknown as Parameters<typeof FacturesSection>[0]
}

describe('FacturesSection — échéancier d\'acomptes hérité du devis', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { cleanup() })

  it('liste les acomptes du devis (50/30/20) dans la modale', async () => {
    render(<FacturesSection {...props()} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('proDash.factures.toAcompteTitle'))
    // Lien devis → facture affiché (la facture est reliée à son devis)
    expect(screen.getByText(/Échéancier du devis DEV-2026-003/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Acompte 1.*50/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Acompte 2.*30/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Acompte 3.*20/ })).toBeInTheDocument()
  })

  it('clic « Acompte 2 — 30% » émet l\'acompte 2 au % du devis (13 706 €)', async () => {
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...props([], setSavedDocuments)} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('proDash.factures.toAcompteTitle'))
    fireEvent.click(screen.getByRole('button', { name: /Acompte 2.*30/ }))

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    const emitted = (setSavedDocuments.mock.calls[0][0] as (p: unknown[]) => unknown[])([])[0] as Record<string, unknown>
    expect(emitted.factureSubType).toBe('acompte')
    expect(emitted.acomptePourcentage).toBe(30)
    expect(emitted.acompteOrdre).toBe(2)
    expect(emitted.acompteTotal).toBe(3)
    expect(emitted.parentInvoiceNumber).toBe('FACT-2026-009')
    expect(emitted.status).toBe('envoye')
    expect(computeDocumentTotalHT(emitted as Parameters<typeof computeDocumentTotalHT>[0])).toBeCloseTo(13706.1, 1)
  })

  it('un acompte déjà émis est marqué « déjà émis » mais reste ré-émissible', async () => {
    const alreadyEmitted = {
      id: 'ac-1', docNumber: 'AC-2026-001', docType: 'facture',
      status: 'envoye', factureSubType: 'acompte',
      parentInvoiceNumber: 'FACT-2026-009', acompteOrdre: 1, acomptePourcentage: 50,
      lines: [{ id: 9, description: 'Acompte 1', qty: 1, priceHT: 2625, tvaRate: 20, totalHT: 2625 }],
    }
    render(<FacturesSection {...props([alreadyEmitted])} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('proDash.factures.toAcompteTitle'))
    const a1 = screen.getByRole('button', { name: /Acompte 1.*50/ })
    expect(a1).not.toBeDisabled()                 // ré-émission TOUJOURS possible
    expect(a1).toHaveTextContent(/déjà émis/i)    // mais visiblement déjà fait
    expect(screen.getByRole('button', { name: /Acompte 2.*30/ })).not.toHaveTextContent(/déjà émis/i)
  })
})
