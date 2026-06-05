import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModMonitorizacao from '@/components/syndic-dashboard/v54/modules/ModMonitorizacao'

/** Étape d (batch d26) — ModMonitorizacao : rendu byte-exact du module Monitorização de Consumos. */

describe('ModMonitorizacao', () => {
  it('rend le titre, les KPIs consommation et le panneau d\'alertes', () => {
    render(<ModMonitorizacao />)
    expect(screen.getByRole('heading', { name: 'Monitorização de Consumos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Eletricidade (kWh) — Últimos 6 meses')).toBeInTheDocument()
    expect(screen.getByText('Alertas ativos (2)')).toBeInTheDocument()
    expect(screen.getByText('Aviso')).toBeInTheDocument()
    expect(screen.getByText('Info')).toBeInTheDocument()
  })
})
