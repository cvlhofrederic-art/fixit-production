import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const insertMock = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: (payload: unknown) => {
        if (table !== 'cron_heartbeats') throw new Error(`unexpected table ${table}`)
        return insertMock(payload)
      },
    }),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  process.env = { ...ORIGINAL_ENV, CRON_SECRET: 'topsecret' }
  insertMock.mockResolvedValue({ error: null })
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://test.local/api/cron/cron-heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/cron/cron-heartbeat', () => {
  it('returns 401 without cron secret', async () => {
    const { POST } = await import('@/app/api/cron/cron-heartbeat/route')
    const res = await POST(makeRequest({ cron_name: 'devis-reminder' }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 on missing cron_name', async () => {
    const { POST } = await import('@/app/api/cron/cron-heartbeat/route')
    const res = await POST(makeRequest({}, { 'x-cron-secret': 'topsecret' }) as never)
    expect(res.status).toBe(400)
  })

  it('inserts a heartbeat row on happy path', async () => {
    const { POST } = await import('@/app/api/cron/cron-heartbeat/route')
    const res = await POST(makeRequest({ cron_name: 'devis-reminder', duration_ms: 1234 }, { 'x-cron-secret': 'topsecret' }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recorded).toBe(true)
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      cron_name: 'devis-reminder',
      duration_ms: 1234,
      status: 'completed',
    }))
  })

  it('returns recorded:false but 200 when migration 102 is missing', async () => {
    insertMock.mockResolvedValueOnce({ error: { code: '42P01', message: 'relation does not exist' } })
    const { POST } = await import('@/app/api/cron/cron-heartbeat/route')
    const res = await POST(makeRequest({ cron_name: 'devis-reminder' }, { 'x-cron-secret': 'topsecret' }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recorded).toBe(false)
    expect(body.reason).toMatch(/migration 102/)
  })

  it('accepts status=failed and details object', async () => {
    const { POST } = await import('@/app/api/cron/cron-heartbeat/route')
    const res = await POST(
      makeRequest(
        { cron_name: 'devis-reminder', status: 'failed', details: { reason: 'boamp 503' } },
        { 'x-cron-secret': 'topsecret' }
      ) as never
    )
    expect(res.status).toBe(200)
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      details: { reason: 'boamp 503' },
    }))
  })
})
