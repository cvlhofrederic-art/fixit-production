import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModEFatura from '@/components/syndic-dashboard/v54/modules/ModEFatura'

/** Étape d (batch d25) — ModEFatura : rendu byte-exact du module Integração e-Fatura AT. */

describe('ModEFatura', () => {
  it('rend le titre, les champs NIF et le bouton de submissão', () => {
    render(<ModEFatura />)
    expect(screen.getByRole('heading', { name: 'Integração e-Fatura AT', level: 1 })).toBeInTheDocument()
    expect(screen.getByLabelText('NIF Emitente *')).toBeInTheDocument()
    expect(screen.getByLabelText('NIF Destinatário *')).toBeInTheDocument()
    expect(screen.getByText('Nova Submissão e-Fatura')).toBeInTheDocument()
    expect(screen.getByText('Itens do Documento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submeter ao e-Fatura/ })).toBeInTheDocument()
  })
})
