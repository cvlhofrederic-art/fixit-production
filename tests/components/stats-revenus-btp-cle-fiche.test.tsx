// Statistiques et Revenus d'une société BTP (components/dashboard/StatsRevenusSection.tsx, mise en page V5).
// Le tableau de bord range les devis, factures et dépenses d'une société dans le navigateur sous l'identifiant de
// sa fiche (artisan.id) ; ces deux écrans les cherchaient sous celui du compte (artisan.user_id), qui n'y porte
// rien : chiffre d'affaires, factures, devis et dépenses à zéro pour une société sans réservation (constat
// stockage-local-miroir-8 de l'audit du 11/11/2026). Les factures relues depuis la base portent le statut de la
// base (« pending » pour une facture émise non payée, lib/document-sync.ts) : elles comptent comme envoyées.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Artisan } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

vi.mock('@/lib/i18n/context', async () => (await import('../helpers/mocks-formulaires-devis')).traductions())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/components/stats/ResumeActivite', () => ({ default: () => null }))

import StatsRevenusSection from '@/components/dashboard/StatsRevenusSection'

const ARTISAN = { id: 'fiche-btp-stats', user_id: 'compte-btp-stats', company_name: 'BATIR TEST SAS' } as unknown as Artisan
const AUJOURDHUI = new Date().toISOString().slice(0, 10)

const ligne = (description: string, totalHT: number) => ({ id: 1, description, qty: 1, unit: 'f', priceHT: totalHT, tvaRate: 20, totalHT })

const FACTURE_PAYEE = {
  id: 'fact-1', docType: 'facture', docNumber: 'FACT-2026-001', status: 'paid', docDate: AUJOURDHUI,
  clientName: 'SCI Les Tilleuls', docTitle: 'Ravalement façade', lines: [ligne('Ravalement', 1200)],
}
// Facture émise relue depuis la base : statut de la base, « pending ».
const FACTURE_EMISE = {
  id: 'fact-2', docType: 'facture', docNumber: 'FACT-2026-002', status: 'pending', docDate: AUJOURDHUI,
  clientName: 'SARL Durand', docTitle: 'Toiture', lines: [ligne('Toiture', 800)],
}
const DEVIS_SIGNE = {
  id: 'dev-1', docType: 'devis', docNumber: 'DEV-2026-001', status: 'signed', docDate: AUJOURDHUI,
  clientName: 'SCI Les Tilleuls', docTitle: 'Devis — Ravalement façade', lines: [ligne('Ravalement', 1500)],
}
const DEPENSE = { label: 'Ciment', amount: '300', date: AUJOURDHUI, category: 'materiaux' }

function ranger(id: string) {
  localStorage.setItem(`fixit_documents_${id}`, JSON.stringify([FACTURE_PAYEE, FACTURE_EMISE, DEVIS_SIGNE]))
  localStorage.setItem(`fixit_expenses_${id}`, JSON.stringify([DEPENSE]))
}

function monter(activePage: 'stats' | 'revenus', orgRole: 'pro_societe' | 'artisan' = 'pro_societe') {
  return render(
    <StatsRevenusSection
      artisan={ARTISAN} bookings={[]} services={[]} pendingBookings={[]} completedBookings={[]}
      totalRevenue={0} activePage={activePage} orgRole={orgRole}
    />,
  )
}

/** Valeurs des quatre indicateurs, dans l'ordre de l'écran. */
const indicateurs = (conteneur: HTMLElement) =>
  Array.from(conteneur.querySelectorAll('.v5-kpi-v')).map((n) => n.textContent)

beforeEach(() => {
  localStorage.clear()
  // Bandeau de pilotage : /api/btp indisponible dans le test, le bandeau ne s'affiche pas.
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Statistiques BTP — documents et dépenses lus sous l\'identifiant de la fiche', () => {
  it('chiffre d\'affaires des factures payées, factures émises et devis de la société', () => {
    ranger(ARTISAN.id)
    const { container } = monter('stats')
    const [ca, chantiers, taux] = indicateurs(container)
    expect(ca).toBe(formatPrice(1200, 'fr'))
    // Facture payée + facture émise (statut de la base).
    expect(screen.getByText('2 factures émises')).toBeInTheDocument()
    expect(screen.getByText('1 devis au total')).toBeInTheDocument()
    expect(chantiers).toBe('1')
    expect(taux).toBe('100%')
  })

  it('les dépenses de la comptabilité alimentent la synthèse financière', () => {
    ranger(ARTISAN.id)
    monter('stats')
    expect(screen.getByText('Synthèse financière')).toBeInTheDocument()
    // getByText compare le texte de la page, espaces insécables ramenés à des espaces, à la chaîne telle quelle.
    expect(screen.getByText(formatPrice(300, 'fr').replace(/\s/g, ' '))).toBeInTheDocument()
  })

  it('rien sous l\'identifiant du compte n\'est lu à la place de la fiche', () => {
    ranger(ARTISAN.user_id as string)
    const { container } = monter('stats')
    expect(indicateurs(container)[0]).toBe(formatPrice(0, 'fr'))
    expect(screen.queryByText('Synthèse financière')).not.toBeInTheDocument()
  })
})

describe('Revenus BTP — factures lues sous l\'identifiant de la fiche', () => {
  it('encaissé, en attente (statut de la base compris) et encaissements récents', () => {
    ranger(ARTISAN.id)
    const { container } = monter('revenus')
    const [caAnnee, mois, enAttente, recouvrement] = indicateurs(container)
    expect(caAnnee).toBe(formatPrice(1200, 'fr'))
    expect(mois).toBe(formatPrice(1200, 'fr'))
    expect(enAttente).toBe(formatPrice(800, 'fr'))
    expect(recouvrement).toBe('60%')
    expect(screen.getByText('SCI Les Tilleuls')).toBeInTheDocument()
    expect(screen.getByText('SARL Durand')).toBeInTheDocument()
    expect(screen.queryByText('proDash.home.aucuneActivite')).not.toBeInTheDocument()
  })
})

describe('Artisan — lecture inchangée (même défaut signalé, hors de ce lot)', () => {
  it('l\'artisan lit toujours sous l\'identifiant du compte', () => {
    ranger(ARTISAN.user_id as string)
    const { container } = monter('stats', 'artisan')
    expect(indicateurs(container)[0]).toBe(formatPrice(1200, 'fr'))
  })

  it('une facture au statut de la base « pending » n\'est pas comptée comme envoyée côté artisan', () => {
    ranger(ARTISAN.user_id as string)
    monter('stats', 'artisan')
    expect(screen.getByText('1 factures émises')).toBeInTheDocument()
  })
})
