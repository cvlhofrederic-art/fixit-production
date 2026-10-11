// Connexion de la boîte e-mail du cabinet (GET /api/email-agent/connect?provider=gmail|microsoft),
// déconnexion (DELETE /api/email-agent/connect[?purger=1]) et état de la boîte pour l'écran
// « E-mails Fixy » du Syndic v54 (GET /api/email-agent/status).
// Démo du 12/10 : le super admin (cabinet = son propre compte) connecte Alfredo à la boîte
// Microsoft 365 h.carvalho@ajassocies.fr ; le jeton de session ne passe pas dans l'URL.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const etat = vi.hoisted(() => ({
  user: null as null | { id: string; app_metadata: Record<string, unknown> },
  ligneJeton: null as null | Record<string, unknown>,
  emails: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  // Déconnexion : lignes en base, et filtres reçus par les suppressions.
  emailsEnBase: [] as { syndic_id: string; gmail_message_id: string }[],
  suppressionsJeton: [] as unknown[],
  filtresPurge: [] as unknown[][],
  erreurPurge: null as null | { message: string },
}))

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/auth-helpers', () => ({
  getUserRole: (u: { app_metadata?: { role?: string } }) => u?.app_metadata?.role || '',
  isSyndicRole: (u: { app_metadata?: { role?: string } }) => {
    const r = u?.app_metadata?.role || ''
    return r === 'syndic' || r.startsWith('syndic_') || r === 'super_admin'
  },
  getAuthUser: vi.fn(async () => etat.user),
  resolveCabinetId: vi.fn(async (u: { id: string }) => u.id),
}))

vi.mock('@/lib/supabase-server', () => {
  const tokens = () => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.maybeSingle = vi.fn(async () => ({ data: etat.ligneJeton, error: null }))
    chain.update = vi.fn((v: Record<string, unknown>) => { etat.updates.push(v); return { eq: vi.fn(async () => ({ error: null })) } })
    chain.insert = vi.fn(async (v: Record<string, unknown>) => { etat.inserts.push(v); return { error: null } })
    chain.delete = vi.fn(() => ({
      eq: vi.fn(async (col: string, val: string) => {
        etat.suppressionsJeton.push([col, val])
        const count = etat.ligneJeton ? 1 : 0
        etat.ligneJeton = null
        return { error: null, count }
      }),
    }))
    return chain
  }
  const emails = () => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.order = vi.fn(() => chain)
    chain.limit = vi.fn(async () => ({ data: etat.emails, error: null }))
    // delete → eq(syndic_id) → not(gmail_message_id, like, motif) : appliqué aux lignes en mémoire.
    chain.delete = vi.fn(() => ({
      eq: vi.fn((colSyndic: string, syndicId: string) => ({
        not: vi.fn(async (col: string, op: string, motif: string) => {
          etat.filtresPurge.push([colSyndic, syndicId, col, op, motif])
          if (etat.erreurPurge) return { error: etat.erreurPurge, count: null }
          const correspond = (v: string) => (op === 'like' && motif.endsWith('%') ? v.startsWith(motif.slice(0, -1)) : v === motif)
          const avant = etat.emailsEnBase.length
          etat.emailsEnBase = etat.emailsEnBase.filter(r => !(r.syndic_id === syndicId && !correspond(r.gmail_message_id)))
          return { error: null, count: avant - etat.emailsEnBase.length }
        }),
      })),
    }))
    return chain
  }
  return {
    supabaseAdmin: {
      auth: { getUser: vi.fn(async () => ({ data: { user: etat.user }, error: etat.user ? null : new Error('jeton invalide') })) },
      from: (table: string) => (table === 'syndic_oauth_tokens' ? tokens() : emails()),
    },
  }
})

const SUPER_ADMIN = { id: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4', app_metadata: { role: 'super_admin' } }

function requete(url: string, jeton = 'jwt-test', method = 'GET') {
  return new NextRequest(url, { method, headers: { Authorization: `Bearer ${jeton}` } })
}

function stubSecrets() {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'client-test.apps.googleusercontent.com')
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'GOCSPX-test')
  vi.stubEnv('MICROSOFT_CLIENT_ID', '11111111-2222-3333-4444-555555555555')
  vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'secret-microsoft-test')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
}

