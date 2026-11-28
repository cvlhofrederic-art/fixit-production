// tests/lib/aj-signalement-logo-emails.test.ts
//
// Logo d'un cabinet client dans les e-mails (demande de Hugo du 13/11/2026 ; brouillon soumis à Frédéric).
// Documentation officielle de Resend relue le 13/11/2026 (resend.com/docs/dashboard/emails/embed-inline-images et
// …/api-reference/emails/send-batch-emails) : image en ligne = pièce jointe à `contentId`, appelée par « cid: » ; AUCUNE
// pièce jointe dans l'envoi par lot. Donc :
//   - accusé de réception au déclarant (envoi unitaire, sendEmail) : le logo en pièce jointe EN LIGNE, dans une rangée
//     blanche au-dessus du bandeau bleu nuit ; aucune image distante (aucun suivi d'ouverture possible) ; texte
//     alternatif = nom du cabinet, échappé ; dimensions en attributs (Outlook) ; le reste du message inchangé ;
//   - e-mails de signalement aux destinataires (un lot, sendBatchEmails) : SANS logo — le lot ne porte pas de pièce
//     jointe, et une image distante est exclue (figé par tests/lib/aj-signalement-logo-emails-sans-logo.test.ts) ;
//   - lireLogoEmailDeCoproprieteQr (serveur) : l'image revérifiée du cabinet de la copropriété et son nom ; null (accusé
//     d'avant) pour une copropriété sans cabinet, un cabinet sans logo, une image stockée illisible, la migration
//     20261114 absente (repli journalisé une fois), une erreur ou une exception : l'accusé part toujours.
// Images synthétiques (tests/helpers/png-synthetique.ts) ; données fictives.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

const h = vi.hoisted(() => ({
  sendEmail: vi.fn<(charge: unknown) => Promise<{ success: boolean; id?: string; error?: string }>>(async () => ({ success: true, id: 'mail-1' })),
  sendBatchEmails: vi.fn<(lot: unknown[]) => Promise<{ sent: number; failed: number; errors: string[] }>>(async (lot) => ({ sent: lot.length, failed: 0, errors: [] })),
}))
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail, sendBatchEmails: h.sendBatchEmails }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { reinitialiserSimulQr, simulQr } = await import('../helpers/aj-signalement-routes')
const A = await import('../helpers/aj-signalement-acces')
const { hexBytea, pngSynthetique } = await import('../helpers/png-synthetique')
const { MIGRATION_LOGO_QR, reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')
const emails = await import('@/lib/aj-signalement/email')
const serveurLogo = await import('@/lib/aj-signalement/serveur-logo')
import type { SignalementQr } from '@/lib/aj-signalement/types'

const { CAB, C1, C_SANS } = A
const empreinte16 = (octets: Uint8Array) => createHash('sha256').update(octets).digest('hex').slice(0, 16)
const PNG = pngSynthetique(800, 296, { couleur: [13, 27, 46, 255] })
const VERSION = empreinte16(PNG)
const LOGO = { nom: 'Cabinet Exemple', png: PNG, version: VERSION, largeur: 800, hauteur: 296 }
const COLONNES_LOGO = ['logo_png', 'logo_largeur', 'logo_hauteur', 'logo_version', 'logo_maj_le']

const signalement = (sur: Partial<SignalementQr> = {}): SignalementQr => ({
  id: '5f2c9a1e-1111-4222-8333-444444444444',
  coproprieteId: 'c1', coproprieteNom: 'Résidence Exemple',
  prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00', email: 'declarant@exemple.test',
  batiment: 'B', etage: '4', numLot: '12', estPartieCommune: false, zoneSignalee: '',
  typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier',
  priorite: 'urgente', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: null,
  confirmationEnvoyeeLe: null, confirmationErreur: null,
  qualiteDeclarant: 'proprietaire', adresseProposee: '', signalementLieId: null,
  creeLe: '2026-11-04T13:05:00.000Z', misAJourLe: '2026-11-04T13:05:00.000Z',
  ...sur,
})

/** Rangée du logo, telle que l'accusé la porte (repérée pour vérifier que RIEN d'autre ne change). */
const RANGEE_LOGO = /\n {8}<tr><td style="background:#FFFFFF;[^"]*"><img [^>]*><\/td><\/tr>/

beforeEach(() => {
  h.sendEmail.mockClear()
  h.sendBatchEmails.mockClear()
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  A.poserJeuAccesQr()
})

