// tests/components/syndic-v54-icon.test.tsx
//
// Primitive Icon v54 (batch 1 étape b). Vérifie le contrat SVG non-négociable
// extrait du bundle V5.7 + le fallback doc + le spread des props.

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import Icon from '@/components/syndic-dashboard/v54/primitives/icon/Icon'
import { ICON_NAMES } from '@/lib/syndic/icon-names'
import { ICON_PATHS } from '@/components/syndic-dashboard/v54/primitives/icon/registry'

afterEach(cleanup)

function renderIcon(props: React.ComponentProps<typeof Icon>) {
  const { container } = render(<Icon {...props} />)
  return container.querySelector('svg') as SVGSVGElement
}

/**
 * Normalise un path data (sous-ensemble M/m/L/l + paires implicites, Z ignoré)
 * en liste de points absolus. Permet de comparer deux glyphes géométriquement
 * même si leur syntaxe diffère (ex `m` relatif vs `M`+`l`).
 */
function toAbsolutePoints(d: string): string {
  const tokens = d.match(/[MmLlZz]|-?\d*\.?\d+/g) ?? []
  const pts: string[] = []
  let cx = 0
  let cy = 0
  let cmd = ''
  let k = 0
  while (k < tokens.length) {
    const tok = tokens[k]
    if (/[MmLlZz]/.test(tok)) {
      cmd = tok
      k++
      if (cmd === 'Z' || cmd === 'z') continue
    }
    const nx = parseFloat(tokens[k++])
    const ny = parseFloat(tokens[k++])
    if (cmd === 'M' || cmd === 'L') {
      cx = nx
      cy = ny
    } else {
      cx += nx
      cy += ny
    }
    pts.push(`${cx},${cy}`)
    if (cmd === 'M') cmd = 'L'
    if (cmd === 'm') cmd = 'l'
  }
  return pts.join(' ')
}

describe('syndic v54 — Icon primitive', () => {
  it('renders an svg without crashing', () => {
    const svg = renderIcon({ name: 'bell' })
    expect(svg).toBeTruthy()
  })

  it('applies the non-negotiable SVG contract from the V5.7 bundle', () => {
    const svg = renderIcon({ name: 'plus' })
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.getAttribute('fill')).toBe('none')
    expect(svg.getAttribute('stroke')).toBe('currentColor')
    expect(svg.getAttribute('stroke-width')).toBe('1.8')
    expect(svg.getAttribute('stroke-linecap')).toBe('round')
    expect(svg.getAttribute('stroke-linejoin')).toBe('round')
  })

  it('renders 5 sample icons with their own (non-fallback) glyph', () => {
    // On vérifie que le rendu diffère du fallback doc pour des icônes connues.
    const docSvg = renderIcon({ name: 'doc' }).innerHTML
    cleanup()
    for (const name of ['plus', 'bell', 'calendar', 'users', 'info'] as const) {
      const svg = renderIcon({ name })
      expect(svg.innerHTML.length).toBeGreaterThan(0)
      expect(svg.innerHTML).not.toBe(docSvg)
      cleanup()
    }
  })

  it('falls back to the doc glyph for an unknown name (runtime defense)', () => {
    const docSvg = renderIcon({ name: 'doc' }).innerHTML
    cleanup()
    // Cast volontaire : TS interdit normalement un name hors IconName, mais on
    // teste la défense runtime (paths[name] ?? paths.doc).
    const svg = renderIcon({ name: 'this-icon-does-not-exist' as never })
    expect(svg.innerHTML).toBe(docSvg)
  })

  it('spreads SVG props (style, className, aria-label)', () => {
    const svg = renderIcon({ name: 'search', className: 'foo', style: { width: 14, height: 14 }, 'aria-label': 'Rechercher' })
    expect(svg.getAttribute('class')).toContain('foo')
    expect(svg.style.width).toBe('14px')
    expect(svg.getAttribute('aria-label')).toBe('Rechercher')
  })

  it('is aria-hidden by default (decorative) but exposes label when provided', () => {
    const hidden = renderIcon({ name: 'star' })
    expect(hidden.getAttribute('aria-hidden')).toBe('true')
    cleanup()
    const labelled = renderIcon({ name: 'star', 'aria-label': 'Favori' })
    expect(labelled.getAttribute('aria-hidden')).toBeNull()
  })

  it('registry exposes exactly the 103 names declared in the generated type', () => {
    expect(ICON_NAMES.length).toBe(103)
    // Chaque nom du type a bien un path dans le registre (cohérence codegen).
    for (const name of ICON_NAMES) {
      expect(ICON_PATHS[name]).toBeDefined()
    }
  })

  it('chevronDown and chevron-down resolve to the same path (issue #244)', () => {
    const camel = renderIcon({ name: 'chevronDown' }).innerHTML
    cleanup()
    const kebab = renderIcon({ name: 'chevron-down' }).innerHTML
    expect(camel).toBe(kebab)
  })

  it('chevron and chevron-right are geometric aliases — same absolute points (issue #244)', () => {
    // Byte-différents (m9 6 6 6-6 6 relatif vs M9 6l6 6-6 6) MAIS géométrie
    // identique : (9,6)→(15,12)→(9,18) = ">". On compare les points absolus
    // normalisés, pas l'innerHTML brut. Verrou Phase 2 : si un des deux paths
    // diverge géométriquement, ce test pète.
    const dOf = (name: React.ComponentProps<typeof Icon>['name']) => {
      const d = renderIcon({ name }).querySelector('path')?.getAttribute('d') ?? ''
      cleanup()
      return toAbsolutePoints(d)
    }
    const chevron = dOf('chevron')
    expect(chevron).toBe('9,6 15,12 9,18')
    expect(chevron).toBe(dOf('chevron-right'))
  })
})
