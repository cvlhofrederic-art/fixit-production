import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModPrazosLegais from '@/components/syndic-dashboard/v54/modules/ModPrazosLegais'

/** Étape d (batch d29) — ModPrazosLegais : rendu byte-exact de la liste Prazos Legais. */

describe('ModPrazosLegais', () => {
  it('rend le titre, les KPIs et la liste des obrigações', () => {
    render(<ModPrazosLegais />)
    expect(screen.getByRole('heading', { name: 'Prazos Legais', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByText('Limpeza de chaminés').length).toBeGreaterThan(0)
    expect(screen.getByText('AG anual')).toBeInTheDocument()
    expect(screen.getByText('Verificação de extintores')).toBeInTheDocument()
    expect(screen.getByText('Todos os edifícios')).toBeInTheDocument()
  })
})
