// Formulaire de devis et facture BTP (components/DevisFactureFormBTP.tsx) : le DOCUMENT suit la langue de la société
// (sa fiche, lib/btp/langue-documents.ts) — pays de TVA, valeurs par défaut, mentions légales, PDF — et l'ÉCRAN garde
// la sienne (libellés, aides, messages). Constat du 27/11/2026 : SUD TRAVAUX, société française, ouverte sur /pt,
// produisait des documents portugais (droit portugais compris) sous des numéros de la série française.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'

const langue = vi.hoisted(() => ({ locale: 'pt' as 'fr' | 'pt' }))
vi.mock('@/lib/i18n/context', async (original) => ({
  // traducteurPour réel : le PDF d'une société d'une autre langue que l'écran reçoit les vrais libellés de sa langue
  traducteurPour: (await original<typeof import('@/lib/i18n/context')>()).traducteurPour,
  useTranslation: () => ({ t: (cle: string) => `écran:${cle}`, locale: langue.locale }),
  useLocale: () => langue.locale,
}))
vi.mock('@/lib/supabase', async () => (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur())
vi.mock('@/lib/fetch-authentifie', async () => (await import('../helpers/mocks-formulaires-devis')).fetchAuthentifieVide())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))
const pdf = vi.hoisted(() => ({ entrees: [] as Array<Record<string, unknown>> }))
vi.mock('@/lib/pdf/devis-pdf-v3', () => ({
  generateDevisPdfV3: vi.fn(async (entree: Record<string, unknown>) => { pdf.entrees.push(entree); return { filename: 'x.pdf', fichier: new Uint8Array() } }),
}))

import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'

// Fiches telles que le tableau de bord les lit (profiles_artisan, select('*')) : la langue y figure toujours.
const SUD_TRAVAUX = {
  id: 'art-sud', company_name: 'SUD TRAVAUX', email: 'contact@exemple.fr', legal_form: 'SAS', language: 'fr',
  company_address: '115 Rue Claude Nicolas Ledoux, 13290 Aix-en-Provence',
} as ArtisanBasic
const SOCIETE_PT = {
  id: 'art-vc', company_name: 'CONSTRUCOES EXEMPLO LDA', email: 'geral@exemplo.pt', legal_form: 'Sociedade por Quotas (Lda.)',
  language: 'pt', company_address: 'Rua Direita 10, 4990-000 Ponte de Lima',
} as ArtisanBasic

const monter = (artisan: ArtisanBasic, initialData?: unknown) => render(
  <DevisFactureFormBTP artisan={artisan} services={[]} bookings={[]} onBack={vi.fn()} initialData={initialData as never} />,
)

/** Devis déjà émis : son PDF se télécharge sans réenregistrement. */
const devisEmis = (tvaRate: number) => ({
  id: '6f1c2a34-0000-4000-8000-00000000c033', savedAt: '2026-11-20T10:00:00.000Z', sentAt: '2026-11-20T10:00:00.000Z',
  docNumber: 'DEV-2026-033', status: 'envoye', docType: 'devis', clientName: 'SIGA',
  lines: [{ id: 1, description: 'Façade', qty: 1, unit: 'f', priceHT: 1000, tvaRate, totalHT: 1000 }], materialLines: [], fraisLines: [],
})

const options = (nom: string) => screen.queryAllByRole('option', { name: nom })

beforeEach(() => {
  localStorage.clear()
  langue.locale = 'pt'
  pdf.entrees.length = 0
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('société française ouverte sur /pt', () => {
  it('écran en portugais, document en français : défauts, TVA française, mentions françaises', () => {
    const { container } = monter(SUD_TRAVAUX)
    // L'écran reste celui de l'utilisateur
    expect(screen.getByText('Forma jurídica')).toBeInTheDocument()
    expect(screen.getByText('Descarregar PDF')).toBeInTheDocument()
    // Le document est celui d'une société française
    expect(screen.getByDisplayValue("3 × taux d'intérêt légal en vigueur")).toBeInTheDocument()
    expect(screen.getByDisplayValue('40 € (BtoB uniquement)')).toBeInTheDocument()
    expect(screen.getByDisplayValue("Main d'œuvre")).toBeInTheDocument()
    expect(options('5.5%').length).toBeGreaterThan(0)
    expect(options('23%')).toHaveLength(0)
    const mentions = container.querySelector('.dv-mentions')?.textContent || ''
    expect(mentions).toContain('SAS au capital de')
    expect(mentions).toContain('Devis gratuit — Conformément à l\'article L. 111-1 du Code de la consommation.')
    expect(mentions).toContain('articles 1792 et suivants du Code civil')
    expect(mentions).not.toMatch(/Lei n\.º|Código Civil|Decreto-Lei/)
  })

  it('PDF du formulaire en français, libellés français', async () => {
    monter(SUD_TRAVAUX, devisEmis(10))
    fireEvent.click(screen.getByText('Descarregar PDF'))
    await waitFor(() => expect(pdf.entrees).toHaveLength(1))
    const entree = pdf.entrees[0]
    expect(entree.locale).toBe('fr')
    expect((entree.localeFormats as { taxLabel: string }).taxLabel).toBe('TVA')
    expect((entree.t as (k: string) => string)('devis.designation')).toBe('Désignation')
  })
})

describe('société portugaise ouverte sur /fr', () => {
  it('écran en français, document en portugais : défauts, IVA portugais, mentions portugaises', () => {
    langue.locale = 'fr'
    const { container } = monter(SOCIETE_PT)
    expect(screen.getByText('Statut juridique')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Taxa de juro legal em vigor')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Mão de obra')).toBeInTheDocument()
    expect(options('23%').length).toBeGreaterThan(0)
    expect(options('5.5%')).toHaveLength(0)
    const mentions = container.querySelector('.dv-mentions')?.textContent || ''
    expect(mentions).toContain('Orçamento gratuito, conforme o artigo 8.º da Lei n.º 24/96')
    expect(mentions).not.toContain('Code de la consommation')
  })

  it('PDF du formulaire en portugais, libellés portugais', async () => {
    langue.locale = 'fr'
    monter(SOCIETE_PT, devisEmis(23))
    fireEvent.click(screen.getByText('Télécharger PDF'))
    await waitFor(() => expect(pdf.entrees).toHaveLength(1))
    const entree = pdf.entrees[0]
    expect(entree.locale).toBe('pt')
    expect((entree.localeFormats as { taxLabel: string }).taxLabel).toBe('IVA')
    expect((entree.t as (k: string) => string)('devis.designation')).toBe('Designação')
  })
})

describe('même langue que l\'écran : rien ne change', () => {
  it('société française sur /fr : traductions de l\'écran passées au PDF, comme avant', async () => {
    langue.locale = 'fr'
    monter(SUD_TRAVAUX, devisEmis(10))
    fireEvent.click(screen.getByText('Télécharger PDF'))
    await waitFor(() => expect(pdf.entrees).toHaveLength(1))
    expect(pdf.entrees[0].locale).toBe('fr')
    expect((pdf.entrees[0].t as (k: string) => string)('devis.designation')).toBe('écran:devis.designation')
  })
})
