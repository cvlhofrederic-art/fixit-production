// @vitest-environment node
// tests/lib/email-lot-detaille.test.ts
//
// lib/email.ts (partagé) : ajouts de la PR 3 d'AJ Signalement (SPEC diffusion § 5.1, § 5.5, décision F5).
//   - EmailPayload accepte `headers` (List-Unsubscribe, RFC 8058) et `text` (version texte), transmis par sendEmail,
//     sendBatchEmails et le nouveau sendBatchEmailsDetaille ;
//   - sendBatchEmailsDetaille : UN lot (100 messages au plus), mode de validation « permissive » (en-tête
//     x-batch-validation), clé d'idempotence du lot (en-tête Idempotency-Key), délai de 15 s ; rend les indices acceptés
//     et refusés, ou le code d'un échec global (reseau, limite, quota, rejeu_refuse, rejeu_concurrent, refus) ; jamais
//     le texte de Resend ;
//   - sendBatchEmails, sendEmail et leurs appelants inchangés (non-régression).
// Le VRAI SDK resend est utilisé : seul `fetch` est simulé, ce qui vérifie la requête HTTP réellement émise (noms des
// en-têtes, corps JSON) et la lecture des réponses par le SDK. Aucune requête ne sort : toute URL autre que
// https://api.resend.com/ fait échouer le test. Données fictives (@exemple.test).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { EmailPayload } from '@/lib/email'

const h = vi.hoisted(() => ({
  journal: [] as Array<{ niveau: string; message: string; contexte: unknown }>,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn((message: string, contexte?: unknown) => { h.journal.push({ niveau: 'info', message, contexte }) }),
    warn: vi.fn((message: string, contexte?: unknown) => { h.journal.push({ niveau: 'warn', message, contexte }) }),
    error: vi.fn((message: string, contexte?: unknown) => { h.journal.push({ niveau: 'error', message, contexte }) }),
  },
}))

const { sendBatchEmailsDetaille, sendBatchEmails, sendEmail, DELAI_LOT_EMAIL_MS } = await import('@/lib/email')

// ── fetch simulé ─────────────────────────────────────────────────────────────

interface AppelFetch {
  url: string
  methode: string
  /** En-têtes HTTP de la requête, noms en minuscules (Headers). */
  entetes: Record<string, string>
  corps: unknown
}

let appels: AppelFetch[] = []
let repondre: (appel: AppelFetch) => Promise<Response> = async () => { throw new Error('aucune réponse prévue') }

const json = (statut: number, corps: unknown): Response =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } })

/** Réponse d'un lot accepté en entier : un identifiant par message envoyé. */
const lotAccepte = async (appel: AppelFetch): Promise<Response> =>
  json(200, { data: (appel.corps as unknown[]).map((_, i) => ({ id: `id-${i}` })) })

/** Texte que Resend met dans ses erreurs : il ne doit jamais ressortir (ni résultat, ni journal, ni console). */
const TEXTE_RESEND = 'Texte du service pour destinataire-secret@exemple.test'

let sortiesConsole: string[] = []

