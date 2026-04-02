import { describe, it, expect } from 'vitest'

describe('getBackoffDelay', () => {
  it('starts at 1 second', async () => {
    const { getBackoffDelay } = await import('../lib/realtime-reconnect')
    expect(getBackoffDelay(0)).toBe(1000)
  })

  it('doubles each attempt', async () => {
    const { getBackoffDelay } = await import('../lib/realtime-reconnect')
    expect(getBackoffDelay(1)).toBe(2000)
    expect(getBackoffDelay(2)).toBe(4000)
    expect(getBackoffDelay(3)).toBe(8000)
  })

  it('caps at 30 seconds', async () => {
    const { getBackoffDelay } = await import('../lib/realtime-reconnect')
    expect(getBackoffDelay(5)).toBe(30000)
    expect(getBackoffDelay(10)).toBe(30000)
  })
})
