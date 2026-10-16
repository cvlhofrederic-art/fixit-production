// tests/components/pro-register-artisan-sans-session.test.tsx
//
// Inscription artisan (app/pro/register, FormulaireArtisan) quand la confirmation d'e-mail
// est active : supabase.auth.signUp ne renvoie pas de session. Parcours complet rejoué dans
// le formulaire, appels réseau simulés.
// - Pas d'appel à /api/auth/init-role sans session (il répondait 401) et donc plus
//   d'avertissement « Initialisation du compte incomplète » affiché à tort : le rôle est posé
//   côté base par le trigger trg_sync_user_role.
// - Avec une session, init-role est appelé et son échec réel reste signalé.
// - Pièces, motifs et parrainage partent vers les routes sans session, et le bandeau
//   « Parrainé par » s'affiche.

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

const h = vi.hoisted(() => ({
  signUp: vi.fn(),
  warning: vi.fn(),
  initRoleOk: true,
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

import ProRegisterPage from '@/app/pro/register/page'

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
        name: 'DURAND PLOMBERIE', siret: '12345678900012', siren: '123456789', nafCode: '4322A',
        nafLabel: 'Plomberie', legalForm: 'EI', address: '1 rue du Port', city: 'Marseille', postalCode: '13002', isActive: true,
      },
    }))
  }
  if (url === '/api/verify-id') return Promise.resolve(reponse({ status: 'verified', details: [], score: 90 }))
  if (url === '/api/auth/init-role') return Promise.resolve(h.initRoleOk ? reponse({ success: true }) : reponse({ error: 'Erreur serveur' }, 500))
  if (url === '/api/auth/create-profile') return Promise.resolve(reponse({ id: 'profil-artisan-1' }))
  if (url === '/api/pro/register/finalize-artisan') return Promise.resolve(reponse({ ok: true }))
  if (url === '/api/pro/register/motifs-artisan') return Promise.resolve(reponse({ success: true, count: 10 }))
  if (url === '/api/pro/register/parrainage-artisan') {
    return Promise.resolve(reponse({ success: true, referral: true, parrain_name: 'Martin Électricité' }))
  }
  if (url === '/api/profile/specialties') return Promise.resolve(reponse({ success: true }))
  return Promise.resolve(reponse({ error: `URL inattendue : ${url}` }, 404))
}

const urls = () => appels.map((a) => a.url)
const corpsJson = (url: string) => JSON.parse(String(appels.find((a) => a.url === url)?.init?.body))

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

  const pdf = (nom: string) => new File(['%PDF-1.7'], nom, { type: 'application/pdf' })
  const fichiers = container.querySelectorAll('input[type="file"]')
  fireEvent.change(fichiers[0], { target: { files: [pdf('kbis.pdf')] } })
  fireEvent.change(fichiers[1], { target: { files: [pdf('cni-recto.pdf')] } })
  fireEvent.change(fichiers[2], { target: { files: [pdf('cni-verso.pdf')] } })

  fireEvent.change(screen.getByPlaceholderText('register.passwordMin'), { target: { value: 'Motdepasse#2026' } })
  fireEvent.change(screen.getByPlaceholderText('register.repeatPwd'), { target: { value: 'Motdepasse#2026' } })
  fireEvent.click(screen.getByText('register.continueOffer'))

  fireEvent.click(await screen.findByText('register.chooseFreemium'))
  await screen.findByText('register.successTitle')
}

beforeEach(() => {
  appels = []
  h.initRoleOk = true
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
