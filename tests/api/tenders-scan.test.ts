/**
 * POST /api/tenders/scan (lot 7 du brief Aikido du 28/10/2026, issue 9) : le code de département
 * entre dans un nom de fichier (data/tenders-{code}.json). La route n'accepte que la liste fermée
 * DEPARTMENTS (lib/tenders/config.ts) et répond 400 à tout autre code (inconnu « 99 », remontée
 * « ../13 »…) sans jamais appeler le scanner ; auparavant un code inconnu partait au scanner et
 * finissait en 500.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  scanDepartment: vi.fn(async (department: string) => ({
    tenders: [],
    meta: {
      department,
      communes_scanned: 0,
      communes_with_site: 0,
      sources: {},
      total_raw: 0,
      total_after_filter: 0,
      total_after_dedup: 0,
      duration_ms: 1,
      scanned_at: '2026-10-28T00:00:00.000Z',
      errors: [],
    },
  })),
  getAuthUser: vi.fn(async () => null),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/tenders/scanner', () => ({ scanDepartment: h.scanDepartment }))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: h.getAuthUser }))

const { POST, GET } = await import('@/app/api/tenders/scan/route')

const CRON = { 'x-cron-secret': 'secret-cron' }
const appeler = (corps: unknown, entetes: Record<string, string> = CRON) =>
  POST(new NextRequest('https://vitfix.io/api/tenders/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...entetes },
    body: JSON.stringify(corps),
  }))

describe('POST /api/tenders/scan — code de département', () => {
  const secretAvant = process.env.CRON_SECRET
  beforeEach(() => {
    process.env.CRON_SECRET = 'secret-cron'
    h.scanDepartment.mockClear()
    h.getAuthUser.mockClear()
  })
  afterEach(() => { process.env.CRON_SECRET = secretAvant })

  it('401 sans secret de cron ni utilisateur connecté, scanner jamais appelé', async () => {
    const res = await appeler({ department: '13' }, {})
    expect(res.status).toBe(401)
    expect(h.scanDepartment).not.toHaveBeenCalled()
  })

  it('400 sur un département inconnu (« 99 »), scanner jamais appelé', async () => {
    const res = await appeler({ department: '99' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Code département invalide' })
    expect(h.scanDepartment).not.toHaveBeenCalled()
  })

  it.each([['../13'], ['..\\13'], ['13/../../etc/passwd'], ['constructor'], ['__proto__'], ['']])(
    '400 sur « %s », scanner jamais appelé',
    async (department) => {
      const res = await appeler({ department })
      expect(res.status).toBe(400)
      expect(h.scanDepartment).not.toHaveBeenCalled()
    },
  )

  it('200 sur un département connu (« 13 »), scanner appelé avec ce code', async () => {
    const res = await appeler({ department: '13' })
    expect(res.status).toBe(200)
    expect(h.scanDepartment).toHaveBeenCalledTimes(1)
    expect(h.scanDepartment).toHaveBeenCalledWith('13')
    expect(await res.json()).toMatchObject({ success: true, department: '13' })
  })

  it('sans corps (déclenchement cron en GET) : département par défaut « 13 »', async () => {
    const res = await GET(new NextRequest('https://vitfix.io/api/tenders/scan', { headers: CRON }))
    expect(res.status).toBe(200)
    expect(h.scanDepartment).toHaveBeenCalledWith('13')
  })
})
