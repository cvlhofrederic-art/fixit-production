// tests/lib/aj-signalement-repli-cabinet.test.ts
//
// D9 (décision de Hugo du 17/11/2026, au nom de VitFix, point 7) : repli vers les boîtes de VitFix COUPÉ pour les
// copropriétés d'un cabinet client. Quand une telle copropriété n'a aucun destinataire (ni adresse saisie, ni
// gestionnaire) :
//   - le signalement part à l'adresse de contact du cabinet (diffusion_contact_email), seule adresse du cabinet que le
//     code connaît, pour qu'il ne reste jamais sans lecteur ; type « cabinet », sans bouton, avec une phrase qui dit
//     pourquoi ;
//   - VitFix (ADMIN_EMAIL) ne reçoit qu'une alerte SANS AUCUNE DONNÉE du signalement : « un signalement attend un
//     destinataire » et son identifiant technique ;
//   - sans adresse de contact : personne au cabinet ne le reçoit, l'alerte le dit.
// Copropriété sans cabinet (celles de VitFix) : repli ADMIN_EMAIL inchangé. Adresses fictives en exemple.test.

import { describe, expect, it } from 'vitest'
import { aucunDestinataireDirectQr, destinatairesSignalementQr } from '@/lib/aj-signalement/destinataires'
import { alerteSignalementEnAttenteQr, templateAlerteAdministrateurQr, templateSignalementQr } from '@/lib/aj-signalement/email'
import type { LigneEmailGestionnaireQr, SignalementQr } from '@/lib/aj-signalement/types'

const ENV = { ADMIN_EMAIL: 'admin@exemple.test', ADMIN_EMAIL_2: 'admin2@exemple.test' }
const CONTACT = 'contact@cabinet-exemple.test'
const g = (gestionnaireId: string, email: string, champs: Partial<LigneEmailGestionnaireQr> = {}): LigneEmailGestionnaireQr => ({
  gestionnaireId, email, accesOuvert: false, exclu: false, ...champs,
})

describe('aucunDestinataireDirectQr', () => {
  it('vrai sans saisie ni gestionnaire, ou quand toutes les saisies sont celles de fiches parties ou contestées', () => {
    expect(aucunDestinataireDirectQr({ emails_destinataires: [] }, [])).toBe(true)
    expect(aucunDestinataireDirectQr({}, [])).toBe(true)
    expect(aucunDestinataireDirectQr({ emails_destinataires: ['parti@exemple.test'] }, [g('g0', 'parti@exemple.test', { exclu: true })])).toBe(true)
  })

  it('faux dès qu’une adresse saisie ou un gestionnaire reçoit', () => {
    expect(aucunDestinataireDirectQr({ emails_destinataires: ['cs@exemple.test'] }, [])).toBe(false)
    expect(aucunDestinataireDirectQr({}, [g('g1', 'gestionnaire@exemple.test')])).toBe(false)
  })
})

describe('destinatairesSignalementQr : copropriété d’un cabinet client sans destinataire (D9)', () => {
  it('l’adresse de contact du cabinet reçoit (type « cabinet ») ; jamais ADMIN_EMAIL ; signalement en attente', () => {
    const r = destinatairesSignalementQr({ emails_destinataires: [] }, [], ENV, { cabinet: true, contact: ` ${CONTACT.toUpperCase()} ` })
    expect(r).toEqual({ destinataires: [{ email: CONTACT, type: 'cabinet', accesOuvert: false }], auDelaDuPlafond: 0, enAttente: true })
    expect(JSON.stringify(r)).not.toContain('admin')
  })

  it('cabinet sans adresse de contact (ou adresse illisible) : aucun destinataire, signalement en attente, jamais ADMIN_EMAIL', () => {
    for (const contact of [null, '', 'pas-une-adresse']) {
      const r = destinatairesSignalementQr({}, [], ENV, { cabinet: true, contact })
      expect(r, String(contact)).toEqual({ destinataires: [], auDelaDuPlafond: 0, enAttente: true })
    }
  })

  it('adresse de contact qui est la boîte d’une fiche partie ou contestée restée dans les saisies : écartée', () => {
    const r = destinatairesSignalementQr(
      { emails_destinataires: [CONTACT] }, [g('g0', CONTACT, { exclu: true })], ENV, { cabinet: true, contact: CONTACT },
    )
    expect(r).toEqual({ destinataires: [], auDelaDuPlafond: 0, enAttente: true })
  })

  it('un destinataire existe : rien ne change (ni contact du cabinet, ni attente)', () => {
    const r = destinatairesSignalementQr({}, [g('g1', 'gestionnaire@exemple.test')], ENV, { cabinet: true, contact: CONTACT })
    expect(r).toEqual({ destinataires: [{ email: 'gestionnaire@exemple.test', type: 'gestionnaire', accesOuvert: false }], auDelaDuPlafond: 0 })
  })

  it('copropriété sans cabinet : repli ADMIN_EMAIL d’avant, sans attente', () => {
    const r = destinatairesSignalementQr({}, [], ENV, { cabinet: false })
    expect(r).toEqual({
      destinataires: [
        { email: 'admin@exemple.test', type: 'administrateur', accesOuvert: false },
        { email: 'admin2@exemple.test', type: 'administrateur', accesOuvert: false },
      ],
      auDelaDuPlafond: 0,
    })
    expect(destinatairesSignalementQr({}, [], ENV)).toEqual(r)
  })
})

