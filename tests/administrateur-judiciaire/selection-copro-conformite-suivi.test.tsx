import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendrierReglementaireModule } from '@/components/administrateur-judiciaire/modules/conformite/CalendrierReglementaireModule'
import { ObligationsEcheancesModule } from '@/components/administrateur-judiciaire/modules/conformite/ObligationsEcheancesModule'
import { PreparateurAgModule } from '@/components/administrateur-judiciaire/modules/conformite/PreparateurAgModule'
import { ProcurationsModule } from '@/components/administrateur-judiciaire/modules/conformite/ProcurationsModule'
import { SuiviDeliberationsModule } from '@/components/administrateur-judiciaire/modules/conformite/SuiviDeliberationsModule'
import {
  ToastContext,
  type OptionsDocument,
  type OptionsFormulaire,
  type ToastApi,
} from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Échéanciers, délibérations, pouvoirs et préparation d'AG affichés selon la copropriété choisie dans le sélecteur du
 * haut de page : listes filtrées (sans toucher aux hooks partagés avec « Aujourd'hui »), indicateurs recalculés,
 * formulaires et documents de la copropriété choisie ; sans copropriété choisie, écran de la démonstration.
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

async function rendre(element: ReactElement) {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  await act(async () => {
    render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{element}</ToastContext.Provider>)
  })
  return { push }
}

const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

const kpi = (lbl: string) => screen.getByText(lbl, { selector: '.lbl' }).previousElementSibling?.textContent

const sousKpi = (lbl: string) => screen.getByText(lbl, { selector: '.lbl' }).nextElementSibling?.textContent

/** Lignes du corps du premier tableau de l'écran (sans l'en-tête) ; aucune sans tableau. */
const lignesTableau = () => {
  const tableau = screen.queryAllByRole('table')[0]
  return tableau ? within(tableau).getAllByRole('row').slice(1) : []
}

const colonne = (index: number) => lignesTableau().map((ligne) => within(ligne).getAllByRole('cell')[index].textContent)

function champCopro(push: Awaited<ReturnType<typeof rendre>>['push']) {
  const formulaire = push.mock.calls.at(-1)?.[0] as OptionsFormulaire
  return formulaire.fields?.find((champ) => champ.label === 'Copropriété')
}

describe('Obligations & échéances', () => {
  it('sans copropriété choisie : obligations de tout le portefeuille', async () => {
    await rendre(<ObligationsEcheancesModule />)
    expect(new Set(colonne(1)).size).toBe(4)
    expect(kpi('Obligations suivies')).toBe(String(lignesTableau().length))
    expect(sousKpi('Obligations suivies')).toMatch(/^4 copropriétés · /)
    expect(screen.getByText(/légales? échues? ou à accomplir aujourd'hui|Aucune obligation légale échue/)).toBeInTheDocument()
  })

  it('obligations de la copropriété choisie seulement (moteur et suivi), indicateurs recalculés', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    await rendre(<ObligationsEcheancesModule />)
    const copros = colonne(1)
    expect(copros.length).toBeGreaterThan(0)
    expect(new Set(copros)).toEqual(new Set(['Résidence Le Méridien']))
    expect(kpi('Obligations suivies')).toBe(String(copros.length))
    expect(sousKpi('Obligations suivies')).not.toMatch(/copropriété/)

    choisir('TL')
    expect(new Set(colonne(1))).toEqual(new Set(['Copropriété Les Tilleuls']))
  })
})

describe('Calendrier réglementaire', () => {
  it('sans copropriété choisie : les 6 échéances réglementaires et les échéances de tous les mandats', async () => {
    await rendre(<CalendrierReglementaireModule />)
    expect(lignesTableau()).toHaveLength(6)
    expect(screen.getByText(/tous les mandats/)).toBeInTheDocument()
  })

  it('échéances de la copropriété choisie, indicateurs recalculés, mandat de cette copropriété seulement', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    await rendre(<CalendrierReglementaireModule />)
    expect(colonne(0)).toEqual(['Approbation des comptes', 'Vérification sécurité incendie'])
    expect(sousKpi('Échéances suivies')).toMatch(/^2 réglementaires · /)
    expect(kpi('Conformes')).toBe('1')
    expect(screen.queryByText(/tous les mandats/)).toBeNull()
    expect(screen.getByText(/Moteur de délais légaux · Résidence Le Méridien/)).toBeInTheDocument()
    expect(screen.queryByText(/Le Clos des Vignes/)).toBeNull()

    choisir('CV')
    expect(colonne(0)).toEqual(['Assemblée générale annuelle', 'Télédéclaration registre'])
  })
})

