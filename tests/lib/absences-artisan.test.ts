// @vitest-environment node
// tests/lib/absences-artisan.test.ts
//
// lib/absences-artisan.ts — lecture des absences par le tableau de bord pro (artisan et société). La lecture
// publique de /api/artisan-absences ne renvoie plus que les dates : le motif et le libellé affichés dans l'agenda
// ne sont rendus qu'avec la session du propriétaire de la fiche. Les deux lectures du tableau de bord (ouverture de
// l'agenda, rafraîchissement après une action de l'assistant) passent donc par cette lecture avec jeton.
// Quand la session n'a pas pu être lue ou reconnue, la réponse ne porte que les dates : elle ne remplace pas les
// absences détaillées que l'agenda affiche déjà (absencesDetaillees).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const simul = vi.hoisted(() => ({ jetonAcces: vi.fn<() => Promise<string | null>>() }))
vi.mock('@/lib/auth/jeton-acces', () => ({ jetonAcces: simul.jetonAcces }))

import { absencesDetaillees, lireAbsencesArtisan } from '@/lib/absences-artisan'

const FICHE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const fetchMock = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(async () => Response.json({ data: [] }))

beforeEach(() => {
  fetchMock.mockClear()
  simul.jetonAcces.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lireAbsencesArtisan', () => {
  it('avec une session : la lecture porte le jeton du compte connecté', async () => {
    simul.jetonAcces.mockResolvedValue('jeton-xyz')
    const res = await lireAbsencesArtisan(FICHE)
    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(`/api/artisan-absences?artisan_id=${FICHE}`, { headers: { Authorization: 'Bearer jeton-xyz' } })
  })

  it('sans jeton lisible : la lecture part quand même, sans en-tête (dates seules)', async () => {
    simul.jetonAcces.mockResolvedValue(null)
    await lireAbsencesArtisan(FICHE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(`/api/artisan-absences?artisan_id=${FICHE}`, undefined)
  })

  it('identifiant de fiche encodé dans l’adresse', async () => {
    simul.jetonAcces.mockResolvedValue(null)
    await lireAbsencesArtisan('a b&c')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/artisan-absences?artisan_id=a%20b%26c')
  })
})

describe('absencesDetaillees — ce que l’agenda peut afficher à la place de ce qu’il montre déjà', () => {
  const DETAIL = [
    { id: 'abs-1', artisan_id: FICHE, start_date: '2026-12-01', end_date: '2026-12-05', reason: 'Maladie', label: '', created_at: '2026-11-10T08:00:00Z' },
    { id: 'abs-2', artisan_id: FICHE, start_date: '2026-12-20', end_date: '2026-12-22', reason: null, label: null, created_at: '2026-11-12T08:00:00Z' },
  ]
  const DATES_SEULES = DETAIL.map(({ id, artisan_id, start_date, end_date }) => ({ id, artisan_id, start_date, end_date }))

  it('réponse du propriétaire (motif et libellé présents, même vides) : la liste est rendue telle quelle', () => {
    expect(absencesDetaillees(DETAIL)).toEqual(DETAIL)
  })

  it('aucune absence sur le serveur : liste vide, comme avant', () => {
    expect(absencesDetaillees([])).toEqual([])
  })

  it('réponse « dates seules » (session illisible ou non reconnue) : null, l’agenda garde ce qu’il affiche', () => {
    expect(absencesDetaillees(DATES_SEULES)).toBeNull()
  })

  it('une seule ligne sans détail suffit à écarter la réponse', () => {
    expect(absencesDetaillees([DETAIL[0], DATES_SEULES[1]])).toBeNull()
  })

  // Un cas par tableau : la valeur reçue à la place de la liste (les deux derniers sont des listes dont une ligne
  // n'est pas un objet).
  it.each<[unknown]>([[undefined], [null], ['erreur'], [{ error: 'Failed to fetch absences' }], [[null]], [['abs-1']]])('réponse inattendue (%j) : null', (donnees) => {
    expect(absencesDetaillees(donnees)).toBeNull()
  })
})

describe('tableau de bord pro : les absences se lisent avec la session', () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

  it.each([
    'hooks/dashboard/useAvailability.ts',
    'app/(commun)/pro/dashboard/page.tsx',
  ])('%s lit les absences par lireAbsencesArtisan, plus par un fetch sans session', (fichier) => {
    const source = lire(fichier)
    expect(source).toMatch(/import \{[^}]*\blireAbsencesArtisan\b[^}]*\} from '@\/lib\/absences-artisan'/)
    expect(source).toMatch(/lireAbsencesArtisan\(/)
    expect(source, `${fichier} : lecture des absences sans session`).not.toMatch(/[^a-zA-Z]fetch\(`\/api\/artisan-absences\?/)
  })

  it('rafraîchissement du tableau de bord : une réponse sans détail ne remplace pas les absences affichées', () => {
    // L'ouverture de l'agenda est vérifiée par son comportement (tests/pro-dashboard/agenda-absences.test.tsx) ;
    // le rafraîchissement vit dans la page du tableau de bord, vérifiée ici par sa source.
    const source = lire('app/(commun)/pro/dashboard/page.tsx')
    expect(source).toMatch(/absencesDetaillees\(absJson\.data\)/)
    expect(source, 'réponse des absences reportée sans contrôle').not.toMatch(/setAbsences\(absJson\.data\)/)
  })
})
