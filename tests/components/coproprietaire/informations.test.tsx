// tests/components/coproprietaire/informations.test.tsx
//
// Écran « Mes informations » du portail copropriétaire (EcranInformations) :
// - carte du lot (tantièmes avec pourcentage), autres lots avec « Changer de lot » ;
// - coordonnées en lecture seule (« non renseigné » si vide) et phrase « information inexacte ? » ;
// - carte du syndic : liens tel: / mailto:, gestionnaire, adresse ; phrase dédiée si vide ;
// - langue : cookie `locale` puis rechargement ;
// - déconnexion : modale de confirmation, puis seDeconnecter() ; « Rester » ferme sans appel ;
// - locataire : « Votre logement », note dédiée, pas de tantièmes.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

vi.mock('@/lib/coproprietaire/etat', () => ({ seDeconnecter: vi.fn(async () => {}) }))

import EcranInformations from '@/components/coproprietaire-dashboard/ecrans/EcranInformations'
import type { PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { espaceDemo } from '@/lib/coproprietaire/demo'
import { textesCopro } from '@/lib/coproprietaire/textes'
import { seDeconnecter } from '@/lib/coproprietaire/etat'
import type { EspaceCopro } from '@/lib/coproprietaire/types'

const t = textesCopro('fr')

function props(espace: EspaceCopro = espaceDemo(), surcharge: Partial<PropsEcran> = {}): PropsEcran {
  return {
    espace,
    t,
    langue: 'fr',
    jeton: null,
    allerA: vi.fn(),
    rafraichir: vi.fn(async () => {}),
    miseAJourLe: new Date('2026-10-17T09:00:00+02:00'),
    ...surcharge,
  }
}

function carte(titre: string): HTMLElement {
  const h = screen.getByRole('heading', { level: 2, name: titre })
  const section = h.closest('section')
  if (!section) throw new Error(`Carte « ${titre} » introuvable`)
  return section
}

beforeEach(() => {
  vi.mocked(seDeconnecter).mockClear()
})

describe('EcranInformations — votre lot', () => {
  it('affiche l’immeuble, la situation du lot et les tantièmes avec le pourcentage', () => {
    render(<EcranInformations {...props()} />)
    const lot = carte(t.informations.votreLot)
    expect(within(lot).getByText('Résidence Le Prado')).toBeInTheDocument()
    expect(within(lot).getByText('bâtiment D · étage 4 · lot 12')).toBeInTheDocument()
    expect(within(lot).getByText('450 tantièmes (4,5 % des charges)')).toBeInTheDocument()
    expect(screen.queryByText(t.informations.votreLogement)).not.toBeInTheDocument()
    expect(screen.queryByText(t.informations.changerLot)).not.toBeInTheDocument()
  })

  it('affiche les tantièmes sans pourcentage quand la quote-part est inconnue', () => {
    const espace = espaceDemo()
    espace.profil.quotePart = 0
    render(<EcranInformations {...props(espace)} />)
    expect(screen.getByText('450 tantièmes')).toBeInTheDocument()
    expect(screen.queryByText(/des charges/)).not.toBeInTheDocument()
  })

  it('n’affiche pas de tantièmes quand le syndic ne les a pas saisis', () => {
    const espace = espaceDemo()
    espace.profil.tantiemes = 0
    render(<EcranInformations {...props(espace)} />)
    expect(screen.queryByText(/tantièmes/)).not.toBeInTheDocument()
  })

  it('liste les autres lots et propose de changer de lot', () => {
    const espace = espaceDemo()
    espace.autresLots = [
      { id: 'lot-b', immeuble: 'Résidence Le Prado', batiment: 'B', etage: '2', numLot: '7' },
      { id: 'lot-c', immeuble: 'Les Terrasses du Roucas', batiment: '', etage: '', numLot: '3' },
    ]
    const allerA = vi.fn()
    render(<EcranInformations {...props(espace, { allerA })} />)

    expect(screen.getByText('Vos autres lots')).toBeInTheDocument()
    expect(screen.getByText('· bâtiment B · étage 2 · lot 7')).toBeInTheDocument()
    expect(screen.getByText('Les Terrasses du Roucas')).toBeInTheDocument()
    expect(screen.getByText('· lot 3')).toBeInTheDocument()

    const boutons = screen.getAllByRole('button', { name: t.informations.changerLot })
    expect(boutons).toHaveLength(2)
    fireEvent.click(boutons[1])
    expect(allerA).toHaveBeenCalledWith('informations', 'lot:lot-c')
  })
})

describe('EcranInformations — coordonnées', () => {
  it('affiche nom, e-mail et téléphone en lecture seule avec la phrase « inexact »', () => {
    render(<EcranInformations {...props()} />)
    const coord = carte(t.informations.coordonnees)
    expect(within(coord).getByText('Géraldine Xavier')).toBeInTheDocument()
    expect(within(coord).getByText('geraldine.xavier@email.com')).toBeInTheDocument()
    expect(within(coord).getByText('06 12 34 56 78')).toBeInTheDocument()
    expect(within(coord).getByText(t.informations.inexact)).toBeInTheDocument()
    expect(within(coord).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('écrit « non renseigné » quand une coordonnée manque', () => {
    const espace = espaceDemo()
    espace.profil.telephone = ''
    render(<EcranInformations {...props(espace)} />)
    const coord = carte(t.informations.coordonnees)
    expect(within(coord).getByText(t.informations.nonRenseigne)).toBeInTheDocument()
  })
})

describe('EcranInformations — votre syndic', () => {
  it('affiche le cabinet, le gestionnaire, les liens téléphone et e-mail et l’adresse', () => {
    render(<EcranInformations {...props()} />)
    const syndic = carte(t.informations.votreSyndic)
    expect(within(syndic).getByText('Cabinet Dupont')).toBeInTheDocument()
    expect(within(syndic).getByText('Gestionnaire de l’immeuble : Hugo Carvalho')).toBeInTheDocument()
    expect(within(syndic).getByRole('link', { name: '04 91 00 00 00' })).toHaveAttribute('href', 'tel:0491000000')
    expect(within(syndic).getByRole('link', { name: 'contact@cabinet-dupont.fr' })).toHaveAttribute('href', 'mailto:contact@cabinet-dupont.fr')
    expect(within(syndic).getByText('45 avenue du Prado, 13008 Marseille')).toBeInTheDocument()
    expect(within(syndic).queryByText(t.informations.syndicInconnu)).not.toBeInTheDocument()
  })

  it('affiche la phrase dédiée quand les coordonnées du syndic sont vides', () => {
    const espace = espaceDemo()
    espace.syndic = { nom: '', adresse: '', ville: '', codePostal: '', telephone: '', email: '' }
    render(<EcranInformations {...props(espace)} />)
    const syndic = carte(t.informations.votreSyndic)
    expect(within(syndic).getByText(t.informations.syndicInconnu)).toBeInTheDocument()
    expect(within(syndic).queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('EcranInformations — langue', () => {
  it('pose le cookie locale puis ouvre l’adresse du portail dans la langue choisie', () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, hash: '#informations', assign })
    try {
      render(<EcranInformations {...props()} />)
      const fr = screen.getByRole('button', { name: t.informations.francais })
      const pt = screen.getByRole('button', { name: t.informations.portugais })
      expect(fr).toHaveAttribute('aria-pressed', 'true')
      expect(pt).toHaveAttribute('aria-pressed', 'false')

      fireEvent.click(pt)
      expect(document.cookie).toContain('locale=pt')
      expect(assign).toHaveBeenCalledWith('/pt/coproprietaire/dashboard/#informations')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('EcranInformations — déconnexion', () => {
  it('demande confirmation puis appelle seDeconnecter', () => {
    render(<EcranInformations {...props()} />)
    expect(seDeconnecter).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: t.informations.meDeconnecter }))
    const modale = screen.getByRole('dialog')
    expect(within(modale).getByText(t.informations.confirmationDeconnexion)).toBeInTheDocument()
    expect(seDeconnecter).not.toHaveBeenCalled()

    fireEvent.click(within(modale).getByRole('button', { name: t.informations.meDeconnecter }))
    expect(seDeconnecter).toHaveBeenCalledTimes(1)
  })

  it('« Rester » ferme la modale sans se déconnecter', () => {
    render(<EcranInformations {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: t.informations.meDeconnecter }))
    const modale = screen.getByRole('dialog')
    fireEvent.click(within(modale).getByRole('button', { name: t.informations.rester }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(seDeconnecter).not.toHaveBeenCalled()
  })
})

describe('EcranInformations — locataire', () => {
  it('parle de « votre logement », affiche la note et aucun tantième', () => {
    const espace = espaceDemo()
    espace.profil.role = 'locataire'
    render(<EcranInformations {...props(espace)} />)
    expect(screen.getByRole('heading', { level: 2, name: t.informations.votreLogement })).toBeInTheDocument()
    expect(screen.queryByText(t.informations.votreLot)).not.toBeInTheDocument()
    expect(screen.getByText(t.informations.locataireNote)).toBeInTheDocument()
    expect(screen.queryByText(/tantièmes/)).not.toBeInTheDocument()
    expect(screen.getByText('bâtiment D · étage 4 · lot 12')).toBeInTheDocument()
  })

  it('ne montre pas la note du locataire à un propriétaire', () => {
    render(<EcranInformations {...props()} />)
    expect(screen.queryByText(t.informations.locataireNote)).not.toBeInTheDocument()
  })
})
