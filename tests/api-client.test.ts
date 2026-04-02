import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('authFetch', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  it('adds Authorization Bearer header and Content-Type for JSON', async () => {
    const { authFetch } = await import('../lib/api-client')
    await authFetch('/api/test', 'my-token')

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer my-token',
      },
    })
  })

  it('merges custom options', async () => {
    const { authFetch } = await import('../lib/api-client')
    await authFetch('/api/test', 'tok', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer tok',
      },
    })
  })

  it('skips Content-Type for FormData body', async () => {
    const { authFetch } = await import('../lib/api-client')
    const fd = new FormData()
    await authFetch('/api/upload', 'tok', { method: 'POST', body: fd })

    expect(mockFetch).toHaveBeenCalledWith('/api/upload', {
      method: 'POST',
      body: fd,
      headers: {
        'Authorization': 'Bearer tok',
      },
    })
  })
})
