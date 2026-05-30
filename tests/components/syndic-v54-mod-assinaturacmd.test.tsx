// tests/components/syndic-v54-mod-assinaturacmd.test.tsx
//
// Module d18 : ModAssinaturaCMD (KPIs sans icône + formulaire + drop-zone).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModAssinaturaCMD from '@/components/syndic-dashboard/v54/modules/ModAssinaturaCMD'

afterEach(cleanup)

describe('syndic v54 — ModAssinaturaCMD', () => {
  it('rend titre, KPIs, formulaire et zone de dépôt', () => {
    render(<ModAssinaturaCMD />)
    expect(screen.getByRole('heading', { name: 'Assinatura Digital CMD' })).toBeTruthy()
    expect(screen.getByText('Total Documentos Assinados')).toBeTruthy()
    expect(screen.getByText('Assinar Novo Documento')).toBeTruthy()
    expect(screen.getByLabelText('Nome do Documento')).toBeTruthy()
    expect(screen.getByText('Clique ou arraste o ficheiro aqui')).toBeTruthy()
  })
})
