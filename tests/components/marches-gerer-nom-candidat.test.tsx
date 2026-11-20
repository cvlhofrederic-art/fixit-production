// tests/components/marches-gerer-nom-candidat.test.tsx
//
// Page publique de gestion d'un appel d'offres (/fr/marches/gerer, /pt/mercados/gerir) : le publieur voit le nom de
// l'entreprise qui a candidaté. La page lisait une colonne qui n'existe pas dans marches_candidatures (artisan_name) ;
// le nom enregistré par la candidature est dans artisan_company_name (relevé de production du 11/11/2026).

import React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const MARCHE = '44444444-4444-4444-8444-444444444444'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(`id=${MARCHE}&token=cle-de-gestion`),
}))

import GererMarcheClient from '@/app/fr/marches/gerer/GererMarcheClient'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    is_publisher: true,
    marche: {
      id: MARCHE, title: 'Ravalement de façade', description: 'Façade sur rue', category: 'facade',
      location_city: 'Marseille', budget_min: 10000, budget_max: 20000, deadline: '2099-12-31', urgency: 'normal',
      status: 'open', candidatures_count: 1, max_candidatures: 3, require_rc_pro: false, require_decennale: false,
      require_rge: false, require_qualibat: false, preferred_work_mode: null, created_at: '2026-11-16T10:00:00Z',
      publisher_name: 'Syndic', photos: [],
    },
    candidatures: [{
      id: 'c1', marche_id: MARCHE, artisan_id: '33333333-3333-4333-8333-333333333333',
      artisan_company_name: 'Bâtiment du Banc SARL', price: 15000, timeline: '1_mois',
      description: 'Échafaudage et ravalement complet.', materials_included: true, guarantee: null,
      status: 'pending', created_at: '2026-11-16T11:00:00Z',
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('Gestion d’un appel d’offres — candidatures reçues', () => {
  it('le nom de l’entreprise candidate s’affiche', async () => {
    render(<GererMarcheClient isPt={false} />)
    expect(await screen.findByText('Bâtiment du Banc SARL')).toBeInTheDocument()
  })
})
