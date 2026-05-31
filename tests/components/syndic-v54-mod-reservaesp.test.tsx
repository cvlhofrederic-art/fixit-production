import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModReservaEsp from '@/components/syndic-dashboard/v54/modules/ModReservaEsp'

/** Étape d (batch d55) — ModReservaEsp : reserva de espaços comuns byte-exact
 * (statique : calendrier mensuel + liste de reservas + légende). */

describe('ModReservaEsp', () => {
  it('rend le titre, le calendrier et la liste des reservas', () => {
    render(<ModReservaEsp />)
    expect(screen.getByRole('heading', { name: 'Reserva de Espaços Comuns', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Maio 2026')).toBeInTheDocument()
    expect(screen.getByText('Próximas reservas')).toBeInTheDocument()
    expect(screen.getByText('Ginásio Condominial')).toBeInTheDocument()
    cleanup()
  })

  it('rend les onglets et la légende des espaços', () => {
    render(<ModReservaEsp />)
    expect(screen.getByRole('tab', { name: /Calendário/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Espaços/ })).toBeInTheDocument()
    expect(screen.getByText('Salão de Festas', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Churrasqueira', { exact: true })).toBeInTheDocument()
    cleanup()
  })
})
