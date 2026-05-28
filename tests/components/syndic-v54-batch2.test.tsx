// tests/components/syndic-v54-batch2.test.tsx
//
// Primitives batch 2 étape b : Pill, Skeleton, Pulse. Vérifie le rendu, les
// variants, et les contrats (noDot, aria-hidden, spread props).
// Les CSS Modules sont mockés en identité par la config Vitest — on teste la
// présence/logique des classes, pas leur valeur calculée (couvert par Playwright).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import Pill from '@/components/syndic-dashboard/v54/primitives/pill/Pill'
import Skeleton from '@/components/syndic-dashboard/v54/primitives/skeleton/Skeleton'
import Pulse from '@/components/syndic-dashboard/v54/primitives/pulse/Pulse'

afterEach(cleanup)

describe('syndic v54 — Pill', () => {
  it('renders children', () => {
    const { getByText } = render(<Pill>Em curso</Pill>)
    expect(getByText('Em curso')).toBeTruthy()
  })

  it('applies a kind class', () => {
    const { container } = render(<Pill kind="sage">ok</Pill>)
    const el = container.querySelector('span')!
    // CSS Modules : classes hashées, mais la classe "sage" doit apparaître dans le className.
    expect(el.className).toMatch(/sage/)
  })

  it('renders all 5 kinds + default without crash', () => {
    for (const kind of ['sage', 'amber', 'rust', 'gold', 'dark'] as const) {
      const { container } = render(<Pill kind={kind}>x</Pill>)
      expect(container.querySelector('span')).toBeTruthy()
      cleanup()
    }
    const { container } = render(<Pill>default</Pill>)
    expect(container.querySelector('span')).toBeTruthy()
  })

  it('applies noDot class when noDot is set', () => {
    const { container } = render(<Pill noDot>x</Pill>)
    expect(container.querySelector('span')!.className).toMatch(/noDot/)
  })

  it('forwards a custom className', () => {
    const { container } = render(<Pill className="extra">x</Pill>)
    expect(container.querySelector('span')!.className).toMatch(/extra/)
  })
})

describe('syndic v54 — Skeleton', () => {
  it('renders with default text variant', () => {
    const { container } = render(<Skeleton />)
    const el = container.querySelector('span')!
    expect(el).toBeTruthy()
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.className).toMatch(/text/)
  })

  it('applies card and circle variants', () => {
    const { container: c1 } = render(<Skeleton variant="card" />)
    expect(c1.querySelector('span')!.className).toMatch(/card/)
    cleanup()
    const { container: c2 } = render(<Skeleton variant="circle" />)
    expect(c2.querySelector('span')!.className).toMatch(/circle/)
  })

  it('applies width and height via inline style', () => {
    const { container } = render(<Skeleton width="60%" height={40} />)
    const el = container.querySelector('span') as HTMLElement
    expect(el.style.width).toBe('60%')
    expect(el.style.height).toBe('40px')
  })
})

describe('syndic v54 — Pulse', () => {
  it('renders a span, aria-hidden by default', () => {
    const { container } = render(<Pulse />)
    const el = container.querySelector('span')!
    expect(el).toBeTruthy()
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })

  it('spreads positioning props (style) for consumer-controlled placement', () => {
    const { container } = render(<Pulse style={{ position: 'absolute', top: 7, right: 7 }} />)
    const el = container.querySelector('span') as HTMLElement
    expect(el.style.position).toBe('absolute')
    expect(el.style.top).toBe('7px')
    expect(el.style.right).toBe('7px')
  })

  it('forwards a custom className alongside the pulse class', () => {
    const { container } = render(<Pulse className="extra" />)
    expect(container.querySelector('span')!.className).toMatch(/extra/)
  })
})
