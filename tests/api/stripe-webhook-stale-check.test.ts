import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const selectMock = vi.fn()
const insertMock = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'stripe_webhook_events') {
        return {
          select: () => ({
            gte: () => ({
              order: () => ({
                limit: () => selectMock(),
              }),
            }),
          }),
        }
      }
      if (table === 'cron_heartbeats') {
        return { insert: (payload: unknown) => insertMock(payload) }
      }
      throw new Error(`unexpected table ${table}`)
    },
  },
}))

const warnMock = vi.fn()
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: (...args: unknown[]) => warnMock(...args),
    error: vi.fn(),
  },
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

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://test.local/api/cron/stripe-webhook-stale-check', {
    method: 'POST',
    headers,
  })
}

describe('POST /api/cron/stripe-webhook-stale-check', () => {
  it('returns 401 without cron secret', async () => {
    const { POST } = await import('@/app/api/cron/stripe-webhook-stale-check/route')
    const res = await POST(makeRequest() as never)
    expect(res.status).toBe(401)
  })

  it('returns scanned:false when received_at column is missing (migration 104 pending)', async () => {
    selectMock.mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column "received_at" does not exist' } })
    const { POST } = await import('@/app/api/cron/stripe-webhook-stale-check/route')
    const res = await POST(makeRequest({ 'x-cron-secret': 'topsecret' }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scanned).toBe(false)
    expect(body.reason).toMatch(/migration 104/)
  })

  it('emits no warn when no rows have a gap > threshold', async () => {
    selectMock.mockResolvedValueOnce({
      data: [
        // Gap = 1 ms (within threshold)
        { event_id: 'evt_1', event_type: 'checkout.session.completed', received_at: '2026-05-07T10:00:00.000Z', processed_at: '2026-05-07T10:00:00.001Z' },
      ],
      error: null,
    })
    const { POST } = await import('@/app/api/cron/stripe-webhook-stale-check/route')
    const res = await POST(makeRequest({ 'x-cron-secret': 'topsecret' }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scanned).toBe(true)
    expect(body.stale_count).toBe(0)
    const staleWarn = warnMock.mock.calls.find((c) => String(c[0]).includes('gap > 30 min'))
    expect(staleWarn).toBeUndefined()
  })

  it('emits a warn when at least one row has a gap > 30 min', async () => {
    selectMock.mockResolvedValueOnce({
      data: [
        // Gap = 45 min — flagged
        { event_id: 'evt_2', event_type: 'invoice.payment_failed', received_at: '2026-05-07T10:00:00.000Z', processed_at: '2026-05-07T10:45:00.000Z' },
        // Gap = 5 ms — not flagged
        { event_id: 'evt_3', event_type: 'checkout.session.completed', received_at: '2026-05-07T11:00:00.000Z', processed_at: '2026-05-07T11:00:00.005Z' },
      ],
      error: null,
    })
    const { POST } = await import('@/app/api/cron/stripe-webhook-stale-check/route')
    const res = await POST(makeRequest({ 'x-cron-secret': 'topsecret' }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stale_count).toBe(1)
    const staleWarn = warnMock.mock.calls.find((c) => String(c[0]).includes('gap > 30 min'))
    expect(staleWarn).toBeDefined()
  })
})
