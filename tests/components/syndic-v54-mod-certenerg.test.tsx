import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModCertEnerg from '@/components/syndic-dashboard/v54/modules/ModCertEnerg'

/** Étape d (batch d41) — ModCertEnerg : rendu byte-exact + ouverture du modal (stateful). */

describe('ModCertEnerg', () => {
  it('rend l\'état vide, l\'alerte SCE et les KPIs', () => {
    render(<ModCertEnerg />)
    expect(screen.getByRole('heading', { name: 'Certificação Energética', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Sistema de Certificação Energética (SCE) — DL 101-D/2020')).toBeInTheDocument()
    expect(screen.getByText('Nenhum certificado registado')).toBeInTheDocument()
    expect(screen.getByText('Certificados')).toBeInTheDocument()
  })

  it('ouvre le modal au clic sur « Adicionar certificado »', () => {
    render(<ModCertEnerg />)
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar certificado/ })[0])
    expect(screen.getByText('Adicionar certificado energético')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nº certificado/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Edifício/)).toBeInTheDocument()
  })
})
