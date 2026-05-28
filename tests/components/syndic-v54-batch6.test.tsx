// tests/components/syndic-v54-batch6.test.tsx
//
// Primitive batch 6 : Modal (focus trap hand-rolled + durcissements a11y).
// On teste la mécanique (a11y, trap, ESC, restauration focus, inert, scroll-lock)
// en jsdom ; le rendu visuel (backdrop/animations) est couvert en Playwright.

import React, { useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/syndic-dashboard/v54/primitives/modal'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
})

/** Harness contrôlé : un déclencheur + un modal avec close/input/foot (3 focusables). */
function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button data-testid="trigger" onClick={() => setOpen(true)}>Ouvrir</button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="t-title" size="md">
        <ModalHead id="t-title" icon="wrench" title="Titre" onClose={() => setOpen(false)} />
        <ModalBody>
          <input data-testid="inp" />
        </ModalBody>
        <ModalFoot>
          <button data-testid="foot-btn">OK</button>
        </ModalFoot>
      </Modal>
    </>
  )
}

/** Harness re-query : l'input ajouté après ouverture est le DERNIER focusable. */
function ReQueryHarness() {
  const [open, setOpen] = useState(false)
  const [showExtra, setShowExtra] = useState(false)
  return (
    <>
      <button data-testid="trigger" onClick={() => setOpen(true)}>Ouvrir</button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="rq-title">
        <ModalHead id="rq-title" title="T" onClose={() => setOpen(false)} />
        <ModalBody>
          <button data-testid="add" type="button" onClick={() => setShowExtra(true)}>Ajouter</button>
          {showExtra && <input data-testid="extra" />}
        </ModalBody>
      </Modal>
    </>
  )
}

const openModal = () => fireEvent.click(screen.getByTestId('trigger'))

describe('syndic v54 — Modal', () => {
  it('1. fermé : ne rend rien (pas de dialog)', () => {
    render(<Harness />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('2. ouvert : role=dialog + aria-modal + aria-labelledby', () => {
    render(<Harness />)
    openModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('t-title')
    // le titre porte bien l'id cible
    expect(document.getElementById('t-title')?.textContent).toContain('Titre')
  })

  it('3. ESC ferme le modal', () => {
    render(<Harness />)
    openModal()
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('4. clic backdrop ferme ; clic dans le dialog ne ferme pas', () => {
    render(<Harness />)
    openModal()
    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.parentElement as HTMLElement
    fireEvent.click(dialog) // target !== currentTarget(backdrop) → ne ferme pas
    expect(screen.queryByRole('dialog')).toBeTruthy()
    fireEvent.click(backdrop) // target === currentTarget → ferme
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('5. focus trap : Tab sur dernier → premier ; Shift+Tab sur premier → dernier', () => {
    render(<Harness />)
    openModal()
    const close = screen.getByRole('button', { name: 'Fechar' })
    const foot = screen.getByTestId('foot-btn')
    foot.focus()
    fireEvent.keyDown(document.body, { key: 'Tab' })
    expect(document.activeElement).toBe(close) // wrap dernier → premier
    close.focus()
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(foot) // wrap premier → dernier
  })

  it('6. restauration du focus : revient au déclencheur après fermeture', () => {
    render(<Harness />)
    const trigger = screen.getByTestId('trigger')
    trigger.focus()
    expect(document.activeElement).toBe(trigger)
    openModal()
    // pendant l'ouverture, le focus est passé dans le modal
    expect(document.activeElement).not.toBe(trigger)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(document.activeElement).toBe(trigger) // restauré
  })

  it('7. focus initial : premier focusable (bouton fermer) focalisé à l\'ouverture', () => {
    render(<Harness />)
    openModal()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar' }))
  })

  it('8. inert + aria-hidden sur le fond (restauré à la fermeture)', () => {
    const bg = document.createElement('div')
    bg.id = 'bg-probe'
    document.body.appendChild(bg)
    try {
      render(<Harness />)
      openModal()
      expect(bg.getAttribute('aria-hidden')).toBe('true')
      expect(bg.inert).toBeTruthy()
      fireEvent.keyDown(document.body, { key: 'Escape' })
      expect(bg.hasAttribute('aria-hidden')).toBe(false)
      expect(bg.inert).toBeFalsy()
    } finally {
      bg.remove()
    }
  })

  it('9. scroll-lock : body overflow hidden pendant ouverture, restauré', () => {
    render(<Harness />)
    expect(document.body.style.overflow).not.toBe('hidden')
    openModal()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('10. re-query des focusables au Tab : un champ ajouté après ouverture entre dans le piège', () => {
    render(<ReQueryHarness />)
    openModal()
    fireEvent.click(screen.getByTestId('add')) // ajoute un input APRÈS, dernier focusable
    const extra = screen.getByTestId('extra')
    const close = screen.getByRole('button', { name: 'Fechar' })
    extra.focus() // l'extra est désormais le dernier focusable
    fireEvent.keyDown(document.body, { key: 'Tab' })
    // re-query → activeElement===dernier(extra) → wrap au premier(close).
    // Avec une capture figée à l'ouverture, extra serait hors-liste → pas de wrap.
    expect(document.activeElement).toBe(close)
  })

  it('onClose n\'est pas re-déclenché par un re-render (ref stable)', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Modal open onClose={onClose} labelledBy="x">
        <ModalHead id="x" title="T" onClose={onClose} />
        <ModalBody><input /></ModalBody>
      </Modal>,
    )
    rerender(
      <Modal open onClose={() => onClose()} labelledBy="x">
        <ModalHead id="x" title="T" onClose={onClose} />
        <ModalBody><input /></ModalBody>
      </Modal>,
    )
    expect(onClose).not.toHaveBeenCalled() // le re-render ne ferme pas
  })
})
