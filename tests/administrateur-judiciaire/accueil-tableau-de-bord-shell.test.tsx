import './fuseau-paris'
import 'fake-indexeddb/auto'
import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen, within, type RenderResult } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFixy } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/useFixy'
import { statutEcran } from '@/components/administrateur-judiciaire/modules/registry'
import {
  LIBELLES_ROUTES,
  NB_TACHES_ECHEANCE_PROCHE,
  REDIRECTIONS_ROUTES,
  ROUTE_ACCUEIL,
  SECTIONS_NAVIGATION,
  routeRedirigee,
} from '@/components/administrateur-judiciaire/shell/nav-config'
import { MODULES_PALETTE, Shell } from '@/components/administrateur-judiciaire/shell/Shell'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { porteeRoute } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Décision de Hugo du 29/10/2026 : « enlève le Aujourd'hui, c'est le doublon de la page d'accueil ». Le Tableau de bord
 * devient la page d'accueil (route par défaut) ; « Aujourd'hui » (route « cockpit ») quitte le menu, la palette ⌘K et
 * le fil d'Ariane ; un ancien lien #cockpit ouvre le Tableau de bord au lieu d'un écran mort.
 */

// Écrans du registre remplacés par un écran factice : seul compte ici l'écran retenu par le Shell.
vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return <div data-testid="ecran-registre" />
    },
}))

const AUJOURDHUI = "Aujourd'hui"
const CLE_RECENTS = 'vitfix.aj.recents'

beforeAll(async () => {
  localStorage.clear()
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
})

beforeEach(() => {
  localStorage.clear()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  placerAncre('')
})

afterEach(() => {
  cleanup()
  placerAncre('')
})

/** Place l'ancre sans déclencher « hashchange » (comme à l'ouverture d'un lien). */
function placerAncre(ancre: string): void {
  window.history.replaceState(null, '', ancre ? `#${ancre}` : window.location.pathname)
}

async function monterShell(ancre = ''): Promise<RenderResult> {
  placerAncre(ancre)
  let rendu: RenderResult | undefined
  await act(async () => {
    rendu = render(
      <ToastProvider>
        <Shell />
      </ToastProvider>,
    )
  })
  return rendu as RenderResult
}

