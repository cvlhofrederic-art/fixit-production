import './fuseau-paris'
import 'fake-indexeddb/auto'
import { Component, type ReactNode } from 'react'
import { act, cleanup, render, type RenderResult } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIBELLES_ROUTES } from '@/components/administrateur-judiciaire/shell/nav-config'
import { Shell } from '@/components/administrateur-judiciaire/shell/Shell'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Correctif du Shell (défaut hérité de la maquette) : l'ancre d'URL n'était validée que par REGISTRE_ECRANS[ancre],
 * un objet littéral qui hérite d'Object.prototype. #constructor, #valueOf, #__proto__… passaient donc la validation
 * et faisaient planter le rendu de l'écran (à chaque rechargement, puisque l'ancre est conservée).
 * Une clé héritée doit désormais être ignorée exactement comme une ancre inconnue.
 */

// Écrans du registre remplacés par un écran factice : seul compte ici l'écran retenu par le Shell.
vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return <div data-testid="ecran-registre" />
    },
}))

interface EtatGardeErreur {
  erreur: Error | null
}

/** Équivalent minimal de l'ErrorBoundary de l'application : affiche le message de l'erreur de rendu. */
class GardeErreur extends Component<{ children?: ReactNode }, EtatGardeErreur> {
  state: EtatGardeErreur = { erreur: null }

  static getDerivedStateFromError(erreur: Error): EtatGardeErreur {
    return { erreur }
  }

  render() {
    if (this.state.erreur) return <div data-testid="erreur-rendu">{this.state.erreur.message}</div>
    return this.props.children
  }
}

/** Place l'ancre sans déclencher « hashchange » (comme à l'ouverture d'un lien). */
function placerAncre(ancre: string): void {
  window.history.replaceState(null, '', ancre ? `#${ancre}` : window.location.pathname)
}

async function monterShell(ancre: string): Promise<RenderResult> {
  placerAncre(ancre)
  let rendu: RenderResult | undefined
  await act(async () => {
    rendu = render(
      <GardeErreur>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </GardeErreur>,
    )
  })
  return rendu as RenderResult
}

/** Libellé du fil d'Ariane (route affichée). */
const libelleAffiche = (rendu: RenderResult): string | null | undefined =>
  rendu.container.querySelector('.crumb b')?.textContent

function verifierEcranAffiche(rendu: RenderResult, route: string): void {
  expect(rendu.queryByTestId('erreur-rendu')?.textContent ?? null).toBeNull()
  expect(libelleAffiche(rendu)).toBe(LIBELLES_ROUTES[route])
  expect(rendu.queryByTestId('ecran-registre')).not.toBeNull()
  expect(rendu.container.textContent).not.toContain('[object ')
}

const ANCRES_HERITEES = [
  'constructor',
  'hasOwnProperty',
  'valueOf',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  '__proto__',
]

describe('Shell — ancre héritée d’Object.prototype (correctif)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    placerAncre('')
    vi.restoreAllMocks()
  })

  it.each(ANCRES_HERITEES)('#%s au chargement est ignorée comme une ancre inconnue (écran par défaut)', async (ancre) => {
    const rendu = await monterShell(ancre)
    verifierEcranAffiche(rendu, 'cockpit')
  })

  it('une ancre héritée suivie par « hashchange » est ignorée : l’écran courant reste affiché', async () => {
    const rendu = await monterShell('copros')
    verifierEcranAffiche(rendu, 'copros')
    for (const ancre of ANCRES_HERITEES) {
      placerAncre(ancre)
      await act(async () => {
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      })
      verifierEcranAffiche(rendu, 'copros')
    }
    // Une route du registre est toujours suivie.
    placerAncre('mandats')
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    verifierEcranAffiche(rendu, 'mandats')
  })

  it('comportement inchangé pour une route du registre et pour une ancre inconnue ordinaire', async () => {
    verifierEcranAffiche(await monterShell('copros'), 'copros')
    cleanup()
    verifierEcranAffiche(await monterShell('inconnu'), 'cockpit')
    cleanup()
    verifierEcranAffiche(await monterShell(''), 'cockpit')
  })
})
