// @vitest-environment node
// POST /api/email-agent/connect-imap : boîte « autre messagerie » (IMAP) du cabinet.
// Validation Zod, rôles, limite de tentatives, connexion testée avant tout
// enregistrement, mot de passe chiffré (jamais renvoyé ni journalisé), ligne
// syndic_oauth_tokens provider 'imap' sans migration, première relève lancée.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const etat = vi.hoisted(() => ({
  user: null as null | { id: string; app_metadata: Record<string, unknown> },
  autorise: true,
  upserts: [] as Array<{ valeur: Record<string, unknown>; options: unknown }>,
  erreurUpsert: null as null | { message: string },
}))

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => etat.user),
  getUserRole: (u: { app_metadata?: { role?: string } }) => u?.app_metadata?.role || '',
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => etat.autorise),
  rateLimitResponse: () => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 }),
}))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      upsert: vi.fn(async (valeur: Record<string, unknown>, options: unknown) => {
        etat.upserts.push({ valeur, options })
        return { error: etat.erreurUpsert }
      }),
    })),
  },
}))

vi.mock('@/lib/email-agent/imap/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email-agent/imap/client')>()),
  testerConnexionImap: vi.fn(async () => undefined),
}))

vi.mock('@/lib/email-agent/retour-oauth', () => ({ declencherPremiereReleve: vi.fn() }))

import { POST } from '@/app/api/email-agent/connect-imap/route'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { ErreurImap, testerConnexionImap } from '@/lib/email-agent/imap/client'
import { declencherPremiereReleve } from '@/lib/email-agent/retour-oauth'
import { dechiffrerIdentifiantsImap } from '@/lib/email-agent/chiffrement'
import { EXPIRATION_IMAP } from '@/lib/email-agent/fournisseurs/imap'

