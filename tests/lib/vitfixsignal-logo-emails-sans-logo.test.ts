// tests/lib/vitfixsignal-logo-emails-sans-logo.test.ts
//
// Logo d'un cabinet client (demande de Hugo du 13/11/2026), non-régression des e-mails : SANS logo (cabinet qui n'en a
// pas, copropriété sans cabinet, migration 20261114 non appliquée), l'accusé de réception au déclarant et les e-mails
// de signalement aux destinataires sont OCTET POUR OCTET ceux d'avant le logo, et leur envoi est le même (mêmes champs,
// aucune pièce jointe). Les empreintes SHA-256 et les instantanés ci-dessous ont été écrits sur le code d'avant le logo
// (commit 055e7f24) : ils ne doivent plus bouger. Le service d'e-mail est simulé ; données fictives.
// R70 du dossier téléphonie (14/11/2026, brouillon) : l'accusé d'un signalement URGENT porte en plus, en tête, la consigne
// d'appel aux secours (blocConsigneSecoursQr). Elle est vérifiée puis retirée avant le calcul des empreintes, qui restent
// celles d'avant : rien d'autre n'a changé dans l'accusé.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

const h = vi.hoisted(() => ({
  sendEmail: vi.fn<(charge: unknown) => Promise<{ success: boolean; id?: string; error?: string }>>(async () => ({ success: true, id: 'mail-1' })),
  sendBatchEmails: vi.fn<(lot: unknown[]) => Promise<{ sent: number; failed: number; errors: string[] }>>(async (lot) => ({ sent: lot.length, failed: 0, errors: [] })),
}))
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail, sendBatchEmails: h.sendBatchEmails }))

const {
  blocConsigneSecoursQr, envoyerConfirmationQr, envoyerEmailsSignalementQr, templateConfirmationQr, templateSignalementQr,
} = await import('@/lib/vitfixsignal/email')
import type { DestinataireQr, SignalementQr } from '@/lib/vitfixsignal/types'

const empreinte = (texte: string): string => createHash('sha256').update(texte).digest('hex')

/** Accusé sans la consigne d'appel aux secours (R70), après avoir vérifié qu'elle y est une fois si et seulement si urgent. */
function sansConsigne(html: string, s: Pick<SignalementQr, 'priorite' | 'langue'>): string {
  const bloc = blocConsigneSecoursQr(s.langue)
  expect(html.split(bloc).length - 1).toBe(s.priorite === 'urgente' ? 1 : 0)
  return html.replace(bloc, '')
}

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
      const { subject, html: complet } = templateConfirmationQr({ copropriete: { nom: 'Résidence Exemple' }, signalement: s, ...options })
      const html = sansConsigne(complet, s)
      return { subject, html: empreinte(html), longueur: html.length }
    })
    expect(sorties).toMatchInlineSnapshot(`
      [
        {
          "html": "64f997e406cf16f91059b74fabf64660a98c76f2fee2f035c71d30a6342aeab6",
          "longueur": 4544,
          "subject": "Votre signalement n° 5F2C9A1E a bien été enregistré — Résidence Exemple",
        },
        {
          "html": "8f6ba6206a770a526b1d63f69c46b36e88b6b6e624923450853f280fe1e2ab83",
          "longueur": 5143,
          "subject": "Votre signalement n° 5F2C9A1E a bien été enregistré — Résidence Exemple",
        },
        {
          "html": "b84ba268ed3a4f282ac14e3611d929efe61a8050cde0ba02631d02d58a2f5272",
          "longueur": 4933,
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
    expect({ ...charge, html: empreinte(sansConsigne(String(charge.html), signalement())) }).toMatchInlineSnapshot(`
      {
        "html": "64f997e406cf16f91059b74fabf64660a98c76f2fee2f035c71d30a6342aeab6",
        "subject": "Votre signalement n° 5F2C9A1E a bien été enregistré — Résidence Exemple",
        "tags": [
          {
            "name": "type",
            "value": "vitfixsignal-confirmation",
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
          "html": "70c52883a3b2bf75eb6574f01a49cdba4fca6710d6fc0676bab5919adefd28eb",
          "longueur": 5246,
          "subject": "[Vitfix Signal] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
        },
        {
          "destinataire": "gestionnaire",
          "html": "a5ac82e0eead54b8a6327ba6f2ec9e590bcf4c3f3aece87a2ea62c0aa25958e7",
          "longueur": 5233,
          "subject": "[Vitfix Signal] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
        },
        {
          "destinataire": "saisi",
          "html": "58359f91139b7779d45733b4b21e2acbfeb7be622e18f62e037c294574c9e8bc",
          "longueur": 4942,
          "subject": "[Vitfix Signal] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
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
          "html": "66a88ac5d61470602b9b5d96e8b207dad336099656da8d01b04bf040add8a722",
          "replyTo": "declarant@exemple.test",
          "subject": "[Vitfix Signal] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
          "tags": [
            {
              "name": "type",
              "value": "vitfixsignal",
            },
          ],
          "to": "admin@exemple.test",
        },
        {
          "html": "043e3d544a247b5b8fb5f58eb01cdf8a4ab6bd8d4c427bb046a88467bf2fd959",
          "replyTo": "declarant@exemple.test",
          "subject": "[Vitfix Signal] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
          "tags": [
            {
              "name": "type",
              "value": "vitfixsignal",
            },
          ],
          "to": "gestion@exemple.test",
        },
        {
          "html": "c8ff331995ed2fd1f9cae604901f547934b5e095e73063cae690a53de676ef0a",
          "replyTo": "declarant@exemple.test",
          "subject": "[Vitfix Signal] URGENT — Plomberie (fuite, colonne, robinetterie) — Résidence Exemple — lot 12",
          "tags": [
            {
              "name": "type",
              "value": "vitfixsignal",
            },
          ],
          "to": "cs@externe.test",
        },
      ]
    `)
  })
})
