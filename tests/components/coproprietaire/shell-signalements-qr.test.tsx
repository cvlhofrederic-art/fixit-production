// tests/components/coproprietaire/shell-signalements-qr.test.tsx
//
// « AJ Signalement » sort du portail copropriétaire (demande de Hugo du 10/11/2026) : l'écran des signalements reçus
// par QR code vit désormais dans son espace indépendant (/fr/aj-signalement/). Le portail n'en garde qu'un lien,
// pour le seul super admin (pas sa « vue en tant que », refusée par l'espace depuis le 11/11/2026), dans la barre
// latérale et le menu « Plus » du téléphone.
// Même pour un super admin : aucun écran « AJ Signalement », huit écrans comme pour tous, l'ancre #signalementsQr
// ramène à l'accueil. Un copropriétaire (huit écrans) ou un vrai locataire (six écrans, sans Charges ni Assemblées)
// ne voit pas le lien.

import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
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
    const Temoin = (props: PropsEcran) => <div data-testid="ecran"><span data-testid="jeton">{String(props.jeton)}</span></div>
    return Temoin
  },
}))

const { default: Page } = await import('@/app/(commun)/coproprietaire/dashboard/page')

const espaceReel = (vueSuperAdmin: boolean): EtatEspace => ({
  statut: 'pret', espace: { ...espaceDemo(), source: 'reel', vueSuperAdmin }, jeton: 'jeton',
  miseAJourLe: new Date('2026-11-04T14:05:00'), miseAJourImpossible: false,
})

/** Espace d'un vrai locataire : la page lit le rôle dans espace.profil.role (pas dans app_metadata). */
const espaceLocataire = (): EtatEspace => {
  const espace = espaceDemo()
  return {
    statut: 'pret', espace: { ...espace, source: 'reel', vueSuperAdmin: false, profil: { ...espace.profil, role: 'locataire' } }, jeton: 'jeton',
    miseAJourLe: new Date('2026-11-04T14:05:00'), miseAJourImpossible: false,
  }
}

const ESPACE_QR = '/fr/aj-signalement/'
const menuLateral = () => screen.getAllByRole('navigation', { name: 'Menu' })[0]
const barreLaterale = () => screen.getByRole('complementary', { name: 'Menu' })
const boutonsMenu = () => within(menuLateral()).getAllByRole('button').map((b) => b.textContent)
const ouvrirPlus = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Plus' }))
  return screen.getByRole('dialog')
}

beforeEach(() => {
  localStorage.clear()
  h.etat = espaceReel(true)
  h.metadonnees = { role: 'super_admin' }
  window.history.replaceState(null, '', '/coproprietaire/dashboard')
  window.location.hash = ''
})

describe('AJ Signalement hors du portail copropriétaire', () => {
  it('super admin : aucun écran « AJ Signalement », les huit écrans de tous ; lien vers l’espace dans la barre latérale', () => {
    render(<Page />)
    expect(boutonsMenu()).not.toContain('AJ Signalement')
    expect(boutonsMenu()).toHaveLength(8)
    expect(within(barreLaterale()).getByRole('link', { name: 'AJ Signalement' })).toHaveAttribute('href', ESPACE_QR)
    // Le lien s'ajoute à « Panneau admin », qui ne change pas.
    expect(within(barreLaterale()).getByRole('link', { name: 'Panneau admin' })).toHaveAttribute('href', '/admin/dashboard')
  })

  it('super admin : l’ancre #signalementsQr (anciens e-mails) ramène à l’accueil', () => {
    window.location.hash = '#signalementsQr'
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Accueil')
    expect(screen.queryByText('Signalements reçus par QR code : copropriétés, affiches, coordonnées des déclarants')).toBeNull()
  })

  it('menu « Plus » du téléphone : le lien vers l’espace, et aucun bouton d’écran « AJ Signalement »', () => {
    render(<Page />)
    const dialogue = ouvrirPlus()
    expect(within(dialogue).queryByRole('button', { name: 'AJ Signalement' })).toBeNull()
    expect(within(dialogue).getByRole('link', { name: 'AJ Signalement' })).toHaveAttribute('href', ESPACE_QR)
  })

  it('« vue en tant que » ouverte par un super admin : pas de lien (l’espace la refuse depuis le 11/11/2026, comme les routes)', () => {
    h.metadonnees = { role: 'coproprio', _original_role: 'super_admin' }
    render(<Page />)
    expect(within(barreLaterale()).queryByRole('link', { name: 'AJ Signalement' })).toBeNull()
  })

  it('copropriétaire : ni lien, ni écran ; ses huit écrans ; l’ancre #signalementsQr ramène à l’accueil', () => {
    h.metadonnees = { role: 'coproprio' }
    h.etat = espaceReel(false)
    window.location.hash = '#signalementsQr'
    render(<Page />)
    expect(screen.queryByRole('link', { name: 'AJ Signalement' })).toBeNull()
    expect(boutonsMenu()).not.toContain('AJ Signalement')
    expect(boutonsMenu()).toHaveLength(8)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Accueil')
    expect(within(ouvrirPlus()).queryByRole('link', { name: 'AJ Signalement' })).toBeNull()
  })

  it('locataire (espace de locataire) : ni lien, ni écran ; ses six écrans, sans Charges ni Assemblées ; #signalementsQr ramène à l’accueil', () => {
    h.metadonnees = { role: 'locataire' }
    h.etat = espaceLocataire()
    window.location.hash = '#signalementsQr'
    render(<Page />)
    expect(screen.queryByRole('link', { name: 'AJ Signalement' })).toBeNull()
    expect(boutonsMenu()).toHaveLength(6)
    expect(boutonsMenu()).not.toContain('AJ Signalement')
    expect(boutonsMenu()).not.toContain('Charges & paiements')
    expect(boutonsMenu()).not.toContain('Assemblées & votes')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Accueil')
    expect(within(ouvrirPlus()).queryByRole('link', { name: 'AJ Signalement' })).toBeNull()
  })
})
