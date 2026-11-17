import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, render, screen, type RenderResult } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Shell } from '@/components/administrateur-judiciaire/shell/Shell'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Pastille de statut du Shell sur l'écran Sinistres, EN DÉMONSTRATION : l'écran n'y écrit rien (enregistrement simulé),
 * la pastille dit donc « Démonstration », comme avant le branchement de l'écran, et non « Données réelles » ; le
 * bandeau (« seuls les écrans marqués « Données réelles » enregistrent ») reste exact. Un écran qui enregistre aussi
 * en démonstration (Banque & recouvrement) garde « Données réelles ». En données réelles, le statut « reel » de
 * l'écran est vérifié dans sinistres-ecran.test.tsx (statutEcran('sinistres', 'reel')).
 */

vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return <div data-testid="ecran-registre" />
    },
}))

beforeAll(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', window.location.pathname)
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

async function monterShell(ancre: string): Promise<RenderResult> {
  window.history.replaceState(null, '', `#${ancre}`)
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

const pastille = (rendu: RenderResult) => rendu.container.querySelector('.crumb > .pill')

describe('Shell — pastille de l’écran Sinistres en démonstration', () => {
  it('« Démonstration », titre « rien n’est enregistré » : jamais « Données réelles »', async () => {
    const rendu = await monterShell('sinistres')
    expect(rendu.container.querySelector('.crumb > b')).toHaveTextContent('Sinistres')
    expect(pastille(rendu)).toHaveTextContent('Démonstration')
    expect(pastille(rendu)).not.toHaveTextContent('Données réelles')
    expect(pastille(rendu)?.getAttribute('title')).toMatch(/rien n'est enregistré/)
  })

  it('le bandeau reste exact : seuls les écrans marqués « Données réelles » enregistrent', async () => {
    await monterShell('sinistres')
    expect(screen.getByText(/seuls les écrans marqués « Données réelles » enregistrent/)).toBeInTheDocument()
  })

  it('un écran qui enregistre aussi en démonstration garde « Données réelles »', async () => {
    const rendu = await monterShell('tresorerie')
    expect(pastille(rendu)).toHaveTextContent('Données réelles')
  })
})
