import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModObrigPrazos from '@/components/syndic-dashboard/v54/modules/ModObrigPrazos'

/** Étape d (batch d44) — ModObrigPrazos : rendu byte-exact + ouverture du modal (stateful). */

describe('ModObrigPrazos', () => {
  it('rend l\'état vide, l\'alerte et les références légales', () => {
    render(<ModObrigPrazos />)
    expect(screen.getByRole('heading', { name: 'Obrigações Legais', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Nenhuma obrigação registada/)).toBeInTheDocument()
    expect(screen.getByText('Inspeção de gás')).toBeInTheDocument()
    expect(screen.getByText('Segurança contra incêndios')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Adicionar »', () => {
    render(<ModObrigPrazos />)
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar/ })[0])
    expect(screen.getByText('Adicionar obrigação legal')).toBeInTheDocument()
    expect(screen.getByLabelText(/Tipo de obrigação/)).toBeInTheDocument()
  })
})
