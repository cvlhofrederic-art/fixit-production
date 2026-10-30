import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within, type RenderResult } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { libelleRaccourciPalette } from '@/components/administrateur-judiciaire/shell/BarreRecherche'
import { Shell } from '@/components/administrateur-judiciaire/shell/Shell'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Shell — sélecteur de copropriété et barre de recherche du haut de page (demande de Hugo du 29/10/2026) :
 * la copropriété par défaut est le choix courant, sinon le choix mémorisé, sinon la première, une fois la base lue ;
 * chaque choix valide est mémorisé (clé « vitfix.aj.dossierEnCours »), un code absent des copropriétés affichées est
 * remplacé ; la barre de recherche (bouton) ouvre la palette ⌘K, qui rend le focus à sa fermeture.
 */

vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return <div data-testid="ecran-registre" />
    },
}))

const CLE_DOSSIER_EN_COURS = 'vitfix.aj.dossierEnCours'

/** Base de démonstration rechargée dans le store (4 copropriétés : LM, CV, TL, VM). */
async function chargerBaseDemo(): Promise<void> {
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
}

beforeAll(async () => {
  localStorage.clear()
  await chargerBaseDemo()
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

async function monterShell(): Promise<RenderResult> {
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

const topbar = (rendu: RenderResult) => rendu.container.querySelector('.topbar') as HTMLElement
const selecteur = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Copropriété affichée' })
const barreRecherche = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Rechercher une copropriété, une personne, un lot, un prestataire' })
const palette = () => screen.queryByRole('dialog', { name: 'Palette de commandes' })
const champPalette = () =>
  within(palette() as HTMLElement).getByRole<HTMLInputElement>('textbox', { name: 'Rechercher' })
const memorise = () => localStorage.getItem(CLE_DOSSIER_EN_COURS)
const codeChoisi = () => useSelectionDossier.getState().code

describe('Shell — sélecteur de copropriété dans la barre du haut', () => {
  it('présent dans la barre du haut, avec le menu de gauche', async () => {
    const rendu = await monterShell()
    expect(within(topbar(rendu)).getByRole('combobox', { name: 'Copropriété affichée' })).toBe(selecteur())
    expect(screen.getByRole('complementary', { name: 'Navigation principale' })).toBeInTheDocument()
  })

  it('sans choix ni mémoire : la première copropriété, mémorisée', async () => {
    await monterShell()
    expect(codeChoisi()).toBe('LM')
    expect(memorise()).toBe(JSON.stringify('LM'))
    expect(selecteur().value).toBe('Résidence Le Méridien')
  })

  it('au rechargement : le choix mémorisé est restauré', async () => {
    localStorage.setItem(CLE_DOSSIER_EN_COURS, JSON.stringify('TL'))
    await monterShell()
    expect(codeChoisi()).toBe('TL')
    expect(selecteur().value).toBe('Copropriété Les Tilleuls')
  })

  it('un code mémorisé inconnu ou illisible donne la première copropriété', async () => {
    localStorage.setItem(CLE_DOSSIER_EN_COURS, JSON.stringify('XX'))
    await monterShell()
    expect(codeChoisi()).toBe('LM')
    expect(memorise()).toBe(JSON.stringify('LM'))
    cleanup()
    useSelectionDossier.setState({ code: null })
    localStorage.setItem(CLE_DOSSIER_EN_COURS, '{illisible')
    await monterShell()
    expect(codeChoisi()).toBe('LM')
  })

  it('le choix courant l’emporte sur le choix mémorisé', async () => {
    localStorage.setItem(CLE_DOSSIER_EN_COURS, JSON.stringify('TL'))
    useSelectionDossier.setState({ code: 'VM' })
    await monterShell()
    expect(codeChoisi()).toBe('VM')
    expect(memorise()).toBe(JSON.stringify('VM'))
  })

  it('tout changement de la sélection est mémorisé : sélecteur du haut, palette, ou ailleurs (Fixy, écrans)', async () => {
    await monterShell()
    fireEvent.change(selecteur(), { target: { value: 'vignes' } })
    fireEvent.keyDown(selecteur(), { key: 'Enter' })
    expect(codeChoisi()).toBe('CV')
    expect(memorise()).toBe(JSON.stringify('CV'))

    await act(async () => {
      fireEvent.click(barreRecherche())
    })
    fireEvent.change(champPalette(), { target: { value: 'Tilleuls' } })
    const option = within(palette() as HTMLElement)
      .getAllByRole('option')
      .find((candidate) => candidate.textContent?.startsWith('Copropriété Les Tilleuls'))
    expect(option).toBeDefined()
    await act(async () => {
      fireEvent.click(option as HTMLElement)
    })
    expect(codeChoisi()).toBe('TL')
    expect(memorise()).toBe(JSON.stringify('TL'))

    act(() => useSelectionDossier.getState().choisirCopro('VM'))
    expect(memorise()).toBe(JSON.stringify('VM'))
    expect(selecteur().value).toBe('Villa Montaigne')
  })

  // Le Tableau de bord est la page d'accueil depuis le 29/10/2026 ; l'ancien lien #cockpit (« Aujourd'hui ») y mène.
  it.each(['dashboard', 'cockpit'])('« Tableau de bord » (#%s) : tous les mandats, le choix reste mémorisé', async (ancre) => {
    localStorage.setItem(CLE_DOSSIER_EN_COURS, JSON.stringify('CV'))
    window.history.replaceState(null, '', `#${ancre}`)
    await monterShell()
    expect(selecteur().value).toBe('Tous les mandats (4) · dossier : Le Clos des Vignes')
    expect(codeChoisi()).toBe('CV')
    expect(memorise()).toBe(JSON.stringify('CV'))
  })
})

describe('Shell — copropriété choisie absente de la liste ou base pas encore lue', () => {
  afterEach(async () => {
    await chargerBaseDemo()
  })

  // Un code de démonstration posé en mode réel (radar, Fixy, palette) ne doit ni rester choisi, ni être mémorisé.
  it('un code choisi absent des copropriétés affichées est remplacé par le dernier choix valide, jamais mémorisé', async () => {
    localStorage.setItem(CLE_DOSSIER_EN_COURS, JSON.stringify('TL'))
    await monterShell()
    act(() => useSelectionDossier.getState().choisirCopro('ZZ'))
    expect(codeChoisi()).toBe('TL')
    expect(memorise()).toBe(JSON.stringify('TL'))
    expect(selecteur().value).toBe('Copropriété Les Tilleuls')
    act(() => useSelectionDossier.getState().choisirCopro(null))
    expect(codeChoisi()).toBe('TL')
  })

  // Rechargement en mode démo : tant que la base n'est pas lue, la liste provisoire est celle de la démonstration, sans
  // les copropriétés créées ; le choix mémorisé d'une copropriété créée ne doit pas être remplacé par LM.
  it('une copropriété créée, choisie puis rechargée, reste choisie : rien n’est posé avant la lecture de la base', async () => {
    let creee = ''
    await act(async () => {
      const copro = await useDonneesStore.getState().createCopropriete({
        nom: 'Résidence Soleil',
        adresse: '1 rue du Soleil',
        nbLots: 10,
        rg: '26/01111',
        fondement: 'sj',
      })
      creee = copro.code
    })
    localStorage.setItem(CLE_DOSSIER_EN_COURS, JSON.stringify(creee))
    useDonneesStore.setState({ loaded: false, loading: false, coproprietes: [], mandats: [] })

    await monterShell()
    await waitFor(() => expect(useDonneesStore.getState().loaded).toBe(true))
    await waitFor(() => expect(codeChoisi()).toBe(creee))
    expect(memorise()).toBe(JSON.stringify(creee))
    expect(selecteur().value).toBe('Résidence Soleil')
  })
})

describe('Shell — barre de recherche du haut de page', () => {
  it('un bouton de la barre du haut qui ouvre la fenêtre de la palette, avec son raccourci', async () => {
    const rendu = await monterShell()
    const barre = barreRecherche()
    expect(topbar(rendu)).toContainElement(barre)
    expect(barre).toHaveAttribute('aria-haspopup', 'dialog')
    expect(barre).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K')
    expect(barre.querySelector('kbd')?.textContent).toBe(libelleRaccourciPalette(navigator.userAgent))
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('raccourci affiché selon la plateforme : ⌘K sur Mac et iOS, Ctrl K ailleurs', () => {
    expect(libelleRaccourciPalette('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)')).toBe('⌘K')
    expect(libelleRaccourciPalette('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('⌘K')
    expect(libelleRaccourciPalette('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Ctrl K')
  })

  it('une lettre tapée sur la barre ouvre la palette avec cette lettre', async () => {
    await monterShell()
    expect(palette()).toBeNull()
    await act(async () => {
      fireEvent.keyDown(barreRecherche(), { key: 't' })
    })
    expect(champPalette().value).toBe('t')
    fireEvent.change(champPalette(), { target: { value: 'tilleuls' } })
    expect(within(palette() as HTMLElement).getAllByText('Copropriété Les Tilleuls').length).toBeGreaterThan(0)
  })

  it('clic (ou Entrée) et ↓ ouvrent une nouvelle recherche ; la loupe et Ctrl K restent disponibles', async () => {
    await monterShell()
    fireEvent.keyDown(barreRecherche(), { key: 'v' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(palette()).toBeNull()
    fireEvent.click(barreRecherche())
    expect(champPalette().value).toBe('')
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(barreRecherche(), { key: 'ArrowDown' })
    expect(palette()).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(palette()).not.toBeNull()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(palette()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Ouvrir la palette de commandes \((Ctrl K|⌘K)\)$/ }))
    expect(palette()).not.toBeNull()
  })

  it('à la fermeture, le focus revient à la barre ; après une navigation, au contenu principal', async () => {
    await monterShell()
    barreRecherche().focus()
    await act(async () => {
      fireEvent.click(barreRecherche())
    })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(palette()).toBeNull()
    expect(document.activeElement).toBe(barreRecherche())

    await act(async () => {
      fireEvent.click(barreRecherche())
    })
    fireEvent.change(champPalette(), { target: { value: 'Tilleuls' } })
    await act(async () => {
      fireEvent.click(within(palette() as HTMLElement).getAllByRole('option')[0])
    })
    expect(palette()).toBeNull()
    expect(document.activeElement).toBe(document.getElementById('main'))
  })
})

describe('Shell — « Nouvelle intervention »', () => {
  it('le formulaire propose la copropriété choisie en haut de page', async () => {
    localStorage.setItem(CLE_DOSSIER_EN_COURS, JSON.stringify('VM'))
    await monterShell()
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle intervention' }))
    const dialogue = screen.getByRole('dialog', { name: 'Nouvel ordre de service' })
    expect(within(dialogue).getAllByRole<HTMLSelectElement>('combobox')[0].value).toBe('Villa Montaigne')
  })
})
