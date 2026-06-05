// tests/components/syndic-v54-errorstate-multiimoveis.test.tsx
//
// Primitive ErrorState (wrapper rust autour de Empty) + module ModMultiImoveis.

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { ErrorState } from '@/components/syndic-dashboard/v54/primitives/error-state'
import ModMultiImoveis from '@/components/syndic-dashboard/v54/modules/ModMultiImoveis'

afterEach(cleanup)

describe('syndic v54 — ErrorState', () => {
  it('rend titre, desc et bouton « Tentar novamente » (onRetry)', () => {
    const onRetry = vi.fn()
    render(<ErrorState title="Erro X" desc="Tente novamente" onRetry={onRetry} />)
    expect(screen.getByText('Erro X')).toBeTruthy()
    expect(screen.getByText('Tente novamente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('un CTA personnalisé remplace le bouton réessayer', () => {
    render(<ErrorState title="X" action={<button type="button">Custom</button>} />)
    expect(screen.getByRole('button', { name: 'Custom' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Tentar novamente/ })).toBeNull()
  })
})

describe('syndic v54 — ModMultiImoveis', () => {
  it('rend titre et état d’erreur', () => {
    render(<ModMultiImoveis />)
    expect(screen.getByRole('heading', { name: 'Multi-Imóveis', level: 1 })).toBeTruthy()
    expect(screen.getByText('Erro ao carregar imóveis')).toBeTruthy()
  })
})
