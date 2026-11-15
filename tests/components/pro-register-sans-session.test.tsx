// tests/components/pro-register-sans-session.test.tsx
//
// Inscription pro (app/(commun)/pro/register) quand la confirmation d'e-mail est active :
// supabase.auth.signUp ne renvoie pas de session. Parcours complets rejoués dans le formulaire,
// appels réseau simulés.
//
// Artisan (FormulaireArtisan) :
// - Pas d'appel à /api/auth/init-role sans session (il répondait 401) et donc plus
//   d'avertissement « Initialisation du compte incomplète » affiché à tort : le rôle est posé
//   côté base par le trigger trg_sync_user_role.
// - Avec une session, init-role est appelé et son échec réel reste signalé.
// - Pièces, motifs et parrainage partent vers les routes sans session, et le bandeau
//   « Parrainé par » s'affiche.
//
// Société BTP (FormulaireProGenerique) : la forme juridique et l'identité légale vérifiées au SIRET
// partent dans le profil (/api/auth/create-profile). Sans elles, profiles_artisan.legal_form restait
// vide et le devis BTP affichait « Entreprise Individuelle (EI) » pour une SAS. Un entrepreneur
// individuel garde le libellé du registre (le sélecteur BTP le préremplissait en « EURL »), et une
// nouvelle vérification de SIRET efface la forme du précédent.

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { SECTEURS_BTP_FR } from '@/lib/btp-secteurs'
import { mapLegalFormToCode } from '@/lib/devis-utils'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

const SOCIETE_ARTISAN = {
  name: 'DURAND PLOMBERIE', siret: '12345678900012', siren: '123456789', nafCode: '4322A',
  nafLabel: 'Plomberie', legalForm: 'EI', address: '1 rue du Port', city: 'Marseille', postalCode: '13002', isActive: true,
}
const SOCIETE_SAS = {
  name: 'BATI SUD', siret: '12345678900012', siren: '123456789', nafCode: '4120A',
  nafLabel: 'Construction de maisons individuelles', legalForm: 'SAS', address: '1 rue du Port',
  city: 'Marseille', postalCode: '13002', isActive: true,
}

const h = vi.hoisted(() => ({
  signUp: vi.fn(),
  warning: vi.fn(),
  initRoleOk: true,
  societe: {} as Record<string, unknown>,
}))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: 'fr', setLocale: vi.fn() }),
  useLocale: () => 'fr',
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/fr/pro/register/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams('ref=PARRAIN1'),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signUp: h.signUp, getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock('sonner', () => ({ toast: { warning: h.warning, error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn(), AnalyticsEventType: {} }))

import ProRegisterPage from '@/app/(commun)/pro/register/page'

type Appel = { url: string; init?: RequestInit }
let appels: Appel[] = []

function reponse(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })
}

function fauxFetch(url: string, init?: RequestInit): Promise<Response> {
  appels.push({ url, init })
  if (url.startsWith('/api/verify-siret')) return Promise.resolve(reponse({ verified: true, company: h.societe }))
  if (url === '/api/verify-id') return Promise.resolve(reponse({ status: 'verified', details: [], score: 90 }))
  if (url === '/api/auth/init-role') return Promise.resolve(h.initRoleOk ? reponse({ success: true }) : reponse({ error: 'Erreur serveur' }, 500))
  if (url === '/api/auth/create-profile') return Promise.resolve(reponse({ id: 'profil-1' }))
  if (url === '/api/pro/register/finalize-artisan') return Promise.resolve(reponse({ ok: true }))
  if (url === '/api/pro/register/finalize') return Promise.resolve(reponse({ ok: true }))
  if (url === '/api/pro/team/auto-init-gerant') return Promise.resolve(reponse({ ok: true }))
  if (url === '/api/pro/register/motifs-artisan') return Promise.resolve(reponse({ success: true, count: 10 }))
  if (url === '/api/pro/register/parrainage-artisan') {
    return Promise.resolve(reponse({ success: true, referral: true, parrain_name: 'Martin Électricité' }))
  }
  if (url === '/api/profile/specialties') return Promise.resolve(reponse({ success: true }))
  return Promise.resolve(reponse({ error: `URL inattendue : ${url}` }, 404))
}

