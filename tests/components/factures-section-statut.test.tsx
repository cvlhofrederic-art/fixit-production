// tests/components/factures-section-statut.test.tsx
//
// Liste Factures V5 : filtre par STATUT (Toutes / Émises / Payées / Brouillons)
// + bouton « Marquer payée » (statut 'paid' en localStorage/state + sync DB,
// RLS factures_owner_update).

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'

const { from, update, eq } = vi.hoisted(() => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ update }))
  return { from, update, eq }
})

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'fr' }),
  useLocale: () => 'fr',
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) }, from },
}))
vi.mock('@/components/dashboard/useThemeVars', () => ({
  useThemeVars: () => ({
    bg: '#fff', surface: '#fff', surfaceAlt: '#f5f5f5', border: '#e5e5e5',
    text: '#000', textMuted: '#666', accent: '#000', accentText: '#fff', red: '#dc2626', green: '#16a34a',
  }),
}))
// Rôle BTP par défaut ; les tests de non-régression artisan le basculent.
const role = vi.hoisted(() => ({ valeur: 'pro_societe' as 'pro_societe' | 'artisan' }))
vi.mock('@/lib/hooks/useOrgRoleContext', () => ({
  useOrgRoleContext: () => ({ orgRole: role.valeur, isV5: true, useBtpDesign: role.valeur === 'pro_societe' }),
}))
vi.mock('@/components/DevisFactureForm', () => ({ default: () => null }))
vi.mock('@/components/DevisFactureFormBTP', () => ({ default: () => null }))
vi.mock('@/components/DocumentCancelModal', () => ({
  default: (p: { open: boolean; docNumber: string }) => (p.open ? <div data-testid="annulation">{p.docNumber}</div> : null),
}))
vi.mock('@/components/ConfirmDraftDeleteDialog', () => ({
  default: (p: { open: boolean }) => (p.open ? <div data-testid="suppression-brouillon" /> : null),
}))
vi.mock('@/lib/pdf/download-saved-devis', () => ({ downloadSavedDevis: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'tid') } }))

import FacturesSection from '@/components/dashboard/FacturesSection'

const ARTISAN = {
  id: 'art-1', user_id: 'u-1', company_name: 'SUD TRAVAUX', email: 's@test.fr', phone: '', bio: '',
} as Parameters<typeof FacturesSection>[0]['artisan']

const FACT_EMISE = {
  id: '50e30094-3af7-442b-b2b0-4e8c8fc12b64', docNumber: 'FACT-2026-020', docType: 'facture' as const,
  status: 'pending', clientName: 'A', tvaEnabled: true, sentAt: '2026-06-05T10:00:00.000Z',
  lines: [{ id: 1, description: 'X', qty: 1, priceHT: 1000, tvaRate: 20, totalHT: 1000 }],
}
const FACT_PAYEE = {
  id: 'paid-1', docNumber: 'FACT-2026-019', docType: 'facture' as const,
  status: 'paid', clientName: 'B', tvaEnabled: true, sentAt: '2026-06-04T10:00:00.000Z',
  lines: [{ id: 1, description: 'Y', qty: 1, priceHT: 2000, tvaRate: 20, totalHT: 2000 }],
}

function props(setSavedDocuments = vi.fn(), docs: unknown[] = [FACT_EMISE, FACT_PAYEE]) {
  return {
    artisan: ARTISAN, services: [], bookings: [],
    savedDocuments: docs as unknown as Parameters<typeof FacturesSection>[0]['savedDocuments'],
    setSavedDocuments,
    showFactureForm: false, setShowFactureForm: vi.fn(),
    convertingDevis: null, setConvertingDevis: vi.fn(), openFactureForm: vi.fn(),
  } as unknown as Parameters<typeof FacturesSection>[0]
}

beforeEach(() => { localStorage.clear(); from.mockClear(); update.mockClear(); eq.mockClear(); role.valeur = 'pro_societe' })
afterEach(() => { cleanup() })