beforeEach(() => {
  appels = []
  h.journal = []
  sortiesConsole = []
  repondre = lotAccepte
  vi.stubEnv('RESEND_API_KEY', 're_test_simule')
  vi.stubGlobal('fetch', vi.fn(async (entree: string | URL | Request, init?: RequestInit) => {
    const url = String(entree)
    if (!url.startsWith('https://api.resend.com/')) throw new Error(`requête inattendue vers ${url}`)
    const appel: AppelFetch = {
      url,
      methode: init?.method ?? 'GET',
      entetes: Object.fromEntries(new Headers(init?.headers).entries()),
      corps: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    appels.push(appel)
    return repondre(appel)
  }))
  for (const niveau of ['log', 'info', 'warn', 'error'] as const) {
    vi.spyOn(console, niveau).mockImplementation((...valeurs: unknown[]) => { sortiesConsole.push(valeurs.map(String).join(' ')) })
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// ── Données ──────────────────────────────────────────────────────────────────

const CLE = 'aj-diffusion-0f0e0d0c-0000-4000-8000-000000000001-3'

const message = (i: number): EmailPayload => ({
  from: '"Cabinet Exemple" <diffusion@exemple.test>',
  to: `declarant-${i}@exemple.test`,
  subject: `Résidence Exemple — Coupure d’eau ${i}`,
  html: `<p>Message ${i}</p>`,
  text: `Message ${i}`,
  replyTo: 'contact@cabinet-exemple.test',
  tags: [{ name: 'type', value: 'aj-diffusion' }, { name: 'destinataire', value: `d${i}` }],
  headers: {
    'List-Unsubscribe': `<https://exemple.test/desinscription/un-clic/jeton${i}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
})
const messages = (n: number): EmailPayload[] => Array.from({ length: n }, (_, i) => message(i))

/** Message tel que les appelants d'avant la PR 3 le construisent : ni `headers` ni `text`. */
const messageAncien = (i: number): EmailPayload => ({
  from: 'VITFIX <noreply@exemple.test>',
  to: `gestion-${i}@exemple.test`,
  subject: `Signalement ${i}`,
  html: `<p>Signalement ${i}</p>`,
  replyTo: 'declarant@exemple.test',
  tags: [{ name: 'type', value: 'aj-signalement' }],
})

const corpsLot = (appel: AppelFetch) => appel.corps as Array<Record<string, unknown>>

/** Rien du texte de Resend ni d'une adresse ne ressort : résultat, journal, console. */
function expectAucunTexteDeResend(resultat: unknown) {
  const sorties = [JSON.stringify(resultat), JSON.stringify(h.journal), ...sortiesConsole]
  for (const sortie of sorties) {
    expect(sortie).not.toContain('Texte du service')
    expect(sortie).not.toContain('@')
  }
}

// ═══════════════════════════════════════════════════════════════════════════════

describe('sendBatchEmailsDetaille — requête émise', () => {
  it('un seul POST /emails/batch : headers (List-Unsubscribe) et text transmis pour chaque message, avec to, reply_to, tags', async () => {
    const r = await sendBatchEmailsDetaille(messages(3), { idempotencyKey: CLE, validation: 'permissive', delaiMs: 15_000 })
    expect(r).toEqual({ ok: true, acceptes: [0, 1, 2], refuses: [] })
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toBe('https://api.resend.com/emails/batch')
    expect(appels[0].methode).toBe('POST')
    const corps = corpsLot(appels[0])
    expect(corps).toHaveLength(3)
    corps.forEach((m, i) => {
      expect(m).toStrictEqual({
        from: '"Cabinet Exemple" <diffusion@exemple.test>',
        to: [`declarant-${i}@exemple.test`],
        subject: `Résidence Exemple — Coupure d’eau ${i}`,
        html: `<p>Message ${i}</p>`,
        text: `Message ${i}`,
        reply_to: 'contact@cabinet-exemple.test',
        tags: [{ name: 'type', value: 'aj-diffusion' }, { name: 'destinataire', value: `d${i}` }],
        headers: {
          'List-Unsubscribe': `<https://exemple.test/desinscription/un-clic/jeton${i}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })
    })
  })

  it('mode permissive et clé d’idempotence transmis en en-têtes HTTP (x-batch-validation, Idempotency-Key)', async () => {
    await sendBatchEmailsDetaille(messages(2), { idempotencyKey: CLE, validation: 'permissive', delaiMs: 15_000 })
    expect(appels[0].entetes['x-batch-validation']).toBe('permissive')
    expect(appels[0].entetes['idempotency-key']).toBe(CLE)
  })

  it('permissive par défaut ; strict seulement si demandé', async () => {
    await sendBatchEmailsDetaille(messages(1), { idempotencyKey: CLE })
    await sendBatchEmailsDetaille(messages(1), { idempotencyKey: `${CLE}-b`, validation: 'strict' })
    expect(appels.map((a) => a.entetes['x-batch-validation'])).toEqual(['permissive', 'strict'])
    expect(appels.map((a) => a.entetes['idempotency-key'])).toEqual([CLE, `${CLE}-b`])
  })

  it('même entrée → même requête (le rejeu d’un lot interrompu doit être identique pour l’idempotence)', async () => {
    await sendBatchEmailsDetaille(messages(3), { idempotencyKey: CLE })
    await sendBatchEmailsDetaille(messages(3), { idempotencyKey: CLE })
    expect(appels).toHaveLength(2)
    expect(JSON.stringify(appels[1].corps)).toBe(JSON.stringify(appels[0].corps))
    expect(appels[1].entetes['idempotency-key']).toBe(appels[0].entetes['idempotency-key'])
  })

  it('lot vide : aucun appel, rien d’accepté ni de refusé', async () => {
    expect(await sendBatchEmailsDetaille([], { idempotencyKey: CLE })).toEqual({ ok: true, acceptes: [], refuses: [] })
    expect(appels).toHaveLength(0)
  })

  it('plus de 100 messages : aucun appel (un lot = une clé), refus local', async () => {
    const r = await sendBatchEmailsDetaille(messages(101), { idempotencyKey: CLE })
    expect(r).toEqual({ ok: false, code: 'refus', statutHttp: null, motif: 'lot_trop_grand' })
    expect(appels).toHaveLength(0)
    // 100 passent.
    expect((await sendBatchEmailsDetaille(messages(100), { idempotencyKey: CLE })).ok).toBe(true)
    expect(corpsLot(appels[0])).toHaveLength(100)
  })

  it('clé d’idempotence vide, trop longue (> 256) ou hors ASCII visible : aucun appel, refus local', async () => {
    for (const cle of ['', 'a'.repeat(257), 'cle avec espace', 'clé', 'cle\r\nX-Injecte: 1']) {
      const r = await sendBatchEmailsDetaille(messages(1), { idempotencyKey: cle })
      expect(r).toEqual({ ok: false, code: 'refus', statutHttp: null, motif: 'cle_idempotence_invalide' })
    }
    expect(appels).toHaveLength(0)
    expect((await sendBatchEmailsDetaille(messages(1), { idempotencyKey: 'a'.repeat(256) })).ok).toBe(true)
  })

  it('RESEND_API_KEY absente : aucun appel, refus local', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const r = await sendBatchEmailsDetaille(messages(2), { idempotencyKey: CLE })
    expect(r).toEqual({ ok: false, code: 'refus', statutHttp: null, motif: 'cle_api_absente' })
    expect(appels).toHaveLength(0)
  })

  it('aucune nouvelle tentative : un échec = un seul appel', async () => {
    repondre = async () => json(500, { statusCode: 500, name: 'application_error', message: TEXTE_RESEND })
    await sendBatchEmailsDetaille(messages(2), { idempotencyKey: CLE })
    expect(appels).toHaveLength(1)
  })
})

