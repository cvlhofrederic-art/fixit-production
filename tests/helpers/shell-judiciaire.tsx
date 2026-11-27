import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach } from 'vitest'
import { Shell } from '@/components/administrateur-judiciaire/shell/Shell'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Cadre commun des tests du Shell du module judiciaire monté sur l'écran « Trésorerie » : base de démonstration
 * chargée une fois, stockage, sélection et ancre remis à zéro avant chaque test, démontage après.
 * Le fichier de test importe d'abord 'fake-indexeddb/auto' et garde son vi.mock('next/dynamic') (hissé par Vitest
 * dans le fichier qui le déclare). Un beforeAll déclaré avant l'appel de preparerShellJudiciaire() s'exécute avant.
 */
export function preparerShellJudiciaire(): void {
  beforeAll(async () => {
    localStorage.clear()
    await viderBaseLocale()
    await initialiserBaseDemo()
    useDonneesStore.setState({ loaded: false, loading: false })
    await useDonneesStore.getState().loadAll()
  })

  beforeEach(() => {
    localStorage.clear()
    window.scrollTo = (() => undefined) as typeof window.scrollTo
    useSelectionDossier.setState({ code: null, coproprietaireId: null })
    window.history.replaceState(null, '', '#tresorerie')
  })

  afterEach(() => {
    cleanup()
    window.history.replaceState(null, '', window.location.pathname)
  })
}

/** Monte le Shell dans le conteneur #aj-root du module, comme le layout. */
export async function monterShellJudiciaire(): Promise<void> {
  await act(async () => {
    render(
      <div id="aj-root" lang="fr">
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </div>,
    )
  })
}