describe('FacturesSection V5 — filtre statut + Marquer payée', () => {
  it('filtre « Payées » → n\'affiche que la facture payée', async () => {
    render(<FacturesSection {...props()} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-020')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^Payées/ }))
    expect(screen.getByText('FACT-2026-019')).toBeInTheDocument()
    expect(screen.queryByText('FACT-2026-020')).not.toBeInTheDocument()
  })

  it('filtre « Émises » → n\'affiche que la facture émise', async () => {
    render(<FacturesSection {...props()} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-019')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^Émises/ }))
    expect(screen.getByText('FACT-2026-020')).toBeInTheDocument()
    expect(screen.queryByText('FACT-2026-019')).not.toBeInTheDocument()
  })

  it('une facture EN RETARD (overdue) est dans « Émises », PAS dans « Brouillons »', async () => {
    const overdue = { ...FACT_EMISE, id: 'ov-1', docNumber: 'FACT-2026-021', status: 'overdue' }
    const draft = { ...FACT_EMISE, id: 'dr-1', docNumber: 'FACT-2026-022', status: 'draft' }
    render(<FacturesSection {...props(vi.fn(), [overdue, draft])} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-021')).toBeInTheDocument())
    // Brouillons : seulement le vrai brouillon
    fireEvent.click(screen.getByRole('button', { name: /^Brouillons/ }))
    expect(screen.getByText('FACT-2026-022')).toBeInTheDocument()
    expect(screen.queryByText('FACT-2026-021')).not.toBeInTheDocument()
    // Émises : l'overdue (en retard reste émise)
    fireEvent.click(screen.getByRole('button', { name: /^Émises/ }))
    expect(screen.getByText('FACT-2026-021')).toBeInTheDocument()
    expect(screen.queryByText('FACT-2026-022')).not.toBeInTheDocument()
  })

  it('« Marquer payée » → statut paid (state) + sync DB', async () => {
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...props(setSavedDocuments, [FACT_EMISE])} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-020')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Marquer payée'))

    // markPaid attend désormais la confirmation DB AVANT de mettre à jour l'UI
    // (toast « payée » seulement après succès) → on attend l'appel async.
    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    // State : la facture passe à 'paid'
    const updater = setSavedDocuments.mock.calls[0][0] as (p: unknown[]) => unknown[]
    const result = updater([FACT_EMISE]) as Array<{ docNumber: string; status: string }>
    expect(result.find(d => d.docNumber === 'FACT-2026-020')?.status).toBe('paid')
    // DB : UPDATE status=paid sur factures par id
    expect(from).toHaveBeenCalledWith('factures')
    expect(update).toHaveBeenCalledWith({ status: 'paid' })
    expect(eq).toHaveBeenCalledWith('id', '50e30094-3af7-442b-b2b0-4e8c8fc12b64')
  })

  it('« Marquer payée » sur doc LEGACY (id horodaté non-UUID) → sync DB par numéro', async () => {
    // Doc legacy (créé avant stableDocId) : id = Date.now() → isStableDocId false.
    // Sans repli, le bouton ne persistait rien en DB (perte au rechargement).
    const legacy = { ...FACT_EMISE, id: '1779539827817', docNumber: 'FACT-2026-007', status: 'pending' }
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...props(setSavedDocuments, [legacy])} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-007')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Marquer payée'))

    await waitFor(() => expect(setSavedDocuments).toHaveBeenCalled())
    // id non-UUID → pas de clé `id` exploitable : ciblage par `numero` (la RLS
    // factures_owner_update borne déjà au propriétaire). Mirror de /api/devis/sync.
    expect(from).toHaveBeenCalledWith('factures')
    expect(update).toHaveBeenCalledWith({ status: 'paid' })
    expect(eq).toHaveBeenCalledWith('numero', 'FACT-2026-007')
  })
})

