import './fuseau-paris'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ChangementStatut, Courrier } from '@/lib/administrateur-judiciaire/db/schema'
import {
  MODES_NOTIFICATION,
  controlerAvisElectronique,
  controlerPremierePresentation,
  etatNotificationCourrier,
  modeNotificationCourrier,
  preparerCourrier,
  type CourrierSuivi,
} from '@/lib/administrateur-judiciaire/domain/courriers'
import { ajouterJours, composerDateIso as d } from '@/lib/administrateur-judiciaire/domain/dates'
import { controlerAttestationNonRecours, controlerFormeEnvoi } from '@/lib/administrateur-judiciaire/domain/gabarits-courrier'
import {
  CAUSES_DELAI_NON_CALCULE,
  DELAI_CONTESTATION_AG_ART42,
  controlerPreuveNotificationAg,
  derniereFinDelaiContestation,
  finDelaiContestationAg,
  finDelaiContestationAgParDestinataire,
  type ContexteVoieNotification,
  type ResultatDelaiContestation,
} from '@/lib/administrateur-judiciaire/domain/statut-assemblee'
import {
  ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE,
  accordElectroniqueEnVigueur,
  creerConsentementVoieElectronique,
  creerDemandeVoiePostale,
  demandesDepuisConsentements,
  type SensConsentementVoieElectronique,
} from '@/lib/administrateur-judiciaire/domain/voie-notification'

/**
 * Décisions J50 et J51 de Hugo du 11/11/2026 (registre des décisions juridiques ; notes decisions-1111) — partie J50 :
 * - J50 (« Oui, calcul électronique ») : depuis le 25/12/2025 (décret du 22/12/2025, D. 1967 art. 64 à 64-4), le délai
 *   de contestation de 2 mois (L. 1965 art. 42, al. 2) part du lendemain de la transmission de l'avis électronique par
 *   le prestataire (D. 1967 art. 64, dernier al.), et du lendemain de la première présentation pour la LRAR (art. 64-1,
 *   al. 2) ; un délai par opposant ou défaillant (D. 1967 art. 18), fin = la plus tardive ; cas limites : voie postale
 *   demandée puis envoi électronique → délai non lancé pour lui (art. 64-1, 64-4) ; refus ou retrait d'accord d'avant le
 *   25/12/2025 = demande de voie postale à sa date (L. 1965 art. 42-1, al. 2 : « par tout moyen ») ; LRAR sans demande
 *   acceptée avec avertissement ; LRE vers un non-professionnel sans consentement enregistré (CPCE art. L. 100) : calcul
 *   avec avertissement « à confirmer » ; fin tirée d'une seule notification marquée minimale.
 * La partie J51 (blocage de l'OS) est dans envoi-ordre-service.test.ts.
 */

const ligne = (surcharge: Partial<ChangementStatut>): ChangementStatut => ({
  id: 'cs',
  entiteType: 'ag',
  entiteId: 'ag-1',
  statutAncien: 'PV signé',
  statutNouveau: 'Notifiée',
  dateEffet: d(2026, 3, 5),
  courrierId: 'k1',
  horsSequence: false,
  motif: null,
  createdAt: `${d(2026, 3, 6)}T10:00:00.000Z`,
  updatedAt: `${d(2026, 3, 6)}T10:00:00.000Z`,
  createdBy: null,
  updatedBy: null,
  ...surcharge,
})

/** Chaîne complète Projet → Convoquée → PV signé → Notifiée, notification rattachée au courrier k1. */
const chaine = (notification: Partial<ChangementStatut> = {}): ChangementStatut[] => [
  ligne({ id: 'c1', statutAncien: 'Projet', statutNouveau: 'Convoquée', dateEffet: d(2026, 1, 20), courrierId: null }),
  ligne({ id: 'c2', statutAncien: 'Convoquée', statutNouveau: 'PV signé', dateEffet: d(2026, 2, 20), courrierId: null }),
  ligne({ id: 'c3', ...notification }),
]

/** Même chaîne, tenue en 2025 : convocation le 01/09/2025, PV signé le 01/10/2025. */
const chaine2025 = (notification: Partial<ChangementStatut>): ChangementStatut[] => [
  ligne({ id: 'c1', statutAncien: 'Projet', statutNouveau: 'Convoquée', dateEffet: d(2025, 9, 1), courrierId: null }),
  ligne({ id: 'c2', statutAncien: 'Convoquée', statutNouveau: 'PV signé', dateEffet: d(2025, 10, 1), courrierId: null }),
  ligne({ id: 'c3', ...notification }),
]

/** Lettre recommandée électronique déposée le 05/03/2026, avis transmis le jeudi 05/03/2026. */
const courrier = (surcharge: Partial<Courrier> = {}): Courrier => ({
  id: 'k1',
  modeleId: 'm1',
  formeEnvoi: 'Email',
  modeNotification: 'lre',
  statut: 'A Suivre',
  objet: 'Notification du PV',
  coproprieteId: null,
  mandatId: null,
  personneId: 'id-1',
  entrepriseId: null,
  dateDepot: d(2026, 3, 5),
  datePremierePresentation: null,
  dateAvisElectronique: d(2026, 3, 5),
  dateAccuseReception: null,
  referenceDiffusion: null,
  createdAt: `${d(2026, 3, 5)}T09:00:00.000Z`,
  updatedAt: `${d(2026, 3, 5)}T09:00:00.000Z`,
  createdBy: null,
  updatedBy: null,
  ...surcharge,
})

/** LRAR présentée le lundi 02/03/2026. */
const lrar = (surcharge: Partial<Courrier> = {}): Courrier =>
  courrier({ formeEnvoi: 'AR', modeNotification: 'lrar', dateDepot: d(2026, 2, 27), datePremierePresentation: d(2026, 3, 2), dateAvisElectronique: null, ...surcharge })

const calcule = (resultat: ResultatDelaiContestation) => {
  if (resultat.etat !== 'calcule') throw new Error(`Délai non calculé : ${JSON.stringify(resultat)}`)
  return resultat
}

describe('J50 — mode de notification du courrier (liste propre à VitFix, la liste Gestéam des formes d’envoi ne change pas)', () => {
  it('trois modes ; sans mode saisi, la forme « AR » vaut LRAR (courriers d’avant J50), toute autre forme ne vaut pas notification', () => {
    expect(MODES_NOTIFICATION).toEqual(['lrar', 'lre', 'prestataire_qualifie'])
    expect(modeNotificationCourrier({ formeEnvoi: 'AR' })).toBe('lrar')
    expect(modeNotificationCourrier({ formeEnvoi: 'AR', modeNotification: null })).toBe('lrar')
    expect(modeNotificationCourrier({ formeEnvoi: 'Email' })).toBeNull()
    expect(modeNotificationCourrier({ formeEnvoi: 'Email', modeNotification: 'lre' })).toBe('lre')
    expect(modeNotificationCourrier({ formeEnvoi: 'Fichier', modeNotification: 'prestataire_qualifie' })).toBe('prestataire_qualifie')
    // incohérences : une LRAR qui n'est pas un AR, un envoi électronique en AR
    expect(modeNotificationCourrier({ formeEnvoi: 'Email', modeNotification: 'lrar' })).toBeNull()
    expect(modeNotificationCourrier({ formeEnvoi: 'AR', modeNotification: 'lre' })).toBeNull()
  })

  it('le mode est fixé à la création du courrier, cohérent avec la forme d’envoi du modèle', () => {
    const electronique = preparerCourrier({ id: 'm1', formeEnvoi: 'Email' }, { objet: 'Notification du PV', modeNotification: 'prestataire_qualifie' })
    expect(electronique).toMatchObject({ formeEnvoi: 'Email', modeNotification: 'prestataire_qualifie', dateAvisElectronique: null })
    expect(preparerCourrier({ id: 'm1', formeEnvoi: 'AR' }, { objet: 'Notification du PV' })).toMatchObject({ modeNotification: null, dateAvisElectronique: null })
    expect(() => preparerCourrier({ id: 'm1', formeEnvoi: 'Email' }, { objet: 'x', modeNotification: 'lrar' })).toThrow(/AR/)
    expect(() => preparerCourrier({ id: 'm1', formeEnvoi: 'AR' }, { objet: 'x', modeNotification: 'lre' })).toThrow(/AR/)
    // @ts-expect-error — mode hors de la liste
    expect(() => preparerCourrier({ id: 'm1', formeEnvoi: 'Email' }, { objet: 'x', modeNotification: 'courriel' })).toThrow(/mode de notification/i)
  })

  it('état d’un envoi électronique : « notifié » dès la transmission de l’avis, téléchargé ou non (D. 1967 art. 64, dernier al.)', () => {
    const suivi = (surcharge: Partial<CourrierSuivi>): CourrierSuivi => ({
      formeEnvoi: 'Email',
      modeNotification: 'lre',
      dateDepot: d(2026, 3, 5),
      dateAccuseReception: null,
      dateAvisElectronique: null,
      ...surcharge,
    })
    expect(etatNotificationCourrier(suivi({ dateDepot: null }))).toBe('non_envoye')
    expect(etatNotificationCourrier(suivi({}))).toBe('envoye_non_notifie')
    expect(etatNotificationCourrier(suivi({ dateAvisElectronique: d(2026, 3, 5) }))).toBe('notifie')
    // un courriel simple, sans mode de notification, n'a toujours aucune valeur de notification
    expect(etatNotificationCourrier(suivi({ modeNotification: null, dateAvisElectronique: d(2026, 3, 5) }))).toBe('sans_valeur_de_notification')
  })

  it('date de transmission de l’avis : envoi électronique déposé, jamais avant le dépôt ; une date plus tardive est refusée sans motif de correction', () => {
    const depose: CourrierSuivi = { formeEnvoi: 'Email', modeNotification: 'lre', dateDepot: d(2026, 3, 5), dateAccuseReception: null }
    expect(() => controlerAvisElectronique(depose, d(2026, 3, 5))).not.toThrow()
    expect(() => controlerAvisElectronique(depose, d(2026, 3, 4))).toThrow(/précéder le dépôt/)
    expect(() => controlerAvisElectronique({ ...depose, dateDepot: null }, d(2026, 3, 5))).toThrow(/dépôt/)
    expect(() => controlerAvisElectronique(depose, '05/03/2026')).toThrow(/AAAA-MM-JJ/)
    expect(() => controlerAvisElectronique({ ...depose, formeEnvoi: 'AR', modeNotification: null }, d(2026, 3, 5))).toThrow(/électronique/)
    const avise = { ...depose, dateAvisElectronique: d(2026, 3, 6) }
    expect(() => controlerAvisElectronique(avise, d(2026, 3, 8))).toThrow(/R\. 53-3, I/)
    expect(() => controlerAvisElectronique(avise, d(2026, 3, 5))).not.toThrow()
    // la première présentation reste une notion postale
    expect(() => controlerPremierePresentation(depose, d(2026, 3, 6))).toThrow(/AR/)
  })
})

