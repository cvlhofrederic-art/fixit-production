import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SelecteurCoproGlobal, texteAuReposSelecteur } from '@/components/administrateur-judiciaire/shell/SelecteurCoproGlobal'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { rappelFinMission } from '@/lib/administrateur-judiciaire/domain/selection-copropriete'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Sélecteur de copropriété du haut de page (demande de Hugo du 29/10/2026) : combobox ARIA, recherche par nom ou code
 * sans accents, clavier ↑ ↓ Entrée Échap (option active ramenée dans la zone visible), clic extérieur, cadre cliquable,
 * vue « Tous les mandats » sur les pages générales (dossier choisi affiché et annoncé).
 * Jeu de démonstration inséré dans la base locale (4 copropriétés : LM, CV, TL, VM).
 */

beforeAll(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
})

beforeEach(() => {
  useSelectionDossier.setState({ code: 'CV', coproprietaireId: null })
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

const champ = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Copropriété affichée' })
const liste = () => screen.queryByRole('listbox', { name: 'Copropriétés' })
const options = () => within(liste() as HTMLElement).queryAllByRole('option')
const optionActive = () => champ().getAttribute('aria-activedescendant')
const touche = (key: string) => fireEvent.keyDown(champ(), { key })
const code = () => useSelectionDossier.getState().code

describe('sélecteur de copropriété du haut de page — au repos', () => {
  it('nom, code, fondement et rappel de fin de mission de la copropriété choisie', () => {
    const { container } = render(<SelecteurCoproGlobal route="tresorerie" />)
    expect(champ().value).toBe('Le Clos des Vignes')
    expect(champ()).toHaveAttribute('aria-expanded', 'false')
    expect(champ()).toHaveAttribute('aria-autocomplete', 'list')
    expect(liste()).toBeNull()
    const texte = container.textContent || ''
    expect(texte).toContain('CV')
    expect(texte).toContain('art. 46')
    const rappel = rappelFinMission('22/07/2026').texte
    expect(rappel).not.toBe('')
    expect(texte).toContain(rappel)
  })

  it('suit la sélection posée ailleurs (palette, Fixy, sélecteur d’un écran)', () => {
    render(<SelecteurCoproGlobal route="lots" />)
    act(() => useSelectionDossier.getState().choisirCopro('TL'))
    expect(champ().value).toBe('Copropriété Les Tilleuls')
    expect(screen.getByText('art. 29-1')).toBeInTheDocument()
  })
})

describe('sélecteur de copropriété du haut de page — recherche', () => {
  it('sans accents ni casse ; Entrée choisit l’option active et referme la liste', () => {
    render(<SelecteurCoproGlobal route="tresorerie" />)
    fireEvent.change(champ(), { target: { value: 'MERIDIEN' } })
    expect(champ()).toHaveAttribute('aria-expanded', 'true')
    expect(champ()).toHaveAttribute('aria-controls', liste()?.id)
    expect(options()).toHaveLength(1)
    expect(options()[0].textContent).toContain('Résidence Le Méridien')
    expect(optionActive()).toBe(options()[0].id)
    touche('Enter')
    expect(code()).toBe('LM')
    expect(liste()).toBeNull()
    expect(champ().value).toBe('Résidence Le Méridien')
  })

  it('par code ; sans résultat, un message et Entrée sans effet', () => {
    render(<SelecteurCoproGlobal route="tresorerie" />)
    fireEvent.change(champ(), { target: { value: 'vm' } })
    expect(options().map((option) => option.textContent)).toEqual([expect.stringContaining('Villa Montaigne')])
    fireEvent.change(champ(), { target: { value: 'zzz' } })
    expect(options()).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('Aucune copropriété pour « zzz »')
    expect(champ()).not.toHaveAttribute('aria-activedescendant')
    touche('Enter')
    expect(code()).toBe('CV')
  })
})

describe('sélecteur de copropriété du haut de page — clavier et souris', () => {
  it('↓ ouvre la liste sur la copropriété affichée ; ↑ ↓ déplacent (bornés) ; Échap referme sans rien changer', () => {
    render(<SelecteurCoproGlobal route="tresorerie" />)
    touche('ArrowDown')
    expect(options()).toHaveLength(4)
    expect(optionActive()).toBe(options()[1].id)
    expect(options()[1]).toHaveAttribute('aria-selected', 'true')
    touche('ArrowDown')
    touche('ArrowDown')
    touche('ArrowDown')
    expect(optionActive()).toBe(options()[3].id)
    touche('ArrowUp')
    expect(optionActive()).toBe(options()[2].id)
    touche('Escape')
    expect(liste()).toBeNull()
    expect(champ()).toHaveAttribute('aria-expanded', 'false')
    expect(code()).toBe('CV')
    expect(champ().value).toBe('Le Clos des Vignes')
    touche('ArrowUp')
    touche('ArrowUp')
    touche('ArrowUp')
    expect(optionActive()).toBe(options()[0].id)
    touche('Enter')
    expect(code()).toBe('LM')
  })

  it('un clic ouvre la liste complète, un clic sur une option la choisit ; un clic extérieur referme', () => {
    render(<SelecteurCoproGlobal route="tresorerie" />)
    fireEvent.click(champ())
    expect(options()).toHaveLength(4)
    fireEvent.click(options()[2])
    expect(code()).toBe('TL')
    expect(liste()).toBeNull()
    fireEvent.click(champ())
    expect(liste()).not.toBeNull()
    fireEvent.mouseDown(document.body)
    expect(liste()).toBeNull()
    expect(code()).toBe('TL')
  })

  it('Tab referme la liste sans choisir', () => {
    render(<SelecteurCoproGlobal route="tresorerie" />)
    touche('ArrowDown')
    touche('ArrowDown')
    touche('Tab')
    expect(liste()).toBeNull()
    expect(code()).toBe('CV')
  })
})

describe('sélecteur de copropriété du haut de page — pages générales', () => {
  // Sur une page générale, choisir une copropriété ne change rien à l'écran : le champ affiche le dossier choisi et
  // une région « status » l'annonce (option (b) du constat ; l'option (a), ouvrir sa page, reste à trancher par Hugo).
  it('« Tableau de bord », page d’accueil : tous les mandats et le dossier choisi ; le choix est affiché, annoncé, et se réapplique ailleurs', () => {
    const { container, rerender } = render(<SelecteurCoproGlobal route="dashboard" />)
    expect(champ().value).toBe('Tous les mandats (4) · dossier : Le Clos des Vignes')
    expect(container.textContent).not.toContain('art. 46')
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(code()).toBe('CV')
    touche('ArrowDown')
    touche('ArrowDown')
    touche('Enter')
    expect(code()).toBe('TL')
    expect(champ().value).toBe('Tous les mandats (4) · dossier : Copropriété Les Tilleuls')
    expect(screen.getByRole('status')).toHaveTextContent('Copropriété Les Tilleuls : copropriété des autres pages.')
    rerender(<SelecteurCoproGlobal route="tresorerie" />)
    expect(champ().value).toBe('Copropriété Les Tilleuls')
  })

  it('ancienne page « Aujourd’hui » (cockpit, redirigée) et pages du cabinet : même vue générale', () => {
    for (const route of ['cockpit', 'equipe', 'parametres']) {
      render(<SelecteurCoproGlobal route={route} />)
      expect(champ().value).toBe('Tous les mandats (4) · dossier : Le Clos des Vignes')
      cleanup()
    }
  })

  it('texte au repos : copropriété choisie, ou tous les mandats et le dossier choisi (sans dossier : le nombre seul)', () => {
    expect(texteAuReposSelecteur(false, 4, { nom: 'Villa Montaigne' })).toBe('Villa Montaigne')
    expect(texteAuReposSelecteur(false, 4, null)).toBe('')
    expect(texteAuReposSelecteur(true, 4, { nom: 'Villa Montaigne' })).toBe('Tous les mandats (4) · dossier : Villa Montaigne')
    expect(texteAuReposSelecteur(true, 4, null)).toBe('Tous les mandats (4)')
  })
})

describe('sélecteur de copropriété du haut de page — nom entier (barre du haut)', () => {
  // La largeur du champ suit le texte au repos entier (gabarit lu par aj-selecteur-copro.css) : la barre réduit les
  // autres éléments avant de tronquer le nom. Quand la place manque quand même (< 1280 px), le nom tronqué par des
  // points de suspension reste lisible en entier au survol (title) ; un lecteur d'écran lit la valeur du champ.
  const gabarit = () => champ().closest('.vfx-selecteur-copro__saisie')

  it('page d’une copropriété : gabarit et title portent le nom entier', () => {
    render(<SelecteurCoproGlobal route="tresorerie" />)
    expect(gabarit()).toHaveAttribute('data-texte', 'Le Clos des Vignes')
    expect(champ()).toHaveAttribute('title', 'Le Clos des Vignes')
    act(() => useSelectionDossier.getState().choisirCopro('LM'))
    expect(gabarit()).toHaveAttribute('data-texte', 'Résidence Le Méridien')
    expect(champ()).toHaveAttribute('title', 'Résidence Le Méridien')
  })

  it('page générale : gabarit et title portent tout le texte au repos ; seule une page générale est repérée comme telle', () => {
    // Sur une page générale, le texte (« Tous les mandats… · dossier : … ») peut se tronquer pour laisser le titre de
    // la page lisible : la feuille le repère par la classe vfx-selecteur-copro--generale.
    const { rerender } = render(<SelecteurCoproGlobal route="dashboard" />)
    const texte = 'Tous les mandats (4) · dossier : Le Clos des Vignes'
    expect(gabarit()).toHaveAttribute('data-texte', texte)
    expect(champ()).toHaveAttribute('title', texte)
    expect(champ().closest('.vfx-selecteur-copro')).toHaveClass('vfx-selecteur-copro--generale')
    rerender(<SelecteurCoproGlobal route="tresorerie" />)
    expect(champ().closest('.vfx-selecteur-copro')).not.toHaveClass('vfx-selecteur-copro--generale')
  })

  it('pendant la recherche : la largeur ne bouge pas (gabarit au repos), pas de title sur le texte tapé', () => {
    render(<SelecteurCoproGlobal route="tresorerie" />)
    fireEvent.change(champ(), { target: { value: 'til' } })
    expect(gabarit()).toHaveAttribute('data-texte', 'Le Clos des Vignes')
    expect(champ()).not.toHaveAttribute('title')
    touche('Escape')
    expect(champ()).toHaveAttribute('title', 'Le Clos des Vignes')
  })

  it('le fondement est une pastille secondaire, repérée pour être masquée quand la place manque (< 1280 px)', () => {
    render(<SelecteurCoproGlobal route="tresorerie" />)
    const fondement = screen.getByText('art. 46').closest('.vfx-selecteur-copro__fondement')
    expect(fondement).not.toBeNull()
    expect(champ().closest('label')).toContainElement(fondement as HTMLElement)
  })
})

describe('sélecteur de copropriété du haut de page — lecteur d’écran et souris', () => {
  it('le nom et le détail d’une option sont séparés ; la copropriété choisie est signalée en texte', () => {
    render(<SelecteurCoproGlobal route="tresorerie" />)
    touche('ArrowDown')
    const [meridien, vignes] = options()
    expect(meridien.textContent).toMatch(/^Résidence Le Méridien LM · art\. 46/)
    expect(meridien.textContent).not.toContain('(choisie)')
    expect(vignes.textContent).toContain('Le Clos des Vignes (choisie) CV')
  })

  // Le cadre est l'étiquette du champ : le clic est transmis au champ (le navigateur lui donne aussi le focus).
  it('un clic sur le code ou une pastille du cadre ouvre la liste', () => {
    render(<SelecteurCoproGlobal route="tresorerie" />)
    expect(champ().closest('label')).toContainElement(screen.getByText('CV', { selector: '.mono' }))
    fireEvent.click(screen.getByText('CV', { selector: '.mono' }))
    expect(liste()).not.toBeNull()
    fireEvent.mouseDown(document.body)
    fireEvent.click(screen.getByText('art. 46'))
    expect(liste()).not.toBeNull()
  })
})

describe('sélecteur de copropriété du haut de page — longue liste', () => {
  it('↓ ramène l’option active dans la zone visible de la liste (12 copropriétés)', () => {
    const avant = useDonneesStore.getState()
    const modele = avant.coproprietes[0]
    const ajoutees = Array.from({ length: 8 }, (_, index) => ({
      ...modele,
      id: `X${index}`,
      code: `X${index}`,
      nom: `Résidence ajoutée ${index}`,
    }))
    useDonneesStore.setState({ coproprietes: [...avant.coproprietes, ...ajoutees] })
    const defiler = vi.fn()
    const origine = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = defiler
    try {
      render(<SelecteurCoproGlobal route="tresorerie" />)
      touche('ArrowDown')
      expect(options()).toHaveLength(12)
      for (let i = 0; i < 10; i++) touche('ArrowDown')
      expect(optionActive()).toBe(options()[11].id)
      const derniere = defiler.mock.contexts.at(-1) as Element
      expect(derniere.id).toBe(options()[11].id)
      expect(defiler).toHaveBeenLastCalledWith({ block: 'nearest' })
    } finally {
      Element.prototype.scrollIntoView = origine
      useDonneesStore.setState({ coproprietes: avant.coproprietes })
    }
  })
})

describe('sélecteur de copropriété du haut de page — personne sélectionnée', () => {
  it('changer de copropriété oublie la personne qui n’en fait pas partie, garde celle qui en fait partie', () => {
    const { lots, coproprietaires } = useDonneesStore.getState()
    const lotCV = lots.find((lot) => lot.coproprieteId === 'C2')
    const personneCV = coproprietaires.find((personne) => personne.lotId === lotCV?.id)
    expect(personneCV).toBeDefined()
    const idPersonne = personneCV?.id as string

    useSelectionDossier.setState({ code: 'LM', coproprietaireId: idPersonne })
    render(<SelecteurCoproGlobal route="personne360" />)
    fireEvent.change(champ(), { target: { value: 'clos' } })
    touche('Enter')
    expect(useSelectionDossier.getState()).toMatchObject({ code: 'CV', coproprietaireId: idPersonne })

    fireEvent.change(champ(), { target: { value: 'tilleuls' } })
    touche('Enter')
    expect(useSelectionDossier.getState()).toMatchObject({ code: 'TL', coproprietaireId: null })
  })
})

describe('sélecteur de copropriété du haut de page — base vide', () => {
  it('message de création d’un mandat, pas de champ', () => {
    const avant = useDonneesStore.getState()
    useDonneesStore.setState({ coproprietes: [], mandats: [] })
    try {
      render(<SelecteurCoproGlobal route="tresorerie" />)
      expect(screen.getByRole('status')).toHaveTextContent('Aucune copropriété dans la base')
      expect(screen.queryByRole('combobox')).toBeNull()
    } finally {
      useDonneesStore.setState({ coproprietes: avant.coproprietes, mandats: avant.mandats })
    }
  })
})