async function suivreAncre(ancre: string): Promise<void> {
  placerAncre(ancre)
  await act(async () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

const filAriane = (rendu: RenderResult) => rendu.container.querySelector('.crumb b')?.textContent
const filArianeMobile = (rendu: RenderResult) => rendu.container.querySelector('.crumb-mobile b')?.textContent
const menu = () => screen.getByRole('complementary', { name: 'Navigation principale' })
/** Boutons d'entrée du menu (hors épingles), avec leur libellé. */
const entreesMenu = () =>
  Array.from(menu().querySelectorAll<HTMLButtonElement>('button.nav-item')).map((bouton) => ({
    bouton,
    libelle: bouton.querySelector('span')?.textContent ?? '',
  }))
const entreeMenu = (libelle: string) => entreesMenu().find((entree) => entree.libelle === libelle)?.bouton
const palette = () => screen.queryByRole('dialog', { name: 'Palette de commandes' })
const libellesOptionsPalette = () =>
  within(palette() as HTMLElement)
    .queryAllByRole('option')
    .map((option) => option.querySelector('.cmdk-item-label')?.textContent)

async function ouvrirPalette(requete = ''): Promise<void> {
  await act(async () => {
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
  })
  if (requete)
    await act(async () => {
      fireEvent.change(within(palette() as HTMLElement).getByRole('textbox', { name: 'Rechercher' }), {
        target: { value: requete },
      })
    })
}

describe('Configuration de la navigation — « Aujourd’hui » retiré', () => {
  const entrees = SECTIONS_NAVIGATION.flatMap((section) => section.items)

  it('ni route « cockpit » ni libellé « Aujourd’hui » dans le menu, le fil d’Ariane et la palette', () => {
    expect(entrees.map((entree) => entree[0])).not.toContain('cockpit')
    expect(entrees.map((entree) => entree[1])).not.toContain(AUJOURDHUI)
    expect(Object.hasOwn(LIBELLES_ROUTES, 'cockpit')).toBe(false)
    expect(Object.values(LIBELLES_ROUTES)).not.toContain(AUJOURDHUI)
    expect(MODULES_PALETTE.map((module) => module.id)).not.toContain('cockpit')
    expect(MODULES_PALETTE.map((module) => module.label)).not.toContain(AUJOURDHUI)
  })

  it('« Tableau de bord » ouvre la section « Mandat judiciaire » et reprend la pastille des échéances proches', () => {
    const section = SECTIONS_NAVIGATION.find((candidate) => candidate.title === 'Mandat judiciaire')
    expect(section?.items[0]).toEqual(['dashboard', 'Tableau de bord', 'grid', NB_TACHES_ECHEANCE_PROCHE])
    expect(NB_TACHES_ECHEANCE_PROCHE).toBeGreaterThan(0)
  })
})

describe('Page d’accueil et redirection de l’ancienne page « Aujourd’hui »', () => {
  it('la page d’accueil est le Tableau de bord', () => {
    expect(ROUTE_ACCUEIL).toBe('dashboard')
    expect(LIBELLES_ROUTES[ROUTE_ACCUEIL]).toBe('Tableau de bord')
  })

  it('« cockpit » est redirigé vers le Tableau de bord ; toute autre route est inchangée', () => {
    expect(routeRedirigee('cockpit')).toBe('dashboard')
    for (const route of ['dashboard', 'copros', 'mandats', 'inconnu', ''])
      expect(routeRedirigee(route)).toBe(route)
  })

  it('une clé héritée d’Object.prototype n’est pas une redirection', () => {
    for (const route of ['constructor', '__proto__', 'toString', 'hasOwnProperty'])
      expect(routeRedirigee(route)).toBe(route)
  })

  it('chaque redirection mène à une entrée du menu et garde la portée générale (tous les mandats)', () => {
    expect([...REDIRECTIONS_ROUTES.keys()]).toEqual(['cockpit'])
    for (const [ancienne, cible] of REDIRECTIONS_ROUTES) {
      expect(Object.hasOwn(LIBELLES_ROUTES, cible)).toBe(true)
      expect(porteeRoute(ancienne)).toBe('generale')
      expect(porteeRoute(cible)).toBe('generale')
    }
  })

  it('le Tableau de bord lit le moteur de délais légaux : écran « partiel » comme l’était « Aujourd’hui »', () => {
    expect(statutEcran('dashboard')).toBe('partiel')
  })
})

describe('Shell — le Tableau de bord, page d’accueil', () => {
  it('sans ancre : le Tableau de bord s’affiche, actif dans le menu', async () => {
    const rendu = await monterShell()
    expect(filAriane(rendu)).toBe('Tableau de bord')
    expect(filArianeMobile(rendu)).toBe('Tableau de bord')
    expect(rendu.queryByTestId('ecran-registre')).not.toBeNull()
    expect(entreeMenu('Tableau de bord')?.classList.contains('active')).toBe(true)
  })

  it('le menu n’a plus d’entrée « Aujourd’hui » ; la pastille passe sur « Tableau de bord »', async () => {
    await monterShell()
    expect(entreesMenu().map((entree) => entree.libelle)).not.toContain(AUJOURDHUI)
    expect(menu().textContent).not.toContain(AUJOURDHUI)
    const pastille = entreeMenu('Tableau de bord')?.querySelector('.count')?.textContent ?? ''
    expect(pastille).toMatch(/^[1-9]\d*$/)
  })

  // La pastille est le nombre de rappels de Fixy (tout le portefeuille), et non la valeur fixe de nav-config : les deux
  // diffèrent dans la démonstration (7 rappels, 10 tâches à échéance proche), le test les distingue donc.
  it('pastille du « Tableau de bord » : le nombre de rappels de la veille de Fixy', async () => {
    const enveloppe = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>
    const { result } = renderHook(() => useFixy(), { wrapper: enveloppe })
    const nbRappels = result.current.veille.length
    expect(nbRappels).toBeGreaterThan(0)
    expect(nbRappels).not.toBe(NB_TACHES_ECHEANCE_PROCHE)
    cleanup()
    await monterShell()
    expect(entreeMenu('Tableau de bord')?.querySelector('.count')?.textContent).toBe(String(nbRappels))
  })

  it('pastille du « Tableau de bord » : sans rappel de Fixy, les tâches à échéance proche (valeur de nav-config)', async () => {
    const avant = useDonneesStore.getState()
    useDonneesStore.setState({ coproprietes: [], mandats: [], impayes: [], documents: [] })
    try {
      await monterShell()
      expect(entreeMenu('Tableau de bord')?.querySelector('.count')?.textContent).toBe(String(NB_TACHES_ECHEANCE_PROCHE))
    } finally {
      useDonneesStore.setState({
        coproprietes: avant.coproprietes,
        mandats: avant.mandats,
        impayes: avant.impayes,
        documents: avant.documents,
      })
    }
  })

  it('ancien lien #cockpit au chargement : Tableau de bord, ancre remplacée sans nouvelle entrée d’historique', async () => {
    placerAncre('cockpit')
    const longueurHistorique = window.history.length
    const rendu = await monterShell('cockpit')
    expect(filAriane(rendu)).toBe('Tableau de bord')
    expect(rendu.queryByTestId('ecran-registre')).not.toBeNull()
    expect(window.location.hash).toBe('#dashboard')
    expect(window.history.length).toBe(longueurHistorique)
  })

  it('ancien lien #cockpit suivi par « hashchange » (Fixy, lien d’un écran) : Tableau de bord', async () => {
    const rendu = await monterShell('copros')
    expect(filAriane(rendu)).toBe(LIBELLES_ROUTES.copros)
    await suivreAncre('cockpit')
    expect(filAriane(rendu)).toBe('Tableau de bord')
    expect(window.location.hash).toBe('#dashboard')
    expect(entreeMenu('Tableau de bord')?.classList.contains('active')).toBe(true)
  })

  it('palette ⌘K : aucun « Aujourd’hui », ni sans requête ni en le cherchant', async () => {
    await monterShell()
    await ouvrirPalette()
    expect(libellesOptionsPalette()).not.toContain(AUJOURDHUI)
    await act(async () => {
      fireEvent.change(within(palette() as HTMLElement).getByRole('textbox', { name: 'Rechercher' }), {
        target: { value: 'aujourd' },
      })
    })
    expect(libellesOptionsPalette()).not.toContain(AUJOURDHUI)
    expect((palette() as HTMLElement).textContent).not.toContain(AUJOURDHUI)
  })

  it('palette ⌘K : « Tableau de bord » est proposé et s’ouvre', async () => {
    const rendu = await monterShell('copros')
    await ouvrirPalette('tableau de bord')
    const option = within(palette() as HTMLElement)
      .getAllByRole('option')
      .find((candidate) => candidate.querySelector('.cmdk-item-label')?.textContent === 'Tableau de bord')
    expect(option).toBeDefined()
    await act(async () => {
      fireEvent.click(option as HTMLElement)
    })
    expect(filAriane(rendu)).toBe('Tableau de bord')
    expect(window.location.hash).toBe('#dashboard')
  })

  it('palette ⌘K : un acte pré-rédigé (ancienne cible « cockpit ») ouvre le Tableau de bord, mémorisé tel quel', async () => {
    const rendu = await monterShell('copros')
    await ouvrirPalette('convocation ag')
    const option = within(palette() as HTMLElement)
      .getAllByRole('option')
      .find((candidate) => candidate.querySelector('.cmdk-item-label')?.textContent === 'Convocation AG élective')
    expect(option).toBeDefined()
    await act(async () => {
      fireEvent.click(option as HTMLElement)
    })
    expect(filAriane(rendu)).toBe('Tableau de bord')
    expect(window.location.hash).toBe('#dashboard')
    const recents = JSON.parse(localStorage.getItem(CLE_RECENTS) || '[]') as string[]
    expect(recents[0]).toBe('dashboard')
    expect(recents).not.toContain('cockpit')
  })
})
