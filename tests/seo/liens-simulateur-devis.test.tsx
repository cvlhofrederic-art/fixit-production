// tests/seo/liens-simulateur-devis.test.tsx
//
// Simulateur de devis FR (app/fr/simulateur-devis/SimulateurDevisClient.tsx).
// - Les puces de ville sont des <a> bruts : sans barre finale, chaque lien
//   passe par le 308 de trailingSlash (/fr/simulateur-devis/marseille →
//   /fr/simulateur-devis/marseille/).
// - Le CTA « Voir les tarifs & Prendre rendez-vous » visait /artisan/<slug>
//   ou /recherche?loc=…, et « Voir tous les artisans VITFIX » /recherche… :
//   deux 308 (règle racine puis barre finale) avant la page FR. Sans ville
//   détectée, ce dernier produisait même /recherche&cat=… (chemin sans « ? »).
// La puce Toulon reste affichée : sa redirection vers le hub est voulue
// (next.config.ts, « Toulon not in supported FR_CITIES »).

import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import SimulateurDevisClient from '@/app/fr/simulateur-devis/SimulateurDevisClient'

const artisans = [
  {
    id: 'a-1', slug: 'plomberie-durand', company_name: 'Plomberie Durand', categories: ['plombier'],
    prices: [], source: 'registered',
  },
  {
    id: 'a-2', slug: null, company_name: 'Artisan sans slug', categories: ['plombier'],
    prices: [], source: 'registered',
  },
]

function simulerApi() {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ artisans }) }) as Response))
}

async function lancerRecherche(container: HTMLElement, besoin: string, ville: string) {
  fireEvent.change(container.querySelector('textarea') as HTMLTextAreaElement, { target: { value: besoin } })
  fireEvent.change(screen.getByPlaceholderText('Votre ville (ex: La Ciotat)'), { target: { value: ville } })
  fireEvent.click(screen.getByRole('button', { name: /Trouver/ }))
  await screen.findByText('Plomberie Durand')
}

function hrefsDuTexte(texte: RegExp): string[] {
  return screen.getAllByText(texte).map((el) => el.closest('a')?.getAttribute('href') ?? '')
}

describe('simulateur de devis FR : liens', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('les puces de ville visent /fr/simulateur-devis/<ville>/ (barre finale)', () => {
    const { container } = render(<SimulateurDevisClient />)
    const hrefs = Array.from(container.querySelectorAll('a[href^="/fr/simulateur-devis/"]'))
      .map((a) => a.getAttribute('href') ?? '')
    expect(hrefs.length).toBe(18)
    expect(hrefs.filter((href) => !/^\/fr\/simulateur-devis\/[a-z0-9-]+\/$/.test(href))).toEqual([])
    expect(hrefs).toContain('/fr/simulateur-devis/marseille/')
    // Toulon : puce conservée, une seule redirection (vers le hub)
    expect(hrefs).toContain('/fr/simulateur-devis/toulon/')
  })

  it('page ville : la puce de la ville courante est exclue, les autres gardent la barre finale', () => {
    const { container } = render(<SimulateurDevisClient initialCity="Aubagne" citySlug="aubagne" />)
    const hrefs = Array.from(container.querySelectorAll('a[href^="/fr/simulateur-devis/"]'))
      .map((a) => a.getAttribute('href') ?? '')
    expect(hrefs.length).toBe(17)
    expect(hrefs).not.toContain('/fr/simulateur-devis/aubagne/')
    expect(hrefs.every((href) => href.endsWith('/'))).toBe(true)
  })

  it('résultats avec ville : profil FR, recherche FR avec ville et métier', async () => {
    simulerApi()
    const { container } = render(<SimulateurDevisClient />)
    await lancerRecherche(container, "J'ai une fuite d'eau", 'Marseille')
    expect(hrefsDuTexte(/Voir les tarifs & Prendre rendez-vous/)).toEqual([
      '/fr/artisan/plomberie-durand/',
      '/fr/recherche/?loc=Marseille',
    ])
    expect(hrefsDuTexte(/Voir tous les artisans VITFIX/)).toEqual(['/fr/recherche/?loc=Marseille&cat=plombier'])
  })

  it('résultats sans ville : URL de recherche bien formée (« ? » avant cat)', async () => {
    simulerApi()
    const { container } = render(<SimulateurDevisClient />)
    await lancerRecherche(container, "J'ai une fuite d'eau", '')
    expect(hrefsDuTexte(/Voir les tarifs & Prendre rendez-vous/)).toEqual([
      '/fr/artisan/plomberie-durand/',
      '/fr/recherche/',
    ])
    expect(hrefsDuTexte(/Voir tous les artisans VITFIX/)).toEqual(['/fr/recherche/?cat=plombier'])
  })
})
