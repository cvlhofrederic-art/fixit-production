/**
 * lib/tenders (lot 7 du brief Aikido du 28/10/2026, issue 9) : les fichiers data/tenders-{code}.json
 * (scanner.ts) et data/communes-{code}.json (communes.ts) ne sont lus ou écrits que pour un code de
 * la liste fermée DEPARTMENTS, et leur chemin est confiné dans data/ par resolveInside. Un code
 * inconnu (« 99 », « constructor ») ou une remontée (« ../13 ») est refusé avant tout accès fichier,
 * réseau ou base.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'
import type { ScanResult, Tender } from '@/lib/tenders/types'

const h = vi.hoisted(() => ({
  readFile: vi.fn(async (_chemin: string) => {
    const e = new Error('ENOENT') as NodeJS.ErrnoException
    e.code = 'ENOENT'
    throw e
  }),
  writeFile: vi.fn(async (_chemin: string, _contenu: string) => undefined),
  mkdir: vi.fn(async (_chemin: string) => undefined),
  stat: vi.fn(async (_chemin: string) => { throw new Error('ENOENT') }),
  upsertMarches: vi.fn(async () => ({ inserts: 0, updates: 0, errors: 0 })),
}))

vi.mock('fs/promises', () => {
  const fs = { readFile: h.readFile, writeFile: h.writeFile, mkdir: h.mkdir, stat: h.stat }
  return { ...fs, default: fs }
})
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: {} }))
vi.mock('@/lib/marches-sync', () => ({ upsertMarches: h.upsertMarches }))
vi.mock('@/lib/tenders/sources/boamp', () => ({ scanBOAMP: vi.fn(async () => []) }))
vi.mock('@/lib/tenders/sources/mairies', () => ({ scanAllMairies: vi.fn(async () => []) }))
vi.mock('@/lib/tenders/sources/platforms', () => ({ scanAllPlatforms: vi.fn(async () => []) }))
vi.mock('@/lib/tenders/sources/regional-paca', () => ({ scanAllRegionalPACA: vi.fn(async () => []) }))

const { loadStoredTenders, storeTenders, scanDepartment } = await import('@/lib/tenders/scanner')
const { loadCommunes, fetchCommunes } = await import('@/lib/tenders/communes')

const DATA = path.join(process.cwd(), 'data')
const INCONNU = /Unknown department/

const tender: Tender = {
  id: 't1', title: 'Réfection de toiture', city: 'Marseille', source: 'boamp', source_id: 'b-1',
  publication_date: '2026-10-27T00:00:00.000Z', deadline: '2026-11-30', description: 'Toiture école',
  url: 'https://exemple.fr/t1', category: 'BTP', department: '13', region: 'PACA', synced_at: '2026-10-28T00:00:00.000Z',
}
const resultat = (department: string, tenders: Tender[]): ScanResult => ({
  tenders,
  meta: {
    department, communes_scanned: 0, communes_with_site: 0, sources: {}, total_raw: tenders.length,
    total_after_filter: tenders.length, total_after_dedup: tenders.length, duration_ms: 1,
    scanned_at: '2026-10-28T00:00:00.000Z', errors: [],
  },
})

beforeEach(() => {
  h.readFile.mockClear()
  h.writeFile.mockClear()
  h.mkdir.mockClear()
  h.stat.mockClear()
  h.upsertMarches.mockClear()
})

describe('loadStoredTenders — chemin confiné dans data/', () => {
  it('lit data/tenders-13.json pour un département connu ([] si le fichier est absent)', async () => {
    await expect(loadStoredTenders('13')).resolves.toEqual([])
    expect(h.readFile).toHaveBeenCalledTimes(1)
    expect(h.readFile.mock.calls[0][0]).toBe(path.join(DATA, 'tenders-13.json'))
  })

  it.each([['99'], ['../13'], ['..\\13'], ['13/../../etc/passwd'], ['constructor'], ['__proto__'], ['']])(
    'refuse « %s » sans lire aucun fichier',
    async (department) => {
      await expect(loadStoredTenders(department)).rejects.toThrow(INCONNU)
      expect(h.readFile).not.toHaveBeenCalled()
    },
  )
})

describe('storeTenders — chemin confiné dans data/', () => {
  it('refuse un département inconnu avant la base et le fichier', async () => {
    await expect(storeTenders('../13', resultat('../13', [tender]))).rejects.toThrow(INCONNU)
    expect(h.upsertMarches).not.toHaveBeenCalled()
    expect(h.writeFile).not.toHaveBeenCalled()
  })

  it('écrit data/tenders-13.json pour un département connu', async () => {
    await storeTenders('13', resultat('13', [tender]))
    expect(h.upsertMarches).toHaveBeenCalledTimes(1)
    expect(h.writeFile).toHaveBeenCalledTimes(1)
    expect(h.writeFile.mock.calls[0][0]).toBe(path.join(DATA, 'tenders-13.json'))
  })
})

describe('scanDepartment et loadCommunes — liste fermée DEPARTMENTS', () => {
  it('scanDepartment refuse un département inconnu avant tout accès', async () => {
    await expect(scanDepartment('99')).rejects.toThrow(INCONNU)
    expect(h.stat).not.toHaveBeenCalled()
    expect(h.readFile).not.toHaveBeenCalled()
    expect(h.upsertMarches).not.toHaveBeenCalled()
  })

  it('loadCommunes refuse une remontée de chemin sans toucher au cache', async () => {
    await expect(loadCommunes('../13')).rejects.toThrow(INCONNU)
    expect(h.stat).not.toHaveBeenCalled()
    expect(h.readFile).not.toHaveBeenCalled()
  })

  it('fetchCommunes refuse un département inconnu avant tout appel réseau (code interpolé dans l’URL)', async () => {
    const fetchFaux = vi.fn(async () => ({ ok: true, json: async () => [] }))
    vi.stubGlobal('fetch', fetchFaux)
    try {
      for (const department of ['99', '13/../../x', 'constructor']) {
        await expect(fetchCommunes(department)).rejects.toThrow(INCONNU)
      }
      expect(fetchFaux).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
