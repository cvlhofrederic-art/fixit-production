import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModExtranet from '@/components/syndic-dashboard/v54/modules/ModExtranet'

/** Étape d (batch d46) — ModExtranet : rendu byte-exact + ouverture du modal (stateful). */

describe('ModExtranet', () => {
  it('rend l\'état vide, le portail et les KPIs', () => {
    render(<ModExtranet />)
    expect(screen.getByRole('heading', { name: 'Extranet Condóminos', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Registo vazio')).toBeInTheDocument()
    expect(screen.getByText('Portal Condóminos')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://vitfix.io/coproprietaire/portail')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Condómino »', () => {
    render(<ModExtranet />)
    fireEvent.click(screen.getAllByRole('button', { name: /Condómino/ })[0])
    expect(screen.getByText('Adicionar condómino')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome/)).toBeInTheDocument()
  })
})
