// tests/components/factures-section-acompte-transform.test.tsx
//
// Régression incident Aractingi 2026-06-05 (BTP Pro) — parcours UI complet :
//   « → Acompte » sur une facture standard émise → modale (% voulu) →
//   « Préparer l'acompte » → openFactureForm reçoit un document mis à l'échelle.
//
// Le bug : le document transmis au formulaire n'appliquait pas le % choisi sur
//   les customTables (corps d'état BTP), restant à ~92 % (42 012 €) au lieu de
//   30 % (13 706 €). Ce test verrouille le parcours bout-en-bout.

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

// Facture standard émise, gros du montant dans customTables (cas BTP réel) :
//   lines = 5 250 € ; customTables = 40 437 € ; total HT = 45 687 €
//   Acompte 30 % attendu = 13 706,10 € (et NON 42 012 € = ancien bug 92 %).
const FACTURE_STD = {
  id: 'doc-aractingi-009',
  docNumber: 'FACT-2026-009',
  docType: 'facture' as const,
  status: 'pending',            // émise → le bouton « → Acompte » s'affiche
  clientName: 'Nicolas Aractingi',
  // pas de factureSubType → 'standard'
  regimeTva: 'classique',
  tvaEnabled: true,
  lines: [
    { id: 1, description: "Main d'œuvre", qty: 1, priceHT: 5250, tvaRate: 20, totalHT: 5250 },
  ],
  customTables: [
    { id: 't1', name: 'Gros œuvre', lines: [
      { id: 2, description: 'Maçonnerie', qty: 1, priceHT: 40437, tvaRate: 20, totalHT: 40437 },
    ] },
  ],
}

describe('FacturesSection — « → Acompte » applique le % sur tout le document', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { cleanup() })

  it('openFactureForm reçoit un acompte 30 % = 13 706 € (pas 42 012 €)', async () => {
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

    // 1 clic : ouvre la modale acompte
    fireEvent.click(screen.getByTitle('proDash.factures.toAcompteTitle'))
    // Le % par défaut est 30 — on valide directement
    fireEvent.click(screen.getByText("Préparer l'acompte"))

    expect(openFactureForm).toHaveBeenCalledTimes(1)
    const prefilled = openFactureForm.mock.calls[0][0]
    expect(prefilled.factureSubType).toBe('acompte')
    expect(prefilled.acomptePourcentage).toBe(30)
    // Cœur de la régression : le total reflète 30 % de 45 687 €, customTables incluses
    expect(computeDocumentTotalHT(prefilled)).toBeCloseTo(13706.1, 1)
    expect(computeDocumentTotalHT(prefilled)).not.toBeCloseTo(42012, 0)
  })
})