const urls = () => appels.map((a) => a.url)
const corpsJson = (url: string) => JSON.parse(String(appels.find((a) => a.url === url)?.init?.body))
const pdf = (nom: string) => new File(['%PDF-1.7'], nom, { type: 'application/pdf' })

function deposerPieces(container: HTMLElement) {
  const fichiers = container.querySelectorAll('input[type="file"]')
  fireEvent.change(fichiers[0], { target: { files: [pdf('kbis.pdf')] } })
  fireEvent.change(fichiers[1], { target: { files: [pdf('cni-recto.pdf')] } })
  fireEvent.change(fichiers[2], { target: { files: [pdf('cni-verso.pdf')] } })
}

async function sInscrireCommeArtisan() {
  const { container } = render(<ProRegisterPage />)
  fireEvent.click(screen.getByText('register.orgArtisanLabel'))

  fireEvent.change(screen.getByPlaceholderText('Jean'), { target: { value: 'Paul' } })
  fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'Durand' } })
  fireEvent.change(screen.getByPlaceholderText('pro@email.com'), { target: { value: 'paul@exemple.fr' } })
  fireEvent.change(screen.getByPlaceholderText('register.taxIdPlaceholder'), { target: { value: '12345678900012' } })
  fireEvent.click(screen.getByText('register.verify'))
  // Métier pré-coché depuis le code NAF 4322A (plomberie)
  await screen.findByText('✅ DURAND PLOMBERIE')

  deposerPieces(container)

  fireEvent.change(screen.getByPlaceholderText('register.passwordMin'), { target: { value: 'Motdepasse#2026' } })
  fireEvent.change(screen.getByPlaceholderText('register.repeatPwd'), { target: { value: 'Motdepasse#2026' } })
  fireEvent.click(screen.getByText('register.continueOffer'))

  fireEvent.click(await screen.findByText('register.chooseFreemium'))
  await screen.findByText('register.successTitle')
}

/** Étape 1 du parcours société BTP : choix de l'organisation, SIRET vérifié. Rend le sélecteur de forme. */
async function verifierSocieteBtp() {
  const rendu = render(<ProRegisterPage />)
  fireEvent.click(screen.getByText('register.orgBtpLabel'))
  fireEvent.change(screen.getByPlaceholderText('register.taxIdPlaceholder'), { target: { value: '12345678900012' } })
  fireEvent.click(screen.getByText('register.verify'))
  await screen.findByText(`✅ ${String(h.societe.name)}`)
  return { ...rendu, selectForme: rendu.container.querySelectorAll('select')[0] as HTMLSelectElement }
}

async function sInscrireCommeSocieteBtp(changerForme?: string) {
  const { container, selectForme } = await verifierSocieteBtp()
  if (changerForme) fireEvent.change(selectForme, { target: { value: changerForme } })
  fireEvent.click(screen.getByText(SECTEURS_BTP_FR[0].label))
  fireEvent.click(screen.getByText('register.continue'))

  // Étape 2 : identité du dirigeant et pièces
  fireEvent.change(screen.getByPlaceholderText('Jean'), { target: { value: 'Paul' } })
  fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'Durand' } })
  fireEvent.change(screen.getByPlaceholderText('jean@masociete.fr'), { target: { value: 'paul@batisud.fr' } })
  deposerPieces(container)
  fireEvent.click(screen.getByText('register.continue'))

  // Étape 3 : mot de passe et création
  fireEvent.change(screen.getByPlaceholderText('register.passwordPlaceholder'), { target: { value: 'Motdepasse#2026' } })
  fireEvent.change(screen.getByPlaceholderText('register.repeatPassword'), { target: { value: 'Motdepasse#2026' } })
  fireEvent.click(screen.getByText('register.createAccount'))

  await waitFor(() => expect(urls()).toContain('/api/auth/create-profile'))
  return corpsJson('/api/auth/create-profile')
}

