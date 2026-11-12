// tests/api/webhook-resend.test.ts
//
// POST /api/webhooks/resend — webhook PARTAGÉ de Resend (tous les e-mails de VitFix), signé par Svix.
// Non-régression (comportement d'avant la PR 3, inchangé pour tous les e-mails) : secret absent → 500 ; en-têtes Svix
// manquants → 400 ; horodatage hors de la fenêtre de 5 minutes → 400 ; signature fausse → 401 (plusieurs signatures
// acceptées pendant une rotation) ; JSON invalide → 400 ; rebond, plainte et retard → Sentry (domaines des
// destinataires seulement, jamais l'adresse) ; envoyé, délivré, ouvert, cliqué → aucune alerte ; 200 { received: true }.
// PR 3, lot 9 (décision F7 ; H13 : une plainte « indésirable » vaut opposition) :
//   - étiquettes lues dans data.tags, objet clé → valeur (documentation de Resend, événements email.complained et
//     email.bounced, relue le 12/11/2026) ; la forme tableau [{ name, value }] de l'envoi est tolérée ;
//   - plainte sur un message étiqueté type=aj-diffusion → signalements_qr_diffusion_opposer(destinataire, 'plainte') ;
//   - plainte sans cette étiquette (accusé, autres e-mails) → inchangé, aucun appel à la base ;
//   - rebond (même étiqueté) → aucune opposition (Resend écarte déjà l'adresse) ;
//   - bounce.subType lu (et non bounce.sub_type, absent de la documentation) ;
//   - migration 20261113 absente → 200, repli journalisé une fois ; autre erreur de la base → 503 (Resend réessaie),
//     sans le message de la base.
// Simulés : Sentry, le logger, la fonction SQL (supabaseAdmin.rpc). Aucune donnée réelle (exemple.test).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  captureMessage: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  rpc: vi.fn(async (_nom: string, _args: Record<string, unknown>): Promise<{ data: unknown; error: { code: string; message: string } | null }> => ({ data: true, error: null })),
}))

vi.mock('@sentry/nextjs', () => ({ captureMessage: h.captureMessage, captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: {
    info: h.info, warn: h.warn, error: h.error, debug: vi.fn(),
    withTenant: () => ({ info: h.info, warn: h.warn, error: h.error }),
  },
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { rpc: h.rpc, from: () => { throw new Error('aucune table lue par le webhook') } } }))

