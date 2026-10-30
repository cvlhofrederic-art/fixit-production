import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CarnetEntretienModule } from '@/components/administrateur-judiciaire/modules/technique/CarnetEntretienModule'
import { DocumentsInterventionModule } from '@/components/administrateur-judiciaire/modules/technique/DocumentsInterventionModule'
import { DtgPlanPluriannuelModule } from '@/components/administrateur-judiciaire/modules/technique/DtgPlanPluriannuelModule'
import { SinistresModule } from '@/components/administrateur-judiciaire/modules/technique/SinistresModule'
import { VisitesTechniquesModule } from '@/components/administrateur-judiciaire/modules/technique/VisitesTechniquesModule'
import { ToastContext, type OptionsFormulaire, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Écrans Technique & travaux affichés selon la copropriété choisie dans le sélecteur du haut de page : liste filtrée,
 * indicateurs recalculés, formulaire prérempli, état vide ; sans copropriété choisie, écran de la démonstration.
 */

/** Base vidée, mode démo, jeu de démonstration inséré et chargé, aucune copropriété choisie. */
beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

function rendre(element: ReactElement) {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{element}</ToastContext.Provider>)
  return { push }
}

const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

const kpi = (lbl: string) => screen.getByText(lbl, { selector: '.lbl' }).previousElementSibling?.textContent

/** Lignes du corps du tableau (sans l'en-tête) ; aucune s'il n'y a pas de tableau. */
const lignesTableau = () => screen.queryAllByRole('row').slice(1)

/** Texte de la colonne `index` de chaque ligne du tableau. */
const colonne = (index: number) => lignesTableau().map((ligne) => within(ligne).getAllByRole('cell')[index].textContent)

function champCopro(push: ReturnType<typeof rendre>['push']) {
  const formulaire = push.mock.calls.at(-1)?.[0] as OptionsFormulaire
  return formulaire.fields?.find((champ) => champ.label === 'Copropriété')
}

describe('Documents d’intervention', () => {
  it('sans copropriété choisie : les 5 pièces et les indicateurs de la démonstration', () => {
    rendre(<DocumentsInterventionModule />)
    expect(lignesTableau()).toHaveLength(5)
    expect(kpi('Total documents')).toBe('5')
    expect(kpi('Non transmis à la compta')).toBe('2')
    expect(kpi('Transmis à la compta')).toBe('3')
    expect(kpi('Factures')).toBe('2')
  })

  it('pièces de la copropriété choisie, indicateurs recalculés ; état vide sans pièce', () => {
    useSelectionDossier.setState({ code: 'LM' })
    const { push } = rendre(<DocumentsInterventionModule />)
    expect(colonne(0)).toEqual(['Facture FAC-2026-044', 'Facture FAC-2026-051'])
    expect(kpi('Total documents')).toBe('2')
    expect(kpi('Non transmis à la compta')).toBe('1')
    expect(kpi('Factures')).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: /Ajouter/ }))
    expect(champCopro(push)?.value).toBe('Résidence Le Méridien')

    choisir('CV')
    expect(lignesTableau()).toHaveLength(0)
    expect(screen.getByText('Aucun document d’intervention pour Le Clos des Vignes')).toBeInTheDocument()
  })
})

describe('Carnet d’entretien', () => {
  it('sans copropriété choisie : les 5 interventions de la démonstration', () => {
    rendre(<CarnetEntretienModule />)
    expect(lignesTableau()).toHaveLength(5)
    expect(kpi('Interventions consignées')).toBe('5')
    expect(kpi('Sous garantie')).toBe('3')
  })

  it('interventions de la copropriété choisie, indicateurs recalculés, formulaire prérempli', () => {
    useSelectionDossier.setState({ code: 'TL' })
    const { push } = rendre(<CarnetEntretienModule />)
    expect(colonne(1)).toEqual(['Réfection étanchéité terrasse', 'Travaux toiture (prévu)'])
    expect(kpi('Interventions consignées')).toBe('2')
    expect(kpi('Sous garantie')).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle intervention/ }))
    expect(champCopro(push)?.value).toBe('Copropriété Les Tilleuls')

    choisir('VM')
    expect(colonne(1)).toEqual(['Contrôle chaudière collective'])
    expect(kpi('Sous garantie')).toBe('0')
  })
})

