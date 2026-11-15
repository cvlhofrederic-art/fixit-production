/**
 * Tableau de bord pro (artisan et société) — ouverture de l'agenda : useAvailability.loadCalendarData.
 *
 * La lecture des absences porte la session du compte (le motif et le libellé ne sont rendus qu'au propriétaire de la
 * fiche). Contrat vérifié ici :
 * - elle ne retient pas l'affichage des disponibilités quand la session tarde à être lue ;
 * - une réponse qui ne porte que les dates (session illisible ou non reconnue) n'est pas reportée dans l'agenda :
 *   il garde les absences détaillées qu'il affiche déjà ;
 * - la réponse du propriétaire est rendue telle quelle, une lecture en échec ne bloque rien.
 * Aucune donnée réelle : fiche et absences d'exemple.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const simul = vi.hoisted(() => ({ lireAbsencesArtisan: vi.fn<(artisanId: string) => Promise<Response>>() }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'jeton' } } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
    },
  },
}))
vi.mock('@/lib/api-client', () => ({ authFetch: vi.fn(async () => Response.json({})) }))
vi.mock('@/lib/absences-artisan', async (original) => ({
  ...(await original<typeof import('@/lib/absences-artisan')>()),
  lireAbsencesArtisan: simul.lireAbsencesArtisan,
}))

import { useAvailability } from '@/hooks/dashboard/useAvailability'

const FICHE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

// Une semaine complète pour les deux types de créneau : rien à initialiser, l'agenda ne fait que lire.
const SEMAINE = (['rdv', 'visite'] as const).flatMap((slot_type) =>
  [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({
    id: `${slot_type}-${day_of_week}`, artisan_id: FICHE, day_of_week, slot_type,
    is_available: slot_type === 'rdv' && day_of_week >= 1 && day_of_week <= 5, start_time: '08:00', end_time: '17:30',
  })))
const PRESTATIONS_PAR_JOUR = { '1': ['prestation-1'] }

const DETAIL = [
  { id: 'abs-1', artisan_id: FICHE, start_date: '2026-12-01', end_date: '2026-12-05', reason: 'Maladie', label: '', created_at: '2026-11-10T08:00:00Z' },
  { id: 'abs-2', artisan_id: FICHE, start_date: '2026-12-20', end_date: '2026-12-22', reason: 'Intervention devis', label: 'Marie Exemple - Rénovation salle de bain', created_at: '2026-11-12T08:00:00Z' },
]
const DATES_SEULES = DETAIL.map(({ id, artisan_id, start_date, end_date }) => ({ id, artisan_id, start_date, end_date }))

const monterAgenda = () => renderHook(() => useAvailability({ id: FICHE }, vi.fn()))

beforeEach(() => {
  simul.lireAbsencesArtisan.mockReset()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const adresse = String(url)
    if (adresse.startsWith('/api/availability-services?')) return Response.json({ data: PRESTATIONS_PAR_JOUR })
    if (adresse.startsWith('/api/availability?')) return Response.json({ data: SEMAINE })
    throw new Error(`lecture inattendue : ${adresse}`)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('tableau de bord pro — ouverture de l’agenda', () => {
  it('lecture des absences encore en attente (session lente à lire) : disponibilités et prestations par jour déjà affichées', async () => {
    let repondre: (reponse: Response) => void = () => {}
    simul.lireAbsencesArtisan.mockReturnValue(new Promise<Response>((ok) => { repondre = ok }))
    const { result } = monterAgenda()

    const chargement = result.current.loadCalendarData(FICHE)
    await waitFor(() => expect(result.current.availability).toHaveLength(SEMAINE.length))
    expect(result.current.dayServices).toEqual(PRESTATIONS_PAR_JOUR)

    // Les absences arrivent ensuite, avec leur détail.
    repondre(Response.json({ data: DETAIL }))
    let absences: unknown
    await act(async () => { absences = await chargement })
    expect(absences).toEqual(DETAIL)
  })

  it('réponse du propriétaire : les absences sont rendues avec leur motif et leur libellé', async () => {
    simul.lireAbsencesArtisan.mockResolvedValue(Response.json({ data: DETAIL }))
    const { result } = monterAgenda()

    let absences: unknown
    await act(async () => { absences = await result.current.loadCalendarData(FICHE) })
    expect(simul.lireAbsencesArtisan).toHaveBeenCalledWith(FICHE)
    expect(absences).toEqual(DETAIL)
    expect(result.current.availability).toHaveLength(SEMAINE.length)
  })

  it('réponse « dates seules » (session illisible ou non reconnue) : rien n’est reporté, l’agenda garde ce qu’il affiche', async () => {
    simul.lireAbsencesArtisan.mockResolvedValue(Response.json({ data: DATES_SEULES }))
    const { result } = monterAgenda()

    let absences: unknown
    await act(async () => { absences = await result.current.loadCalendarData(FICHE) })
    // Liste vide : la page ne remplace les absences affichées que par une liste non vide.
    expect(absences).toEqual([])
    expect(result.current.availability).toHaveLength(SEMAINE.length)
  })

  it('lecture des absences en échec : liste vide, les disponibilités restent chargées', async () => {
    simul.lireAbsencesArtisan.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = monterAgenda()

    let absences: unknown
    await act(async () => { absences = await result.current.loadCalendarData(FICHE) })
    expect(absences).toEqual([])
    expect(result.current.availability).toHaveLength(SEMAINE.length)
    expect(result.current.dayServices).toEqual(PRESTATIONS_PAR_JOUR)
  })
})