describe('sendBatchEmailsDetaille — indices acceptés et refusés (mode permissive)', () => {
  it('refus à l’unité : indices des refusés depuis errors[], les autres acceptés ; message de Resend jamais rendu', async () => {
    repondre = async () => json(200, {
      data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      errors: [{ index: 3, message: TEXTE_RESEND }, { index: 1, message: TEXTE_RESEND }],
    })
    const r = await sendBatchEmailsDetaille(messages(5), { idempotencyKey: CLE })
    expect(r).toEqual({ ok: true, acceptes: [0, 2, 4], refuses: [1, 3] })
    expectAucunTexteDeResend(r)
  })

  it('tous refusés à l’unité : rien d’accepté', async () => {
    repondre = async () => json(200, { data: [], errors: [{ index: 0, message: TEXTE_RESEND }, { index: 1, message: TEXTE_RESEND }] })
    const r = await sendBatchEmailsDetaille(messages(2), { idempotencyKey: CLE })
    expect(r).toEqual({ ok: true, acceptes: [], refuses: [0, 1] })
    expectAucunTexteDeResend(r)
  })

  it('errors vide ou absent : tout est accepté', async () => {
    repondre = async () => json(200, { data: [{ id: 'a' }, { id: 'b' }], errors: [] })
    expect(await sendBatchEmailsDetaille(messages(2), { idempotencyKey: CLE })).toEqual({ ok: true, acceptes: [0, 1], refuses: [] })
    repondre = async () => json(200, { data: [{ id: 'a' }, { id: 'b' }] })
    expect(await sendBatchEmailsDetaille(messages(2), { idempotencyKey: CLE })).toEqual({ ok: true, acceptes: [0, 1], refuses: [] })
  })

  it('réponse 2xx incohérente (indice hors du lot, en double, nombre d’acceptés faux, forme inconnue, JSON illisible) : issue inconnue → reseau', async () => {
    const incoherentes: Array<() => Promise<Response>> = [
      async () => json(200, { data: [{ id: 'a' }], errors: [{ index: 2, message: TEXTE_RESEND }] }),
      async () => json(200, { data: [], errors: [{ index: 0, message: TEXTE_RESEND }, { index: 0, message: TEXTE_RESEND }] }),
      async () => json(200, { data: [{ id: 'a' }, { id: 'b' }], errors: [{ index: 1, message: TEXTE_RESEND }] }),
      async () => json(200, { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }),
      async () => json(200, { resultat: 'ok' }),
      async () => json(200, { data: [{ id: 'a' }], errors: [{ index: -1, message: TEXTE_RESEND }] }),
      async () => json(200, { data: [{ id: 'a' }], errors: [{ index: 0.5, message: TEXTE_RESEND }] }),
      async () => new Response('<html>pas du JSON</html>', { status: 200 }),
    ]
    for (const reponse of incoherentes) {
      repondre = reponse
      const r = await sendBatchEmailsDetaille(messages(2), { idempotencyKey: CLE })
      expect(r).toMatchObject({ ok: false, code: 'reseau' })
      expectAucunTexteDeResend(r)
    }
  })
})