describe('GET /api/email-agent/connect', () => {
  beforeEach(() => {
    stubSecrets()
    etat.user = SUPER_ADMIN
    etat.ligneJeton = null
    etat.inserts = []
    etat.updates = []
  })
  afterEach(() => vi.unstubAllEnvs())

  it('super admin, sans provider : adresse Google en JSON (jeton jamais dans l’URL) et ligne du nonce créée', async () => {
    const { GET } = await import('@/app/api/email-agent/connect/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect?format=json'))
    expect(res.status).toBe(200)
    const { url } = await res.json()
    const google = new URL(url)
    expect(google.origin).toBe('https://accounts.google.com')
    expect(google.searchParams.get('client_id')).toBe('client-test.apps.googleusercontent.com')
    expect(google.searchParams.get('redirect_uri')).toBe('https://vitfix.io/api/email-agent/callback')
    expect(google.searchParams.get('state')).toMatch(new RegExp(`^${SUPER_ADMIN.id}:`))
    expect(url).not.toContain('jwt-test')
    // Première connexion : access_token / token_expiry sont NOT NULL → valeurs vides remplacées par le callback.
    expect(etat.inserts).toHaveLength(1)
    expect(etat.inserts[0]).toMatchObject({ syndic_id: SUPER_ADMIN.id, provider: 'gmail', access_token: '' })
    expect(etat.inserts[0].token_expiry).toEqual(expect.any(String))
    expect(etat.inserts[0].oauth_nonce).toBe(google.searchParams.get('state')!.split(':')[1])
  })

  it('?provider=microsoft : adresse Microsoft (autorité common, scopes lecture, state avec nonce rangé)', async () => {
    const { GET } = await import('@/app/api/email-agent/connect/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect?format=json&provider=microsoft'))
    expect(res.status).toBe(200)
    const { url } = await res.json()
    const ms = new URL(url)
    expect(`${ms.origin}${ms.pathname}`).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    expect(ms.searchParams.get('client_id')).toBe('11111111-2222-3333-4444-555555555555')
    expect(ms.searchParams.get('redirect_uri')).toBe('https://vitfix.io/api/email-agent/callback/microsoft')
    expect(ms.searchParams.get('response_type')).toBe('code')
    expect(ms.searchParams.get('response_mode')).toBe('query')
    expect(ms.searchParams.get('scope')).toBe('offline_access User.Read Mail.Read')
    expect(ms.searchParams.get('prompt')).toBe('select_account')
    expect(url).not.toContain('secret-microsoft-test')
    const [syndicId, nonce] = ms.searchParams.get('state')!.split(':')
    expect(syndicId).toBe(SUPER_ADMIN.id)
    expect(etat.inserts[0]).toMatchObject({ syndic_id: SUPER_ADMIN.id, provider: 'microsoft', access_token: '', oauth_nonce: nonce })
  })

  it('provider inconnu : 400', async () => {
    const { GET } = await import('@/app/api/email-agent/connect/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect?format=json&provider=yahoo'))
    expect(res.status).toBe(400)
    expect(etat.inserts).toHaveLength(0)
  })

  it('reconnexion (ou changement de fournisseur) : met à jour le nonce sans écraser les jetons ni le provider', async () => {
    etat.ligneJeton = { syndic_id: SUPER_ADMIN.id }
    const { GET } = await import('@/app/api/email-agent/connect/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect?format=json&provider=microsoft'))
    expect(res.status).toBe(200)
    expect(etat.inserts).toHaveLength(0)
    expect(etat.updates).toHaveLength(1)
    expect(etat.updates[0]).not.toHaveProperty('access_token')
    expect(etat.updates[0]).not.toHaveProperty('provider')
    expect(etat.updates[0]).toHaveProperty('oauth_nonce')
  })

  it('sans ?format=json : redirige vers Google (ancien bouton)', async () => {
    const { GET } = await import('@/app/api/email-agent/connect/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('https://accounts.google.com/o/oauth2/v2/auth')
  })

  it('refuse un artisan', async () => {
    etat.user = { id: 'artisan-1', app_metadata: { role: 'artisan' } }
    const { GET } = await import('@/app/api/email-agent/connect/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect?format=json&provider=microsoft'))
    expect(res.status).toBe(403)
    expect(etat.inserts).toHaveLength(0)
  })

  it('Google non configuré : 500 explicite nommant le secret manquant', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    const { GET } = await import('@/app/api/email-agent/connect/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect?format=json'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Connexion Gmail / Google Workspace non configurée sur le serveur : GOOGLE_CLIENT_ID manquant.' })
    expect(etat.inserts).toHaveLength(0)
  })

  it('Microsoft non configuré : 500 explicite nommant les secrets manquants, aucun nonce rangé', async () => {
    vi.stubEnv('MICROSOFT_CLIENT_ID', '')
    vi.stubEnv('MICROSOFT_CLIENT_SECRET', '')
    const { GET } = await import('@/app/api/email-agent/connect/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect?format=json&provider=microsoft'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: 'Connexion Outlook / Microsoft 365 non configurée sur le serveur : MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET manquants.',
    })
    expect(etat.inserts).toHaveLength(0)
    expect(etat.updates).toHaveLength(0)
  })

  it('Microsoft sans secret client seulement : le nomme', async () => {
    vi.stubEnv('MICROSOFT_CLIENT_SECRET', '')
    const { GET } = await import('@/app/api/email-agent/connect/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect?format=json&provider=microsoft'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('MICROSOFT_CLIENT_SECRET manquant.')
  })
})

