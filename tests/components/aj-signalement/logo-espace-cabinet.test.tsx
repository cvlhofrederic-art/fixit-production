// tests/components/aj-signalement/logo-espace-cabinet.test.tsx
//
// Logo d'un cabinet client dans l'espace du cabinet (demande de Hugo du 13/11/2026 ; brouillon soumis à Frédéric) :
//   - connexion professionnelle (vitfix.io/<identifiant>/connexion/) : le logo À LA PLACE de l'icône dorée, en haut de
//     la carte blanche ; nom du cabinet et titre inchangés ;
//   - ouverture de l'accès (/invitation/) et confirmation d'adresse (/confirmation-adresse/) : le logo en haut de la
//     carte, au-dessus du titre, dès l'ouverture (avant la lecture du lien) ;
//   - suivi du gestionnaire (/suivi/) : le logo dans l'en-tête blanc de la page, à partir de 640 px (jamais sur la barre
//     latérale bleu nuit, où un logo sombre serait illisible), d'après GET /moi ; espace global du super admin : aucun ;
//   - texte alternatif = nom du cabinet ; image de la route publique versionnée, dimensions réservées (aucun décalage
//     au chargement), aucune adresse d'origine transmise (referrerpolicy no-referrer) ;
// Pages serveur : tests/components/aj-signalement/logo-pages-espace-cabinet.test.tsx.
// Le DOM sans logo est figé par tests/components/aj-signalement/logo-espaces-sans-logo.test.tsx.
// Supabase, sonner, fetch et les lectures serveur sont simulés ; données fictives (exemple.test).

import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contexteConnexionCabinetQr } from '@/lib/aj-signalement/connexion-espace'

const simul = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  toastErreur: vi.fn(),
}))

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
const { default: EspaceAjSignalement } = await import('@/components/aj-signalement/espace/EspaceAjSignalement')

const CABINET = { identifiant: 'cabinet-exemple', nom: 'Cabinet Exemple' }
const VERSION = '0123456789abcdef'
const SRC = `/api/aj-signalement/logo/cabinet-exemple/?v=${VERSION}`
/** Logo tel que la page serveur le passe (logoPageQr) : 800 × 296 px. */
const LOGO = { src: SRC, alt: 'Cabinet Exemple', largeur: 800, hauteur: 296 }
const JETON_LIEN = `${'a'.repeat(48)}.${'b'.repeat(64)}`
const LECTURE_LIEN = { nomCourt: 'Marie E.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test' }

let moi: unknown = null
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.clearAllMocks()
  simul.getUser.mockResolvedValue({ data: { user: null }, error: null })
  simul.signOut.mockResolvedValue({ error: null })
  moi = { profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: { ...CABINET, domaines: ['exemple.test'], logo: { version: VERSION, largeur: 800, hauteur: 296 } } }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/lecture')) return json(LECTURE_LIEN)
    if (url === '/api/aj-signalement/moi') return json(moi)
    if (url === '/api/aj-signalement/tableau') return json({ tableau: { coproprietes: [], signalements: [] } })
    return json({ error: 'introuvable' }, 404)
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** L'image du logo : nom du cabinet en texte alternatif, adresse versionnée, place réservée, sans Referer. */
function expectLogo(image: HTMLElement, largeur: number, hauteur: number) {
  expect(image.tagName).toBe('IMG')
  expect(image).toHaveAttribute('src', SRC)
  expect(image).toHaveAttribute('alt', 'Cabinet Exemple')
  expect(image).toHaveAttribute('width', String(largeur))
  expect(image).toHaveAttribute('height', String(hauteur))
  expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
}

describe('connexion professionnelle du cabinet', () => {
  it('le logo À LA PLACE de l’icône dorée, en haut de la carte ; nom du cabinet et titre inchangés', async () => {
    window.history.replaceState(null, '', '/cabinet-exemple/connexion/')
    const { container } = render(<ConnexionEspaceQr contexte={contexteConnexionCabinetQr(CABINET, LOGO)} />)
    await screen.findByRole('heading', { level: 1, name: 'Connexion professionnelle' })
    const carte = container.querySelector('.rounded-2xl') as HTMLElement
    const [premier, nom, titre] = [...carte.children] as HTMLElement[]
    expectLogo(premier, 130, 48)
    expect(carte.querySelector('.bg-gradient-to-br')).toBeNull()
    expect(nom).toHaveTextContent('Cabinet Exemple')
    expect(titre.tagName).toBe('H1')
    expect(screen.getAllByRole('img', { name: 'Cabinet Exemple' })).toHaveLength(1)
  })

  it('contexte : clé « logo » seulement quand il y en a un (contexte d’avant sinon)', () => {
    expect(contexteConnexionCabinetQr(CABINET, LOGO)).toEqual({
      nom: 'Cabinet Exemple', espace: { fr: '/cabinet-exemple/suivi/', pt: '/cabinet-exemple/suivi/' }, cabinet: { identifiant: 'cabinet-exemple' }, logo: LOGO,
    })
    for (const sans of [contexteConnexionCabinetQr(CABINET, null), contexteConnexionCabinetQr(CABINET)]) {
      expect(Object.keys(sans).sort()).toEqual(['cabinet', 'espace', 'nom'])
    }
  })
})

