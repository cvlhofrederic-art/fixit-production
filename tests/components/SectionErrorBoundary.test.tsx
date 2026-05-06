import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import { SectionErrorBoundary } from '@/components/common/SectionErrorBoundary'

function Bomb({ message = 'kaboom' }: { message?: string }): ReactElement {
  throw new Error(message)
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SectionErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <SectionErrorBoundary>
        <div data-testid="child">ok</div>
      </SectionErrorBoundary>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders the FR fallback when a child throws', () => {
    render(
      <SectionErrorBoundary>
        <Bomb />
      </SectionErrorBoundary>
    )
    expect(screen.getByText('Erreur dans cette section')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('switches copy when locale=pt', () => {
    render(
      <SectionErrorBoundary locale="pt">
        <Bomb />
      </SectionErrorBoundary>
    )
    expect(screen.getByText('Erro nesta secção')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('Retry resets the boundary state', () => {
    let shouldThrow = true
    function MaybeBomb() {
      if (shouldThrow) throw new Error('boom')
      return <span data-testid="recovered">recovered</span>
    }

    const { rerender } = render(
      <SectionErrorBoundary>
        <MaybeBomb />
      </SectionErrorBoundary>
    )
    expect(screen.getByText('Erreur dans cette section')).toBeInTheDocument()

    // The retry click only resets internal state — the consumer must also
    // stop throwing on the next render.
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    rerender(
      <SectionErrorBoundary>
        <MaybeBomb />
      </SectionErrorBoundary>
    )
    expect(screen.getByTestId('recovered')).toBeInTheDocument()
  })

  it('honours a custom fallback title', () => {
    render(
      <SectionErrorBoundary fallbackTitle="Custom title">
        <Bomb />
      </SectionErrorBoundary>
    )
    expect(screen.getByText('Custom title')).toBeInTheDocument()
  })
})
