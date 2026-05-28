// tests/components/syndic-v54-batch4.test.tsx
//
// Primitives batch 4 : Panel, PageHead, Alert, KPI, KPIGrid, Empty.
// CSS Modules mockés (classes scopées) — on teste structure/logique/a11y, les
// valeurs calculées sont couvertes par Playwright.

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import Panel from '@/components/syndic-dashboard/v54/primitives/panel/Panel'
import PageHead from '@/components/syndic-dashboard/v54/primitives/page-head/PageHead'
import Alert from '@/components/syndic-dashboard/v54/primitives/alert/Alert'
import KPI from '@/components/syndic-dashboard/v54/primitives/kpi/KPI'
import KPIGrid from '@/components/syndic-dashboard/v54/primitives/kpi/KPIGrid'
import Empty from '@/components/syndic-dashboard/v54/primitives/empty/Empty'

afterEach(cleanup)

describe('syndic v54 — Panel', () => {
  it('renders header (icon + title + sub + right) and body', () => {
    const { container, getByText } = render(
      <Panel icon="building" title="Titre" sub="Sous" right={<span>R</span>}>
        corps
      </Panel>,
    )
    expect(getByText('Titre')).toBeTruthy()
    expect(getByText('Sous')).toBeTruthy()
    expect(getByText('R')).toBeTruthy()
    expect(getByText('corps')).toBeTruthy()
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('flush applies the flush body class', () => {
    const { container } = render(
      <Panel title="x" flush>
        c
      </Panel>,
    )
    expect(container.innerHTML).toMatch(/flush/)
  })

  it('omits the header when no title/right', () => {
    const { container } = render(<Panel>c</Panel>)
    expect(container.querySelector('h3')).toBeNull()
  })
})

describe('syndic v54 — PageHead', () => {
  it('renders title h1 + eyebrow + lede + actions', () => {
    const { container, getByText } = render(
      <PageHead eyebrow="Eye" title="Titre" lede="Lede" actions={<button>Act</button>} />,
    )
    expect(container.querySelector('h1')!.textContent).toBe('Titre')
    expect(getByText('Eye')).toBeTruthy()
    expect(getByText('Lede')).toBeTruthy()
    expect(getByText('Act')).toBeTruthy()
  })
})

describe('syndic v54 — Alert', () => {
  it('default (amber) : icon + title in <b> + children in <p>', () => {
    const { container } = render(
      <Alert title="T" icon="alert">
        Corps
      </Alert>,
    )
    expect(container.querySelector('b')!.textContent).toBe('T')
    expect(container.querySelector('p')!.textContent).toBe('Corps')
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('applies the kind class (rust/sage/gold)', () => {
    for (const k of ['rust', 'sage', 'gold'] as const) {
      const { container } = render(
        <Alert kind={k} title="x">
          y
        </Alert>,
      )
      expect(container.querySelector('div')!.className).toMatch(new RegExp(k))
      cleanup()
    }
  })
})

describe('syndic v54 — KPI', () => {
  it('renders num / lbl / sub', () => {
    const { getByText } = render(<KPI icon="chart" num="100" lbl="Lab" sub="Sub" />)
    expect(getByText('100')).toBeTruthy()
    expect(getByText('Lab')).toBeTruthy()
    expect(getByText('Sub')).toBeTruthy()
  })

  it('accent adds the border-top class', () => {
    const { container } = render(<KPI num="1" lbl="x" accent="sage" />)
    expect(container.querySelector('div')!.className).toMatch(/accentSage/)
  })

  it('renders cur / suffix / trend, and dot replaces the icon', () => {
    const { getByText } = render(<KPI num="9" cur="€" suffix="%" trend={{ kind: 'bad', label: '-2' }} />)
    expect(getByText('€')).toBeTruthy()
    expect(getByText('%')).toBeTruthy()
    expect(getByText('-2')).toBeTruthy()
    cleanup()
    const { container } = render(<KPI num="3" lbl="x" dot="rust" />)
    expect(container.innerHTML).toMatch(/kpiDot/)
    expect(container.querySelector('svg')).toBeNull() // pas d'icône en mode dot
  })

  it('lblFirst places the label before the number', () => {
    const { container } = render(<KPI num="NUM" lbl="LABEL" lblFirst />)
    const html = container.innerHTML
    expect(html.indexOf('LABEL')).toBeLessThan(html.indexOf('NUM'))
  })
})

describe('syndic v54 — KPIGrid', () => {
  it('renders one KPI per item', () => {
    const { getByText } = render(
      <KPIGrid items={[{ num: '11', lbl: 'a' }, { num: '22', lbl: 'b' }, { num: '33', lbl: 'c' }]} />,
    )
    expect(getByText('11')).toBeTruthy()
    expect(getByText('22')).toBeTruthy()
    expect(getByText('33')).toBeTruthy()
  })
})

describe('syndic v54 — Empty', () => {
  it('badge fallback : icon + badge-circle, title + desc', () => {
    const { container, getByText } = render(<Empty icon="check" kind="sage" title="T" desc="D" />)
    expect(container.querySelector('svg')).toBeTruthy()
    expect(getByText('T')).toBeTruthy()
    expect(getByText('D')).toBeTruthy()
    expect(container.innerHTML).toMatch(/badgeCircle/)
  })

  it('illustration mode injects the SVG (no badge-circle)', () => {
    const { container } = render(<Empty illustration="documentos" title="Docs" />)
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.innerHTML).toMatch(/illus/)
    expect(container.innerHTML).not.toMatch(/badgeCircle/)
  })

  it('renders the action slot', () => {
    const { getByText } = render(<Empty title="x" action={<button>Go</button>} />)
    expect(getByText('Go')).toBeTruthy()
  })
})