describe('ouverture de l’accès et confirmation d’adresse', () => {
  it.each([
    ['ouverture de l’accès', 'invitation', (logo?: typeof LOGO) => <InvitationAccesQr identifiant="cabinet-exemple" logo={logo} />],
    ['confirmation d’adresse', 'confirmation-adresse', (logo?: typeof LOGO) => <ConfirmationAdresseQr identifiant="cabinet-exemple" logo={logo} />],
  ])('%s : le logo en haut de la carte, au-dessus du titre, dès l’ouverture puis une fois le lien lu', async (_cas, chemin, rendre) => {
    window.history.replaceState(null, '', `/cabinet-exemple/${chemin}/#${JETON_LIEN}`)
    const { container } = render(rendre(LOGO))
    const carte = container.querySelector('.rounded-2xl') as HTMLElement
    expectLogo(carte.children[0] as HTMLElement, 130, 48)
    expect(carte.children[1].tagName).toBe('H1')
    await screen.findByText(/Marie E\./)
    expectLogo(carte.children[0] as HTMLElement, 130, 48)
    expect(screen.getAllByRole('img', { name: 'Cabinet Exemple' })).toHaveLength(1)
  })

  it.each([
    ['ouverture de l’accès', () => <InvitationAccesQr identifiant="cabinet-exemple" logo={null} />],
    ['confirmation d’adresse', () => <ConfirmationAdresseQr identifiant="cabinet-exemple" logo={null} />],
  ])('%s, logo null : aucune image', (_cas, rendre) => {
    const { container } = render(rendre())
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('suivi du gestionnaire', () => {
  const gestionnaire = () => simul.getUser.mockResolvedValue({
    data: { user: { id: 'u1', email: 'marie.exemple@exemple.test', app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' }, user_metadata: {} } },
    error: null,
  })

  it('logo de son cabinet (GET /moi) dans l’en-tête blanc de la page ; barre latérale bleu nuit inchangée', async () => {
    gestionnaire()
    window.history.replaceState(null, '', '/cabinet-exemple/suivi/')
    const { container } = render(<EspaceAjSignalement cabinet={CABINET} />)
    await screen.findByText('AJ Signalement · Cabinet Exemple', {}, { timeout: 5000 })
    const entete = container.querySelector('header') as HTMLElement
    const image = within(entete).getByRole('img', { name: 'Cabinet Exemple' })
    expectLogo(image, 108, 40)
    // À partir de 640 px seulement : sur téléphone, le titre de la vue serait tronqué (essai à 375 px).
    expect(image.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'sm:block']))
    expect(image.className.split(' ')).not.toContain('block')
    expect(within(entete).getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect((container.querySelector('aside') as HTMLElement).querySelector('img')).toBeNull()
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('espace global du super admin : aucun logo (aucune lecture de /moi)', async () => {
    simul.getUser.mockResolvedValue({ data: { user: { id: 'u0', email: 'admin@exemple.test', app_metadata: { role: 'super_admin' }, user_metadata: {} } }, error: null })
    window.history.replaceState(null, '', '/fr/aj-signalement/')
    const { container } = render(<EspaceAjSignalement />)
    await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' }, { timeout: 5000 })
    expect(container.querySelector('img')).toBeNull()
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).not.toContain('/api/aj-signalement/moi')
  })

  it('cabinet sans logo (clé absente de /moi) : aucune image', async () => {
    gestionnaire()
    moi = { profil: 'gestionnaire', nom: 'Marie Exemple', cabinet: { ...CABINET, domaines: ['exemple.test'] } }
    window.history.replaceState(null, '', '/cabinet-exemple/suivi/')
    const { container } = render(<EspaceAjSignalement cabinet={CABINET} />)
    await screen.findByText('AJ Signalement · Cabinet Exemple', {}, { timeout: 5000 })
    expect(container.querySelector('img')).toBeNull()
  })
})
