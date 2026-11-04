// tests/components/coproprietaire/shell-liaison-aj.test.tsx
//
// Portail copropriétaire, vue super admin reliée à l'Administrateur judiciaire : barre du haut (source des données,
// copropriété, copropriétaire), espace tiré des données de l'AJ, copropriété partagée avec le sélecteur de l'AJ
// (même clé, suivie d'un onglet à l'autre), lien direct depuis l'AJ, actions transmises par la liaison.

import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { espaceDemo } from '@/lib/coproprietaire/demo'
import type { EtatEspace } from '@/lib/coproprietaire/etat'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { lireLiaison } from '@/lib/liaison-copro-aj/stockage'

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
// Chaque écran devient un témoin des props reçues ; « déposer » simule le formulaire de signalement relié.
vi.mock('@/lib/dashboard-section-loader', () => ({
  createDynamicSection: () => {
    const Temoin = (props: PropsEcran) => (
      <div data-testid="ecran">
        <span data-testid="personne">{`${props.espace.profil.prenom} ${props.espace.profil.nom}`.trim()}</span>
        <span data-testid="source">{props.espace.source}</span>
        <span data-testid="jeton">{String(props.jeton)}</span>
        <span data-testid="jour">{props.aujourdhui ? props.aujourdhui.toISOString().slice(0, 10) : 'maintenant'}</span>
        <span data-testid="demandes">{props.espace.interventions.mesDemandes.length}</span>
        {props.liaisonAj && (
          <button type="button" onClick={() => props.liaisonAj?.deposerDemande({ type: 'Plomberie', description: 'Fuite sous l’évier', priorite: 'urgente', partieCommune: false, zone: '' })}>
            déposer
          </button>
        )}
      </div>
    )
    return Temoin
  },
}))

const { default: Page } = await import('@/app/(commun)/coproprietaire/dashboard/page')

/** Le module de l'AJ est chargé à la demande (import dynamique) : le premier chargement dépasse le délai par défaut. */
const attendre = (assertion: () => void) => waitFor(assertion, { timeout: 20000 })

const syndic = (): EtatEspace => ({
  statut: 'pret', espace: { ...espaceDemo(), source: 'reel', vueSuperAdmin: true }, jeton: 'jeton',
  miseAJourLe: new Date('2026-10-17T14:05:00'), miseAJourImpossible: false,
})

beforeEach(() => {
  localStorage.clear()
  h.etat = syndic()
  h.metadonnees = { role: 'super_admin' }
  window.history.replaceState(null, '', '/coproprietaire/dashboard')
  window.location.hash = ''
})

