import { describe, it, expect, vi, beforeEach } from 'vitest'

const scanDepartmentMock = vi.fn()
vi.mock('@/lib/tenders/scanner', () => ({
  scanDepartment: scanDepartmentMock,
}))

const recentLookup = vi.fn()
const upsertMock = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

const fromMock = vi.fn().mockImplementation((table: string) => {
  if (table !== 'background_jobs') throw new Error(`unexpected table ${table}`)
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          contains: () => ({
            gte: () => ({
              limit: () => ({
                maybeSingle: () => recentLookup(),
              }),
            }),
          }),
        }),
      }),
    }),
    upsert: (payload: unknown) => {
      upsertMock(payload)
      return Promise.resolve({ error: null })
    },
    update: (payload: unknown) => updateMock(payload),
  }
})

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: fromMock },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  recentLookup.mockResolvedValue({ data: null })
})

describe('runTendersScanJob', () => {
  it('skips when a recent successful run exists', async () => {
    recentLookup.mockResolvedValueOnce({ data: { id: 'old-job', completed_at: new Date().toISOString() } })
    const { runTendersScanJob } = await import('@/lib/queue/consumers/tenders-scan')
    const res = await runTendersScanJob({ department: '13' })
    expect(res.status).toBe('skipped_recent')
    expect(scanDepartmentMock).not.toHaveBeenCalled()
  })

  it('runs the scan, marks job processing then completed', async () => {
    scanDepartmentMock.mockResolvedValueOnce({ meta: { total_after_dedup: 42 } })
    const { runTendersScanJob } = await import('@/lib/queue/consumers/tenders-scan')
    const res = await runTendersScanJob({ department: '13' }, { jobId: 'job-1' })
    expect(res.status).toBe('completed')
    expect(res.meta?.total_after_dedup).toBe(42)
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-1',
        type: 'tenders-scan',
        status: 'processing',
        payload: { department: '13' },
      })
    )
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        result: { total_after_dedup: 42 },
      })
    )
  })

  it('marks the job failed when scanDepartment throws', async () => {
    scanDepartmentMock.mockRejectedValueOnce(new Error('boamp 503'))
    const { runTendersScanJob } = await import('@/lib/queue/consumers/tenders-scan')
    const res = await runTendersScanJob({ department: '13' }, { jobId: 'job-2' })
    expect(res.status).toBe('failed')
    expect(res.error).toBe('boamp 503')
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: 'boamp 503' })
    )
  })

  it('continues even if the idempotency lookup itself errors', async () => {
    recentLookup.mockRejectedValueOnce(new Error('table missing'))
    scanDepartmentMock.mockResolvedValueOnce({ meta: { total_after_dedup: 0 } })
    const { runTendersScanJob } = await import('@/lib/queue/consumers/tenders-scan')
    const res = await runTendersScanJob({ department: '13' })
    expect(res.status).toBe('completed')
  })
})
