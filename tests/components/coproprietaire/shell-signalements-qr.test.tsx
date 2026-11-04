// tests/components/coproprietaire/shell-signalements-qr.test.tsx
//
// Portail copropriétaire : l'écran « AJ Signalement » (signalements reçus par QR code) n'est proposé qu'au
// super admin, dans la barre latérale et le menu « Plus » du téléphone ; il reçoit le jeton du compte même
// quand l'espace affiché est celui de l'Administrateur judiciaire ; un copropriétaire ne le voit pas et
// l'ancre #signalementsQr le ramène à l'accueil.

import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { espaceDemo } from '@/lib/coproprietaire/demo'
import type { EtatEspace } from '@/lib/coproprietaire/etat'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'

const h = vi.hoisted(() => ({
  etat: { statut: 'chargement' } as EtatEspace,
  metadonnees: null as Record<string, unknown> | null,
}))

vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr' }))
vi.mock('@/lib/coproprietaire/etat', () => ({
  useEspaceCopro: () => ({
    etat: h.etat, rafraichir: vi.fn(async () => undefined), changerLot: vi.fn(async () => undefined),
    jeton: h.etat.statut === 'pret' ? h.etat.jeton : null, metadonnees: h.metadonnees,
  }),
  seDeconnecter: vi.fn(async () => undefined),
}))
vi.mock('@/lib/dashboard-section-loader', () => ({
  createDynamicSection: () => {
    const Temoin = (props: PropsEcran) => (
      <div data-testid="ecran">
        <span data-testid="jeton">{String(props.jeton)}</span>
        <span data-testid="source">{props.espace.source}</span>
      </div>
    )
    return Temoin
  },
}))

const { default: Page } = await import('@/app/(commun)/coproprietaire/dashboard/page')

const syndic = (): EtatEspace => ({
  statut: 'pret', espace: { ...espaceDemo(), source: 'reel', vueSuperAdmin: true }, jeton: 'jeton',
  miseAJourLe: new Date('2026-11-04T14:05:00'), miseAJourImpossible: false,
})

const menuLateral = () => screen.getAllByRole('navigation', { name: 'Menu' })[0]

beforeEach(() => {
  localStorage.clear()
  h.etat = syndic()
  h.metadonnees = { role: 'super_admin' }
  window.history.replaceState(null, '', '/coproprietaire/dashboard')
  window.location.hash = ''
})

describe('écran « AJ Signalement » du portail', () => {
  it('super admin : entrée dans le menu, ancre #signalementsQr, écran servi avec le jeton du compte', () => {
    render(<Page />)
    const libelles = within(menuLateral()).getAllByRole('button').map((b) => b.textContent)
    expect(libelles).toContain('AJ Signalement')
    fireEvent.click(within(menuLateral()).getByRole('button', { name: 'AJ Signalement' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AJ Signalement')
    expect(screen.getByText('Signalements reçus par QR code : copropriétés, affiches, coordonnées des déclarants')).toBeInTheDocument()
    expect(window.location.hash).toBe('#signalementsQr')
    expect(screen.getByTestId('jeton')).toHaveTextContent('jeton')
  })

  it('avec l’AJ comme source, l’écran garde le jeton du compte alors que les autres écrans n’en ont pas', async () => {
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'Administrateur judiciaire' }))
    await waitFor(() => expect(screen.getByTestId('source')).toHaveTextContent('aj'), { timeout: 20000 })
    expect(screen.getByTestId('jeton')).toHaveTextContent('null')
    fireEvent.click(within(menuLateral()).getByRole('button', { name: 'AJ Signalement' }))
    expect(screen.getByTestId('jeton')).toHaveTextContent('jeton')
    fireEvent.click(within(menuLateral()).getByRole('button', { name: 'Accueil' }))
    expect(screen.getByTestId('jeton')).toHaveTextContent('null')
  })

  it('le menu « Plus » du téléphone propose aussi l’écran au super admin', () => {
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'Plus' }))
    const dialogue = screen.getByRole('dialog')
    fireEvent.click(within(dialogue).getByRole('button', { name: 'AJ Signalement' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AJ Signalement')
  })

  it('copropriétaire : ni entrée de menu, ni écran ; l’ancre #signalementsQr ramène à l’accueil', () => {
    h.metadonnees = { role: 'coproprio' }
    window.location.hash = '#signalementsQr'
    render(<Page />)
    const libelles = within(menuLateral()).getAllByRole('button').map((b) => b.textContent)
    expect(libelles).not.toContain('AJ Signalement')
    expect(libelles).toHaveLength(8)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Accueil')
    fireEvent.click(screen.getByRole('button', { name: 'Plus' }))
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'AJ Signalement' })).toBeNull()
  })
})
