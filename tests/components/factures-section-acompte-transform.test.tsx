// tests/components/factures-section-acompte-transform.test.tsx
//
// Parcours UI « → Acompte » du BTP Pro — émission directe (méthode pro 2026) :
//   facture standard → modale (case % manuelle + chips 20/30/50) → clic 50 % →
//   « Émettre l'acompte » → l'acompte est ÉMIS direct (numéro AC- définitif,
//   statut émis, % appliqué à TOUT le document, TVA conservées) et ajouté à la
//   liste. Le formulaire ne s'ouvre PAS (création en un clic).

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

// Numérotation + sync mockées (I/O réseau) — emitDocument lui-même tourne pour de vrai.
vi.mock('@/lib/doc-number', () => ({
  fetchNextDocNumber: vi.fn().mockResolvedValue('AC-2026-007'),
  localFallbackDocNumber: vi.fn(() => 'AC-2026-007'),
}))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))

import FacturesSection from '@/components/dashboard/FacturesSection'
import { computeDocumentTotalHT } from '@/lib/devis-totals'

const ARTISAN = {
  id: 'art-sudtravaux', user_id: 'user-sudtravaux', company_name: 'SUD TRAVAUX',
  email: 'sudtravaux@test.fr', phone: '', bio: '',
} as Parameters<typeof FacturesSection>[0]['artisan']

// Facture standard émise : lines 5 250 € @20% + customTables 40 437 € @10% = 45 687 €.
const FACTURE_STD = {
  id: 'doc-009', docNumber: 'FACT-2026-009', docType: 'facture' as const,
  status: 'pending', clientName: 'Nicolas Aractingi',
  regimeTva: 'classique', tvaEnabled: true,
  lines: [{ id: 1, description: "Main d'œuvre", qty: 1, priceHT: 5250, tvaRate: 20, totalHT: 5250 }],
  customTables: [{ id: 't1', name: 'Gros œuvre', lines: [
    { id: 2, description: 'Maçonnerie', qty: 1, priceHT: 40437, tvaRate: 10, totalHT: 40437 },
  ] }],
}

describe('FacturesSection — « → Acompte » émet direct au % choisi', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { cleanup() })

  it('chips 20/30/50 + case manuelle présentes ; pas de 100', async () => {
    render(<FacturesSection {...baseProps(vi.fn())} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-009')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('proDash.factures.toAcompteTitle'))
    expect(screen.getByRole('button', { name: '20 %' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '30 %' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '50 %' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '100 %' })).not.toBeInTheDocument()
  })

  it('clic 50 % + Émettre → acompte ÉMIS (AC-, 22 843,50 €) ajouté à la liste, sans ouvrir le form', async () => {
    const openFactureForm = vi.fn()
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...baseProps(openFactureForm, setSavedDocuments)} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-009')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('proDash.factures.toAcompteTitle'))
    fireEvent.click(screen.getByRole('button', { name: '50 %' }))
    fireEvent.click(screen.getByText("Émettre l'acompte"))

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    // setSavedDocuments(prev => [...prev, emitted]) — on exécute l'updater
    const updater = setSavedDocuments.mock.calls[0][0] as (p: unknown[]) => unknown[]
    const emitted = updater([])[0] as Record<string, unknown>

    expect(emitted.factureSubType).toBe('acompte')
    expect(emitted.acomptePourcentage).toBe(50)
    expect(emitted.docNumber).toBe('AC-2026-007')   // numéro définitif tiré à l'émission
    expect(emitted.status).toBe('envoye')           // émis (pas brouillon)
    // 50 % de 45 687 € = 22 843,50 € — customTables incluses
    expect(computeDocumentTotalHT(emitted as Parameters<typeof computeDocumentTotalHT>[0])).toBeCloseTo(22843.5, 1)
    // Le formulaire éditable ne s'ouvre pas (création directe)
    expect(openFactureForm).not.toHaveBeenCalled()
  })
})

function baseProps(openFactureForm: ReturnType<typeof vi.fn>, setSavedDocuments = vi.fn()) {
  return {
    artisan: ARTISAN,
    services: [],
    bookings: [],
    savedDocuments: [FACTURE_STD] as unknown as Parameters<typeof FacturesSection>[0]['savedDocuments'],
    setSavedDocuments,
    showFactureForm: false,
    setShowFactureForm: vi.fn(),
    convertingDevis: null,
    setConvertingDevis: vi.fn(),
    openFactureForm,
  } as unknown as Parameters<typeof FacturesSection>[0]
}