beforeEach(() => {
  appels = []
  h.initRoleOk = true
  h.societe = SOCIETE_ARTISAN
  h.warning.mockReset()
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

describe('Inscription artisan sans session (confirmation d\'e-mail active)', () => {
  it("n'appelle pas init-role et n'affiche plus l'avertissement « Initialisation du compte incomplète »", async () => {
    await sInscrireCommeArtisan()

    expect(urls()).not.toContain('/api/auth/init-role')
    expect(h.warning).not.toHaveBeenCalled()
  })

  it('envoie pièces, motifs et parrainage aux routes sans session et affiche le bandeau « Parrainé par »', async () => {
    await sInscrireCommeArtisan()

    expect(urls()).toEqual(expect.arrayContaining([
      '/api/auth/create-profile',
      '/api/pro/register/finalize-artisan',
      '/api/pro/register/motifs-artisan',
      '/api/pro/register/parrainage-artisan',
    ]))
    expect(urls()).not.toContain('/api/seed-motifs')
    expect(urls()).not.toContain('/api/referral/signup')
    expect(corpsJson('/api/pro/register/motifs-artisan')).toEqual({ user_id: USER_ID })
    expect(corpsJson('/api/pro/register/parrainage-artisan')).toEqual({ code: 'PARRAIN1', user_id: USER_ID })
    expect(screen.getByText('🎁 Parrainé par Martin Électricité')).toBeTruthy()
  })
})

describe('Inscription artisan avec session (confirmation d\'e-mail désactivée)', () => {
  beforeEach(() => {
    h.signUp.mockResolvedValue({
      data: { user: { id: USER_ID, identities: [{ id: USER_ID }] }, session: { access_token: 'jeton-artisan' } },
      error: null,
    })
  })

  it('appelle init-role avec le jeton de la session, sans avertissement quand il réussit', async () => {
    await sInscrireCommeArtisan()

    const initRole = appels.find((a) => a.url === '/api/auth/init-role')
    expect((initRole?.init?.headers as Record<string, string>).Authorization).toBe('Bearer jeton-artisan')
    expect(corpsJson('/api/auth/init-role')).toEqual({ role: 'artisan' })
    expect(h.warning).not.toHaveBeenCalled()
  })

  it("garde l'avertissement quand init-role échoue vraiment", async () => {
    h.initRoleOk = false

    await sInscrireCommeArtisan()

    expect(h.warning).toHaveBeenCalledTimes(1)
    expect(h.warning.mock.calls[0][0]).toContain('Initialisation du compte incomplète')
  })
})

describe('Inscription société BTP : forme juridique et identité légale dans le profil', () => {
  beforeEach(() => {
    h.societe = SOCIETE_SAS
  })

  it('envoie la forme juridique SAS, le SIREN, le NAF et l\'adresse du siège à la création du profil', async () => {
    const corps = await sInscrireCommeSocieteBtp()

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
    const corps = await sInscrireCommeSocieteBtp('sarl')

    expect(corps.legal_form).toBe('SARL')
    expect(mapLegalFormToCode(corps.legal_form)).toBe('sarl')
  })

  it('garde « Entrepreneur individuel » du registre, même quand le sélecteur propose EURL', async () => {
    h.societe = { ...SOCIETE_SAS, name: 'PAUL DURAND', legalForm: 'Entrepreneur individuel' }

    const corps = await sInscrireCommeSocieteBtp()

    expect(corps.legal_form).toBe('Entrepreneur individuel')
    expect(mapLegalFormToCode(corps.legal_form)).toBe('ei')
  })

  it('efface la forme du SIRET précédent quand un autre SIRET est vérifié', async () => {
    const { selectForme } = await verifierSocieteBtp()
    expect(selectForme.value).toBe('sas')

    h.societe = { ...SOCIETE_SAS, name: 'CHANTIERS NORD', legalForm: '' }
    fireEvent.click(screen.getByText('register.verify'))
    await screen.findByText('✅ CHANTIERS NORD')

    expect(selectForme.value).toBe('')
  })
})
