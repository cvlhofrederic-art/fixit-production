import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModValoresDivida from '@/components/syndic-dashboard/v54/modules/ModValoresDivida'

/** Étape d (batch d50) — ModValoresDivida : rendu byte-exact + ouverture du modal (stateful). */

describe('ModValoresDivida', () => {
  it('rend l\'état vide et les KPIs', () => {
    render(<ModValoresDivida />)
    expect(screen.getByRole('heading', { name: 'Valores em dívida', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum incumprimento')).toBeInTheDocument()
    expect(screen.getByText('Total de incumprimentos em curso')).toBeInTheDocument()
    expect(screen.getByText('Contencioso')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Incumprimento »', () => {
    render(<ModValoresDivida />)
    fireEvent.click(screen.getAllByRole('button', { name: /\+ Incumprimento/ })[0])
    expect(screen.getByText('Registar um incumprimento')).toBeInTheDocument()
    expect(screen.getByLabelText(/Condómino/)).toBeInTheDocument()
  })
})