describe('Visites techniques', () => {
  it('sans copropriété choisie : les 4 visites et les indicateurs de la démonstration', () => {
    rendre(<VisitesTechniquesModule />)
    expect(lignesTableau()).toHaveLength(4)
    expect(kpi('Visites réalisées')).toBe('4')
    expect(kpi('Points à surveiller')).toBe('2')
    expect(kpi('Points déficients')).toBe('1')
  })

  it('visite de la copropriété choisie, indicateurs recalculés, formulaire prérempli', () => {
    useSelectionDossier.setState({ code: 'TL' })
    const { push } = rendre(<VisitesTechniquesModule />)
    expect(colonne(2)).toEqual(['Toiture'])
    expect(kpi('Visites réalisées')).toBe('1')
    expect(kpi('Points à surveiller')).toBe('0')
    expect(kpi('Points déficients')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle visite/ }))
    expect(champCopro(push)?.value).toBe('Copropriété Les Tilleuls')
  })
})

describe('DTG & plan pluriannuel de travaux', () => {
  it('sans copropriété choisie : les 4 copropriétés et les cumuls de la démonstration', () => {
    rendre(<DtgPlanPluriannuelModule />)
    expect(lignesTableau()).toHaveLength(4)
    expect(kpi('DTG réalisés')).toBe('3')
    expect(kpi('PPT approuvés en AG')).toBe('2')
    expect(kpi('En préparation')).toBe('1')
    expect(kpi('Budget pluriannuel')).toBe('520 k€')
  })

  it('DTG et PPT de la copropriété choisie, indicateurs de cette copropriété, formulaire prérempli', () => {
    useSelectionDossier.setState({ code: 'LM' })
    const { push } = rendre(<DtgPlanPluriannuelModule />)
    expect(colonne(0)).toEqual(['Résidence Le Méridien'])
    expect(kpi('DTG réalisés')).toBe('1')
    expect(kpi('PPT approuvés en AG')).toBe('1')
    expect(kpi('En préparation')).toBe('0')
    expect(kpi('Budget pluriannuel')).toBe('185 k€')
    fireEvent.click(screen.getByRole('button', { name: /Lancer un DTG/ }))
    expect(champCopro(push)?.value).toBe('Résidence Le Méridien')

    choisir('TL')
    expect(kpi('DTG réalisés')).toBe('0')
    expect(kpi('Budget pluriannuel')).toBe('—')
  })
})

describe('Sinistres', () => {
  it('sans copropriété choisie : les 3 sinistres, assureurs de la démonstration, déclaration sur la 1re copropriété', () => {
    rendre(<SinistresModule />)
    expect(lignesTableau()).toHaveLength(3)
    expect(kpi('Sinistres suivis')).toBe('3')
    expect(kpi('Assureurs')).toBe('2')
    expect(screen.getByText('MMA · AXA')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Copropriété')).toHaveValue('Résidence Le Méridien')
  })

  it('sinistres de la copropriété choisie, indicateurs recalculés, déclaration préremplie ; état vide', () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre(<SinistresModule />)
    expect(colonne(1)).toEqual(['Infiltration toiture'])
    expect(kpi('Sinistres suivis')).toBe('1')
    expect(kpi('En cours')).toBe('1')
    expect(kpi('Clôturés')).toBe('0')
    expect(kpi('Assureurs')).toBe('1')
    expect(screen.getByText('AXA', { selector: '.sub' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Déclarer un sinistre/ }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Copropriété')).toHaveValue('Copropriété Les Tilleuls')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }))

    choisir('VM')
    expect(lignesTableau()).toHaveLength(0)
    expect(screen.getByText('Aucun sinistre pour Villa Montaigne')).toBeInTheDocument()
  })
})
