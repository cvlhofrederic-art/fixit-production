// @vitest-environment node
// tests/lib/aj-signalement-diffusion-requete.test.ts
//
// Décision de Hugo du 16/11/2026 : « je ne veux pas que mes copropriétaires puissent répondre ». Les tests du gabarit
// (aj-signalement-diffusion-email.test.ts) et de l'envoi (aj-signalement-diffusion-envoi.test.ts) contrôlent l'objet
// passé au service d'e-mail, qu'ils simulent ; ici, la chaîne entière est réelle (messageDiffusionQr, puis
// sendBatchEmailsDetaille et le VRAI SDK resend) et seul `fetch` est simulé : on lit la requête HTTP réellement émise.
//   - message aux déclarants : aucun reply_to dans le corps JSON (ni ailleurs), en-têtes de désinscription transmis ;
//   - copie au cabinet : toujours envoyée au seul contact du cabinet, sans reply_to.
// Aucune requête ne sort : toute URL autre que https://api.resend.com/ fait échouer le test. Données fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiffusionFigeeQr } from '@/lib/aj-signalement/email'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { sendBatchEmailsDetaille } = await import('@/lib/email')
const { messageCopieCabinetDiffusionQr, messageDiffusionQr } = await import('@/lib/aj-signalement/email')

const ID_DIFFUSION = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a'
const ID_DESTINATAIRE = '3f2b8c1d-4e5a-4b6c-9d7e-8f9a0b1c2d3e'
const HEX = ID_DESTINATAIRE.replaceAll('-', '')
const JETONS = { page: `${HEX}.${'a1'.repeat(32)}`, unClic: `${HEX}.${'b2'.repeat(32)}` }
const CONTACT = 'contact@cabinet-exemple.test'

const diffusion = (langue: 'fr' | 'pt', modele: DiffusionFigeeQr['modele']): DiffusionFigeeQr => ({
  id: ID_DIFFUSION,
  langue,
  modele,
  cabinetNom: 'Cabinet Exemple',
  cabinetIdentifiant: 'cabinet-exemple',
  coproprieteNom: 'Résidence Exemple',
  contactEmail: CONTACT,
  politiqueUrl: 'https://cabinet-exemple.test/confidentialite',
  expediteur: '"Cabinet Exemple" <diffusion@envoi.exemple.test>',
  objet: 'Coupure d’eau le 14/11 de 9h à 10h',
  texte: 'L’eau sera coupée le 14/11, de 9h à 10h, bâtiment B.',
  portee: 'batiment',
  libellePerimetre: 'Bâtiment B',
  creeLe: '2026-11-13T09:00:00.000Z',
  nbDestinataires: 1,
  acteurProfil: 'gestionnaire',
  instructionReference: null,
  instructionRecueLe: null,
})

let corps: string[] = []

beforeEach(() => {
  corps = []
  vi.stubEnv('RESEND_API_KEY', 're_test_simule')
  vi.stubGlobal('fetch', vi.fn(async (entree: string | URL | Request, init?: RequestInit) => {
    const url = String(entree)
    if (url !== 'https://api.resend.com/emails/batch') throw new Error(`requête inattendue vers ${url}`)
    const brut = typeof init?.body === 'string' ? init.body : ''
    corps.push(brut)
    const lot = JSON.parse(brut) as unknown[]
    return new Response(JSON.stringify({ data: lot.map((_, i) => ({ id: `id-${i}` })) }), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('requête réellement émise vers le service d’e-mail (décision de Hugo du 16/11/2026)', () => {
  it('message aux déclarants (FR et PT, diffusion et annonce) : aucun reply_to ; désinscription transmise', async () => {
    for (const langue of ['fr', 'pt'] as const) {
      for (const modele of ['coupure_eau', 'annonce'] as const) {
        corps = []
        const m = messageDiffusionQr(diffusion(langue, modele), { id: ID_DESTINATAIRE, email: 'declarant@exemple.test' }, JETONS)
        const r = await sendBatchEmailsDetaille([m], { idempotencyKey: `aj-diffusion-${ID_DIFFUSION}-1` })
        expect(r).toEqual({ ok: true, acceptes: [0], refuses: [] })
        expect(corps).toHaveLength(1)
        const [envoye] = JSON.parse(corps[0]) as Array<Record<string, unknown>>
        expect(Object.keys(envoye).sort()).toEqual(['from', 'headers', 'html', 'subject', 'tags', 'text', 'to'])
        expect(corps[0]).not.toMatch(/reply[_-]?to/i)
        expect(envoye.from).toBe('"Cabinet Exemple" <diffusion@envoi.exemple.test>')
        expect(envoye.to).toEqual(['declarant@exemple.test'])
        expect(envoye.headers).toEqual({
          'List-Unsubscribe': `<https://vitfix.io/api/aj-signalement/desinscription/un-clic/${JETONS.unClic}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        })
      }
    }
  })

  it('copie au cabinet : toujours envoyée au seul contact du cabinet, sans reply_to', async () => {
    const r = await sendBatchEmailsDetaille([messageCopieCabinetDiffusionQr(diffusion('fr', 'coupure_eau'))], { idempotencyKey: `aj-diffusion-${ID_DIFFUSION}-copie` })
    expect(r).toEqual({ ok: true, acceptes: [0], refuses: [] })
    expect(corps).toHaveLength(1)
    const [envoye] = JSON.parse(corps[0]) as Array<Record<string, unknown>>
    expect(envoye.to).toEqual([CONTACT])
    expect(Object.keys(envoye).sort()).toEqual(['from', 'html', 'subject', 'tags', 'text', 'to'])
    expect(corps[0]).not.toMatch(/reply[_-]?to/i)
  })
})
