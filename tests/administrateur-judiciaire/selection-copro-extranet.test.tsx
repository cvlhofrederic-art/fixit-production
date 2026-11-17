import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DoleancesModule } from '@/components/administrateur-judiciaire/modules/extranet/DoleancesModule'
import { ExtranetCoproprietairesModule } from '@/components/administrateur-judiciaire/modules/extranet/ExtranetCoproprietairesModule'
import { NpsPostInterventionModule } from '@/components/administrateur-judiciaire/modules/extranet/NpsPostInterventionModule'
import { SondagesModule } from '@/components/administrateur-judiciaire/modules/extranet/SondagesModule'
import { TableauAffichageModule } from '@/components/administrateur-judiciaire/modules/extranet/TableauAffichageModule'
import { ToastContext, type OptionsFormulaire, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Écrans Extranet affichés selon la copropriété choisie dans le sélecteur du haut de page : liste filtrée, indicateurs
 * recalculés sur la liste filtrée, formulaire prérempli avec la copropriété ; sans copropriété choisie (écran rendu
 * seul), l'écran reste celui de la démonstration.
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

/** Rend l'écran sous un fournisseur de toasts espion. */
function rendre(element: ReactElement) {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{element}</ToastContext.Provider>)
  return { push }
}

const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

/** Nombre affiché par l'indicateur de libellé `lbl`. */
const kpi = (lbl: string) => screen.getByText(lbl, { selector: '.lbl' }).previousElementSibling?.textContent

/** Lignes du corps du tableau (sans l'en-tête). */
const lignesTableau = () => screen.getAllByRole('row').slice(1)

/** Lignes de la liste des doléances (boutons « list-row »). */
const lignesDoleances = () => screen.getAllByRole('button').filter((bouton) => bouton.classList.contains('list-row'))

/** Valeur du champ « Copropriété » du dernier formulaire rapide ouvert. */
function champCopro(push: ReturnType<typeof rendre>['push']) {
  const formulaire = push.mock.calls.at(-1)?.[0] as OptionsFormulaire
  return formulaire.fields?.find((champ) => champ.label === 'Copropriété')
}

describe('Extranet copropriétaires', () => {
  it('sans copropriété choisie : les 5 comptes et les indicateurs de la démonstration', () => {
    const { push } = rendre(<ExtranetCoproprietairesModule />)
    expect(lignesTableau()).toHaveLength(5)
    expect(kpi('Comptes')).toBe('5')
    expect(kpi('Taux de connexion')).toBe('80%')
    fireEvent.click(screen.getByRole('button', { name: /Inviter un copropriétaire/ }))
    expect(champCopro(push)?.value).toBeUndefined()
  })

  it('comptes de la copropriété choisie, indicateurs recalculés, invitation préremplie', () => {
    useSelectionDossier.setState({ code: 'LM' })
    const { push } = rendre(<ExtranetCoproprietairesModule />)
    expect(lignesTableau().map((ligne) => within(ligne).getAllByRole('cell')[0].textContent)).toEqual([
      'M. Bernard',
      'Mme Olivier',
    ])
    expect(kpi('Comptes')).toBe('2')
    expect(kpi('Taux de connexion')).toBe('100%')
    fireEvent.click(screen.getByRole('button', { name: /Inviter un copropriétaire/ }))
    expect(champCopro(push)?.value).toBe('Résidence Le Méridien')

    choisir('CV')
    expect(lignesTableau()).toHaveLength(1)
    expect(screen.getByText('SCI Belvédère')).toBeInTheDocument()
    expect(kpi('Taux de connexion')).toBe('0%')
  })
})

describe('Panneau d’affichage', () => {
  it('sans copropriété choisie : les 4 avis, compteurs et liste « Toutes copropriétés » inchangés', () => {
    rendre(<TableauAffichageModule />)
    expect(screen.getAllByRole('button', { name: 'Détails' })).toHaveLength(4)
    expect(screen.getByRole('combobox', { name: 'Copropriété' })).toHaveDisplayValue('Toutes copropriétés')
    const categories = screen.getByText('Catégories').closest('.panel') as HTMLElement
    expect(within(categories).getAllByText(/^\d+$/).map((nombre) => nombre.textContent)).toEqual(['3', '5', '2', '4'])
  })

  it('avis de la copropriété choisie ; la liste « Copropriété » suit et change la sélection', () => {
    useSelectionDossier.setState({ code: 'TL' })
    const { push } = rendre(<TableauAffichageModule />)
    expect(screen.getAllByRole('button', { name: 'Détails' })).toHaveLength(1)
    expect(screen.getByText('Travaux de toiture — accès limité')).toBeInTheDocument()
    const categories = screen.getByText('Catégories').closest('.panel') as HTMLElement
    expect(within(categories).getAllByText(/^\d+$/).map((nombre) => nombre.textContent)).toEqual(['0', '1', '0', '0'])

    const liste = screen.getByRole('combobox', { name: 'Copropriété' })
    expect(liste).toHaveValue('TL')
    expect(within(liste).queryByText('Toutes copropriétés')).toBeNull()
    fireEvent.change(liste, { target: { value: 'VM' } })
    expect(useSelectionDossier.getState().code).toBe('VM')
    expect(screen.getByText("Notification de l'ordonnance de désignation")).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Nouvel avis/ }))
    expect(champCopro(push)?.value).toBe('Villa Montaigne')
  })
})

