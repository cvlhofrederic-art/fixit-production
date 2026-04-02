import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id')
vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret')

describe('refreshGmailAccessToken', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns tokens on successful refresh', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-token', expires_in: 3600 }),
    })

    const { refreshGmailAccessToken } = await import('../lib/auth-helpers')
    const result = await refreshGmailAccessToken('my-refresh-token')

    expect(result).toEqual({ access_token: 'new-token', expires_in: 3600 })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    )
  })

  it('returns null on failed refresh', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const { refreshGmailAccessToken } = await import('../lib/auth-helpers')
    const result = await refreshGmailAccessToken('bad-token')

    expect(result).toBeNull()
  })
})
