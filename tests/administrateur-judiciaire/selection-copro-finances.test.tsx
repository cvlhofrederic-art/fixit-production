import './fuseau-paris'
import 'fake-indexeddb/auto'
import type { ReactElement } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_TOTAL_BUDGET, DEMO_TOTAL_IMPAYES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import { RemboursementsModule } from '@/components/administrateur-judiciaire/modules/extranet/RemboursementsModule'
import { AppelsDeFondsModule } from '@/components/administrateur-judiciaire/modules/finances/AppelsDeFondsModule'
import { BudgetPrevisionnelModule } from '@/components/administrateur-judiciaire/modules/finances/BudgetPrevisionnelModule'
import { ComptabiliteModule } from '@/components/administrateur-judiciaire/modules/finances/ComptabiliteModule'
import { FondsTravauxModule } from '@/components/administrateur-judiciaire/modules/finances/FondsTravauxModule'
import { ImpayesRecouvrementModule } from '@/components/administrateur-judiciaire/modules/finances/ImpayesRecouvrementModule'
import { OpenBankingModule } from '@/components/administrateur-judiciaire/modules/finances/OpenBankingModule'
import { HonorairesTaxationModule } from '@/components/administrateur-judiciaire/modules/mandat/HonorairesTaxation'
import { ToastContext, type OptionsPush } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Lot « finances » du sélecteur de copropriété du haut de page : chaque page suit la copropriété choisie (lignes
 * filtrées, indicateurs recalculés, formulaires préremplis, état vide) et garde son comportement d'avant quand
 * aucune copropriété n'est choisie (écran rendu seul).
 */

beforeEach(() => {
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

/** Rend un écran dans un contexte de toasts espionné ; renvoie l'espion de push. */
async function rendre(ecran: ReactElement) {
  const push = vi.fn<(options: OptionsPush) => number | undefined>()
  await act(async () => {
    render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{ecran}</ToastContext.Provider>)
  })
  return push
}

const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

/** Carte d'indicateur portant ce libellé. */
function carteKpi(libelle: string): HTMLElement {
  const etiquette = screen.getAllByText(libelle).find((element) => element.classList.contains('lbl'))
  expect(etiquette, `indicateur « ${libelle} »`).toBeDefined()
  return etiquette?.closest('.kpi') as HTMLElement
}

const valeurKpi = (libelle: string): string => carteKpi(libelle).querySelector('.num')?.textContent ?? ''
const sousTitreKpi = (libelle: string): string => carteKpi(libelle).querySelector('.sub')?.textContent ?? ''

/** Panneau dont le titre commence par `titre`. */
function panneau(titre: string): HTMLElement {
  const entete = screen
    .getAllByRole('heading', { level: 3 })
    .find((element) => element.textContent?.startsWith(titre))
  expect(entete, `panneau « ${titre} »`).toBeDefined()
  return entete?.closest('.panel') as HTMLElement
}

/** Texte des lignes du tableau d'un panneau. */
const lignes = (titre: string): string[] =>
  Array.from(panneau(titre).querySelectorAll('tbody tr')).map((ligne) => ligne.textContent ?? '')

/** Champs du formulaire ouvert par push (kind « form »). */
function champsFormulaire(push: ReturnType<typeof vi.fn>): { label?: unknown; value?: unknown }[] {
  const options = push.mock.calls.at(-1)?.[0] as OptionsPush | undefined
  expect(options?.kind).toBe('form')
  return options && options.kind === 'form' ? [...(options.fields ?? [])] : []
}

describe('Budget prévisionnel', () => {
  it('sans copropriété choisie : sélecteur local, Résidence Le Méridien par défaut, sélection globale intacte', async () => {
    await rendre(<BudgetPrevisionnelModule />)
    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Copropriété' })
    expect(select.value).toBe('Résidence Le Méridien')
    expect(valeurKpi('Budget voté')).toBe(formatEuros(142000))
    fireEvent.change(select, { target: { value: 'Villa Montaigne' } })
    expect(valeurKpi('Budget voté')).toBe(formatEuros(54000))
    expect(panneau('Postes budgétaires').textContent).toContain('Villa Montaigne')
    expect(useSelectionDossier.getState().code).toBeNull()
  })

  it('suit la copropriété choisie, et son sélecteur choisit la copropriété du haut de page', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await rendre(<BudgetPrevisionnelModule />)
    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Copropriété' })
    expect(select.value).toBe('Copropriété Les Tilleuls')
    expect(valeurKpi('Budget voté')).toBe(formatEuros(96000))
    expect(panneau('Postes budgétaires').textContent).toContain('Copropriété Les Tilleuls')
    choisir('CV')
    expect(select.value).toBe('Le Clos des Vignes')
    expect(valeurKpi('Réalisé')).toBe(formatEuros(151200))
    fireEvent.change(select, { target: { value: 'Villa Montaigne' } })
    expect(useSelectionDossier.getState().code).toBe('VM')
    expect(valeurKpi('Budget voté')).toBe(formatEuros(54000))
  })
})

