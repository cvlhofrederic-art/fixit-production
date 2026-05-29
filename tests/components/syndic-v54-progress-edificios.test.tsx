// tests/components/syndic-v54-progress-edificios.test.tsx
//
// Primitive Progress + module Edifícios (qui l'utilise).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { Progress } from '@/components/syndic-dashboard/v54/primitives/progress'
import ModEdificios from '@/components/syndic-dashboard/v54/modules/ModEdificios'

afterEach(cleanup)

describe('syndic v54 — Progress', () => {
  it('role=progressbar + aria-valuenow + largeur de barre', () => {
    render(<Progress pct={50} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('50')
    expect((bar.firstChild as HTMLElement).style.width).toBe('50%')
  })

  it('clampe hors bornes (150 -> 100, -10 -> 0)', () => {
    const { rerender } = render(<Progress pct={150} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
    rerender(<Progress pct={-10} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })
})

describe('syndic v54 — ModEdificios', () => {
  it('rend titre, KPIs, bâtiments + une barre par bâtiment', () => {
    render(<ModEdificios />)
    expect(screen.getByRole('heading', { name: 'Edifícios' })).toBeTruthy()
    expect(screen.getByText('Edifícios geridos')).toBeTruthy()
    expect(screen.getByText('Edifício Atlântico')).toBeTruthy()
    expect(screen.getByText('Residencial Cedofeita')).toBeTruthy()
    expect(screen.getAllByRole('progressbar').length).toBe(4) // une barre orçamento par bâtiment
  })
})
