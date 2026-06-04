// tests/components/syndic-v54-mod-portal.test.tsx
//
// Module d15 : ModPortal (Portal do Condómino — KPIs custom + ações + avisos).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModPortal from '@/components/syndic-dashboard/v54/modules/ModPortal'

afterEach(cleanup)

describe('syndic v54 — ModPortal', () => {
  it('rend titre, KPIs, ações rápidas et avisos', () => {
    render(<ModPortal />)
    expect(screen.getByRole('heading', { name: 'Portal do Condómino' })).toBeTruthy()
    expect(screen.getByText('Saldo devedor')).toBeTruthy()
    expect(screen.getByText('Em dia')).toBeTruthy()
    expect(screen.getByText('Ações rápidas')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ver recibos' })).toBeTruthy()
    expect(screen.getByText('Assembleia Geral Ordinária')).toBeTruthy()
  })
})
