import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModReembolsos from '@/components/syndic-dashboard/v54/modules/ModReembolsos'

/** Étape d (batch d37) — ModReembolsos : rendu byte-exact de Reembolsos Automáticos. */

describe('ModReembolsos', () => {
  it('rend le titre, le tableau vide et le pipeline', () => {
    render(<ModReembolsos />)
    expect(screen.getByRole('heading', { name: 'Reembolsos Automáticos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum reembolso em curso.')).toBeInTheDocument()
    expect(screen.getByText('Declaração venda fração')).toBeInTheDocument()
    expect(screen.getByText('Execução Open Banking')).toBeInTheDocument()
  })
})
