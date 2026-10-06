import './fuseau-paris'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReservationEspacesCommunsModule } from '@/components/administrateur-judiciaire/modules/extranet/ReservationEspacesCommunsModule'
import { PlanningModule } from '@/components/administrateur-judiciaire/modules/gestion/PlanningModule'
import { TableauDeBordModule } from '@/components/administrateur-judiciaire/modules/mandat/TableauDeBordModule'
import { creerModuleGenerique } from '@/components/administrateur-judiciaire/modules/ModuleGenerique'
import { Modal } from '@/components/administrateur-judiciaire/ui/Modal'
import { ToastContext, type ToastApi } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Accessibilité au clavier des éléments cliquables qui n'étaient activables qu'à la souris dans la maquette (écart
 * volontaire, règle Sonar S1082) : rôle, tabIndex et activation par Entrée ou Espace, sans changement de rendu.
 * Le clic à la souris garde le même effet.
 */

/** Rend l'écran sous un fournisseur de toasts espion. */
function rendre(element: ReactElement) {
  const push = vi.fn<ToastApi['push']>(() => undefined)
  render(<ToastContext.Provider value={{ push, dismiss: vi.fn() }}>{element}</ToastContext.Provider>)
  return { push }
}

/** Ligne de liste (.list-row) dont le titre (en gras) vaut ce texte. */
const ligneDeListe = (titre: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('.list-row')).find(
    (ligne) => ligne.querySelector('.info b')?.textContent === titre,
  ) as HTMLElement

beforeEach(() => {
  window.history.replaceState(null, '', window.location.pathname)
})

describe('Tableau de bord — liens et lignes activables au clavier', () => {
  it('« Voir tout → » : lien focalisable, Entrée ouvre les obligations', () => {
    rendre(<TableauDeBordModule />)
    const lien = screen.getByRole('link', { name: 'Voir tout →' })
    expect(lien.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(lien, { key: 'Enter' })
    expect(window.location.hash).toBe('#obligations')
  })

  it('« Voir les ordonnances → » : Espace ouvre les mandats, une autre touche ne fait rien', () => {
    rendre(<TableauDeBordModule />)
    const lien = screen.getByRole('link', { name: 'Voir les ordonnances →' })
    fireEvent.keyDown(lien, { key: 'Tab' })
    expect(window.location.hash).toBe('')
    fireEvent.keyDown(lien, { key: ' ' })
    expect(window.location.hash).toBe('#mandats')
  })

  it('ligne d’échéance prioritaire : Entrée affiche le même toast que le clic', () => {
    const { push } = rendre(<TableauDeBordModule />)
    const ligne = document.querySelector<HTMLElement>('.list-row') as HTMLElement
    expect(ligne.getAttribute('role')).toBe('button')
    expect(ligne.getAttribute('tabindex')).toBe('0')
    fireEvent.click(ligne)
    fireEvent.keyDown(ligne, { key: 'Enter' })
    expect(push).toHaveBeenCalledTimes(2)
    expect(push.mock.calls[1][0]).toEqual(push.mock.calls[0][0])
    expect(push.mock.calls[0][0]).toMatchObject({ kind: 'info' })
  })

  it('ligne de mandat : Entrée ouvre les mandats', () => {
    rendre(<TableauDeBordModule />)
    const ligne = ligneDeListe('Résidence Le Méridien')
    expect(ligne.getAttribute('role')).toBe('button')
    fireEvent.keyDown(ligne, { key: 'Enter' })
    expect(window.location.hash).toBe('#mandats')
  })
})

describe('Réservation des espaces communs — jours du calendrier', () => {
  const cases = () => Array.from(document.querySelectorAll<HTMLElement>('.calendar .day'))

  it('jour du mois : focalisable, Entrée affiche le toast du jour', () => {
    const { push } = rendre(<ReservationEspacesCommunsModule />)
    const jour8 = cases().find((caseJour) => caseJour.firstElementChild?.textContent === '8') as HTMLElement
    expect(jour8.getAttribute('role')).toBe('button')
    expect(jour8.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(jour8, { key: 'Enter' })
    expect(push).toHaveBeenCalledWith({ kind: 'info', title: '8 juin', desc: 'Voir les réservations du jour' })
  })

  it('case vide (hors mois) : ni rôle, ni tabIndex, ni effet au clavier', () => {
    const { push } = rendre(<ReservationEspacesCommunsModule />)
    const vides = cases().filter((caseJour) => caseJour.classList.contains('muted'))
    expect(vides.length).toBeGreaterThan(0)
    for (const vide of vides) {
      expect(vide.hasAttribute('role')).toBe(false)
      expect(vide.hasAttribute('tabindex')).toBe(false)
      fireEvent.keyDown(vide, { key: 'Enter' })
    }
    expect(push).not.toHaveBeenCalled()
  })
})

describe('Planning — cases vides de la grille', () => {
  it('masquées aux lecteurs d’écran, hors tabulation ; le clic ouvre toujours le formulaire du bouton « Ajouter »', () => {
    const { push } = rendre(<PlanningModule />)
    const casesVides = Array.from(document.querySelectorAll<HTMLElement>('.week-grid .week-cell'))
    expect(casesVides.length).toBeGreaterThan(0)
    for (const caseVide of casesVides) {
      expect(caseVide.getAttribute('aria-hidden')).toBe('true')
      expect(caseVide.hasAttribute('tabindex')).toBe(false)
    }
    fireEvent.click(casesVides[0])
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(push).toHaveBeenCalledTimes(2)
    expect(push.mock.calls[0][0]).toBe(push.mock.calls[1][0])
    expect(push.mock.calls[0][0]).toMatchObject({ kind: 'form', title: 'Nouvel événement' })
  })
})

describe('Écran générique — lignes de liste', () => {
  it('Entrée affiche le toast de la ligne (sans détail) comme le clic', () => {
    const Ecran = creerModuleGenerique({
      panels: [{ kind: 'list', items: [{ title: 'Contrat ascenseur', meta: 'Échéance 2027' }] }],
    })
    const { push } = rendre(<Ecran />)
    const ligne = ligneDeListe('Contrat ascenseur')
    expect(ligne.getAttribute('role')).toBe('button')
    expect(ligne.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(ligne, { key: 'Enter' })
    expect(push).toHaveBeenCalledWith({ kind: 'info', title: 'Contrat ascenseur', desc: 'Échéance 2027' })
  })
})

describe('Modal — fond', () => {
  it('fond en role="presentation" : le clic sur le fond ferme, le clic dans la boîte non', () => {
    const fermer = vi.fn()
    render(
      <Modal open onClose={fermer}>
        <button type="button">Contenu</button>
      </Modal>,
    )
    const fond = document.querySelector<HTMLElement>('.modal-backdrop') as HTMLElement
    expect(fond.getAttribute('role')).toBe('presentation')
    expect(fond.hasAttribute('tabindex')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Contenu' }))
    expect(fermer).not.toHaveBeenCalled()
    fireEvent.click(fond)
    expect(fermer).toHaveBeenCalledTimes(1)
  })
})