describe('Suivi des délibérations', () => {
  it('sans copropriété choisie : les 5 délibérations et les indicateurs de la démonstration', async () => {
    await rendre(<SuiviDeliberationsModule />)
    expect(lignesTableau()).toHaveLength(5)
    expect(kpi('Délibérations suivies')).toBe('5')
    expect(kpi('En cours (délais)')).toBe('2')
    expect(kpi('En retard (resp. civile)')).toBe('1')
  })

  it('délibérations de la copropriété choisie, indicateurs recalculés, formulaire prérempli', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    const { push } = await rendre(<SuiviDeliberationsModule />)
    expect(colonne(0)).toEqual(['Recouvrement des impayés', 'Réfection toiture'])
    expect(kpi('Délibérations suivies')).toBe('2')
    expect(kpi('En cours (délais)')).toBe('1')
    expect(kpi('Proche échéance (≤3j)')).toBe('0')
    expect(kpi('En retard (resp. civile)')).toBe('1')
    expect(kpi('Terminées')).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle délibération/ }))
    expect(champCopro(push)?.value).toBe('Copropriété Les Tilleuls')

    choisir('VM')
    expect(lignesTableau()).toHaveLength(0)
    expect(screen.getByText('Aucune délibération pour Villa Montaigne')).toBeInTheDocument()
  })
})

describe('Procurations & pouvoirs', () => {
  it('sans copropriété choisie : les 4 pouvoirs et les indicateurs de la démonstration', async () => {
    await rendre(<ProcurationsModule />)
    expect(lignesTableau()).toHaveLength(4)
    expect(kpi('Pouvoirs reçus')).toBe('3')
    expect(kpi('Pouvoir en blanc')).toBe('1')
  })

  it('pouvoirs de la copropriété choisie, indicateurs recalculés, formulaire prérempli', async () => {
    useSelectionDossier.setState({ code: 'CV' })
    const { push } = await rendre(<ProcurationsModule />)
    expect(colonne(1)).toEqual(['SCI Belvédère'])
    expect(kpi('Pouvoirs reçus')).toBe('0')
    expect(kpi('Pouvoir en blanc')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer un pouvoir/ }))
    expect(champCopro(push)?.value).toBe('Le Clos des Vignes')

    choisir('LM')
    expect(colonne(1)).toEqual(['M. Bernard (lot 12)', 'Mme Olivier (lot 23)'])
    expect(kpi('Pouvoirs reçus')).toBe('2')
    expect(kpi('Pouvoir en blanc')).toBe('0')

    choisir('TL')
    expect(screen.getByText('Aucun pouvoir pour Copropriété Les Tilleuls')).toBeInTheDocument()
  })
})

describe('Préparateur d’assemblée générale', () => {
  const dossier = (push: Awaited<ReturnType<typeof rendre>>['push']) => {
    fireEvent.click(screen.getByRole('button', { name: /Générer le dossier/ }))
    return push.mock.calls.at(-1)?.[0] as OptionsDocument
  }
  const etape = (libelle: string) => screen.getByRole('button', { name: new RegExp(libelle) })

  it('sans copropriété choisie : dossier de la démonstration (Résidence Le Méridien)', async () => {
    const { push } = await rendre(<PreparateurAgModule />)
    const document = dossier(push)
    expect(document.meta).toBe('Résidence Le Méridien · RG 26/00892 · établi le 19/06/2026')
    expect(JSON.stringify(document.lines)).toContain('Vote du budget prévisionnel 2026 — 142 000 €')
  })

  it('dossier de la copropriété choisie ; liste de préparation propre à chaque copropriété', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    const { push } = await rendre(<PreparateurAgModule />)
    const document = dossier(push)
    expect(document.meta).toMatch(/^Copropriété Les Tilleuls · RG /)
    expect(document.meta).not.toContain('26/00892')
    expect(JSON.stringify(document.lines)).not.toContain('142 000')

    fireEvent.click(etape("Rédiger l'ordre du jour"))
    expect(screen.getByText('Préparation — 1/7 étapes')).toBeInTheDocument()
    choisir('CV')
    expect(screen.getByText('Préparation — 0/7 étapes')).toBeInTheDocument()
    choisir('TL')
    expect(screen.getByText('Préparation — 1/7 étapes')).toBeInTheDocument()
  })
})
