// tests/components/syndic-v54-modules-d6.test.tsx
//
// Modules d6 : ModCalReg (calendrier réglementaire) + ModDocsGED (GED).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModCalReg from '@/components/syndic-dashboard/v54/modules/ModCalReg'
import ModDocsGED from '@/components/syndic-dashboard/v54/modules/ModDocsGED'

afterEach(cleanup)

describe('syndic v54 — ModCalReg', () => {
  it('rend titre, KPIs (statuts) et table des obrigações', () => {
    render(<ModCalReg />)
    expect(screen.getByRole('heading', { name: 'Calendário Regulamentar' })).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByText('Expirados')).toBeTruthy()
    expect(screen.getByText('Em dia')).toBeTruthy()
    expect(screen.getByText('AG Anual obrigatória')).toBeTruthy()
  })
})

describe('syndic v54 — ModDocsGED', () => {
  it('rend titre, KPIs, table et compteur de documentos', () => {
    render(<ModDocsGED />)
    expect(screen.getByRole('heading', { name: 'Documentos (GED)' })).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByText('10 documentos encontrados')).toBeTruthy()
    expect(screen.getByText('Certificado Energético Foz Douro.pdf')).toBeTruthy()
    expect(screen.getByText('Relatórios')).toBeTruthy()
  })
})
