import { describe, expect, it } from 'vitest'
import type { CourrierSuivi } from '@/lib/administrateur-judiciaire/domain/courriers'
import {
  CODES_ALERTE_ENVOI_ELECTRONIQUE,
  REFERENTIEL_NOTIFICATION_ELECTRONIQUE,
  REFERENTIEL_SIGNATURE_ELECTRONIQUE,
  STATUTS_FINAUX_NOTIFICATION_ELECTRONIQUE,
  STATUTS_FINAUX_SIGNATURE_ELECTRONIQUE,
  STATUTS_NOTIFICATION_ELECTRONIQUE,
  STATUTS_SIGNATURE_ELECTRONIQUE,
  STATUTS_SIGNATURE_OBTENUE,
  changerStatutEnvoi,
  creerEnvoiNotificationElectronique,
  creerEnvoiSignatureElectronique,
  dateDuStatut,
  estHorodatageIsoValide,
  estStatutFinal,
  lireNotificationElectronique,
  lireSignatureElectronique,
  transitionsPermises,
  valeurProbanteSignature,
  type EnvoiNotificationElectronique,
  type EnvoiSignatureElectronique,
} from '@/lib/administrateur-judiciaire/domain/envois-electroniques'
import { effetRetourVoieElectronique } from '@/lib/administrateur-judiciaire/domain/voie-notification'
import { STATUT_COURRIER } from '@/lib/data/referentiels-gesteam-judiciaire'
import { enTeteDuModule } from './en-tete-module'

/**
 * Point 65 du bilan des écarts Gestéam → VitFix : envois électroniques et signature, cycles de statuts.
 * Gestéam 5.4.22, tranche 40 (menu Outils) : console Notifications (7 statuts) et console eSignature (8 statuts), listes
 * relevées dans les critères de recherche. Les transitions ne sont pas observées : elles sont déduites (🔵).
 * Valeur de notification : seule la transmission de l'avis électronique saisie sur le courrier compte (J50) ; aucun
 * statut de la console n'en tient lieu (J57, J66) ; le sens exact de chaque statut reste ouvert (🔴).
 */

const H = (heure: string) => `2026-11-17T${heure}:00Z`

const courrierLre = { id: 'C1', formeEnvoi: 'Email', modeNotification: 'lre' } as const
const courrierPrestataire = { id: 'C2', formeEnvoi: 'Email direct', modeNotification: 'prestataire_qualifie' } as const

const notification = (surcharge: Partial<Parameters<typeof creerEnvoiNotificationElectronique>[0]> = {}) =>
  creerEnvoiNotificationElectronique({ id: 'E1', courrier: courrierLre, horodatage: H('08:00'), ...surcharge })

const signature = (surcharge: Partial<Parameters<typeof creerEnvoiSignatureElectronique>[0]> = {}) =>
  creerEnvoiSignatureElectronique({ id: 'S1', courrierId: 'C9', horodatage: H('08:00'), ...surcharge })

/** Enchaîne des statuts, une minute d'écart entre deux changements. */
function enchainerNotification(envoi: EnvoiNotificationElectronique, statuts: string[], debut = 9): EnvoiNotificationElectronique {
  return statuts.reduce((e, statut, i) => changerStatutEnvoi(e, { statut, horodatage: H(`${String(debut).padStart(2, '0')}:${String(i).padStart(2, '0')}`) }), envoi)
}

function enchainerSignature(envoi: EnvoiSignatureElectronique, statuts: string[], debut = 9): EnvoiSignatureElectronique {
  return statuts.reduce((e, statut, i) => changerStatutEnvoi(e, { statut, horodatage: H(`${String(debut).padStart(2, '0')}:${String(i).padStart(2, '0')}`) }), envoi)
}

const suivi = (surcharge: Partial<CourrierSuivi & { id: string }> = {}): CourrierSuivi & { id: string } => ({
  id: 'C1',
  formeEnvoi: 'Email',
  modeNotification: 'lre',
  dateDepot: null,
  datePremierePresentation: null,
  dateAccuseReception: null,
  dateAvisElectronique: null,
  ...surcharge,
})

describe('référentiels Gestéam (tranche 40, 🟢 listes relevées en entier)', () => {
  it('console Notifications : sept statuts, dans l’ordre de Gestéam', () => {
    expect(STATUTS_NOTIFICATION_ELECTRONIQUE).toEqual([
      'Préparation',
      "Attente d'envoi",
      'En cours',
      'Envoyé OK',
      'Échec',
      'Reçu',
      'Reçu en erreur',
    ])
  })

  it('console eSignature : huit statuts, dans l’ordre de Gestéam', () => {
    expect(STATUTS_SIGNATURE_ELECTRONIQUE).toEqual([
      'Soumis',
      'En cours',
      'Signé',
      'Stocké, signé',
      'Inconnu',
      'Expiré',
      'Annulé',
      'À relever',
    ])
  })

  it('chaque statut a son libellé Gestéam, sa lecture VitFix et ses suivants pris dans le même référentiel', () => {
    for (const [statuts, referentiel] of [
      [STATUTS_NOTIFICATION_ELECTRONIQUE, REFERENTIEL_NOTIFICATION_ELECTRONIQUE],
      [STATUTS_SIGNATURE_ELECTRONIQUE, REFERENTIEL_SIGNATURE_ELECTRONIQUE],
    ] as const) {
      expect(Object.keys(referentiel).sort()).toEqual([...statuts].sort())
      for (const statut of statuts) {
        const definition = (referentiel as Record<string, { libelle: string; sens: string; suivants: readonly string[]; final: boolean }>)[statut]
        expect(definition.libelle).toBe(statut)
        expect(definition.sens.length).toBeGreaterThan(10)
        for (const suivant of definition.suivants) expect(statuts as readonly string[]).toContain(suivant)
        if (definition.final) expect(definition.suivants).toEqual([])
      }
    }
  })

  it('états finaux : Échec, Reçu, Reçu en erreur ; Stocké, signé, Expiré, Annulé', () => {
    expect(STATUTS_FINAUX_NOTIFICATION_ELECTRONIQUE).toEqual(['Échec', 'Reçu', 'Reçu en erreur'])
    expect(STATUTS_FINAUX_SIGNATURE_ELECTRONIQUE).toEqual(['Stocké, signé', 'Expiré', 'Annulé'])
    expect(estStatutFinal('notification', 'Reçu')).toBe(true)
    expect(estStatutFinal('notification', 'Envoyé OK')).toBe(false)
    expect(estStatutFinal('signature', 'Signé')).toBe(false)
    expect(estStatutFinal('signature', 'Annulé')).toBe(true)
    expect(() => estStatutFinal('signature', 'Reçu')).toThrow(/Statut « Reçu » inconnu pour une signature électronique/)
  })

  it('le statut de l’envoi est un champ à part du statut du courrier (06_PIEGES § 4) : STATUT_COURRIER ne change pas', () => {
    expect(STATUT_COURRIER).toEqual(['Préparation', 'A Suivre', 'Terminé', 'Non terminé', 'Terminé/Archivé', 'Archivé'])
    const envoi = notification()
    expect(envoi).not.toHaveProperty('statutCourrier')
    expect(envoi.statut).toBe('Préparation')
  })
})

