// tests/lib/aj-signalement-logo-emails-sans-logo.test.ts
//
// Logo d'un cabinet client (demande de Hugo du 13/11/2026), non-régression des e-mails : SANS logo (cabinet qui n'en a
// pas, copropriété sans cabinet, migration 20261114 non appliquée), l'accusé de réception au déclarant et les e-mails
// de signalement aux destinataires sont OCTET POUR OCTET ceux d'avant le logo, et leur envoi est le même (mêmes champs,
// aucune pièce jointe). Les empreintes SHA-256 et les instantanés ci-dessous ont été écrits sur le code d'avant le logo
// (commit 055e7f24) : ils ne doivent plus bouger. Le service d'e-mail est simulé ; données fictives.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

const h = vi.hoisted(() => ({
  sendEmail: vi.fn<(charge: unknown) => Promise<{ success: boolean; id?: string; error?: string }>>(async () => ({ success: true, id: 'mail-1' })),
  sendBatchEmails: vi.fn<(lot: unknown[]) => Promise<{ sent: number; failed: number; errors: string[] }>>(async (lot) => ({ sent: lot.length, failed: 0, errors: [] })),
}))
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail, sendBatchEmails: h.sendBatchEmails }))

const { envoyerConfirmationQr, envoyerEmailsSignalementQr, templateConfirmationQr, templateSignalementQr } = await import('@/lib/aj-signalement/email')
import type { DestinataireQr, SignalementQr } from '@/lib/aj-signalement/types'

const empreinte = (texte: string): string => createHash('sha256').update(texte).digest('hex')

const signalement = (sur: Partial<SignalementQr> = {}): SignalementQr => ({
  id: '5f2c9a1e-1111-4222-8333-444444444444',
  coproprieteId: 'c1', coproprieteNom: 'Résidence Exemple',
  prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00', email: 'declarant@exemple.test',
  batiment: 'B', etage: '4', numLot: '12', estPartieCommune: false, zoneSignalee: '',
  typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier\n<b>texte</b>',
  priorite: 'urgente', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: null,
  confirmationEnvoyeeLe: null, confirmationErreur: null,
  qualiteDeclarant: 'proprietaire', adresseProposee: '', signalementLieId: null,
  creeLe: '2026-11-04T13:05:00.000Z', misAJourLe: '2026-11-04T13:05:00.000Z',
  ...sur,
})

const POLITIQUE = { cabinet: 'Cabinet Exemple', url: 'https://cabinet-exemple.test/confidentialite' }

beforeEach(() => {
  h.sendEmail.mockClear()
  h.sendBatchEmails.mockClear()
})

describe('accusé de réception sans logo : HTML d’avant le logo', () => {
  it('FR (d’origine ; annonce et politique) et PT (parties communes, politique)', () => {
    const cas = [
      { s: signalement(), options: {} },
      { s: signalement(), options: { annoncerDiffusion: true, politique: POLITIQUE } },
      { s: signalement({ langue: 'pt', estPartieCommune: true, zoneSignalee: 'Escada', priorite: 'normale' }), options: { politique: POLITIQUE } },
    ]
    const sorties = cas.map(({ s, options }) => {
      const { subject, html } = templateConfirmationQr({ copropriete: { nom: 'Résidence Exemple' }, signalement: s, ...options })
      return { subject, html: empreinte(html), longueur: html.length }
    })
    expect(sorties).toMatchInlineSnapshot(`
      [
        {
          "html": "e3067958079bd8b235085bb9b5189df9fcb92a5f80a84cbb25f0595a71ae2bc5",
          "longueur": 4546,
          "subject": "Votre signalement n° 5F2C9A1E a bien été enregistré — Résidence Exemple",
        },
        {
          "html": "c852ecd321b0523c058b29cbab4f668454d1408e3162352d204b3c6bdfdf92ac",
          "longueur": 5145,
          "subject": "Votre signalement n° 5F2C9A1E a bien été enregistré — Résidence Exemple",
        },
        {
          "html": "06549dd379f4c7c9141bc808d41c464d9872af6f1c37a40a5b9d48a1a315dba1",
          "longueur": 4935,
          "subject": "A sua ocorrência n.º 5F2C9A1E foi registada — Résidence Exemple",
        },
      ]
    `)
  })

  it('envoi : mêmes champs qu’avant, aucune pièce jointe', async () => {
    await envoyerConfirmationQr({ copropriete: { nom: 'Résidence Exemple' }, signalement: signalement() })
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    const charge = h.sendEmail.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(charge).sort()).toEqual(['html', 'subject', 'tags', 'to'])
    expect({ ...charge, html: empreinte(String(charge.html)) }).toMatchInlineSnapshot(`
      {
        "html": "e3067958079bd8b235085bb9b5189df9fcb92a5f80a84cbb25f0595a71ae2bc5",
        "subject": "Votre signalement n° 5F2C9A1E a bien été enregistré — Résidence Exemple",
        "tags": [
          {
            "name": "type",
            "value": "aj-signalement-confirmation",
          },
        ],
        "to": [
          "declarant@exemple.test",
        ],
      }
    `)
  })
})