describe('Appels de fonds', () => {
  it('sans copropriété choisie : toutes les quotes-parts et les cumuls', async () => {
    const push = await rendre(<AppelsDeFondsModule />)
    expect(lignes('Quotes-parts par copropriété')).toHaveLength(4)
    expect(valeurKpi('Budget annuel voté')).toBe(formatEuros(DEMO_TOTAL_BUDGET))
    expect(valeurKpi('Taux de recouvrement')).toBe(
      Math.round(((DEMO_TOTAL_BUDGET - DEMO_TOTAL_IMPAYES) / DEMO_TOTAL_BUDGET) * 100) + ' %',
    )
    fireEvent.click(screen.getByRole('button', { name: /Émettre un appel/ }))
    expect(champsFormulaire(push)[0]).toBe(CHAMP_COPROPRIETE)
  })

  it('la copropriété choisie : sa quote-part, ses indicateurs et le formulaire prérempli', async () => {
    useSelectionDossier.setState({ code: 'CV' })
    const push = await rendre(<AppelsDeFondsModule />)
    const quotesParts = lignes('Quotes-parts par copropriété')
    expect(quotesParts).toHaveLength(1)
    expect(quotesParts[0]).toContain('Le Clos des Vignes')
    expect(valeurKpi('Budget annuel voté')).toBe(formatEuros(198000))
    expect(valeurKpi('Cotisation fonds travaux')).toBe(formatEuros(9900))
    expect(valeurKpi('Taux de recouvrement')).toBe('89 %')
    fireEvent.click(screen.getByRole('button', { name: /Émettre un appel/ }))
    expect(champsFormulaire(push)[0]).toEqual({ ...CHAMP_COPROPRIETE, value: 'Le Clos des Vignes' })
    expect(CHAMP_COPROPRIETE.value).toBeUndefined()
    choisir('VM')
    expect(lignes('Quotes-parts par copropriété')[0]).toContain('Villa Montaigne')
    expect(valeurKpi('Taux de recouvrement')).toBe('100 %')
  })
})

describe('Fonds travaux', () => {
  it('sans copropriété choisie : toutes les copropriétés et les cumuls', async () => {
    const push = await rendre(<FondsTravauxModule />)
    expect(lignes('Fonds travaux par copropriété')).toHaveLength(4)
    expect(valeurKpi('Solde total')).toBe(formatEuros(54000))
    expect(valeurKpi('Sorties (travaux)')).toBe(formatEuros(12100))
    expect(valeurKpi('Fonds insuffisant')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: /Appel de cotisation/ }))
    const options = push.mock.calls.at(-1)?.[0]
    expect(options?.kind === 'doc' && options.meta).toBe('Résidence Le Méridien · échéance 01/07/2026')
  })

  it('la copropriété choisie : sa ligne, ses indicateurs et son avis d’appel', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    const push = await rendre(<FondsTravauxModule />)
    const fonds = lignes('Fonds travaux par copropriété')
    expect(fonds).toHaveLength(1)
    expect(fonds[0]).toContain('Copropriété Les Tilleuls')
    expect(valeurKpi('Solde total')).toBe(formatEuros(2100))
    expect(valeurKpi('Cotisations annuelles')).toBe(formatEuros(4800))
    expect(valeurKpi('Sorties (travaux)')).toBe('—')
    expect(valeurKpi('Fonds insuffisant')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: /Appel de cotisation/ }))
    const options = push.mock.calls.at(-1)?.[0]
    expect(options?.kind === 'doc' && options.meta).toBe('Copropriété Les Tilleuls · échéance 01/07/2026')
    choisir('LM')
    expect(lignes('Fonds travaux par copropriété')[0]).toContain('Résidence Le Méridien')
    expect(valeurKpi('Fonds insuffisant')).toBe('0')
  })
})

