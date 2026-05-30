import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModDeclEncargos from '@/components/syndic-dashboard/v54/modules/ModDeclEncargos'

/** Étape d (batch d42) — ModDeclEncargos : rendu byte-exact + ouverture du modal (stateful). */

describe('ModDeclEncargos', () => {
  it('rend l\'état vide, l\'alerte Lei 8/2022 et les KPIs', () => {
    render(<ModDeclEncargos />)
    expect(screen.getByRole('heading', { name: 'Declaração de Encargos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma declaração registada')).toBeInTheDocument()
    expect(screen.getByText('Total de declarações')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Nova declaração »', () => {
    render(<ModDeclEncargos />)
    fireEvent.click(screen.getAllByRole('button', { name: /Nova declaração/ })[0])
    expect(screen.getByText('Nova declaração de encargos')).toBeInTheDocument()
    expect(screen.getByLabelText(/Fração/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Condómino/)).toBeInTheDocument()
  })
})
