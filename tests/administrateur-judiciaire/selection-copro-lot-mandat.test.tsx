import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_COPROPRIETES, DEMO_TOTAL_DEPENSES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { CHAMP_COPROPRIETE } from '@/components/administrateur-judiciaire/data/elements-communs'
import { TresorerieModule } from '@/components/administrateur-judiciaire/modules/finances/TresorerieModule'
import { DossierJugeModule } from '@/components/administrateur-judiciaire/modules/mandat/DossierJugeModule'
import { HonorairesTaxationModule } from '@/components/administrateur-judiciaire/modules/mandat/HonorairesTaxation'
import { OrdonnancesMissionsModule } from '@/components/administrateur-judiciaire/modules/mandat/OrdonnancesMissions'
import { RedditionComptesModule } from '@/components/administrateur-judiciaire/modules/mandat/RedditionComptesModule'
import { DossierJuridictionnelModule } from '@/components/administrateur-judiciaire/modules/pilotage/DossierJuridictionnel'
import { EtenduePouvoirsModule } from '@/components/administrateur-judiciaire/modules/pilotage/EtenduePouvoirsModule'
import { JournalActiviteModule } from '@/components/administrateur-judiciaire/modules/pilotage/JournalActiviteModule'
import { PriseFonctionModule } from '@/components/administrateur-judiciaire/modules/pilotage/PriseFonction'
import { RedressementModule } from '@/components/administrateur-judiciaire/modules/pilotage/Redressement'
import { RegistreNotificationsModule } from '@/components/administrateur-judiciaire/modules/pilotage/RegistreNotificationsModule'
import { RepriseJudiciaireModule } from '@/components/administrateur-judiciaire/modules/pilotage/RepriseJudiciaireModule'
import {
  ToastContext,
  type ChampFormulaireToast,
  type ToastApi,
} from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Lot « mandat » du sélecteur de copropriété du haut de page : chaque écran s'affiche selon la copropriété choisie et
 * suit un changement fait pendant qu'il est ouvert (sans remontage) ; sans sélection (écran rendu seul), il garde son
 * comportement d'avant (liste complète ou copropriété par défaut de l'écran).
 */

/** Base vidée, mode démo, jeu de démonstration inséré, store rechargé, sélection de dossier remise à zéro. */
async function reinitialiser(): Promise<void> {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await useDonneesStore.getState().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
}

beforeEach(async () => {
  await reinitialiser()
})

