import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModMapaFiscal from '@/components/syndic-dashboard/v54/modules/ModMapaFiscal'

/** Étape d (batch d35) — ModMapaFiscal : rendu byte-exact de Mapa Fiscal Anual. */

describe('ModMapaFiscal', () => {
  it('rend le titre, l\'alerte Max Expert et le tableau des catégories', () => {
    render(<ModMapaFiscal />)
    expect(screen.getByRole('heading', { name: 'Mapa Fiscal Anual', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Categorias fiscais — auto Max Expert')).toBeInTheDocument()
    expect(screen.getByText('Manutenção elevadores')).toBeInTheDocument()
    expect(screen.getByText('Outras despesas')).toBeInTheDocument()
  })
})