describe('e-mails de signalement aux destinataires : HTML d’avant le logo (un lot, aucune pièce jointe)', () => {
  const destinataires: DestinataireQr[] = [
    { email: 'admin@exemple.test', type: 'administrateur', accesOuvert: false },
    { email: 'gestion@exemple.test', type: 'gestionnaire', accesOuvert: true },
    { email: 'cs@externe.test', type: 'saisi', accesOuvert: false },
  ]

  it('gabarits par type de destinataire', () => {
    const copropriete = { nom: 'Résidence Exemple', adresse: '1 rue Exemple, 13001 Marseille' }
    const sorties = (['administrateur', 'gestionnaire', 'saisi'] as const).map((destinataire) => {
      const { subject, html } = templateSignalementQr({ copropriete, signalement: signalement(), destinataire, lienSuivi: 'https://vitfix.io/cabinet-exemple/suivi/#signalements' })
      return { destinataire, subject, html: empreinte(html), longueur: html.length }
    })
    expect(sorties).toMatchInlineSnapshot(`
      [
        {
          "destinataire": "administrateur",
          "html": "1597b229ac580f207802f8b3a9c926ca3828a2ecc9718f95dbc1425a7b1206e7",
          "longueur": 5250,
          "subject": "[AJ Signalement] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
        },
        {
          "destinataire": "gestionnaire",
          "html": "109c3374e7c97468dec96620ea508d91d86cb53b00edeab9ab788408c6d9f0a4",
          "longueur": 5235,
          "subject": "[AJ Signalement] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
        },
        {
          "destinataire": "saisi",
          "html": "e49aceb37d797b2514359759696005757a76d293037376299d9b3de3ebb4840e",
          "longueur": 4944,
          "subject": "[AJ Signalement] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
        },
      ]
    `)
  })

  it('envoi : un seul lot, mêmes champs qu’avant pour chaque message', async () => {
    await envoyerEmailsSignalementQr({
      destinataires, signalement: signalement(), copropriete: { nom: 'Résidence Exemple', adresse: '' },
      lienSuivi: 'https://vitfix.io/cabinet-exemple/suivi/#signalements',
    })
    expect(h.sendBatchEmails).toHaveBeenCalledTimes(1)
    expect(h.sendEmail).not.toHaveBeenCalled()
    const lot = h.sendBatchEmails.mock.calls[0][0] as Array<Record<string, unknown>>
    for (const m of lot) expect(Object.keys(m).sort()).toEqual(['html', 'replyTo', 'subject', 'tags', 'to'])
    expect(lot.map((m) => ({ ...m, html: empreinte(String(m.html)) }))).toMatchInlineSnapshot(`
      [
        {
          "html": "4f8ccf5bead0daa139a6f71538d439a74a88542fd150c96cd635bccad0f0b25f",
          "replyTo": "declarant@exemple.test",
          "subject": "[AJ Signalement] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
          "tags": [
            {
              "name": "type",
              "value": "aj-signalement",
            },
          ],
          "to": "admin@exemple.test",
        },
        {
          "html": "a71c26c5d63cee6969e6e61793433f91f477d4aa895998c14e6925dd2e50be87",
          "replyTo": "declarant@exemple.test",
          "subject": "[AJ Signalement] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
          "tags": [
            {
              "name": "type",
              "value": "aj-signalement",
            },
          ],
          "to": "gestion@exemple.test",
        },
        {
          "html": "c3d592508a629a0c59183e8bedfd4b4b136d4aca48d7599499c05ed798fbf488",
          "replyTo": "declarant@exemple.test",
          "subject": "[AJ Signalement] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
          "tags": [
            {
              "name": "type",
              "value": "aj-signalement",
            },
          ],
          "to": "cs@externe.test",
        },
      ]
    `)
  })
})