const SIGNALEMENT: SignalementQr = {
  id: 'b0000000-0000-4000-8000-000000000001', coproprieteId: 'c0000000-0000-4000-8000-000000000001', coproprieteNom: 'Résidence Exemple',
  prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00', email: 'declarant@exemple.test', batiment: 'A', etage: '2', numLot: '7',
  estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie', description: 'Fuite d’eau au plafond', priorite: 'urgente',
  statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: null, confirmationEnvoyeeLe: null, confirmationErreur: null,
  qualiteDeclarant: 'locataire', adresseProposee: '', signalementLieId: null, creeLe: '2026-11-17T09:00:00+00:00', misAJourLe: '2026-11-17T09:00:00+00:00',
}

describe('e-mail à l’adresse de contact du cabinet (type « cabinet »)', () => {
  const { html } = templateSignalementQr({
    copropriete: { nom: 'Résidence Exemple', adresse: '1 rue Exemple' }, signalement: SIGNALEMENT, destinataire: 'cabinet',
  })

  it('le signalement complet, une phrase qui dit pourquoi le cabinet le reçoit, aucun bouton', () => {
    expect(html).toContain('Déclarant')
    expect(html).toContain('Fuite d’eau au plafond')
    expect(html).toContain('Aucun gestionnaire ni aucune adresse ne reçoit les signalements de cette copropriété : ce signalement est envoyé à l’adresse de contact du cabinet.')
    expect(html).not.toContain('Ouvrir le tableau des signalements')
    expect(html).not.toContain('Ouvrir le suivi')
    expect(html).not.toContain('/aj-signalement/#')
  })

  it('les autres types ne portent pas cette phrase', () => {
    for (const destinataire of ['administrateur', 'gestionnaire', 'saisi'] as const) {
      const autre = templateSignalementQr({ copropriete: { nom: 'Résidence Exemple', adresse: '' }, signalement: SIGNALEMENT, destinataire }).html
      expect(autre, destinataire).not.toContain('adresse de contact du cabinet')
    }
  })
})

describe('alerte à VitFix : sans aucune donnée du signalement', () => {
  const champsInterdits = [
    SIGNALEMENT.prenom, SIGNALEMENT.nom, SIGNALEMENT.telephone, SIGNALEMENT.email, SIGNALEMENT.description, SIGNALEMENT.typeIntervention,
    'Résidence Exemple', '1 rue Exemple', 'lot 7', 'Urgent', 'urgente',
  ]

  it('cabinet prévenu : phrase fixe et identifiant technique seulement', () => {
    const alerte = alerteSignalementEnAttenteQr(SIGNALEMENT.id, true)
    expect(alerte.objet).toBe('AJ Signalement — un signalement attend un destinataire')
    expect(alerte.texte).toBe(
      `Un signalement attend un destinataire. Identifiant technique : ${SIGNALEMENT.id}. `
      + 'Il a été envoyé à l’adresse de contact du cabinet. Désignez un destinataire pour cette copropriété.',
    )
  })

  it('cabinet non prévenu : l’alerte le dit', () => {
    expect(alerteSignalementEnAttenteQr(SIGNALEMENT.id, false).texte).toBe(
      `Un signalement attend un destinataire. Identifiant technique : ${SIGNALEMENT.id}. `
      + 'Personne au cabinet ne l’a reçu : prévenez le cabinet sans attendre. Désignez un destinataire pour cette copropriété.',
    )
  })

  it('le message rendu ne contient aucun champ du signalement', () => {
    for (const prevenu of [true, false]) {
      const { subject, html } = templateAlerteAdministrateurQr({ ...alerteSignalementEnAttenteQr(SIGNALEMENT.id, prevenu), lien: 'https://vitfix.io/fr/aj-signalement/#signalements' })
      for (const interdit of champsInterdits) {
        expect(subject, interdit).not.toContain(interdit)
        expect(html, interdit).not.toContain(interdit)
      }
      expect(html).toContain(SIGNALEMENT.id)
    }
  })
})
