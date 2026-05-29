// tests/components/syndic-v54-button.test.tsx
//
// Primitive Button v54 — port des classes .btn / variantes / tailles du bundle
// V5.7. Centralise le style bouton (dont .btn svg { 14px }) et résout la
// duplication inline qui était répartie dans chaque module (dette #257).

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'

afterEach(cleanup)

describe('syndic v54 — Button', () => {
  it('rend un <button type="button"> avec la classe de base et ses enfants', () => {
    render(<Button>Salvar</Button>)
    const b = screen.getByRole('button', { name: 'Salvar' })
    expect(b.tagName).toBe('BUTTON')
    expect(b.getAttribute('type')).toBe('button')
    expect(b.className).toMatch(/btn/)
  })

  it('déclenche onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>X</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('transmet aria-label / title / disabled (cas bouton icône-seul)', () => {
    render(
      <Button aria-label="Eliminar" title="Eliminar" disabled>
        x
      </Button>,
    )
    const b = screen.getByRole('button', { name: 'Eliminar' })
    expect(b.getAttribute('title')).toBe('Eliminar')
    expect((b as HTMLButtonElement).disabled).toBe(true)
  })

  it('applique className et style passthrough', () => {
    render(
      <Button className="custom-x" style={{ marginTop: 6 }}>
        Y
      </Button>,
    )
    const b = screen.getByRole('button')
    expect(b.className).toMatch(/custom-x/)
    expect(b.style.marginTop).toBe('6px')
  })

  it('mappe chaque variant vers sa classe du bundle', () => {
    const { container } = render(
      <>
        <Button variant="gold">g</Button>
        <Button variant="primary">p</Button>
        <Button variant="danger">d</Button>
        <Button variant="ghost">h</Button>
      </>,
    )
    const cls = Array.from(container.querySelectorAll('button')).map((b) => b.className)
    expect(cls[0]).toMatch(/gold/)
    expect(cls[1]).toMatch(/primary/)
    expect(cls[2]).toMatch(/danger/)
    expect(cls[3]).toMatch(/ghost/)
  })

  it('size="sm" ajoute la classe compacte (≠ taille par défaut)', () => {
    const { container, rerender } = render(<Button>m</Button>)
    const md = container.querySelector('button')!.className
    rerender(<Button size="sm">s</Button>)
    const sm = container.querySelector('button')!.className
    expect(sm).toMatch(/sm/)
    expect(sm).not.toBe(md)
  })
})
