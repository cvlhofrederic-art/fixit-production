import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { monterShellJudiciaire as monterShell, preparerShellJudiciaire } from '../helpers/shell-judiciaire'

/**
 * Focus rendu au bouton ☰ quand le menu latéral se ferme alors que le focus est dans le menu (décision du 26/11/2026) :
 * le menu fermé passe en visibility:hidden (aj-correctifs.css) et le focus tomberait sinon sur le document.
 * À l'ouverture, le focus va sur la première entrée de navigation visible du menu, et le bouton ☰ désigne le menu
 * qu'il commande (aria-controls) : décision du 27/11/2026 du référent métier (point 1 de la page de #842).
 */

vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return <div data-testid="ecran-registre" />
    },
}))

preparerShellJudiciaire()

const bouton = () => screen.getByRole('button', { name: 'Ouvrir le menu' })
const menu = () => document.querySelector('aside.sidebar') as HTMLElement
const voile = () => document.querySelector('.sidebar-backdrop') as HTMLElement

/** Ouvre le menu et met le focus sur son premier lien, comme un utilisateur qui y arrive avec Tab. */
function ouvrirMenuFocusDansLeMenu(): HTMLElement {
  fireEvent.click(bouton())
  expect(menu()).toHaveClass('is-open')
  const lien = menu().querySelector<HTMLElement>('a[href], button')
  expect(lien).not.toBeNull()
  lien?.focus()
  expect(menu().contains(document.activeElement)).toBe(true)
  return lien as HTMLElement
}

describe('menu latéral : focus à la fermeture', () => {
  it('Échap avec le focus dans le menu : le focus revient au bouton ☰', async () => {
    await monterShell()
    ouvrirMenuFocusDansLeMenu()
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(menu()).not.toHaveClass('is-open')
    expect(bouton()).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(bouton())
  })

  it('clic sur le voile avec le focus dans le menu : le focus revient au bouton ☰', async () => {
    await monterShell()
    ouvrirMenuFocusDansLeMenu()
    await act(async () => {
      fireEvent.click(voile())
    })
    expect(menu()).not.toHaveClass('is-open')
    expect(document.activeElement).toBe(bouton())
  })

  it('focus hors du menu à la fermeture : il n’est pas déplacé', async () => {
    await monterShell()
    fireEvent.click(bouton())
    const main = document.getElementById('main') as HTMLElement
    main.focus()
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(document.activeElement).toBe(main)
  })

})

describe('menu latéral : focus à l’ouverture et lien avec le bouton ☰', () => {
  const premiereEntreeVisible = () => menu().querySelector<HTMLElement>('.nav-group:not(.collapsed) .nav-item')

  it('ouverture : le focus va sur la première entrée de navigation visible du menu', async () => {
    await monterShell()
    bouton().focus()
    await act(async () => {
      fireEvent.click(bouton())
    })
    const entree = premiereEntreeVisible()
    expect(entree).not.toBeNull()
    expect(entree).toHaveClass('nav-item')
    expect(document.activeElement).toBe(entree)
  })

  it('premier groupe replié : le focus va sur la première entrée d’un groupe déplié', async () => {
    await monterShell()
    const premierTitre = within(menu()).getAllByRole('button', { expanded: true }).find((el) => el.tagName === 'H6') as HTMLElement
    expect(premierTitre).toBeDefined()
    fireEvent.click(premierTitre)
    expect(premierTitre.closest('.nav-group')).toHaveClass('collapsed')
    await act(async () => {
      fireEvent.click(bouton())
    })
    const entree = premiereEntreeVisible()
    expect(entree).not.toBeNull()
    expect(premierTitre.closest('.nav-group')?.contains(entree)).toBe(false)
    expect(document.activeElement).toBe(entree)
  })

  it('tous les groupes repliés : le focus va sur le premier élément du menu qui le reçoit (« Rechercher »)', async () => {
    await monterShell()
    for (const titre of within(menu()).getAllByRole('button', { expanded: true }).filter((el) => el.tagName === 'H6')) fireEvent.click(titre)
    expect(premiereEntreeVisible()).toBeNull()
    await act(async () => {
      fireEvent.click(bouton())
    })
    expect(document.activeElement).toBe(within(menu()).getByRole('button', { name: 'Ouvrir la palette de commandes' }))
  })

  it('le bouton ☰ désigne le menu qu’il commande (aria-controls)', async () => {
    await monterShell()
    const id = bouton().getAttribute('aria-controls')
    expect(id).toBeTruthy()
    expect(document.getElementById(id as string)).toBe(menu())
  })

  it('ouverture puis Échap sans toucher au focus : le focus revient au bouton ☰', async () => {
    await monterShell()
    bouton().focus()
    await act(async () => {
      fireEvent.click(bouton())
    })
    expect(menu().contains(document.activeElement)).toBe(true)
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(document.activeElement).toBe(bouton())
  })

  it('palette ouverte depuis « Rechercher » du menu, puis Échap : le focus finit sur le bouton ☰, pas sur le document', async () => {
    await monterShell()
    fireEvent.click(bouton())
    const rechercher = within(menu()).getByText('Rechercher…').closest('button') as HTMLElement
    rechercher.focus()
    fireEvent.click(rechercher)
    const palette = screen.getByRole('dialog', { name: 'Palette de commandes' })
    within(palette).getByRole<HTMLInputElement>('textbox', { name: 'Rechercher' }).focus()
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog', { name: 'Palette de commandes' })).toBeNull()
    expect(menu()).not.toHaveClass('is-open')
    expect(document.activeElement).toBe(bouton())
  })
})