describe('Impayés & recouvrement', () => {
  it('sans copropriété choisie : tous les débiteurs et les indicateurs d’avant', async () => {
    await rendre(<ImpayesRecouvrementModule />)
    expect(lignes('Comptes débiteurs')).toHaveLength(4)
    expect(valeurKpi('Total des impayés')).toBe(formatEuros(DEMO_TOTAL_IMPAYES))
    expect(sousTitreKpi('Total des impayés')).toBe('sur 4 copropriétés')
    expect(sousTitreKpi('Procédure contentieuse')).toBe('SCI Belvédère · 9 200 €')
    expect(valeurKpi("Taux d'impayés moyen")).toBe('18%')
  })

  it('la copropriété choisie : ses débiteurs, ses indicateurs et le formulaire de recouvrement', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await rendre(<ImpayesRecouvrementModule />)
    const debiteurs = lignes('Comptes débiteurs')
    expect(debiteurs).toHaveLength(2)
    expect(debiteurs.join(' ')).toContain('SCI Belvédère')
    expect(debiteurs.join(' ')).toContain('Antoine Rousseau')
    expect(valeurKpi('Total des impayés')).toBe(formatEuros(34800))
    expect(sousTitreKpi('Total des impayés')).not.toContain('4 copropriétés')
    expect(valeurKpi('Copropriétaires concernés')).toBe('2')
    expect(valeurKpi('Procédure contentieuse')).toBe('1')
    expect(sousTitreKpi('Procédure contentieuse')).toContain('SCI Belvédère')
    expect(valeurKpi("Taux d'impayés")).toBe('36 %')
    fireEvent.click(screen.getByRole('button', { name: /Engager le recouvrement/ }))
    const options = within(screen.getByRole('dialog'))
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toContain('SCI Belvédère')
    expect(options).toContain('Antoine Rousseau')
    expect(options).not.toContain('Sophie Garnier')
  })

  it('une copropriété sans débiteur : état vide à son nom', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await rendre(<ImpayesRecouvrementModule />)
    choisir('VM')
    expect(screen.getByText('Aucun compte débiteur pour Villa Montaigne')).toBeTruthy()
    expect(valeurKpi('Total des impayés')).toBe(formatEuros(0))
    expect(valeurKpi('Procédure contentieuse')).toBe('0')
  })
})

describe('Open banking', () => {
  it('sans copropriété choisie : toutes les transactions et les indicateurs d’avant', async () => {
    await rendre(<OpenBankingModule />)
    expect(lignes('Transactions récentes')).toHaveLength(4)
    expect(valeurKpi('Comptes connectés')).toBe('4')
    expect(valeurKpi('Transactions sync (mois)')).toBe('128')
    expect(valeurKpi('Auto-rapprochées')).toBe('96 %')
  })

  it('la copropriété choisie : ses transactions et des indicateurs calculés sur elles', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    await rendre(<OpenBankingModule />)
    expect(lignes('Transactions récentes')).toHaveLength(2)
    expect(valeurKpi('Comptes connectés')).toBe('1')
    expect(valeurKpi('Transactions sync (mois)')).toBe('2')
    expect(valeurKpi('Auto-rapprochées')).toBe('100 %')
    expect(valeurKpi('À revoir')).toBe('0')
    choisir('TL')
    expect(lignes('Transactions récentes')[0]).toContain('Prélèvement inconnu')
    expect(valeurKpi('À revoir')).toBe('1')
    choisir('CV')
    expect(screen.getByText('Aucune transaction pour Le Clos des Vignes')).toBeTruthy()
    expect(valeurKpi('Auto-rapprochées')).toBe('—')
  })
})

describe('Remboursements', () => {
  it('sans copropriété choisie : tous les remboursements et les indicateurs d’avant', async () => {
    const push = await rendre(<RemboursementsModule />)
    expect(lignes('Remboursements')).toHaveLength(4)
    expect(valeurKpi('Remboursements (année)')).toBe('12')
    expect(valeurKpi('Total remboursé (année)')).toBe('3 480 €')
    expect(valeurKpi('À traiter')).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: /Nouveau remboursement/ }))
    expect(champsFormulaire(push)[0]).toBe(CHAMP_COPROPRIETE)
  })

  it('la copropriété choisie : ses remboursements, ses indicateurs et le formulaire prérempli', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    const push = await rendre(<RemboursementsModule />)
    const remboursements = lignes('Remboursements')
    expect(remboursements).toHaveLength(2)
    expect(remboursements.join(' ')).toContain('Mme Olivier')
    expect(remboursements.join(' ')).toContain('M. Bernard')
    expect(valeurKpi('Remboursements (année)')).toBe('2')
    expect(valeurKpi('Total remboursé (année)')).toBe(formatEuros(142))
    expect(valeurKpi('À traiter')).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: /Nouveau remboursement/ }))
    expect(champsFormulaire(push)[0]).toEqual({ ...CHAMP_COPROPRIETE, value: 'Résidence Le Méridien' })
    choisir('TL')
    expect(screen.getByText('Aucun remboursement pour Copropriété Les Tilleuls')).toBeTruthy()
    expect(valeurKpi('À traiter')).toBe('0')
  })
})

