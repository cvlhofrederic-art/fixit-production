import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const scanDepartmentMock = vi.fn()
vi.mock('@/lib/tenders/scanner', () => ({
  scanDepartment: scanDepartmentMock,
}))

const runTendersScanJobMock = vi.fn()
vi.mock('@/lib/queue/consumers/tenders-scan', () => ({
  TENDERS_SCAN_JOB_TYPE: 'tenders-scan',
  runTendersScanJob: (...args: unknown[]) => runTendersScanJobMock(...args),
}))

const getCloudflareContextMock = vi.fn()
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: (...args: unknown[]) => getCloudflareContextMock(...args),
}))

const getAuthUserMock = vi.fn()
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: (...args: unknown[]) => getAuthUserMock(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const ORIGINAL_PROCESS = (globalThis as unknown as { process?: NodeJS.Process }).process

beforeEach(() => {
  vi.clearAllMocks()
  // Restore process to a clean copy so each test controls bindings.
  ;(globalThis as unknown as { process: NodeJS.Process }).process = {
    ...ORIGINAL_PROCESS,
    env: { ...ORIGINAL_PROCESS?.env, CRON_SECRET: 'topsecret' },
  } as NodeJS.Process
})

afterEach(() => {
  ;(globalThis as unknown as { process?: NodeJS.Process }).process = ORIGINAL_PROCESS
})

function makeRequest(headers: Record<string, string> = {}, body: unknown = {}): Request {
  return new Request('https://test.local/api/tenders/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/tenders/scan', () => {
  it('returns 401 without any auth', async () => {
    getAuthUserMock.mockResolvedValueOnce(null)
    getCloudflareContextMock.mockRejectedValue(new Error('no cf'))
    const { POST } = await import('@/app/api/tenders/scan/route')
    const res = await POST(makeRequest() as never)
    expect(res.status).toBe(401)
  })

  it('runs inline scan when neither SYNC_QUEUE nor Cloudflare context are present', async () => {
    getCloudflareContextMock.mockRejectedValue(new Error('no cf'))
    scanDepartmentMock.mockResolvedValueOnce({ meta: { total_after_dedup: 7 } })
    const { POST } = await import('@/app/api/tenders/scan/route')
    const res = await POST(makeRequest({ 'x-cron-secret': 'topsecret' }, { department: '13' }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.queued).toBe(false)
    expect(body.total_after_dedup).toBe(7)
    expect(scanDepartmentMock).toHaveBeenCalledWith('13')
  })

  it('dispatches via ctx.waitUntil when Cloudflare context is available (no queue)', async () => {
    const waitUntil = vi.fn()
    getCloudflareContextMock.mockResolvedValueOnce({ ctx: { waitUntil } })
    runTendersScanJobMock.mockResolvedValueOnce({ status: 'completed', jobId: 'x', meta: { total_after_dedup: 0 } })
    const { POST } = await import('@/app/api/tenders/scan/route')
    const res = await POST(makeRequest({ 'x-cron-secret': 'topsecret' }, { department: '13' }) as never)
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.queued).toBe(false)
    expect(body.dispatched).toBe(true)
    expect(body.jobId).toMatch(/^[0-9a-f-]+$/)
    expect(waitUntil).toHaveBeenCalledTimes(1)
    expect(scanDepartmentMock).not.toHaveBeenCalled()
  })

  it('enqueues and returns 202 when SYNC_QUEUE binding is wired', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    ;(
      (globalThis as unknown as { process: { env: Record<string, unknown> } }).process
    ).env = {
      ...(globalThis as unknown as { process: { env: Record<string, unknown> } }).process.env,
      SYNC_QUEUE: { send },
    }
    const { POST } = await import('@/app/api/tenders/scan/route')
    const res = await POST(makeRequest({ 'x-cron-secret': 'topsecret' }, { department: '13' }) as never)
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.queued).toBe(true)
    expect(body.jobId).toMatch(/^[0-9a-f-]+$/)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tenders-scan',
        payload: { department: '13' },
      })
    )
    expect(scanDepartmentMock).not.toHaveBeenCalled()
  })

  it('falls back to ctx.waitUntil when SYNC_QUEUE.send throws but Cloudflare context is available', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('queue down'))
    ;(
      (globalThis as unknown as { process: { env: Record<string, unknown> } }).process
    ).env = {
      ...(globalThis as unknown as { process: { env: Record<string, unknown> } }).process.env,
      SYNC_QUEUE: { send },
    }
    const waitUntil = vi.fn()
    getCloudflareContextMock.mockResolvedValueOnce({ ctx: { waitUntil } })
    runTendersScanJobMock.mockResolvedValueOnce({ status: 'completed', jobId: 'x' })
    const { POST } = await import('@/app/api/tenders/scan/route')
    const res = await POST(makeRequest({ 'x-cron-secret': 'topsecret' }, { department: '13' }) as never)
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.queued).toBe(false)
    expect(body.dispatched).toBe(true)
    expect(waitUntil).toHaveBeenCalledTimes(1)
    expect(scanDepartmentMock).not.toHaveBeenCalled()
  })

  it('falls back to inline scan when both queue.send and Cloudflare context fail', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('queue down'))
    ;(
      (globalThis as unknown as { process: { env: Record<string, unknown> } }).process
    ).env = {
      ...(globalThis as unknown as { process: { env: Record<string, unknown> } }).process.env,
      SYNC_QUEUE: { send },
    }
    getCloudflareContextMock.mockRejectedValue(new Error('no cf'))
    scanDepartmentMock.mockResolvedValueOnce({ meta: { total_after_dedup: 3 } })
    const { POST } = await import('@/app/api/tenders/scan/route')
    const res = await POST(makeRequest({ 'x-cron-secret': 'topsecret' }, { department: '13' }) as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.queued).toBe(false)
    expect(scanDepartmentMock).toHaveBeenCalledWith('13')
  })

  it('rejects an invalid department code', async () => {
    getCloudflareContextMock.mockRejectedValue(new Error('no cf'))
    const { POST } = await import('@/app/api/tenders/scan/route')
    const res = await POST(makeRequest({ 'x-cron-secret': 'topsecret' }, { department: 'abc' }) as never)
    expect(res.status).toBe(400)
  })
})
