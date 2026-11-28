import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessagesCoproprietairesModule } from '@/components/administrateur-judiciaire/modules/extranet/MessagesCoproprietairesModule'
import { ReservationEspacesCommunsModule } from '@/components/administrateur-judiciaire/modules/extranet/ReservationEspacesCommunsModule'
import { CanalCommunicationModule } from '@/components/administrateur-judiciaire/modules/gestion/CanalCommunicationModule'
import { OrdresServiceModule } from '@/components/administrateur-judiciaire/modules/gestion/OrdresService'
import { PlanningModule } from '@/components/administrateur-judiciaire/modules/gestion/PlanningModule'
import { ToastContext, type OptionsFormulaire, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'
import type { OrdrePrestataire } from '@/lib/administrateur-judiciaire/ordres-prestataire'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Lot « gestion » du sélecteur de copropriété du haut de page : Ordres de service, Canal, Planning, Réservation des
 * espaces communs et Messages aux copropriétaires s'affichent selon la copropriété choisie (listes et compteurs
 * filtrés, formulaires préremplis, état vide nommé), et suivent chaque changement sans remontage. Sans copropriété
 * choisie (écran rendu seul), chaque écran garde son comportement d'avant.
 */

const etat = () => useDonneesStore.getState()

/** Base vidée, mode démo, jeu de démonstration inséré, store rechargé, sélection remise à zéro. */
async function reinitialiser(): Promise<void> {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await etat().loadAll()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
}

/** Copropriété ajoutée à la base, sans aucune donnée de démonstration rattachée : code attribué par la base. */
async function creerCoproVide(): Promise<string> {
  let code = ''
  await act(async () => {
    const copro = await etat().createCopropriete({
      nom: 'Résidence Les Acacias',
      adresse: '2 allée des Acacias',
      nbLots: 12,
      rg: '26/04444',
      fondement: 'sj',
    })
    code = copro.code
  })
  return code
}

/** Choisit la copropriété dans le sélecteur du haut de page (sans remonter l'écran). */
const choisir = (code: string | null) => act(() => useSelectionDossier.getState().choisirCopro(code))

/** Rend l'écran sous un fournisseur de toasts espion. */
function rendre(element: ReactElement) {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{element}</ToastContext.Provider>)
  return { push }
}

beforeEach(async () => {
  await reinitialiser()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
})

