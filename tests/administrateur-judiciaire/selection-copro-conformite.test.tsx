import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccessibiliteModule } from '@/components/administrateur-judiciaire/modules/conformite/AccessibiliteModule'
import { AssurancesModule } from '@/components/administrateur-judiciaire/modules/conformite/AssurancesModule'
import { ImmatriculationRegistreModule } from '@/components/administrateur-judiciaire/modules/conformite/ImmatriculationRegistreModule'
import { PerformanceEnergetiqueModule } from '@/components/administrateur-judiciaire/modules/conformite/PerformanceEnergetiqueModule'
import { SecuriteIncendieModule } from '@/components/administrateur-judiciaire/modules/conformite/SecuriteIncendieModule'
import {
  ToastContext,
  type LigneDocument,
  type OptionsDocument,
  type OptionsFormulaire,
  type OptionsPush,
} from '@/components/administrateur-judiciaire/ui/toast'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Conformité affichée selon la copropriété choisie dans le sélecteur du haut de page (demande de Hugo du 29/10/2026) :
 * registres filtrés, indicateurs recalculés, documents générés au nom de la copropriété choisie. Sans copropriété
 * choisie (écran rendu seul), chaque écran garde son comportement d'avant.
 */

const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

beforeEach(() => {
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

/** Rendu avec un faux ToastProvider qui garde chaque `push` (formulaires et documents générés). */
async function monter(ecran: ReactElement) {
  const push = vi.fn<(options: OptionsPush) => number | undefined>()
  await act(async () => {
    render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{ecran}</ToastContext.Provider>)
  })
  return push
}

/** Clique le bouton et renvoie l'élément ouvert (document ou formulaire). */
function ouvrir<T extends OptionsPush>(push: ReturnType<typeof vi.fn>, bouton: string): T {
  fireEvent.click(screen.getByRole('button', { name: bouton }))
  return push.mock.calls.at(-1)?.[0] as T
}

/** Valeur de la ligne « clé / valeur » `cle` d'un document généré. */
function valeurDoc(document: OptionsDocument, cle: string): unknown {
  const ligne = (document.lines ?? []).find((candidate: LigneDocument) => typeof candidate === 'object' && candidate.k === cle)
  return typeof ligne === 'object' ? ligne.v : undefined
}

/** Nombre affiché par l'indicateur de libellé `libelle`. */
const kpi = (libelle: string): string =>
  screen.getByText(libelle, { selector: '.kpi .lbl' }).closest('.kpi')?.querySelector('.num')?.textContent ?? ''

const premieresCellules = (): string[] =>
  Array.from(document.querySelectorAll('table.tbl tbody tr')).map((ligne) => ligne.querySelector('td')?.textContent ?? '')

describe('Immatriculation — registre de la copropriété choisie', () => {
  const KPIS = ['Copropriétés immatriculées', 'À actualiser', 'Non immatriculée', 'Lots déclarés']

  it('filtre le registre, recalcule les indicateurs, télédéclare la copropriété choisie', async () => {
    useSelectionDossier.setState({ code: 'VM' })
    const push = await monter(<ImmatriculationRegistreModule />)
    expect(premieresCellules()).toEqual(['Villa Montaigne'])
    expect(KPIS.map(kpi)).toEqual(['0', '0', '1', '12'])
    const document = ouvrir<OptionsDocument>(push, 'Télédéclarer')
    expect(document.meta).toContain('Villa Montaigne')
    expect(valeurDoc(document, "Numéro d'immatriculation")).toBe('—')
    expect(valeurDoc(document, 'Nombre de lots')).toBe('12')
    expect(valeurDoc(document, 'Budget prévisionnel')).toBe(formatEuros(54000))
    choisir('CV')
    expect(premieresCellules()).toEqual(['Le Clos des Vignes'])
    expect(valeurDoc(ouvrir<OptionsDocument>(push, 'Télédéclarer'), "Numéro d'immatriculation")).toBe('BB-2345-678')
  })

  it('sans copropriété choisie : tout le registre et le document d’avant', async () => {
    const push = await monter(<ImmatriculationRegistreModule />)
    expect(premieresCellules()).toHaveLength(4)
    expect(KPIS.map(kpi)).toEqual(['3', '1', '1', '120'])
    const document = ouvrir<OptionsDocument>(push, 'Télédéclarer')
    expect(document.meta).toBe("Agence nationale de l'habitat · télédéclaration")
    expect(valeurDoc(document, "Numéro d'immatriculation")).toBe('AAA000-123-456')
    expect(valeurDoc(document, 'Budget prévisionnel')).toBe('142 000 €')
  })
})

describe('Assurances — contrats de la copropriété choisie', () => {
  /** Intitulés des cartes de contrat. */
  const cartes = () => screen.getAllByRole('button', { name: 'Voir' }).map((bouton) => bouton.previousElementSibling?.textContent)

  it('n’affiche que ses contrats, recalcule les indicateurs, nomme la copropriété dans le formulaire', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    const push = await monter(<AssurancesModule />)
    expect(cartes()).toEqual(['Multirisque immeuble', 'RC du syndicat (obligatoire)'])
    expect(['Contrats actifs', 'RC obligatoire couverte', 'Échéance < 90 j'].map(kpi)).toEqual(['2', 'OK', '0'])
    expect(ouvrir<OptionsFormulaire>(push, 'Nouveau contrat').title).toBe('Nouveau contrat — Résidence Le Méridien')
    choisir('TL')
    expect(cartes()).toHaveLength(4)
    expect(kpi('Échéance < 90 j')).toBe('1')
  })

  it('sans copropriété choisie : les quatre contrats et les indicateurs d’avant (4, OK, 1)', async () => {
    const push = await monter(<AssurancesModule />)
    expect(cartes()).toHaveLength(4)
    expect(['Contrats actifs', 'RC obligatoire couverte', 'Échéance < 90 j'].map(kpi)).toEqual(['4', 'OK', '1'])
    expect(ouvrir<OptionsFormulaire>(push, 'Nouveau contrat').title).toBe('Nouveau contrat')
  })
})

