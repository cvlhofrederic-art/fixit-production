// tests/components/syndic-v54-mod-orcia.test.tsx
//
// Module d23 : ModOrcIA (KPIs + paramètres de génération + état vide).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModOrcIA from '@/components/syndic-dashboard/v54/modules/ModOrcIA'

afterEach(cleanup)

describe('syndic v54 — ModOrcIA', () => {
  it('rend titre, KPIs, paramètres et état vide', () => {
    render(<ModOrcIA />)
    expect(screen.getByRole('heading', { name: 'Orçamento Anual com IA' })).toBeTruthy()
    expect(screen.getByText('Total Orçamentos')).toBeTruthy()
    expect(screen.getByText('Parâmetros de Geração')).toBeTruthy()
    expect(screen.getByLabelText('Edifício')).toBeTruthy()
    expect(screen.getByText('Gere o seu primeiro orçamento com IA')).toBeTruthy()
  })
})
