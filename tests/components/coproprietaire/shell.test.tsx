// tests/components/coproprietaire/shell.test.tsx
//
// app/(commun)/coproprietaire/dashboard/page.tsx — la coquille du portail : navigation (barre latérale,
// barre du bas, menu « Plus », ancre de l'URL), bandeau de démonstration, écrans réservés au
// propriétaire masqués pour un locataire, pages d'accès (session expirée, espace non activé, rôle
// interdit, erreur), bouton « Signaler un problème » dans l'en-tête. Les écrans sont remplacés par
// un composant témoin qui affiche les props reçues ; le chargement de l'espace est simulé.

import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { espaceDemo } from '@/lib/coproprietaire/demo'
import type { EtatEspace } from '@/lib/coproprietaire/etat'

const h = vi.hoisted(() => ({
  etat: { statut: 'chargement' } as EtatEspace,
  rafraichir: vi.fn(async () => undefined),
  changerLot: vi.fn(async () => undefined),
  seDeconnecter: vi.fn(async () => undefined),
  metadonnees: null as Record<string, unknown> | null,
}))

vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr' }))
vi.mock('@/lib/coproprietaire/etat', () => ({
  useEspaceCopro: () => ({ etat: h.etat, rafraichir: h.rafraichir, changerLot: h.changerLot, jeton: h.etat.statut === 'pret' ? h.etat.jeton : null, metadonnees: h.metadonnees }),
  seDeconnecter: h.seDeconnecter,
}))
// Chaque écran devient un témoin qui affiche la cible reçue et offre un bouton de navigation.
vi.mock('@/lib/dashboard-section-loader', () => ({
  createDynamicSection: (loader: () => Promise<unknown>) => {
    const nom = String(loader).match(/Ecran(\w+)/)?.[1] ?? 'Inconnu'
    const Temoin = (props: Record<string, unknown>) => (
      <div data-testid={`ecran-${nom.toLowerCase()}`}>
        <span data-testid="cible">{String(props.cible ?? '')}</span>
        <button type="button" onClick={() => (props.allerA as (e: string, c?: string) => void)('informations', 'lot:lot-2')}>changer de lot</button>
      </div>
    )
    return Temoin
  },
}))

const { default: Page } = await import('@/app/(commun)/coproprietaire/dashboard/page')

function pret(espace = espaceDemo(), jeton: string | null = null): Extract<EtatEspace, { statut: 'pret' }> {
  return { statut: 'pret', espace, jeton, miseAJourLe: new Date('2026-10-17T14:05:00'), miseAJourImpossible: false }
}

beforeEach(() => {
  h.etat = pret()
  h.metadonnees = null
  h.rafraichir.mockClear()
  h.changerLot.mockClear()
  h.seDeconnecter.mockClear()
  window.location.hash = ''
})

