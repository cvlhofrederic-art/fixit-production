// tests/components/factures-section-tri-filtres.test.tsx
//
// Liste Factures V5 : (1) tri « du plus récent au plus ancien » par date
// d'émission — un acompte récent (AC-2026-002) doit passer AVANT une facture
// plus ancienne (FACT-2026-017), alors que l'ancien tri par séquence le mettait
// en bas. (2) Filtres d'affichage Tous / Factures / Acomptes / Avoirs.

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
    text: '#000', textMuted: '#666', accent: '#000', accentText: '#fff', red: '#dc2626', green: '#16a34a',
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

import FacturesSection from '@/components/dashboard/FacturesSection'

const ARTISAN = {
  id: 'art-1', user_id: 'u-1', company_name: 'SUD TRAVAUX', email: 's@test.fr', phone: '', bio: '',
} as Parameters<typeof FacturesSection>[0]['artisan']

// FACT-2026-017 émise le 04/06 ; AC-2026-002 émis le 05/06 (plus récent).
const FACT = {
  id: 'f1', docNumber: 'FACT-2026-017', docType: 'facture' as const, status: 'pending',
  clientName: 'Client A', tvaEnabled: true, sentAt: '2026-06-04T09:00:00.000Z',
  lines: [{ id: 1, description: 'X', qty: 1, priceHT: 1000, tvaRate: 20, totalHT: 1000 }],
}
const ACOMPTE = {
  id: 'a1', docNumber: 'AC-2026-002', docType: 'facture' as const, status: 'pending',
  factureSubType: 'acompte', clientName: 'Client B', tvaEnabled: true, sentAt: '2026-06-05T15:00:00.000Z',
  lines: [{ id: 1, description: 'Y', qty: 1, priceHT: 500, tvaRate: 20, totalHT: 500 }],
}

function props(setSavedDocuments = vi.fn()) {
  return {
    artisan: ARTISAN, services: [], bookings: [],
    savedDocuments: [FACT, ACOMPTE] as unknown as Parameters<typeof FacturesSection>[0]['savedDocuments'],
    setSavedDocuments,
    showFactureForm: false, setShowFactureForm: vi.fn(),
    convertingDevis: null, setConvertingDevis: vi.fn(), openFactureForm: vi.fn(),
  } as unknown as Parameters<typeof FacturesSection>[0]
}

describe('FacturesSection V5 — tri par récence + filtres', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { cleanup() })

  it('l\'acompte récent (AC-2026-002) s\'affiche AVANT FACT-2026-017', async () => {
    const { container } = render(<FacturesSection {...props()} />)
    await waitFor(() => expect(screen.getByText('AC-2026-002')).toBeInTheDocument())
    const html = container.innerHTML
    expect(html.indexOf('AC-2026-002')).toBeLessThan(html.indexOf('FACT-2026-017'))
  })

  it('filtre « Acomptes » → n\'affiche que l\'acompte', async () => {
    render(<FacturesSection {...props()} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-017')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^Acomptes/ }))
    expect(screen.getByText('AC-2026-002')).toBeInTheDocument()
    expect(screen.queryByText('FACT-2026-017')).not.toBeInTheDocument()
  })

  it('filtre « Factures » → n\'affiche que la facture standard', async () => {
    render(<FacturesSection {...props()} />)
    await waitFor(() => expect(screen.getByText('AC-2026-002')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^Factures/ }))
    expect(screen.getByText('FACT-2026-017')).toBeInTheDocument()
    expect(screen.queryByText('AC-2026-002')).not.toBeInTheDocument()
  })
})
