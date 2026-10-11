// Connexion de la boîte Gmail du cabinet (GET /api/email-agent/connect) et état de la
// boîte pour l'écran « E-mails Fixy » du Syndic v54 (GET /api/email-agent/status).
// Démo du 12/10 : le super admin (cabinet = son propre compte) doit pouvoir connecter
// Alfredo à sa boîte ; le jeton de session ne passe plus dans l'URL (?format=json).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const etat = vi.hoisted(() => ({
  user: null as null | { id: string; app_metadata: Record<string, unknown> },
  ligneJeton: null as null | Record<string, unknown>,
  emails: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
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
    return chain
  }
  const emails = () => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.order = vi.fn(() => chain)
    chain.limit = vi.fn(async () => ({ data: etat.emails, error: null }))
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

function requete(url: string, jeton = 'jwt-test') {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${jeton}` } })
}

describe('GET /api/email-agent/connect', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client-test.apps.googleusercontent.com')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
    etat.user = SUPER_ADMIN
    etat.ligneJeton = null
    etat.inserts = []
    etat.updates = []
  })
  afterEach(() => vi.unstubAllEnvs())

  it('super admin : renvoie l’adresse Google en JSON (jeton jamais dans l’URL) et crée la ligne du nonce', async () => {
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

  it('reconnexion : met à jour le nonce sans écraser les tokens en place', async () => {
    etat.ligneJeton = { syndic_id: SUPER_ADMIN.id }
    const { GET } = await import('@/app/api/email-agent/connect/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect?format=json'))
    expect(res.status).toBe(200)
    expect(etat.inserts).toHaveLength(0)
    expect(etat.updates).toHaveLength(1)
    expect(etat.updates[0]).not.toHaveProperty('access_token')
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
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect?format=json'))
    expect(res.status).toBe(403)
    expect(etat.inserts).toHaveLength(0)
  })

  it('Google non configuré : 500 explicite', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    const { GET } = await import('@/app/api/email-agent/connect/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/connect?format=json'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Google OAuth non configuré' })
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

  it('boîte connectée : adresse, e-mails et brouillons à valider', async () => {
    etat.ligneJeton = { email_compte: 'frederic@gmail.com', access_token: 'ya29.x', updated_at: '2026-10-11T20:00:00Z' }
    etat.emails = [
      { id: 'e1', from_email: 'a@example.fr', subject: 'Fuite', draft_status: 'pending_review' },
      { id: 'e2', from_email: 'b@example.fr', subject: 'Pub', draft_status: 'none' },
    ]
    const { GET } = await import('@/app/api/email-agent/status/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/status'))
    const j = await res.json()
    expect(j).toMatchObject({ cabinetId: SUPER_ADMIN.id, connecte: true, email: 'frederic@gmail.com', brouillonsEnAttente: 1 })
    expect(j.emails).toHaveLength(2)
    expect(JSON.stringify(j)).not.toContain('ya29')
  })

  it('connexion commencée puis abandonnée (ligne sans access_token) : non connectée', async () => {
    etat.ligneJeton = { email_compte: '', access_token: '', updated_at: '2026-10-11T20:00:00Z' }
    const { GET } = await import('@/app/api/email-agent/status/route')
    const res = await GET(requete('https://vitfix.io/api/email-agent/status'))
    expect(await res.json()).toMatchObject({ connecte: false, email: null })
  })
})