const { POST } = await import('@/app/api/webhooks/resend/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const CLE = Buffer.from('cle-de-test-du-webhook-resend-32o').toString('base64')
const SECRET = `whsec_${CLE}`
const DESTINATAIRE = '3f0c2b1a-9d8e-4c7b-a6f5-0e1d2c3b4a59'
const DIFFUSION = '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d'

const signer = (id: string, horodatage: string, corps: string, cle = CLE) =>
  createHmac('sha256', Buffer.from(cle, 'base64')).update(`${id}.${horodatage}.${corps}`).digest('base64')

interface OptionsEnvoi { secret?: string | null; entetes?: Record<string, string | null>; horodatage?: number; signature?: string }

function poster(evenement: unknown, o: OptionsEnvoi = {}) {
  const corps = typeof evenement === 'string' ? evenement : JSON.stringify(evenement)
  const horodatage = String(o.horodatage ?? Math.floor(Date.now() / 1000))
  const id = 'msg_2t5ExempleSvix'
  const entetes: Record<string, string | null> = {
    'content-type': 'application/json',
    'svix-id': id,
    'svix-timestamp': horodatage,
    'svix-signature': o.signature ?? `v1,${signer(id, horodatage, corps)}`,
    ...o.entetes,
  }
  const propres = Object.fromEntries(Object.entries(entetes).filter((e): e is [string, string] => e[1] !== null))
  return POST(new NextRequest('https://vitfix.io/api/webhooks/resend', { method: 'POST', headers: propres, body: corps }))
}

/** Événement au format de la documentation de Resend (data.tags : objet clé → valeur). */
const evenement = (type: string, data: Record<string, unknown> = {}) => ({
  type,
  created_at: '2026-11-12T10:00:00.000Z',
  data: {
    created_at: '2026-11-12T09:59:58.000Z',
    email_id: '56761188-7520-42d8-8898-ff6fc54ce618',
    from: '"Cabinet Exemple" <diffusion@exemple.test>',
    to: ['declarant@exemple.test'],
    subject: 'Résidence Exemple — Coupure d’eau',
    ...data,
  },
})
const TAGS_DIFFUSION = { type: 'aj-diffusion', diffusion: DIFFUSION, destinataire: DESTINATAIRE }
const appelsOpposer = () => h.rpc.mock.calls.filter((c) => c[0] === 'signalements_qr_diffusion_opposer')

beforeEach(() => {
  vi.stubEnv('RESEND_WEBHOOK_SECRET', SECRET)
  h.captureMessage.mockClear()
  h.info.mockClear()
  h.warn.mockClear()
  h.error.mockClear()
  h.rpc.mockReset()
  h.rpc.mockResolvedValue({ data: true, error: null })
  reinitialiserReplisQr()
})

describe('non-régression : signature et forme de la requête (inchangées)', () => {
  it('secret non configuré : 500', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '')
    expect((await poster(evenement('email.sent'))).status).toBe(500)
  })

  it.each(['svix-id', 'svix-timestamp', 'svix-signature'])('en-tête %s manquant : 400', async (entete) => {
    expect((await poster(evenement('email.sent'), { entetes: { [entete]: null } })).status).toBe(400)
  })

  it('horodatage hors de la fenêtre de 5 minutes : 400', async () => {
    expect((await poster(evenement('email.sent'), { horodatage: Math.floor(Date.now() / 1000) - 6 * 60 })).status).toBe(400)
  })

  it('signature fausse : 401, rien n’est traité', async () => {
    const res = await poster(evenement('email.complained', { tags: TAGS_DIFFUSION }), { signature: 'v1,ZmF1c3Nl' })
    expect(res.status).toBe(401)
    expect(h.captureMessage).not.toHaveBeenCalled()
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('rotation de clé : une des signatures de l’en-tête suffit', async () => {
    const corps = JSON.stringify(evenement('email.delivered'))
    const horodatage = String(Math.floor(Date.now() / 1000))
    const bonne = signer('msg_2t5ExempleSvix', horodatage, corps)
    const res = await poster(corps, { horodatage: Number(horodatage), signature: `v1,ZmF1c3Nl v1,${bonne}` })
    expect(res.status).toBe(200)
  })

  it('JSON invalide (bien signé) : 400', async () => {
    expect((await poster('{pas du json')).status).toBe(400)
  })

  it('envoyé, délivré, ouvert, cliqué : 200, aucune alerte, aucun appel à la base', async () => {
    for (const type of ['email.sent', 'email.delivered', 'email.opened', 'email.clicked']) {
      const res = await poster(evenement(type, { tags: TAGS_DIFFUSION }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ received: true })
    }
    expect(h.captureMessage).not.toHaveBeenCalled()
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('retard de distribution : alerte Sentry « warning », domaines seulement', async () => {
    expect((await poster(evenement('email.delivery_delayed'))).status).toBe(200)
    expect(h.captureMessage).toHaveBeenCalledWith('Resend email delivery delayed', expect.objectContaining({ level: 'warning' }))
    expect(JSON.stringify(h.captureMessage.mock.calls)).not.toContain('declarant@')
    expect(JSON.stringify(h.captureMessage.mock.calls)).toContain('exemple.test')
  })
})

describe('plainte (email.complained)', () => {
  it('sans étiquette : comportement d’avant (Sentry « error », journal), aucun appel à la base, 200', async () => {
    const res = await poster(evenement('email.complained'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(h.captureMessage).toHaveBeenCalledWith('Resend email complaint (spam report)', expect.objectContaining({ level: 'error' }))
    expect(h.error).toHaveBeenCalledWith('Email complaint received', expect.objectContaining({ recipientDomains: ['exemple.test'] }))
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['accusé de réception', { type: 'aj-signalement-confirmation' }],
    ['e-mail d’un signalement', { type: 'aj-signalement' }],
    ['copie au cabinet', { type: 'aj-diffusion-copie', diffusion: DIFFUSION }],
    ['autre e-mail de VitFix', { category: 'confirm_email' }],
  ])('autre étiquette (%s) : inchangé, aucune opposition', async (_cas, tags) => {
    expect((await poster(evenement('email.complained', { tags }))).status).toBe(200)
    expect(h.captureMessage).toHaveBeenCalledTimes(1)
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('message de diffusion étiqueté aj-diffusion : opposition « plainte » pour ce destinataire (H13), 200', async () => {
    const res = await poster(evenement('email.complained', { tags: TAGS_DIFFUSION }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(appelsOpposer()).toEqual([['signalements_qr_diffusion_opposer', { p_destinataire: DESTINATAIRE, p_origine: 'plainte' }]])
    // L'alerte de réputation reste envoyée, comme pour tout e-mail.
    expect(h.captureMessage).toHaveBeenCalledWith('Resend email complaint (spam report)', expect.objectContaining({ level: 'error' }))
    // Journal : identifiants seulement, jamais l'adresse.
    expect(JSON.stringify([...h.info.mock.calls, ...h.warn.mock.calls, ...h.error.mock.calls])).not.toContain('declarant@')
  })

  it('étiquettes sous la forme de l’envoi ([{ name, value }]) : tolérée, même opposition', async () => {
    const tags = Object.entries(TAGS_DIFFUSION).map(([name, value]) => ({ name, value }))
    expect((await poster(evenement('email.complained', { tags }))).status).toBe(200)
    expect(appelsOpposer()).toEqual([['signalements_qr_diffusion_opposer', { p_destinataire: DESTINATAIRE, p_origine: 'plainte' }]])
  })

  it('identifiant du destinataire en majuscules : ramené en minuscules', async () => {
    await poster(evenement('email.complained', { tags: { ...TAGS_DIFFUSION, destinataire: DESTINATAIRE.toUpperCase() } }))
    expect(appelsOpposer()[0][1]).toEqual({ p_destinataire: DESTINATAIRE, p_origine: 'plainte' })
  })

  it.each([
    ['sans destinataire', { type: 'aj-diffusion', diffusion: DIFFUSION }],
    ['destinataire hors format', { ...TAGS_DIFFUSION, destinataire: 'pas-un-uuid' }],
    ['destinataire non textuel', { ...TAGS_DIFFUSION, destinataire: 42 }],
  ])('étiquette aj-diffusion %s : aucun appel, avertissement, 200', async (_cas, tags) => {
    expect((await poster(evenement('email.complained', { tags }))).status).toBe(200)
    expect(h.rpc).not.toHaveBeenCalled()
    expect(h.warn).toHaveBeenCalled()
  })

  it('destinataire inconnu (diffusion purgée) : la fonction rend false, 200', async () => {
    h.rpc.mockResolvedValue({ data: false, error: null })
    expect((await poster(evenement('email.complained', { tags: TAGS_DIFFUSION }))).status).toBe(200)
    expect(appelsOpposer()).toHaveLength(1)
  })

  it('migration 20261113 absente (PGRST202) : 200 (aucune diffusion n’a pu partir), repli journalisé une fois', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.signalements_qr_diffusion_opposer' } })
    for (let i = 0; i < 2; i += 1) expect((await poster(evenement('email.complained', { tags: TAGS_DIFFUSION }))).status).toBe(200)
    expect(h.warn.mock.calls.filter((c) => String(c[0]).includes('13/11/2026'))).toHaveLength(1)
  })

  it('autre erreur de la base : 503 (Resend réessaie : une plainte n’est jamais perdue), sans le message de la base', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'could not serialize declarant@exemple.test' } })
    const res = await poster(evenement('email.complained', { tags: TAGS_DIFFUSION }))
    expect(res.status).toBe(503)
    const corps = JSON.stringify(await res.json())
    expect(corps).not.toContain('40001')
    expect(corps).not.toContain('serialize')
    expect(h.error).toHaveBeenCalled()
    expect(JSON.stringify(h.error.mock.calls)).toContain('40001')
    expect(JSON.stringify([...h.warn.mock.calls, ...h.error.mock.calls])).not.toContain('declarant@')
  })

  it('exception du client de la base : 503, journalisée', async () => {
    h.rpc.mockRejectedValue(new Error('réseau'))
    expect((await poster(evenement('email.complained', { tags: TAGS_DIFFUSION }))).status).toBe(503)
    expect(h.error).toHaveBeenCalled()
  })
})

describe('rebond (email.bounced)', () => {
  it('subType lu (documentation de Resend) : étiquettes Sentry type / sous-type, niveau « error » si permanent', async () => {
    const res = await poster(evenement('email.bounced', {
      bounce: { type: 'Permanent', subType: 'Suppressed', message: 'Adresse supprimée', diagnosticCode: ['smtp; 550 5.1.1 user unknown'] },
    }))
    expect(res.status).toBe(200)
    expect(h.captureMessage).toHaveBeenCalledWith('Resend email bounced (Permanent/Suppressed)', expect.objectContaining({
      level: 'error',
      tags: expect.objectContaining({ bounce_type: 'Permanent', bounce_sub_type: 'Suppressed' }),
    }))
    expect(h.warn).toHaveBeenCalledWith('Email bounced', expect.objectContaining({ type: 'Permanent', subType: 'Suppressed' }))
  })

  it('rebond temporaire : niveau « warning » (inchangé)', async () => {
    await poster(evenement('email.bounced', { bounce: { type: 'Temporary', subType: 'MessageRejected' } }))
    expect(h.captureMessage).toHaveBeenCalledWith('Resend email bounced (Temporary/MessageRejected)', expect.objectContaining({ level: 'warning' }))
  })

  it('sans détail de rebond : « unknown/unknown »', async () => {
    await poster(evenement('email.bounced'))
    expect(h.captureMessage).toHaveBeenCalledWith('Resend email bounced (unknown/unknown)', expect.objectContaining({ level: 'warning' }))
  })

  it('message de diffusion étiqueté : AUCUNE opposition (Resend écarte déjà l’adresse), 200', async () => {
    const res = await poster(evenement('email.bounced', { tags: TAGS_DIFFUSION, bounce: { type: 'Permanent', subType: 'General' } }))
    expect(res.status).toBe(200)
    expect(h.rpc).not.toHaveBeenCalled()
  })
})
