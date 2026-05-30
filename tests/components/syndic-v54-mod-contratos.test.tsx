import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModContratos from '@/components/syndic-dashboard/v54/modules/ModContratos'

/** Étape d (batch d35) — ModContratos : rendu byte-exact de Contratos com Prestadores. */

describe('ModContratos', () => {
  it('rend le titre, l\'Empty et le lifecycle', () => {
    render(<ModContratos />)
    expect(screen.getByRole('heading', { name: 'Contratos com Prestadores', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum contrato centralizado')).toBeInTheDocument()
    expect(screen.getByText('Alerta J-90')).toBeInTheDocument()
    expect(screen.getByText('Renovação/Substituição')).toBeInTheDocument()
  })
})