describe('J50 — finDelaiContestationAg : lendemain de la transmission de l’avis électronique', () => {
  it('LRE : avis transmis le 05/03/2026, départ le 06/03, échéance le 06/05/2026 ; justification et fondement nommés, variante « à confirmer »', () => {
    const resultat = calcule(finDelaiContestationAg(chaine(), [courrier()], 'ag-1', { opposantsOuDefaillants: 1, professionnel: true }))
    expect(resultat).toMatchObject({
      mode: 'lre',
      dateEvenement: d(2026, 3, 5),
      datePremierePresentation: null,
      pointDeDepart: d(2026, 3, 6),
      echeanceSansReport: d(2026, 5, 6),
      echeanceAvecReport: d(2026, 5, 6),
      echeanceRetenue: d(2026, 5, 6),
      divergence: false,
      finMinimale: false,
      avertissements: [],
    })
    expect(resultat.justification).toBe(
      "Deux mois à compter du lendemain de la transmission de l'avis électronique par le prestataire, le 05/03/2026 (départ le 06/03/2026) : échéance le 06/05/2026 à minuit — L. 1965 art. 42, al. 2 ; D. 1967 art. 64, dernier al.",
    )
    expect(resultat.aConfirmer).toMatch(/à confirmer/)
    expect(resultat.aConfirmer).toMatch(/R\. 53-3, I/)
  })

  it('procédé d’un prestataire qualifié : même calcul ; ni la date du dépôt ni celle du téléchargement ne déplacent le délai', () => {
    const pscq = courrier({ formeEnvoi: 'Fichier', modeNotification: 'prestataire_qualifie' })
    const base = calcule(finDelaiContestationAg(chaine(), [pscq], 'ag-1', { opposantsOuDefaillants: 1 }))
    expect(base).toMatchObject({ mode: 'prestataire_qualifie', echeanceRetenue: d(2026, 5, 6), avertissements: [] })
    expect(finDelaiContestationAg(chaine(), [{ ...pscq, dateDepot: d(2026, 3, 2) }], 'ag-1', { opposantsOuDefaillants: 1 })).toEqual(base)
    expect(finDelaiContestationAg(chaine(), [{ ...pscq, dateAccuseReception: d(2026, 3, 20) }], 'ag-1', { opposantsOuDefaillants: 1 })).toEqual(base)
    expect(finDelaiContestationAg(chaine(), [{ ...pscq, dateDepot: d(2026, 3, 4), dateAvisElectronique: d(2026, 3, 4) }], 'ag-1', { opposantsOuDefaillants: 1 })).toMatchObject({
      echeanceRetenue: d(2026, 5, 5),
    })
  })

  it('date d’effet saisie différente de la transmission de l’avis : le délai suit l’avis, avec un avertissement', () => {
    const resultat = calcule(finDelaiContestationAg(chaine({ dateEffet: d(2026, 3, 4) }), [courrier()], 'ag-1', { opposantsOuDefaillants: 1, professionnel: true }))
    expect(resultat.echeanceRetenue).toBe(d(2026, 5, 6))
    expect(resultat.avertissements).toEqual([
      `La date d'effet saisie pour la notification (${d(2026, 3, 4)}) diffère de la transmission de l'avis électronique (${d(2026, 3, 5)}) : le délai suit la transmission de l'avis.`,
    ])
  })

  it('avis non saisi : refus, avec ce qu’il faut saisir ; envoi simple sans mode : refus (D. 1967 art. 64 et 64-3)', () => {
    expect(finDelaiContestationAg(chaine(), [courrier({ dateAvisElectronique: null })], 'ag-1')).toEqual({
      etat: 'refuse',
      cause: 'preuve_a_saisir',
      motif:
        "Délai non calculé. La date de transmission de l'avis électronique n'est pas saisie (D. 1967 art. 64, dernier al. ; pour une LRE, information du destinataire par le prestataire, CPCE art. R. 53-3, I, lecture à confirmer).",
    })
    const simple = finDelaiContestationAg(chaine(), [courrier({ modeNotification: null })], 'ag-1')
    expect(simple).toMatchObject({ etat: 'refuse', cause: 'envoi_non_qualifie' })
    expect(simple.etat === 'refuse' && simple.motif).toMatch(/ni un envoi en AR ni une notification électronique/)
    expect(simple.etat === 'refuse' && simple.motif).toMatch(/D\. 1967 art\. 64, 64-1/)
  })

  it('la preuve de la notification (R9) accepte l’avis électronique transmis, pas l’envoi électronique sans avis', () => {
    const historique = [ligne({ courrierId: 'k1' })]
    expect(controlerPreuveNotificationAg(historique, [courrier()], 'ag-1')).toBeNull()
    expect(controlerPreuveNotificationAg(historique, [courrier({ dateAvisElectronique: null })], 'ag-1')?.motif).toMatch(/avis électronique/)
  })
})

