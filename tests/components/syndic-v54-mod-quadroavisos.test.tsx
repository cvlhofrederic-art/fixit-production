import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModQuadroAvisos from '@/components/syndic-dashboard/v54/modules/ModQuadroAvisos'

/** Étape d (batch d48) — ModQuadroAvisos : rendu byte-exact de Quadro de Avisos. */

describe('ModQuadroAvisos', () => {
  it('rend le titre, les avisos et les panneaux résumé', () => {
    render(<ModQuadroAvisos />)
    expect(screen.getByRole('heading', { name: 'Quadro de Avisos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Corte de água — Manutenção urgente da canalização')).toBeInTheDocument()
    expect(screen.getByText('Distribuição por Categoria')).toBeInTheDocument()
    expect(screen.getByText('Ações Rápidas')).toBeInTheDocument()
  })
})
