// tests/components/pointage-geo-enregistrement.test.tsx — écran Pointage du BTP pro : ce qui part vers /api/btp
// (constat donnees-btp-6 de l'audit du 11/11/2026), avec le vrai hook useBTPData.
//
// Avant : un pointage manuel ne gardait le chantier et le salarié que sous forme de texte. Maintenant : le salarié et le
// chantier choisis partent avec leurs identifiants (membre_id, chantier_id).
//
// Réunion avec le pointage géolocalisé (PR #703, 17/11/2026) : l'écran a été réécrit. La saisie à la main est dans
// l'onglet Historique du gérant ; l'ancien bouton « Pointer sur … » (pointage GPS envoyé par /api/btp) n'existe plus, le
// pointage automatique passe par /api/btp/pointage, qui garde le départ vide jusqu'à la sortie du chantier (testé dans
// tests/api/btp-pointage.test.ts). Un départ vidé à la main part à 17:00, comme en production (choix de produit en
// attente : vide, le pointage serait « en cours » et l'index unique de la migration 20261116 refuserait le suivant).
// Aucune donnée réelle.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Artisan } from '@/lib/types'
import type { ContextePointage } from '@/lib/btp/pointage-regles'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr', useTranslation: () => ({ t: (cle: string) => cle }) }))

import { PointageGeoSection } from '@/components/dashboard/PointageGeoSection'

const CHANTIER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const MEMBRE = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'

/** Gérant sans fiche employé : onglets Pointer, Affectations et Historique. */
const CONTEXTE_GERANT: ContextePointage = {
  gerant: true, rattachement: 'aucun', moi: null, chantiers: [], pointageEnCours: null, pointagesOublies: [], historique: [],
  pointageAutoActive: false, reglageDisponible: true, comptes: {}, affectationIndividuelle: true,
}

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

let envois: Array<{ table: string; action: string; data?: Record<string, unknown> }>

beforeEach(() => {
  envois = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).startsWith('/api/btp/pointage')) return json(CONTEXTE_GERANT)
    if (init?.method === 'POST') {
      envois.push(JSON.parse(String(init.body)))
      return json({ row: { id: 'p-1' } }, 201)
    }
    const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
    if (table === 'chantiers') return json({ chantiers: [{ id: CHANTIER, titre: 'Villa Dupré', statut: 'En cours', latitude: 43.29, longitude: 5.37, geo_rayon_m: 100 }] })
    if (table === 'membres') return json({ membres: [{ id: MEMBRE, prenom: 'Paul', nom: 'Durand', type_compte: 'ouvrier' }] })
    return json({ [table]: [] })
  })
  Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Un compte par rendu : le hook garde ses lectures en cache par compte.
let rendus = 0
/** Écran du gérant, onglet Historique, formulaire « Pointer manuellement » ouvert, salarié et chantier choisis. */
async function saisirPointage() {
  rendus += 1
  const artisan = { id: `fiche-${rendus}`, user_id: `compte-pointage-${rendus}`, company_name: 'Société d’essai' } as unknown as Artisan
  render(<PointageGeoSection artisan={artisan} orgRole="pro_societe" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Historique' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Pointer manuellement' }))
  await screen.findByRole('option', { name: 'Paul Durand' })
  await screen.findByRole('option', { name: 'Villa Dupré' })
  fireEvent.change(screen.getByLabelText('Employé', { selector: 'select#pointage-employe' }), { target: { value: MEMBRE } })
  fireEvent.change(screen.getByLabelText('Chantier', { selector: 'select#pointage-chantier' }), { target: { value: CHANTIER } })
}

