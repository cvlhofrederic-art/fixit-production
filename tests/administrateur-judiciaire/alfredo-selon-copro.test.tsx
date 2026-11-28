import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AlfredoCourriersModule } from '@/components/administrateur-judiciaire/modules/agents-ia/AlfredoCourriersModule'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Sélecteur de copropriété du haut de page (demande de Hugo du 29/10/2026) : Alfredo ne montre que les courriels de
 * la copropriété choisie (compteur de non-lus recalculé, premier courriel ouvert si le message ouvert n'en fait pas
 * partie). Sans copropriété choisie (écran rendu seul), toute la boîte, comme avant.
 *
 * Boîte de la démonstration : Le Méridien e1 (non lu) et e4, Les Tilleuls e2 (non lu) et e5, Le Clos des Vignes e3.
 */

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

async function monter(): Promise<void> {
  await act(async () => {
    render(
      <ToastProvider>
        <AlfredoCourriersModule />
      </ToastProvider>,
    )
  })
}

const messages = () => within(screen.getByRole('list', { name: 'Messages reçus' })).getAllByRole('button')

/** Objets des messages listés (deuxième ligne de chaque bouton). */
const objets = () => messages().map((bouton) => (bouton.children[1] as HTMLElement).textContent)

const messageOuvert = () => messages().find((bouton) => bouton.getAttribute('aria-current') === 'true')

const nonLus = () => screen.getByText(/^\d+ non lus$/).textContent

describe('Alfredo — courriels de la copropriété choisie', () => {
  it('liste, message ouvert et non-lus de la seule copropriété choisie', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await monter()
    expect(objets()).toEqual(['Fuite au plafond — appartement 3B', 'Point sur le redressement financier'])
    expect(messageOuvert()).toBe(messages()[0])
    expect(screen.getAllByText('Fuite au plafond — appartement 3B')).toHaveLength(2)
    expect(nonLus()).toBe('1 non lus')

    fireEvent.click(messages()[0])
    expect(nonLus()).toBe('0 non lus')
  })

  it('suit le changement de copropriété sans remontage', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    await monter()
    expect(objets()).toEqual(['Régularisation des charges 2025', 'Demande de travaux — porte du local vélos'])
    fireEvent.click(messages()[1])

    await act(() => useSelectionDossier.getState().choisirCopro('CV'))
    expect(objets()).toEqual(["Date de l'assemblée générale"])
    expect(messageOuvert()).toBe(messages()[0])
    expect(nonLus()).toBe('0 non lus')
  })

  it('copropriété sans courriel : état vide à son nom', async () => {
    useSelectionDossier.setState({ code: 'VM' })
    await monter()
    expect(screen.getByRole('heading', { name: 'Aucun courriel pour Villa Montaigne' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Messages reçus' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Régénérer' })).toBeNull()
    expect(nonLus()).toBe('0 non lus')
  })

  it('sans copropriété choisie : toute la boîte, premier message ouvert, comme avant', async () => {
    await monter()
    expect(messages()).toHaveLength(5)
    expect(messageOuvert()).toBe(messages()[0])
    expect(objets()[0]).toBe('Régularisation des charges 2025')
    expect(nonLus()).toBe('2 non lus')
  })
})
