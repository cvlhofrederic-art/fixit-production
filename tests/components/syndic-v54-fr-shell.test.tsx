// tests/components/syndic-v54-fr-shell.test.tsx
//
// Lot 0 FR — Shell du dashboard syndic judiciaire (sidebar + topbar + router +
// notifications + rôle). Modèle : syndic-v54-shell.test.tsx (PT). Le rendu visuel
// et le drawer responsive restent du ressort de Playwright (lots ultérieurs).

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import ShellFR from '@/components/syndic-dashboard/v54-fr/shell/ShellFR'
import { SIDEBAR_FR, SIDE_TITLES_FR, isItem } from '@/components/syndic-dashboard/v54-fr/shell/sidebar-config'
import { NOTIFICATIONS } from '@/components/syndic-dashboard/v54-fr/data/mock'

afterEach(cleanup)

const renderModule = (route: string) => <div data-testid="active">{route}</div>
const renderShell = (props = {}) =>
  render(
    <ToastProvider>
      <ShellFR renderModule={renderModule} {...props} />
    </ToastProvider>,
  )

describe('syndic v54-fr — ShellFR', () => {
  it('1. rend la sidebar (sections + items + sous-en-tête) + le module par défaut (cockpit)', () => {
    renderShell()
    expect(screen.getByText('Agents IA')).toBeTruthy()
    expect(screen.getByText('Mandat judiciaire')).toBeTruthy()
    expect(screen.getByText('Conformité légale')).toBeTruthy()
    expect(screen.getByText('Obligations')).toBeTruthy() // sous-en-tête __H__
    expect(screen.getByRole('button', { name: /Ordonnances & missions/ })).toBeTruthy()
    expect(screen.getByTestId('active').textContent).toBe('cockpit') // defaultRoute
  })

  it('2. navigation : clic sur un item change la route active + le breadcrumb', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: /Reddition de comptes/ }))
    expect(screen.getByTestId('active').textContent).toBe('reddition')
    expect(screen.getAllByText('Reddition de comptes').length).toBeGreaterThan(1) // item + crumb
  })

  it('3. collapse : le titre de section replie/déplie le groupe', () => {
    renderShell()
    const head = screen.getByRole('button', { name: /Cabinet & supervision/ })
    expect(head.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('false')
  })

  it('4. notifications : ouverture du panneau, compteur de non-lues, tout marquer comme lu', () => {
    renderShell()
    const initialUnread = NOTIFICATIONS.length - 7 // 7 ids lus au premier rendu (mockup)
    const bell = screen.getByRole('button', { name: `Voir les notifications (${initialUnread} non lues)` })
    fireEvent.click(bell)
    expect(screen.getByRole('dialog', { name: 'Centre de notifications' })).toBeTruthy()
    expect(screen.getByText(`${initialUnread} non lues`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }))
    expect(screen.getByText('Tout est à jour')).toBeTruthy()
  })

  it('5. rôle : le sélecteur topbar change la valeur courante', () => {
    renderShell()
    const sel = screen.getByRole('combobox', { name: 'Rôle dans le cabinet' }) as HTMLSelectElement
    expect(sel.value).toBe('Direction')
    fireEvent.change(sel, { target: { value: 'Comptabilité' } })
    expect(sel.value).toBe('Comptabilité')
  })

  it('6. logout : déclenche onLogout sans changer de route', () => {
    const onLogout = vi.fn()
    renderShell({ onLogout })
    fireEvent.click(screen.getByRole('button', { name: /Déconnexion/ }))
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('active').textContent).toBe('cockpit')
  })

  it('7. intégrité config : ids uniques + SIDE_TITLES_FR couvre tous les items', () => {
    const ids = SIDEBAR_FR.flatMap((s) => s.entries.filter(isItem).map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(SIDE_TITLES_FR[id], `SIDE_TITLES_FR manque ${id}`).toBeTruthy()
    }
  })
})