describe('Pointage saisi à la main (onglet Historique)', () => {
  it('le salarié et le chantier choisis partent avec leurs identifiants', async () => {
    await saisirPointage()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0]).toMatchObject({
      table: 'pointages_btp', action: 'insert',
      data: { employe: 'Paul Durand', membre_id: MEMBRE, chantier_nom: 'Villa Dupré', chantier_id: CHANTIER, mode: 'manuel', heure_depart: '17:00', heures_travaillees: 8 },
    })
  })

  // Ni position ni distance d'un employé ne sont conservées (PR #703) : rien de tel ne part, pas même une colonne vide.
  it('ni mode GPS, ni position, ni distance ne partent : un pointage manuel', async () => {
    await saisirPointage()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(envois).toHaveLength(1))
    const data = envois[0].data ?? {}
    expect(data).toMatchObject({ mode: 'manuel' })
    expect(['arrivee_lat', 'arrivee_lng', 'depart_lat', 'depart_lng', 'distance_m'].filter(colonne => colonne in data)).toEqual([])
  })

  it('départ vidé : 17:00 comme en production (jamais un pointage « en cours »), heures vides', async () => {
    await saisirPointage()
    fireEvent.change(screen.getByLabelText('Départ', { selector: 'input#pointage-depart' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(envois).toHaveLength(1))
    expect(envois[0].data).toMatchObject({ membre_id: MEMBRE, chantier_id: CHANTIER, heure_depart: '17:00', heures_travaillees: null })
  })
})

// Onglet Affectations du gérant, avec le vrai hook (relecture adverse du 17/11/2026 : les écrans de #703 n'étaient
// testés qu'avec un faux useBTPData). Ce qui part vers /api/btp, que la route contrôle (employés du compte, en UUID) :
// le rayon et les employés sur le chantier, et pour l'équipe déplacée son seul chantier, sans toucher à ses membres.
describe('Affectations (gérant) : ce qui part vers /api/btp', () => {
  const IMMEUBLE = 'c4d5e6f7-a8b9-4c0d-9e1f-3a4b5c6d7e8f'
  const EQUIPE = 'd5e6f7a8-b9c0-4d1e-8f2a-4b5c6d7e8f9a'

  beforeEach(() => {
    vi.mocked(globalThis.fetch).mockImplementation(async (url, init) => {
      if (String(url).startsWith('/api/btp/pointage')) return json(CONTEXTE_GERANT)
      if (init?.method === 'POST') {
        envois.push(JSON.parse(String(init.body)))
        return json({ ok: true })
      }
      const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
      if (table === 'chantiers') {
        return json({ chantiers: [
          { id: CHANTIER, titre: 'Villa Dupré', statut: 'En cours', adresse: '1 rue des Lilas', ville: 'Marseille', latitude: 43.29, longitude: 5.37, geo_rayon_m: 150, membres_ids: [] },
          { id: IMMEUBLE, titre: 'Immeuble du Port', statut: 'En cours', latitude: null, longitude: null, geo_rayon_m: 100, membres_ids: [] },
        ] })
      }
      if (table === 'membres') return json({ membres: [{ id: MEMBRE, prenom: 'Paul', nom: 'Durand', type_compte: 'ouvrier' }] })
      if (table === 'equipes') {
        return json({ equipes: [{ id: EQUIPE, nom: 'Maçons', chantier_id: IMMEUBLE, equipe_membres_btp: [{ membre_id: MEMBRE }], membreIds: [MEMBRE] }] })
      }
      return json({ [table]: [] })
    })
  })

  it('enregistrer : rayon et employés sur le chantier, équipe déplacée vers lui sans toucher à ses membres', async () => {
    rendus += 1
    const artisan = { id: `fiche-${rendus}`, user_id: `compte-affectations-${rendus}`, company_name: 'Société d’essai' } as unknown as Artisan
    render(<PointageGeoSection artisan={artisan} orgRole="pro_societe" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Affectations' }))
    const villa = (await screen.findByText('Villa Dupré')).closest('.v5-card') as HTMLElement
    fireEvent.click(within(villa).getByLabelText(/Paul Durand/))
    fireEvent.click(within(villa).getByLabelText(/Maçons/))
    fireEvent.change(within(villa).getByLabelText(/^Rayon/), { target: { value: '300' } })
    fireEvent.click(within(villa).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(envois).toHaveLength(2))
    expect(envois).toEqual([
      { table: 'chantiers_btp', action: 'update', id: CHANTIER, data: { geo_rayon_m: 300, membres_ids: [MEMBRE] } },
      { table: 'equipes_btp', action: 'update', id: EQUIPE, data: { chantier_id: CHANTIER } },
    ])
  })
})
