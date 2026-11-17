// tests/components/aj-signalement/logo-espaces-sans-logo.test.tsx
//
// Logo d'un cabinet client (demande de Hugo du 13/11/2026), non-régression : SANS logo (cabinet qui n'en a pas, ou
// migration 20261114 non appliquée), l'espace du cabinet (connexion, suivi, invitation, confirmation d'adresse) et la
// page publique ouverte par le QR code rendent EXACTEMENT le même DOM qu'avant le logo. Les instantanés ci-dessous ont
// été écrits sur le code d'avant le logo (commit 055e7f24) : ils ne doivent plus bouger.
// Supabase, sonner et fetch sont simulés : aucune requête réelle ; données fictives (exemple.test).

import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contexteConnexionCabinetQr } from '@/lib/aj-signalement/connexion-espace'
import { TEXTES_SIGNALEMENT_QR } from '@/lib/aj-signalement/textes'

const simul = vi.hoisted(() => ({ getUser: vi.fn(), signOut: vi.fn(), toastErreur: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: simul.getUser,
      signInWithPassword: vi.fn(),
      signOut: simul.signOut,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))
vi.mock('sonner', () => ({ toast: { error: simul.toastErreur, success: vi.fn() } }))

const { default: ConnexionEspaceQr } = await import('@/components/aj-signalement/espace/ConnexionEspaceQr')
const { default: InvitationAccesQr } = await import('@/components/aj-signalement/InvitationAccesQr')
const { default: ConfirmationAdresseQr } = await import('@/components/aj-signalement/ConfirmationAdresseQr')
const { default: AppSignalementQr } = await import('@/components/aj-signalement/AppSignalementQr')
const { default: EspaceAjSignalement } = await import('@/components/aj-signalement/espace/EspaceAjSignalement')

const CABINET = { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple' }
const JETON_LIEN = `${'a'.repeat(48)}.${'b'.repeat(64)}`
const JETON_QR = '0123456789abcdef0123456789abcdef'
const MOI = { profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: { ...CABINET, domaines: ['exemple.test'] } }
const LECTURE_LIEN = { nomCourt: 'Marie E.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test' }

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.clearAllMocks()
  simul.getUser.mockResolvedValue({ data: { user: null }, error: null })
  simul.signOut.mockResolvedValue({ error: null })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/lecture')) return json(LECTURE_LIEN)
    if (url === '/api/aj-signalement/moi') return json(MOI)
    if (url === '/api/aj-signalement/tableau') return json({ tableau: { coproprietes: [], signalements: [] } })
    return json({ error: 'introuvable' }, 404)
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sans logo : DOM identique à celui d’avant le logo', () => {
  it('connexion professionnelle du cabinet : en-tête de la carte (icône, nom du cabinet, titre)', async () => {
    window.history.replaceState(null, '', '/cabinet-exemple/connexion/')
    const { container } = render(<ConnexionEspaceQr contexte={contexteConnexionCabinetQr(CABINET)} />)
    await screen.findByRole('heading', { level: 1, name: 'Connexion professionnelle' })
    const carte = container.querySelector('.rounded-2xl') as HTMLElement
    expect([...carte.children].slice(0, 3)).toMatchInlineSnapshot(`
      [
        <div
          class="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-[#C9A84C] to-[#A8842A] text-[#0D1B2E]"
        >
          <svg
            aria-hidden="true"
            class="shrink-0 "
            fill="none"
            focusable="false"
            height="24"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
            viewBox="0 0 24 24"
            width="24"
          >
            <rect
              height="6"
              rx="1"
              width="6"
              x="4"
              y="4"
            />
            <rect
              height="6"
              rx="1"
              width="6"
              x="14"
              y="4"
            />
            <rect
              height="6"
              rx="1"
              width="6"
              x="4"
              y="14"
            />
            <path
              d="M14 14h3v3h-3z"
            />
            <path
              d="M20 14v2M17 20h3M20 18h.01"
            />
          </svg>
        </div>,
        <p
          class="mt-5 text-sm font-semibold uppercase tracking-[1.5px] text-[#6F5313]"
        >
          Cabinet Exemple
        </p>,
        <h1
          class="font-serif text-2xl text-[#0D1B2E] md:text-3xl"
        >
          Connexion professionnelle
        </h1>,
      ]
    `)
  })

  it('ouverture de l’accès (invitation) : carte complète, lien lu', async () => {
    window.history.replaceState(null, '', `/cabinet-exemple/invitation/#${JETON_LIEN}`)
    const { container } = render(<InvitationAccesQr identifiant="cabinet-exemple" />)
    await screen.findByText(/Marie E\./)
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="flex min-h-[70vh] items-center justify-center bg-[#F7F4EE] px-4 py-10"
        lang="fr"
      >
        <div
          class="w-full max-w-lg rounded-2xl border border-[#E4DDD0] bg-white p-6 shadow-sm md:p-8"
        >
          <h1
            class="font-serif text-2xl text-[#0D1B2E]"
          >
            Ouverture de votre accès
          </h1>
          <div
            class="mt-5 space-y-4"
          >
            <p
              class="text-base font-semibold text-[#0D1B2E]"
            >
              Marie E., gestionnaire chez Cabinet Exemple — adresse ma***@exemple.test
            </p>
            <p
              class="text-base text-[#1F2D3D]"
            >
              Choisissez votre mot de passe : il ouvre votre compte professionnel VitFix et l’espace AJ Signalement de votre cabinet, où vous suivez les signalements de vos copropriétés.
            </p>
            <form
              class="space-y-5"
              novalidate=""
            >
              <div>
                <label
                  class="mb-1.5 block text-base font-semibold text-[#0D1B2E]"
                  for="qr-invitation-mot-de-passe"
                >
                  Mot de passe
                </label>
                <div
                  class="relative"
                >
                  <input
                    aria-describedby="qr-invitation-mot-de-passe-aide"
                    autocomplete="new-password"
                    class="w-full rounded-xl border-2 border-[#E4DDD0] bg-white px-4 py-3 text-base text-[#0D1B2E] focus:border-[#C9A84C] focus:outline-none min-h-[44px] pr-14"
                    id="qr-invitation-mot-de-passe"
                    name="password"
                    required=""
                    type="password"
                    value=""
                  />
                  <button
                    aria-label="Afficher les mots de passe"
                    class="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[#4A5E78] hover:text-[#0D1B2E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      class="lucide lucide-eye"
                      fill="none"
                      height="20"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                      width="20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                      />
                    </svg>
                  </button>
                </div>
                <p
                  class="mt-1.5 text-sm text-[#4A5E78]"
                  id="qr-invitation-mot-de-passe-aide"
                >
                  8 caractères au moins, dont une majuscule, une minuscule et un chiffre.
                </p>
              </div>
              <div>
                <label
                  class="mb-1.5 block text-base font-semibold text-[#0D1B2E]"
                  for="qr-invitation-confirmation"
                >
                  Confirmez le mot de passe
                </label>
                <input
                  autocomplete="new-password"
                  class="w-full rounded-xl border-2 border-[#E4DDD0] bg-white px-4 py-3 text-base text-[#0D1B2E] focus:border-[#C9A84C] focus:outline-none min-h-[44px]"
                  id="qr-invitation-confirmation"
                  name="password-confirmation"
                  required=""
                  type="password"
                  value=""
                />
              </div>
              <div>
                <label
                  class="flex min-h-[44px] items-center gap-3 text-base text-[#0D1B2E]"
                >
                  <input
                    class="h-5 w-5 accent-[#C9A84C]"
                    id="qr-invitation-politique"
                    type="checkbox"
                  />
                  <span>
                    J’ai pris connaissance de la
                     
                    <a
                      class="underline underline-offset-4 hover:text-[#6F5313]"
                      href="/fr/confidentialite/"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      politique de confidentialité
                    </a>
                  </span>
                </label>
              </div>
              <div
                class="flex flex-col gap-3 sm:flex-row"
              >
                <button
                  class="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors min-h-[44px] px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C] disabled:opacity-50 disabled:cursor-not-allowed  bg-[#0D1B2E] text-white hover:bg-[#152338] border border-transparent flex-1"
                  type="submit"
                >
                  <svg
                    aria-hidden="true"
                    class="shrink-0 "
                    fill="none"
                    focusable="false"
                    height="18"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                    viewBox="0 0 24 24"
                    width="18"
                  >
                    <path
                      d="m5 12.5 4.5 4.5L19 7"
                    />
                  </svg>
                  <span>
                    Ouvrir mon accès
                  </span>
                </button>
                <button
                  class="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors min-h-[44px] px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C] disabled:opacity-50 disabled:cursor-not-allowed  bg-white text-[#0D1B2E] border border-[#C9B99A] hover:bg-[#F7F4EE] flex-1"
                  type="button"
                >
                  <span>
                    Ce n’est pas moi
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `)
  })

  it('confirmation d’adresse : carte complète, lien lu', async () => {
    window.history.replaceState(null, '', `/cabinet-exemple/confirmation-adresse/#${JETON_LIEN}`)
    const { container } = render(<ConfirmationAdresseQr identifiant="cabinet-exemple" />)
    await screen.findByText(/Marie E\./)
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="flex min-h-[70vh] items-center justify-center bg-[#F7F4EE] px-4 py-10"
        lang="fr"
      >
        <div
          class="w-full max-w-lg rounded-2xl border border-[#E4DDD0] bg-white p-6 shadow-sm md:p-8"
        >
          <h1
            class="font-serif text-2xl text-[#0D1B2E]"
          >
            Confirmation de votre adresse
          </h1>
          <div
            class="mt-5 space-y-4"
          >
            <p
              class="text-base font-semibold text-[#0D1B2E]"
            >
              Marie E., gestionnaire chez Cabinet Exemple — adresse ma***@exemple.test
            </p>
            <p
              class="text-base text-[#1F2D3D]"
            >
              Si c’est bien vous, confirmez votre adresse : vous recevrez les signalements de vos copropriétés (ils contiennent les coordonnées des résidents qui les déposent).
            </p>
            <div
              class="flex flex-col gap-3 sm:flex-row"
            >
              <button
                class="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors min-h-[44px] px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C] disabled:opacity-50 disabled:cursor-not-allowed  bg-[#0D1B2E] text-white hover:bg-[#152338] border border-transparent flex-1"
                type="button"
              >
                <svg
                  aria-hidden="true"
                  class="shrink-0 "
                  fill="none"
                  focusable="false"
                  height="18"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.8"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <path
                    d="m5 12.5 4.5 4.5L19 7"
                  />
                </svg>
                <span>
                  C’est moi : confirmer l’adresse
                </span>
              </button>
              <button
                class="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors min-h-[44px] px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C] disabled:opacity-50 disabled:cursor-not-allowed  bg-white text-[#0D1B2E] border border-[#C9B99A] hover:bg-[#F7F4EE] flex-1"
                type="button"
              >
                <span>
                  Ce n’est pas moi
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `)
  })

  it('page publique du QR code : enfants de la page et en-tête bleu nuit', () => {
    const { container } = render(
      <AppSignalementQr jeton={JETON_QR} copropriete={{ nom: 'Résidence Exemple', adresse: '1 rue Exemple, 13001 Marseille' }} langue="fr" />,
    )
    const page = container.firstChild as HTMLElement
    expect([...page.children].map((e) => e.tagName)).toEqual(['HEADER', 'MAIN', 'FOOTER'])
    expect(page.querySelector('header')).toMatchInlineSnapshot(`
      <header
        class="bg-[#0D1B2E] px-4 py-5 text-white md:py-7"
      >
        <div
          class="mx-auto w-full max-w-2xl"
        >
          <p
            class="flex items-center gap-2 text-sm font-semibold uppercase tracking-[1.5px] text-[#C9A84C]"
          >
            <svg
              aria-hidden="true"
              class="shrink-0 "
              fill="none"
              focusable="false"
              height="18"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
              viewBox="0 0 24 24"
              width="18"
            >
              <rect
                height="6"
                rx="1"
                width="6"
                x="4"
                y="4"
              />
              <rect
                height="6"
                rx="1"
                width="6"
                x="14"
                y="4"
              />
              <rect
                height="6"
                rx="1"
                width="6"
                x="4"
                y="14"
              />
              <path
                d="M14 14h3v3h-3z"
              />
              <path
                d="M20 14v2M17 20h3M20 18h.01"
              />
            </svg>
            <span>
              AJ Signalement
            </span>
          </p>
          <h1
            class="mt-2 font-serif text-2xl leading-tight md:text-3xl"
          >
            Résidence Exemple
          </h1>
          <p
            class="mt-1 text-base text-white/80"
          >
            1 rue Exemple, 13001 Marseille
          </p>
        </div>
      </header>
    `)
    expect(screen.getAllByRole('heading', { level: 2, name: TEXTES_SIGNALEMENT_QR.fr.titre }).length).toBeGreaterThan(0)
  })

  it('suivi du gestionnaire : en-tête de la barre latérale et en-tête de la page', async () => {
    simul.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'marie.exemple@exemple.test', app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' }, user_metadata: {} } },
      error: null,
    })
    window.history.replaceState(null, '', '/cabinet-exemple/suivi/')
    const { container } = render(<EspaceAjSignalement cabinet={CABINET} />)
    await screen.findByText('AJ Signalement · Cabinet Exemple', {}, { timeout: 5000 })
    expect(container.querySelector('aside > div')).toMatchInlineSnapshot(`
      <div
        class="flex h-20 items-center gap-3 border-b border-white/10 px-5"
      >
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#C9A84C] to-[#A8842A] text-[#0D1B2E]"
        >
          <svg
            aria-hidden="true"
            class="shrink-0 "
            fill="none"
            focusable="false"
            height="22"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
            viewBox="0 0 24 24"
            width="22"
          >
            <rect
              height="6"
              rx="1"
              width="6"
              x="4"
              y="4"
            />
            <rect
              height="6"
              rx="1"
              width="6"
              x="14"
              y="4"
            />
            <rect
              height="6"
              rx="1"
              width="6"
              x="4"
              y="14"
            />
            <path
              d="M14 14h3v3h-3z"
            />
            <path
              d="M20 14v2M17 20h3M20 18h.01"
            />
          </svg>
        </div>
        <div
          class="min-w-0"
        >
          <div
            class="font-serif text-lg leading-tight"
          >
            AJ Signalement
          </div>
          <div
            class="truncate text-sm font-semibold uppercase tracking-[1.5px] text-[#C9A84C]"
          >
            Cabinet Exemple
          </div>
        </div>
      </div>
    `)
    expect(container.querySelector('header')).toMatchInlineSnapshot(`
      <header
        class="sticky top-0 z-30 border-b border-[#E4DDD0] bg-white px-4 py-3 md:px-9"
      >
        <div
          class="flex items-center justify-between gap-3"
        >
          <div
            class="min-w-0"
          >
            <p
              class="truncate text-sm font-semibold uppercase tracking-[1.5px] text-[#6F5313]"
            >
              AJ Signalement · Cabinet Exemple
            </p>
            <h1
              class="truncate font-serif text-xl text-[#0D1B2E] outline-none md:text-2xl"
              tabindex="-1"
            >
              Tableau de bord
            </h1>
            <p
              class="truncate text-sm text-[#4A5E78]"
            >
              Vue d’ensemble des signalements de vos copropriétés
            </p>
          </div>
          <div
            class="flex shrink-0 flex-wrap items-center justify-end gap-2"
          >
            <button
              class="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors min-h-[44px] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C] disabled:opacity-50 disabled:cursor-not-allowed  bg-white text-[#0D1B2E] border border-[#C9B99A] hover:bg-[#F7F4EE] "
              type="button"
            >
              <svg
                aria-hidden="true"
                class="shrink-0 "
                fill="none"
                focusable="false"
                height="18"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
                viewBox="0 0 24 24"
                width="18"
              >
                <path
                  d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5"
                />
                <path
                  d="M15 8l4 4-4 4"
                />
                <path
                  d="M19 12H9"
                />
              </svg>
              <span>
                Se déconnecter
              </span>
            </button>
          </div>
        </div>
      </header>
    `)
  })
})