describe('DELETE /api/email-agent/connect — déconnexion de la boîte', () => {
  beforeEach(() => {
    etat.user = SUPER_ADMIN
    etat.ligneJeton = { syndic_id: SUPER_ADMIN.id, provider: 'microsoft', access_token: 'eyJ0' }
    etat.suppressionsJeton = []
    etat.filtresPurge = []
    etat.erreurPurge = null
    etat.emailsEnBase = [
      { syndic_id: SUPER_ADMIN.id, gmail_message_id: 'AAMkAGI2-1' },
      { syndic_id: SUPER_ADMIN.id, gmail_message_id: '18c2f5a9e' },
      { syndic_id: SUPER_ADMIN.id, gmail_message_id: 'demo-mrs-01' },
      { syndic_id: SUPER_ADMIN.id, gmail_message_id: 'demo-mrs-02' },
      { syndic_id: 'autre-cabinet', gmail_message_id: 'AAMkAGI2-9' },
    ]
  })

  it('supprime la ligne de jetons du cabinet, sans toucher aux e-mails analysés', async () => {
    const { DELETE } = await import('@/app/api/email-agent/connect/route')
    const res = await DELETE(requete('https://vitfix.io/api/email-agent/connect', 'jwt-test', 'DELETE'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ boitesSupprimees: 1, emailsSupprimes: 0 })
    expect(etat.suppressionsJeton).toEqual([['syndic_id', SUPER_ADMIN.id]])
    expect(etat.filtresPurge).toHaveLength(0)
    expect(etat.emailsEnBase).toHaveLength(5)
  })

  it('?purger=1 : efface aussi les e-mails analysés du cabinet, sauf ceux de démonstration (demo-…)', async () => {
    const { DELETE } = await import('@/app/api/email-agent/connect/route')
    const res = await DELETE(requete('https://vitfix.io/api/email-agent/connect?purger=1', 'jwt-test', 'DELETE'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ boitesSupprimees: 1, emailsSupprimes: 2 })
    expect(etat.filtresPurge).toEqual([['syndic_id', SUPER_ADMIN.id, 'gmail_message_id', 'like', 'demo-%']])
    expect(etat.emailsEnBase.map(r => r.gmail_message_id).sort()).toEqual(['AAMkAGI2-9', 'demo-mrs-01', 'demo-mrs-02'])
  })

  it('purge en échec : 500, la boîte est quand même déconnectée', async () => {
    etat.erreurPurge = { message: 'db down' }
    const { DELETE } = await import('@/app/api/email-agent/connect/route')
    const res = await DELETE(requete('https://vitfix.io/api/email-agent/connect?purger=1', 'jwt-test', 'DELETE'))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ boitesSupprimees: 1, emailsSupprimes: 0 })
  })

  it('non connecté : 401 ; artisan ou employé syndic : 403, rien n’est supprimé', async () => {
    const { DELETE } = await import('@/app/api/email-agent/connect/route')
    etat.user = null
    expect((await DELETE(requete('https://vitfix.io/api/email-agent/connect', 'jwt-test', 'DELETE'))).status).toBe(401)
    etat.user = { id: 'artisan-1', app_metadata: { role: 'artisan' } }
    expect((await DELETE(requete('https://vitfix.io/api/email-agent/connect?purger=1', 'jwt-test', 'DELETE'))).status).toBe(403)
    etat.user = { id: 'secretaire-1', app_metadata: { role: 'syndic_secretaire' } }
    expect((await DELETE(requete('https://vitfix.io/api/email-agent/connect', 'jwt-test', 'DELETE'))).status).toBe(403)
    expect(etat.suppressionsJeton).toHaveLength(0)
    expect(etat.filtresPurge).toHaveLength(0)
  })

  it('paramètre purger invalide : 400', async () => {
    const { DELETE } = await import('@/app/api/email-agent/connect/route')
    const res = await DELETE(requete('https://vitfix.io/api/email-agent/connect?purger=tout', 'jwt-test', 'DELETE'))
    expect(res.status).toBe(400)
    expect(etat.suppressionsJeton).toHaveLength(0)
  })
})

