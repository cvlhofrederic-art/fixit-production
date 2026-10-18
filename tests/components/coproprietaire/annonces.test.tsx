// tests/components/coproprietaire/annonces.test.tsx
//
// Écran « Annonces » du portail copropriétaire (EcranAnnonces) :
// - épinglées d'abord, puis les plus récentes ;
// - cartes complètes : badges Urgent / Important, catégorie en mots, texte entier,
//   « Publié le … par votre syndic », mention « tous les immeubles » quand l'immeuble est vide ;
// - préférence facultative « déjà vue » (localStorage, sous try/catch) ;
// - état vide.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import EcranAnnonces, { trierAnnonces } from '@/components/coproprietaire-dashboard/ecrans/EcranAnnonces'
import { CLES_PREFERENCES, type PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { espaceDemo } from '@/lib/coproprietaire/demo'
import { textesCopro } from '@/lib/coproprietaire/textes'
import type { EspaceCopro } from '@/lib/coproprietaire/types'

const t = textesCopro('fr')

function props(espace: EspaceCopro = espaceDemo()): PropsEcran {
  return {
    espace,
    t,
    langue: 'fr',
    jeton: null,
    allerA: vi.fn(),
    rafraichir: vi.fn(async () => {}),
    miseAJourLe: new Date('2026-10-17T09:00:00+02:00'),
  }
}

function titres(): string[] {
  return screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent ?? '')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EcranAnnonces — rendu avec les données de démonstration', () => {
  it('affiche l’annonce épinglée en premier, puis les plus récentes', () => {
    render(<EcranAnnonces {...props()} />)
    expect(titres()).toEqual([
      'Convocation — AG extraordinaire du 19 novembre',
      'Coupure d’eau froide — mardi 20 octobre',
      'Ravalement de la façade : calendrier des travaux',
      'Nouvelle gardienne',
    ])
    expect(screen.getByText(t.annonces.epinglee)).toBeInTheDocument()
  })

  it('trie une annonce épinglée ancienne avant une annonce récente non épinglée', () => {
    const [convocation, coupure, ravalement, gardienne] = espaceDemo().annonces
    const ordre = trierAnnonces([coupure, { ...gardienne, epinglee: true }, convocation, ravalement]).map(a => a.id)
    expect(ordre).toEqual(['demo-ann-2', 'demo-ann-4', 'demo-ann-1', 'demo-ann-3'])
  })

  it('porte les badges Urgent et Important et la catégorie en mots', () => {
    render(<EcranAnnonces {...props()} />)
    const coupure = screen.getByRole('article', { name: 'Coupure d’eau froide — mardi 20 octobre' })
    expect(within(coupure).getByText(t.annonces.urgent)).toBeInTheDocument()
    expect(within(coupure).getByText('Travaux et entretien')).toBeInTheDocument()
    expect(within(coupure).queryByText(t.annonces.important)).not.toBeInTheDocument()

    const convocation = screen.getByRole('article', { name: 'Convocation — AG extraordinaire du 19 novembre' })
    expect(within(convocation).getByText(t.annonces.important)).toBeInTheDocument()
    expect(within(convocation).getByText('Assemblée')).toBeInTheDocument()

    const gardienne = screen.getByRole('article', { name: 'Nouvelle gardienne' })
    expect(within(gardienne).getByText('Vie de l’immeuble')).toBeInTheDocument()
    expect(within(gardienne).queryByText(t.annonces.urgent)).not.toBeInTheDocument()
    expect(within(gardienne).queryByText(t.annonces.important)).not.toBeInTheDocument()

    // Jamais la valeur brute de la base.
    expect(screen.queryByText('manutencao')).not.toBeInTheDocument()
    expect(screen.queryByText('assembleia')).not.toBeInTheDocument()
  })

  it('affiche le texte complet, la date en toutes lettres et la mention « tous les immeubles »', () => {
    const espace = espaceDemo()
    render(<EcranAnnonces {...props(espace)} />)
    for (const a of espace.annonces) {
      expect(screen.getByText(a.contenu)).toBeInTheDocument()
    }
    expect(screen.getByText('Publié le 5 octobre 2026 par votre syndic')).toBeInTheDocument()
    expect(screen.getByText('Publié le 8 octobre 2026 par votre syndic')).toBeInTheDocument()
    expect(screen.getByText('Publié le 25 août 2026 par votre syndic')).toBeInTheDocument()
    // Une seule annonce (la gardienne) vise tous les immeubles du cabinet.
    expect(screen.getAllByText(t.commun.tousImmeubles)).toHaveLength(1)
    const gardienne = screen.getByRole('article', { name: 'Nouvelle gardienne' })
    expect(within(gardienne).getByText(t.commun.tousImmeubles)).toBeInTheDocument()
  })

  it('respecte les sauts de ligne du contenu (whitespace-pre-line)', () => {
    const espace = espaceDemo()
    espace.annonces = [{ ...espace.annonces[0], contenu: 'Première ligne.\nSeconde ligne.' }]
    render(<EcranAnnonces {...props(espace)} />)
    const p = screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Première ligne.\nSeconde ligne.')
    expect(p.className).toContain('whitespace-pre-line')
  })
})

