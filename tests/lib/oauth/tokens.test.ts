import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_KEY = process.env.OAUTH_TOKENS_ENCRYPTION_KEY

afterEach(() => {
  if (ORIGINAL_KEY !== undefined) {
    process.env.OAUTH_TOKENS_ENCRYPTION_KEY = ORIGINAL_KEY
  } else {
    delete process.env.OAUTH_TOKENS_ENCRYPTION_KEY
  }
})

describe('OAuth tokens encryption wrapper', () => {
  describe('getEncryptionKey', () => {
    it('lit la clé depuis OAUTH_TOKENS_ENCRYPTION_KEY', async () => {
      process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'test-key-32-chars-long-padding!!'
      const { getEncryptionKey } = await import('@/lib/oauth/tokens')
      expect(getEncryptionKey()).toBe('test-key-32-chars-long-padding!!')
    })

    it('throw si la clé absente', async () => {
      delete process.env.OAUTH_TOKENS_ENCRYPTION_KEY
      const { getEncryptionKey } = await import('@/lib/oauth/tokens')
      expect(() => getEncryptionKey()).toThrow(/OAUTH_TOKENS_ENCRYPTION_KEY/)
    })

    it('throw si la clé < 32 chars', async () => {
      process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'too-short'
      const { getEncryptionKey } = await import('@/lib/oauth/tokens')
      expect(() => getEncryptionKey()).toThrow(/at least 32/)
    })
  })

  describe('ENCRYPTION_VERSION', () => {
    it('expose la version courante = 1', async () => {
      const { ENCRYPTION_VERSION } = await import('@/lib/oauth/tokens')
      expect(ENCRYPTION_VERSION).toBe(1)
    })
  })

  describe('setEncryptedToken', () => {
    beforeEach(() => {
      process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'test-key-32-chars-long-padding!!'
    })

    it('configure SET LOCAL app.oauth_encryption_key puis appelle RPC set_encrypted_oauth_token', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockClient = { rpc: rpcMock } as unknown as Parameters<typeof import('@/lib/oauth/tokens').setEncryptedToken>[0]

      const { setEncryptedToken } = await import('@/lib/oauth/tokens')
      await setEncryptedToken(mockClient, {
        syndic_id: 's1',
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })

      // Premier appel : set_config pour la clé locale
      expect(rpcMock).toHaveBeenCalledWith(
        'set_config',
        expect.objectContaining({
          parameter: 'app.oauth_encryption_key',
          is_local: true,
        }),
      )
      // Second appel : set_encrypted_oauth_token avec les params
      expect(rpcMock).toHaveBeenCalledWith(
        'set_encrypted_oauth_token',
        expect.objectContaining({
          p_syndic_id: 's1',
          p_access_token: 'mock-access-token',
          p_refresh_token: 'mock-refresh-token',
        }),
      )
    })

    it('throw si la RPC retourne une erreur', async () => {
      const rpcMock = vi.fn()
        .mockResolvedValueOnce({ data: null, error: null }) // set_config
        .mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } })
      const mockClient = { rpc: rpcMock } as unknown as Parameters<typeof import('@/lib/oauth/tokens').setEncryptedToken>[0]

      const { setEncryptedToken } = await import('@/lib/oauth/tokens')
      await expect(setEncryptedToken(mockClient, {
        syndic_id: 's1',
        access_token: 'a',
        refresh_token: 'b',
        expires_at: new Date().toISOString(),
      })).rejects.toThrow(/rpc failed/)
    })
  })

  describe('getDecryptedToken', () => {
    beforeEach(() => {
      process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'test-key-32-chars-long-padding!!'
    })

    it('retourne null si aucun token stocké', async () => {
      const rpcMock = vi.fn()
        .mockResolvedValueOnce({ data: null, error: null }) // set_config
        .mockResolvedValueOnce({ data: [], error: null })   // RPC retourne tableau vide
      const mockClient = { rpc: rpcMock } as unknown as Parameters<typeof import('@/lib/oauth/tokens').getDecryptedToken>[0]

      const { getDecryptedToken } = await import('@/lib/oauth/tokens')
      const result = await getDecryptedToken(mockClient, 'unknown')
      expect(result).toBeNull()
    })

    it('retourne le token décrypté si présent', async () => {
      const rpcMock = vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: [{
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_at: '2026-05-12T00:00:00Z',
          }],
          error: null,
        })
      const mockClient = { rpc: rpcMock } as unknown as Parameters<typeof import('@/lib/oauth/tokens').getDecryptedToken>[0]

      const { getDecryptedToken } = await import('@/lib/oauth/tokens')
      const result = await getDecryptedToken(mockClient, 's1')
      expect(result?.access_token).toBe('mock-access-token')
      expect(result?.refresh_token).toBe('mock-refresh-token')
    })
  })
})
