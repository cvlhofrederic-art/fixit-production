import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ModCanal from '@/components/syndic-dashboard/v54/modules/ModCanal'

/** Étape d (batch d52) — ModCanal : rendu byte-exact du Canal de Comunicações (3 colonnes, stateful). */

describe('ModCanal', () => {
  it('rend le titre, la liste de missions et la colonne chat', () => {
    render(<ModCanal />)
    expect(screen.getByRole('heading', { name: 'Canal de Comunicações', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('MISSÕES')).toBeInTheDocument()
    expect(screen.getByText('Residencial Cedofeita — Bloco A')).toBeInTheDocument()
    expect(screen.getByText('Canal profissional aberto')).toBeInTheDocument()
    expect(screen.getByText('PARTICIPANTES')).toBeInTheDocument()
    cleanup()
  })

  it('filtre les missions (Urgente)', () => {
    render(<ModCanal />)
    expect(screen.getByText('Residencial Cedofeita — Bloco A')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Urgente', exact: true }))
    expect(screen.queryByText('Residencial Cedofeita — Bloco A')).not.toBeInTheDocument()
    cleanup()
  })
})
