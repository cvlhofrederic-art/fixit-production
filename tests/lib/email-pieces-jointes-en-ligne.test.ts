// @vitest-environment node
// tests/lib/email-pieces-jointes-en-ligne.test.ts
//
// lib/email.ts (partagé) : pièce jointe EN LIGNE (logo d'un cabinet dans l'accusé de réception d'AJ Signalement,
// demande de Hugo du 13/11/2026). Documentation officielle de Resend, relue le 13/11/2026 :
//   - resend.com/docs/dashboard/emails/embed-inline-images : champ `contentId` dans le SDK Node.js, `content_id` dans
//     l'API, image appelée dans le HTML par `<img src="cid:…">` ; pièces jointes, images en ligne comprises, NON
//     prises en charge par l'envoi par lot ;
//   - resend.com/docs/api-reference/emails/send-batch-emails : « The attachments field is not supported yet ».
// Donc :
//   - EmailAttachment accepte `contentId` et `contentType`, transmis par sendEmail (envoi unitaire) en `content_id` et
//     `content_type` ; sans eux, la requête est OCTET POUR OCTET celle d'avant (appelants existants inchangés :
//     factures, devis, rapports… qui ne passent que filename et content) ;
//   - sendBatchEmails et sendBatchEmailsDetaille ne transmettent toujours AUCUNE pièce jointe (le lot les refuserait).
// Le VRAI SDK resend est utilisé : seul `fetch` est simulé (toute URL autre que https://api.resend.com/ fait échouer le
// test). Données fictives (@exemple.test).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmailPayload } from '@/lib/email'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { sendBatchEmails, sendBatchEmailsDetaille, sendEmail } = await import('@/lib/email')

interface AppelFetch { url: string; corps: unknown }
let appels: AppelFetch[] = []

const json = (statut: number, corps: unknown): Response =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  appels = []
  vi.stubEnv('RESEND_API_KEY', 're_test_simule')
  vi.stubGlobal('fetch', vi.fn(async (entree: string | URL | Request, init?: RequestInit) => {
    const url = String(entree)
    if (!url.startsWith('https://api.resend.com/')) throw new Error(`requête inattendue vers ${url}`)
    const corps: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    appels.push({ url, corps })
    if (url.endsWith('/emails/batch')) return json(200, { data: (corps as unknown[]).map((_, i) => ({ id: `id-${i}` })) })
    return json(200, { id: 'id-unitaire' })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const PNG_BASE64 = 'iVBORw0KGgo='

const message = (sur: Partial<EmailPayload> = {}): EmailPayload => ({
  to: 'declarant@exemple.test',
  subject: 'Objet',
  html: '<p>Bonjour</p>',
  tags: [{ name: 'type', value: 'essai' }],
  ...sur,
})

const corps = (i = 0) => appels[i].corps as Record<string, unknown>

describe('sendEmail : appelants existants (pièce jointe ordinaire) inchangés', () => {
  it('filename et content seuls : la requête porte exactement { content, filename }', async () => {
    const r = await sendEmail(message({ attachments: [{ filename: 'devis.pdf', content: 'JVBERi0=' }] }))
    expect(r).toEqual({ success: true, id: 'id-unitaire' })
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toBe('https://api.resend.com/emails')
    expect(corps().attachments).toEqual([{ content: 'JVBERi0=', filename: 'devis.pdf' }])
  })

  it('sans pièce jointe : aucun champ attachments', async () => {
    await sendEmail(message())
    expect(corps()).not.toHaveProperty('attachments')
  })
})

describe('sendEmail : pièce jointe en ligne (cid)', () => {
  it('contentId et contentType transmis en content_id et content_type (envoi unitaire)', async () => {
    await sendEmail(message({
      html: '<img src="cid:logo-cabinet" alt="Cabinet Exemple">',
      attachments: [{ filename: 'logo.png', content: PNG_BASE64, contentType: 'image/png', contentId: 'logo-cabinet' }],
    }))
    expect(corps().attachments).toEqual([{ content: PNG_BASE64, filename: 'logo.png', content_type: 'image/png', content_id: 'logo-cabinet' }])
    expect(corps().html).toBe('<img src="cid:logo-cabinet" alt="Cabinet Exemple">')
  })
})

describe('envoi par lot : aucune pièce jointe transmise (Resend ne les accepte pas)', () => {
  const avecLogo = message({ attachments: [{ filename: 'logo.png', content: PNG_BASE64, contentType: 'image/png', contentId: 'logo-cabinet' }] })

  it('sendBatchEmails', async () => {
    await sendBatchEmails([avecLogo])
    expect(appels[0].url).toBe('https://api.resend.com/emails/batch')
    for (const m of appels[0].corps as Array<Record<string, unknown>>) expect(m).not.toHaveProperty('attachments')
  })

  it('sendBatchEmailsDetaille', async () => {
    await sendBatchEmailsDetaille([avecLogo], { idempotencyKey: 'cle-essai-1' })
    expect(appels[0].url).toBe('https://api.resend.com/emails/batch')
    for (const m of appels[0].corps as Array<Record<string, unknown>>) expect(m).not.toHaveProperty('attachments')
  })
})
