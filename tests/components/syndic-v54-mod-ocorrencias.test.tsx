import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModOcorrencias from '@/components/syndic-dashboard/v54/modules/ModOcorrencias'

/** Étape d (batch d48) — ModOcorrencias : rendu byte-exact de Ocorrências e Manutenção. */

describe('ModOcorrencias', () => {
  it('rend le titre, la distribution et la liste', () => {
    render(<ModOcorrencias />)
    expect(screen.getByRole('heading', { name: 'Ocorrências e Manutenção', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Distribuição por prioridade')).toBeInTheDocument()
    expect(screen.getByText('Conformidade SLA')).toBeInTheDocument()
    expect(screen.getByText('Infiltração no teto da garagem B2')).toBeInTheDocument()
  })
})
