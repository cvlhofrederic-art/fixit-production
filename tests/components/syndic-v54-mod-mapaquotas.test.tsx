import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModMapaQuotas from '@/components/syndic-dashboard/v54/modules/ModMapaQuotas'

/** Étape d (batch d27) — ModMapaQuotas : rendu byte-exact du module Mapa de Quotas. */

describe('ModMapaQuotas', () => {
  it('rend le titre, les KPIs et le tableau des frações', () => {
    render(<ModMapaQuotas />)
    expect(screen.getByRole('heading', { name: 'Mapa de Quotas', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Orçamento anual (EUR)')).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('Gabriela Almeida')).toBeInTheDocument()
    expect(screen.getByText('45d atraso | 185,00 €')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Permilagem' })).toBeInTheDocument()
  })
})
