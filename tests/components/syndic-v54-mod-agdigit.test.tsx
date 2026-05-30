import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModAGDigit from '@/components/syndic-dashboard/v54/modules/ModAGDigit'

/** Étape d (batch d49) — ModAGDigit : rendu byte-exact + ouverture du modal (stateful). */

describe('ModAGDigit', () => {
  it('rend l\'état vide et les KPIs', () => {
    render(<ModAGDigit />)
    expect(screen.getByRole('heading', { name: 'AG Digitais', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma AG')).toBeInTheDocument()
    expect(screen.getByText('Resoluções totais')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Nova AG »', () => {
    render(<ModAGDigit />)
    fireEvent.click(screen.getAllByRole('button', { name: /Nova AG/ })[0])
    expect(screen.getByText('Nova Assembleia Geral')).toBeInTheDocument()
    expect(screen.getByLabelText(/Título/)).toBeInTheDocument()
  })
})
