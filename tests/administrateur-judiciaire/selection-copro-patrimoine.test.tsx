import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_TOTAL_LOTS } from '@/components/administrateur-judiciaire/data/coproprietes'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import { DEMO_PRESTATAIRES } from '@/components/administrateur-judiciaire/data/prestataires'
import { AscenseursModule } from '@/components/administrateur-judiciaire/modules/patrimoine/AscenseursModule'
import { ContratsPrestatairesModule } from '@/components/administrateur-judiciaire/modules/patrimoine/ContratsPrestatairesModule'
import { CoproprietesModule } from '@/components/administrateur-judiciaire/modules/patrimoine/CoproprietesModule'
import { LotsCoproprietairesModule } from '@/components/administrateur-judiciaire/modules/patrimoine/LotsCoproprietairesModule'
import { PrestatairesModule } from '@/components/administrateur-judiciaire/modules/patrimoine/Prestataires'
import { VideoprotectionModule } from '@/components/administrateur-judiciaire/modules/patrimoine/VideoprotectionModule'
import { ToastContext, ToastProvider, type OptionsFormulaire, type OptionsPush } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Patrimoine affiché selon la copropriété choisie dans le sélecteur du haut de page (demande de Hugo du 29/10/2026).
 * Sans copropriété choisie (écran rendu seul), chaque écran garde son comportement d'avant.
 */

const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

beforeEach(async () => {
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  window.history.replaceState(null, '', window.location.pathname)
})

async function monter(ecran: ReactElement): Promise<void> {
  await act(async () => {
    render(<ToastProvider>{ecran}</ToastProvider>)
  })
  await waitFor(() => expect(screen.queryByText('Chargement…')).toBeNull())
}

/** Rendu avec un faux ToastProvider qui garde chaque `push` (formulaires et documents générés). */
async function monterAvecPush(ecran: ReactElement) {
  const push = vi.fn<(options: OptionsPush) => number | undefined>()
  await act(async () => {
    render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{ecran}</ToastContext.Provider>)
  })
  return push
}

/** Nombre affiché par l'indicateur de libellé `libelle`. */
function kpi(libelle: string): { num: string; sub: string } {
  const carte = screen.getByText(libelle, { selector: '.kpi .lbl' }).closest('.kpi') as HTMLElement
  return {
    num: carte.querySelector('.num')?.textContent ?? '',
    sub: carte.querySelector('.sub')?.textContent ?? '',
  }
}

/** Texte de la première cellule de chaque ligne du tableau. */
const premieresCellules = (): string[] =>
  Array.from(document.querySelectorAll('table.tbl tbody tr')).map((ligne) => ligne.querySelector('td')?.textContent ?? '')

/** Dernier formulaire rapide ouvert par l'écran. */
const dernierFormulaire = (push: ReturnType<typeof vi.fn>): OptionsFormulaire =>
  push.mock.calls.map(([options]) => options as OptionsPush).findLast((options) => options.kind === 'form') as OptionsFormulaire

describe('Copropriétés — registre complet, copropriété choisie en tête', () => {
  /** Titres des cartes, dans l'ordre d'affichage. */
  const titres = () => Array.from(document.querySelectorAll('.entity-card__title')).map((titre) => titre.textContent)
  const carte = (nom: string) => screen.getByText(nom, { selector: '.entity-card__title' }).closest('.panel') as HTMLElement

  it('met la copropriété choisie en tête et en évidence, suit chaque choix', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await monter(<CoproprietesModule />)
    expect(titres()).toHaveLength(4)
    expect(titres()[0]).toBe('Copropriété Les Tilleuls')
    expect(within(carte('Copropriété Les Tilleuls')).getByText('Copropriété choisie')).toBeInTheDocument()
    expect(carte('Copropriété Les Tilleuls')).toHaveAttribute('aria-current', 'true')
    expect(within(carte('Villa Montaigne')).queryByText('Copropriété choisie')).toBeNull()
    choisir('VM')
    expect(titres()[0]).toBe('Villa Montaigne')
    expect(screen.getAllByText('Copropriété choisie')).toHaveLength(1)
  })

  it('« Lots & copropriétaires » choisit la copropriété de la carte avant d’ouvrir ses lots', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    await monter(<CoproprietesModule />)
    fireEvent.click(within(carte('Le Clos des Vignes')).getByRole('button', { name: 'Lots & copropriétaires' }))
    expect(useSelectionDossier.getState().code).toBe('CV')
    expect(window.location.hash).toBe('#lots')
  })

  // Sinon la carte cliquée sautait en tête de la grille, derrière la fenêtre, sans que rien ne le laisse prévoir.
  it('« Détails » et « Modifier » ne changent ni la copropriété choisie ni l’ordre des cartes', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    const push = await monterAvecPush(<CoproprietesModule />)
    const ordre = titres()
    fireEvent.click(within(carte('Villa Montaigne')).getByRole('button', { name: 'Détails' }))
    expect(useSelectionDossier.getState().code).toBe('LM')
    expect(titres()).toEqual(ordre)
    fireEvent.click(within(carte('Copropriété Les Tilleuls')).getByRole('button', { name: 'Modifier' }))
    expect(dernierFormulaire(push)).toBeDefined()
    expect(useSelectionDossier.getState().code).toBe('LM')
    expect(titres()).toEqual(ordre)
  })

  it('sans copropriété choisie : ordre de la base, aucune mise en évidence', async () => {
    await monter(<CoproprietesModule />)
    expect(titres()).toEqual(['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'])
    expect(screen.queryByText('Copropriété choisie')).toBeNull()
  })
})

