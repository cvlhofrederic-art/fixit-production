// tests/lib/aj-signalement-consigne-secours-email.test.ts
//
// R70 du dossier téléphonie (14/11/2026, brouillon : textes à valider par le référent métier, présentation par Frédéric, portugais H4) :
// l'accusé de réception d'un signalement URGENT porte la consigne renforcée d'appel aux secours, dans la langue du
// signalement (mêmes textes que la page publique, lib/aj-signalement/textes.ts), une seule fois, en tête du message ;
// ni lien ni bouton ajoutés ; tout le contenu saisi reste échappé. Priorités « normale » et « à planifier » : rien.
// Le service d'e-mail est simulé ; données fictives.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), sendBatchEmails: vi.fn(), sendBatchEmailsDetaille: vi.fn() }))

const { blocConsigneSecoursQr, templateConfirmationQr } = await import('@/lib/aj-signalement/email')
const { TEXTES_SIGNALEMENT_QR } = await import('@/lib/aj-signalement/textes')
import type { SignalementQr } from '@/lib/aj-signalement/types'

const signalement = (sur: Partial<SignalementQr> = {}): SignalementQr => ({
  id: '5f2c9a1e-1111-4222-8333-444444444444',
  coproprieteId: 'c1', coproprieteNom: 'Résidence Exemple',
  prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00', email: 'declarant@exemple.test',
  batiment: 'B', etage: '4', numLot: '12', estPartieCommune: false, zoneSignalee: '',
  typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier\n<script>alert(1)</script>',
  priorite: 'urgente', statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: null,
  confirmationEnvoyeeLe: null, confirmationErreur: null,
  qualiteDeclarant: 'proprietaire', adresseProposee: '', signalementLieId: null,
  creeLe: '2026-11-04T13:05:00.000Z', misAJourLe: '2026-11-04T13:05:00.000Z',
  ...sur,
})

const accuse = (s: SignalementQr) => templateConfirmationQr({ copropriete: { nom: 'Résidence Exemple' }, signalement: s }).html
const occurrences = (html: string, morceau: string) => html.split(morceau).length - 1

describe('accusé de réception d’un signalement urgent : consigne d’appel aux secours', () => {
  it.each(['fr', 'pt'] as const)('%s : titre et texte de la consigne renforcée, une seule fois, en tête du message', (langue) => {
    const { titre, texte } = TEXTES_SIGNALEMENT_QR[langue].consigneSecoursUrgente
    const html = accuse(signalement({ langue }))
    expect(occurrences(html, blocConsigneSecoursQr(langue))).toBe(1)
    expect(occurrences(html, titre)).toBe(1)
    expect(occurrences(html, texte)).toBe(1)
    expect(html).toContain('112')
    // En tête du corps : avant « Bonjour, » / « Olá, ».
    const bonjour = langue === 'fr' ? 'Bonjour,' : 'Olá,'
    expect(html.indexOf(texte)).toBeLessThan(html.indexOf(bonjour))
    expect(html.indexOf(texte)).toBeGreaterThan(html.indexOf('AJ SIGNALEMENT'))
  })

  it('dans la langue du signalement : aucun texte de l’autre langue', () => {
    const fr = TEXTES_SIGNALEMENT_QR.fr.consigneSecoursUrgente
    const pt = TEXTES_SIGNALEMENT_QR.pt.consigneSecoursUrgente
    expect(accuse(signalement({ langue: 'fr' }))).not.toContain(pt.texte)
    expect(accuse(signalement({ langue: 'pt' }))).not.toContain(fr.texte)
    expect(accuse(signalement({ langue: 'pt' }))).not.toContain('114')
  })

  it.each(['normale', 'planifiee'] as const)('priorité « %s » : aucune consigne, aucun 112', (priorite) => {
    for (const langue of ['fr', 'pt'] as const) {
      const html = accuse(signalement({ priorite, langue }))
      expect(html).not.toContain(TEXTES_SIGNALEMENT_QR[langue].consigneSecoursUrgente.texte)
      expect(html).not.toContain(TEXTES_SIGNALEMENT_QR[langue].consigneSecoursUrgente.titre)
      expect(html).not.toContain('112')
    }
  })

  it('ni lien, ni bouton, ni numéro cliquable ajoutés', () => {
    const html = accuse(signalement())
    expect(html).not.toContain('href=')
    expect(html).not.toContain('tel:')
    expect(html).not.toMatch(/<button|<img|display:inline-block/i)
  })

  it('échappement conservé : la description et le type saisis restent échappés dans l’accusé urgent', () => {
    const piege = '<b onmouseover="x">'
    const html = accuse(signalement({ typeIntervention: piege }))
    expect(html).toContain('Fuite sous l’évier<br/>&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;b onmouseover=&quot;x&quot;&gt;')
    expect(html).not.toContain('<b onmouseover')
  })

  it('bloc de la consigne : textes échappés, sans attribut ni balise venant des textes', () => {
    for (const langue of ['fr', 'pt'] as const) {
      const bloc = blocConsigneSecoursQr(langue)
      expect(bloc.startsWith('<p style="')).toBe(true)
      expect(bloc).toContain(`<strong>${TEXTES_SIGNALEMENT_QR[langue].consigneSecoursUrgente.titre}</strong>`)
      expect(bloc.match(/<[a-z]+/g)).toEqual(['<p', '<strong', '<br'])
    }
  })
})