describe('portail relié à l’Administrateur judiciaire (super admin)', () => {
  it('par défaut, la base du syndic ; la barre propose l’AJ', () => {
    render(<Page />)
    expect(screen.getByTestId('source')).toHaveTextContent('reel')
    expect(screen.getByRole('button', { name: 'Syndic' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Administrateur judiciaire' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByLabelText('Copropriété')).toBeNull()
  })

  it('un compte qui n’est pas super admin n’a pas la barre', () => {
    h.metadonnees = { role: 'coproprio' }
    render(<Page />)
    expect(screen.queryByRole('button', { name: 'Administrateur judiciaire' })).toBeNull()
  })

  it('avec l’AJ : espace du premier copropriétaire de la copropriété choisie, au jour de l’AJ, sans jeton', async () => {
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'Administrateur judiciaire' }))
    await attendre(() => expect(screen.getByTestId('source')).toHaveTextContent('aj'))
    expect(screen.getByTestId('personne')).toHaveTextContent('Laurent Mercier')
    expect(screen.getByTestId('jeton')).toHaveTextContent('null')
    expect(screen.getByTestId('jour')).toHaveTextContent('2026-06-04')
    expect(screen.getByRole('status')).toHaveTextContent('démonstration reliée à l’Administrateur judiciaire : espace de Laurent Mercier (Résidence Le Méridien, lot 12)')
    expect(localStorage.getItem('vitfix.liaison.copro-aj.source')).toBe('aj')
  })

  it('changer de copropriété la choisit aussi dans l’AJ (même clé) et affiche son premier copropriétaire', async () => {
    localStorage.setItem('vitfix.liaison.copro-aj.source', 'aj')
    render(<Page />)
    const copro = await screen.findByLabelText('Copropriété', undefined, { timeout: 20000 })
    await attendre(() => expect((copro as HTMLSelectElement).value).toBe('LM'))
    fireEvent.change(copro, { target: { value: 'CV' } })
    await attendre(() => expect(screen.getByTestId('personne')).toHaveTextContent('Sophie Garnier'))
    expect(localStorage.getItem('vitfix.aj.dossierEnCours')).toBe('"CV"')
    fireEvent.change(screen.getByLabelText('Copropriétaire'), { target: { value: 'P3' } })
    await attendre(() => expect(screen.getByTestId('personne')).toHaveTextContent('Karim Benali'))
  })

  it('la copropriété choisie dans l’AJ (autre onglet) est suivie', async () => {
    localStorage.setItem('vitfix.liaison.copro-aj.source', 'aj')
    render(<Page />)
    await attendre(() => expect(screen.getByTestId('personne')).toHaveTextContent('Laurent Mercier'))
    act(() => {
      localStorage.setItem('vitfix.aj.dossierEnCours', JSON.stringify('VM'))
      window.dispatchEvent(new StorageEvent('storage', { key: 'vitfix.aj.dossierEnCours' }))
    })
    await attendre(() => expect(screen.getByTestId('personne')).toHaveTextContent('Hélène Dubois'))
  })

  it('lien direct depuis l’AJ (?aj=TL&personne=P7) : source AJ et copropriétaire voulu', async () => {
    window.history.replaceState(null, '', '/coproprietaire/dashboard?aj=TL&personne=P7')
    render(<Page />)
    await attendre(() => expect(screen.getByTestId('personne')).toHaveTextContent('Antoine Rousseau'))
    expect(screen.getByTestId('source')).toHaveTextContent('aj')
    // Paramètres mémorisés comme des choix de la barre, puis retirés de l'adresse : un rechargement garde la vue reliée.
    expect(window.location.search).toBe('')
    expect(localStorage.getItem('vitfix.liaison.copro-aj.source')).toBe('aj')
    expect(localStorage.getItem('vitfix.aj.dossierEnCours')).toBe('"TL"')
    expect(JSON.parse(localStorage.getItem('vitfix.liaison.copro-aj.personne') ?? '[]')).toEqual([['TL', 'P7']])
  })

  it('une demande déposée sur le portail arrive dans la liaison et revient dans « Mes demandes » en direct', async () => {
    localStorage.setItem('vitfix.liaison.copro-aj.source', 'aj')
    render(<Page />)
    await attendre(() => expect(screen.getByTestId('demandes')).toHaveTextContent('0'))
    fireEvent.click(screen.getByRole('button', { name: 'déposer' }))
    await attendre(() => expect(screen.getByTestId('demandes')).toHaveTextContent('1'))
    expect(lireLiaison().demandes[0]).toMatchObject({ codeCopro: 'LM', coproprietaireId: 'P1', nomCoproprietaire: 'Laurent Mercier', type: 'Plomberie', statut: 'en_attente' })
  })

  it('retour au syndic : l’espace réel revient', async () => {
    localStorage.setItem('vitfix.liaison.copro-aj.source', 'aj')
    render(<Page />)
    await attendre(() => expect(screen.getByTestId('source')).toHaveTextContent('aj'))
    fireEvent.click(screen.getByRole('button', { name: 'Syndic' }))
    await attendre(() => expect(screen.getByTestId('source')).toHaveTextContent('reel'))
    expect(screen.getByTestId('jeton')).toHaveTextContent('jeton')
  })
})
