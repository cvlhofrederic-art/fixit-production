// Forme juridique du formulaire artisan (components/DevisFactureForm.tsx). Demande de Frédéric du 22/11/2026 : côté
// artisan aussi, une forme portugaise du profil (« Sociedade por Quotas (Lda.) »…) ne devient plus « Entreprise
// Individuelle (EI) », sans mention d'identification ni contrôle du capital. Sur /pt, sans forme au profil :
// l'entrepreneur individuel portugais (ENI). Rendu français inchangé ; un document existant garde sa forme.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'

const langue = vi.hoisted(() => ({ locale: 'pt' as 'fr' | 'pt' }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: langue.locale }),
  useLocale: () => langue.locale,
}))
vi.mock('@/lib/supabase', async () => (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur())
vi.mock('@/lib/fetch-authentifie', async () => (await import('../helpers/mocks-formulaires-devis')).fetchAuthentifieVide())
vi.mock('sonner', async () => (await import('../helpers/mocks-formulaires-devis')).notifications())
vi.mock('@/lib/document-sync', async () => (await import('../helpers/mocks-formulaires-devis')).synchroMuette())
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))

import DevisFactureForm from '@/components/DevisFactureForm'

const monter = (legalForm?: string, initialData?: unknown) => render(
  <DevisFactureForm
    artisan={{ id: 'art-forme', company_name: 'Exemplo Obras', email: 'geral@exemplo.test', ...(legalForm ? { legal_form: legalForm } : {}) } as unknown as ArtisanBasic}
    services={[]}
    bookings={[]}
    onBack={vi.fn()}
    initialData={initialData as never}
  />,
)

/** Statut juridique affiché par le contrôle de conformité (« devis.statusLabel : … »). */
const statut = (racine: HTMLElement) => Array.from(racine.querySelectorAll('.v22-ref'))
  .find((e) => (e.textContent || '').startsWith('devis.statusLabel'))?.querySelector('span')?.textContent
/** Mentions légales de l'écran (clés de traduction : t est l'identité). */
const mentions = (racine: HTMLElement) => {
  const carte = Array.from(racine.querySelectorAll('.v22-card'))
    .find((c) => c.querySelector('.v22-card-title')?.textContent === 'devis.legalMentionsLabel')
  return Array.from(carte?.querySelectorAll('.v22-ref') ?? []).map((m) => m.textContent)
}

beforeEach(() => {
  localStorage.clear()
  langue.locale = 'pt'
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('formulaire artisan sur /pt', () => {
  it('Lda du profil : reconnue, mention de société avec capital et contrôle du capital', () => {
    const { container } = monter('Sociedade por Quotas (Lda.)')
    expect(statut(container)).toBe('Sociedade por Quotas (Lda.)')
    expect(mentions(container)).toContain('devis.legal.sarlCapital')
    expect(container.textContent).toContain('devis.complianceCapital')
  })

  it.each([
    ['Empresário em Nome Individual (ENI)', 'Empresário em Nome Individual (ENI)'],
    ['Unipessoal Lda.', 'Unipessoal Lda.'],
    ['Sociedade Anónima (SA)', 'Sociedade Anónima (SA)'],
  ])('forme « %s » du profil : %s', (forme, libelle) => {
    expect(statut(monter(forme).container)).toBe(libelle)
  })

  it('sans forme au profil : entrepreneur individuel portugais (ENI) et sa mention', () => {
    const { container } = monter()
    expect(statut(container)).toBe('Empresário em Nome Individual (ENI)')
    expect(mentions(container)).toContain('devis.legal.eiStatus')
  })

  it('document existant : il garde sa forme', () => {
    const { container } = monter('Sociedade por Quotas (Lda.)', { companyStatus: 'ei', docType: 'devis', docNumber: 'DEV-2026-001', lines: [] })
    expect(statut(container)).toBe('Entreprise Individuelle (EI)')
  })

  describe('forme lue par la vérification de l\'entreprise (/api/artisan-company)', () => {
    const verification = (legalForm: string) => vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(
      String(url).startsWith('/api/artisan-company') ? JSON.stringify({ company: { legalForm }, verified: true }) : '{}', { status: 200 })))

    it('Lda vérifiée : reconnue', async () => {
      verification('Sociedade por Quotas')
      const { container } = monter()
      await waitFor(() => expect(statut(container)).toBe('Sociedade por Quotas (Lda.)'))
    })

    it('ENI vérifié : reconnu, sans couper l\'IVA du modèle (régime par défaut inchangé)', async () => {
      // Modèle de l'artisan : IVA appliquée (le champ du numéro d'IVA n'apparaît qu'avec elle)
      localStorage.setItem('fixit_devis_template_art-forme', JSON.stringify({ tvaEnabled: true }))
      verification('Empresário em Nome Individual')
      const { container } = monter()
      expect(container.textContent).toContain('devis.taxNumberLabel')
      await waitFor(() => expect(statut(container)).toBe('Empresário em Nome Individual (ENI)'))
      expect(container.textContent).toContain('devis.taxNumberLabel')
    })
  })
})

describe('formulaire artisan sur /fr : comme avant', () => {
  beforeEach(() => { langue.locale = 'fr' })

  it.each([
    ['SARL', 'SARL'],
    ['Entreprise individuelle', 'Entreprise Individuelle (EI)'],
    [undefined, 'Entreprise Individuelle (EI)'],
  ])('forme %s du profil : %s', (forme, libelle) => {
    expect(statut(monter(forme).container)).toBe(libelle)
  })
})