describe('DPE — étiquette de la copropriété choisie', () => {
  it('filtre le tableau, recalcule les indicateurs, audit au nom de la copropriété', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    const push = await monter(<PerformanceEnergetiqueModule />)
    expect(premieresCellules()).toEqual(['Les Tilleuls'])
    expect(kpi('Étiquette de la copropriété')).toBe('F')
    expect(screen.queryByText('Étiquette moyenne du parc')).toBeNull()
    expect(['DPE collectifs', 'Passoire (F/G)', 'Audit recommandé'].map(kpi)).toEqual(['1', '1', '0'])
    const audit = ouvrir<OptionsDocument>(push, 'Audit énergétique')
    expect(audit.meta).toBe('Copropriété Les Tilleuls · 24 lots')
    expect(valeurDoc(audit, 'Classe énergétique (DPE collectif)')).toBe('F')
    choisir('CV')
    expect(kpi('Étiquette de la copropriété')).toBe('E')
    expect(kpi('Audit recommandé')).toBe('1')
  })

  it('sans copropriété choisie : tout le parc et l’audit d’avant', async () => {
    const push = await monter(<PerformanceEnergetiqueModule />)
    expect(premieresCellules()).toHaveLength(4)
    expect(kpi('Étiquette moyenne du parc')).toBe('D')
    expect(['DPE collectifs', 'Passoire (F/G)', 'Audit recommandé'].map(kpi)).toEqual(['4', '1', '1'])
    const audit = ouvrir<OptionsDocument>(push, 'Audit énergétique')
    expect(audit.meta).toBe('Résidence Le Méridien · 36 lots')
    expect(valeurDoc(audit, 'Classe énergétique (DPE collectif)')).toBe('D')
  })
})

describe('Accessibilité — diagnostic de la copropriété choisie', () => {
  it('document et indicateur au nom de la copropriété choisie', async () => {
    useSelectionDossier.setState({ code: 'CV' })
    const push = await monter(<AccessibiliteModule />)
    expect(ouvrir<OptionsDocument>(push, 'Diagnostic').meta).toBe('Le Clos des Vignes · 48 lots')
    expect(screen.queryByText('Copropriétés suivies')).toBeNull()
    expect(kpi('Lots')).toBe('48')
    choisir('VM')
    expect(ouvrir<OptionsDocument>(push, 'Diagnostic').meta).toBe('Villa Montaigne · 12 lots')
  })

  it('sans copropriété choisie : le document et les indicateurs d’avant', async () => {
    const push = await monter(<AccessibiliteModule />)
    expect(ouvrir<OptionsDocument>(push, 'Diagnostic').meta).toBe('Copropriété Les Tilleuls · 24 lots')
    expect(kpi('Copropriétés suivies')).toBe('4')
  })
})

describe('Sécurité incendie — registre de la copropriété choisie', () => {
  it('registre au nom de la copropriété choisie', async () => {
    useSelectionDossier.setState({ code: 'VM' })
    const push = await monter(<SecuriteIncendieModule />)
    expect(ouvrir<OptionsDocument>(push, 'Registre sécurité').meta).toBe('Villa Montaigne · mis à jour le 19/06/2026')
    choisir('TL')
    expect(ouvrir<OptionsDocument>(push, 'Registre sécurité').meta).toBe('Copropriété Les Tilleuls · mis à jour le 19/06/2026')
  })

  it('sans copropriété choisie : le registre d’avant', async () => {
    const push = await monter(<SecuriteIncendieModule />)
    expect(ouvrir<OptionsDocument>(push, 'Registre sécurité').meta).toBe('Résidence Le Méridien · mis à jour le 19/06/2026')
  })
})
