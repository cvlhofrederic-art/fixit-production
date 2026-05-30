import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModSeguroObr from '@/components/syndic-dashboard/v54/modules/ModSeguroObr'

/** Étape d (batch d45) — ModSeguroObr : rendu byte-exact + ouverture des 2 modals (stateful). */

describe('ModSeguroObr', () => {
  it('rend l\'état vide et les KPIs', () => {
    render(<ModSeguroObr />)
    expect(screen.getByRole('heading', { name: 'Seguro Obrigatório de Condomínio', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma apólice registada')).toBeInTheDocument()
    expect(screen.getByText('Apólices Ativas')).toBeInTheDocument()
  })

  it('ouvre le modal apólice', () => {
    render(<ModSeguroObr />)
    fireEvent.click(screen.getAllByRole('button', { name: /Nova Apólice/ })[0])
    expect(screen.getByText('Nova apólice de seguro')).toBeInTheDocument()
    expect(screen.getByLabelText(/Seguradora/)).toBeInTheDocument()
  })

  it('ouvre le modal sinistro', () => {
    render(<ModSeguroObr />)
    fireEvent.click(screen.getAllByRole('button', { name: /Participar Sinistro/ })[0])
    expect(screen.getByText('Participar sinistro')).toBeInTheDocument()
    expect(screen.getByLabelText(/Montante estimado/)).toBeInTheDocument()
  })
})