describe('GET /api/email-agent/status', () => {
  beforeEach(() => {
    etat.user = SUPER_ADMIN
    etat.ligneJeton = null
    etat.emails = []
  })

  it('non connecté : 401', async () => {
    etat.user = null
    const { GET } = await import('@/app/api/email-agent/status/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/status'))
    expect(res.status).toBe(401)
  })

  it('boîte Gmail connectée : adresse, provider, e-mails et brouillons à valider', async () => {
    etat.ligneJeton = { provider: 'gmail', email_compte: 'frederic@gmail.com', access_token: 'ya29.x', updated_at: '2026-10-11T20:00:00Z' }
    etat.emails = [
      { id: 'e1', from_email: 'a@example.fr', subject: 'Fuite', draft_status: 'pending_review' },
      { id: 'e2', from_email: 'b@example.fr', subject: 'Pub', draft_status: 'none' },
    ]
    const { GET } = await import('@/app/api/email-agent/status/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/status'))
    const j = await res.json()
    expect(j).toMatchObject({ cabinetId: SUPER_ADMIN.id, connecte: true, provider: 'gmail', email: 'frederic@gmail.com', brouillonsEnAttente: 1 })
    expect(j.emails).toHaveLength(2)
    expect(JSON.stringify(j)).not.toContain('ya29')
  })

  it('boîte Microsoft 365 connectée : provider « microsoft »', async () => {
    etat.ligneJeton = { provider: 'microsoft', email_compte: 'h.carvalho@ajassocies.fr', access_token: 'eyJ0eXAi', updated_at: '2026-10-11T20:00:00Z' }
    const { GET } = await import('@/app/api/email-agent/status/route')
    const j = await (await GET(requete('https://vitfix.io/api/email-agent/status'))).json()
    expect(j).toMatchObject({ connecte: true, provider: 'microsoft', email: 'h.carvalho@ajassocies.fr' })
    expect(JSON.stringify(j)).not.toContain('eyJ0eXAi')
  })

  it('ligne sans provider (ancienne ligne) : gmail par défaut', async () => {
    etat.ligneJeton = { provider: null, email_compte: 'frederic@gmail.com', access_token: 'ya29.x', updated_at: null }
    const { GET } = await import('@/app/api/email-agent/status/route')
    const j = await (await GET(requete('https://vitfix.io/api/email-agent/status'))).json()
    expect(j.provider).toBe('gmail')
  })

  it('connexion commencée puis abandonnée (ligne sans access_token) : non connectée, provider null', async () => {
    etat.ligneJeton = { provider: 'microsoft', email_compte: '', access_token: '', updated_at: '2026-10-11T20:00:00Z' }
    const { GET } = await import('@/app/api/email-agent/status/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/status'))
    expect(await res.json()).toMatchObject({ connecte: false, provider: null, email: null })
  })
})