describe('sendBatchEmailsDetaille — codes d’échec global (texte de Resend jamais rendu)', () => {
  const erreur = (statut: number, nom: string) => async () => json(statut, { statusCode: statut, name: nom, message: TEXTE_RESEND })

  it.each([
    ['limite', 429, 'rate_limit_exceeded'],
    ['quota', 429, 'daily_quota_exceeded'],
    ['quota', 429, 'monthly_quota_exceeded'],
    ['rejeu_refuse', 409, 'invalid_idempotent_request'],
    ['rejeu_concurrent', 409, 'concurrent_idempotent_requests'],
    ['refus', 422, 'validation_error'],
    ['refus', 422, 'invalid_parameter'],
    ['refus', 403, 'validation_error'],
    ['refus', 401, 'missing_api_key'],
    ['refus', 400, 'invalid_idempotency_key'],
    ['reseau', 500, 'application_error'],
    ['reseau', 503, 'service_unavailable'],
  ] as const)('%s : HTTP %i %s', async (code, statut, nom) => {
    repondre = erreur(statut, nom)
    const r = await sendBatchEmailsDetaille(messages(3), { idempotencyKey: CLE })
    expect(r).toEqual({ ok: false, code, statutHttp: statut, motif: nom })
    expectAucunTexteDeResend(r)
  })

  it('429 sans nom reconnu → limite ; nom illisible ramené à « inconnu »', async () => {
    repondre = async () => json(429, { statusCode: 429, name: 'Trop de requêtes de destinataire-secret@exemple.test', message: TEXTE_RESEND })
    const r = await sendBatchEmailsDetaille(messages(1), { idempotencyKey: CLE })
    expect(r).toEqual({ ok: false, code: 'limite', statutHttp: 429, motif: 'inconnu' })
    expectAucunTexteDeResend(r)
  })

  it('réponse d’erreur non JSON (page HTML d’un mandataire, 502) → reseau', async () => {
    repondre = async () => new Response(`<html>${TEXTE_RESEND}</html>`, { status: 502 })
    const r = await sendBatchEmailsDetaille(messages(1), { idempotencyKey: CLE })
    expect(r).toEqual({ ok: false, code: 'reseau', statutHttp: 502, motif: 'application_error' })
    expectAucunTexteDeResend(r)
  })

  it('réseau : fetch rejette → reseau, sans statut', async () => {
    repondre = async () => { throw new TypeError(`fetch failed ${TEXTE_RESEND}`) }
    const r = await sendBatchEmailsDetaille(messages(2), { idempotencyKey: CLE })
    expect(r).toEqual({ ok: false, code: 'reseau', statutHttp: null, motif: 'application_error' })
    expectAucunTexteDeResend(r)
  })

  it('exception pendant la préparation ou l’appel → reseau (motif « exception »), journal sans le texte de l’exception', async () => {
    const piege = message(0)
    piege.headers = Object.defineProperty({}, 'List-Unsubscribe', {
      enumerable: true,
      get() { throw new Error(TEXTE_RESEND) },
    }) as Record<string, string>
    const r = await sendBatchEmailsDetaille([piege], { idempotencyKey: CLE })
    expect(r).toEqual({ ok: false, code: 'reseau', statutHttp: null, motif: 'exception' })
    expect(h.journal).toEqual([{ niveau: 'warn', message: expect.any(String), contexte: { messages: 1, exception: 'Error' } }])
    expectAucunTexteDeResend(r)
  })
})