describe('horodatages ISO 8601 avec fuseau', () => {
  it('admet Z ou un décalage, avec ou sans secondes et fractions', () => {
    for (const valeur of ['2026-11-17T10:00Z', '2026-11-17T10:00:05Z', '2026-11-17T10:00:05.123+01:00', '2026-11-17T23:59:59.123456-05:30'])
      expect(estHorodatageIsoValide(valeur), valeur).toBe(true)
  })

  it('refuse une date seule, une heure sans fuseau, une date ou une heure impossibles', () => {
    for (const valeur of ['2026-11-17', '2026-11-17T10:00', '2026-11-17 10:00Z', '2026-02-30T10:00Z', '2026-11-17T24:00Z', '2026-11-17T10:60Z', '2026-11-17T10:00+25:00', 42, null])
      expect(estHorodatageIsoValide(valeur), String(valeur)).toBe(false)
    expect(() => notification({ horodatage: '2026-11-17T10:00' })).toThrow(/Horodatage invalide.*fuseau/)
  })
})

describe('création d’un envoi de notification électronique (lien avec le courrier)', () => {
  it('démarre en « Préparation », copie le mode du courrier, et ouvre l’historique horodaté', () => {
    const envoi = notification({ origine: 'prestataire', referencePrestataire: ' LRE-42 ' })
    expect(envoi).toEqual({
      type: 'notification',
      id: 'E1',
      courrierId: 'C1',
      modeNotification: 'lre',
      statut: 'Préparation',
      historique: [
        {
          statut: 'Préparation',
          statutAncien: null,
          horodatage: H('08:00'),
          origine: 'prestataire',
          horsSequence: false,
          motif: null,
          referencePrestataire: 'LRE-42',
        },
      ],
    })
    expect(creerEnvoiNotificationElectronique({ id: 'E2', courrier: courrierPrestataire, horodatage: H('08:00') }).modeNotification).toBe('prestataire_qualifie')
  })

  it('un courrier sans mode hors « AR » (courriel simple) part sans valeur de notification : mode null', () => {
    const envoi = notification({ courrier: { id: 'C3', formeEnvoi: 'Email' } })
    expect(envoi.modeNotification).toBeNull()
  })

  it('refuse un courrier postal (« AR », LRAR) et un mode incohérent avec la forme d’envoi (J50)', () => {
    expect(() => notification({ courrier: { id: 'C4', formeEnvoi: 'AR' } })).toThrow(/lettre recommandée avec avis de réception.*pas par voie électronique/)
    expect(() => notification({ courrier: { id: 'C4', formeEnvoi: 'AR', modeNotification: 'lrar' } })).toThrow(/pas par voie électronique/)
    expect(() => notification({ courrier: { id: 'C5', formeEnvoi: 'AR', modeNotification: 'lre' } })).toThrow(/Mode de notification « lre » incohérent avec la forme d'envoi « AR »/)
    expect(() => notification({ courrier: { id: 'C6', formeEnvoi: 'Email', modeNotification: 'lrar' } })).toThrow(/incohérent/)
  })

  it('refuse un identifiant d’envoi ou de courrier vide', () => {
    expect(() => notification({ id: ' ' })).toThrow(/identifiant de l'envoi attendu/)
    expect(() => notification({ courrier: { ...courrierLre, id: '' } })).toThrow(/identifiant du courrier attendu/)
  })

  it('refuse une notification électronique au destinataire dont la demande de voie postale est en vigueur (D. 1967 art. 64-1, 64-4)', () => {
    const voieDestinataire = { voie: 'postale', depuis: '2026-10-10' } as const
    expect(() => notification({ voieDestinataire })).toThrow(/demande de voie postale en vigueur depuis le 10\/10\/2026.*64-1/)
    expect(notification({ voieDestinataire: { voie: 'electronique', depuis: null } }).statut).toBe('Préparation')
    expect(notification({ voieDestinataire: { voie: null, depuis: null } }).statut).toBe('Préparation')
    // Un courriel simple n'est pas une notification : la demande de voie postale ne l'empêche pas.
    expect(notification({ courrier: { id: 'C3', formeEnvoi: 'Email' }, voieDestinataire }).modeNotification).toBeNull()
  })

  it('J74 : retour à la voie électronique reçu, pas encore en vigueur : refus, avec la date d’effet et sa justification', () => {
    const retour = effetRetourVoieElectronique({ nature: 'renonciation', recueLe: '2026-11-12' })
    const voieDestinataire = { voie: 'postale', depuis: '2026-10-10', retour } as const
    expect(() => notification({ voieDestinataire })).toThrow(
      /demande de voie postale en vigueur depuis le 10\/10\/2026.*64-1, 64-4\)\. Retour à la voie électronique pas encore en vigueur : Renonciation à la voie postale reçue le 12\/11\/2026 : effet le 21\/11\/2026.*J74\)\.$/,
    )
    // voie électronique rétablie : l'envoi est admis
    expect(notification({ voieDestinataire: { voie: 'electronique', depuis: null, retour } }).statut).toBe('Préparation')
  })

  it('refuse une notification électronique tant qu’une anomalie bloquante d’avant envoi demeure (voie-notification.ts)', () => {
    const anomaliesAvantEnvoi = [
      { code: 'lre_sans_prenom', gravite: 'bloquant', message: 'Durand : prénom manquant.' },
      { code: 'adresse_electronique_absente', gravite: 'bloquant', message: 'Durand : aucune adresse électronique.' },
    ] as const
    expect(() => notification({ anomaliesAvantEnvoi: [...anomaliesAvantEnvoi] })).toThrow(/Durand : prénom manquant\. Durand : aucune adresse électronique\./)
    expect(notification({ anomaliesAvantEnvoi: [] }).statut).toBe('Préparation')
  })

  it('une seule tentative en cours par courrier ; après « Reçu », « Échec » (J58) ou « Reçu en erreur » (J66), plus de nouvelle tentative', () => {
    const enCours = enchainerNotification(notification(), ["Attente d'envoi", 'En cours'])
    expect(() => notification({ id: 'E2', envoisExistants: [enCours] })).toThrow(/E1 du courrier C1 est encore au statut « En cours »/)
    const recu = enchainerNotification(enCours, ['Envoyé OK', 'Reçu'], 10)
    expect(() => notification({ id: 'E2', envoisExistants: [recu] })).toThrow(/déjà « Reçu »/)
    const echec = enchainerNotification(notification(), ["Attente d'envoi", 'Échec'])
    // J58 (décision du 17/11/2026) : un envoi en échec n'a rien notifié ; nouveau courrier.
    expect(() => notification({ id: 'E2', horodatage: H('11:00'), envoisExistants: [echec] })).toThrow(/est en « Échec » .*créer un nouveau courrier .*J58/)
    // J66 (décision du 17/11/2026) : après « Reçu en erreur », le même courrier ne repart pas non plus
    // (avis transmis : notification acquise, J57 ; sinon nouveau courrier, J58).
    const erreur = enchainerNotification(enCours, ['Envoyé OK', 'Reçu en erreur'], 10)
    expect(() => notification({ id: 'E2', horodatage: H('11:00'), envoisExistants: [erreur] })).toThrow(
      /est « Reçu en erreur » : .*notification est acquise.*J57.*créer un nouveau courrier.*J66/,
    )
    expect(notification({ id: 'E2', envoisExistants: [{ ...enCours, courrierId: 'AUTRE' }] }).statut).toBe('Préparation')
    expect(() => notification({ envoisExistants: [echec] })).toThrow(/identifiant E1 déjà pris/)
    // Une demande de signature du même courrier ne bloque pas une notification.
    expect(notification({ id: 'E2', envoisExistants: [signature({ courrierId: 'C1' })] }).statut).toBe('Préparation')
  })

  it('une nouvelle tentative ne remonte pas avant la fin de la précédente (sinon deux tentatives en cours à la fois)', () => {
    // Depuis J58 et J66, aucun état final de la console Notifications ne laisse repartir le même courrier : la règle
    // de l'horodatage ne joue plus que pour les signatures (« Expiré », « Annulé »).
    const expire = changerStatutEnvoi(enchainerSignature(signature(), ['En cours']), { statut: 'Expiré', horodatage: H('12:00') })
    expect(() => signature({ id: 'S2', horodatage: H('11:59'), envoisExistants: [expire] })).toThrow(
      /Nouvel envoi refusé : horodatage 2026-11-17T11:59:00Z antérieur à la fin de l'envoi S1 du courrier \S+ \(2026-11-17T12:00:00Z\)/,
    )
    expect(signature({ id: 'S2', horodatage: '2026-11-17T13:00:00+01:00', envoisExistants: [expire] }).statut).toBe('Soumis')
  })
})

