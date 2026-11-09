// tests/components/pro-register-btp-forme-juridique.test.tsx
//
// Inscription société BTP (app/(commun)/pro/register, FormulaireProGenerique) : la forme juridique et
// l'identité légale vérifiées au SIRET doivent partir dans le profil (/api/auth/create-profile).
// Sans elles, profiles_artisan.legal_form restait vide et le formulaire de devis et facture BTP
// retombait sur « Entreprise Individuelle (EI) », mentions légales de l'EI comprises, pour une SAS.
// Parcours complet rejoué dans le formulaire, appels réseau simulés.

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { SECTEURS_BTP_FR } from '@/lib/btp-secteurs'
import { mapLegalFormToCode } from '@/lib/devis-utils'

const USER_ID = '550e8400-e29b-41d4-a716-446655440001'

const h = vi.hoisted(() => ({ signUp: vi.fn() }))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: 'fr', setLocale: vi.fn() }),
  useLocale: () => 'fr',
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/fr/pro/register/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signUp: h.signUp, getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn(), AnalyticsEventType: {} }))

import ProRegisterPage from '@/app/(commun)/pro/register/page'

type Appel = { url: string; init?: RequestInit }
let appels: Appel[] = []

function reponse(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })
}

function fauxFetch(url: string, init?: RequestInit): Promise<Response> {
  appels.push({ url, init })
  if (url.startsWith('/api/verify-siret')) {
    return Promise.resolve(reponse({
      verified: true,
      company: {
        name: 'BATI SUD', siret: '12345678900012', siren: '123456789', nafCode: '4120A',
        nafLabel: 'Construction de maisons individuelles', legalForm: 'SAS', address: '1 rue du Port',
        city: 'Marseille', postalCode: '13002', isActive: true,
      },
    }))
  }
  if (url === '/api/auth/create-profile') return Promise.resolve(reponse({ id: 'profil-btp-1' }))
  if (url === '/api/pro/register/finalize') return Promise.resolve(reponse({ ok: true }))
  if (url === '/api/pro/team/auto-init-gerant') return Promise.resolve(reponse({ ok: true }))
  return Promise.resolve(reponse({ error: `URL inattendue : ${url}` }, 404))
}

const corpsProfil = () => JSON.parse(String(appels.find((a) => a.url === '/api/auth/create-profile')?.init?.body))

async function sInscrireCommeSocieteBtp(changerForme?: string) {
  const { container } = render(<ProRegisterPage />)
  fireEvent.click(screen.getByText('register.orgBtpLabel'))

  // Étape 1 : SIRET vérifié, forme juridique préremplie depuis le registre, secteur
  fireEvent.change(screen.getByPlaceholderText('register.taxIdPlaceholder'), { target: { value: '12345678900012' } })
  fireEvent.click(screen.getByText('register.verify'))
  await screen.findByText('register.formLabel : SAS')
  const selectForme = screen.getByDisplayValue('SAS') as HTMLSelectElement
  expect(selectForme.value).toBe('sas')
  if (changerForme) fireEvent.change(selectForme, { target: { value: changerForme } })
  fireEvent.click(screen.getByText(SECTEURS_BTP_FR[0].label))
  fireEvent.click(screen.getByText('register.continue'))

  // Étape 2 : identité du dirigeant et pièces
  fireEvent.change(screen.getByPlaceholderText('Jean'), { target: { value: 'Paul' } })
  fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'Durand' } })
  fireEvent.change(screen.getByPlaceholderText('jean@masociete.fr'), { target: { value: 'paul@batisud.fr' } })
  const pdf = (nom: string) => new File(['%PDF-1.7'], nom, { type: 'application/pdf' })
  const fichiers = container.querySelectorAll('input[type="file"]')
  fireEvent.change(fichiers[0], { target: { files: [pdf('kbis.pdf')] } })
  fireEvent.change(fichiers[1], { target: { files: [pdf('cni-recto.pdf')] } })
  fireEvent.change(fichiers[2], { target: { files: [pdf('cni-verso.pdf')] } })
  fireEvent.click(screen.getByText('register.continue'))

  // Étape 3 : mot de passe et création
  fireEvent.change(screen.getByPlaceholderText('register.passwordPlaceholder'), { target: { value: 'Motdepasse#2026' } })
  fireEvent.change(screen.getByPlaceholderText('register.repeatPassword'), { target: { value: 'Motdepasse#2026' } })
  fireEvent.click(screen.getByText('register.createAccount'))

  await waitFor(() => expect(appels.map((a) => a.url)).toContain('/api/auth/create-profile'))
}

beforeEach(() => {
  appels = []
  h.signUp.mockReset().mockResolvedValue({
    data: { user: { id: USER_ID, identities: [{ id: USER_ID }] }, session: null },
    error: null,
  })
  vi.stubGlobal('fetch', vi.fn(fauxFetch))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Inscription société BTP : forme juridique et identité légale dans le profil', () => {
  it('envoie la forme juridique SAS, le SIREN, le NAF et l\'adresse du siège à la création du profil', async () => {
    await sInscrireCommeSocieteBtp()

    const corps = corpsProfil()
    expect(corps).toMatchObject({
      user_id: USER_ID,
      legal_form: 'SAS',
      siren: '123456789',
      naf_code: '4120A',
      naf_label: 'Construction de maisons individuelles',
      company_address: '1 rue du Port',
      company_city: 'Marseille',
      company_postal_code: '13002',
    })
    // Ce que lira le formulaire de devis et facture BTP : « SAS », pas « Entreprise Individuelle (EI) »
    expect(mapLegalFormToCode(corps.legal_form)).toBe('sas')
  })

  it('retient la forme choisie dans le formulaire quand elle diffère du registre', async () => {
    await sInscrireCommeSocieteBtp('sarl')

    const corps = corpsProfil()
    expect(corps.legal_form).toBe('SARL')
    expect(mapLegalFormToCode(corps.legal_form)).toBe('sarl')
  })
})
