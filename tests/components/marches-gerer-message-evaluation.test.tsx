// tests/components/marches-gerer-message-evaluation.test.tsx
//
// Page publique de gestion d'un appel d'offres (/fr/marches/gerer, /pt/mercados/gerir), utilisée par le donneur
// d'ordre avec sa clé de gestion. Relecture adverse du 16/11/2026 :
//   - un message au candidat partait sans sender_name, que POST /api/marches/[id]/messages exige : la route répondait
//     400 et le message (avec la notification « nouveau message » du candidat) n'était jamais enregistré ;
//   - le commentaire de l'évaluation partait sous le nom comment, alors que POST /api/marches/[id]/evaluation lit
//     commentaire (texte facultatif, sans null) : le commentaire était perdu.

import React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const MARCHE = '44444444-4444-4444-8444-444444444444'
const CANDIDATURE = '55555555-5555-4555-8555-555555555555'
const CLE = 'cle-de-gestion'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(`id=${MARCHE}&token=${CLE}`),
}))

import GererMarcheClient from '@/app/fr/marches/gerer/GererMarcheClient'

type Envoi = { url: string; corps: Record<string, unknown> }
let envois: Envoi[] = []

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  envois = []
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const adresse = String(url)
    if (options?.method === 'POST') {
      envois.push({ url: adresse, corps: JSON.parse(String(options.body)) })
      return json({ ok: true }, 201)
    }
    if (adresse.startsWith(`/api/marches/${MARCHE}/messages`)) return json({ messages: [] })
    return json({
      is_publisher: true,
      marche: {
        id: MARCHE, title: 'Ravalement de façade', description: 'Façade sur rue', category: 'facade',
        location_city: 'Marseille', budget_min: 10000, budget_max: 20000, deadline: '2099-12-31', urgency: 'normal',
        status: 'awarded', candidatures_count: 1, max_candidatures: 3, require_rc_pro: false, require_decennale: false,
        require_rge: false, require_qualibat: false, preferred_work_mode: null, created_at: '2026-11-16T10:00:00Z',
        publisher_name: 'Syndic des Tilleuls', photos: [],
      },
      candidatures: [{
        id: CANDIDATURE, marche_id: MARCHE, artisan_id: '33333333-3333-4333-8333-333333333333',
        artisan_company_name: 'Bâtiment du Banc SARL', price: 15000, timeline: '1_mois',
        description: 'Échafaudage et ravalement complet.', materials_included: true, guarantee: null,
        status: 'accepted', created_at: '2026-11-16T11:00:00Z',
      }],
    })
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

const envoisVers = (fin: string) => envois.filter(e => e.url === `/api/marches/${MARCHE}/${fin}`)

describe('Gestion d’un appel d’offres — écrire au candidat et l’évaluer', () => {
  it('un message au candidat part avec le nom du donneur d’ordre (sender_name), que la route exige', async () => {
    render(<GererMarcheClient isPt={false} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Envoyer un message' }))
    fireEvent.change(screen.getByPlaceholderText('Votre message...'), { target: { value: 'Pouvez-vous commencer lundi ?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    await vi.waitFor(() => expect(envoisVers('messages')).toHaveLength(1))
    expect(envoisVers('messages')[0].corps).toEqual({
      candidature_id: CANDIDATURE, sender_type: 'publisher', sender_name: 'Syndic des Tilleuls', access_token: CLE,
      content: 'Pouvez-vous commencer lundi ?',
    })
  })

  it('le commentaire de l’évaluation part sous le nom que lit la route (commentaire)', async () => {
    render(<GererMarcheClient isPt={false} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Évaluer cet artisan' }))
    fireEvent.click(screen.getAllByRole('button', { name: '★' })[3])
    fireEvent.change(screen.getByPlaceholderText('Commentaire (optionnel)...'), { target: { value: 'Chantier propre, délais tenus.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    await vi.waitFor(() => expect(envoisVers('evaluation')).toHaveLength(1))
    expect(envoisVers('evaluation')[0].corps).toEqual({
      candidature_id: CANDIDATURE, access_token: CLE, evaluator_type: 'publisher', note_globale: 4,
      commentaire: 'Chantier propre, délais tenus.',
    })
  })

  it('évaluation sans commentaire : aucun commentaire n’est envoyé (la route refuse un commentaire null)', async () => {
    render(<GererMarcheClient isPt={false} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Évaluer cet artisan' }))
    fireEvent.click(screen.getAllByRole('button', { name: '★' })[4])
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    await vi.waitFor(() => expect(envoisVers('evaluation')).toHaveLength(1))
    expect(envoisVers('evaluation')[0].corps).toEqual({
      candidature_id: CANDIDATURE, access_token: CLE, evaluator_type: 'publisher', note_globale: 5,
    })
  })
})