describe('Comptabilité', () => {
  it('sans copropriété choisie : écritures, appels et exercices de toutes les copropriétés', async () => {
    const push = await rendre(<ComptabiliteModule />)
    expect(valeurKpi('Solde comptes séparés')).toBe(formatEuros(171400))
    expect(valeurKpi('Budget annuel voté')).toBe(formatEuros(DEMO_TOTAL_BUDGET))
    expect(lignes('Journal des écritures')).toHaveLength(6)
    expect(panneau('Derniers appels de fonds').querySelectorAll('li')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle écriture/ }))
    expect(champsFormulaire(push)[0]).toBe(CHAMP_COPROPRIETE)
    fireEvent.click(screen.getByRole('tab', { name: /Clôture d'exercice/ }))
    expect(lignes('Exercices comptables')).toHaveLength(4)
  })

  it('la copropriété choisie : ses indicateurs, ses écritures, ses appels et son exercice', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    const push = await rendre(<ComptabiliteModule />)
    expect(valeurKpi('Solde comptes séparés')).toBe('—')
    expect(valeurKpi('Budget annuel voté')).toBe(formatEuros(142000))
    expect(valeurKpi('Dépenses engagées')).toBe(formatEuros(58400))
    expect(valeurKpi('Impayés')).toBe(formatEuros(8460))
    expect(valeurKpi('Fonds travaux')).toBe(formatEuros(14200))
    const journal = lignes('Journal des écritures')
    expect(journal).toHaveLength(3)
    expect(journal.join(' ')).toContain('Encaissement charges M. Bernard')
    expect(journal.join(' ')).not.toContain('Honoraires de gestion')
    const appels = Array.from(panneau('Derniers appels de fonds').querySelectorAll('li'))
    expect(appels).toHaveLength(2)
    expect(appels.every((appel) => appel.textContent?.includes('Le Méridien'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle écriture/ }))
    expect(champsFormulaire(push)[0]).toEqual({ ...CHAMP_COPROPRIETE, value: 'Résidence Le Méridien' })
    fireEvent.click(screen.getByRole('tab', { name: /Clôture d'exercice/ }))
    const exercices = lignes('Exercices comptables')
    expect(exercices).toHaveLength(1)
    expect(exercices[0]).toContain('Résidence Le Méridien')
    choisir('TL')
    expect(lignes('Exercices comptables')[0]).toContain('Copropriété Les Tilleuls')
  })

  it('la checklist de clôture est propre à chaque copropriété', async () => {
    useSelectionDossier.setState({ code: 'LM' })
    await rendre(<ComptabiliteModule />)
    fireEvent.click(screen.getByRole('tab', { name: /Clôture d'exercice/ }))
    fireEvent.click(screen.getByRole('button', { name: /Rapprochement bancaire du compte séparé/ }))
    expect(panneau('Checklist de clôture').querySelector('h3')?.textContent).toBe('Checklist de clôture — 1/7 étapes')
    choisir('TL')
    expect(panneau('Checklist de clôture').querySelector('h3')?.textContent).toBe('Checklist de clôture — 0/7 étapes')
    choisir('LM')
    expect(panneau('Checklist de clôture').querySelector('h3')?.textContent).toBe('Checklist de clôture — 1/7 étapes')
  })
})

// Copropriété de la base absente de la liste de démonstration : sans son nom dans les options, le navigateur afficherait
// « Résidence Le Méridien » alors que le formulaire porte une autre copropriété (un seul préremplissage pour tous).
describe('Copropriété créée dans la base : formulaires préremplis avec son nom, présent dans les options', () => {
  it.each([
    ['Appels de fonds', <AppelsDeFondsModule key="appels" />, /Émettre un appel/],
    ['Comptabilité', <ComptabiliteModule key="compta" />, /Nouvelle écriture/],
    ['Remboursements', <RemboursementsModule key="remboursements" />, /Nouveau remboursement/],
    ['Honoraires', <HonorairesTaxationModule key="honoraires" />, /Ajouter une diligence/],
  ])('%s', async (_ecran, ecran, bouton) => {
    let code = ''
    await act(async () => {
      const copro = await useDonneesStore.getState().createCopropriete({
        nom: 'Résidence Soleil',
        adresse: '1 rue du Soleil',
        nbLots: 10,
        rg: '26/01111',
        fondement: 'sj',
      })
      code = copro.code
    })
    useSelectionDossier.setState({ code })
    const push = await rendre(ecran)
    fireEvent.click(screen.getByRole('button', { name: bouton }))
    const champCopro = champsFormulaire(push)[0] as { label?: string; value?: string; options?: readonly string[] }
    expect(champCopro).toMatchObject({ label: 'Copropriété', value: 'Résidence Soleil' })
    expect(champCopro.options).toContain('Résidence Soleil')
  })
})
