// tests/components/syndic-v54-mod-cobrauto.test.tsx
//
// Module d17 : ModCobrAuto (KPIs + Tabs + état vide).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModCobrAuto from '@/components/syndic-dashboard/v54/modules/ModCobrAuto'

afterEach(cleanup)

describe('syndic v54 — ModCobrAuto', () => {
  it('rend titre, KPIs, onglets et état vide', () => {
    render(<ModCobrAuto />)
    expect(screen.getByRole('heading', { name: 'Cobrança Automática · Juros & Sanções' })).toBeTruthy()
    expect(screen.getByText('Em curso de cobrança')).toBeTruthy()
    expect(screen.getByText('Recuperados')).toBeTruthy()
    expect(screen.getByText('Nenhum processo')).toBeTruthy()
  })
})
