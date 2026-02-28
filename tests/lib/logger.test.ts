import { describe, it, expect, vi } from 'vitest'
import { logger } from '@/lib/logger'

describe('Structured Logger', () => {
  it('should log info messages as JSON', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.info('test message', { key: 'value' })
    expect(spy).toHaveBeenCalledOnce()
    const logged = JSON.parse(spy.mock.calls[0][0])
    expect(logged.level).toBe('info')
    expect(logged.message).toBe('test message')
    expect(logged.context.key).toBe('value')
    expect(logged.timestamp).toBeDefined()
    spy.mockRestore()
  })

  it('should log errors with stack trace', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('test error')
    logger.error('something failed', {}, err)
    expect(spy).toHaveBeenCalledOnce()
    const logged = JSON.parse(spy.mock.calls[0][0])
    expect(logged.level).toBe('error')
    expect(logged.error.name).toBe('Error')
    expect(logged.error.message).toBe('test error')
    expect(logged.error.stack).toBeDefined()
    spy.mockRestore()
  })

  it('should log API calls with correct level based on status', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.api('/api/test', 'GET', 200, 50)
    const logged = JSON.parse(spy.mock.calls[0][0])
    expect(logged.level).toBe('info')
    expect(logged.context.statusCode).toBe(200)
    spy.mockRestore()
  })

  it('should log 500 errors as error level', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.api('/api/test', 'POST', 500, 100)
    const logged = JSON.parse(spy.mock.calls[0][0])
    expect(logged.level).toBe('error')
    spy.mockRestore()
  })
})