describe('J50 — cas limites de la voie de notification', () => {
  /** Demande de voie postale reçue le 20/02/2026 : effet le 01/03/2026 (lendemain du huitième jour, D. 1967 art. 64-4). */
  const demande = creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: d(2026, 2, 20), origine: 'courrier' })
  const voie: ContexteVoieNotification = { demandesVoiePostale: [demande] }
  const avisLe = (date: string) => [courrier({ dateDepot: date, dateAvisElectronique: date })]
  const options = { opposantsOuDefaillants: 1, professionnel: true, voie }

  it('voie postale demandée puis envoi électronique : délai non lancé pour lui (D. 1967 art. 64-1, 64-4) ; bornes de l’effet de la demande', () => {
    expect(finDelaiContestationAg(chaine({ dateEffet: d(2026, 2, 28) }), avisLe(d(2026, 2, 28)), 'ag-1', options)).toMatchObject({ etat: 'calcule' })
    const refus = finDelaiContestationAg(chaine({ dateEffet: d(2026, 3, 1) }), avisLe(d(2026, 3, 1)), 'ag-1', options)
    expect(refus).toEqual({
      etat: 'refuse',
      cause: 'voie_postale_demandee',
      motif:
        "Délai non calculé. Voie postale demandée par ce copropriétaire (effet le 01/03/2026) : l'envoi électronique du 01/03/2026 ne fait pas courir le délai pour lui ; le notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1, 64-4).",
    })
    // une demande d'un autre copropriétaire ne compte pas
    expect(finDelaiContestationAg(chaine(), [courrier({ personneId: 'id-2' })], 'ag-1', options)).toMatchObject({ etat: 'calcule' })
  })

  it('demande formulée à l’assemblée : effet le jour même, la notification électronique de son PV ne fait pas courir le délai', () => {
    const enSeance = creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: d(2026, 2, 20), origine: 'ag', agId: 'ag-1' })
    expect(finDelaiContestationAg(chaine(), [courrier()], 'ag-1', { ...options, voie: { demandesVoiePostale: [enSeance] } })).toMatchObject({
      etat: 'refuse',
      cause: 'voie_postale_demandee',
    })
  })

  it('LRAR : avec une demande de voie postale en vigueur, sans avertissement ; sans demande, calculée avec un avertissement (lecture du GRECCO)', () => {
    const avecDemande = calcule(finDelaiContestationAg(chaine({ dateEffet: d(2026, 3, 2) }), [lrar()], 'ag-1', options))
    expect(avecDemande).toMatchObject({ mode: 'lrar', datePremierePresentation: d(2026, 3, 2), echeanceSansReport: d(2026, 5, 3), avertissements: [] })
    expect(avecDemande.aConfirmer).toBeNull()
    const sansDemande = calcule(finDelaiContestationAg(chaine({ dateEffet: d(2026, 3, 2) }), [lrar()], 'ag-1', { opposantsOuDefaillants: 1 }))
    expect(sansDemande.echeanceSansReport).toBe(d(2026, 5, 3))
    expect(sansDemande.avertissements).toEqual([
      'LRAR sans demande de voie postale enregistrée : délai calculé, validité à confirmer (L. 1965 art. 42-1 ; D. 1967 art. 64-1 ; lecture du GRECCO, préconisation n° 19, source secondaire).',
    ])
  })

  it('refus ou retrait d’accord enregistré avant le 25/12/2025 : demande de voie postale à sa date (L. 1965 art. 42-1, al. 2)', () => {
    for (const sens of ['refus', 'retrait'] as const) {
      const consentement = creerConsentementVoieElectronique({ identiteId: 'id-1', sens, recuLe: d(2025, 6, 2) })
      expect(demandesDepuisConsentements([consentement], d(2026, 3, 5))).toEqual([{ identiteId: 'id-1', recueLe: d(2025, 6, 2), origine: 'autre', agId: null }])
      expect(finDelaiContestationAg(chaine(), [courrier()], 'ag-1', { opposantsOuDefaillants: 1, voie: { consentements: [consentement] } })).toMatchObject({
        etat: 'refuse',
        cause: 'voie_postale_demandee',
      })
    }
    // un accord n'est pas une demande
    expect(demandesDepuisConsentements([creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'accord', recuLe: d(2025, 6, 2) })], d(2026, 3, 5))).toEqual([])
    expect(() => creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'accord', recuLe: '02/06/2025' })).toThrow(/AAAA-MM-JJ/)
    // @ts-expect-error — sens hors liste
    expect(() => creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'peut-être', recuLe: d(2025, 6, 2) })).toThrow(/sens/i)
  })

  it('envoi électronique avant le 25/12/2025 : calculé seulement avec l’accord exprès enregistré ; borne du 24 au 25/12/2025', () => {
    expect(ENTREE_EN_VIGUEUR_VOIE_ELECTRONIQUE).toBe(d(2025, 12, 25))
    const veille = chaine2025({ dateEffet: d(2025, 12, 24) })
    const avis24 = [courrier({ dateDepot: d(2025, 12, 24), dateAvisElectronique: d(2025, 12, 24) })]
    const sansAccord = finDelaiContestationAg(veille, avis24, 'ag-1', { opposantsOuDefaillants: 1, professionnel: true })
    expect(sansAccord).toMatchObject({ etat: 'refuse', cause: 'accord_electronique_absent' })
    expect(sansAccord.etat === 'refuse' && sansAccord.motif).toMatch(/avant le 25\/12\/2025 : accord exprès du copropriétaire à la voie électronique non enregistré/)
    const accord = creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'accord', recuLe: d(2025, 6, 2) })
    expect(finDelaiContestationAg(veille, avis24, 'ag-1', { opposantsOuDefaillants: 1, professionnel: true, voie: { consentements: [accord] } })).toMatchObject({
      etat: 'calcule',
      pointDeDepart: d(2025, 12, 25),
      echeanceSansReport: d(2026, 2, 25),
    })
    // accord retiré avant la notification : plus d'accord en vigueur
    const retrait = creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'retrait', recuLe: d(2025, 9, 1) })
    expect(accordElectroniqueEnVigueur({ identiteId: 'id-1', consentements: [accord, retrait], date: d(2025, 12, 24) })).toBeNull()
    expect(accordElectroniqueEnVigueur({ identiteId: 'id-1', consentements: [accord, retrait], date: d(2025, 8, 31) })).toEqual(accord)
    expect(finDelaiContestationAg(veille, avis24, 'ag-1', { opposantsOuDefaillants: 1, voie: { consentements: [accord, retrait] } })).toMatchObject({
      etat: 'refuse',
      cause: 'accord_electronique_absent',
    })
    // le 25/12/2025 : voie électronique de principe, plus d'accord exigé
    const avis25 = [courrier({ dateDepot: d(2025, 12, 25), dateAvisElectronique: d(2025, 12, 25) })]
    expect(finDelaiContestationAg(chaine2025({ dateEffet: d(2025, 12, 25) }), avis25, 'ag-1', { opposantsOuDefaillants: 1, professionnel: true })).toMatchObject({
      etat: 'calcule',
      avertissements: [],
    })
    // la LRAR d'avant le 25/12/2025 était le principe : aucun avertissement
    const lrarAncienne = [lrar({ dateDepot: d(2025, 11, 3), datePremierePresentation: d(2025, 11, 4) })]
    expect(finDelaiContestationAg(chaine2025({ dateEffet: d(2025, 11, 4) }), lrarAncienne, 'ag-1', { opposantsOuDefaillants: 1 })).toMatchObject({
      etat: 'calcule',
      avertissements: [],
    })
  })

  it('LRE vers un non-professionnel sans consentement enregistré (CPCE art. L. 100) : calcul avec avertissement « à confirmer » ; pas pour le prestataire qualifié', () => {
    const avertissementL100 =
      "LRE à un destinataire non professionnel (ou dont la qualité n'est pas saisie) sans consentement enregistré aux envois recommandés électroniques (CPCE art. L. 100) : délai calculé, à confirmer (D. 1967 art. 64, 1° ne renvoie qu'aux art. R. 53 à R. 53-4 du CPCE)."
    expect(calcule(finDelaiContestationAg(chaine(), [courrier()], 'ag-1', { opposantsOuDefaillants: 1 })).avertissements).toEqual([avertissementL100])
    expect(calcule(finDelaiContestationAg(chaine(), [courrier()], 'ag-1', { opposantsOuDefaillants: 1, professionnel: false })).avertissements).toEqual([avertissementL100])
    expect(calcule(finDelaiContestationAg(chaine(), [courrier()], 'ag-1', { opposantsOuDefaillants: 1, professionnel: true })).avertissements).toEqual([])
    const accord = creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'accord', recuLe: d(2026, 1, 10) })
    expect(calcule(finDelaiContestationAg(chaine(), [courrier()], 'ag-1', { opposantsOuDefaillants: 1, voie: { consentements: [accord] } })).avertissements).toEqual([])
    const pscq = courrier({ formeEnvoi: 'Fichier', modeNotification: 'prestataire_qualifie' })
    expect(calcule(finDelaiContestationAg(chaine(), [pscq], 'ag-1', { opposantsOuDefaillants: 1 })).avertissements).toEqual([])
  })

  it('fin tirée d’une seule notification : minimale quand l’AG compte plusieurs opposants ou défaillants, ou quand leur nombre n’est pas saisi (D. 1967 art. 18)', () => {
    const pscq = [courrier({ formeEnvoi: 'Fichier', modeNotification: 'prestataire_qualifie' })]
    const plusieurs = calcule(finDelaiContestationAg(chaine(), pscq, 'ag-1', { opposantsOuDefaillants: 3 }))
    expect(plusieurs.finMinimale).toBe(true)
    expect(plusieurs.avertissements).toEqual([
      "Fin minimale : tirée d'une seule notification alors que l'assemblée compte 3 opposants ou défaillants ; un autre a pu être notifié plus tard (D. 1967 art. 18 : un délai par opposant ou défaillant). Calculer le délai de chacun.",
    ])
    const nonSaisi = calcule(finDelaiContestationAg(chaine(), pscq, 'ag-1'))
    expect(nonSaisi.finMinimale).toBe(true)
    expect(nonSaisi.avertissements).toEqual([
      "Fin minimale : tirée d'une seule notification, nombre d'opposants et de défaillants non saisi ; un autre a pu être notifié plus tard (D. 1967 art. 18 : un délai par opposant ou défaillant). Calculer le délai de chacun.",
    ])
    expect(calcule(finDelaiContestationAg(chaine(), pscq, 'ag-1', { opposantsOuDefaillants: 1 })).finMinimale).toBe(false)
    expect(() => finDelaiContestationAg(chaine(), pscq, 'ag-1', { opposantsOuDefaillants: -1 })).toThrow(/entier positif/)
  })
})