describe('création d’une demande de signature électronique', () => {
  it('démarre en « Soumis », rattachée au courrier, sans mode de notification', () => {
    const envoi = signature()
    expect(envoi).toEqual({
      type: 'signature',
      id: 'S1',
      courrierId: 'C9',
      statut: 'Soumis',
      historique: [
        { statut: 'Soumis', statutAncien: null, horodatage: H('08:00'), origine: 'saisie', horsSequence: false, motif: null, referencePrestataire: null },
      ],
    })
  })

  it('nouvelle demande après « Expiré » ou « Annulé » ; refusée si une demande est en cours ou déjà « Stocké, signé »', () => {
    const expire = enchainerSignature(signature(), ['En cours', 'Expiré'])
    expect(signature({ id: 'S2', horodatage: H('11:00'), envoisExistants: [expire] }).statut).toBe('Soumis')
    const enCours = enchainerSignature(signature(), ['En cours'])
    expect(() => signature({ id: 'S2', envoisExistants: [enCours] })).toThrow(/S1 du courrier C9 est encore au statut « En cours »/)
    const stocke = enchainerSignature(signature(), ['En cours', 'Signé', 'Stocké, signé'])
    expect(() => signature({ id: 'S2', envoisExistants: [stocke] })).toThrow(/déjà « Stocké, signé »/)
  })
})

