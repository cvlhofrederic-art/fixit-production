// tests/components/syndic-v54-mod-compenergia.test.tsx
//
// Module d16 : ModComparadorEnergia (KPIs + cartes énergie par édifice).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModComparadorEnergia from '@/components/syndic-dashboard/v54/modules/ModComparadorEnergia'

afterEach(cleanup)

describe('syndic v54 — ModComparadorEnergia', () => {
  it('rend titre, KPIs et profils énergétiques par édifice', () => {
    render(<ModComparadorEnergia />)
    expect(screen.getByRole('heading', { name: 'Comparador de Tarifas de Energia Coletiva' })).toBeTruthy()
    expect(screen.getByText('Total edifícios')).toBeTruthy()
    expect(screen.getByText('Perfil Energético por Edifício')).toBeTruthy()
    expect(screen.getByText('Edifício Aurora')).toBeTruthy()
    expect(screen.getByText('Edifício Douro')).toBeTruthy()
  })
})