describe('EcranAnnonces — préférence « déjà vue »', () => {
  it('grise une annonce marquée comme vue et mémorise la préférence', () => {
    render(<EcranAnnonces {...props()} />)
    const gardienne = screen.getByRole('article', { name: 'Nouvelle gardienne' })
    fireEvent.click(within(gardienne).getByRole('button', { name: 'Marquer comme vue' }))

    expect(within(gardienne).getByText('Déjà vue')).toBeInTheDocument()
    expect(within(gardienne).getByRole('button', { name: 'Marquer comme non vue' })).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(localStorage.getItem(CLES_PREFERENCES.annoncesLues) ?? '[]')).toEqual(['demo-ann-4'])

    // Les autres annonces ne sont pas touchées.
    const coupure = screen.getByRole('article', { name: 'Coupure d’eau froide — mardi 20 octobre' })
    expect(within(coupure).queryByText('Déjà vue')).not.toBeInTheDocument()

    // Retour en arrière possible.
    fireEvent.click(within(gardienne).getByRole('button', { name: 'Marquer comme non vue' }))
    expect(within(gardienne).queryByText('Déjà vue')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(CLES_PREFERENCES.annoncesLues) ?? '[]')).toEqual([])
  })

  it('relit la préférence mémorisée au rendu', () => {
    localStorage.setItem(CLES_PREFERENCES.annoncesLues, JSON.stringify(['demo-ann-1']))
    render(<EcranAnnonces {...props()} />)
    const coupure = screen.getByRole('article', { name: 'Coupure d’eau froide — mardi 20 octobre' })
    expect(within(coupure).getByText('Déjà vue')).toBeInTheDocument()
    expect(screen.getAllByText('Déjà vue')).toHaveLength(1)
  })

  it('reste fonctionnel si le navigateur refuse localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('refusé') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('refusé') })
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<EcranAnnonces {...props()} />)
    expect(titres()).toHaveLength(4)
    const gardienne = screen.getByRole('article', { name: 'Nouvelle gardienne' })
    fireEvent.click(within(gardienne).getByRole('button', { name: 'Marquer comme vue' }))
    expect(within(gardienne).getByText('Déjà vue')).toBeInTheDocument()
  })

  it('ignore une préférence illisible', () => {
    localStorage.setItem(CLES_PREFERENCES.annoncesLues, '{pas du json')
    render(<EcranAnnonces {...props()} />)
    expect(screen.queryByText('Déjà vue')).not.toBeInTheDocument()
  })
})

describe('EcranAnnonces — état vide', () => {
  it('affiche la phrase d’état vide sans aucune carte', () => {
    const espace = espaceDemo()
    espace.annonces = []
    render(<EcranAnnonces {...props(espace)} />)
    expect(screen.getByText(t.annonces.aucune)).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })
})