describe('accusé de réception : logo en pièce jointe en ligne', () => {
  it('une seule image, appelée par cid:, texte alternatif = nom du cabinet, dimensions en attributs, sur fond blanc', () => {
    const { html } = emails.templateConfirmationQr({ copropriete: { nom: 'Résidence Exemple' }, signalement: signalement(), logo: LOGO })
    const images = html.match(/<img [^>]*>/g) ?? []
    expect(images).toHaveLength(1)
    const [image] = images
    expect(image).toContain(`src="cid:${emails.CID_LOGO_CABINET_QR}"`)
    expect(image).toContain('alt="Cabinet Exemple"')
    // 800 × 296 dans 240 × 64 : 173 × 64, proportions gardées.
    expect(image).toContain('width="173"')
    expect(image).toContain('height="64"')
    expect(html).toMatch(RANGEE_LOGO)
    // Aucune image distante, aucune adresse : rien à charger depuis vitfix.io ni ailleurs.
    expect(image).not.toMatch(/https?:|\/\/|data:/i)
    // Au-dessus du bandeau bleu nuit, dans la carte.
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('background:#0D1B2E'))
  })

  it('le reste du message est octet pour octet celui d’avant (FR et PT, annonce et politique comprises)', () => {
    const politique = { cabinet: 'Cabinet Exemple', url: 'https://cabinet-exemple.test/confidentialite' }
    for (const s of [signalement(), signalement({ langue: 'pt', estPartieCommune: true, zoneSignalee: 'Escada' })]) {
      for (const options of [{}, { annoncerDiffusion: true, politique }]) {
        const sans = emails.templateConfirmationQr({ copropriete: { nom: 'Résidence Exemple' }, signalement: s, ...options })
        const avec = emails.templateConfirmationQr({ copropriete: { nom: 'Résidence Exemple' }, signalement: s, ...options, logo: LOGO })
        expect(avec.subject).toBe(sans.subject)
        expect(avec.html.replace(RANGEE_LOGO, '')).toBe(sans.html)
      }
    }
  })

  it('nom du cabinet échappé dans le texte alternatif', () => {
    const { html } = emails.templateConfirmationQr({
      copropriete: { nom: 'Résidence Exemple' }, signalement: signalement(), logo: { ...LOGO, nom: 'Cabinet "A&B" <script>' },
    })
    expect(html).toContain('alt="Cabinet &quot;A&amp;B&quot; &lt;script&gt;"')
    expect(html).not.toContain('<script>')
  })

  it('petit logo : jamais agrandi', () => {
    const { html } = emails.templateConfirmationQr({ copropriete: { nom: 'Résidence Exemple' }, signalement: signalement(), logo: { ...LOGO, largeur: 120, hauteur: 30 } })
    expect(html).toContain('width="120"')
    expect(html).toContain('height="30"')
  })

  it('envoi unitaire (sendEmail) : la pièce jointe en ligne (PNG en base64, image/png, contentId) ; aucun autre champ ajouté', async () => {
    await emails.envoyerConfirmationQr({ copropriete: { nom: 'Résidence Exemple' }, signalement: signalement(), logo: LOGO })
    expect(h.sendBatchEmails).not.toHaveBeenCalled()
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    const charge = h.sendEmail.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(charge).sort()).toEqual(['attachments', 'html', 'subject', 'tags', 'to'])
    expect(charge.attachments).toEqual([{
      filename: 'logo.png', content: Buffer.from(PNG).toString('base64'), contentType: 'image/png', contentId: emails.CID_LOGO_CABINET_QR,
    }])
    expect(String(charge.html)).toContain(`src="cid:${emails.CID_LOGO_CABINET_QR}"`)
    expect(charge.to).toEqual(['declarant@exemple.test'])
  })

  it('logo null : accusé et envoi d’avant (aucune pièce jointe)', async () => {
    await emails.envoyerConfirmationQr({ copropriete: { nom: 'Résidence Exemple' }, signalement: signalement(), logo: null })
    const charge = h.sendEmail.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(charge).sort()).toEqual(['html', 'subject', 'tags', 'to'])
    expect(String(charge.html)).not.toContain('<img')
  })
})

