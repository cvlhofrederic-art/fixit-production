import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ModContabCond from '@/components/syndic-dashboard/v54/modules/ModContabCond'

/** Étape d (batch d54) — ModContabCond : comptabilité condomínio byte-exact (7 onglets + 4 modals). */

describe('ModContabCond', () => {
  it('rend le painel + KPIs', () => {
    render(<ModContabCond />)
    expect(screen.getByRole('heading', { name: 'Contabilidade Condomínio', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Frações geridas')).toBeInTheDocument()
    expect(screen.getByText('Saldo tesouraria')).toBeInTheDocument()
    cleanup()
  })

  it('ouvre l\'onglet Frações et le modal d\'ajout', () => {
    render(<ModContabCond />)
    fireEvent.click(screen.getByRole('tab', { name: /Frações & Permilagem/ }))
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar fração|primeira fração/ })[0])
    expect(screen.getAllByText('Adicionar fração').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Permilagem/)).toBeInTheDocument()
    cleanup()
  })
})