describe('J50 — un délai par opposant ou défaillant, fin la plus tardive (D. 1967 art. 18)', () => {
  /**
   * id-1 : LRAR présentée le lundi 02/03/2026 → échéance le dimanche 03/05/2026 (lundi 04/05 avec le report) ;
   * id-2 : prestataire qualifié, avis le dimanche 01/03/2026 → échéance le samedi 02/05/2026 (lundi 04/05 avec le report) ;
   * id-3 : LRE, avis le 05/03/2026 → échéance le mercredi 06/05/2026.
   */
  const courriers: Courrier[] = [
    lrar({ id: 'k-1', personneId: 'id-1' }),
    courrier({ id: 'k-2', personneId: 'id-2', formeEnvoi: 'Fichier', modeNotification: 'prestataire_qualifie', dateDepot: d(2026, 3, 1), dateAvisElectronique: d(2026, 3, 1) }),
    courrier({ id: 'k-3', personneId: 'id-3' }),
  ]
  const voie: ContexteVoieNotification = { demandesVoiePostale: [creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: d(2026, 1, 5), origine: 'courrier' })] }
  const notifications = [
    { identiteId: 'id-1', courrierId: 'k-1' },
    { identiteId: 'id-2', courrierId: 'k-2' },
    { identiteId: 'id-3', courrierId: 'k-3', professionnel: true },
  ]

  it('la fin retenue est la plus tardive des délais ; la date prudente pour attendre inclut le report au jour ouvrable', () => {
    const resultat = finDelaiContestationAgParDestinataire(chaine(), courriers, 'ag-1', { opposantsOuDefaillants: 3, notifications, voie })
    expect(resultat).toMatchObject({ etat: 'calcule', echeanceRetenue: d(2026, 5, 6), echeanceLaPlusTardive: d(2026, 5, 6), dernierDestinataire: 'id-3' })
    if (resultat.etat !== 'calcule') throw new Error('calcul attendu')
    expect(resultat.destinataires.map((r) => [r.identiteId, r.etat === 'calcule' && r.mode, r.etat === 'calcule' && r.echeanceSansReport])).toEqual([
      ['id-1', 'lrar', d(2026, 5, 3)],
      ['id-2', 'prestataire_qualifie', d(2026, 5, 2)],
      ['id-3', 'lre', d(2026, 5, 6)],
    ])
    expect(resultat.destinataires.every((r) => r.etat === 'calcule' && !r.finMinimale)).toBe(true)
    expect(resultat.justification).toBe(
      "Fin la plus tardive des 3 délais (un par opposant ou défaillant, D. 1967 art. 18) : le 06/05/2026 à minuit (identité id-3) — L. 1965 art. 42, al. 2.",
    )
    expect(resultat.aConfirmer).toMatch(/à confirmer/)
    // sans id-3 : 03/05 sans report (id-1), mais 04/05 report compris (id-1 et id-2)
    const deux = finDelaiContestationAgParDestinataire(chaine(), courriers, 'ag-1', { opposantsOuDefaillants: 2, notifications: notifications.slice(0, 2), voie })
    expect(deux).toMatchObject({ etat: 'calcule', echeanceRetenue: d(2026, 5, 3), echeanceLaPlusTardive: d(2026, 5, 4), dernierDestinataire: 'id-1' })
    expect(deux.etat === 'calcule' && deux.justification).toBe(
      "Fin la plus tardive des 2 délais (un par opposant ou défaillant, D. 1967 art. 18) : le 03/05/2026 à minuit (identité id-1) — L. 1965 art. 42, al. 2. Report au jour ouvrable débattu : le 04/05/2026 si on l’applique.",
    )
  })

  it('une notification manque, ou n’est pas prouvée : fin inconnue, avec le copropriétaire concerné et la cause', () => {
    const manque = finDelaiContestationAgParDestinataire(chaine(), courriers, 'ag-1', { opposantsOuDefaillants: 4, notifications, voie })
    expect(manque).toMatchObject({ etat: 'refuse', cause: 'notification_absente' })
    expect(manque.etat === 'refuse' && manque.motif).toBe("Délai non calculé. 1 opposant ou défaillant sur 4 sans notification rattachée (D. 1967 art. 18).")
    const sansCourrier = finDelaiContestationAgParDestinataire(chaine(), courriers, 'ag-1', {
      opposantsOuDefaillants: 3,
      notifications: [...notifications.slice(0, 2), { identiteId: 'id-3', courrierId: null }],
      voie,
    })
    expect(sansCourrier).toMatchObject({ etat: 'refuse', cause: 'notification_absente' })
    expect(sansCourrier.etat === 'refuse' && sansCourrier.motif).toBe('Délai non calculé. Identité id-3 : Aucun courrier rattaché à la notification.')
    const sansAvis = finDelaiContestationAgParDestinataire(chaine(), [...courriers.slice(0, 2), courrier({ id: 'k-3', personneId: 'id-3', dateAvisElectronique: null })], 'ag-1', {
      opposantsOuDefaillants: 3,
      notifications,
      voie,
    })
    expect(sansAvis).toMatchObject({ etat: 'refuse', cause: 'preuve_a_saisir' })
    expect(sansAvis.etat === 'refuse' && sansAvis.destinataires.map((r) => [r.identiteId, r.etat])).toEqual([
      ['id-1', 'calcule'],
      ['id-2', 'calcule'],
      ['id-3', 'refuse'],
    ])
    // voie postale demandée par id-3 puis envoi électronique : délai non lancé pour lui
    const postale = finDelaiContestationAgParDestinataire(chaine(), courriers, 'ag-1', {
      opposantsOuDefaillants: 3,
      notifications,
      voie: { demandesVoiePostale: [...(voie.demandesVoiePostale ?? []), creerDemandeVoiePostale({ identiteId: 'id-3', recueLe: d(2026, 1, 5), origine: 'courrier' })] },
    })
    expect(postale).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    expect(postale.etat === 'refuse' && postale.motif).toMatch(/^Délai non calculé\. Identité id-3 : Voie postale demandée/)
  })

  it('le courrier rattaché doit être adressé au même copropriétaire', () => {
    const autre = finDelaiContestationAgParDestinataire(chaine(), courriers, 'ag-1', {
      opposantsOuDefaillants: 1,
      notifications: [{ identiteId: 'id-9', courrierId: 'k-1' }],
      voie,
    })
    expect(autre).toMatchObject({ etat: 'refuse', cause: 'destinataire_different' })
    expect(autre.etat === 'refuse' && autre.motif).toBe(
      'Délai non calculé. Identité id-9 : Le courrier rattaché (id=k-1) est adressé à une autre personne (identité id-1) : il ne notifie pas le procès-verbal à ce copropriétaire (D. 1967 art. 18).',
    )
  })

  it('aucun opposant ni défaillant : aucune contestation n’est ouverte, même sans notification ; nombre non saisi : fin inconnue', () => {
    const sansContestation = finDelaiContestationAgParDestinataire([], [], 'ag-1', { opposantsOuDefaillants: 0, notifications: [] })
    expect(sansContestation).toEqual({
      etat: 'sans_contestation',
      motif: "Aucun opposant ni défaillant : aucune contestation n'est ouverte, aucun délai à attendre (L. 1965 art. 42, al. 2 ; D. 1967 art. 18 ; interprétation à confirmer).",
    })
    expect(finDelaiContestationAgParDestinataire([], [], 'ag-1', { opposantsOuDefaillants: 2, notifications: [] })).toEqual({ etat: 'non_notifiee' })
    const nonSaisi = finDelaiContestationAgParDestinataire(chaine(), courriers, 'ag-1', { opposantsOuDefaillants: null, notifications, voie })
    expect(nonSaisi).toMatchObject({ etat: 'refuse', cause: 'opposants_non_saisis', destinataires: [] })
    expect(nonSaisi.etat === 'refuse' && nonSaisi.motif).toBe("Délai non calculé. Nombre d'opposants et de défaillants non saisi (D. 1967 art. 18).")
    const incomplete = finDelaiContestationAgParDestinataire([ligne({})], courriers, 'ag-1', { opposantsOuDefaillants: 3, notifications, voie })
    expect(incomplete).toMatchObject({ etat: 'refuse', cause: 'statuts_incomplets' })
  })

  it('données incohérentes refusées : plus de notifications que d’opposants, identité en double, nombre invalide', () => {
    expect(() => finDelaiContestationAgParDestinataire(chaine(), courriers, 'ag-1', { opposantsOuDefaillants: 2, notifications, voie })).toThrow(/incohérentes/)
    expect(() => finDelaiContestationAgParDestinataire([], [], 'ag-1', { opposantsOuDefaillants: 0, notifications: notifications.slice(0, 1) })).toThrow(/incohérentes/)
    expect(() =>
      finDelaiContestationAgParDestinataire(chaine(), courriers, 'ag-1', { opposantsOuDefaillants: 3, notifications: [notifications[0], notifications[0]], voie }),
    ).toThrow(/en double/)
    expect(() => finDelaiContestationAgParDestinataire(chaine(), courriers, 'ag-1', { opposantsOuDefaillants: 1.5, notifications: [], voie })).toThrow(/entier positif/)
  })

  it('derniereFinDelaiContestation : reprise de l’attestation de non-recours (plus tardive des deux calculs, report compris)', () => {
    const resultats = notifications.map((n) => finDelaiContestationAg(chaine({ courrierId: n.courrierId }), courriers, 'ag-1', { voie, professionnel: true }))
    expect(derniereFinDelaiContestation(resultats)).toEqual({ echeance: d(2026, 5, 6), rang: 2 })
    expect(derniereFinDelaiContestation([...resultats, { etat: 'non_notifiee' }])).toEqual({
      cause: 'pv_non_notifie',
      motif: "Procès-verbal non notifié : le délai de l'art. 42 n'a pas couru.",
    })
    expect(controlerAttestationNonRecours(resultats, d(2026, 5, 7), { assignationsRecues: 0, notificationsAttendues: 3 })).toMatchObject({ delivrable: true })
    expect(controlerAttestationNonRecours(resultats, d(2026, 5, 6), { assignationsRecues: 0, notificationsAttendues: 3 })).toMatchObject({ delivrable: false })
  })
})

/**
 * Relecture du 14/11/2026, tour 1 (notes decisions-1111/corrections-j50-1.md) : constats corrigés, chacun montré d'abord
 * par un test en échec.
 */
