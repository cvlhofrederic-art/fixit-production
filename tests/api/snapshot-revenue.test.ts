import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const subscriptionsSelect = vi.fn()
const metricsUpsert = vi.fn()

const fromMock = vi.fn().mockImplementation((table: string) => {
  if (table === 'subscriptions') {
    return { select: () => subscriptionsSelect() }
  }
  if (table === 'subscription_metrics') {
    return {
      upsert: (payload: unknown, opts: unknown) => metricsUpsert(payload, opts),
    }
  }
  throw new Error(`unexpected table ${table}`)
})

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: fromMock },
}))

const getAuthUserMock = vi.fn()
const isSuperAdminMock = vi.fn()
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: (...args: unknown[]) => getAuthUserMock(...args),
  isSuperAdmin: (...args: unknown[]) => isSuperAdminMock(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const ORIGINAL_PROCESS = (globalThis as unknown as { process?: NodeJS.Process }).process

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as unknown as { process: NodeJS.Process }).process = {
    ...ORIGINAL_PROCESS,
    env: { ...ORIGINAL_PROCESS?.env, CRON_SECRET: 'topsecret' },
  } as NodeJS.Process
})

afterEach(() => {
  ;(globalThis as unknown as { process?: NodeJS.Process }).process = ORIGINAL_PROCESS
})

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://test.local/api/cron/snapshot-revenue', {
    method: 'POST',
    headers,
  })
}

describe('POST /api/cron/snapshot-revenue', () => {
  it('returns 401 with no cron secret and no super-admin user', async () => {
    getAuthUserMock.mockResolvedValueOnce(null)
    const { POST } = await import('@/app/api/cron/snapshot-revenue/route')
    const res = await POST(makeRequest() as never)
    expect(res.status).toBe(401)
  })

  it('aggregates statuses and computes MRR per active artisan_pro', async () => {
    subscriptionsSelect.mockResolvedValueOnce({
      data: [
        { status: 'active', plan_id: 'artisan_pro' },
        { status: 'active', plan_id: 'artisan_pro' },
        { status: 'active', plan_id: 'artisan_starter' },
        { status: 'trialing', plan_id: 'artisan_pro' },
        { status: 'past_due', plan_id: 'artisan_pro' },
        { status: 'canceled', plan_id: 'artisan_pro' },
      ],
      error: null,
    })
    metricsUpsert.mockResolvedValueOnce({ error: null })
    const { POST } = await import('@/app/api/cron/snapshot-revenue/route')
    const res = await POST(makeRequest({ 'x-cron-secret': 'topsecret' }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.snapshotted).toBe(true)
    expect(body.counts).toMatchObject({
      active: 3,
      trial: 1,
      past_due: 1,
      canceled: 1,
      // 2 active artisan_pro × 4900 + 1 active artisan_starter × 0
      mrr_cents: 9800,
    })
    expect(metricsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ active_count: 3, mrr_cents: 9800 }),
      expect.objectContaining({ onConflict: 'date' })
    )
  })

  it('reports snapshotted:false when subscription_metrics table is missing', async () => {
    subscriptionsSelect.mockResolvedValueOnce({
      data: [{ status: 'active', plan_id: 'artisan_pro' }],
      error: null,
    })
    metricsUpsert.mockResolvedValueOnce({ error: { code: '42P01', message: 'relation does not exist' } })
    const { POST } = await import('@/app/api/cron/snapshot-revenue/route')
    const res = await POST(makeRequest({ 'x-cron-secret': 'topsecret' }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.snapshotted).toBe(false)
    expect(body.counts.mrr_cents).toBe(4900)
  })
})
