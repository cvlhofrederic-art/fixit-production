// tests/components/syndic-v54-modules-d5.test.tsx
//
// Modules d5 : DocsInterv, ContabTec (tables), Faturação, Alertas.

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModDocsInterv from '@/components/syndic-dashboard/v54/modules/ModDocsInterv'
import ModContabTec from '@/components/syndic-dashboard/v54/modules/ModContabTec'
import ModFaturacao from '@/components/syndic-dashboard/v54/modules/ModFaturacao'
import ModAlertas from '@/components/syndic-dashboard/v54/modules/ModAlertas'

afterEach(cleanup)

describe('syndic v54 — ModDocsInterv', () => {
  it('rend titre, KPIs, recherche et état vide', () => {
    render(<ModDocsInterv />)
    expect(screen.getByRole('heading', { name: 'Documentos de Intervenções' })).toBeTruthy()
    expect(screen.getByText('Total documentos')).toBeTruthy()
    expect(screen.getByText('Nenhum documento')).toBeTruthy()
    expect(screen.getByLabelText('Pesquisar documento')).toBeTruthy()
  })
})

describe('syndic v54 — ModContabTec', () => {
  it('rend titre + deux tables (par profissional + détail) avec totaux', () => {
    render(<ModContabTec />)
    expect(screen.getByRole('heading', { name: 'Contabilidade Técnica' })).toBeTruthy()
    expect(screen.getAllByRole('table').length).toBe(2)
    expect(screen.getByText('Por profissional')).toBeTruthy()
    expect(screen.getByText('Detalhe das intervenções (12)')).toBeTruthy()
    expect(screen.getByText('Por atribuir')).toBeTruthy()
    expect(screen.getByText('TOTAL')).toBeTruthy()
  })
})

describe('syndic v54 — ModFaturacao', () => {
  it('rend titre, onglets et état vide', () => {
    render(<ModFaturacao />)
    expect(screen.getByRole('heading', { name: 'Faturação & Recibos Verdes' })).toBeTruthy()
    expect(screen.getByText('Nenhuma fatura nem orçamento nas missões')).toBeTruthy()
    expect(screen.getByText('Recibos Verdes & IRS')).toBeTruthy()
  })
})

describe('syndic v54 — ModAlertas', () => {
  it('rend titre et état vide (sage)', () => {
    render(<ModAlertas />)
    expect(screen.getByRole('heading', { name: 'Alertas' })).toBeTruthy()
    expect(screen.getByText('Todos os alertas foram tratados!')).toBeTruthy()
  })
})