describe('Lots & copropriétaires — registre de la copropriété choisie', () => {
  it('filtre le registre, recalcule les indicateurs, préremplit le formulaire et suit chaque choix', async () => {
    useSelectionDossier.setState({ code: 'CV' })
    await monter(<LotsCoproprietairesModule />)
    expect(document.querySelectorAll('table.tbl tbody tr')).toHaveLength(2)
    for (const ligne of document.querySelectorAll('table.tbl tbody tr')) expect(ligne.textContent).toContain('Le Clos des Vignes')
    expect(kpi('Copropriétaires (échantillon)')).toEqual({ num: '2', sub: '48 lots au total' })
    expect(kpi('À jour').num).toBe('0')
    expect(kpi('En retard / impayé').num).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un copropriétaire' }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Copropriété')).toHaveValue('Le Clos des Vignes')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }))
    choisir('LM')
    expect(document.querySelectorAll('table.tbl tbody tr')).toHaveLength(3)
    expect(kpi('Copropriétaires (échantillon)')).toEqual({ num: '3', sub: '36 lots au total' })
  })

  it('sans copropriété choisie : tout le registre, comme avant', async () => {
    await monter(<LotsCoproprietairesModule />)
    expect(document.querySelectorAll('table.tbl tbody tr')).toHaveLength(8)
    expect(kpi('Copropriétaires (échantillon)')).toEqual({ num: '8', sub: `${DEMO_TOTAL_LOTS} lots au total` })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un copropriétaire' }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Copropriété')).toHaveValue('Résidence Le Méridien')
  })
})

describe('Prestataires — ceux de la copropriété choisie en tête', () => {
  const NOMS = DEMO_PRESTATAIRES.map((prestataire) => prestataire.nom)
  /** Prestataires des cartes, dans l'ordre d'affichage. */
  const cartes = () =>
    Array.from(document.querySelectorAll('.card-grid > .panel')).map((carte) => ({
      nom: NOMS.find((nom) => carte.textContent?.includes(nom)),
      enEvidence: carte.textContent?.includes('Sur cette copropriété') ?? false,
    }))

  it('liste complète, ceux de la copropriété d’abord et mis en évidence ; bascule « Seulement cette copropriété »', async () => {
    useSelectionDossier.setState({ code: 'VM' })
    await monter(<PrestatairesModule />)
    expect(cartes()).toHaveLength(9)
    expect(cartes().slice(0, 2)).toEqual([
      { nom: 'Couverture Île-de-France', enEvidence: true },
      { nom: 'Sécurité Incendie 92', enEvidence: true },
    ])
    expect(cartes().slice(2).every((carte) => !carte.enEvidence)).toBe(true)
    expect(kpi('Prestataires référencés')).toEqual({ num: '9', sub: '2 pour Villa Montaigne' })
    const bascule = screen.getByRole('button', { name: /Seulement cette copropriété/ })
    expect(bascule).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(bascule)
    expect(bascule).toHaveAttribute('aria-pressed', 'true')
    expect(cartes().map((carte) => carte.nom)).toEqual(['Couverture Île-de-France', 'Sécurité Incendie 92'])
    expect(kpi('Prestataires référencés').num).toBe('2')
    expect(kpi('Contrats cadre').num).toBe('1')
    expect(kpi('Note moyenne').num).toBe('4,8')
    choisir('LM')
    expect(cartes().every((carte) => carte.enEvidence)).toBe(true)
    expect(cartes()).toHaveLength(5)
  })

  it('sans copropriété choisie : tous, dans l’ordre de la base, sans bascule ni mise en évidence', async () => {
    await monter(<PrestatairesModule />)
    expect(cartes().map((carte) => carte.nom)).toEqual(NOMS)
    expect(cartes().some((carte) => carte.enEvidence)).toBe(false)
    expect(screen.queryByRole('button', { name: /Seulement cette copropriété/ })).toBeNull()
    expect(kpi('Prestataires référencés')).toEqual({ num: '9', sub: 'multi-métiers' })
    expect(kpi('Note moyenne').num).toBe('4,6')
  })
})