describe('J50 — relecture du 14/11/2026 (tour 1) : constats corrigés', () => {
  /** Chaîne complète dont la notification est datée `notifLe` (convocation 60 jours avant, PV signé 30 jours avant). */
  const chaineLe = (notifLe: string, notification: Partial<ChangementStatut> = {}): ChangementStatut[] => [
    ligne({ id: 'c1', statutAncien: 'Projet', statutNouveau: 'Convoquée', dateEffet: ajouterJours(notifLe, -60), courrierId: null }),
    ligne({ id: 'c2', statutAncien: 'Convoquée', statutNouveau: 'PV signé', dateEffet: ajouterJours(notifLe, -30), courrierId: null }),
    ligne({ id: 'c3', dateEffet: notifLe, ...notification }),
  ]
  /** LRE déposée et avisée le même jour. */
  const lreLe = (date: string, surcharge: Partial<Courrier> = {}): Courrier => courrier({ dateDepot: date, dateAvisElectronique: date, ...surcharge })
  const consent = (sens: SensConsentementVoieElectronique, recuLe: string) => creerConsentementVoieElectronique({ identiteId: 'id-1', sens, recuLe })
  const demandePostale = (recueLe: string) => creerDemandeVoiePostale({ identiteId: 'id-1', recueLe, origine: 'courrier' })
  const lreDu = (date: string, voie: ContexteVoieNotification) =>
    finDelaiContestationAg(chaineLe(date), [lreLe(date)], 'ag-1', { opposantsOuDefaillants: 1, professionnel: true, voie })
  const motifDe = (resultat: ResultatDelaiContestation): string => {
    if (resultat.etat !== 'refuse') throw new Error(`Refus attendu : ${JSON.stringify(resultat)}`)
    return resultat.motif
  }

  it('avant le 25/12/2025, une demande de voie postale enregistrée exclut l’envoi électronique : délai non lancé, effet retenu à sa réception', () => {
    const accord = consent('accord', d(2023, 5, 1))
    const avis = d(2025, 9, 15)
    // sonde P6 : demande reçue le 01/06/2025, depuis le 11/04/2024 (L. 1965 art. 42-1, al. 2)
    const p6 = lreDu(avis, { consentements: [accord], demandesVoiePostale: [demandePostale(d(2025, 6, 1))] })
    expect(p6).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    expect(motifDe(p6)).toBe(
      "Délai non calculé. Voie postale demandée par ce copropriétaire, demande reçue le 01/06/2025 (« à tout moment et par tout moyen », L. 1965 art. 42-1, al. 2, version de la loi du 9 avril 2024 ; elle vaut au moins retrait de l'accord exprès, D. 1967 art. 64-4, rédaction en vigueur du 04/07/2020 au 24/12/2025 ; effet retenu à sa réception, le délai de huit jours de l'art. 64-4 actuel n'existait pas) : l'envoi électronique du 15/09/2025 ne fait pas courir le délai pour lui ; le notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1).",
    )
    // demande reçue avant le 11/04/2024 : retrait de l'accord exprès
    const ancienne = lreDu(avis, { consentements: [accord], demandesVoiePostale: [demandePostale(d(2023, 6, 1))] })
    expect(ancienne).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    expect(motifDe(ancienne)).toContain(
      "demande reçue le 01/06/2023 (retrait de l'accord exprès à la voie électronique, D. 1967 art. 64-4, rédaction en vigueur du 04/07/2020 au 24/12/2025 ; effet retenu à sa réception)",
    )
    // bornes : reçue le jour de l'envoi, délai non lancé ; reçue le lendemain, délai calculé
    expect(lreDu(avis, { consentements: [accord], demandesVoiePostale: [demandePostale(avis)] })).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    expect(lreDu(avis, { consentements: [accord], demandesVoiePostale: [demandePostale(d(2025, 9, 16))] })).toMatchObject({
      etat: 'calcule',
      echeanceSansReport: d(2025, 11, 16),
    })
    // la LRAR, principe avant le 25/12/2025, n'est pas concernée
    const lrarAncienne = lrar({ dateDepot: d(2025, 9, 12), datePremierePresentation: avis })
    expect(
      finDelaiContestationAg(chaineLe(avis), [lrarAncienne], 'ag-1', { opposantsOuDefaillants: 1, voie: { demandesVoiePostale: [demandePostale(d(2025, 6, 1))] } }),
    ).toMatchObject({ etat: 'calcule', avertissements: [] })
  })

  it('refus ou retrait suivi d’un nouvel accord : plus une demande de voie postale (dernier état des consentements à la date de l’envoi)', () => {
    const avis2026 = d(2026, 3, 5)
    // sonde P1 : refus 2021, accord 2023
    expect(lreDu(avis2026, { consentements: [consent('refus', d(2021, 5, 1)), consent('accord', d(2023, 5, 1))] })).toMatchObject({ etat: 'calcule' })
    // sondes P2 et P2b : accord 2021, retrait 2022, accord 2023 : calculée en 2025 comme en 2026
    const p2 = [consent('accord', d(2021, 5, 1)), consent('retrait', d(2022, 5, 1)), consent('accord', d(2023, 5, 1))]
    expect(lreDu(avis2026, { consentements: p2 })).toMatchObject({ etat: 'calcule' })
    expect(lreDu(d(2025, 9, 15), { consentements: p2 })).toMatchObject({ etat: 'calcule' })
    // sonde S3 : refus 2021, accord 2023, retrait 2024 : la demande court depuis le retrait
    const s3 = lreDu(d(2026, 1, 10), { consentements: [consent('refus', d(2021, 3, 1)), consent('accord', d(2023, 5, 2)), consent('retrait', d(2024, 2, 1))] })
    expect(s3).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    expect(motifDe(s3)).toContain('(effet le 10/02/2024)')
    // refus puis accord reçus depuis le 25/12/2025 : le dernier reçu au plus tard à l'envoi compte
    const recents = [consent('refus', d(2026, 1, 10)), consent('accord', d(2026, 2, 1))]
    expect(lreDu(avis2026, { consentements: recents })).toMatchObject({ etat: 'calcule' })
    expect(lreDu(d(2026, 1, 25), { consentements: recents })).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    // accord reçu après l'envoi : le refus était encore le dernier état
    expect(lreDu(avis2026, { consentements: [consent('refus', d(2021, 5, 1)), consent('accord', d(2026, 4, 1))] })).toMatchObject({
      etat: 'refuse',
      cause: 'voie_postale_demandee',
    })
    // écart (🔵, question à Hugo) : refus d'avant le 25/12/2025, puis accord reçu depuis : l'accord, dernier état, l'emporte
    expect(lreDu(avis2026, { consentements: [consent('refus', d(2021, 5, 1)), consent('accord', d(2026, 1, 10))] })).toMatchObject({ etat: 'calcule' })
    // une demande de voie postale enregistrée n'est pas levée par un accord (retour à l'électronique non établi, 🔴)
    expect(lreDu(avis2026, { demandesVoiePostale: [demandePostale(d(2026, 1, 5))], consentements: [consent('accord', d(2026, 2, 1))] })).toMatchObject({
      etat: 'refuse',
      cause: 'voie_postale_demandee',
    })
    // demandesDepuisConsentements : les refus et retraits reçus depuis le dernier accord reçu au plus tard à la date
    const suite = [consent('refus', d(2021, 3, 1)), consent('accord', d(2023, 5, 2)), consent('retrait', d(2024, 2, 1)), consent('refus', d(2024, 3, 1))]
    expect(demandesDepuisConsentements(suite, d(2026, 1, 10))).toEqual([
      { identiteId: 'id-1', recueLe: d(2024, 2, 1), origine: 'autre', agId: null },
      { identiteId: 'id-1', recueLe: d(2024, 3, 1), origine: 'autre', agId: null },
    ])
    expect(demandesDepuisConsentements(suite, d(2023, 12, 31))).toEqual([])
    expect(() => demandesDepuisConsentements(suite, '10/01/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('un même courrier ne notifie pas deux opposants ; un courrier sans destinataire ne prouve pas la notification d’un copropriétaire donné (D. 1967 art. 18)', () => {
    const notifier = (identites: string[]) => identites.map((identiteId) => ({ identiteId, courrierId: 'k1', professionnel: true }))
    // sondes P3 et S2 : trois opposants, un seul courrier sans destinataire
    expect(() =>
      finDelaiContestationAgParDestinataire(chaine(), [courrier({ personneId: null })], 'ag-1', { opposantsOuDefaillants: 3, notifications: notifier(['id-1', 'id-2', 'id-3']) }),
    ).toThrow(
      'Courrier k1 rattaché à deux opposants ou défaillants (identités id-1 et id-2) : une notification par copropriétaire (D. 1967 art. 18), données incohérentes.',
    )
    // même courrier adressé à id-1 : même erreur
    expect(() =>
      finDelaiContestationAgParDestinataire(chaine(), [courrier()], 'ag-1', { opposantsOuDefaillants: 2, notifications: notifier(['id-1', 'id-2']) }),
    ).toThrow(/données incohérentes/)
    // un seul opposant, courrier sans destinataire : fin inconnue, avec sa cause
    const seul = finDelaiContestationAgParDestinataire(chaine(), [courrier({ personneId: null })], 'ag-1', { opposantsOuDefaillants: 1, notifications: notifier(['id-1']) })
    expect(seul).toMatchObject({ etat: 'refuse', cause: 'destinataire_non_renseigne' })
    expect(seul.etat === 'refuse' && seul.motif).toBe(
      "Délai non calculé. Identité id-1 : Destinataire du courrier rattaché (id=k1) non renseigné : rien ne montre qu'il notifie le procès-verbal à ce copropriétaire (D. 1967 art. 18 : notification « à chacun des copropriétaires opposants ou défaillants »).",
    )
    expect(CAUSES_DELAI_NON_CALCULE).toContain('destinataire_non_renseigne')
  })

  it('accord exprès absent avant le 25/12/2025 : le fondement cité suit la date de l’envoi (L. 1965 art. 42-1 dans sa version du moment)', () => {
    const motif = (date: string) => {
      const resultat = lreDu(date, {})
      expect(resultat).toMatchObject({ etat: 'refuse', cause: 'accord_electronique_absent' })
      return motifDe(resultat)
    }
    // sonde P5 : le 02/06/2025, l'art. 42-1 disait déjà « valablement faites par voie électronique »
    const p5 = motif(d(2025, 6, 2))
    expect(p5).toBe(
      "Délai non calculé. Notification électronique envoyée le 02/06/2025, avant le 25/12/2025 : accord exprès du copropriétaire à la voie électronique non enregistré (D. 1967 art. 64-3, rédaction en vigueur du 04/07/2020 au 24/12/2025 ; L. 1965 art. 42-1, version de la loi du 9 avril 2024 : portée débattue, deux lectures selon le GRECCO, préconisation n° 19, source secondaire ; lecture prudente retenue).",
    )
    expect(p5).not.toContain('2014-366')
    // jusqu'au 10/04/2024, l'accord venait de la loi ; le 11/04/2024, de la seule rédaction du décret
    expect(motif(d(2024, 4, 10))).toContain('(L. 1965 art. 42-1, version de la loi n° 2014-366 ; D. 1967 art. 64-3, rédaction en vigueur du 04/07/2020 au 24/12/2025)')
    expect(motif(d(2024, 4, 11))).toContain('L. 1965 art. 42-1, version de la loi du 9 avril 2024 : portée débattue')
    // avant le 04/07/2020 : rédaction antérieure du décret
    expect(motif(d(2020, 7, 3))).toContain('(L. 1965 art. 42-1, version de la loi n° 2014-366 ; D. 1967 art. 64 à 64-4, rédaction antérieure au 04/07/2020)')
    expect(motif(d(2020, 7, 4))).toContain('rédaction en vigueur du 04/07/2020 au 24/12/2025')
  })

  it('date de transmission de l’avis : fondement selon le mode ; date plus tardive admise comme correction motivée ; avis antérieur au dépôt refusé au calcul', () => {
    const lre: CourrierSuivi = { formeEnvoi: 'Email', modeNotification: 'lre', dateDepot: d(2026, 3, 5), dateAccuseReception: null, dateAvisElectronique: d(2026, 3, 5) }
    const pscq: CourrierSuivi = { ...lre, formeEnvoi: 'Fichier', modeNotification: 'prestataire_qualifie' }
    // plus tardive, sans motif : refus ; LRE : CPCE art. R. 53-3, I, interprétation ; prestataire qualifié : D. 1967 art. 64-7
    expect(() => controlerAvisElectronique(lre, d(2026, 3, 6))).toThrow(
      "Date de transmission de l'avis du 06/03/2026 postérieure à celle déjà saisie (05/03/2026) : seule l'information du destinataire fait courir le délai, un nouvel avis ne la repousse pas (CPCE art. R. 53-3, I ; interprétation, 🔵). Pour corriger une date saisie par erreur (par exemple celle du dépôt), donner le motif de la correction.",
    )
    expect(() => controlerAvisElectronique(lre, d(2026, 3, 6))).not.toThrow(/64-7/)
    expect(() => controlerAvisElectronique(pscq, d(2026, 3, 6))).toThrow(/le rappel envoyé après 48 heures est sans effet \(D\. 1967 art\. 64-7\)/)
    // avec un motif : admise, avertissement à tracer
    expect(controlerAvisElectronique(pscq, d(2026, 3, 6), { motifCorrection: 'date du dépôt saisie par erreur' })).toEqual([
      "Date de transmission de l'avis corrigée du 05/03/2026 au 06/03/2026 (motif : date du dépôt saisie par erreur) : vérifier sur le justificatif de transmission (D. 1967 art. 64-5) qu'il ne s'agit pas du rappel envoyé après 48 heures, sans effet sur le point de départ (art. 64-7).",
    ])
    expect(controlerAvisElectronique(lre, d(2026, 3, 6), { motifCorrection: 'saisie erronée' })[0]).toContain('CPCE art. R. 53-3, I')
    expect(() => controlerAvisElectronique(lre, d(2026, 3, 6), { motifCorrection: '  ' })).toThrow(/motif de la correction/)
    // même date, ou plus tôt sans précéder le dépôt : rien à signaler
    expect(controlerAvisElectronique(lre, d(2026, 3, 5))).toEqual([])
    // au calcul, un avis antérieur au dépôt n'est pas une preuve (comme à la saisie)
    const avant = finDelaiContestationAg(chaine(), [courrier({ dateAvisElectronique: d(2026, 3, 4) })], 'ag-1', { opposantsOuDefaillants: 1 })
    expect(avant).toMatchObject({ etat: 'refuse', cause: 'preuve_a_saisir' })
    expect(motifDe(avant)).toBe(
      "Délai non calculé. La date de transmission de l'avis électronique saisie (04/03/2026) précède le dépôt de l'envoi (05/03/2026) : la corriger d'après l'information du destinataire (CPCE art. R. 53-3, I).",
    )
    // avis non saisi : fondement selon le mode
    const pscqSansAvis = courrier({ formeEnvoi: 'Fichier', modeNotification: 'prestataire_qualifie', dateAvisElectronique: null })
    expect(motifDe(finDelaiContestationAg(chaine(), [pscqSansAvis], 'ag-1'))).toBe(
      "Délai non calculé. La date de transmission de l'avis électronique par le prestataire qualifié n'est pas saisie (justificatif de transmission, D. 1967 art. 64-5).",
    )
  })

  it('refus ou demande reçus avant le 25/12/2025, effet après l’envoi électronique : délai calculé, avertissement « à confirmer »', () => {
    const avis = d(2025, 12, 27)
    // sonde P9 : refus reçu le 20/12/2025, LRE du 27/12/2025 ; effet selon la règle actuelle : le 29/12/2025
    const p9 = calcule(lreDu(avis, { consentements: [consent('refus', d(2025, 12, 20))] }))
    expect(p9.echeanceSansReport).toBe(d(2026, 2, 28))
    expect(p9.avertissements).toEqual([
      "Refus de la voie électronique, retrait de l'accord ou demande de voie postale reçu le 20/12/2025, avant le 25/12/2025 : selon la règle actuelle, effet le 29/12/2025, après l'envoi électronique du 27/12/2025 ; sous l'ancienne règle, il excluait déjà la voie électronique. Délai calculé, à confirmer (D. 1967 art. 64-4 ; décret du 22/12/2025 sans règle transitoire ; point ouvert, question à Hugo).",
    ])
    // demande de voie postale enregistrée, reçue le même jour : même avertissement
    expect(calcule(lreDu(avis, { demandesVoiePostale: [demandePostale(d(2025, 12, 20))] })).avertissements).toHaveLength(1)
    // effet atteint à l'envoi : délai non lancé, comme avant
    expect(lreDu(d(2025, 12, 29), { consentements: [consent('refus', d(2025, 12, 20))] })).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    // demande reçue depuis le 25/12/2025 et pas encore effective : règle actuelle, sans avertissement
    expect(lreDu(avis, { demandesVoiePostale: [demandePostale(d(2025, 12, 26))] })).toMatchObject({ etat: 'calcule', avertissements: [] })
  })

  it('régime et voie jugés à la date du dépôt de l’envoi ; point de départ inchangé (lendemain de l’événement)', () => {
    // sonde P7 : LRAR déposée le 22/12/2025 (LRAR de principe), présentée le 26/12/2025 : aucun avertissement
    const lrarDeposeeLe = (depot: string) => lrar({ dateDepot: depot, datePremierePresentation: d(2025, 12, 26) })
    const p7 = calcule(finDelaiContestationAg(chaineLe(d(2025, 12, 26)), [lrarDeposeeLe(d(2025, 12, 22))], 'ag-1', { opposantsOuDefaillants: 1 }))
    expect(p7).toMatchObject({ pointDeDepart: d(2025, 12, 27), avertissements: [] })
    // déposée le 25/12/2025 : voie électronique de principe, avertissement « LRAR sans demande »
    const deposee25 = calcule(finDelaiContestationAg(chaineLe(d(2025, 12, 26)), [lrarDeposeeLe(d(2025, 12, 25))], 'ag-1', { opposantsOuDefaillants: 1 }))
    expect(deposee25.avertissements).toEqual([expect.stringMatching(/^LRAR sans demande de voie postale enregistrée/)])
    // LRAR : une demande reçue avant le dépôt, même pas encore effective, justifie la voie postale ; reçue après, non
    const lrarMars = (recueLe: string) =>
      calcule(finDelaiContestationAg(chaine({ dateEffet: d(2026, 3, 2) }), [lrar()], 'ag-1', { opposantsOuDefaillants: 1, voie: { demandesVoiePostale: [demandePostale(recueLe)] } }))
    expect(lrarMars(d(2026, 2, 27)).avertissements).toEqual([])
    expect(lrarMars(d(2026, 2, 28)).avertissements).toEqual([expect.stringMatching(/^LRAR sans demande de voie postale enregistrée/)])
    // sonde S7 : LRE déposée le 24/12/2025 sans accord, avis le 25/12/2025 : ancien régime, accord exigé
    const s7 = finDelaiContestationAg(chaineLe(d(2025, 12, 25)), [courrier({ dateDepot: d(2025, 12, 24), dateAvisElectronique: d(2025, 12, 25) })], 'ag-1', {
      opposantsOuDefaillants: 1,
      professionnel: true,
    })
    expect(s7).toMatchObject({ etat: 'refuse', cause: 'accord_electronique_absent' })
    expect(motifDe(s7)).toContain('Notification électronique envoyée le 24/12/2025, avant le 25/12/2025')
    // sonde S5 : demande reçue le 20/02/2026 (effet le 01/03) ; LRE déposée le 28/02, avis le 01/03 : envoyée avant l'effet
    const s5 = finDelaiContestationAg(chaineLe(d(2026, 3, 1)), [courrier({ dateDepot: d(2026, 2, 28), dateAvisElectronique: d(2026, 3, 1) })], 'ag-1', {
      opposantsOuDefaillants: 1,
      professionnel: true,
      voie: { demandesVoiePostale: [demandePostale(d(2026, 2, 20))] },
    })
    expect(s5).toMatchObject({ etat: 'calcule', pointDeDepart: d(2026, 3, 2), echeanceSansReport: d(2026, 5, 2) })
  })

  it('notification prouvée mais statut « Notifiée » non enregistré : fin inconnue pour statuts incomplets, pas « non notifié » (sonde S4)', () => {
    const sansNotifiee = chaine().slice(0, 2)
    const notifications = [{ identiteId: 'id-1', courrierId: 'k1', professionnel: true }]
    const resultat = finDelaiContestationAgParDestinataire(sansNotifiee, [courrier()], 'ag-1', { opposantsOuDefaillants: 1, notifications })
    expect(resultat).toMatchObject({ etat: 'refuse', cause: 'statuts_incomplets' })
    expect(resultat.etat === 'refuse' && resultat.motif).toBe(
      "Délai non calculé. Statut « Notifiée » de l'assemblée non enregistré alors que la notification du procès-verbal est prouvée (identité id-1) : l'enregistrer à la date de la notification (décision J2).",
    )
    // aucune notification prouvée : non notifiée, comme avant
    expect(finDelaiContestationAgParDestinataire(sansNotifiee, [courrier({ dateAvisElectronique: null })], 'ag-1', { opposantsOuDefaillants: 1, notifications })).toEqual({
      etat: 'non_notifiee',
    })
    expect(finDelaiContestationAgParDestinataire(sansNotifiee, [], 'ag-1', { opposantsOuDefaillants: 1, notifications: [] })).toEqual({ etat: 'non_notifiee' })
  })
})

/**
 * Relecture du 14/11/2026 (tour 2), sondes N1 et N1b : un courrier déposé, présenté ou avisé avant la ligne qui précède
 * « Notifiée » (« PV signé », ou la dernière ligne avant « Notifiée » si l'étape est sautée, J2) ne notifie pas le
 * procès-verbal de cette assemblée (L. 1965 art. 42, al. 2 : délai « à compter de la notification du procès-verbal » ;
 * D. 1967 art. 17, al. 1 : procès-verbal signé à la fin de la séance ou dans les huit jours suivant la tenue de
 * l'assemblée). Refus courrier_anterieur_au_pv, dans les trois lectures du délai (par destinataire, seule notification,
 * preuve R9).
 */
describe('J50 — relecture du 14/11/2026 (tour 2) : un courrier antérieur au procès-verbal ne le notifie pas', () => {
  /** LRE déposée et avisée le même jour (destinataire professionnel : pas d'avertissement CPCE art. L. 100). */
  const lreLe = (date: string, surcharge: Partial<Courrier> = {}): Courrier => courrier({ dateDepot: date, dateAvisElectronique: date, ...surcharge })
  const seul = [{ identiteId: 'id-1', courrierId: 'k1', professionnel: true }]
  const parDestinataire = (historique: ChangementStatut[], courriers: Courrier[]) =>
    finDelaiContestationAgParDestinataire(historique, courriers, 'ag-1', { opposantsOuDefaillants: 1, notifications: seul })
  const FONDEMENT =
    "il ne peut pas notifier le procès-verbal de cette assemblée, signé après lui (L. 1965 art. 42, al. 2 : délai « à compter de la notification du procès-verbal » ; D. 1967 art. 17, al. 1 : procès-verbal signé à la fin de la séance ou dans les huit jours suivant la tenue de l'assemblée)."
  const motifRefus = (resultat: { etat: string; motif?: string }): string => {
    if (resultat.etat !== 'refuse' || resultat.motif === undefined) throw new Error(`Refus attendu : ${JSON.stringify(resultat)}`)
    return resultat.motif
  }

  it('sonde N1 : LRAR de l’assemblée de l’année précédente rattachée à l’opposant : fin inconnue, cause courrier_anterieur_au_pv', () => {
    // AG 2026 : PV signé le 12/09/2026, notifiée le 20/09/2026 ; LRAR de l'AG 2025 déposée le 15/09/2025, présentée le 17/09/2025
    const ag2026: ChangementStatut[] = [
      ligne({ id: 'c1', statutAncien: 'Projet', statutNouveau: 'Convoquée', dateEffet: d(2026, 8, 20), courrierId: null }),
      ligne({ id: 'c2', statutAncien: 'Convoquée', statutNouveau: 'PV signé', dateEffet: d(2026, 9, 12), courrierId: null }),
      ligne({ id: 'c3', dateEffet: d(2026, 9, 20), courrierId: 'k-old' }),
    ]
    const ancienne = lrar({ id: 'k-old', dateDepot: d(2025, 9, 15), datePremierePresentation: d(2025, 9, 17) })
    const resultat = finDelaiContestationAgParDestinataire(ag2026, [ancienne], 'ag-1', {
      opposantsOuDefaillants: 1,
      notifications: [{ identiteId: 'id-1', courrierId: 'k-old' }],
      voie: { demandesVoiePostale: [creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: d(2024, 1, 10), origine: 'courrier' })] },
    })
    expect(resultat).toMatchObject({ etat: 'refuse', cause: 'courrier_anterieur_au_pv' })
    expect(motifRefus(resultat)).toBe(
      `Délai non calculé. Identité id-1 : Le courrier rattaché (id=k-old) date du 15/09/2025 (dépôt), avant la signature du procès-verbal (12/09/2026) : ${FONDEMENT}`,
    )
    expect(CAUSES_DELAI_NON_CALCULE).toContain('courrier_anterieur_au_pv')
  })

  it('bornes : courrier déposé la veille de la signature du PV refusé, le jour même calculé ; sans dépôt saisi, l’événement compte (sonde N1b)', () => {
    // chaine() : PV signé le 20/02/2026
    const veille = parDestinataire(chaine(), [lreLe(d(2026, 2, 19))])
    expect(veille).toMatchObject({ etat: 'refuse', cause: 'courrier_anterieur_au_pv' })
    expect(motifRefus(veille)).toBe(
      `Délai non calculé. Identité id-1 : Le courrier rattaché (id=k1) date du 19/02/2026 (dépôt), avant la signature du procès-verbal (20/02/2026) : ${FONDEMENT}`,
    )
    expect(parDestinataire(chaine(), [lreLe(d(2026, 2, 20))])).toMatchObject({ etat: 'calcule', echeanceRetenue: d(2026, 4, 21) })
    // sonde N1b : LRE déposée et avisée le 05/01/2026 pour un PV signé le 20/02/2026
    expect(parDestinataire(chaine(), [lreLe(d(2026, 1, 5))])).toMatchObject({ etat: 'refuse', cause: 'courrier_anterieur_au_pv' })
    // dépôt non saisi : la première présentation (LRAR) ou la transmission de l'avis (LRE) compte
    const lrarSansDepot = (presentation: string) => lrar({ dateDepot: null, datePremierePresentation: presentation })
    expect(motifRefus(parDestinataire(chaine(), [lrarSansDepot(d(2026, 2, 19))]))).toContain('date du 19/02/2026 (première présentation), avant la signature')
    expect(parDestinataire(chaine(), [lrarSansDepot(d(2026, 2, 20))])).toMatchObject({ etat: 'calcule', echeanceRetenue: d(2026, 4, 21) })
    const lreSansDepot = courrier({ dateDepot: null, dateAvisElectronique: d(2026, 2, 19) })
    expect(motifRefus(parDestinataire(chaine(), [lreSansDepot]))).toContain("date du 19/02/2026 (transmission de l'avis électronique), avant la signature")
  })

  it('étape « PV signé » sautée (J2) : la borne est la dernière ligne avant « Notifiée »', () => {
    const sautee: ChangementStatut[] = [
      ligne({ id: 'c1', statutAncien: 'Projet', statutNouveau: 'Convoquée', dateEffet: d(2026, 1, 20), courrierId: null }),
      ligne({ id: 'c3', statutAncien: 'Convoquée', horsSequence: true, motif: 'PV signé non saisi dans Gestéam' }),
    ]
    const resultat = parDestinataire(sautee, [lreLe(d(2026, 1, 19))])
    expect(resultat).toMatchObject({ etat: 'refuse', cause: 'courrier_anterieur_au_pv' })
    expect(motifRefus(resultat)).toBe(
      `Délai non calculé. Identité id-1 : Le courrier rattaché (id=k1) date du 19/01/2026 (dépôt), avant le statut « Convoquée » de l'assemblée (20/01/2026) : ${FONDEMENT}`,
    )
  })

  it('même refus pour la seule notification (attestation de non-recours) et pour la preuve R9 ; sans « Notifiée », pas de notification prouvée', () => {
    const ancienne = [lreLe(d(2026, 2, 19))]
    const unique = finDelaiContestationAg(chaine(), ancienne, 'ag-1', { opposantsOuDefaillants: 1, professionnel: true })
    expect(unique).toMatchObject({ etat: 'refuse', cause: 'courrier_anterieur_au_pv' })
    expect(motifRefus(unique)).toBe(
      `Délai non calculé. Le courrier rattaché (id=k1) date du 19/02/2026 (dépôt), avant la signature du procès-verbal (20/02/2026) : ${FONDEMENT}`,
    )
    expect(controlerAttestationNonRecours([unique], d(2026, 6, 1), { assignationsRecues: 0, notificationsAttendues: 1 })).toEqual({
      delivrable: false,
      motif: motifRefus(unique),
    })
    expect(controlerPreuveNotificationAg(chaine(), ancienne, 'ag-1')).toEqual({
      code: 'notification_non_prouvee',
      motif: `Le courrier rattaché (id=k1) date du 19/02/2026 (dépôt), avant la signature du procès-verbal (20/02/2026) : ${FONDEMENT}`,
    })
    // sonde S4 revue : « Notifiée » non enregistré, seul courrier antérieur au PV signé : rien n'est prouvé
    expect(parDestinataire(chaine().slice(0, 2), ancienne)).toEqual({ etat: 'non_notifiee' })
  })

  it('documentation : la cause et ses fondements sont inscrits dans l’en-tête de statut-assemblee.ts', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'statut-assemblee.ts'), 'utf8').replaceAll(
      /\r?\n\s*\* */g,
      ' ',
    )
    const rubrique = source.slice(source.indexOf('Décisions de Hugo du 11/11/2026'))
    expect(rubrique).toContain('courrier_anterieur_au_pv')
    expect(rubrique).toContain('D. 1967 art. 17, al. 1')
  })
})

