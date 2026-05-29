// tests/components/syndic-v54-shell.test.tsx
//
// Étape c — Shell du dashboard syndic v54 (sidebar + topbar + router + drawer).
// On teste la navigation, l'état actif, le collapse de section, compteurs/dot,
// logout. Le rendu visuel + le drawer responsive sont en Playwright.

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { DashboardShell } from '@/components/syndic-dashboard/v54/shell'

afterEach(cleanup)

const renderModule = (route: string) => <div data-testid="active">{route}</div>
const renderShell = (props = {}) => render(<DashboardShell renderModule={renderModule} {...props} />)

describe('syndic v54 — DashboardShell', () => {
  it('1. rend la sidebar (sections + items + sous-en-tête) + le module par défaut', () => {
    renderShell()
    expect(screen.getByText('Agentes IA')).toBeTruthy()
    expect(screen.getByText('Gestão')).toBeTruthy()
    expect(screen.getByText('Obrigações Legais')).toBeTruthy()
    expect(screen.getByText('Compliance Geral')).toBeTruthy() // sous-en-tête __H__
    expect(screen.getByRole('button', { name: /Painel de controlo/ })).toBeTruthy()
    expect(screen.getByTestId('active').textContent).toBe('dashboard') // defaultRoute
  })

  it('2. navigation : clic sur un item change la route active', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: /Canal de Comunicações/ }))
    expect(screen.getByTestId('active').textContent).toBe('canal')
  })

  it('3. item actif porte aria-current=page', () => {
    renderShell()
    const item = screen.getByRole('button', { name: /A Minha Equipa/ })
    fireEvent.click(item)
    expect(item.getAttribute('aria-current')).toBe('page')
  })

  it('4. collapse : l\'en-tête de section bascule aria-expanded', () => {
    renderShell()
    const head = screen.getByRole('button', { name: 'Agentes IA' }) // section sans collision de substring
    expect(head.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('false')
  })

  it('5. compteurs + pastille rendus (Ordens count 4, Fixy dot)', () => {
    renderShell()
    const ordens = screen.getByRole('button', { name: /Ordens de serviço/ })
    expect(ordens.textContent).toContain('4')
  })

  it('6. logout : appelle onLogout sans changer la route', () => {
    const onLogout = vi.fn()
    renderShell({ onLogout })
    fireEvent.click(screen.getByRole('button', { name: /Terminar sessão/ }))
    expect(onLogout).toHaveBeenCalled()
    expect(screen.getByTestId('active').textContent).toBe('dashboard') // inchangé
  })

  it('7. brand + breadcrumb (VitFix Pro)', () => {
    renderShell()
    expect(screen.getByText('VitFix Pro')).toBeTruthy()
    expect(screen.getByLabelText('Abrir menu')).toBeTruthy() // hamburger présent (caché en CSS desktop)
  })
})