describe('Sondages & consultations', () => {
  it('sans copropriété choisie : les 3 sondages et les indicateurs de la démonstration', () => {
    rendre(<SondagesModule />)
    expect(screen.getAllByRole('button', { name: 'Détails' })).toHaveLength(3)
    expect(kpi('Sondages actifs')).toBe('2')
    expect(kpi('Historique')).toBe('1')
    expect(kpi('Participation moyenne')).toBe('79%')
    expect(kpi('Réponses totales')).toBe('87')
  })

  it('sondages de la copropriété choisie, indicateurs recalculés ; état vide pour une copropriété sans sondage', () => {
    useSelectionDossier.setState({ code: 'LM' })
    const { push } = rendre(<SondagesModule />)
    expect(screen.getAllByRole('button', { name: 'Détails' })).toHaveLength(1)
    expect(kpi('Sondages actifs')).toBe('1')
    expect(kpi('Historique')).toBe('0')
    expect(kpi('Participation moyenne')).toBe('78%')
    expect(kpi('Réponses totales')).toBe('28')
    fireEvent.click(screen.getByRole('button', { name: /Nouveau sondage/ }))
    expect(champCopro(push)?.value).toBe('Résidence Le Méridien')

    choisir('VM')
    expect(screen.queryByRole('button', { name: 'Détails' })).toBeNull()
    expect(screen.getByText('Aucun sondage pour Villa Montaigne')).toBeInTheDocument()
    expect(kpi('Participation moyenne')).toBe('—')
  })
})

describe('Doléances & réclamations', () => {
  it('sans copropriété choisie : les 6 doléances, indicateurs et répartition de la démonstration', () => {
    rendre(<DoleancesModule />)
    expect(lignesDoleances()).toHaveLength(6)
    expect(kpi('Total doléances')).toBe('6')
    expect(kpi('Ouvertes')).toBe('2')
    expect(kpi('En cours')).toBe('2')
    expect(kpi('Résolues')).toBe('2')
    const repartition = screen.getByText('Répartition par priorité').closest('.panel') as HTMLElement
    expect(within(repartition).getAllByText(/^\d+$/).map((nombre) => nombre.textContent)).toEqual(['2', '2', '1', '1'])
  })

  it('doléances de la copropriété choisie, indicateurs et répartition recalculés, formulaire prérempli', () => {
    useSelectionDossier.setState({ code: 'VM' })
    const { push } = rendre(<DoleancesModule />)
    expect(lignesDoleances().map((ligne) => ligne.querySelector('b')?.textContent)).toEqual([
      'Éclairage hall défaillant',
      'Boîtes aux lettres dégradées',
    ])
    expect(kpi('Total doléances')).toBe('2')
    expect(kpi('Ouvertes')).toBe('0')
    expect(kpi('En cours')).toBe('1')
    expect(kpi('Résolues')).toBe('1')
    const repartition = screen.getByText('Répartition par priorité').closest('.panel') as HTMLElement
    expect(within(repartition).getAllByText(/^\d+$/).map((nombre) => nombre.textContent)).toEqual(['0', '1', '0', '1'])
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle doléance/ }))
    expect(champCopro(push)?.value).toBe('Villa Montaigne')
  })
})

describe('NPS post-intervention', () => {
  it('sans copropriété choisie : les 5 prestataires et les indicateurs de la démonstration', () => {
    rendre(<NpsPostInterventionModule />)
    expect(lignesTableau()).toHaveLength(5)
    expect(kpi('NPS moyen')).toBe('8,1')
    expect(kpi('Prestataires en baisse')).toBe('1')
  })

  it('prestataires intervenus sur la copropriété choisie, indicateurs recalculés, enquête préremplie', () => {
    useSelectionDossier.setState({ code: 'LM' })
    const { push } = rendre(<NpsPostInterventionModule />)
    expect(lignesTableau().map((ligne) => within(ligne).getAllByRole('cell')[0].textContent)).toEqual([
      'Otis (ascenseurs)',
      'Plomberie Centrale',
    ])
    expect(kpi('NPS moyen')).toBe('8,3')
    expect(kpi('Prestataires en baisse')).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: /Envoyer une enquête/ }))
    expect(champCopro(push)?.value).toBe('Résidence Le Méridien')

    choisir('CV')
    expect(lignesTableau().map((ligne) => within(ligne).getAllByRole('cell')[0].textContent)).toEqual(['Élec Pro'])
    expect(kpi('Prestataires en baisse')).toBe('1')
  })
})