describe('J50 — forme d’envoi d’une notification selon le mode VitFix (gabarits-courrier.ts)', () => {
  it('mode incohérent avec la forme d’envoi : message propre, pas « Envoi simple » (sonde P8)', () => {
    const [incoherent] = controlerFormeEnvoi('protocole_apurement_caducite', 'AR', { voie: 'electronique', modeNotification: 'lre' })
    expect(incoherent).toEqual({
      code: 'envoi_non_qualifie',
      gravite: 'bloquant',
      message:
        "Mode de notification « lre » incohérent avec la forme d'envoi « AR » (LRAR en « AR » seulement, envoi électronique hors « AR ») : il ne vaut pas notification ; corriger le mode ou la forme (D. 1967 art. 64, 64-1).",
    })
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'Email', { voie: null, modeNotification: 'lrar' }).map((a) => a.message)).toContainEqual(
      expect.stringMatching(/^Mode de notification « lrar » incohérent avec la forme d'envoi « Email »/),
    )
    // sans mode, un envoi hors « AR » reste un envoi simple
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'Email', { voie: 'electronique' })[0].message).toMatch(/^Envoi simple : il ne vaut pas notification/)
  })

  it('voie électronique : LRE ou prestataire qualifié valables ; voie postale : LRAR exigée ; mode incohérent : envoi non qualifié', () => {
    for (const modeNotification of ['lre', 'prestataire_qualifie'] as const) {
      expect(controlerFormeEnvoi('convocation_ag_vpc', 'Email', { voie: 'electronique', modeNotification })).toEqual([])
      expect(controlerFormeEnvoi('convocation_ag_vpc', 'Email', { voie: 'postale', modeNotification })).toMatchObject([{ code: 'lrar_requise', gravite: 'bloquant' }])
      expect(controlerFormeEnvoi('convocation_ag_vpc', 'Email', { voie: null, modeNotification }).map((a) => a.code)).toEqual(['voie_inconnue'])
    }
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'AR', { voie: 'electronique', modeNotification: 'lrar' })).toMatchObject([{ code: 'lrar_hors_demande' }])
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'AR', { voie: 'electronique', modeNotification: 'lre' })).toMatchObject([{ code: 'envoi_non_qualifie' }])
    // sans mode : comportement inchangé
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'Email', { voie: 'electronique' })).toMatchObject([{ code: 'envoi_non_qualifie' }])
  })
})

