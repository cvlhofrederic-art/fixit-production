// tests/components/syndic-v54-modules-d8.test.tsx
//
// Modules d8 : ModSeguros + ModProcLote + ModAGLive (KPIGrid + Tabs + Empty).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModSeguros from '@/components/syndic-dashboard/v54/modules/ModSeguros'
import ModProcLote from '@/components/syndic-dashboard/v54/modules/ModProcLote'
import ModAGLive from '@/components/syndic-dashboard/v54/modules/ModAGLive'

afterEach(cleanup)

describe('syndic v54 — ModSeguros', () => {
  it('rend titre, KPIs, action et état vide', () => {
    render(<ModSeguros />)
    expect(screen.getByRole('heading', { name: 'Gestão de Seguros' })).toBeTruthy()
    expect(screen.getByText('Apólices Ativas')).toBeTruthy()
    expect(screen.getByText('Capital Total')).toBeTruthy()
    expect(screen.getByText('Nenhum edifício registado')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Nova Apólice/ })).toBeTruthy()
  })
})

describe('syndic v54 — ModProcLote', () => {
  it('rend titre, KPIs, champ cible et cartes d’actions', () => {
    render(<ModProcLote />)
    expect(screen.getByRole('heading', { name: 'Processamentos em Lote' })).toBeTruthy()
    expect(screen.getByText('Execuções totais')).toBeTruthy()
    expect(screen.getByLabelText('Edifício alvo')).toBeTruthy()
    expect(screen.getByText('Emissão de Quotas')).toBeTruthy()
    expect(screen.getByText('Convocatória AG em Lote')).toBeTruthy()
  })
})

describe('syndic v54 — ModAGLive', () => {
  it('rend titre, KPIs et état vide avec action', () => {
    render(<ModAGLive />)
    expect(screen.getByRole('heading', { name: 'Assembleia Geral Digital' })).toBeTruthy()
    expect(screen.getByText('Total AGs')).toBeTruthy()
    expect(screen.getByText('Nenhuma AG em curso')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Agendar nova AG/ })).toBeTruthy()
  })
})
