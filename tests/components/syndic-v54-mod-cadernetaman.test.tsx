import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModCadernetaMan from '@/components/syndic-dashboard/v54/modules/ModCadernetaMan'

/** Étape d (batch d51) — ModCadernetaMan : rendu byte-exact + ouverture du modal (stateful). */

describe('ModCadernetaMan', () => {
  it('rend l\'état vide et les KPIs', () => {
    render(<ModCadernetaMan />)
    expect(screen.getByRole('heading', { name: 'Caderneta de Manutenção & Técnica', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Caderneta vazia')).toBeInTheDocument()
    expect(screen.getByText('Intervenções')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Intervenção »', () => {
    render(<ModCadernetaMan />)
    fireEvent.click(screen.getAllByRole('button', { name: /\+ Intervenção/ })[0])
    expect(screen.getByText('Nova intervenção')).toBeInTheDocument()
    expect(screen.getByLabelText(/Natureza das obras/)).toBeInTheDocument()
  })
})