describe('J50 — documentation : rubrique « Décisions de Hugo du 11/11/2026 » et sources', () => {
  const lire = (fichier: string) =>
    readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', fichier), 'utf8').replaceAll(/\r?\n\s*\* */g, ' ')

  it('statut-assemblee.ts : J50 inscrite avec ses textes, ses cas limites et ses marques d’incertitude', () => {
    const source = lire('statut-assemblee.ts')
    const rubrique = source.slice(source.indexOf('Décisions de Hugo du 11/11/2026'))
    for (const attendu of [
      'J50',
      '« Oui, calcul électronique »',
      'décret du 22/12/2025',
      'D. 1967 art. 64, dernier al.',
      'D. 1967 art. 64-1, al. 2',
      'D. 1967 art. 18',
      'la plus tardive',
      'art. 64-4',
      '« par tout moyen »',
      'CPCE art. L. 100',
      'minimale',
      'Cass. 3e civ., 16/04/2026, n° 24-18.842',
      'aucune jurisprudence',
      'à confirmer',
    ])
      expect(rubrique, attendu).toContain(attendu)
    // l'arrêt du 16/04/2026 a été lu sur Légifrance le 11/11/2026
    expect(DELAI_CONTESTATION_AG_ART42.jurisprudence[0]).toMatchObject({ verification: 'TEXTE_LU' })
    expect(DELAI_CONTESTATION_AG_ART42.note).toMatch(/transmission de l'avis électronique/)
  })

  it('courriers.ts et voie-notification.ts : le mode de notification et la reprise des refus d’avant le 25/12/2025 sont décrits', () => {
    const courriers = lire('courriers.ts')
    expect(courriers).toContain('Décisions de Hugo du 11/11/2026')
    expect(courriers).toContain('modeNotification')
    expect(courriers).toContain('FORME_ENVOI_COURRIER ne change pas')
    const voieNotification = lire('voie-notification.ts')
    expect(voieNotification).toContain('Décisions de Hugo du 11/11/2026')
    expect(voieNotification).not.toContain("à l'import, ils ne deviennent pas des demandes de voie postale")
    expect(voieNotification).not.toContain("accord exprès de l'ancien art. 64-2")
    expect(voieNotification).toContain('art. 64-3 de la rédaction')
  })

  it('relecture du 14/11/2026 : en-têtes corrigés (fondements datés, L. 100 en question ouverte, mode incohérent, avis selon le mode)', () => {
    const voieNotification = lire('voie-notification.ts')
    const decisions = voieNotification.slice(voieNotification.indexOf('Décisions de Hugo du 11/11/2026'), voieNotification.indexOf('🔵 Déduit'))
    expect(decisions.length).toBeGreaterThan(0)
    // le consentement de CPCE art. L. 100 n'est pas une décision de Hugo : question ouverte
    expect(decisions).not.toContain('L. 100')
    const nonEtabli = voieNotification.slice(voieNotification.indexOf('🔴 Non établi'))
    expect(nonEtabli).toContain('CPCE art. L. 100')
    expect(nonEtabli).toContain('question ouverte à Hugo')
    // l'accord exprès ne venait de la loi que jusqu'au 10/04/2024
    expect(voieNotification).not.toContain("l'accord exprès exigé pour une notification électronique faite du 04/07/2020 au 24/12/2025 venait de la loi")
    expect(decisions).toContain('dernier état')
    const courriers = lire('courriers.ts')
    expect(courriers).toContain('motifCorrection')
    expect(courriers).not.toContain('lue sur son justificatif de transmission : D. 1967 art. 64-5')
    const gabarits = lire('gabarits-courrier.ts')
    expect(gabarits).not.toContain('seule une forme sans mode de notification reste « envoi_non_qualifie »')
    const statut = lire('statut-assemblee.ts')
    expect(statut).toContain('date du dépôt')
    expect(statut).toContain('destinataire_non_renseigne')
  })
})