afterEach(() => {
  cleanup()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

/** Rend l'écran sous un fournisseur de toasts espion. */
function rendre(element: ReactElement) {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{element}</ToastContext.Provider>)
  return { push }
}

/** Champs lus du dernier toast poussé (document ou formulaire). */
interface ToastLu {
  kind?: string
  meta?: string
  fields?: readonly ChampFormulaireToast[]
}

/** Dernier toast poussé. */
const dernierToast = (push: ReturnType<typeof rendre>['push']) => push.mock.lastCall?.[0] as ToastLu | undefined

/** Choix fait dans la barre du haut pendant que l'écran est ouvert. */
const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

/** Select « Copropriété » local de l'écran. */
const selectCopro = () => screen.getByRole('combobox', { name: 'Copropriété' }) as HTMLSelectElement

/** Nombre affiché par la carte d'indicateur de libellé `lbl`. */
const kpi = (lbl: string) => screen.getByText(lbl, { selector: '.lbl' }).closest('.kpi')?.querySelector('.num')?.textContent

/** Texte de la première cellule de chaque ligne du tableau (en-tête exclu). */
const premieresCellules = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((ligne) => within(ligne).getAllByRole('cell')[0].textContent)

const coproDemo = (code: string) => {
  const copro = DEMO_COPROPRIETES.find((candidate) => candidate.code === code)
  if (!copro) throw new Error(`Copropriété de démonstration introuvable : ${code}`)
  return copro
}

describe('Ordonnances & missions (mandats)', () => {
  it('ne montre que la mission de la copropriété choisie, puis suit le changement', async () => {
    useSelectionDossier.setState({ code: 'CV' })
    rendre(<OrdonnancesMissionsModule />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Ouvrir le dossier' })).toHaveLength(1))
    expect(screen.getAllByText('Le Clos des Vignes').length).toBeGreaterThan(0)
    expect(screen.queryByText('Résidence Le Méridien')).toBeNull()
    expect(screen.getByRole('button', { name: /^Toutes/ }).textContent).toBe('Toutes 1')
    expect(kpi('Mandats art. 46 et 47')).toBe('1')

    choisir('TL')
    expect(screen.getAllByRole('button', { name: 'Ouvrir le dossier' })).toHaveLength(1)
    expect(screen.getAllByText('Copropriété Les Tilleuls').length).toBeGreaterThan(0)
    expect(screen.queryByText('Le Clos des Vignes')).toBeNull()
    expect(kpi('Mandats art. 46 et 47')).toBe('0')
    expect(kpi('Mandat art. 29-1')).toBe('1')
  })

  it('sans sélection : toutes les missions', async () => {
    rendre(<OrdonnancesMissionsModule />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Ouvrir le dossier' })).toHaveLength(4))
    expect(screen.getByRole('button', { name: /^Toutes/ }).textContent).toBe('Toutes 4')
  })
})

describe('Reddition de comptes', () => {
  it('compte et indicateurs de la seule copropriété choisie, rapport à son tribunal et à son RG', () => {
    const cv = coproDemo('CV'),
      tl = coproDemo('TL')
    useSelectionDossier.setState({ code: 'CV' })
    const { push } = rendre(<RedditionComptesModule />)
    expect(premieresCellules()).toEqual(['Le Clos des Vignes'])
    expect(kpi('Charges justifiées')).toBe(formatEuros(cv.depense))
    expect(kpi('Solde de trésorerie')).toBe(formatEuros(cv.budget - cv.depense))
    fireEvent.click(screen.getByRole('button', { name: /Déposer le rapport/ }))
    expect(dernierToast(push)).toMatchObject({ meta: `${cv.tribunal} · RG ${cv.rg}` })

    choisir('TL')
    expect(premieresCellules()).toEqual(['Copropriété Les Tilleuls'])
    expect(kpi('Charges justifiées')).toBe(formatEuros(tl.depense))
  })

  it('sans sélection : toutes les copropriétés et les totaux du portefeuille', () => {
    const { push } = rendre(<RedditionComptesModule />)
    expect(premieresCellules()).toHaveLength(4)
    expect(kpi('Charges justifiées')).toBe(formatEuros(DEMO_TOTAL_DEPENSES))
    fireEvent.click(screen.getByRole('button', { name: /Déposer le rapport/ }))
    expect(dernierToast(push)).toMatchObject({ meta: 'Tribunal judiciaire de Nanterre · RG 26/00892' })
  })
})

describe('Registre des notifications', () => {
  it('notifications de la copropriété choisie, indicateurs recalculés, notification du moteur pour la sienne', async () => {
    useSelectionDossier.setState({ code: 'CV' })
    rendre(<RegistreNotificationsModule />)
    expect(premieresCellules()).toEqual(['Convocation AG élective'])
    expect(kpi('Notifications au registre')).toBe('1')
    expect(kpi('À envoyer')).toBe('1')

    choisir('LM')
    expect(premieresCellules()).toEqual(['Ordonnance de désignation', "Procès-verbal de l'AG du 18/05"])
    expect(screen.getByText("Fenêtre de recours ouverte — PV de l'AG du 18/05")).toBeTruthy()

    choisir('TL')
    expect(premieresCellules()).toEqual(['Mise en demeure de payer'])
    expect(screen.queryByText("Fenêtre de recours ouverte — PV de l'AG du 18/05")).toBeNull()

    choisir('VM')
    await waitFor(() => expect(premieresCellules()).toEqual(['Notification ordonnance — Villa Montaigne']))
  })

  it('sans sélection : le registre complet, notification de Villa Montaigne comprise', async () => {
    rendre(<RegistreNotificationsModule />)
    await waitFor(() => expect(premieresCellules()).toHaveLength(5))
    expect(premieresCellules()[4]).toBe('Notification ordonnance — Villa Montaigne')
    expect(kpi('Notifications au registre')).toBe('5')
  })
})

describe('Redressement (art. 29-1)', () => {
  it('copropriété hors art. 29-1 : état vide, sans indicateur ni plan ; art. 29-1 : écran de la copropriété', () => {
    useSelectionDossier.setState({ code: 'CV' })
    const { push } = rendre(<RedressementModule />)
    expect(screen.getByText('Aucun redressement pour Le Clos des Vignes')).toBeTruthy()
    expect(screen.queryByText("Taux d'impayés")).toBeNull()
    expect(screen.queryByRole('button', { name: /Plan d'apurement/ })).toBeNull()

    choisir('TL')
    expect(screen.queryByText('Aucun redressement pour Le Clos des Vignes')).toBeNull()
    expect(screen.getByText('Copropriété Les Tilleuls — administration provisoire (art. 29-1)')).toBeTruthy()
    expect(kpi("Taux d'impayés")).toBe('36%')
    fireEvent.click(screen.getByRole('button', { name: /Plan d'apurement/ }))
    expect(dernierToast(push)).toMatchObject({ meta: `Copropriété Les Tilleuls · dette ${formatEuros(34800)}` })
  })

  it('sans sélection : Les Tilleuls, comme avant', () => {
    rendre(<RedressementModule />)
    expect(screen.getByText('Copropriété Les Tilleuls — administration provisoire (art. 29-1)')).toBeTruthy()
    expect(kpi("Taux d'impayés")).toBe('36%')
    expect(premieresCellules()).toHaveLength(4)
  })
})

describe('Dossier du juge', () => {
  it('rapport composé pour la copropriété choisie, puis pour celle choisie ensuite', async () => {
    useSelectionDossier.setState({ code: 'CV' })
    const { push } = rendre(<DossierJugeModule />)
    expect(selectCopro().value).toBe('CV')
    const rapport = await screen.findByRole('button', { name: /Rapport au juge/ })
    await waitFor(() => expect((rapport as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(rapport)
    expect(dernierToast(push)?.meta).toContain('Le Clos des Vignes · RG 25/03517')

    choisir('TL')
    expect(selectCopro().value).toBe('TL')
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /Rapport au juge/ }))
      expect(dernierToast(push)?.meta).toContain('Copropriété Les Tilleuls · RG 24/04521')
    })
  })

  it('sans sélection : Les Tilleuls par défaut', async () => {
    const { push } = rendre(<DossierJugeModule />)
    expect(selectCopro().value).toBe('TL')
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /Rapport au juge/ }))
      expect(dernierToast(push)?.meta).toContain('Copropriété Les Tilleuls · RG 24/04521')
    })
  })
})

describe('Honoraires & taxation', () => {
  it('cycle de la copropriété choisie, formulaire prérempli sans toucher au champ partagé', () => {
    useSelectionDossier.setState({ code: 'CV' })
    const { push } = rendre(<HonorairesTaxationModule />)
    expect(selectCopro().value).toBe('CV')
    expect(screen.getByText('Le Clos des Vignes · TJ Nanterre')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une diligence/ }))
    const formulaire = dernierToast(push)
    expect(formulaire?.kind).toBe('form')
    expect(formulaire?.fields?.[0]).toMatchObject({
      label: 'Copropriété',
      value: 'Le Clos des Vignes',
    })
    expect(CHAMP_COPROPRIETE.value).toBeUndefined()

    choisir('TL')
    expect(selectCopro().value).toBe('TL')
    expect(screen.getByText('Copropriété Les Tilleuls · TJ Nanterre')).toBeTruthy()
  })

  it('le select local change la copropriété de toute l’application ; sans sélection : Le Méridien', () => {
    rendre(<HonorairesTaxationModule />)
    expect(selectCopro().value).toBe('LM')
    expect(screen.getByText('Résidence Le Méridien · TJ Nanterre')).toBeTruthy()
    fireEvent.change(selectCopro(), { target: { value: 'VM' } })
    expect(useSelectionDossier.getState().code).toBe('VM')
    expect(screen.getByText('Villa Montaigne · TJ Nanterre')).toBeTruthy()
  })
})

