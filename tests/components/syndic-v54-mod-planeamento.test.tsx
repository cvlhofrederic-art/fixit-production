import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ModPlaneamento from '@/components/syndic-dashboard/v54/modules/ModPlaneamento'

/** Étape d (batch d53) — ModPlaneamento : agenda semaine byte-exact (stateful, dropdown équipe + modal). */

describe('ModPlaneamento', () => {
  it('rend le titre, la grille semaine et le sélecteur d\'équipe', () => {
    render(<ModPlaneamento />)
    expect(screen.getByRole('heading', { name: 'Planeamento', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Toda a equipa/ })).toBeInTheDocument()
    expect(screen.getByText(/Eventos da semana/)).toBeInTheDocument()
    cleanup()
  })

  it('ouvre le menu de sélection d\'équipe', () => {
    render(<ModPlaneamento />)
    fireEvent.click(screen.getAllByRole('button', { name: /Toda a equipa/ })[0])
    expect(screen.getAllByText('Helena Carvalho').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inês Monteiro').length).toBeGreaterThan(0)
    cleanup()
  })
})
