import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModProcuracoes from '@/components/syndic-dashboard/v54/modules/ModProcuracoes'

/** Étape d (batch d32) — ModProcuracoes : rendu byte-exact de Procurações & Lista de Presenças. */

describe('ModProcuracoes', () => {
  it('rend le titre, l\'alerte légale et le pipeline OCR', () => {
    render(<ModProcuracoes />)
    expect(screen.getByRole('heading', { name: 'Procurações & Lista de Presenças', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma procuração arquivada')).toBeInTheDocument()
    expect(screen.getByText('Pipeline OCR Léa')).toBeInTheDocument()
    expect(screen.getByText('Identificação partes')).toBeInTheDocument()
    expect(screen.getByText('Validação NIF')).toBeInTheDocument()
  })
})
