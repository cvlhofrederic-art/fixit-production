// @vitest-environment node
// tests/lib/absences-artisan.test.ts
//
// lib/absences-artisan.ts — lecture des absences par le tableau de bord pro (artisan et société). La lecture
// publique de /api/artisan-absences ne renvoie plus que les dates : le motif et le libellé affichés dans l'agenda
// ne sont rendus qu'avec la session du propriétaire de la fiche. Les deux lectures du tableau de bord (ouverture de
// l'agenda, rafraîchissement après une action de l'assistant) passent donc par cette lecture avec jeton.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const simul = vi.hoisted(() => ({ jetonAcces: vi.fn<() => Promise<string | null>>() }))
vi.mock('@/lib/auth/jeton-acces', () => ({ jetonAcces: simul.jetonAcces }))

import { lireAbsencesArtisan } from '@/lib/absences-artisan'

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

describe('tableau de bord pro : les absences se lisent avec la session', () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

  it.each([
    'hooks/dashboard/useAvailability.ts',
    'app/(commun)/pro/dashboard/page.tsx',
  ])('%s lit les absences par lireAbsencesArtisan, plus par un fetch sans session', (fichier) => {
    const source = lire(fichier)
    expect(source).toContain("import { lireAbsencesArtisan } from '@/lib/absences-artisan'")
    expect(source).toMatch(/lireAbsencesArtisan\(/)
    expect(source, `${fichier} : lecture des absences sans session`).not.toMatch(/[^a-zA-Z]fetch\(`\/api\/artisan-absences\?/)
  })
})