describe('machine d’états de la console Notifications (🔵 transitions déduites)', () => {
  it('chemin nominal : chaque changement est historisé, horodaté, l’envoi d’origine n’est pas modifié', () => {
    const depart = notification()
    const recu = enchainerNotification(depart, ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu'])
    expect(recu.statut).toBe('Reçu')
    expect(recu.historique.map((e) => [e.statutAncien, e.statut, e.horodatage])).toEqual([
      [null, 'Préparation', H('08:00')],
      ['Préparation', "Attente d'envoi", H('09:00')],
      ["Attente d'envoi", 'En cours', H('09:01')],
      ['En cours', 'Envoyé OK', H('09:02')],
      ['Envoyé OK', 'Reçu', H('09:03')],
    ])
    expect(depart.statut).toBe('Préparation')
    expect(depart.historique).toHaveLength(1)
  })

  it('transitions permises, sans motif et avec motif (saut en avant)', () => {
    expect(transitionsPermises(notification())).toEqual({
      sansMotif: ["Attente d'envoi"],
      avecMotif: ['En cours', 'Envoyé OK', 'Reçu', 'Reçu en erreur'],
    })
    const enCours = enchainerNotification(notification(), ["Attente d'envoi", 'En cours'])
    expect(transitionsPermises(enCours)).toEqual({ sansMotif: ['Envoyé OK', 'Échec'], avecMotif: ['Reçu', 'Reçu en erreur'] })
    expect(transitionsPermises(enchainerNotification(enCours, ['Échec'], 10))).toEqual({ sansMotif: [], avecMotif: [] })
  })

  it('retour en « Préparation » permis tant que rien n’est parti ; tout autre retour en arrière est refusé', () => {
    const attente = enchainerNotification(notification(), ["Attente d'envoi"])
    expect(changerStatutEnvoi(attente, { statut: 'Préparation', horodatage: H('10:00') }).statut).toBe('Préparation')
    const enCours = enchainerNotification(attente, ['En cours'], 10)
    expect(() => changerStatutEnvoi(enCours, { statut: 'Préparation', horodatage: H('11:00') })).toThrow(
      /passage de « En cours » à « Préparation » interdit \(sans motif : « Envoyé OK », « Échec » ; avec motif : « Reçu », « Reçu en erreur »\)/,
    )
    expect(() => changerStatutEnvoi(enCours, { statut: "Attente d'envoi", horodatage: H('11:00'), motif: 'erreur' })).toThrow(/interdit/)
  })

  it('« Échec » seulement depuis « Attente d’envoi » ou « En cours » ; jamais après « Envoyé OK »', () => {
    expect(() => changerStatutEnvoi(notification(), { statut: 'Échec', horodatage: H('09:00') })).toThrow(/interdit/)
    expect(enchainerNotification(notification(), ["Attente d'envoi", 'Échec']).statut).toBe('Échec')
    const envoye = enchainerNotification(notification(), ["Attente d'envoi", 'En cours', 'Envoyé OK'])
    expect(() => changerStatutEnvoi(envoye, { statut: 'Échec', horodatage: H('10:00'), motif: 'rejet' })).toThrow(/interdit/)
  })

  it('un état final ne change plus ; le message renvoie, comme la création, à un nouveau courrier après « Reçu » ou « Échec » (J58)', () => {
    const recu = enchainerNotification(notification(), ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu'])
    expect(() => changerStatutEnvoi(recu, { statut: 'Reçu en erreur', horodatage: H('10:00') })).toThrow(
      /Envoi électronique E1 : statut « Reçu » final, plus aucun changement \(pour un nouvel envoi, créer un nouveau courrier\)/,
    )
    const echec = enchainerNotification(notification(), ["Attente d'envoi", 'Échec'])
    expect(() => changerStatutEnvoi(echec, { statut: 'En cours', horodatage: H('10:00') })).toThrow(
      /statut « Échec » final, plus aucun changement \(pour un nouvel envoi, créer un nouveau courrier\)/,
    )
    const erreur = enchainerNotification(notification(), ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu en erreur'])
    // J66 : après « Reçu en erreur », nouveau courrier aussi.
    expect(() => changerStatutEnvoi(erreur, { statut: 'Reçu', horodatage: H('10:00') })).toThrow(
      /statut « Reçu en erreur » final, plus aucun changement \(pour un nouvel envoi, créer un nouveau courrier\)/,
    )
  })

  it('rejeu exact du dernier changement (même statut, même instant, même origine, même référence) : envoi rendu inchangé', () => {
    const suite = (e: EnvoiNotificationElectronique, statut: string, heure: string) =>
      changerStatutEnvoi(e, { statut, horodatage: H(heure), origine: 'prestataire', referencePrestataire: `EVT-${statut}` })
    const envoye = suite(suite(suite(notification(), "Attente d'envoi", '09:00'), 'En cours', '09:01'), 'Envoyé OK', '09:02')
    const rejeu = changerStatutEnvoi(envoye, { statut: 'Envoyé OK', horodatage: '2026-11-17T10:02:00+01:00', origine: 'prestataire', referencePrestataire: ' EVT-Envoyé OK ' })
    expect(rejeu).toEqual(envoye)
    const recu = suite(envoye, 'Reçu', '09:03')
    expect(changerStatutEnvoi(recu, { statut: 'Reçu', horodatage: H('09:03'), origine: 'prestataire', referencePrestataire: 'EVT-Reçu' })).toEqual(recu)
    // Autre instant, autre référence ou autre origine : ce n'est pas un rejeu.
    expect(() => changerStatutEnvoi(envoye, { statut: 'Envoyé OK', horodatage: H('09:05'), origine: 'prestataire', referencePrestataire: 'EVT-Envoyé OK' })).toThrow(/déjà au statut « Envoyé OK »/)
    expect(() => changerStatutEnvoi(envoye, { statut: 'Envoyé OK', horodatage: H('09:02'), origine: 'prestataire', referencePrestataire: 'EVT-9' })).toThrow(/déjà au statut/)
    expect(() => changerStatutEnvoi(envoye, { statut: 'Envoyé OK', horodatage: H('09:02'), referencePrestataire: 'EVT-Envoyé OK' })).toThrow(/déjà au statut/)
    expect(() => changerStatutEnvoi(recu, { statut: 'Reçu', horodatage: H('09:04'), origine: 'prestataire', referencePrestataire: 'EVT-Reçu' })).toThrow(/final/)
  })

  it('refuse un envoi au statut inconnu, d’une autre console, de type inconnu ou à l’historique incohérent, en français', () => {
    const depart = notification()
    const saisie = { statut: "Attente d'envoi", horodatage: H('09:00') }
    expect(() => changerStatutEnvoi({ ...depart, statut: 'Bidon' as never }, saisie)).toThrow(/Envoi électronique E1 : statut « Bidon » inconnu pour une notification électronique/)
    expect(() => changerStatutEnvoi({ ...depart, statut: 'Soumis' as never }, saisie)).toThrow(/statut « Soumis » inconnu pour une notification électronique/)
    expect(() => transitionsPermises({ ...depart, statut: 'Bidon' as never })).toThrow(/statut « Bidon » inconnu/)
    expect(() => lireSignatureElectronique({ ...signature(), statut: 'Bidon' as never })).toThrow(/Envoi électronique S1 : statut « Bidon » inconnu pour une signature électronique/)
    expect(() => changerStatutEnvoi({ ...depart, type: 'sms' as never }, saisie)).toThrow(/Type d'envoi électronique « sms » inconnu \(notification ou signature attendu\)/)
    expect(() => estStatutFinal('sms' as never, 'Annulé')).toThrow(/Type d'envoi électronique « sms » inconnu/)
    expect(() => lireNotificationElectronique(signature() as never, suivi())).toThrow(/l'envoi S1 est de type « signature », pas une notification électronique/)
    expect(() => lireSignatureElectronique(depart as never)).toThrow(/l'envoi E1 est de type « notification », pas une signature électronique/)
    expect(() => lireNotificationElectronique({ ...depart, statut: 'Signé' as never }, suivi())).toThrow(/statut « Signé » inconnu pour une notification/)
    expect(() => changerStatutEnvoi({ ...depart, historique: [] }, saisie)).toThrow(/Envoi électronique E1 : historique incohérent/)
    const envoye = enchainerNotification(depart, ["Attente d'envoi", 'En cours', 'Envoyé OK'])
    // Statut ramené à « Préparation » sans ligne d'historique : un retour en arrière passerait inaperçu.
    expect(() => changerStatutEnvoi({ ...envoye, statut: 'Préparation' }, { statut: "Attente d'envoi", horodatage: H('10:00') })).toThrow(
      /historique incohérent : dernier statut « Envoyé OK », statut de l'envoi « Préparation »/,
    )
    const trou = { ...envoye, historique: envoye.historique.filter((e) => e.statut !== 'En cours') }
    expect(() => changerStatutEnvoi(trou, { statut: 'Reçu', horodatage: H('10:00') })).toThrow(/historique incohérent/)
    expect(() => notification({ id: undefined as never })).toThrow(/identifiant de l'envoi attendu/)
    expect(() => changerStatutEnvoi(depart, { statut: undefined as never, horodatage: H('09:00') })).toThrow(/Statut « undefined » inconnu pour une notification/)
  })

  it('saut d’étape en avant : motif obligatoire, marqué hors séquence', () => {
    const enCours = enchainerNotification(notification(), ["Attente d'envoi", 'En cours'])
    expect(() => changerStatutEnvoi(enCours, { statut: 'Reçu', horodatage: H('10:00') })).toThrow(
      /passage de « En cours » à « Reçu » hors séquence : motif obligatoire/,
    )
    expect(() => changerStatutEnvoi(enCours, { statut: 'Reçu', horodatage: H('10:00'), motif: '   ' })).toThrow(/motif obligatoire/)
    const recu = changerStatutEnvoi(enCours, {
      statut: 'Reçu',
      horodatage: H('10:00'),
      origine: 'prestataire',
      motif: '  statut « Envoyé OK »   non transmis ',
      referencePrestataire: 'EVT-7',
    })
    expect(recu.historique.at(-1)).toEqual({
      statut: 'Reçu',
      statutAncien: 'En cours',
      horodatage: H('10:00'),
      origine: 'prestataire',
      horsSequence: true,
      motif: 'statut « Envoyé OK » non transmis',
      referencePrestataire: 'EVT-7',
    })
  })

  it('reprise d’un envoi Gestéam déjà abouti : un saut motivé depuis la préparation', () => {
    const repris = changerStatutEnvoi(notification({ origine: 'reprise_gesteam' }), {
      statut: 'Reçu en erreur',
      horodatage: H('09:00'),
      origine: 'reprise_gesteam',
      motif: 'Repris de la console Notifications de Gestéam',
    })
    expect(repris.statut).toBe('Reçu en erreur')
    expect(repris.historique.at(-1)?.horsSequence).toBe(true)
  })

  it('refuse un statut inconnu, un statut de l’autre console, le même statut, une origine inconnue', () => {
    expect(() => changerStatutEnvoi(notification(), { statut: 'Envoyé', horodatage: H('09:00') })).toThrow(
      /Statut « Envoyé » inconnu pour une notification électronique \(statuts Gestéam : Préparation, Attente d'envoi/,
    )
    expect(() => changerStatutEnvoi(notification(), { statut: 'Signé', horodatage: H('09:00') })).toThrow(/inconnu pour une notification/)
    expect(() => changerStatutEnvoi(notification(), { statut: 'Préparation', horodatage: H('09:00') })).toThrow(/déjà au statut « Préparation »/)
    // @ts-expect-error — origine inconnue
    expect(() => changerStatutEnvoi(notification(), { statut: "Attente d'envoi", horodatage: H('09:00'), origine: 'robot' })).toThrow(
      /Origine « robot » inconnue/,
    )
  })

  it('les espaces superflus d’un statut reçu sont normalisés ; la casse, non (aucune correspondance devinée)', () => {
    expect(changerStatutEnvoi(notification(), { statut: "  Attente   d'envoi ", horodatage: H('09:00') }).statut).toBe("Attente d'envoi")
    expect(() => changerStatutEnvoi(notification(), { statut: "attente d'envoi", horodatage: H('09:00') })).toThrow(/inconnu/)
  })

  it('l’horodatage ne remonte pas avant le dernier changement ; les fuseaux sont comparés en temps réel', () => {
    const attente = changerStatutEnvoi(notification(), { statut: "Attente d'envoi", horodatage: '2026-11-17T10:00:00+01:00' })
    expect(() => changerStatutEnvoi(attente, { statut: 'En cours', horodatage: '2026-11-17T08:30:00Z' })).toThrow(
      /horodatage 2026-11-17T08:30:00Z antérieur au dernier changement de statut \(2026-11-17T10:00:00\+01:00\)/,
    )
    expect(changerStatutEnvoi(attente, { statut: 'En cours', horodatage: '2026-11-17T09:30:00Z' }).statut).toBe('En cours')
    expect(changerStatutEnvoi(attente, { statut: 'En cours', horodatage: '2026-11-17T09:00:00Z' }).statut).toBe('En cours')
    expect(() => changerStatutEnvoi(attente, { statut: 'En cours', horodatage: '17/11/2026 10:00' })).toThrow(/Horodatage invalide/)
  })

  it('dateDuStatut rend l’horodatage du premier passage au statut, null s’il n’a pas été atteint', () => {
    const recu = enchainerNotification(notification(), ["Attente d'envoi", 'Préparation', "Attente d'envoi", 'En cours'])
    expect(dateDuStatut(recu, "Attente d'envoi")).toBe(H('09:00'))
    expect(dateDuStatut(recu, 'Envoyé OK')).toBeNull()
  })
})

describe('machine d’états de la console eSignature (🔵 transitions déduites)', () => {
  it('chemin nominal : Soumis → En cours → À relever → Signé → Stocké, signé', () => {
    const stocke = enchainerSignature(signature(), ['En cours', 'À relever', 'Signé', 'Stocké, signé'])
    expect(stocke.statut).toBe('Stocké, signé')
    expect(stocke.historique.map((e) => e.statut)).toEqual(['Soumis', 'En cours', 'À relever', 'Signé', 'Stocké, signé'])
    expect(stocke.historique.every((e) => !e.horsSequence)).toBe(true)
  })

  it('« Signé » directement depuis « En cours », et « Stocké, signé » directement depuis « À relever »', () => {
    expect(enchainerSignature(signature(), ['En cours', 'Signé']).statut).toBe('Signé')
    expect(enchainerSignature(signature(), ['En cours', 'À relever', 'Stocké, signé']).statut).toBe('Stocké, signé')
  })

  it('transitions permises depuis « Soumis » et « En cours »', () => {
    expect(transitionsPermises(signature())).toEqual({
      sansMotif: ['En cours', 'Inconnu', 'Expiré', 'Annulé'],
      avecMotif: ['Signé', 'Stocké, signé', 'À relever'],
    })
    expect(transitionsPermises(enchainerSignature(signature(), ['En cours']))).toEqual({
      sansMotif: ['Signé', 'Inconnu', 'Expiré', 'Annulé', 'À relever'],
      avecMotif: ['Stocké, signé'],
    })
  })

  it('« Inconnu » ne fait jamais revenir en arrière : retour au dernier statut connu ou à ses suivants', () => {
    const inconnu = enchainerSignature(signature(), ['En cours', 'Inconnu'])
    expect(transitionsPermises(inconnu)).toEqual({
      sansMotif: ['En cours', 'Signé', 'Expiré', 'Annulé', 'À relever'],
      avecMotif: ['Stocké, signé'],
    })
    expect(changerStatutEnvoi(inconnu, { statut: 'En cours', horodatage: H('10:00') }).statut).toBe('En cours')
    expect(changerStatutEnvoi(inconnu, { statut: 'Signé', horodatage: H('10:00') }).statut).toBe('Signé')
    expect(() => changerStatutEnvoi(inconnu, { statut: 'Soumis', horodatage: H('10:00') })).toThrow(/passage de « Inconnu » à « Soumis » interdit/)
    expect(() => changerStatutEnvoi(inconnu, { statut: 'Stocké, signé', horodatage: H('10:00') })).toThrow(/motif obligatoire/)
    // Deux « Inconnu » de suite : le dernier statut connu reste la référence.
    const encore = changerStatutEnvoi(changerStatutEnvoi(inconnu, { statut: 'À relever', horodatage: H('10:00') }), { statut: 'Inconnu', horodatage: H('10:01') })
    expect(transitionsPermises(encore).sansMotif).toEqual(['Signé', 'Stocké, signé', 'À relever'])
  })

  it('une signature obtenue ne s’annule ni n’expire ; Expiré et Annulé sont finaux', () => {
    const signe = enchainerSignature(signature(), ['En cours', 'Signé'])
    expect(() => changerStatutEnvoi(signe, { statut: 'Annulé', horodatage: H('10:00') })).toThrow(/interdit/)
    expect(() => changerStatutEnvoi(signe, { statut: 'Expiré', horodatage: H('10:00') })).toThrow(/interdit/)
    const annule = enchainerSignature(signature(), ['Annulé'])
    expect(() => changerStatutEnvoi(annule, { statut: 'En cours', horodatage: H('10:00') })).toThrow(/final/)
  })

  it('lecture : signature obtenue à « Signé », « Stocké, signé » ou « À relever », date constatée par la console, valeur probante selon le niveau (J67, R16)', () => {
    // « À relever » est lu comme « signature faite, document à relever » (REFERENTIEL_SIGNATURE_ELECTRONIQUE) et ne
    // s'annule ni n'expire : la lecture doit le dire signé, sinon le référentiel et la lecture se contredisent.
    expect([...STATUTS_SIGNATURE_OBTENUE]).toEqual(['Signé', 'Stocké, signé', 'À relever'])
    expect(REFERENTIEL_SIGNATURE_ELECTRONIQUE['À relever'].sens).toMatch(/Signature faite/)
    expect(REFERENTIEL_SIGNATURE_ELECTRONIQUE['À relever'].suivants).not.toContain('Annulé')
    const aRelever = enchainerSignature(signature(), ['En cours', 'À relever'])
    expect(lireSignatureElectronique(aRelever)).toEqual({
      statut: 'À relever',
      final: false,
      signatureObtenue: true,
      signatureConstateeLe: H('09:01'),
      niveauSignature: 'inconnu',
      valeurProbante: valeurProbanteSignature('inconnu'),
    })
    // La date constatée reste celle du premier statut de signature obtenue, pas celle du relevé.
    expect(lireSignatureElectronique(enchainerSignature(aRelever, ['Signé'], 10)).signatureConstateeLe).toBe(H('09:01'))
    const stocke = changerStatutEnvoi(signature(), { statut: 'Stocké, signé', horodatage: H('11:00'), motif: 'reprise' })
    expect(lireSignatureElectronique(stocke)).toEqual({
      statut: 'Stocké, signé',
      final: true,
      signatureObtenue: true,
      signatureConstateeLe: H('11:00'),
      niveauSignature: 'inconnu',
      valeurProbante: valeurProbanteSignature('inconnu'),
    })
  })

  it('J67, R16 : signature qualifiée présumée fiable ; simple, avancée ou niveau inconnu, recevable mais à prouver', () => {
    expect(valeurProbanteSignature('qualifiee')).toEqual({
      valeur: 'presumee_fiable',
      niveau: 'qualifiee',
      fondements: ['C. civ. art. 1367, al. 2', 'décret n° 2017-1416, art. 1', 'règlement (UE) n° 910/2014 (eIDAS), art. 25, 2'],
      message:
        "Signature électronique qualifiée : fiabilité présumée, même effet qu'une signature manuscrite (C. civ. art. 1367, al. 2 ; décret n° 2017-1416, art. 1 ; eIDAS, art. 25, 2).",
    })
    for (const niveau of ['simple', 'avancee', 'inconnu'] as const) {
      const lecture = valeurProbanteSignature(niveau)
      expect(lecture).toMatchObject({ valeur: 'recevable_a_prouver', niveau })
      expect(lecture.fondements).toEqual(['C. civ. art. 1366 et 1367', 'règlement (UE) n° 910/2014 (eIDAS), art. 25, 1', 'Cass. 3e civ., 05/03/2026, n° 24-21.034'])
      // pour un procès-verbal d'AG dans un registre électronique, la signature qualifiée est conseillée (D. 1967 art. 17)
      expect(lecture.message).toMatch(/sans présomption de fiabilité.*D\. 1967 art\. 17\)\.$/)
    }
    expect(valeurProbanteSignature('inconnu').message).toMatch(/^Niveau de signature inconnu/)
    expect(valeurProbanteSignature(null)).toEqual(valeurProbanteSignature('inconnu'))
    expect(valeurProbanteSignature(undefined)).toEqual(valeurProbanteSignature('inconnu'))
    expect(() => valeurProbanteSignature('eidas' as never)).toThrow(/Niveau de signature « eidas » inconnu/)
  })

  it('J67, R16 : niveau facultatif sur l’envoi, gardé d’un statut à l’autre ; aucune valeur probante avant la signature', () => {
    const qualifiee = signature({ niveauSignature: 'qualifiee' })
    expect(qualifiee.niveauSignature).toBe('qualifiee')
    expect(signature()).not.toHaveProperty('niveauSignature')
    expect(signature({ niveauSignature: null })).not.toHaveProperty('niveauSignature')
    expect(lireSignatureElectronique(qualifiee)).toMatchObject({ signatureObtenue: false, niveauSignature: 'qualifiee', valeurProbante: null })
    const signee = enchainerSignature(qualifiee, ['En cours', 'Signé'])
    expect(lireSignatureElectronique(signee).valeurProbante?.valeur).toBe('presumee_fiable')
    // « Signé » ne dit rien du niveau : sans niveau, la signature reste à prouver
    expect(lireSignatureElectronique(enchainerSignature(signature(), ['En cours', 'Signé'])).valeurProbante?.valeur).toBe('recevable_a_prouver')
    expect(() => signature({ niveauSignature: 'forte' as never })).toThrow(/Niveau de signature « forte » inconnu/)
    expect(() => lireSignatureElectronique({ ...signee, niveauSignature: 'forte' as never })).toThrow(/Niveau de signature « forte » inconnu/)
  })
})

describe('lecture d’une notification électronique : aucun statut ne vaut notification (J50, J57, J66)', () => {
  const recu = () => enchainerNotification(notification(), ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu'])

  it('la notification se lit sur le courrier (date de transmission de l’avis), pas sur le statut de la console', () => {
    const lecture = lireNotificationElectronique(recu(), suivi({ dateDepot: '2026-11-17', dateAvisElectronique: '2026-11-17' }))
    expect(lecture).toEqual({
      statut: 'Reçu',
      modeNotification: 'lre',
      etatCourrier: 'notifie',
      dateAvisElectronique: '2026-11-17',
      valeurDuStatut: 'non_etablie',
      alertes: [],
    })
  })

  it('aucun statut ne fournit de date ni ne change l’état du courrier : sans avis saisi, le courrier reste non notifié', () => {
    for (const statuts of [[], ["Attente d'envoi"], ["Attente d'envoi", 'En cours'], ["Attente d'envoi", 'Échec'], ["Attente d'envoi", 'En cours', 'Envoyé OK'], ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu'], ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu en erreur']]) {
      const lecture = lireNotificationElectronique(enchainerNotification(notification(), statuts), suivi({ dateDepot: '2026-11-17' }))
      expect(lecture.dateAvisElectronique, statuts.join(' → ')).toBeNull()
      expect(lecture.etatCourrier, statuts.join(' → ')).toBe('envoye_non_notifie')
      expect(lecture.valeurDuStatut).toBe('non_etablie')
    }
  })

  it('console aboutie sans avis saisi : alerte « avis à saisir », source selon le mode', () => {
    const lre = lireNotificationElectronique(recu(), suivi({ dateDepot: '2026-11-17' }))
    expect(lre.alertes.map((a) => a.code)).toEqual(['avis_a_saisir'])
    expect(lre.alertes[0].message).toMatch(/Console au statut « Reçu » : saisir sur le courrier C1 la date de transmission de l'avis électronique/)
    expect(lre.alertes[0].message).toMatch(/information du destinataire \(CPCE art\. R\. 53-3, I ; interprétation\)/)
    expect(lre.alertes[0].message).toMatch(/aucun statut de la console ne la donne \(J57\)/)
    expect(lre.alertes[0].message).not.toMatch(/🔴/)
    const prestataire = creerEnvoiNotificationElectronique({ id: 'E2', courrier: courrierPrestataire, horodatage: H('08:00') })
    const lecture = lireNotificationElectronique(
      enchainerNotification(prestataire, ["Attente d'envoi", 'En cours', 'Envoyé OK']),
      suivi({ id: 'C2', formeEnvoi: 'Email direct', modeNotification: 'prestataire_qualifie', dateDepot: '2026-11-17' }),
    )
    expect(lecture.alertes[0].message).toMatch(/justificatif de transmission du prestataire qualifié \(D\. 1967 art\. 64-5\)/)
  })

  it('avis saisi alors que la console ne montre aucun envoi abouti : alerte, l’avis saisi reste la date retenue', () => {
    const echec = enchainerNotification(notification(), ["Attente d'envoi", 'Échec'])
    const lecture = lireNotificationElectronique(echec, suivi({ dateDepot: '2026-11-16', dateAvisElectronique: '2026-11-17' }))
    expect(lecture.etatCourrier).toBe('notifie')
    expect(lecture.dateAvisElectronique).toBe('2026-11-17')
    expect(lecture.alertes.map((a) => a.code)).toEqual(['avis_sans_envoi_abouti'])
    expect(lecture.alertes[0].message).toMatch(/statut « Échec »/)
  })

  it('« Reçu en erreur » après un avis saisi : alerte, la date saisie reste seule retenue (J50) ; refus ou non-réclamation sans effet (J57)', () => {
    const erreur = enchainerNotification(notification(), ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu en erreur'])
    const lecture = lireNotificationElectronique(erreur, suivi({ dateDepot: '2026-11-16', dateAvisElectronique: '2026-11-17' }))
    expect(lecture.etatCourrier).toBe('notifie')
    expect(lecture.alertes.map((a) => a.code)).toEqual(['retour_en_erreur_apres_avis'])
    expect(lecture.alertes[0].message).toMatch(/D\. 1967 art\. 64, dernier al\./)
    expect(lecture.alertes[0].message).toMatch(/téléchargé ou non/)
    // J57 (décision du 17/11/2026) : un refus ou une non-réclamation après l'avis ne remettent pas en cause sa date.
    // J75 : la décision est citée par son numéro, sans prénom dans le message affiché.
    expect(lecture.alertes[0].message).toMatch(/refus ou une non-réclamation après l'avis ne remettent pas en cause sa date \(J57\)/)
    expect(lecture.alertes[0].message).not.toMatch(/[Rr]éférent métier|Frédéric/)
    // Le défaut de transmission de l'avis reste distinct : à vérifier sur le justificatif.
    expect(lecture.alertes[0].message).toMatch(/défaut de transmission de l'avis, qui ne fait pas courir le délai/)
    expect(lecture.alertes[0].message).not.toMatch(/🔴/)
  })

  it('« Reçu en erreur » sans avis saisi : la date de l’avis n’est à saisir que si le justificatif établit sa transmission', () => {
    const erreur = enchainerNotification(notification(), ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu en erreur'])
    const lecture = lireNotificationElectronique(erreur, suivi({ dateDepot: '2026-11-17' }))
    expect(lecture.alertes.map((a) => a.code)).toEqual(['avis_a_saisir'])
    expect(lecture.alertes[0].message).toMatch(/ne saisir sa date .*sur le courrier C1 que si ce justificatif l'établit/)
    expect(lecture.alertes[0].message).toMatch(/refusé ou non réclamé : la date de l'avis vaut.*J57\) ; défaut de transmission de l'avis : aucune date à saisir/)
    // Pour « Reçu », la consigne reste de saisir la date.
    expect(lireNotificationElectronique(recu(), suivi({ dateDepot: '2026-11-17' })).alertes[0].message).not.toMatch(/que si/)
  })

  it('console aboutie sans dépôt saisi : alerte « dépôt à saisir »', () => {
    const lecture = lireNotificationElectronique(recu(), suivi({ dateDepot: null }))
    expect(lecture.etatCourrier).toBe('non_envoye')
    expect(lecture.alertes.map((a) => a.code)).toEqual(['depot_a_saisir', 'avis_a_saisir'])
  })

  it('envoi sans mode de notification : alerte « sans valeur de notification », pas d’alerte d’avis', () => {
    const simple = enchainerNotification(notification({ courrier: { id: 'C3', formeEnvoi: 'Email' } }), ["Attente d'envoi", 'En cours', 'Envoyé OK', 'Reçu'])
    const lecture = lireNotificationElectronique(simple, suivi({ id: 'C3', modeNotification: null, dateDepot: '2026-11-17' }))
    expect(lecture.etatCourrier).toBe('sans_valeur_de_notification')
    expect(lecture.alertes.map((a) => a.code)).toEqual(['sans_valeur_de_notification'])
  })

  it('refuse un courrier qui n’est pas celui de l’envoi, ou dont le mode a changé', () => {
    expect(() => lireNotificationElectronique(recu(), suivi({ id: 'C2' }))).toThrow(/l'envoi E1 est rattaché au courrier C1, pas à C2/)
    expect(() => lireNotificationElectronique(recu(), suivi({ modeNotification: 'prestataire_qualifie' }))).toThrow(
      /mode « lre » à la création de l'envoi, « prestataire_qualifie » sur le courrier/,
    )
  })

  it('les codes d’alerte sont ceux du référentiel exporté', () => {
    expect(CODES_ALERTE_ENVOI_ELECTRONIQUE).toEqual([
      'sans_valeur_de_notification',
      'depot_a_saisir',
      'avis_a_saisir',
      'avis_sans_envoi_abouti',
      'retour_en_erreur_apres_avis',
    ])
  })
})

describe('en-tête du module', () => {
  const { texte, item } = enTeteDuModule('envois-electroniques')

  it('cite ses sources Gestéam : tranche 40 (deux consoles) et tranche 43 § 4 et § 5 (consentement LRE)', () => {
    expect(texte).toMatch(/Point 65 du bilan/)
    expect(texte).toMatch(/Tranche 40/)
    expect(texte).toMatch(/Tranche 43 § 4 et § 5/)
    expect(texte).toMatch(/⚪/)
  })

  it('rattache la valeur de notification à J50, l’absence d’effet des statuts à J57 et J66, et marque 🔴 le sens de chaque statut', () => {
    expect(texte).toMatch(/J50/)
    expect(texte).toMatch(/D\. 1967 art\. 64, dernier al\./)
    expect(texte).not.toContain('🔴 Aucun statut de la console Notifications')
    expect(item('- J57 et J66 : aucun statut de la console')).toMatch(/ne déduit ni date de notification ni délai/)
    // reste ouvert (L2-02) : le sens exact de chaque statut chez le prestataire branché
    expect(item('🔴 Sens de chaque statut de la console Notifications')).toMatch(/« Envoyé OK » peut être le dépôt ou la transmission/)
    expect(item('🔴 Sens de chaque statut de la console Notifications')).toMatch(/documentation du prestataire branché/)
  })

  it('attribue à J57 (et non à J50) l’effet d’une LRE refusée ou non réclamée ; J58 pour l’échec', () => {
    expect(texte).not.toMatch(/interprétation retenue par J50/)
    expect(texte).not.toContain('🔴 Refus, non-réclamation ou rejet')
    const j57 = item('- J57 (décision du 17/11/2026 (J57))')
    expect(j57).toMatch(/refusé ou non réclamé fait quand même courir le délai, du lendemain de la transmission de l'avis électronique/)
    expect(j57).toMatch(/D\. 1967 art\. 64, dernier al\./)
    expect(j57).toMatch(/défaut de transmission de l'avis/)
    expect(item('- J58 (décision du 17/11/2026 (J58))')).toMatch(/créer un nouveau courrier/)
  })

  it('valeur probante tranchée par J67, R16 ; seul le lien avec « PV signé » reste ouvert', () => {
    expect(item('- J67, R16 (décision du 17/11/2026')).toMatch(/qualifiée, présumée fiable ; simple, avancée ou inconnue, recevable mais à prouver/)
    expect(item('- J67, R16 (décision du 17/11/2026')).toMatch(/SignatureElectroniqueModule\.tsx, non modifié.*Frédéric/)
    const ouvert = item('🔴 Signature électronique')
    expect(ouvert).toMatch(/PV signé/)
    expect(ouvert).not.toMatch(/valeur probante/)
  })

  it('rappelle que le statut de l’envoi ne se fond pas dans celui du courrier (06_PIEGES § 4)', () => {
    expect(texte).toMatch(/06_PIEGES § 4/)
  })
})
