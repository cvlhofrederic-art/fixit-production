import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE, MODE_ACTIF } from '@/lib/administrateur-judiciaire/mode'
import { statutEcran } from '@/components/administrateur-judiciaire/modules/registry'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Panneau « Comptes bancaires du mandat » EN DÉMONSTRATION : même comportement que le reste de l'écran « Banque et
 * recouvrement » (statut « reel », hors simulesEnDemonstration) : il lit et écrit la base locale de démonstration. Le
 * jeu de démonstration n'a aucun compte bancaire.
 */

const patienter = () =>
  act(async () => {
    await new Promise((resoudre) => setTimeout(resoudre, 30))
  })

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

afterEach(() => cleanup())

async function rendre() {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  await act(async () => {
    render(
      <ToastContext.Provider value={{ push, dismiss: vi.fn() }}>
        <TresorerieModule />
      </ToastContext.Provider>,
    )
  })
  await patienter()
  return { push }
}

const panneau = () =>
  screen.getByRole('heading', { level: 3, name: 'Comptes bancaires du mandat' }).closest('.panel') as HTMLElement

describe('Comptes bancaires en démonstration', () => {
  it('écran « reel » en démonstration aussi : l’enregistrement n’est pas simulé', () => {
    expect(MODE_ACTIF).toBe('demo')
    expect(statutEcran('tresorerie', 'demo')).toBe('reel')
  })

  it('copropriété de démonstration par défaut (Le Clos des Vignes) : aucun compte, aucun toast à l’ouverture', async () => {
    const { push } = await rendre()
    expect(within(panneau()).getByText('Aucun compte enregistré pour cette copropriété.')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('« Nouveau compte » écrit dans la base locale de démonstration, comme l’import du relevé', async () => {
    const { push } = await rendre()
    fireEvent.click(within(panneau()).getByRole('button', { name: /Nouveau compte/ }))
    const boite = within(screen.getByRole('dialog'))
    fireEvent.change(boite.getByLabelText('IBAN'), { target: { value: 'FR76 3000 6000 0112 3456 7890 189' } })
    await act(async () => {
      fireEvent.click(boite.getByRole('button', { name: 'Enregistrer' }))
    })
    await patienter()
    const lignes = await ajDb.banques.toArray()
    expect(lignes).toHaveLength(1)
    expect(lignes[0].coproprieteId).toBe('C2')
    expect(push.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'success', title: 'Compte enregistré' })
  })
})