describe('sendBatchEmailsDetaille — délai de 15 s (minuteur simulé)', () => {
  it('constante exportée : 15 000 ms', () => {
    expect(DELAI_LOT_EMAIL_MS).toBe(15_000)
  })

  it('pas de réponse : rien avant 15 s, reseau (délai dépassé) à 15 s, une seule requête ; réponse tardive ignorée', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let repondreTard: (r: Response) => void = () => undefined
    repondre = () => new Promise<Response>((resoudre) => { repondreTard = resoudre })
    let resultat: unknown = 'en attente'
    const envoi = sendBatchEmailsDetaille(messages(2), { idempotencyKey: CLE, delaiMs: 15_000 }).then((r) => { resultat = r })
    await vi.advanceTimersByTimeAsync(14_999)
    expect(resultat).toBe('en attente')
    await vi.advanceTimersByTimeAsync(1)
    await envoi
    expect(resultat).toEqual({ ok: false, code: 'reseau', statutHttp: null, motif: 'delai_depasse' })
    expect(appels).toHaveLength(1)
    // La réponse qui arrive après le délai ne change rien et ne lève rien.
    repondreTard(json(200, { data: [{ id: 'a' }, { id: 'b' }] }))
    await vi.advanceTimersByTimeAsync(0)
    expect(resultat).toEqual({ ok: false, code: 'reseau', statutHttp: null, motif: 'delai_depasse' })
  })

  it('délai par défaut : 15 s quand delaiMs est omis ou invalide', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    for (const delaiMs of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      repondre = () => new Promise<Response>(() => undefined)
      let resultat: unknown = 'en attente'
      const envoi = sendBatchEmailsDetaille(messages(1), { idempotencyKey: CLE, delaiMs }).then((r) => { resultat = r })
      await vi.advanceTimersByTimeAsync(14_999)
      expect(resultat).toBe('en attente')
      await vi.advanceTimersByTimeAsync(1)
      await envoi
      expect(resultat).toMatchObject({ code: 'reseau', motif: 'delai_depasse' })
    }
  })

  it('délai personnalisé respecté (5 s)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    repondre = () => new Promise<Response>(() => undefined)
    let resultat: unknown = 'en attente'
    const envoi = sendBatchEmailsDetaille(messages(1), { idempotencyKey: CLE, delaiMs: 5_000 }).then((r) => { resultat = r })
    await vi.advanceTimersByTimeAsync(4_999)
    expect(resultat).toBe('en attente')
    await vi.advanceTimersByTimeAsync(1)
    await envoi
    expect(resultat).toMatchObject({ code: 'reseau', motif: 'delai_depasse' })
  })

  it('réponse avant le délai : minuteur annulé (aucun minuteur en suspens)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const r = await sendBatchEmailsDetaille(messages(2), { idempotencyKey: CLE })
    expect(r).toEqual({ ok: true, acceptes: [0, 1], refuses: [] })
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('non-régression : sendBatchEmails et sendEmail inchangés pour leurs appelants', () => {
  it('signatures inchangées (un seul paramètre)', () => {
    expect(sendBatchEmails.length).toBe(1)
    expect(sendEmail.length).toBe(1)
  })

  it('sendBatchEmails sans headers ni text : tranches de 100, mode strict, sans clé d’idempotence, corps identique à avant', async () => {
    const r = await sendBatchEmails(Array.from({ length: 150 }, (_, i) => messageAncien(i)))
    expect(r).toEqual({ sent: 150, failed: 0, errors: [] })
    expect(appels.map((a) => [a.url, corpsLot(a).length])).toEqual([
      ['https://api.resend.com/emails/batch', 100],
      ['https://api.resend.com/emails/batch', 50],
    ])
    for (const appel of appels) {
      expect(appel.entetes['x-batch-validation']).toBe('strict')
      expect(appel.entetes['idempotency-key']).toBeUndefined()
    }
    expect(corpsLot(appels[0])[7]).toStrictEqual({
      from: 'VITFIX <noreply@exemple.test>',
      to: ['gestion-7@exemple.test'],
      subject: 'Signalement 7',
      html: '<p>Signalement 7</p>',
      reply_to: 'declarant@exemple.test',
      tags: [{ name: 'type', value: 'aj-signalement' }],
    })
  })

  it('sendBatchEmails : un lot refusé compte tous ses messages en échec (comportement d’avant, inchangé)', async () => {
    repondre = async () => json(422, { statusCode: 422, name: 'validation_error', message: 'Invalid `to` field.' })
    expect(await sendBatchEmails([messageAncien(0), messageAncien(1)])).toEqual({ sent: 0, failed: 2, errors: ['Invalid `to` field.'] })
  })

  it('sendBatchEmails sans RESEND_API_KEY : aucun appel (inchangé)', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    expect(await sendBatchEmails([messageAncien(0)])).toEqual({ sent: 0, failed: 1, errors: ['RESEND_API_KEY not configured'] })
    expect(appels).toHaveLength(0)
  })

  it('sendBatchEmails transmet aussi headers et text quand un appelant les fournit (ajout)', async () => {
    await sendBatchEmails([message(0)])
    expect(corpsLot(appels[0])[0]).toMatchObject({ text: 'Message 0', headers: message(0).headers })
  })

  it('sendEmail sans headers ni text : POST /emails, corps identique à avant', async () => {
    repondre = async () => json(200, { id: 'simple-1' })
    const r = await sendEmail(messageAncien(1))
    expect(r).toEqual({ success: true, id: 'simple-1' })
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toBe('https://api.resend.com/emails')
    expect(appels[0].entetes['idempotency-key']).toBeUndefined()
    expect(appels[0].corps).toStrictEqual({
      from: 'VITFIX <noreply@exemple.test>',
      to: ['gestion-1@exemple.test'],
      subject: 'Signalement 1',
      html: '<p>Signalement 1</p>',
      reply_to: 'declarant@exemple.test',
      tags: [{ name: 'type', value: 'aj-signalement' }],
    })
  })

  it('sendEmail transmet headers et text quand l’appelant les fournit (ajout)', async () => {
    repondre = async () => json(200, { id: 'simple-2' })
    await sendEmail(message(2))
    expect(appels[0].corps).toMatchObject({ text: 'Message 2', headers: message(2).headers })
  })

  it('sendEmail : erreur de Resend rendue comme avant (success false, message)', async () => {
    repondre = async () => json(422, { statusCode: 422, name: 'validation_error', message: 'Invalid `to` field.' })
    expect(await sendEmail(messageAncien(0))).toEqual({ success: false, error: 'Invalid `to` field.' })
  })
})
