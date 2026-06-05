// tests/components/syndic-v54-mod-comunicdig.test.tsx
//
// Module d21 : ModComunicDigital (KPIs + filtres + table de mensagens).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModComunicDigital from '@/components/syndic-dashboard/v54/modules/ModComunicDigital'

afterEach(cleanup)

describe('syndic v54 — ModComunicDigital', () => {
  it('rend titre, KPIs et table des mensagens', () => {
    render(<ModComunicDigital />)
    expect(screen.getByRole('heading', { name: 'Comunicação Digital' })).toBeTruthy()
    expect(screen.getByText('Total enviados')).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByText('Ana Silva')).toBeTruthy()
    expect(screen.getByText('Manuel Costa')).toBeTruthy()
  })
})
