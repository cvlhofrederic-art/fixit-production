// tests/lib/aj-signalement-email.test.ts
//
// E-mail reçu par l'administrateur pour un signalement QR : objet (urgence, type, copropriété, lot), contenu
// échappé (jamais de HTML du déclarant), liens tel: / mailto:, lien vers le tableau de bord, envoi par
// sendEmail avec réponse directe au déclarant.
// E-mail de confirmation au déclarant : langue de la page (FR / PT), numéro, copropriété, date et heure de
// Paris, récapitulatif échappé, suite sans promesse, « ne répondez pas » ; envoyé au seul déclarant, sans
// adresse de réponse ; clé de la limite par adresse = empreinte SHA-256 (jamais l'adresse en clair) de la boîte
// canonique (sans sous-adresse « + » ; sans points et en gmail.com pour Gmail).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

const h = vi.hoisted(() => ({
  sendEmail: vi.fn<(charge: unknown) => Promise<{ success: boolean; id?: string; error?: string }>>(async () => ({ success: true, id: 'mail-1' })),
}))
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail }))

import {
  FENETRE_CONFIRMATIONS_MS, LIMITE_CONFIRMATIONS_PAR_ADRESSE, boiteCanoniqueConfirmationQr, cleLimiteConfirmationQr, envoyerConfirmationQr,
  envoyerEmailSignalementQr, echapperHtml, sujetConfirmationQr, sujetSignalementQr, templateConfirmationQr, templateSignalementQr,
} from '@/lib/aj-signalement/email'
import type { SignalementQr } from '@/lib/aj-signalement/types'

function signalement(sur: Partial<SignalementQr> = {}): SignalementQr {
  return {
    id: '5f2c9a1e-1111-4222-8333-444444444444',
    coproprieteId: 'c1', coproprieteNom: 'Parc Belle Ombre',
    prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie.durand@example.com',
    batiment: 'B', etage: '4', numLot: '12', estPartieCommune: false, zoneSignalee: '',
    typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier\n<script>alert(1)</script>',
    priorite: 'urgente', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: null,
    confirmationEnvoyeeLe: null, confirmationErreur: null,
    creeLe: '2026-11-04T13:05:00.000Z', misAJourLe: '2026-11-04T13:05:00.000Z',
    ...sur,
  }
}

const copropriete = { nom: 'Parc Belle Ombre', adresse: '12 allée des Pins, 13009 Marseille' }

beforeEach(() => h.sendEmail.mockClear())

