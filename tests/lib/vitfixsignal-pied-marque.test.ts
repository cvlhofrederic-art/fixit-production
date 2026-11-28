// tests/lib/vitfixsignal-pied-marque.test.ts
//
// Décision du référent métier du 28/11/2026 (vs-01, choix B) : le pied de Vitfix Signal ne répète pas la marque.
// « Vitfix Signal — un service VITFIX » devient « Vitfix Signal », sur les pages publiques (français et portugais),
// dans les e-mails et sur l'affiche. L'alerte au gestionnaire dit « Signalement déposé par QR code sur Vitfix Signal ».
// Le service d'e-mail est simulé ; données fictives.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), sendBatchEmails: vi.fn(), sendBatchEmailsDetaille: vi.fn() }))

const email = await import('@/lib/vitfixsignal/email')
const { TEXTES_SIGNALEMENT_QR } = await import('@/lib/vitfixsignal/textes')

const REPETITION = /un service VITFIX|um serviço VITFIX|Signal\s*[—-]\s*VITFIX/i

describe('pied de Vitfix Signal : la marque n’est pas répétée (vs-01)', () => {
  it('page publique : « Vitfix Signal » seul, en français et en portugais', () => {
    expect(TEXTES_SIGNALEMENT_QR.fr.piedDePage).toBe('Vitfix Signal')
    expect(TEXTES_SIGNALEMENT_QR.pt.piedDePage).toBe('Vitfix Signal')
  })

  it.each(['fr', 'pt'] as const)('e-mail de confirmation (%s) et copie au cabinet : pied sans répétition', (langue) => {
    const pied = email.TEXTES_CONFIRMATION_QR[langue].piedDePage
    expect(pied.startsWith('Vitfix Signal. ')).toBe(true)
    expect(pied).not.toMatch(REPETITION)
    const copie = email.TEXTES_COPIE_DIFFUSION_QR[langue].piedDePage
    expect(copie.startsWith('Vitfix Signal. ')).toBe(true)
    expect(copie).not.toMatch(REPETITION)
  })

  it('e-mails de confirmation d’adresse, d’accès et d’alerte : pied « Vitfix Signal. Cet e-mail… »', () => {
    const adresse = email.templateConfirmationAdresseQr({ nomCourt: 'Exemple', cabinet: 'Cabinet Exemple', lien: 'https://exemple.test/a' }).html
    const acces = email.templateAccesGestionnaireQr({ nomCourt: 'Exemple', cabinet: 'Cabinet Exemple', lien: 'https://exemple.test/b' }).html
    const alerte = email.templateAlerteAdministrateurQr({ objet: 'Objet', texte: 'Texte', lien: 'https://exemple.test/c' }).html
    for (const html of [adresse, acces, alerte]) {
      expect(html).toContain('Vitfix Signal. Cet e-mail a été envoyé automatiquement.')
      expect(html).not.toMatch(REPETITION)
    }
  })

  it('alerte au gestionnaire : « Signalement déposé par QR code sur Vitfix Signal. »', () => {
    const { html } = email.templateSignalementQr({
      copropriete: { nom: 'Résidence Exemple', adresse: '' },
      signalement: {
        id: '5f2c9a1e-1111-4222-8333-444444444444', coproprieteId: 'c1', coproprieteNom: 'Résidence Exemple',
        prenom: 'Prénom', nom: 'Déclarant', telephone: '', email: '', batiment: '', etage: '', numLot: '', estPartieCommune: false,
        zoneSignalee: '', typeIntervention: 'Plomberie', description: 'Fuite', priorite: 'normale', statut: 'en_attente', langue: 'fr',
        emailEnvoyeLe: null, emailErreur: null, confirmationEnvoyeeLe: null, confirmationErreur: null,
        qualiteDeclarant: 'proprietaire', adresseProposee: '', signalementLieId: null,
        creeLe: '2026-11-04T13:05:00.000Z', misAJourLe: '2026-11-04T13:05:00.000Z',
      },
    } as Parameters<typeof email.templateSignalementQr>[0])
    expect(html).toContain('Signalement déposé par QR code sur Vitfix Signal. Cet e-mail a été envoyé automatiquement.')
    expect(html).not.toMatch(REPETITION)
  })
})
