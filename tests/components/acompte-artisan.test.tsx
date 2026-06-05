// tests/components/acompte-artisan.test.tsx
//
// Le workflow acompte (Factures « → Acompte » + Devis « Facturer → Acompte »)
// est aussi disponible côté ARTISAN (orgRole === 'artisan'). Respecte la
// franchise 293 B (artisan EI/auto/micro, tvaEnabled=false → mention 293 B,
// pas de « TVA exigible »). Modèle PDF V2 (download useBtpDesign=false).

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
// ── ARTISAN (pas BTP) ──
vi.mock('@/lib/hooks/useOrgRoleContext', () => ({
  useOrgRoleContext: () => ({ orgRole: 'artisan', isV5: true, useBtpDesign: false }),
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
  fetchNextDocNumber: vi.fn().mockResolvedValue('AC-2026-100'),
  localFallbackDocNumber: vi.fn(() => 'AC-2026-100'),
}))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))

import FacturesSection from '@/components/dashboard/FacturesSection'
import DevisSection from '@/components/dashboard/DevisSection'
import { computeDocumentTotalHT } from '@/lib/devis-totals'

const ARTISAN = {
  id: 'art-1', user_id: 'u-1', company_name: 'PLOMBERIE DURAND', email: 'd@test.fr', phone: '', bio: '',
} as Parameters<typeof FacturesSection>[0]['artisan']

// Facture artisan en franchise 293 B (tvaEnabled=false, tvaRate 0).
const FACTURE_ARTISAN = {
  id: 'doc-a1', docNumber: 'FACT-2026-100', docType: 'facture' as const, status: 'pending',
  clientName: 'M. Client', tvaEnabled: false,
  lines: [{ id: 1, description: 'Dépannage', qty: 1, priceHT: 1000, tvaRate: 0, totalHT: 1000 }],
}

const DEVIS_ARTISAN = {
  id: 'dev-a1', docNumber: 'DEV-2026-100', docType: 'devis' as const, status: 'accepte',
  clientName: 'M. Client', tvaEnabled: false, docTitle: 'Réfection plomberie',
  acomptesEnabled: true,
  acomptes: [
    { id: 'a1', ordre: 1, label: 'Acompte 1', pourcentage: 40, declencheur: 'À la signature' },
    { id: 'a2', ordre: 2, label: 'Acompte 2', pourcentage: 60, declencheur: 'À la livraison' },
  ],
  lines: [{ id: 1, description: 'Réfection', qty: 1, priceHT: 2000, tvaRate: 0, totalHT: 2000 }],
}

describe('Artisan — Factures « → Acompte »', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { cleanup() })

  it('le bouton « → Acompte » est disponible et émet (franchise 293 B)', async () => {
    const setSavedDocuments = vi.fn()
    render(
      <FacturesSection
        artisan={ARTISAN} services={[]} bookings={[]}
        savedDocuments={[FACTURE_ARTISAN] as unknown as Parameters<typeof FacturesSection>[0]['savedDocuments']}
        setSavedDocuments={setSavedDocuments}
        showFactureForm={false} setShowFactureForm={vi.fn()}
        convertingDevis={null} setConvertingDevis={vi.fn()} openFactureForm={vi.fn()}
      />
    )
    await waitFor(() => expect(screen.getByText('FACT-2026-100')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('proDash.factures.toAcompteTitle'))
    // Mention franchise (pas « TVA exigible »)
    expect(screen.getByText(/293 B/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '30 %' }))
    fireEvent.click(screen.getByText("Émettre l'acompte"))

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    const emitted = (setSavedDocuments.mock.calls[0][0] as (p: unknown[]) => unknown[])([])[0] as Record<string, unknown>
    expect(emitted.factureSubType).toBe('acompte')
    expect(String(emitted.notes)).toMatch(/293\s?B/)
    expect(String(emitted.notes)).not.toMatch(/exigible à l'encaissement/i)
    expect(computeDocumentTotalHT(emitted as Parameters<typeof computeDocumentTotalHT>[0])).toBeCloseTo(300, 2) // 30% de 1000
  })
})

describe('Artisan — Devis « Facturer » propose Totale ou Acompte', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { cleanup() })

  it('« Facturer » ouvre le choix et l\'acompte reprend l\'échéancier du devis', async () => {
    const setSavedDocuments = vi.fn()
    render(
      <DevisSection
        artisan={ARTISAN} services={[]} bookings={[]}
        savedDocuments={[DEVIS_ARTISAN] as unknown as Parameters<typeof DevisSection>[0]['savedDocuments']}
        setSavedDocuments={setSavedDocuments}
        showDevisForm={false} setShowDevisForm={vi.fn()}
        convertingDevis={null} setConvertingDevis={vi.fn()} openDevisForm={vi.fn()}
        convertDevisToFacture={vi.fn()}
      />
    )
    await waitFor(() => expect(screen.getByText('DEV-2026-100')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.devis.facturer'))
    expect(screen.getByRole('button', { name: /Facture totale/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Facture d'acompte/i }))
    // Échéancier du devis (40/60)
    fireEvent.click(screen.getByRole('button', { name: /Acompte 1.*40/ }))

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    const emitted = (setSavedDocuments.mock.calls[0][0] as (p: unknown[]) => unknown[])([])[0] as Record<string, unknown>
    expect(emitted.factureSubType).toBe('acompte')
    expect(emitted.acomptePourcentage).toBe(40)
    expect(emitted.sourceDevisNumber).toBe('DEV-2026-100')
    expect(computeDocumentTotalHT(emitted as Parameters<typeof computeDocumentTotalHT>[0])).toBeCloseTo(800, 2) // 40% de 2000
  })
})
