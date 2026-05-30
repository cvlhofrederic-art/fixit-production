import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModFCR from '@/components/syndic-dashboard/v54/modules/ModFCR'

/** Étape d (batch d43) — ModFCR : rendu byte-exact + ouverture des 2 modals (stateful). */

describe('ModFCR', () => {
  it('rend l\'état vide, les KPIs et la conformité', () => {
    render(<ModFCR />)
    expect(screen.getByRole('heading', { name: 'Fundo Comum de Reserva', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Nenhum edifício configurado')).toBeInTheDocument()
    expect(screen.getByText('Conformidade Legal')).toBeInTheDocument()
  })

  it('ouvre le modal edifício', () => {
    render(<ModFCR />)
    fireEvent.click(screen.getAllByRole('button', { name: /Novo Edifício/ })[0])
    expect(screen.getByText('Adicionar edifício ao FCR')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome do edifício/)).toBeInTheDocument()
  })

  it('ouvre le modal movimento', () => {
    render(<ModFCR />)
    fireEvent.click(screen.getAllByRole('button', { name: /Registar Movimento/ })[0])
    expect(screen.getByText('Registar movimento no FCR')).toBeInTheDocument()
    expect(screen.getByLabelText(/Montante/)).toBeInTheDocument()
  })
})