describe('FacturesSection V5 — facture émise au statut local « envoye » (BTP)', () => {
  // Une facture émise en un clic garde le statut local 'envoye' jusqu'au rechargement du
  // tableau de bord. Elle porte un numéro définitif : elle s'annule, elle ne se supprime pas.
  it('facture émise : bouton « Annuler » → fenêtre d\'annulation, aucune suppression', async () => {
    const emise = { ...FACT_EMISE, docNumber: 'FACT-2026-043', status: 'envoye' }
    const setSavedDocuments = vi.fn()
    render(<FacturesSection {...props(setSavedDocuments, [emise])} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-043')).toBeInTheDocument())
    expect(screen.queryByText('proDash.factures.supprimer')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Annuler'))

    expect(screen.getByTestId('annulation')).toHaveTextContent('FACT-2026-043')
    expect(screen.queryByTestId('suppression-brouillon')).not.toBeInTheDocument()
    expect(setSavedDocuments).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('vrai brouillon (sans numéro) : « Supprimer » → confirmation de suppression du brouillon', async () => {
    const brouillon = { ...FACT_EMISE, docNumber: '', status: 'brouillon', clientName: 'Client brouillon' }
    render(<FacturesSection {...props(vi.fn(), [brouillon])} />)
    await waitFor(() => expect(screen.getByText('Client brouillon')).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.factures.supprimer'))

    expect(screen.getByTestId('suppression-brouillon')).toBeInTheDocument()
    expect(screen.queryByTestId('annulation')).not.toBeInTheDocument()
  })

  it.each([
    ['sans numéro', { docNumber: '', clientName: 'Client envoyé' }, 'Client envoyé'],
    ['numéro provisoire BR-', { docNumber: 'BR-2026-001' }, 'BR-2026-001'],
  ])('brouillon passé à « envoyé » (%s) : reste supprimable, pas de fenêtre d\'annulation', async (_cas, champs, repere) => {
    // Sans numéro définitif, le document n'existe pas en base : l'annulation répondrait « introuvable ».
    const envoye = { ...FACT_EMISE, status: 'envoye', ...champs }
    render(<FacturesSection {...props(vi.fn(), [envoye])} />)
    await waitFor(() => expect(screen.getByText(repere)).toBeInTheDocument())
    fireEvent.click(screen.getByText('proDash.factures.supprimer'))

    expect(screen.getByTestId('suppression-brouillon')).toBeInTheDocument()
    expect(screen.queryByTestId('annulation')).not.toBeInTheDocument()
  })

  it('règle n° 1 — côté artisan, une facture « envoye » avec numéro garde le comportement historique (« Supprimer »)', async () => {
    role.valeur = 'artisan'
    const emise = { ...FACT_EMISE, docNumber: 'FACT-2026-043', status: 'envoye' }
    render(<FacturesSection {...props(vi.fn(), [emise])} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-043')).toBeInTheDocument())
    expect(screen.queryByText('Annuler')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('proDash.factures.supprimer'))

    expect(screen.getByTestId('suppression-brouillon')).toBeInTheDocument()
    expect(screen.queryByTestId('annulation')).not.toBeInTheDocument()
  })
})

describe('FacturesSection V5 — total affiché d\'une facture de solde', () => {
  // Facture de solde BTP : main d'œuvre 1 000 €, matériaux 9 000 €, acompte de 5 000 € déduit
  // (table « Acomptes déjà facturés »). Montant réel : 5 000 € HT, 6 000 € TTC.
  const SOLDE = {
    id: 'solde-1', docNumber: 'FACT-2026-050', docType: 'facture' as const, status: 'pending',
    clientName: 'C', regimeTva: 'classique', tvaEnabled: true, sentAt: '2026-06-06T10:00:00.000Z',
    lines: [{ id: 1, description: 'Main d\'œuvre', qty: 1, priceHT: 1000, tvaRate: 20, totalHT: 1000 }],
    materialLines: [{ id: 2, description: 'Matériaux', qty: 1, priceHT: 9000, tvaRate: 20, totalHT: 9000 }],
    customTables: [{ id: 'acomptes-deduits', name: 'Acomptes déjà facturés (à déduire)', lines: [
      { id: 101, description: 'Acompte déjà facturé — facture n° AC-2026-001 — TVA 20 %', qty: 1, priceHT: -5000, tvaRate: 20, totalHT: -5000 },
    ] }],
  }

  it('BTP : même périmètre que le PDF (matériaux compris) → 6 000 € TTC, pas un montant négatif', async () => {
    render(<FacturesSection {...props(vi.fn(), [SOLDE])} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-050')).toBeInTheDocument())
    expect(screen.getByText(/^6\s000 €$/)).toBeInTheDocument()
    expect(screen.queryByText(/4\s800 €/)).not.toBeInTheDocument()
  })

  it('règle n° 1 — côté artisan, le calcul historique de la liste est inchangé', async () => {
    role.valeur = 'artisan'
    render(<FacturesSection {...props(vi.fn(), [SOLDE])} />)
    await waitFor(() => expect(screen.getByText('FACT-2026-050')).toBeInTheDocument())
    // Lignes + tables seulement (matériaux hors périmètre) : (1 000 − 5 000) × 1,2.
    expect(screen.getByText(/4\s800 €/)).toBeInTheDocument()
  })
})
