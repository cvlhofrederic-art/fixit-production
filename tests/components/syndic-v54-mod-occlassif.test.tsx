// tests/components/syndic-v54-mod-occlassif.test.tsx
//
// Module d24 : ModOcClassif (formulaire IA + panneau exemples).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModOcClassif from '@/components/syndic-dashboard/v54/modules/ModOcClassif'

afterEach(cleanup)

describe('syndic v54 — ModOcClassif', () => {
  it('rend titre, formulaire et panneau exemples', () => {
    render(<ModOcClassif />)
    expect(screen.getByRole('heading', { name: 'Ocorrências — Classificador IA' })).toBeTruthy()
    expect(screen.getByLabelText('Edifício')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Analisar e Classificar/ })).toBeTruthy()
    expect(screen.getByText('Escreva a descrição do problema')).toBeTruthy()
    expect(screen.getByText('Exemplos:')).toBeTruthy()
  })
})
