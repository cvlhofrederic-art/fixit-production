import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Sur un Worker Cloudflare, process.env n'expose pas toujours les secrets : hydraterSecrets
// les recopie depuis getCloudflareContext().env pour le code qui les lit de façon synchrone
// (fournisseurs de boîte e-mail d'Alfredo).

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: { MICROSOFT_CLIENT_ID: 'id-du-worker', GOOGLE_CLIENT_ID: 'google-du-worker' },
  })),
}))

describe('hydraterSecrets', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('MICROSOFT_CLIENT_ID', '')
    vi.stubEnv('GOOGLE_CLIENT_ID', 'deja-present')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('recopie un secret absent de process.env et garde ceux déjà présents', async () => {
    const { hydraterSecrets } = await import('@/lib/env')
    await hydraterSecrets(['MICROSOFT_CLIENT_ID', 'GOOGLE_CLIENT_ID', 'INCONNU'])
    expect(process.env.MICROSOFT_CLIENT_ID).toBe('id-du-worker')
    expect(process.env.GOOGLE_CLIENT_ID).toBe('deja-present')
    expect(process.env.INCONNU).toBeUndefined()
  })

  it('chargerSecretsBoites couvre les identifiants Google et Microsoft', async () => {
    const { SECRETS_BOITES } = await import('@/lib/email-agent/secrets')
    expect(SECRETS_BOITES).toEqual(expect.arrayContaining(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET']))
  })
})
