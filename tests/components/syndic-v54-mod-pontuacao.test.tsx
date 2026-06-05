import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModPontuacao from '@/components/syndic-dashboard/v54/modules/ModPontuacao'

/** Étape d (batch d40) — ModPontuacao : rendu byte-exact de Pontuação de Saúde dos Edifícios. */

describe('ModPontuacao', () => {
  it('rend le titre, la jauge et les KPIs', () => {
    render(<ModPontuacao />)
    expect(screen.getByRole('heading', { name: 'Pontuação de Saúde dos Edifícios', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Pontuação Média')).toBeInTheDocument()
    expect(screen.getByText('Melhor Edifício')).toBeInTheDocument()
    expect(screen.getByText('Tudo em ordem!')).toBeInTheDocument()
    expect(screen.getByText('Selecione um edifício para ver a análise completa')).toBeInTheDocument()
  })
})
