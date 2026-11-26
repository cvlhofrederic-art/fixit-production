import './fuseau-paris'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Shell } from '@/components/administrateur-judiciaire/shell/Shell'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

/**
 * Focus rendu au bouton ☰ quand le menu latéral se ferme alors que le focus est dans le menu (décision du 26/11/2026) :
 * le menu fermé passe en visibility:hidden (aj-correctifs.css) et le focus tomberait sinon sur le document.
 * Le focus n'est pas déplacé à l'ouverture.
 */

vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return <div data-testid="ecran-registre" />
    },
}))

beforeAll(async () => {
  localStorage.clear()
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loaded: false, loading: false })
  await useDonneesStore.getState().loadAll()
})

beforeEach(() => {
  localStorage.clear()
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  useSelectionDossier.setState({ code: null, coproprietaireId: null })
  window.history.replaceState(null, '', '#tresorerie')
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', window.location.pathname)
})

async function monterShell(): Promise<void> {
  await act(async () => {
    render(
      <div id="aj-root" lang="fr">
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </div>,
    )
  })
}

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

  it('ouverture : le focus n’est pas déplacé', async () => {
    await monterShell()
    bouton().focus()
    fireEvent.click(bouton())
    expect(document.activeElement).toBe(bouton())
    expect(menu().contains(document.activeElement)).toBe(false)
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
