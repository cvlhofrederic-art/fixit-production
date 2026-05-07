import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn()
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: () => ({
      insert: (payload: unknown) => insertMock(payload),
    }),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  insertMock.mockResolvedValue({ error: null })
})

describe('lib/cron-heartbeat — recordHeartbeat', () => {
  it('inserts a completed row with default status', async () => {
    const { recordHeartbeat } = await import('@/lib/cron-heartbeat')
    await recordHeartbeat({ cron_name: 'devis-reminder', duration_ms: 1234 })
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cron_name: 'devis-reminder',
        duration_ms: 1234,
        status: 'completed',
      })
    )
  })

  it('passes status=failed and details through', async () => {
    const { recordHeartbeat } = await import('@/lib/cron-heartbeat')
    await recordHeartbeat({
      cron_name: 'tenders-scan',
      duration_ms: 9876,
      status: 'failed',
      details: { error: 'boamp 503' },
    })
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cron_name: 'tenders-scan',
        status: 'failed',
        details: { error: 'boamp 503' },
      })
    )
  })

  it('does not throw when the table is absent', async () => {
    insertMock.mockResolvedValueOnce({
      error: { code: '42P01', message: 'relation does not exist' },
    })
    const { recordHeartbeat } = await import('@/lib/cron-heartbeat')
    await expect(recordHeartbeat({ cron_name: 'x' })).resolves.toBeUndefined()
  })

  it('does not throw when insert itself rejects', async () => {
    insertMock.mockRejectedValueOnce(new Error('connection refused'))
    const { recordHeartbeat } = await import('@/lib/cron-heartbeat')
    await expect(recordHeartbeat({ cron_name: 'x' })).resolves.toBeUndefined()
  })
})

describe('lib/cron-heartbeat — runCron', () => {
  it('records completed and returns the inner result on success', async () => {
    const { runCron } = await import('@/lib/cron-heartbeat')
    const result = await runCron('devis-reminder', async () => 42)
    expect(result).toBe(42)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ cron_name: 'devis-reminder', status: 'completed' })
    )
  })

  it('records failed and re-throws on inner error', async () => {
    const { runCron } = await import('@/lib/cron-heartbeat')
    await expect(
      runCron('devis-reminder', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cron_name: 'devis-reminder',
        status: 'failed',
        details: { error: 'boom' },
      })
    )
  })
})