describe('coquille du portail', () => {
  it('affiche l’accueil, le bandeau de démonstration et les huit entrées de menu pour un propriétaire', () => {
    render(<Page />)
    expect(screen.getByTestId('ecran-accueil')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/démonstration/)
    const menu = screen.getAllByRole('navigation', { name: 'Menu' })[0]
    const libelles = within(menu).getAllByRole('button').map(b => b.textContent)
    expect(libelles).toEqual(['Accueil', 'Mes demandes', 'Charges & paiements', 'Documents', 'Assemblées & votes', 'Annonces', 'Mes informations', 'Poser une question'])
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Accueil')
  })

  it('navigue vers un écran depuis la barre latérale et met à jour l’ancre de l’URL', () => {
    render(<Page />)
    const menu = screen.getAllByRole('navigation', { name: 'Menu' })[0]
    fireEvent.click(within(menu).getByRole('button', { name: 'Charges & paiements' }))
    expect(screen.getByTestId('ecran-charges')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Charges & paiements')
    expect(window.location.hash).toBe('#charges')
  })

  it('le bouton « Signaler un problème » de l’en-tête ouvre le formulaire des demandes', () => {
    render(<Page />)
    fireEvent.click(screen.getAllByRole('button', { name: /Signaler un problème/ })[0])
    expect(screen.getByTestId('ecran-demandes')).toBeInTheDocument()
    expect(screen.getByTestId('cible')).toHaveTextContent('nouvelle')
    expect(window.location.hash).toBe('#demandes/nouvelle')
  })

  it('lit l’écran et la cible dans l’ancre à l’ouverture', () => {
    window.location.hash = '#assemblees'
    render(<Page />)
    expect(screen.getByTestId('ecran-assemblees')).toBeInTheDocument()
  })

  it('locataire : pas de Charges ni d’Assemblées, retour à l’accueil si l’ancre vise un écran réservé', () => {
    const espace = espaceDemo()
    h.etat = pret({ ...espace, profil: { ...espace.profil, role: 'locataire' } })
    window.location.hash = '#charges'
    render(<Page />)
    const menu = screen.getAllByRole('navigation', { name: 'Menu' })[0]
    const libelles = within(menu).getAllByRole('button').map(b => b.textContent)
    expect(libelles).not.toContain('Charges & paiements')
    expect(libelles).not.toContain('Assemblées & votes')
    expect(screen.getByTestId('ecran-accueil')).toBeInTheDocument()
  })

  it('le menu « Plus » (téléphone) liste les écrans restants et la déconnexion avec confirmation', () => {
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'Plus' }))
    const dialogue = screen.getByRole('dialog')
    expect(within(dialogue).getByRole('button', { name: /Annonces/ })).toBeInTheDocument()
    expect(within(dialogue).getByRole('button', { name: /Poser une question/ })).toBeInTheDocument()
    fireEvent.click(within(dialogue).getByRole('button', { name: /Déconnexion/ }))
    const confirmation = screen.getByRole('dialog')
    expect(confirmation).toHaveTextContent('Vous allez être déconnecté.')
    fireEvent.click(within(confirmation).getByRole('button', { name: /Me déconnecter/ }))
    expect(h.seDeconnecter).toHaveBeenCalledTimes(1)
  })

  it('une fenêtre se ferme au clic sur le fond, pas au clic dans la fenêtre', () => {
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'Plus' }))
    const dialogue = screen.getByRole('dialog')
    fireEvent.mouseDown(within(dialogue).getByRole('button', { name: /Annonces/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('un écran peut demander le changement de lot via la cible « lot: »', () => {
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'changer de lot' }))
    expect(h.changerLot).toHaveBeenCalledWith('lot-2')
  })

  it('super admin : bandeau nominatif et lien « Panneau admin » (/admin/exit en vue copropriétaire, /admin/dashboard sinon)', () => {
    h.etat = pret({ ...espaceDemo(), vueSuperAdmin: true }, 'jeton')
    h.metadonnees = { role: 'coproprio', _original_role: 'super_admin' }
    const { unmount } = render(<Page />)
    expect(screen.getByRole('status')).toHaveTextContent('vous voyez l’espace de Géraldine Xavier')
    expect(screen.getAllByRole('link', { name: /Panneau admin/ })[0]).toHaveAttribute('href', '/admin/exit')
    unmount()

    h.metadonnees = { role: 'super_admin' }
    render(<Page />)
    expect(screen.getAllByRole('link', { name: /Panneau admin/ })[0]).toHaveAttribute('href', '/admin/dashboard')
  })

  it('super admin sur une fiche réelle de son cabinet : bandeau « vue super admin », pas « démonstration »', () => {
    h.etat = pret({ ...espaceDemo(), source: 'reel', vueSuperAdmin: true }, 'jeton')
    h.metadonnees = { role: 'super_admin' }
    render(<Page />)
    expect(screen.getByRole('status')).toHaveTextContent('Vue super admin — vous voyez l’espace réel de Géraldine Xavier')
    expect(screen.queryByText(/Démonstration/)).toBeNull()
  })

  it('vrai copropriétaire : aucun lien « Panneau admin », aucun bandeau de démonstration', () => {
    h.etat = pret({ ...espaceDemo(), source: 'reel' }, 'jeton')
    h.metadonnees = { role: 'coproprio' }
    render(<Page />)
    expect(screen.queryByRole('link', { name: /Panneau admin/ })).toBeNull()
    expect(screen.queryByText(/démonstration/)).toBeNull()
  })

  it('mise à jour impossible : les données restent avec la mention horodatée', () => {
    h.etat = { ...pret(), miseAJourImpossible: true }
    render(<Page />)
    expect(screen.getByText(/mise à jour impossible/)).toBeInTheDocument()
    expect(screen.getByTestId('ecran-accueil')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Mettre à jour/ }))
    expect(h.rafraichir).toHaveBeenCalledTimes(1)
  })

  it('pages d’accès : session expirée, espace non activé, rôle interdit, erreur réseau, chargement', () => {
    h.etat = { statut: 'non_authentifie' }
    const { unmount } = render(<Page />)
    expect(screen.getByRole('link', { name: /Me reconnecter/ })).toHaveAttribute('href', '/auth/login')
    unmount()

    h.etat = { statut: 'non_active', code: 'acces_non_active', email: 'geraldine.xavier@email.com' }
    const r2 = render(<Page />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Votre espace n’est pas encore activé')
    expect(screen.getByText(/geraldine.xavier@email.com/)).toBeInTheDocument()
    expect(screen.queryByText(/855/)).toBeNull()
    r2.unmount()

    h.etat = { statut: 'role_interdit' }
    const r3 = render(<Page />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('réservé aux copropriétaires')
    r3.unmount()

    h.etat = { statut: 'erreur', code: 'reseau' }
    const r4 = render(<Page />)
    expect(screen.getByRole('alert')).toHaveTextContent('Vérifiez votre connexion internet')
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeInTheDocument()
    r4.unmount()

    h.etat = { statut: 'chargement' }
    render(<Page />)
    expect(screen.getByRole('status')).toHaveTextContent('Chargement de votre espace')
  })
})