describe('Reprise judiciaire', () => {
  it('suit la copropriété choisie et abandonne l’analyse en cours quand elle change', () => {
    useSelectionDossier.setState({ code: 'CV' })
    rendre(<RepriseJudiciaireModule />)
    expect(selectCopro().value).toBe('CV')
    fireEvent.click(screen.getByRole('button', { name: 'Exemple' }))
    fireEvent.click(screen.getByRole('button', { name: /Analyser/ }))
    expect(screen.getByRole('button', { name: /Importer 3 copropriétaires/ })).toBeTruthy()

    choisir('TL')
    expect(selectCopro().value).toBe('TL')
    expect(screen.queryByRole('button', { name: /Importer 3 copropriétaires/ })).toBeNull()
  })

  it('sans sélection : Villa Montaigne par défaut', () => {
    rendre(<RepriseJudiciaireModule />)
    expect(selectCopro().value).toBe('VM')
  })
})

describe('Prise de fonction', () => {
  it('état de prise de fonction de la copropriété choisie, puis de celle choisie ensuite', () => {
    useSelectionDossier.setState({ code: 'CV' })
    const { push } = rendre(<PriseFonctionModule />)
    expect(selectCopro().value).toBe('CV')
    fireEvent.click(screen.getByRole('button', { name: /Exporter l'état/ }))
    expect(dernierToast(push)).toMatchObject({ meta: 'Ordonnance du 22/07/2025 · D. 1967 art. 46' })

    choisir('TL')
    expect(selectCopro().value).toBe('TL')
    fireEvent.click(screen.getByRole('button', { name: /Exporter l'état/ }))
    expect(dernierToast(push)).toMatchObject({ meta: 'Ordonnance du 05/11/2024 · L. 1965 art. 29-1' })
  })

  it('sans sélection : Villa Montaigne par défaut', () => {
    const { push } = rendre(<PriseFonctionModule />)
    expect(selectCopro().value).toBe('VM')
    fireEvent.click(screen.getByRole('button', { name: /Exporter l'état/ }))
    expect(dernierToast(push)).toMatchObject({ meta: 'Ordonnance du 28/04/2026 · D. 1967 art. 46' })
  })
})

describe('Dossier juridictionnel', () => {
  it('pièces et requêtes de la copropriété choisie, puis de celle choisie ensuite', () => {
    useSelectionDossier.setState({ code: 'CV' })
    rendre(<DossierJuridictionnelModule />)
    expect(selectCopro().value).toBe('CV')
    expect(screen.queryByText('Requête en prorogation de la mission')).toBeNull()

    choisir('TL')
    expect(selectCopro().value).toBe('TL')
    expect(screen.getByText('Requête en prorogation de la mission')).toBeTruthy()
  })

  it('sans sélection : Les Tilleuls par défaut', () => {
    rendre(<DossierJuridictionnelModule />)
    expect(selectCopro().value).toBe('TL')
    expect(screen.getByText('Requête en prorogation de la mission')).toBeTruthy()
  })

  // La requête en travaux urgents (02/04, ord. 11/04) et le PV du 18/05 sont des données de démonstration des Tilleuls :
  // une autre copropriété ne les affiche plus.
  it('requête en travaux urgents et PV de la dernière AG : seulement dans le dossier de démonstration des Tilleuls', () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre(<DossierJuridictionnelModule />)
    expect(screen.getByText('Requête en autorisation de travaux urgents')).toBeTruthy()
    expect(screen.getByText('Ord. du 11/04/2026')).toBeTruthy()
    expect(screen.getAllByText('18/05/2026').length).toBeGreaterThan(0)
    choisir('CV')
    expect(screen.queryByText('Requête en autorisation de travaux urgents')).toBeNull()
    expect(screen.queryByText('18/05/2026')).toBeNull()
    expect(screen.getByText('À verser')).toBeTruthy()
  })
})

describe('Étendue des pouvoirs', () => {
  it('régime de la copropriété choisie, puis de celle choisie ensuite', () => {
    useSelectionDossier.setState({ code: 'CV' })
    rendre(<EtenduePouvoirsModule />)
    expect(selectCopro().value).toBe('CV')
    expect(screen.getByText('Régime : Syndic judiciaire')).toBeTruthy()

    choisir('TL')
    expect(selectCopro().value).toBe('TL')
    expect(screen.getByText('Régime : Administrateur provisoire — difficulté')).toBeTruthy()
  })

  it('sans sélection : Les Tilleuls par défaut', () => {
    rendre(<EtenduePouvoirsModule />)
    expect(selectCopro().value).toBe('TL')
    expect(screen.getByText('Régime : Administrateur provisoire — difficulté')).toBeTruthy()
  })
})

describe('Journal d’activité', () => {
  it('journal de la copropriété choisie, puis de celle choisie ensuite (barre du haut ou select local)', () => {
    useSelectionDossier.setState({ code: 'CV' })
    rendre(<JournalActiviteModule />)
    expect(screen.getByText('Journal — Le Clos des Vignes')).toBeTruthy()
    expect(screen.getByText("Création de l'OS fuite colonne EU")).toBeTruthy()

    choisir('TL')
    expect(selectCopro().value).toBe('TL')
    expect(screen.getByText('Signification de la mise en demeure — SCI Belvédère')).toBeTruthy()
    expect(screen.queryByText("Création de l'OS fuite colonne EU")).toBeNull()

    fireEvent.change(selectCopro(), { target: { value: 'VM' } })
    expect(useSelectionDossier.getState().code).toBe('VM')
    expect(screen.getByText('Journal — Villa Montaigne')).toBeTruthy()
  })

  it('sans sélection : Le Méridien par défaut', () => {
    rendre(<JournalActiviteModule />)
    expect(selectCopro().value).toBe('LM')
    expect(screen.getByText("Validation de l'ordre de service OS-2026-051")).toBeTruthy()
  })
})

describe('Banque et recouvrement (trésorerie)', () => {
  it('suit la copropriété choisie et abandonne l’analyse du relevé quand elle change', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre(<TresorerieModule />)
    expect(selectCopro().value).toBe('TL')
    fireEvent.click(screen.getByRole('button', { name: 'Exemple' }))
    const analyser = screen.getByRole('button', { name: /Analyser/ }) as HTMLButtonElement
    await waitFor(() => expect(analyser.disabled).toBe(false))
    fireEvent.click(analyser)
    expect(screen.getByRole('button', { name: /^Importer \d+ ligne/ })).toBeTruthy()

    choisir('VM')
    expect(selectCopro().value).toBe('VM')
    expect(screen.queryByRole('button', { name: /^Importer \d+ ligne/ })).toBeNull()
  })

  it('sans sélection : Le Clos des Vignes par défaut', () => {
    rendre(<TresorerieModule />)
    expect(selectCopro().value).toBe('CV')
  })
})

describe('Copropriété de la base sans données de démonstration', () => {
  /** Copropriété créée comme depuis l'écran Copropriétés (budget nul, art. 29-1), puis choisie dans la barre du haut. */
  async function choisirCoproNouvelle(): Promise<string> {
    const copro = await useDonneesStore.getState().createCopropriete({
      nom: 'Résidence Nouvelle',
      adresse: '1 rue Neuve',
      nbLots: 10,
      rg: '26/09999',
      fondement: 'Administration provisoire (art. 29-1)',
    })
    useSelectionDossier.setState({ code: copro.code })
    return copro.code
  }

  it('états vides « Aucun … pour <nom> » sur les listes de démonstration', async () => {
    await choisirCoproNouvelle()
    rendre(<RegistreNotificationsModule />)
    expect(await screen.findByText('Aucune notification pour Résidence Nouvelle')).toBeTruthy()
    expect(kpi('Notifications au registre')).toBe('0')
    expect(screen.queryByText("Fenêtre de recours ouverte — PV de l'AG du 18/05")).toBeNull()
    cleanup()

    rendre(<RedditionComptesModule />)
    expect(screen.getByText('Aucun compte pour Résidence Nouvelle')).toBeTruthy()
    expect(kpi('Charges justifiées')).toBe(formatEuros(0))
    cleanup()

    rendre(<JournalActiviteModule />)
    expect(screen.getByText('Aucun acte journalisé pour Résidence Nouvelle')).toBeTruthy()
    cleanup()

    rendre(<OrdonnancesMissionsModule />)
    expect(screen.getAllByRole('button', { name: 'Ouvrir le dossier' })).toHaveLength(1)
    expect(screen.getAllByText('Résidence Nouvelle').length).toBeGreaterThan(0)
  })

  it('redressement art. 29-1 sans budget : taux à 0 % (et non NaN), aucun créancier de démonstration', async () => {
    await choisirCoproNouvelle()
    rendre(<RedressementModule />)
    expect(kpi("Taux d'impayés")).toBe('0%')
    expect(screen.getByText('Aucun créancier pour Résidence Nouvelle')).toBeTruthy()
    expect(kpi('Dette fournisseurs')).toBe(formatEuros(0))
  })
})
