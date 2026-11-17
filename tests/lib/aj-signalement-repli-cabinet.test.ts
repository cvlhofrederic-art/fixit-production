// tests/lib/aj-signalement-repli-cabinet.test.ts
//
// D9 (décision de Hugo du 17/11/2026, au nom de VitFix, point 7) : repli vers les boîtes de VitFix COUPÉ. Quand une
// copropriété n'a aucun destinataire (ni adresse saisie, ni gestionnaire) :
//   - copropriété d'un cabinet client : le signalement part à l'adresse de contact du cabinet (diffusion_contact_email),
//     seule adresse du cabinet que le code connaît, pour qu'il ne reste jamais sans lecteur ; type « cabinet », sans
//     bouton, avec une phrase qui dit pourquoi ;
//   - copropriété rattachée à aucun cabinet (relecture du 17/11/2026) : le code ne distingue pas une copropriété d'essai
//     de VitFix d'une copropriété du cabinet client pas encore rattachée (la migration du 11/11/2026 laisse cabinet_id
//     vide pour « les copropriétés existantes »). Le signalement complet ne part donc plus à ADMIN_EMAIL : personne ne le
//     reçoit par e-mail, il reste lisible dans le tableau ;
//   - VitFix (ADMIN_EMAIL) ne reçoit qu'une alerte SANS AUCUNE DONNÉE du signalement : son numéro (celui du tableau) et
//     son identifiant technique, et une phrase qui dit qui l'a reçu. Elle demande d'obtenir l'instruction ÉCRITE du
//     cabinet avant d'enregistrer un destinataire (VitFix est sous-traitant : RGPD art. 28.3 a et art. 29).
// Adresses fictives en exemple.test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SANS_CABINET_QR, aucunDestinataireDirectQr, destinatairesSignalementQr, situationAttenteQr } from '@/lib/aj-signalement/destinataires'
import { alerteSignalementEnAttenteQr, templateAlerteAdministrateurQr, templateSignalementQr } from '@/lib/aj-signalement/email'
import type { LigneEmailGestionnaireQr, SignalementQr, SituationAttenteQr } from '@/lib/aj-signalement/types'

const CONTACT = 'contact@cabinet-exemple.test'
const g = (gestionnaireId: string, email: string, champs: Partial<LigneEmailGestionnaireQr> = {}): LigneEmailGestionnaireQr => ({
  gestionnaireId, email, accesOuvert: false, exclu: false, ...champs,
})

// ADMIN_EMAIL est posé : le calcul ne doit JAMAIS le lire.
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', 'admin2@exemple.test')
})
afterEach(() => { vi.unstubAllEnvs() })

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

describe('destinatairesSignalementQr : copropriété sans destinataire (D9)', () => {
  it('cabinet client : l’adresse de contact du cabinet reçoit (type « cabinet ») ; jamais ADMIN_EMAIL ; en attente', () => {
    const r = destinatairesSignalementQr({ emails_destinataires: [] }, [], { etat: 'cabinet', contact: ` ${CONTACT.toUpperCase()} ` })
    expect(r).toEqual({ destinataires: [{ email: CONTACT, type: 'cabinet', accesOuvert: false }], auDelaDuPlafond: 0, enAttente: true })
    expect(JSON.stringify(r)).not.toContain('admin')
  })

  it('cabinet sans adresse de contact (ou adresse illisible) : aucun destinataire, en attente, jamais ADMIN_EMAIL', () => {
    for (const contact of [null, '', 'pas-une-adresse']) {
      const r = destinatairesSignalementQr({}, [], { etat: 'cabinet', contact })
      expect(r, String(contact)).toEqual({ destinataires: [], auDelaDuPlafond: 0, enAttente: true })
    }
  })

  it('adresse de contact qui est la boîte d’une fiche partie ou contestée restée dans les saisies : écartée', () => {
    const r = destinatairesSignalementQr(
      { emails_destinataires: [CONTACT] }, [g('g0', CONTACT, { exclu: true })], { etat: 'cabinet', contact: CONTACT },
    )
    expect(r).toEqual({ destinataires: [], auDelaDuPlafond: 0, enAttente: true })
  })

  it('un destinataire existe : rien ne change (ni contact du cabinet, ni attente)', () => {
    const r = destinatairesSignalementQr({}, [g('g1', 'gestionnaire@exemple.test')], { etat: 'cabinet', contact: CONTACT })
    expect(r).toEqual({ destinataires: [{ email: 'gestionnaire@exemple.test', type: 'gestionnaire', accesOuvert: false }], auDelaDuPlafond: 0 })
  })

  it('copropriété rattachée à aucun cabinet, ou cabinet illisible : aucun destinataire, en attente, jamais ADMIN_EMAIL', () => {
    for (const repli of [{ etat: 'sans_cabinet' } as const, { etat: 'illisible' } as const]) {
      const r = destinatairesSignalementQr({}, [], repli)
      expect(r, repli.etat).toEqual({ destinataires: [], auDelaDuPlafond: 0, enAttente: true })
    }
    // Sans repli lu (valeur par défaut) : même résultat.
    expect(destinatairesSignalementQr({ emails_destinataires: [] }, [])).toEqual({ destinataires: [], auDelaDuPlafond: 0, enAttente: true })
    expect(SANS_CABINET_QR).toEqual({ etat: 'sans_cabinet' })
  })
})

