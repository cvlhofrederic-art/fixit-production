// tests/lib/use-btp-data-reprise.test.tsx — reprise des anciennes données BTP du navigateur (import automatique,
// table vide en base). Rien n'est jamais supprimé ni réécrit dans le stockage du navigateur.
//
// Les rattachements enregistrés depuis le 15/11/2026 (équipe d'un membre, chantier et salarié d'un pointage…) ne partent
// pas dans une reprise : dans les anciennes fiches locales, ces identifiants sont propres au navigateur et la route
// refuserait toute la reprise.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { prefetchBTPTables, useBTPData } from '@/lib/hooks/use-btp-data'

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

let reprises: Array<{ table: string; action: string; data: Array<Record<string, unknown>> }>
/** Tables lues (GET /api/btp), dans l'ordre. */
let lectures: string[]

beforeEach(() => {
  reprises = []
  lectures = []
  localStorage.clear()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') {
      reprises.push(JSON.parse(String(init.body)))
      return json({ imported: 1 })
    }
    const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
    lectures.push(table)
    return json({ [table]: [] })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Constat donnees-btp-14 : la reprise partait dès que la table était vide en base, même déjà faite (le drapeau
// `<clé>_migrated` qu'elle écrit n'était lu nulle part) : des pointages supprimés revenaient à la visite suivante. Une
// reprise refusée (anciennes équipes) recommençait à chaque ouverture de la page, et deux sections montées ensemble
// l'envoyaient chacune. Maintenant, sur les écrans du BTP pro : une reprise déjà faite dans ce navigateur ne repart
// plus, et une reprise tentée ne repart pas pendant la session. L'accueil de l'artisan garde le comportement d'avant.
describe('reprise des anciennes données du navigateur — une seule fois', () => {
  const POINTAGES_LOCAUX = JSON.stringify([{ id: 'p-local', employe: 'Paul', date: '2026-03-02', heureArrivee: '08:00' }])

  it('déjà reprise dans ce navigateur (drapeau posé) : elle ne repart pas, même si la table est vide en base', async () => {
    localStorage.setItem('pointage_fiche-u1', POINTAGES_LOCAUX)
    localStorage.setItem('pointage_fiche-u1_migrated', 'true')
    const { result } = renderHook(() => useBTPData({ table: 'pointages', artisanId: 'fiche-u1', userId: 'compte-u1' }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(reprises).toEqual([])
    // Rien n'est retiré du navigateur.
    expect(localStorage.getItem('pointage_fiche-u1')).toBe(POINTAGES_LOCAUX)
  })

  it('reprise refusée par le serveur : elle ne repart pas à la visite suivante de la page (même session)', async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (init?.method === 'POST') {
        reprises.push(JSON.parse(String(init.body)))
        return json({ error: 'Enregistrement refusé : champs non reconnus (membreIds).' }, 400)
      }
      const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
      return json({ [table]: [] })
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem('fixit_equipes_btp_fiche-u2', JSON.stringify([{ id: 'e-local', nom: 'Maçons', membreIds: ['m-local'] }]))

    const premiere = renderHook(() => useBTPData({ table: 'equipes', artisanId: 'fiche-u2', userId: 'compte-u2' }))
    await waitFor(() => expect(reprises).toHaveLength(1))
    premiere.unmount()

    const seconde = renderHook(() => useBTPData({ table: 'equipes', artisanId: 'fiche-u2', userId: 'compte-u2b' }))
    await waitFor(() => expect(seconde.result.current.loading).toBe(false))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(reprises).toHaveLength(1)
    expect(localStorage.getItem('fixit_equipes_btp_fiche-u2')).not.toBeNull()
  })

  it('deux sections montées ensemble : une seule reprise part', async () => {
    localStorage.setItem('pointage_fiche-u3', POINTAGES_LOCAUX)
    renderHook(() => useBTPData({ table: 'pointages', artisanId: 'fiche-u3', userId: 'compte-u3' }))
    renderHook(() => useBTPData({ table: 'pointages', artisanId: 'fiche-u3', userId: 'compte-u3' }))

    await waitFor(() => expect(reprises).toHaveLength(1))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(reprises).toHaveLength(1)
  })

  it('témoin, accueil de l’artisan : comportement d’avant (le drapeau n’y est pas lu)', async () => {
    localStorage.setItem('fixit_expenses_compte-u4', JSON.stringify([{ id: 'd-local', label: 'Ciment', amount: 120, date: '2026-03-02' }]))
    localStorage.setItem('fixit_expenses_compte-u4_migrated', 'true')
    renderHook(() => useBTPData({ table: 'depenses', artisanId: 'compte-u4', userId: 'compte-u4', orgRole: 'artisan' }))

    await waitFor(() => expect(reprises).toHaveLength(1))
  })
})

// Relecture adverse du 15/11/2026 : depuis que Situations, Retenues, Sous-traitance et DPGF rangent leurs listes sous
// l'identifiant du compte, elles partagent la liste préchargée par le tableau de bord. Un écran qui trouvait sa liste
// fraîche en mémoire s'arrêtait là : dans les 5 minutes suivant le chargement du tableau de bord, la reprise n'était plus
// tentée, et une fiche créée entre-temps l'empêchait pour toujours (la table n'est plus vide).
describe('reprise des anciennes données du navigateur — liste déjà préchargée', () => {
  const SITUATIONS_LOCALES = JSON.stringify([{ id: 's-local', chantier: 'Villa', client: 'Mme Dupré', numero: 1, montantMarche: 1000, travaux: [], statut: 'brouillon' }])

  it('liste vide déjà préchargée : la reprise est tentée à l’ouverture de l’écran, sans relire la table avant', async () => {
    localStorage.setItem('situations_fiche-p1', SITUATIONS_LOCALES)
    await prefetchBTPTables(['situations'], 'compte-p1')
    expect(lectures).toEqual(['situations'])
    renderHook(() => useBTPData({ table: 'situations', artisanId: 'fiche-p1', userId: 'compte-p1' }))

    await waitFor(() => expect(reprises).toHaveLength(1))
    expect(reprises[0]).toMatchObject({ table: 'situations_btp', action: 'import' })
    expect(reprises[0].data[0]).toMatchObject({ chantier: 'Villa', client: 'Mme Dupré', montant_marche: 1000 })
    // Relecture après la reprise seulement.
    await waitFor(() => expect(lectures).toEqual(['situations', 'situations']))
    expect(localStorage.getItem('situations_fiche-p1')).toBe(SITUATIONS_LOCALES)
  })

  it('liste préchargée non vide : ni reprise ni relecture, comme avant', async () => {
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (init?.method === 'POST') {
        reprises.push(JSON.parse(String(init.body)))
        return json({ imported: 1 })
      }
      const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
      lectures.push(table)
      return json({ [table]: [{ id: 's-1', chantier: 'École', numero: 1, statut: 'brouillon' }] })
    })
    localStorage.setItem('situations_fiche-p2', SITUATIONS_LOCALES)
    await prefetchBTPTables(['situations'], 'compte-p2')
    const { result } = renderHook(() => useBTPData({ table: 'situations', artisanId: 'fiche-p2', userId: 'compte-p2' }))

    expect(result.current.items).toHaveLength(1)
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(reprises).toEqual([])
    expect(lectures).toEqual(['situations'])
  })

  it('témoin, accueil de l’artisan : liste vide déjà préchargée, pas de reprise (comportement d’avant)', async () => {
    localStorage.setItem('fixit_expenses_compte-p3', JSON.stringify([{ id: 'd-local', label: 'Ciment', amount: 120, date: '2026-03-02' }]))
    await prefetchBTPTables(['depenses'], 'compte-p3')
    renderHook(() => useBTPData({ table: 'depenses', artisanId: 'compte-p3', userId: 'compte-p3', orgRole: 'artisan' }))

    await new Promise(resolve => setTimeout(resolve, 50))
    expect(reprises).toEqual([])
  })
})

describe('reprise des anciennes données du navigateur — rattachements', () => {
  it('membres : l’équipe locale d’un ancien membre ne part pas, le reste oui', async () => {
    localStorage.setItem('fixit_membres_fiche-r1', JSON.stringify([{ id: 'm-local', prenom: 'Paul', nom: 'Durand', equipeId: 'eq-local-1', coutHoraire: 20 }]))
    renderHook(() => useBTPData({ table: 'membres', artisanId: 'fiche-r1', userId: 'compte-r1' }))

    await waitFor(() => expect(reprises).toHaveLength(1))
    expect(reprises[0]).toMatchObject({ table: 'membres_btp', action: 'import' })
    expect(reprises[0].data[0]).toMatchObject({ prenom: 'Paul', nom: 'Durand', cout_horaire: 20 })
    expect(reprises[0].data[0]).not.toHaveProperty('equipe_id')
  })

  it('pointages : ni le chantier ni le salarié locaux d’un ancien pointage ne partent', async () => {
    localStorage.setItem('pointage_fiche-r2', JSON.stringify([{ id: 'p-local', employe: 'Paul', chantier: 'Villa', chantierId: 'ch-local', membreId: 'm-local', date: '2026-03-02', heureArrivee: '08:00', heureDepart: '16:00', heuresTravaillees: 7 }]))
    renderHook(() => useBTPData({ table: 'pointages', artisanId: 'fiche-r2', userId: 'compte-r2' }))

    await waitFor(() => expect(reprises).toHaveLength(1))
    expect(reprises[0].data[0]).toMatchObject({ employe: 'Paul', chantier_nom: 'Villa', heure_depart: '16:00', heures_travaillees: 7 })
    expect(reprises[0].data[0]).not.toHaveProperty('chantier_id')
    expect(reprises[0].data[0]).not.toHaveProperty('membre_id')
  })

  // Pointage géolocalisé (PR #703) : ni position ni distance d'un employé ne sont conservées. Une fiche locale qui en
  // porterait (avec un mode GPS) part comme un pointage manuel, sans elles (relecture adverse du 17/11/2026).
  it('pointages : ni le mode GPS, ni la position, ni la distance d’une fiche locale ne partent', async () => {
    localStorage.setItem('pointage_fiche-r4', JSON.stringify([{
      id: 'p-local', employe: 'Paul', chantier: 'Villa', date: '2026-03-02', heureArrivee: '08:00', heureDepart: '16:00', heuresTravaillees: 7,
      mode: 'geo_confirme', arriveeLat: 43.29, arriveeLng: 5.37, departLat: 43.3, departLng: 5.38, distanceM: 37,
    }]))
    renderHook(() => useBTPData({ table: 'pointages', artisanId: 'fiche-r4', userId: 'compte-r4' }))

    await waitFor(() => expect(reprises).toHaveLength(1))
    expect(reprises[0]).toMatchObject({ table: 'pointages_btp', action: 'import' })
    expect(reprises[0].data[0]).toMatchObject({ employe: 'Paul', chantier_nom: 'Villa', heure_depart: '16:00', heures_travaillees: 7, mode: 'manuel' })
    expect(['arrivee_lat', 'arrivee_lng', 'depart_lat', 'depart_lng', 'distance_m'].filter(colonne => colonne in reprises[0].data[0])).toEqual([])
  })

  // Pointage géolocalisé (PR #703, réuni le 17/11/2026) : les employés d'un chantier (membres_ids) sont contrôlés par la
  // route comme membre_id ; ceux d'une fiche locale ne désignent aucun employé en base, même au format UUID.
  it('chantiers : les employés locaux d’un ancien chantier ne partent pas, le reste oui', async () => {
    const employeLocal = '3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a01'
    localStorage.setItem('fixit_chantiers_fiche-r3', JSON.stringify([{ id: 'ch-local', titre: 'Villa', statut: 'En cours', membres_ids: ['m-local', employeLocal] }]))
    renderHook(() => useBTPData({ table: 'chantiers', artisanId: 'fiche-r3', userId: 'compte-r3' }))

    await waitFor(() => expect(reprises).toHaveLength(1))
    expect(reprises[0]).toMatchObject({ table: 'chantiers_btp', action: 'import' })
    expect(reprises[0].data[0]).toMatchObject({ titre: 'Villa', statut: 'En cours' })
    expect(reprises[0].data[0]).not.toHaveProperty('membres_ids')
  })
})