const SUPER_ADMIN = { id: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4', app_metadata: { role: 'super_admin' } }
const MOT_DE_PASSE = 'abcd-efgh-ijkl-mnop'
const CORPS = { email: 'h.carvalho@cabinet-exemple.fr', motDePasse: MOT_DE_PASSE, hote: 'ssl0.ovh.net', port: 993 }
const CLE_INITIALE = process.env.OAUTH_TOKENS_ENCRYPTION_KEY

function requete(corps: unknown) {
  return new NextRequest('https://vitfix.io/api/email-agent/connect-imap', {
    method: 'POST',
    headers: { Authorization: 'Bearer jwt-test', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
}

/** Tout ce que la route a journalisé, pour vérifier que le mot de passe n'y est pas. */
function journaux(): string {
  const l = vi.mocked(logger)
  return JSON.stringify([l.debug.mock.calls, l.info.mock.calls, l.warn.mock.calls, l.error.mock.calls])
}

beforeEach(() => {
  vi.clearAllMocks()
  etat.user = SUPER_ADMIN
  etat.autorise = true
  etat.upserts = []
  etat.erreurUpsert = null
  process.env.OAUTH_TOKENS_ENCRYPTION_KEY = 'cle-de-test-de-32-caracteres-min!!'
})

afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env.OAUTH_TOKENS_ENCRYPTION_KEY
  else process.env.OAUTH_TOKENS_ENCRYPTION_KEY = CLE_INITIALE
})

describe('POST /api/email-agent/connect-imap — accès', () => {
  it('sans session → 401', async () => {
    etat.user = null
    expect((await POST(requete(CORPS))).status).toBe(401)
  })

  it.each(['syndic_gestionnaire', 'artisan', 'copro'])('rôle %s → 403', async (role) => {
    etat.user = { id: 'u1', app_metadata: { role } }
    expect((await POST(requete(CORPS))).status).toBe(403)
    expect(testerConnexionImap).not.toHaveBeenCalled()
  })

  it('trop de tentatives → 429 avant toute connexion', async () => {
    etat.autorise = false
    expect((await POST(requete(CORPS))).status).toBe(429)
    expect(checkRateLimit).toHaveBeenCalledWith(`email-agent-imap:${SUPER_ADMIN.id}`, 6, 600_000)
    expect(testerConnexionImap).not.toHaveBeenCalled()
  })
})

describe('POST /api/email-agent/connect-imap — validation', () => {
  it.each([
    ['mot de passe absent', { ...CORPS, motDePasse: '' }],
    ['adresse IP', { ...CORPS, hote: '127.0.0.1' }],
    ['localhost', { ...CORPS, hote: 'localhost' }],
    ['port autre que 993', { ...CORPS, port: 143 }],
    ['adresse e-mail invalide', { ...CORPS, email: 'pas-une-adresse' }],
    ['hôte avec port', { ...CORPS, hote: 'ssl0.ovh.net:993' }],
  ])('%s → 400, sans écho du mot de passe', async (_, corps) => {
    const res = await POST(requete(corps))
    expect(res.status).toBe(400)
    expect(await res.text()).not.toContain(MOT_DE_PASSE)
    expect(testerConnexionImap).not.toHaveBeenCalled()
    expect(etat.upserts).toEqual([])
  })

  it('corps illisible → 400', async () => {
    const res = await POST(new NextRequest('https://vitfix.io/api/email-agent/connect-imap', {
      method: 'POST', headers: { Authorization: 'Bearer jwt-test' }, body: '{pas du json',
    }))
    expect(res.status).toBe(400)
  })

  it('clé de chiffrement absente → 500 nommant la configuration, aucune connexion', async () => {
    delete process.env.OAUTH_TOKENS_ENCRYPTION_KEY
    const res = await POST(requete(CORPS))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('OAUTH_TOKENS_ENCRYPTION_KEY')
    expect(testerConnexionImap).not.toHaveBeenCalled()
  })
})

describe('POST /api/email-agent/connect-imap — connexion', () => {
  it('succès : connexion testée, ligne provider imap chiffrée, première relève lancée', async () => {
    const res = await POST(requete({ ...CORPS, hote: ' SSL0.OVH.NET ' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ connecte: true, provider: 'imap', email: CORPS.email })
    expect(JSON.stringify(json)).not.toContain(MOT_DE_PASSE)

    expect(testerConnexionImap).toHaveBeenCalledWith({ hote: 'ssl0.ovh.net', port: 993, utilisateur: CORPS.email, motDePasse: MOT_DE_PASSE })

    expect(etat.upserts).toHaveLength(1)
    const { valeur, options } = etat.upserts[0]
    expect(options).toEqual({ onConflict: 'syndic_id' })
    expect(valeur).toMatchObject({
      syndic_id: SUPER_ADMIN.id,
      provider: 'imap',
      refresh_token: '',
      token_expiry: EXPIRATION_IMAP,
      email_compte: CORPS.email,
      scope: 'imap ssl0.ovh.net:993',
      oauth_nonce: null,
      oauth_nonce_expires_at: null,
    })
    const chiffre = valeur.access_token as string
    expect(chiffre).not.toContain(MOT_DE_PASSE)
    expect(await dechiffrerIdentifiantsImap(chiffre)).toEqual({
      hote: 'ssl0.ovh.net', port: 993, utilisateur: CORPS.email, motDePasse: MOT_DE_PASSE,
    })

    expect(declencherPremiereReleve).toHaveBeenCalledWith(SUPER_ADMIN.id, '[email-agent/connect-imap]')
    expect(journaux()).not.toContain(MOT_DE_PASSE)
  })

  it('identifiant IMAP distinct de l\'adresse : utilisé pour la connexion', async () => {
    etat.user = { id: 'syndic-1', app_metadata: { role: 'syndic' } }
    const res = await POST(requete({ ...CORPS, utilisateur: 'cabinet-exemple-gestion' }))
    expect(res.status).toBe(200)
    expect(vi.mocked(testerConnexionImap).mock.calls[0][0]).toMatchObject({ utilisateur: 'cabinet-exemple-gestion' })
    expect(etat.upserts[0].valeur).toMatchObject({ syndic_id: 'syndic-1', email_compte: CORPS.email })
  })

  it.each([
    ['identifiants_refuses', 400, /mot de passe refusé/],
    ['mot_de_passe_application', 400, /mot de passe d’application/],
    ['microsoft_oauth', 400, /Outlook \/ Microsoft 365/],
    ['serveur_injoignable', 502, /injoignable/],
    ['delai_depasse', 504, /ne répond pas/],
    ['imap_indisponible', 503, /pas disponible/],
  ] as const)('refus %s → %i, rien enregistré, mot de passe absent des réponses et journaux', async (code, status, message) => {
    vi.mocked(testerConnexionImap).mockRejectedValueOnce(new ErreurImap(code, 'refus', 'NO [AUTHENTICATIONFAILED] Authentication failed.'))
    const res = await POST(requete(CORPS))
    expect(res.status).toBe(status)
    const json = await res.json()
    expect(json.code).toBe(code)
    expect(json.error).toMatch(message)
    expect(JSON.stringify(json)).not.toContain(MOT_DE_PASSE)
    expect(etat.upserts).toEqual([])
    expect(declencherPremiereReleve).not.toHaveBeenCalled()
    expect(journaux()).not.toContain(MOT_DE_PASSE)
  })

  it('erreur d\'enregistrement → 500, pas de relève', async () => {
    etat.erreurUpsert = { message: 'violates not-null constraint' }
    const res = await POST(requete(CORPS))
    expect(res.status).toBe(500)
    expect(declencherPremiereReleve).not.toHaveBeenCalled()
  })
})
