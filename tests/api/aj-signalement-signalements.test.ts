// tests/api/aj-signalement-signalements.test.ts
//
// POST /api/aj-signalement/signalements — dépôt public après scan du QR code :
//   - corps validé (coordonnées obligatoires), jeton inconnu → 404, migration absente → 503 ;
//   - enregistrement dans signalements_qr (e-mail en minuscules, zone seulement pour les parties communes) ;
//   - e-mail aux destinataires de la copropriété, sinon ADMIN_EMAIL, réponse directe au déclarant ;
//   - l'échec de l'e-mail n'annule pas le dépôt (email_erreur conservé) ; limites de débit.
// Seuls Supabase, le limiteur, le logger et sendEmail sont simulés.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const etat = {
    copropriete: null as null | Record<string, unknown>,
    erreurLecture: null as null | { code: string; message: string },
    erreurInsertion: null as null | { code: string; message: string },
    insertions: [] as Array<Record<string, unknown>>,
    misesAJour: [] as Array<Record<string, unknown>>,
    limites: [] as string[],
    refuser: [] as string[],
  }
  const from = (table: string) => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q
    q.insert = (ligne: Record<string, unknown>) => { etat.insertions.push({ table, ...ligne }); return q }
    q.update = (ligne: Record<string, unknown>) => { etat.misesAJour.push({ table, ...ligne }); return q }
    q.maybeSingle = async () => (etat.erreurLecture ? { data: null, error: etat.erreurLecture } : { data: etat.copropriete, error: null })
    q.single = async () => (etat.erreurInsertion
      ? { data: null, error: etat.erreurInsertion }
      : { data: { id: 'b1c2d3e4-0000-4000-8000-000000000000', created_at: '2026-11-04T14:05:00.000Z', updated_at: '2026-11-04T14:05:00.000Z' }, error: null })
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok, ko)
    return q
  }
  type ResultatEnvoi = { success: boolean; id?: string; error?: string }
  return { etat, from, sendEmail: vi.fn<(charge: unknown) => Promise<ResultatEnvoi>>(async () => ({ success: true, id: 'mail-1' })), loggerError: vi.fn() }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async (cle: string) => { h.etat.limites.push(cle); return !h.etat.refuser.some((prefixe) => cle.startsWith(prefixe)) }),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => h.from(table) } }))
vi.mock('@/lib/supabase-server-component', () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } })) }))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => null) }))
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail }))

const { POST } = await import('@/app/api/aj-signalement/signalements/route')

const JETON = '0123456789abcdef0123456789abcdef'
const COPRO = {
  id: 'c0000000-0000-4000-8000-000000000001', nom: 'Parc Belle Ombre', adresse: '12 allée des Pins, 13009 Marseille',
  jeton: JETON, emails_destinataires: ['cabinet@example.com'], actif: true, created_at: '2026-11-04T10:00:00.000Z',
}
const CORPS = {
  jeton: JETON, prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'Marie.Durand@Example.com',
  batiment: 'B', etage: '4', numLot: '12', estPartieCommune: false, zoneSignalee: 'Escalier',
  typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier de la cuisine', priorite: 'urgente', langue: 'fr',
}

function poster(corps: unknown) {
  return POST(new NextRequest('https://vitfix.io/api/aj-signalement/signalements', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps),
  }))
}

beforeEach(() => {
  h.etat.copropriete = { ...COPRO }
  h.etat.erreurLecture = null
  h.etat.erreurInsertion = null
  h.etat.insertions = []
  h.etat.misesAJour = []
  h.etat.limites = []
  h.etat.refuser = []
  h.sendEmail.mockClear()
  h.sendEmail.mockResolvedValue({ success: true, id: 'mail-1' })
  h.loggerError.mockClear()
  vi.unstubAllEnvs()
})

