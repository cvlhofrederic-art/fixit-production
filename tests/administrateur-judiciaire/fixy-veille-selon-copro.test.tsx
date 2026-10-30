import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FixyModule } from '@/components/administrateur-judiciaire/modules/agents-ia/FixyModule'
import { FixyLauncher } from '@/components/administrateur-judiciaire/shell/FixyLauncher'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Sélecteur de copropriété du haut de page (demande de Hugo du 29/10/2026) : la veille de Fixy (onglet Tableau et
 * lanceur flottant) ne montre que les rappels de la copropriété choisie ; le lanceur montre tout le portefeuille sur
 * « Aujourd'hui » et « Tableau de bord ». Sans copropriété choisie (écran rendu seul), toute la veille, comme avant.
 *
 * Veille de la démonstration au 04/06/2026 : 7 rappels (3 urgents) ; Le Clos des Vignes 3 (1 urgent), Les Tilleuls 3
 * (1 urgent), Villa Montaigne 1 (urgent), Le Méridien aucun.
 */

const NOMS = /^(Résidence Le Méridien|Le Clos des Vignes|Copropriété Les Tilleuls|Villa Montaigne)( :| ·)/

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

const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

/** Textes des rappels affichés dans un conteneur (chaque rappel commence par le nom de sa copropriété). */
const rappelsDans = (conteneur: HTMLElement): string[] =>
  within(conteneur)
    .queryAllByText(NOMS)
    .map((element) => element.textContent || '')

const tousDe = (textes: string[], nom: string) => textes.every((texte) => texte.startsWith(nom))

describe('Fixy — onglet Tableau : veille de la copropriété choisie', () => {
  async function ouvrirTableau(): Promise<void> {
    await act(async () => {
      render(
        <ToastProvider>
          <FixyModule />
        </ToastProvider>,
      )
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tableau' }))
  }

  const panneauVeille = (): HTMLElement =>
    screen.getByRole('heading', { level: 3, name: /^Veille · / }).closest('.panel') as HTMLElement

  it('ne montre que les rappels de la copropriété, compteurs recalculés, et suit chaque choix sans remontage', async () => {
    useSelectionDossier.setState({ code: 'CV' })
    await ouvrirTableau()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Veille · 3 rappels' })).toBeInTheDocument())
    const cv = rappelsDans(panneauVeille())
    expect(cv).toHaveLength(3)
    expect(tousDe(cv, 'Le Clos des Vignes')).toBe(true)
    expect(within(panneauVeille()).getByText('1 urgent')).toBeInTheDocument()

    await choisir('VM')
    expect(screen.getByRole('heading', { name: 'Veille · 1 rappel' })).toBeInTheDocument()
    const vm = rappelsDans(panneauVeille())
    expect(vm).toHaveLength(1)
    expect(tousDe(vm, 'Villa Montaigne')).toBe(true)
  })

  it('les rappels de recouvrement suivent la copropriété du débiteur', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await ouvrirTableau()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Veille · 3 rappels' })).toBeInTheDocument())
    expect(rappelsDans(panneauVeille()).filter((texte) => texte.includes(" n'a aucun dossier de recouvrement"))).toEqual([
      expect.stringMatching(/^Copropriété Les Tilleuls · SCI Belvédère doit /),
      expect.stringMatching(/^Copropriété Les Tilleuls · Antoine Rousseau doit /),
    ])
  })

  it('copropriété sans rappel : état vide à son nom', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    await ouvrirTableau()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Veille · 0 rappel' })).toBeInTheDocument())
    expect(within(panneauVeille()).getByText(/^Aucun rappel pour Résidence Le Méridien/)).toBeInTheDocument()
    expect(screen.queryByText(/^Rien à signaler/)).toBeNull()
  })

  it('sans copropriété choisie : toute la veille du portefeuille, comme avant', async () => {
    await ouvrirTableau()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Veille · 7 rappels' })).toBeInTheDocument())
    const textes = rappelsDans(panneauVeille())
    expect(textes).toHaveLength(7)
    expect(new Set(textes.map((texte) => NOMS.exec(texte)?.[1])).size).toBe(3)
    expect(within(panneauVeille()).getByText('3 urgents')).toBeInTheDocument()
  })
})

describe('Lanceur Fixy — veille de la copropriété choisie, tout le portefeuille sur les vues générales', () => {
  async function monterLanceur(route: string) {
    let rendu: ReturnType<typeof render> | undefined
    await act(async () => {
      rendu = render(
        <ToastProvider>
          <FixyLauncher route={route} />
        </ToastProvider>,
      )
    })
    return rendu as ReturnType<typeof render>
  }

  const badgeUrgents = () => screen.getByRole('button', { name: 'Ouvrir Fixy' }).querySelector('.pill')?.textContent ?? null

  /** Ouvre la fenêtre et renvoie le nombre annoncé « À signaler » et les rappels affichés (3 au plus). */
  function ouvrir(): { annonce: string | null; rappels: string[] } {
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir Fixy' }))
    const fenetre = screen.getByRole('dialog', { name: 'Fixy' })
    const entete = within(fenetre).queryByText('À signaler')
    return { annonce: entete?.querySelector('.pill')?.textContent ?? null, rappels: rappelsDans(fenetre) }
  }

  it('page d’une copropriété : badge et rappels de la seule copropriété choisie', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await monterLanceur('lots')
    expect(badgeUrgents()).toBe('1')
    const { annonce, rappels } = ouvrir()
    expect(annonce).toBe('3')
    expect(rappels).toHaveLength(3)
    expect(tousDe(rappels, 'Copropriété Les Tilleuls')).toBe(true)
  })

  it('suit le changement de copropriété ; rien à signaler pour une copropriété sans rappel', async () => {
    useSelectionDossier.setState({ code: 'VM' })
    await monterLanceur('fiche360')
    expect(badgeUrgents()).toBe('1')
    await choisir('LM')
    expect(badgeUrgents()).toBeNull()
    expect(ouvrir()).toEqual({ annonce: null, rappels: [] })
  })

  it.each(['cockpit', 'dashboard'])('« %s » : tout le portefeuille, quelle que soit la copropriété choisie', async (route) => {
    useSelectionDossier.setState({ code: 'TL' })
    await monterLanceur(route)
    expect(badgeUrgents()).toBe('3')
    const { annonce, rappels } = ouvrir()
    expect(annonce).toBe('7')
    expect(rappels).toHaveLength(3)
    // La page Fixy ne montre que la veille de la copropriété choisie : le reste est sur tout le portefeuille.
    expect(screen.getByText('4 autres rappels sur tout le portefeuille.')).toBeInTheDocument()
    expect(screen.queryByText(/sur la page Fixy/)).toBeNull()
  })

  it('sans copropriété choisie : toute la veille, comme avant (la page Fixy montre la même)', async () => {
    await monterLanceur('lots')
    expect(badgeUrgents()).toBe('3')
    expect(ouvrir().annonce).toBe('7')
    expect(screen.getByText('4 autres rappels sur la page Fixy.')).toBeInTheDocument()
  })
})
