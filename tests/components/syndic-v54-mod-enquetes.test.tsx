import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModEnquetes from '@/components/syndic-dashboard/v54/modules/ModEnquetes'

/** Étape d (batch d47) — ModEnquetes : rendu byte-exact de Enquetes & Sondagens. */

describe('ModEnquetes', () => {
  it('rend le titre, les sondages et le badge anónima (3e seulement)', () => {
    render(<ModEnquetes />)
    expect(screen.getByRole('heading', { name: 'Enquetes & Sondagens', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Horário de recolha de lixo')).toBeInTheDocument()
    expect(screen.getByText('Satisfação serviço limpeza')).toBeInTheDocument()
    expect(screen.getAllByText('Anónima')).toHaveLength(1)
  })
})
