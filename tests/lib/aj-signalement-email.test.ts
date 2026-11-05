// tests/lib/aj-signalement-email.test.ts
//
// E-mail reçu par l'administrateur pour un signalement QR : objet (urgence, type, copropriété, lot), contenu
// échappé (jamais de HTML du déclarant), liens tel: / mailto:, lien vers le tableau de bord, envoi par
// sendEmail avec réponse directe au déclarant.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  sendEmail: vi.fn<(charge: unknown) => Promise<{ success: boolean; id?: string; error?: string }>>(async () => ({ success: true, id: 'mail-1' })),
}))
vi.mock('@/lib/email', () => ({ sendEmail: h.sendEmail }))

import { envoyerEmailSignalementQr, echapperHtml, sujetSignalementQr, templateSignalementQr } from '@/lib/aj-signalement/email'
import type { SignalementQr } from '@/lib/aj-signalement/types'

function signalement(sur: Partial<SignalementQr> = {}): SignalementQr {
  return {
    id: '5f2c9a1e-1111-4222-8333-444444444444',
    coproprieteId: 'c1', coproprieteNom: 'Parc Belle Ombre',
    prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie.durand@example.com',
    batiment: 'B', etage: '4', numLot: '12', estPartieCommune: false, zoneSignalee: '',
    typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier\n<script>alert(1)</script>',
    priorite: 'urgente', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: null,
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