describe('Contrats — contrats de la copropriété choisie', () => {
  it('filtre le registre, recalcule les indicateurs et préremplit le formulaire', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    await monter(<ContratsPrestatairesModule />)
    expect(premieresCellules()).toEqual(['Nettoyage parties communes', 'Sécurité incendie (vérifications)'])
    expect(kpi('Contrats actifs')).toEqual({ num: '2', sub: 'Résidence Le Méridien' })
    expect(kpi('Échus').num).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau contrat' }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Copropriété')).toHaveValue('Résidence Le Méridien')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }))
    choisir('VM')
    expect(premieresCellules()).toEqual(['Espaces verts'])
    expect(kpi('Échus').num).toBe('1')
  })

  it('sans copropriété choisie : les cinq contrats, comme avant', async () => {
    await monter(<ContratsPrestatairesModule />)
    expect(premieresCellules()).toHaveLength(5)
    expect(kpi('Contrats actifs')).toEqual({ num: '5', sub: '4 copropriétés' })
  })
})

describe('Ascenseurs — parc de la copropriété choisie', () => {
  it('filtre le parc, calcule les indicateurs, préremplit une copie du champ Copropriété', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    const push = await monterAvecPush(<AscenseursModule />)
    expect(premieresCellules()).toEqual(['Ascenseur A', 'Ascenseur B'])
    expect(kpi('Ascenseurs suivis').num).toBe('2')
    expect(kpi('En conformité').num).toBe('2')
    expect(kpi('Inspection en retard').num).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    const champ = dernierFormulaire(push).fields?.[0]
    expect(champ?.value).toBe('Résidence Le Méridien')
    expect(CHAMP_COPROPRIETE.value).toBeUndefined()
    choisir('VM')
    expect(premieresCellules()).toEqual(['Ascenseur'])
    expect(kpi('Inspection en retard').num).toBe('1')
  })

  it('état vide pour une copropriété sans ascenseur', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await monterAvecPush(<AscenseursModule />)
    expect(screen.getByText('Aucun ascenseur pour Copropriété Les Tilleuls')).toBeInTheDocument()
    expect(document.querySelector('table.tbl')).toBeNull()
    expect(kpi('Ascenseurs suivis').num).toBe('0')
  })

  it('sans copropriété choisie : tout le parc et les indicateurs d’avant (4 / 2 / 1 / 1)', async () => {
    const push = await monterAvecPush(<AscenseursModule />)
    expect(premieresCellules()).toHaveLength(4)
    expect(['Ascenseurs suivis', 'En conformité', 'Contrôle < 90 j', 'Inspection en retard'].map((lbl) => kpi(lbl).num)).toEqual([
      '4',
      '2',
      '1',
      '1',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(dernierFormulaire(push).fields?.[0]).toBe(CHAMP_COPROPRIETE)
  })
})

describe('Vidéoprotection — caméras de la copropriété choisie', () => {
  it('filtre les caméras, calcule les indicateurs, préremplit une copie du champ Copropriété', async () => {
    useSelectionDossier.setState({ code: 'CV' })
    const push = await monterAvecPush(<VideoprotectionModule />)
    expect(premieresCellules()).toEqual(['Local vélos'])
    expect(['Caméras', 'Bâtiments couverts', 'Avec signalétique', 'Conservation > 30 j'].map((lbl) => kpi(lbl).num)).toEqual([
      '1',
      '1',
      '0',
      '1',
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(dernierFormulaire(push).fields?.[0]?.value).toBe('Le Clos des Vignes')
    expect(CHAMP_COPROPRIETE.value).toBeUndefined()
  })

  it('état vide pour une copropriété sans caméra', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await monterAvecPush(<VideoprotectionModule />)
    expect(screen.getByText('Aucune caméra pour Copropriété Les Tilleuls')).toBeInTheDocument()
  })

  it('sans copropriété choisie : toutes les caméras et les indicateurs d’avant (4 / 3 / 3 / 1)', async () => {
    await monterAvecPush(<VideoprotectionModule />)
    expect(premieresCellules()).toHaveLength(4)
    expect(['Caméras', 'Bâtiments couverts', 'Avec signalétique', 'Conservation > 30 j'].map((lbl) => kpi(lbl).num)).toEqual([
      '4',
      '3',
      '3',
      '1',
    ])
  })
})