describe('situationAttenteQr', () => {
  it('dit qui a reçu le signalement en attente', () => {
    expect(situationAttenteQr({ etat: 'cabinet', contact: CONTACT }, 1, true)).toBe('contact_prevenu')
    expect(situationAttenteQr({ etat: 'cabinet', contact: CONTACT }, 1, false)).toBe('contact_non_prevenu')
    expect(situationAttenteQr({ etat: 'cabinet', contact: null }, 0, false)).toBe('cabinet_sans_contact')
    // Adresse de contact écartée (boîte d'une fiche exclue) : comme un cabinet sans contact.
    expect(situationAttenteQr({ etat: 'cabinet', contact: CONTACT }, 0, false)).toBe('cabinet_sans_contact')
    expect(situationAttenteQr({ etat: 'sans_cabinet' }, 0, false)).toBe('sans_cabinet')
    expect(situationAttenteQr({ etat: 'illisible' }, 0, false)).toBe('illisible')
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
  const SITUATIONS: readonly SituationAttenteQr[] = ['contact_prevenu', 'contact_non_prevenu', 'cabinet_sans_contact', 'sans_cabinet', 'illisible']
  const champsInterdits = [
    SIGNALEMENT.prenom, SIGNALEMENT.nom, SIGNALEMENT.telephone, SIGNALEMENT.email, SIGNALEMENT.description, SIGNALEMENT.typeIntervention,
    'Résidence Exemple', '1 rue Exemple', 'lot 7', 'Urgent', 'urgente',
  ]
  const debut = `Un signalement attend un destinataire : n° B0000000 (identifiant technique : ${SIGNALEMENT.id}).`
  const fin = 'Demandez au cabinet, par écrit, qui doit recevoir les signalements de cette copropriété, puis enregistrez ce destinataire. '
    + 'Pendant une heure, cette alerte ne sera pas répétée pour cette copropriété : les signalements suivants sont dans le tableau.'

  it('numéro du tableau et identifiant technique ; une phrase par situation ; l’instruction écrite du cabinet d’abord', () => {
    const attendu: Record<SituationAttenteQr, string> = {
      contact_prevenu: 'Il a été envoyé à l’adresse de contact du cabinet.',
      contact_non_prevenu: 'L’envoi à l’adresse de contact du cabinet a échoué : personne au cabinet ne l’a reçu. Prévenez le cabinet sans attendre.',
      cabinet_sans_contact: 'Le cabinet n’a pas d’adresse de contact : personne au cabinet ne l’a reçu. Prévenez le cabinet sans attendre.',
      sans_cabinet: 'Cette copropriété n’est rattachée à aucun cabinet : personne ne l’a reçu par e-mail. Prévenez sans attendre le cabinet qui la gère.',
      illisible: 'Le cabinet de cette copropriété n’a pas pu être lu : personne ne l’a reçu par e-mail. Prévenez le cabinet sans attendre.',
    }
    for (const situation of SITUATIONS) {
      const alerte = alerteSignalementEnAttenteQr(SIGNALEMENT.id, situation)
      expect(alerte.objet, situation).toBe('AJ Signalement — un signalement attend un destinataire')
      expect(alerte.texte, situation).toBe(`${debut} ${attendu[situation]} ${fin}`)
      // VitFix ne choisit pas lui-même le destinataire (sous-traitant).
      expect(alerte.texte, situation).not.toContain('Désignez')
    }
  })

  it('le message rendu ne contient aucun champ du signalement', () => {
    for (const situation of SITUATIONS) {
      const { subject, html } = templateAlerteAdministrateurQr({ ...alerteSignalementEnAttenteQr(SIGNALEMENT.id, situation), lien: 'https://vitfix.io/fr/aj-signalement/#signalements' })
      for (const interdit of champsInterdits) {
        expect(subject, interdit).not.toContain(interdit)
        expect(html, interdit).not.toContain(interdit)
      }
      expect(html).toContain(SIGNALEMENT.id)
      expect(html).toContain('n° B0000000')
    }
  })
})