describe('objet et contenu', () => {
  it('objet : URGENT en tête quand le déclarant indique une urgence, puis type, copropriété, lot', () => {
    expect(sujetSignalementQr(signalement(), 'Parc Belle Ombre')).toBe('[AJ Signalement] URGENT — Plomberie (fuite, colonne, robinetterie) — Parc Belle Ombre — lot 12')
    expect(sujetSignalementQr(signalement({ priorite: 'normale' }), 'Parc Belle Ombre')).toBe('[AJ Signalement] Plomberie (fuite, colonne, robinetterie) — Parc Belle Ombre — lot 12')
  })

  it('le HTML porte les coordonnées, le lieu, la description échappée et le lien du tableau de bord', () => {
    const { html } = templateSignalementQr({ copropriete, signalement: signalement(), origine: 'https://vitfix.io/' })
    expect(html).toContain('Marie')
    expect(html).toContain('href="tel:0612345678"')
    expect(html).toContain('href="mailto:marie.durand@example.com"')
    expect(html).toContain('12 allée des Pins, 13009 Marseille')
    expect(html).toContain('Logement (bât. B, étage 4, lot 12)')
    expect(html).toContain('Fuite sous l’évier<br/>&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('5F2C9A1E')
    expect(html).toContain('https://vitfix.io/fr/coproprietaire/dashboard/#signalementsQr')
    expect(html).toContain('4 novembre 2026')
    expect(html).toContain('Signalement urgent')
  })

  it('échappement : &, <, >, guillemets et apostrophes', () => {
    expect(echapperHtml(`<a href="x">Tom & Jerry's</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;')
  })
})

describe('envoi', () => {
  it('sendEmail reçoit les destinataires, l’objet, le HTML et la réponse directe au déclarant', async () => {
    const resultat = await envoyerEmailSignalementQr({ destinataires: ['admin@vitfix.io', 'cabinet@example.com'], copropriete, signalement: signalement() })
    expect(resultat).toEqual({ success: true, id: 'mail-1' })
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    const appel = h.sendEmail.mock.calls[0][0] as { to: string[]; subject: string; html: string; replyTo: string; tags: Array<{ name: string; value: string }> }
    expect(appel.to).toEqual(['admin@vitfix.io', 'cabinet@example.com'])
    expect(appel.subject).toContain('URGENT')
    expect(appel.replyTo).toBe('marie.durand@example.com')
    expect(appel.tags).toEqual([{ name: 'type', value: 'aj-signalement' }])
  })
})

describe('confirmation au déclarant', () => {
  const coproConfirmation = { nom: 'Parc Belle Ombre' }

  it('FR : objet, numéro, copropriété, date et heure de Paris, récapitulatif du logement, suite et « ne répondez pas »', () => {
    const { subject, html } = templateConfirmationQr({ copropriete: coproConfirmation, signalement: signalement() })
    expect(subject).toBe('Votre signalement n° 5F2C9A1E a bien été enregistré — Parc Belle Ombre')
    expect(sujetConfirmationQr('5F2C9A1E', 'Parc Belle Ombre', 'fr')).toBe(subject)
    expect(html).toContain('<html lang="fr">')
    expect(html).toContain('5F2C9A1E')
    expect(html).toContain('Parc Belle Ombre')
    expect(html).toContain('4 novembre 2026 à 14:05 (heure de Paris)')
    expect(html).toContain('Votre logement (bât. B · étage 4 · lot 12)')
    expect(html).toContain('Plomberie (fuite, colonne, robinetterie)')
    expect(html).toContain('Urgent')
    expect(html).toContain('Fuite sous l’évier<br/>&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('transmis à l’administrateur de la copropriété')
    expect(html).toContain('pourra vous recontacter')
    expect(html).toContain('ne répondez pas à cet e-mail')
  })

  it('parties communes : le lieu et la zone, sans la situation du lot', () => {
    const { html } = templateConfirmationQr({
      copropriete: coproConfirmation, signalement: signalement({ estPartieCommune: true, zoneSignalee: 'Hall d’entrée', priorite: 'normale' }),
    })
    expect(html).toContain('Parties communes')
    expect(html).toContain('Hall d’entrée')
    expect(html).not.toContain('Votre logement')
    expect(html).toContain('Normal')
  })

  it('ne révèle ni destinataire, ni tableau de bord, ni coordonnées ; aucune promesse d’intervention ni de délai', () => {
    const { html } = templateConfirmationQr({ copropriete: coproConfirmation, signalement: signalement() })
    expect(html).not.toContain('mailto:')
    expect(html).not.toContain('tel:')
    expect(html).not.toContain('coproprietaire/dashboard')
    expect(html).not.toContain('@')
    expect(html).not.toContain('06 12 34 56 78')
    expect(html).not.toContain('Durand')
    expect(html).not.toMatch(/48 ?h|immédiatement|sous \d|intervention sera/i)
  })

  it('PT : textes, date et heure de Paris, habitação, « não responda »', () => {
    const { subject, html } = templateConfirmationQr({
      copropriete: coproConfirmation,
      signalement: signalement({ langue: 'pt', typeIntervention: 'Canalização (fuga, coluna, torneiras)', description: 'Fuga debaixo do lava-loiça' }),
    })
    expect(subject).toBe('A sua ocorrência n.º 5F2C9A1E foi registada — Parc Belle Ombre')
    expect(html).toContain('<html lang="pt">')
    expect(html).toContain('4 de novembro de 2026 às 14:05 (hora de Paris)')
    expect(html).toContain('A sua habitação (bloco B · piso 4 · fração 12)')
    expect(html).toContain('Canalização (fuga, coluna, torneiras)')
    expect(html).toContain('Urgente')
    expect(html).toContain('transmitida ao administrador do condomínio')
    expect(html).toContain('não responda a este e-mail')
    expect(html).not.toContain('Votre signalement')
  })

  it('tout le contenu saisi est échappé : type, zone, bâtiment, étage, lot, copropriété', () => {
    const piege = '<b onmouseover="x">'
    const { html } = templateConfirmationQr({
      copropriete: { nom: `Résidence ${piege}` },
      signalement: signalement({ typeIntervention: piege, batiment: piege, etage: piege, numLot: piege }),
    })
    expect(html).not.toContain('<b onmouseover')
    expect(html).toContain('&lt;b onmouseover=&quot;x&quot;&gt;')
    const communes = templateConfirmationQr({ copropriete: coproConfirmation, signalement: signalement({ estPartieCommune: true, zoneSignalee: piege }) })
    expect(communes.html).not.toContain('<b onmouseover')
    expect(communes.html).toContain('&lt;b onmouseover=&quot;x&quot;&gt;')
  })

  it('envoi : au seul déclarant, sans adresse de réponse ni copie, avec le tag de la confirmation', async () => {
    const resultat = await envoyerConfirmationQr({ copropriete: coproConfirmation, signalement: signalement() })
    expect(resultat).toEqual({ success: true, id: 'mail-1' })
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    const appel = h.sendEmail.mock.calls[0][0] as Record<string, unknown>
    expect(appel.to).toEqual(['marie.durand@example.com'])
    expect(appel).not.toHaveProperty('replyTo')
    expect(appel).not.toHaveProperty('cc')
    expect(appel).not.toHaveProperty('bcc')
    expect(appel.subject).toBe('Votre signalement n° 5F2C9A1E a bien été enregistré — Parc Belle Ombre')
    expect(appel.tags).toEqual([{ name: 'type', value: 'aj-signalement-confirmation' }])
  })

  it('limite par adresse : 3 par heure ; clé = empreinte SHA-256 de l’adresse en minuscules, jamais l’adresse', async () => {
    expect(LIMITE_CONFIRMATIONS_PAR_ADRESSE).toBe(3)
    expect(FENETRE_CONFIRMATIONS_MS).toBe(3_600_000)
    const cle = await cleLimiteConfirmationQr(' Marie.Durand@Example.com ')
    expect(cle).toBe(`qr_confirmation_${createHash('sha256').update('marie.durand@example.com').digest('hex')}`)
    expect(cle).not.toContain('marie')
    expect(cle).not.toContain('@')
    expect(await cleLimiteConfirmationQr('paul@example.com')).not.toBe(cle)
  })

  it('boîte canonique : sous-adresse « + » coupée partout ; points retirés et googlemail.com ramené à gmail.com pour Gmail', () => {
    expect(boiteCanoniqueConfirmationQr(' X+1@D.fr ')).toBe('x@d.fr')
    expect(boiteCanoniqueConfirmationQr('x+a+b@d.fr')).toBe('x@d.fr')
    expect(boiteCanoniqueConfirmationQr('V.Ictime+promo@GoogleMail.com')).toBe('victime@gmail.com')
    expect(boiteCanoniqueConfirmationQr('v.i.c.t.i.m.e@gmail.com')).toBe('victime@gmail.com')
    // Hors Gmail, les points distinguent des boîtes différentes : ils restent.
    expect(boiteCanoniqueConfirmationQr('marie.durand@example.com')).toBe('marie.durand@example.com')
    expect(boiteCanoniqueConfirmationQr('jean.dupont@outlook.fr')).toBe('jean.dupont@outlook.fr')
  })

  it('variantes d’une même boîte : même clé de limite ; boîtes différentes : clés différentes', async () => {
    const cleGmail = await cleLimiteConfirmationQr('victime@gmail.com')
    for (const variante of ['victime+1@gmail.com', 'v.ictime@gmail.com', 'victime@googlemail.com', 'Vic.Time+2@GoogleMail.com']) {
      expect(await cleLimiteConfirmationQr(variante), variante).toBe(cleGmail)
    }
    const cleX = await cleLimiteConfirmationQr('x@d.fr')
    expect(await cleLimiteConfirmationQr('x+1@d.fr')).toBe(cleX)
    expect(await cleLimiteConfirmationQr('x+2@d.fr')).toBe(cleX)
    expect(await cleLimiteConfirmationQr('x.y@d.fr')).not.toBe(await cleLimiteConfirmationQr('xy@d.fr'))
    expect(await cleLimiteConfirmationQr('victime@outlook.fr')).not.toBe(cleGmail)
  })
})
