// tests/components/syndic-v54-batch5.test.tsx
//
// Primitive batch 5 : Tabs (hand-rolled + upgrade WAI-ARIA roving tabindex).
// On teste la logique clavier + a11y ; le rendu visuel (underline) est en Playwright.

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import Tabs from '@/components/syndic-dashboard/v54/primitives/tabs/Tabs'

afterEach(cleanup)

const TABS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
]

describe('syndic v54 — Tabs', () => {
  it('renders a tablist with role=tab buttons', () => {
    const { getByRole, getAllByRole } = render(<Tabs tabs={TABS} defaultActive="a" ariaLabel="X" />)
    expect(getByRole('tablist').getAttribute('aria-label')).toBe('X')
    expect(getAllByRole('tab').length).toBe(3)
  })

  it('roving tabindex : actif tabIndex 0 + aria-selected true, autres -1 / false', () => {
    const { getAllByRole } = render(<Tabs tabs={TABS} defaultActive="b" />)
    const tabs = getAllByRole('tab')
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(tabs[1].getAttribute('tabindex')).toBe('0')
    expect(tabs[0].getAttribute('aria-selected')).toBe('false')
    expect(tabs[0].getAttribute('tabindex')).toBe('-1')
  })

  it('badge + aria-controls (panelId) rendus', () => {
    const { getAllByRole, getByText } = render(
      <Tabs tabs={[{ id: 'a', label: 'A', badge: 5, panelId: 'pan-a' }]} defaultActive="a" />,
    )
    expect(getByText('5')).toBeTruthy()
    expect(getAllByRole('tab')[0].getAttribute('aria-controls')).toBe('pan-a')
  })

  it('controlle : clic fire onChange avec l\'id', () => {
    const fn = vi.fn()
    const { getAllByRole } = render(<Tabs tabs={TABS} active="a" onChange={fn} />)
    fireEvent.click(getAllByRole('tab')[2])
    expect(fn).toHaveBeenCalledWith('c')
  })

  it('non-controlle : clic deplace l\'onglet actif', () => {
    const { getAllByRole } = render(<Tabs tabs={TABS} defaultActive="a" />)
    const tabs = getAllByRole('tab')
    fireEvent.click(tabs[2])
    expect(tabs[2].getAttribute('aria-selected')).toBe('true')
    expect(tabs[0].getAttribute('aria-selected')).toBe('false')
  })

  it('clavier ArrowRight : activation automatique + le focus suit (roving)', () => {
    const fn = vi.fn()
    const { getAllByRole, getByRole } = render(<Tabs tabs={TABS} active="a" onChange={fn} ariaLabel="X" />)
    const tabs = getAllByRole('tab')
    tabs[0].focus()
    fireEvent.keyDown(getByRole('tablist'), { key: 'ArrowRight' })
    expect(fn).toHaveBeenCalledWith('b') // automatic activation
    expect(document.activeElement).toBe(tabs[1]) // le focus suit l'onglet (roving)
  })

  it('clavier ArrowLeft wrap (premier -> dernier) ; Home/End sautent', () => {
    const { getAllByRole, getByRole } = render(<Tabs tabs={TABS} defaultActive="a" />)
    const tabs = getAllByRole('tab')
    const list = getByRole('tablist')
    tabs[0].focus()
    fireEvent.keyDown(list, { key: 'ArrowLeft' })
    expect(tabs[2].getAttribute('aria-selected')).toBe('true') // wrap a -> c
    fireEvent.keyDown(list, { key: 'Home' })
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(list, { key: 'End' })
    expect(tabs[2].getAttribute('aria-selected')).toBe('true')
  })
})