describe('lireLogoEmailDeCoproprieteQr : image revérifiée du cabinet de la copropriété', () => {
  function poserLogo(png: Uint8Array, largeur: number, hauteur: number, version = empreinte16(png)): void {
    const ligne = baseQr.table('signalements_qr_cabinets').find((c) => c.id === CAB)
    Object.assign(ligne ?? {}, { logo_png: hexBytea(png), logo_largeur: largeur, logo_hauteur: hauteur, logo_version: version, logo_maj_le: '2026-11-13T10:00:00+00:00' })
  }

  it('copropriété d’un cabinet qui a un logo : nom, octets du PNG, version, dimensions', async () => {
    poserLogo(PNG, 800, 296)
    const logo = await serveurLogo.lireLogoEmailDeCoproprieteQr(C1)
    expect(logo).toMatchObject({ nom: 'Cabinet Exemple', version: VERSION, largeur: 800, hauteur: 296 })
    expect(Buffer.from(logo?.png ?? new Uint8Array()).equals(Buffer.from(PNG))).toBe(true)
  })

  it('copropriété sans cabinet, cabinet sans logo, copropriété inconnue : null', async () => {
    expect(await serveurLogo.lireLogoEmailDeCoproprieteQr(C1)).toBeNull()
    poserLogo(PNG, 800, 296)
    expect(await serveurLogo.lireLogoEmailDeCoproprieteQr(C_SANS)).toBeNull()
    expect(await serveurLogo.lireLogoEmailDeCoproprieteQr('c0000000-0000-4000-8000-0000000000ff')).toBeNull()
  })

  it('image stockée illisible (dimensions qui ne sont pas celles de l’en-tête) : null, jamais envoyée', async () => {
    poserLogo(PNG, 400, 296)
    expect(await serveurLogo.lireLogoEmailDeCoproprieteQr(C1)).toBeNull()
    expect(simulQr.logger.error).toHaveBeenCalled()
  })

  it('migration 20261114 absente : null, repli journalisé une fois', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_cabinets = COLONNES_LOGO
    expect(await serveurLogo.lireLogoEmailDeCoproprieteQr(C1)).toBeNull()
    expect(await serveurLogo.lireLogoEmailDeCoproprieteQr(C1)).toBeNull()
    const replis = simulQr.logger.warn.mock.calls.filter(([m]) => String(m).includes('migration du 14/11/2026 absente'))
    expect(replis).toHaveLength(1)
    expect(replis[0][1]).toMatchObject({ migration: MIGRATION_LOGO_QR })
  })

  it('colonne cabinet_id absente (migration 20261111) : null, repli journalisé une fois sous la clé du logo (les autres lectures du dépôt journalisent la 20261111)', async () => {
    poserLogo(PNG, 800, 296)
    baseQr.etat.colonnesAbsentes.signalements_qr_coproprietes = ['cabinet_id']
    expect(await serveurLogo.lireLogoEmailDeCoproprieteQr(C1)).toBeNull()
    expect(await serveurLogo.lireLogoEmailDeCoproprieteQr(C1)).toBeNull()
    const messages = simulQr.logger.warn.mock.calls.map(([m]) => String(m))
    expect(messages.filter((m) => m.includes('repli (logo de l’accusé de réception)'))).toHaveLength(1)
    expect(messages.filter((m) => m.includes('migration du 11/11/2026 absente'))).toHaveLength(0)
    expect(simulQr.logger.error).not.toHaveBeenCalled()
  })

  it('erreur de la base : null, code seul au journal', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_cabinets = { code: '57014', message: 'canceling statement due to statement timeout' }
    expect(await serveurLogo.lireLogoEmailDeCoproprieteQr(C1)).toBeNull()
    const appels = [...simulQr.logger.error.mock.calls, ...simulQr.logger.warn.mock.calls].filter(([m]) => String(m).includes('logo'))
    expect(appels.map(([, contexte]) => contexte)).toEqual([{ code: '57014', copropriete: C1 }])
  })

  it('exception : null, nom de l’exception seul au journal (l’accusé part sans logo)', async () => {
    const from = baseQr.client.from
    baseQr.client.from = (() => { throw new TypeError('fetch failed : https://exemple.test') }) as typeof from
    try {
      expect(await serveurLogo.lireLogoEmailDeCoproprieteQr(C1)).toBeNull()
    } finally {
      baseQr.client.from = from
    }
    const appel = [...simulQr.logger.warn.mock.calls, ...simulQr.logger.error.mock.calls].find(([m]) => String(m).includes('logo'))
    expect(appel?.[1]).toEqual({ exception: 'TypeError', copropriete: C1 })
  })
})
