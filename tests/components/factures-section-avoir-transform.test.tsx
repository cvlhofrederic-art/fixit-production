// tests/components/factures-section-avoir-transform.test.tsx
//
// Bug frère de l'acompte (PR #396) — parcours UI « → Avoir » du BTP Pro :
//   sur une facture standard dont le gros vit dans customTables, l'avoir
//   transmis à openFactureForm n'était pas entièrement négativé (customTables
//   restaient positifs) → total ≈ +35 187 € au lieu de -45 687 €.

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
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import FacturesSection from '@/components/dashboard/FacturesSection'
import { computeDocumentTotalHT } from '@/lib/devis-totals'

const ARTISAN = {
  id: 'art-sudtravaux', user_id: 'user-sudtravaux', company_name: 'SUD TRAVAUX',
  email: 'sudtravaux@test.fr', phone: '', bio: '',
} as Parameters<typeof FacturesSection>[0]['artisan']

// Facture standard émise : lines 5 250 € + customTables 40 437 € = 45 687 €.
const FACTURE_STD = {
  id: 'doc-009', docNumber: 'FACT-2026-009', docType: 'facture' as const,
  status: 'pending', clientName: 'Nicolas Aractingi',
  regimeTva: 'classique', tvaEnabled: true,
  lines: [{ id: 1, description: "Main d'œuvre", qty: 1, priceHT: 5250, tvaRate: 20, totalHT: 5250 }],
  customTables: [{ id: 't1', name: 'Gros œuvre', lines: [
    { id: 2, description: 'Maçonnerie', qty: 1, priceHT: 40437, tvaRate: 20, totalHT: 40437 },
  ] }],
}

describe('FacturesSection — « → Avoir » négative tout le document', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { cleanup() })

  it('openFactureForm reçoit un avoir = -45 687 € (pas +35 187 €)', async () => {
    const openFactureForm = vi.fn()
    render(
      <FacturesSection
        artisan={ARTISAN}
        services={[]}
        bookings={[]}
        savedDocuments={[FACTURE_STD] as unknown as Parameters<typeof FacturesSection>[0]['savedDocuments']}
        setSavedDocuments={vi.fn()}
        showFactureForm={false}
        setShowFactureForm={vi.fn()}
        convertingDevis={null}
        setConvertingDevis={vi.fn()}
        openFactureForm={openFactureForm}
      />
    )

    await waitFor(() => expect(screen.getByText('FACT-2026-009')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('proDash.factures.toAvoirTitle'))
    // Motif obligatoire (5–500 car.) pour activer « Préparer l'avoir »
    fireEvent.change(screen.getByPlaceholderText(/erreur de facturation/i), {
      target: { value: 'Annulation totale de la commande, erreur de facturation client.' },
    })
    fireEvent.click(screen.getByText("Préparer l'avoir"))

    expect(openFactureForm).toHaveBeenCalledTimes(1)
    const prefilled = openFactureForm.mock.calls[0][0]
    expect(prefilled.factureSubType).toBe('avoir')
    expect(computeDocumentTotalHT(prefilled)).toBeCloseTo(-45687, 1)
    expect(computeDocumentTotalHT(prefilled)).not.toBeCloseTo(35187, 0)
  })
})
