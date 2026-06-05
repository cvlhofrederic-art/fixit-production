// tests/components/factures-section-acompte-display.test.tsx
//
// Régression incident Gourdon/Plessis 2026-05-26 :
//   La liste UI affichait `0.5 × montant_réel` pour les factures de type
//   acompte (FACT-2026-008 : 6 815 € au lieu de 13 629,51 € ; FACT-2026-012 :
//   6 237 € au lieu de 12 473,50 €). Le PDF generator V3 et la DB
//   (`total_ttc_cents`) affichaient le bon montant — seul le UI list divergait.
//
// Cause racine : `FacturesSectionV5` (rendered when isV5=true) appliquait
//   `totalTTC = totalTTC * firstAcompte.pourcentage / 100` quand
//   `factureSubType='acompte'` ET `acomptes[].length > 0`. Cette multiplication
//   supposait que les lignes du doc représentaient le total chantier, mais
//   dans la pratique BTP standard (workflow validé par utilisateur), les lignes
//   représentent déjà le montant acompte consolidé par TVA.
//
// Fix : supprimer la multiplication. Le UI affiche désormais `tva.totalTTC`
//   brut, identique au PDF/DB. Pour un acompte propre, l'utilisateur édite
//   les lignes (workflow Gourdon : "Acompte 50% — Travaux ... (TVA 10%)").

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

// ── Mocks lourds ──────────────────────────────────────────────────────────
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'fr' }),
  useLocale: () => 'fr',
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}))

vi.mock('@/components/dashboard/useThemeVars', () => ({
  useThemeVars: () => ({
    bg: '#fff', surface: '#fff', surfaceAlt: '#f5f5f5',
    border: '#e5e5e5', text: '#000', textMuted: '#666',
    accent: '#000', accentText: '#fff', red: '#dc2626', green: '#16a34a',
  }),
}))

vi.mock('@/lib/hooks/useOrgRoleContext', () => ({
  useOrgRoleContext: () => ({
    orgRole: 'pro_societe',
    isV5: true,         // → FacturesSectionV5 (le composant qui contenait le bug)
    useBtpDesign: true,
  }),
}))

vi.mock('@/components/DevisFactureForm', () => ({ default: () => null }))
vi.mock('@/components/DevisFactureFormBTP', () => ({ default: () => null }))
vi.mock('@/components/DocumentCancelModal', () => ({ default: () => null }))
vi.mock('@/components/ConfirmDraftDeleteDialog', () => ({ default: () => null }))
vi.mock('@/lib/pdf/download-saved-devis', () => ({ downloadSavedDevis: vi.fn() }))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import FacturesSection from '@/components/dashboard/FacturesSection'

const ARTISAN = {
  id: 'art-sudtravaux',
  user_id: 'user-sudtravaux',
  company_name: 'SUD TRAVAUX',
  email: 'sudtravaux@test.fr',
  phone: '',
  bio: '',
} as Parameters<typeof FacturesSection>[0]['artisan']

// Reproduction exacte des données Plessis 012 :
//   - Ligne 1 : 8 601,36 € HT @ 10% TVA → 9 461,50 € TTC
//   - Ligne 2 : 2 510,00 € HT @ 20% TVA → 3 012,00 € TTC
//   - TOTAL TTC attendu : 12 473,50 € (et NON 6 237 € = ancien bug)
const ACOMPTE_PLESSIS = {
  id: 'doc-test-1',
  docNumber: 'FACT-2026-TEST-012',
  docType: 'facture' as const,
  status: 'pending',
  clientName: 'Arnaud Plessis',
  factureSubType: 'acompte',
  acomptesEnabled: false,            // toggle OFF mais acomptes[] persiste → reproduit le cas Plessis
  acomptes: [
    { id: 'a1', pourcentage: 50, declencheur: 'Au démarrage' },
    { id: 'a2', pourcentage: 30, declencheur: 'À mi-chantier' },
    { id: 'a3', pourcentage: 20, declencheur: 'À la livraison' },
  ],
  lines: [
    { id: '1', description: 'Acompte 50% — Travaux d\'amélioration', qty: 1, totalHT: 8601.36, tvaRate: 10 },
    { id: '2', description: 'Acompte 50% — Meubles meublants', qty: 1, totalHT: 2510, tvaRate: 20 },
  ],
  // Régime TVA classique
  regimeTva: 'classique',
  tvaEnabled: true,
}

describe('FacturesSection — acompte UI display', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup() // Unmount DOM entre tests pour éviter le leak (state du 1er render)
  })

  it('affiche le total brut des lignes (12 474 €) pour une facture acompte, PAS 50% (6 237 €)', async () => {
    render(
      <FacturesSection
        artisan={ARTISAN}
        services={[]}
        bookings={[]}
        savedDocuments={[ACOMPTE_PLESSIS] as unknown as Parameters<typeof FacturesSection>[0]['savedDocuments']}
        setSavedDocuments={vi.fn()}
        showFactureForm={false}
        setShowFactureForm={vi.fn()}
        convertingDevis={null}
        setConvertingDevis={vi.fn()}
        openFactureForm={vi.fn()}
      />
    )

    // Attend que la row Plessis s'affiche
    await waitFor(() => {
      expect(screen.getByText('FACT-2026-TEST-012')).toBeInTheDocument()
    })

    // Cellule "Montant TTC" doit afficher 12 474 € (arrondi) — PAS 6 237 €
    // (toLocaleString fr avec maximumFractionDigits: 0 → '12 474 €')
    const cells = Array.from(document.querySelectorAll('td'))
    const montantCell = cells.find(td => td.textContent?.includes('€'))
    expect(montantCell?.textContent).toMatch(/12\s*474\s*€|12 474\s*€/)
    expect(montantCell?.textContent).not.toMatch(/6\s*237|6 237/)
  })

  it("même comportement quand acomptesEnabled=true (cas Gourdon)", async () => {
    const docGourdonShape = {
      ...ACOMPTE_PLESSIS,
      id: 'doc-test-2',
      docNumber: 'FACT-2026-TEST-008',
      acomptesEnabled: true,
      lines: [
        { id: '1', description: 'Acompte 50% — Travaux', qty: 1, totalHT: 8989.09, tvaRate: 10 },
        { id: '2', description: 'Acompte 50% — Fenêtres', qty: 1, totalHT: 1106.64, tvaRate: 5.5 },
        { id: '3', description: 'Acompte 50% — Meubles', qty: 1, totalHT: 2145, tvaRate: 20 },
      ],
    }
    // TTC attendu : 8989.09*1.10 + 1106.64*1.055 + 2145*1.20 ≈ 9888 + 1167.51 + 2574 = 13 629,51 €

    render(
      <FacturesSection
        artisan={ARTISAN}
        services={[]}
        bookings={[]}
        savedDocuments={[docGourdonShape] as unknown as Parameters<typeof FacturesSection>[0]['savedDocuments']}
        setSavedDocuments={vi.fn()}
        showFactureForm={false}
        setShowFactureForm={vi.fn()}
        convertingDevis={null}
        setConvertingDevis={vi.fn()}
        openFactureForm={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('FACT-2026-TEST-008')).toBeInTheDocument()
    })

    const cells = Array.from(document.querySelectorAll('td'))
    const montantCell = cells.find(td => td.textContent?.includes('€'))
    // 13 630 € (arrondi 13 629,51) — pas 6 815 €
    expect(montantCell?.textContent).toMatch(/13\s*630\s*€|13 630\s*€/)
    expect(montantCell?.textContent).not.toMatch(/6\s*815|6 815/)
  })
})
