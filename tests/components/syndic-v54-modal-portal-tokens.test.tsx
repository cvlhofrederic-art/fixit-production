import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { Modal, ModalHead, ModalBody } from '@/components/syndic-dashboard/v54/primitives/modal'

/**
 * Le Modal v54 est rendu en portal sous <body>, hors de #syndic-dashboard-v54 où sont déclarés les
 * tokens --v54-* : sans relais, la fenêtre s'affichait sans fond (var(--v54-paper) non résolue),
 * le contenu de l'écran apparaissant à travers. Le backdrop porte data-v54-portal, sélecteur sur
 * lequel tokens.css et fonts.css déclarent aussi les variables.
 */
describe('Modal v54 — tokens résolus dans le portal', () => {
  it('le backdrop du portal porte data-v54-portal', () => {
    render(
      <Modal open onClose={() => {}} labelledBy="t-modal">
        <ModalHead id="t-modal" title="Fenêtre" onClose={() => {}} />
        <ModalBody>Contenu</ModalBody>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Fenêtre' })
    expect(dialog.parentElement).toHaveAttribute('data-v54-portal')
    expect(dialog.parentElement?.parentElement).toBe(document.body)
  })

  it('tokens.css et fonts.css déclarent les variables aussi sur [data-v54-portal], jamais sur :root', () => {
    for (const f of ['tokens.css', 'fonts.css']) {
      const css = readFileSync(join(process.cwd(), 'components/syndic-dashboard/v54/tokens', f), 'utf8')
      expect(css).toMatch(/#syndic-dashboard-v54,\s*\[data-v54-portal\]\s*\{/)
      expect(css).not.toMatch(/^\s*:root/m) // même contrôle que la CI (code-quality.yml, G1)
    }
  })
})