describe('Ordres de service — selon la copropriété choisie', () => {
  /** Ordre envoyé en saisie libre (sans carte de démonstration) pour cette copropriété. */
  const ordreLibre = (missionId: string, copropriete: string, titre: string): OrdrePrestataire => ({
    missionId,
    conversationId: `conv-${missionId}`,
    messageId: `msg-${missionId}`,
    referenceAj: '',
    titre,
    copropriete,
    adresse: copropriete,
    localisation: 'Hall',
    prestataire: { nom: 'Frédéric Multiservice', metier: 'Multiservice' },
    urgence: 'normale',
    dateIntervention: '',
    creeLe: '2026-10-12T09:00:00Z',
    statut: 'en_attente',
    heureArrivee: '',
    messages: [],
  })

  async function monter() {
    const appel = vi.fn(async () =>
      Response.json({
        prestataires: [],
        ordres: [
          ordreLibre('libre-cv', 'Le Clos des Vignes', 'Débouchage des descentes'),
          ordreLibre('libre-vm', 'Villa Montaigne', 'Changement de serrure'),
        ],
      }),
    )
    vi.stubGlobal('fetch', appel)
    let push: ReturnType<typeof rendre>['push'] = vi.fn()
    await act(async () => {
      push = rendre(<OrdresServiceModule />).push
    })
    // Première lecture des ordres envoyés terminée (réponse simulée traitée).
    await waitFor(() => expect(appel).toHaveBeenCalled())
    await act(async () => {
      await new Promise((resoudre) => setTimeout(resoudre, 0))
    })
    return { push }
  }

  const numerosAffiches = () => screen.queryAllByText(/^OS-2026-0\d\d$/).map((element) => element.textContent)

  it('sans copropriété choisie : toutes les interventions, comme avant', async () => {
    await monter()
    expect(numerosAffiches()).toEqual(['OS-2026-051', 'OS-2026-050', 'OS-2026-049', 'OS-2026-048', 'OS-2026-047', 'OS-2026-046'])
    expect(screen.getByRole('button', { name: /^Tous/ }).textContent).toBe('Tous 6')
    expect(screen.queryByText('Débouchage des descentes')).not.toBeNull()
    expect(screen.queryByText('4 copropriétés')).not.toBeNull()
  })

  it('copropriété choisie : interventions, saisies libres, compteurs et indicateurs de cette copropriété', async () => {
    useSelectionDossier.setState({ code: 'CV' })
    await monter()
    expect(numerosAffiches()).toEqual(['OS-2026-051', 'OS-2026-047'])
    expect(screen.getByRole('button', { name: /^Tous/ }).textContent).toBe('Tous 2')
    expect(screen.getByRole('button', { name: /^En cours/ }).textContent).toBe('En cours 1')
    expect(screen.queryByText('Débouchage des descentes')).not.toBeNull()
    expect(screen.queryByText('Changement de serrure')).toBeNull()
    expect(screen.queryByText('4 copropriétés')).toBeNull()
    // Changement de copropriété : l'écran suit, sans remontage.
    choisir('VM')
    expect(numerosAffiches()).toEqual(['OS-2026-049'])
    expect(screen.queryByText('Changement de serrure')).not.toBeNull()
    expect(screen.queryByText('Débouchage des descentes')).toBeNull()
  })

  // « Clôturés (mois) » et « Engagé (mois) » sont des valeurs figées du cabinet : à côté des lignes filtrées, elles
  // sont marquées « Tous les mandats » pour ne pas être lues comme celles de la copropriété choisie.
  it('indicateurs figés du cabinet : marqués « Tous les mandats » avec une copropriété choisie, tels quels sinon', async () => {
    const sousTitre = (libelle: string) =>
      screen.getByText(libelle, { selector: '.kpi .lbl' }).closest('.kpi')?.querySelector('.sub')?.textContent
    await monter()
    expect(sousTitre('Clôturés (mois)')).toBe('délai moyen 3,1 j')
    choisir('VM')
    expect(sousTitre('Clôturés (mois)')).toBe('Tous les mandats · délai moyen 3,1 j')
    expect(sousTitre('Engagé (mois)')).toBe('Tous les mandats · hors travaux votés')
  })

  it('formulaires préremplis avec la copropriété choisie ; état vide nommé', async () => {
    useSelectionDossier.setState({ code: 'TL' })
    await monter()
    fireEvent.click(screen.getByRole('button', { name: /Nouvel ordre de service/ }))
    const formulaire = await screen.findByRole('dialog', { name: /Nouvel ordre de service/ })
    expect(within(formulaire).getByLabelText('Copropriété')).toHaveValue('Copropriété Les Tilleuls')
    fireEvent.click(within(formulaire).getByRole('button', { name: 'Annuler' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Envoyer au prestataire' })[0])
    const envoi = await screen.findByRole('dialog', { name: /Envoyer au prestataire Vitfix/ })
    expect(within(envoi).getByLabelText(/Copropriété/)).toHaveValue('Copropriété Les Tilleuls')
  })

  it('copropriété sans intervention : « Aucun ordre de service pour … »', async () => {
    const code = await creerCoproVide()
    useSelectionDossier.setState({ code })
    await monter()
    expect(numerosAffiches()).toEqual([])
    expect(screen.queryByText('Aucun ordre de service pour Résidence Les Acacias')).not.toBeNull()
  })
})

describe('Canal de communication — selon la copropriété choisie', () => {
  const cartes = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.canal-mission-card'))
  const titresCartes = () => cartes().map((carte) => carte.querySelector('.canal-mission-title')?.textContent)

  it('sans copropriété choisie : les cinq ordres de mission, comme avant', () => {
    rendre(<CanalCommunicationModule />)
    expect(cartes()).toHaveLength(5)
  })

  it('copropriété choisie : ses ordres de mission seulement ; la mission ouverte suit', () => {
    useSelectionDossier.setState({ code: 'LM' })
    rendre(<CanalCommunicationModule />)
    expect(cartes()).toHaveLength(3)
    expect(cartes()[0].getAttribute('aria-current')).toBe('true')
    choisir('TL')
    expect(cartes()).toHaveLength(1)
    // La mission ouverte (Le Méridien) n'est plus visible : la première mission de la copropriété s'ouvre.
    expect(cartes()[0].getAttribute('aria-current')).toBe('true')
    expect(document.querySelector('.canal-chat-title')?.textContent).toBe(titresCartes()[0])
    expect(document.querySelector('.canal-chat-meta')?.textContent).toContain('Copropriété Les Tilleuls')
  })

  it('copropriété sans mission : état vide ; une nouvelle mission prend la copropriété choisie et reste visible', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((tableau) => {
      ;(tableau as Uint16Array)[0] = 123
      return tableau
    })
    useSelectionDossier.setState({ code: 'CV' })
    rendre(<CanalCommunicationModule />)
    expect(cartes()).toHaveLength(0)
    expect(screen.queryByText('Aucun ordre de mission pour Le Clos des Vignes')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Nouvel ordre de mission/ }))
    expect(screen.getByLabelText('Copropriété')).toHaveValue('Le Clos des Vignes')
    fireEvent.change(screen.getByLabelText('Intervention demandée'), { target: { value: 'Fuite en toiture' } })
    fireEvent.click(screen.getByRole('button', { name: /Transmettre à l'artisan/ }))
    expect(cartes()).toHaveLength(1)
    expect(document.querySelector('.canal-chat-meta')?.textContent).toContain('Le Clos des Vignes')
    // Les missions des autres copropriétés sont conservées.
    choisir(null)
    expect(cartes()).toHaveLength(6)
  })
})

describe('Planning — selon la copropriété choisie', () => {
  const titreListe = () => screen.getByText(/^Événements (de la semaine|de )/).textContent

  it('sans copropriété choisie : tous les événements de la semaine, comme avant', () => {
    rendre(<PlanningModule />)
    expect(titreListe()).toBe('Événements de la semaine (11)')
  })

  const libelles = () => Array.from(document.querySelectorAll('.list-row .info b')).map((b) => b.textContent)

  // Les tâches du cabinet (sans copropriété) restent visibles quelle que soit la copropriété choisie : sinon elles ne
  // seraient plus visibles nulle part, le Shell posant toujours une copropriété.
  it('copropriété choisie : ses événements et les tâches du cabinet, et suit chaque changement', () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre(<PlanningModule />)
    expect(titreListe()).toBe('Événements de la semaine (4)')
    expect(libelles()).toEqual([
      'Visite technique — Les Tilleuls (toiture)',
      'Mise en demeure — SCI Belvédère',
      'Rapprochement bancaire (compte séparé)',
      'Dépôt requête en prorogation — Les Tilleuls',
    ])
    choisir('VM')
    expect(titreListe()).toBe('Événements de la semaine (3)')
    expect(libelles()).toContain('Rapprochement bancaire (compte séparé)')
  })

  it('la tâche du cabinet du samedi reste visible avec une copropriété choisie, une fois le samedi affiché', () => {
    useSelectionDossier.setState({ code: 'LM' })
    rendre(<PlanningModule />)
    expect(libelles()).not.toContain("Réunion d'information copropriétaires")
    fireEvent.click(screen.getByRole('button', { name: /Réglages/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Sam/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }))
    expect(libelles()).toContain("Réunion d'information copropriétaires")
  })

  it('formulaire « Ajouter » prérempli (le même formulaire que les cases) ; état vide nommé', async () => {
    useSelectionDossier.setState({ code: 'CV' })
    const { push } = rendre(<PlanningModule />)
    fireEvent.click(document.querySelector<HTMLElement>('.week-grid .week-cell') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(push.mock.calls[0][0]).toBe(push.mock.calls[1][0])
    const formulaire = push.mock.calls[0][0] as OptionsFormulaire
    expect(formulaire.fields?.[0]).toMatchObject({ label: 'Copropriété', value: 'Le Clos des Vignes' })

    const code = await creerCoproVide()
    choisir(code)
    expect(titreListe()).toBe('Événements de la semaine (1)')
    expect(libelles()).toEqual(['Rapprochement bancaire (compte séparé)'])
  })
})

describe('Réservation des espaces communs — selon la copropriété choisie', () => {
  const reservations = () => Array.from(document.querySelectorAll('.calendar .ev')).map((ev) => ev.textContent)

  it('sans copropriété choisie : toutes les réservations, comme avant', () => {
    rendre(<ReservationEspacesCommunsModule />)
    expect(reservations()).toEqual([
      '14:00 Salle réunion',
      '10:00 Salle commune',
      '18:00 Terrasse',
      '17:30 Local vélos',
      '09:00 Salle réunion',
      '14:00 Terrasse',
      '18:30 Salle commune (CS)',
      '11:00 Buanderie',
    ])
  })

  it('copropriété choisie : ses réservations, son nom ; formulaire prérempli ; jours toujours accessibles', () => {
    useSelectionDossier.setState({ code: 'LM' })
    const { push } = rendre(<ReservationEspacesCommunsModule />)
    expect(reservations()).toEqual(['14:00 Salle réunion', '10:00 Salle commune', '18:00 Terrasse', '18:30 Salle commune (CS)'])
    expect(screen.queryByText(/Résidence Le Méridien/)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle réservation/ }))
    const formulaire = push.mock.calls[0][0] as OptionsFormulaire
    expect(formulaire.fields?.[0]).toMatchObject({ label: 'Copropriété', value: 'Résidence Le Méridien' })
    choisir('VM')
    expect(reservations()).toEqual(['11:00 Buanderie'])
    const jour8 = Array.from(document.querySelectorAll<HTMLElement>('.calendar .day')).find(
      (caseJour) => caseJour.firstElementChild?.textContent === '8',
    ) as HTMLElement
    expect(jour8.getAttribute('role')).toBe('button')
    expect(jour8.getAttribute('tabindex')).toBe('0')
  })

  it('copropriété sans réservation : calendrier vide et « Aucune réservation pour … »', async () => {
    const code = await creerCoproVide()
    useSelectionDossier.setState({ code })
    rendre(<ReservationEspacesCommunsModule />)
    expect(reservations()).toEqual([])
    expect(screen.queryByText('Aucune réservation pour Résidence Les Acacias en juin 2026.')).not.toBeNull()
  })
})

describe('Messages aux copropriétaires — copropriété créée dans la base', () => {
  it('le select « Copropriété » affiche la copropriété choisie (son nom ajouté aux options)', async () => {
    const code = await creerCoproVide()
    useSelectionDossier.setState({ code })
    rendre(<MessagesCoproprietairesModule />)
    const select = screen.getByLabelText<HTMLSelectElement>('Copropriété')
    expect(select.value).toBe('Résidence Les Acacias')
    expect(select.options[select.selectedIndex]?.text).toBe('Résidence Les Acacias')
  })
})

describe('Messages aux copropriétaires — selon la copropriété choisie', () => {
  const lignesEnvois = () =>
    within(screen.getByText('Derniers envois').closest('.panel') as HTMLElement)
      .queryAllByRole('row')
      .slice(1)
      .map((ligne) => ligne.querySelector('b')?.textContent)

  it('sans copropriété choisie : sélecteur local et tous les envois, comme avant', () => {
    rendre(<MessagesCoproprietairesModule />)
    const select = screen.getByLabelText('Copropriété')
    expect(select).toHaveValue('Résidence Le Méridien')
    expect(lignesEnvois()).toEqual(['Convocation AG', 'Rappel impayé', 'Travaux toiture'])
    fireEvent.change(select, { target: { value: 'Villa Montaigne' } })
    expect(select).toHaveValue('Villa Montaigne')
    expect(useSelectionDossier.getState().code).toBeNull()
    expect(lignesEnvois()).toEqual(['Convocation AG', 'Rappel impayé', 'Travaux toiture'])
  })

  it('copropriété choisie : sélecteur relié à la sélection, envois de la copropriété, état vide nommé', () => {
    useSelectionDossier.setState({ code: 'TL' })
    rendre(<MessagesCoproprietairesModule />)
    const select = screen.getByLabelText('Copropriété')
    expect(select).toHaveValue('Copropriété Les Tilleuls')
    expect(lignesEnvois()).toEqual(['Rappel impayé', 'Travaux toiture'])
    fireEvent.change(select, { target: { value: 'Villa Montaigne' } })
    expect(useSelectionDossier.getState().code).toBe('VM')
    expect(select).toHaveValue('Villa Montaigne')
    expect(lignesEnvois()).toEqual([])
    expect(screen.queryByText('Aucun envoi pour Villa Montaigne')).not.toBeNull()
    choisir('CV')
    expect(select).toHaveValue('Le Clos des Vignes')
    expect(lignesEnvois()).toEqual(['Convocation AG'])
  })
})
