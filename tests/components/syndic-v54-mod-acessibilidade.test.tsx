import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModAcessibilidade from '@/components/syndic-dashboard/v54/modules/ModAcessibilidade'

/** Étape d (batch d33) — ModAcessibilidade : rendu byte-exact de Acessibilidade dos Edifícios. */

describe('ModAcessibilidade', () => {
  it('rend le titre, l\'alerte DL 163 et les critères', () => {
    render(<ModAcessibilidade />)
    expect(screen.getByRole('heading', { name: 'Acessibilidade dos Edifícios', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum edifício avaliado')).toBeInTheDocument()
    expect(screen.getByText('Elevador acessível')).toBeInTheDocument()
    expect(screen.getByText('Percurso acessível contínuo')).toBeInTheDocument()
  })
})