describe('validation et copropriété', () => {
  it('400 sans téléphone (coordonnées obligatoires) ; rien n’est écrit ni envoyé', async () => {
    const { telephone: _t, ...sans } = CORPS
    const res = await poster(sans)
    expect(res.status).toBe(400)
    expect(h.etat.insertions).toHaveLength(0)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('404 quand le jeton ne désigne aucune copropriété active', async () => {
    h.etat.copropriete = null
    const res = await poster(CORPS)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'introuvable' })
  })

  it('503 base_absente tant que la migration n’est pas appliquée (42P01)', async () => {
    h.etat.erreurLecture = { code: '42P01', message: 'relation "signalements_qr_coproprietes" does not exist' }
    const res = await poster(CORPS)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
  })

  it('429 au-delà de 5 dépôts par minute et par adresse IP, et au-delà de 30 par copropriété', async () => {
    h.etat.refuser = ['qr_signalement_post_']
    expect((await poster(CORPS)).status).toBe(429)
    h.etat.refuser = ['qr_signalement_copro_']
    expect((await poster(CORPS)).status).toBe(429)
    expect(h.etat.insertions).toHaveLength(0)
  })
})

describe('dépôt', () => {
  it('enregistre le signalement, envoie l’e-mail aux destinataires de la copropriété et répond le numéro', async () => {
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      signalement: { id: 'b1c2d3e4-0000-4000-8000-000000000000', numero: 'B1C2D3E4', creeLe: '2026-11-04T14:05:00.000Z', emailEnvoye: true },
    })
    expect(h.etat.insertions).toHaveLength(1)
    expect(h.etat.insertions[0]).toMatchObject({
      table: 'signalements_qr', copropriete_id: COPRO.id, prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78',
      email: 'marie.durand@example.com', batiment: 'B', etage: '4', num_lot: '12', est_partie_commune: false, zone_signalee: '',
      type_intervention: 'Plomberie (fuite, colonne, robinetterie)', priorite: 'urgente', statut: 'en_attente', langue: 'fr',
    })
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    const email = h.sendEmail.mock.calls[0][0] as { to: string[]; subject: string; replyTo: string; html: string }
    expect(email.to).toEqual(['cabinet@example.com'])
    expect(email.replyTo).toBe('marie.durand@example.com')
    expect(email.subject).toBe('[AJ Signalement] URGENT — Plomberie (fuite, colonne, robinetterie) — Parc Belle Ombre — lot 12')
    expect(email.html).toContain('12 allée des Pins')
    expect(h.etat.misesAJour).toHaveLength(1)
    expect(h.etat.misesAJour[0]).toMatchObject({ table: 'signalements_qr', email_erreur: null })
    expect(h.etat.misesAJour[0].email_envoye_le).toEqual(expect.any(String))
  })

  it('parties communes : la zone est gardée', async () => {
    await poster({ ...CORPS, estPartieCommune: true })
    expect(h.etat.insertions[0]).toMatchObject({ est_partie_commune: true, zone_signalee: 'Escalier' })
  })

  it('sans destinataire sur la copropriété : ADMIN_EMAIL et ADMIN_EMAIL_2 reçoivent l’e-mail', async () => {
    vi.stubEnv('ADMIN_EMAIL', 'Admin@Vitfix.io')
    vi.stubEnv('ADMIN_EMAIL_2', 'second@vitfix.io')
    h.etat.copropriete = { ...COPRO, emails_destinataires: [] }
    await poster(CORPS)
    expect((h.sendEmail.mock.calls[0][0] as { to: string[] }).to).toEqual(['admin@vitfix.io', 'second@vitfix.io'])
  })

  it('aucun destinataire du tout : le dépôt est gardé, l’erreur conservée et journalisée', async () => {
    vi.stubEnv('ADMIN_EMAIL', '')
    vi.stubEnv('ADMIN_EMAIL_2', '')
    h.etat.copropriete = { ...COPRO, emails_destinataires: [] }
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement.emailEnvoye).toBe(false)
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.etat.misesAJour[0]).toMatchObject({ email_envoye_le: null, email_erreur: 'aucun destinataire configuré' })
    expect(h.loggerError).toHaveBeenCalled()
  })

  it('e-mail refusé par Resend : 200, emailEnvoye false, erreur conservée', async () => {
    h.sendEmail.mockResolvedValue({ success: false, error: 'RESEND_API_KEY not configured' })
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement.emailEnvoye).toBe(false)
    expect(h.etat.misesAJour[0]).toMatchObject({ email_envoye_le: null, email_erreur: 'RESEND_API_KEY not configured' })
  })

  it('insertion refusée : 500 journalisé, aucun e-mail', async () => {
    h.etat.erreurInsertion = { code: '23514', message: 'check violation' }
    const res = await poster(CORPS)
    expect(res.status).toBe(500)
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.loggerError).toHaveBeenCalled()
  })
})
