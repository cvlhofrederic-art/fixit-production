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
import V54SectionSkeleton from '@/components/syndic-dashboard/v54/primitives/skeleton/SectionSkeleton'
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
  it('renders the base shimmer atom (no variant), aria-hidden', () => {
    const { container } = render(<Skeleton />)
    const el = container.querySelector('span')!
    expect(el).toBeTruthy()
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.className).toMatch(/skeleton/)
  })

  it('renders card / row / kpi containers as aria-hidden divs', () => {
    for (const variant of ['card', 'row', 'kpi'] as const) {
      const { container } = render(<Skeleton variant={variant} />)
      const el = container.querySelector('div')!
      expect(el).toBeTruthy()
      expect(el.getAttribute('aria-hidden')).toBe('true')
      expect(el.className).toMatch(new RegExp(variant))
      cleanup()
    }
  })

  it('applies width / height / radius on the base atom via inline style', () => {
    const { container } = render(<Skeleton width="60%" height={40} radius="50%" />)
    const el = container.querySelector('span') as HTMLElement
    expect(el.style.width).toBe('60%')
    expect(el.style.height).toBe('40px')
    expect(el.style.borderRadius).toBe('50%')
  })

  it('renders inner bars inside a container variant', () => {
    const { container } = render(
      <Skeleton variant="card">
        <Skeleton width={10} height={10} />
      </Skeleton>,
    )
    const card = container.querySelector('div')!
    expect(card.querySelector('span')).toBeTruthy()
  })

  it('V54SectionSkeleton renders a card with a header + N row atoms (fallback Suspense)', () => {
    const { container } = render(<V54SectionSkeleton rows={3} />)
    const card = container.querySelector('div')!
    expect(card.getAttribute('aria-hidden')).toBe('true')
    // 1 header + 3 lignes = 4 atomes shimmer
    expect(container.querySelectorAll('span').length).toBe(4)
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
