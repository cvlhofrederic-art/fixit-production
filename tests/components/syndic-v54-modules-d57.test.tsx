import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModUrgencias from '@/components/syndic-dashboard/v54/modules/ModUrgencias'
import ModHistEdificio from '@/components/syndic-dashboard/v54/modules/ModHistEdificio'
import ModChatbot from '@/components/syndic-dashboard/v54/modules/ModChatbot'
import ModInfracoes from '@/components/syndic-dashboard/v54/modules/ModInfracoes'
import ModBenchmarking from '@/components/syndic-dashboard/v54/modules/ModBenchmarking'

/** Étape d (batch d57) — 5 modules net-new (catalogue-only en V5.7), composés de primitives v54. */

afterEach(() => cleanup())

describe('ModUrgencias', () => {
  it('rend le titre, l\'alerte de despacho et les KPIs', () => {
    render(<ModUrgencias />)
    expect(screen.getByRole('heading', { name: 'Urgências Técnicas', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Despacho automático ativo')).toBeInTheDocument()
    expect(screen.getByText('Profissionais disponíveis')).toBeInTheDocument()
  })
})

describe('ModHistEdificio', () => {
  it('rend le titre, les KPIs et les panneaux consolidés', () => {
    render(<ModHistEdificio />)
    expect(screen.getByRole('heading', { name: 'Histórico Edifício', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Custo acumulado 2026')).toBeInTheDocument()
    expect(screen.getByText('Intervenções recentes')).toBeInTheDocument()
  })
})

describe('ModChatbot', () => {
  it('rend le titre, l\'alerte 24/7 et les conversas', () => {
    render(<ModChatbot />)
    expect(screen.getByRole('heading', { name: 'Chatbot WhatsApp 24/7', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Chatbot ativo 24/7')).toBeInTheDocument()
    expect(screen.getByText('Conversas hoje')).toBeInTheDocument()
  })
})

describe('ModInfracoes', () => {
  it('rend le titre, le pipeline et la table d\'infrações', () => {
    render(<ModInfracoes />)
    expect(screen.getByRole('heading', { name: 'Acompanhamento de Infrações', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Multas aplicadas')).toBeInTheDocument()
    expect(screen.getByText('Infrações em curso')).toBeInTheDocument()
  })
})

describe('ModBenchmarking', () => {
  it('rend le titre, les KPIs et le ranking', () => {
    render(<ModBenchmarking />)
    expect(screen.getByRole('heading', { name: 'Benchmarking Imóveis', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Melhor performance')).toBeInTheDocument()
    expect(screen.getByText('Ranking de edifícios')).toBeInTheDocument()
  })
})
