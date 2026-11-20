import { describe, expect, it } from 'vitest'
import { controlerVoieNotification } from '@/lib/administrateur-judiciaire/domain/controle-voie-notification'
import { departDelaiNotification } from '@/lib/administrateur-judiciaire/domain/courriers'
import { composerDateIso as d } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Fiche360Copropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import { calculerVeilleFixy, type DossierImpayeFixy } from '@/lib/administrateur-judiciaire/domain/fixy/veille'
import {
  analyserRecouvrement,
  exigibiliteAnticipee,
  type CourrierMiseEnDemeure,
  type VoieDebiteur,
} from '@/lib/administrateur-judiciaire/domain/recouvrement'
import { finDelaiContestationAg } from '@/lib/administrateur-judiciaire/domain/statut-assemblee'
import { creerConsentementVoieElectronique, creerDemandeVoiePostale } from '@/lib/administrateur-judiciaire/domain/voie-notification'
import { chaineLe, lreLe } from './donnees-delai-contestation'

/**
 * Trente jours de l'art. 19-2 (L. 1965) : ils partent du lendemain de la première présentation de la mise en demeure
 * (D. 1967 art. 64-1, al. 2 ; J3, même fonction que J1), ou du lendemain de la transmission de l'avis électronique
 * (art. 64, dernier al. ; J50) ; jamais de la date où l'étape « mise en demeure » est enregistrée.
 */

/** Mise en demeure par LRAR déposée le 11/05/2026 ; `surcharge` la modifie. */
const lrar = (surcharge: Partial<CourrierMiseEnDemeure> = {}): CourrierMiseEnDemeure => ({
  formeEnvoi: 'AR',
  modeNotification: 'lrar',
  dateDepot: d(2026, 5, 11),
  datePremierePresentation: d(2026, 5, 12),
  dateAvisElectronique: null,
  ...surcharge,
})

/** Mise en demeure par LRE déposée et avisée le 05/03/2026. */
const lre = (surcharge: Partial<CourrierMiseEnDemeure> = {}): CourrierMiseEnDemeure => ({
  formeEnvoi: 'Email',
  modeNotification: 'lre',
  dateDepot: d(2026, 3, 5),
  datePremierePresentation: null,
  dateAvisElectronique: d(2026, 3, 5),
  ...surcharge,
})

const alerteDe = (courrier: CourrierMiseEnDemeure | null): string => {
  const resultat = exigibiliteAnticipee(courrier)
  if (resultat.etat !== 'non_calculable') throw new Error(`Exigibilité non calculable attendue : ${JSON.stringify(resultat)}`)
  return resultat.alerte
}

describe('art. 19-2 : départ le lendemain de la première présentation (J3, même fonction que J1)', () => {
  it('présentée le 12/05/2026 : départ le 13/05 (jour 0), trentième jour le 12/06, exigibilité à partir du 13/06/2026', () => {
    expect(exigibiliteAnticipee(lrar())).toMatchObject({
      etat: 'calculee',
      mode: 'lrar',
      dateEvenement: d(2026, 5, 12),
      pointDeDepart: d(2026, 5, 13),
      trentiemeJour: d(2026, 6, 12),
      exigibleLe: d(2026, 6, 13),
    })
  })

  it('la justification se lit en toutes lettres ; la borne reste à confirmer, le report est tranché (J67, R41)', () => {
    const resultat = exigibiliteAnticipee(lrar())
    if (resultat.etat !== 'calculee') throw new Error('calcul attendu')
    expect(resultat.justification).toBe(
      'Trente jours à compter du lendemain de la première présentation du 12/05/2026 (départ le 13/05/2026) : trentième jour le 12/06/2026, exigibilité anticipée à partir du 13/06/2026 — L. 1965 art. 19-2 ; D. 1967 art. 64-1, al. 2.',
    )
    expect(resultat.aConfirmer).toMatch(/Borne à confirmer :/)
    expect(resultat.aConfirmer).toMatch(/passé un délai de trente jours/)
    expect(resultat.aConfirmer).not.toMatch(/CPC art\. 642/)
    expect(resultat.aConfirmer).not.toMatch(/non appliqué/)
  })

  it('pli retiré ou non : même exigibilité (seule la première présentation compte)', () => {
    expect(exigibiliteAnticipee(lrar({ dateAccuseReception: d(2026, 5, 20) }))).toEqual(exigibiliteAnticipee(lrar()))
  })

  it('passage de mois et d’année : présentée le 15/12/2026, exigibilité à partir du 16/01/2027', () => {
    expect(exigibiliteAnticipee(lrar({ dateDepot: d(2026, 12, 14), datePremierePresentation: d(2026, 12, 15) }))).toMatchObject({
      trentiemeJour: d(2027, 1, 15),
      exigibleLe: d(2027, 1, 16),
    })
  })

  it('même fonction de domaine que le délai de contestation de l’AG : même point de départ pour le même courrier', () => {
    const courrier = lreLe(d(2026, 3, 5))
    const ag = finDelaiContestationAg(chaineLe(d(2026, 3, 5)), [courrier], 'ag-1', { opposantsOuDefaillants: 1, professionnel: true, voie: {} })
    const depart = departDelaiNotification(courrier)
    expect(depart).toEqual({ etat: 'calculable', mode: 'lre', evenement: d(2026, 3, 5), pointDeDepart: d(2026, 3, 6) })
    expect(ag).toMatchObject({ etat: 'calcule', pointDeDepart: d(2026, 3, 6) })
    expect(exigibiliteAnticipee(courrier)).toMatchObject({ etat: 'calculee', pointDeDepart: d(2026, 3, 6) })
  })
})

describe('art. 19-2 : voie électronique, départ le lendemain de la transmission de l’avis (J50)', () => {
  it('LRE avisée le 05/03/2026 : départ le 06/03, trentième jour le dimanche 05/04 (Pâques), reporté au mardi 07/04 (lundi de Pâques férié), exigibilité à partir du 08/04/2026', () => {
    const resultat = exigibiliteAnticipee(lre())
    expect(resultat).toMatchObject({
      etat: 'calculee',
      mode: 'lre',
      pointDeDepart: d(2026, 3, 6),
      trentiemeJour: d(2026, 4, 5),
      finAvecReport: d(2026, 4, 7),
      divergence: true,
      exigibleLe: d(2026, 4, 8),
    })
    if (resultat.etat !== 'calculee') throw new Error('calcul attendu')
    expect(resultat.justification).toContain("lendemain de la transmission de l'avis électronique du 05/03/2026")
    expect(resultat.justification).toContain('D. 1967 art. 64, dernier al.')
  })

  it('prestataire qualifié : même règle', () => {
    expect(exigibiliteAnticipee(lre({ formeEnvoi: 'Email direct', modeNotification: 'prestataire_qualifie' }))).toMatchObject({
      mode: 'prestataire_qualifie',
      exigibleLe: d(2026, 4, 8),
    })
  })
})

describe('art. 19-2 : fin un samedi, un dimanche ou un jour férié, report au premier jour ouvrable (J67, R41)', () => {
  it('présentée le 13/05/2026 : trentième jour le samedi 13/06, fin avec report le lundi 15/06, exigibilité à partir du mardi 16/06/2026', () => {
    const resultat = exigibiliteAnticipee(lrar({ dateDepot: d(2026, 5, 12), datePremierePresentation: d(2026, 5, 13) }))
    expect(resultat).toMatchObject({
      etat: 'calculee',
      pointDeDepart: d(2026, 5, 14),
      trentiemeJour: d(2026, 6, 13),
      finAvecReport: d(2026, 6, 15),
      divergence: true,
      exigibleLe: d(2026, 6, 16),
    })
    if (resultat.etat !== 'calculee') throw new Error('calcul attendu')
    // les deux fins sont écrites quand elles diffèrent (R41, comme J1)
    expect(resultat.justification).toBe(
      'Trente jours à compter du lendemain de la première présentation du 13/05/2026 (départ le 14/05/2026) : trentième jour le 13/06/2026 (fin sans report), reporté au premier jour ouvrable, le 15/06/2026 (fin avec report) ; exigibilité anticipée à partir du 16/06/2026, lendemain de la fin avec report — L. 1965 art. 19-2 ; D. 1967 art. 64-1, al. 2 ; CPC art. 642 (J67, R41).',
    )
  })

  it('le jour où tombe la fin sans report, l’exigibilité n’est pas encore acquise : elle l’est le lendemain de la fin avec report', () => {
    const courrier = lrar({ dateDepot: d(2026, 5, 12), datePremierePresentation: d(2026, 5, 13) })
    for (const [jour, attendu] of [
      [d(2026, 6, 14), 2],
      [d(2026, 6, 15), 1],
      [d(2026, 6, 16), 0],
    ] as const)
      expect(analyserRecouvrement('mise_en_demeure:2026-05-12', jour, null, courrier).joursAvantExigibilite, jour).toBe(attendu)
  })

  it('présentée le 13/06/2026 : trentième jour le 14/07 (jour férié), fin avec report le 15/07, exigibilité à partir du 16/07/2026', () => {
    expect(exigibiliteAnticipee(lrar({ dateDepot: d(2026, 6, 12), datePremierePresentation: d(2026, 6, 13) }))).toMatchObject({
      trentiemeJour: d(2026, 7, 14),
      finAvecReport: d(2026, 7, 15),
      divergence: true,
      exigibleLe: d(2026, 7, 16),
    })
  })

  it('fin un jour ouvrable : une seule date, pas de divergence', () => {
    expect(exigibiliteAnticipee(lrar())).toMatchObject({ trentiemeJour: d(2026, 6, 12), finAvecReport: d(2026, 6, 12), divergence: false })
  })
})

describe('art. 19-2 : date mal formée sur le courrier, « non calculable » sans lever d’erreur', () => {
  it('première présentation, avis électronique ou dépôt invalide : alerte « à corriger d’après le justificatif »', () => {
    for (const courrier of [
      lrar({ datePremierePresentation: '12/05/2026' }),
      lrar({ datePremierePresentation: '2026-02-30' }),
      lre({ dateAvisElectronique: '2026-13-01' }),
      lrar({ dateDepot: '11/05/2026' }),
    ]) {
      const alerte = alerteDe(courrier)
      expect(alerte).toMatch(/invalide/)
      expect(alerte).toMatch(/à corriger d'après le justificatif/)
    }
  })

  it('analyserRecouvrement ne lève pas : le panneau de recouvrement reste lisible', () => {
    const analyse = analyserRecouvrement('mise_en_demeure:2026-05-12', '2026-06-04', null, lrar({ datePremierePresentation: '12/05/2026' }))
    expect(analyse.exigibiliteLe).toBeNull()
    expect(analyse.exigibilite).toMatchObject({ etat: 'non_calculable' })
  })
})

describe('art. 19-2 : voie de notification du débiteur (« notifications et mises en demeure », L. 1965 art. 42-1 ; J50, J52, J53)', () => {
  const debiteur = (surcharge: Partial<VoieDebiteur> = {}): VoieDebiteur => ({ identiteId: 'id-1', professionnel: false, ...surcharge })
  const lreDu = (date: string) => lre({ dateDepot: date, dateAvisElectronique: date })
  const alerteAvecVoie = (courrier: CourrierMiseEnDemeure, voie: VoieDebiteur): string => {
    const resultat = exigibiliteAnticipee(courrier, voie)
    if (resultat.etat !== 'non_calculable') throw new Error(`Exigibilité non calculable attendue : ${JSON.stringify(resultat)}`)
    return resultat.alerte
  }

  it('voie non fournie : date calculée, avec la réserve « voie non contrôlée » (J52, J53)', () => {
    const resultat = exigibiliteAnticipee(lrar())
    if (resultat.etat !== 'calculee') throw new Error('calcul attendu')
    expect(resultat.avertissements).toEqual([expect.stringMatching(/^Voie de notification du débiteur non contrôlée.*J52.*J53/)])
  })

  it('J53 : LRE à un débiteur non professionnel sans consentement enregistré, elle ne fait pas courir les trente jours', () => {
    const alerte = alerteAvecVoie(lreDu(d(2026, 3, 5)), debiteur())
    expect(alerte).toMatch(/^Exigibilité anticipée non calculable/)
    expect(alerte).toMatch(/CPCE art\. L\. 100/)
    expect(alerte).toMatch(/J53/)
    // qualité non saisie : lue comme non professionnelle
    expect(alerteAvecVoie(lreDu(d(2026, 3, 5)), debiteur({ professionnel: null }))).toMatch(/J53/)
  })

  it('J53 : avec le consentement enregistré, ou pour un débiteur professionnel, la date est calculée sans réserve', () => {
    const consentements = [creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'accord', recuLe: d(2026, 1, 10) })]
    for (const voie of [debiteur({ consentements }), debiteur({ professionnel: true })])
      expect(exigibiliteAnticipee(lreDu(d(2026, 3, 5)), voie)).toMatchObject({ etat: 'calculee', avertissements: [] })
  })

  it('J53 : débiteur non renseigné, le consentement ne peut pas lui être rapproché', () => {
    expect(alerteAvecVoie(lreDu(d(2026, 3, 5)), debiteur({ identiteId: null }))).toMatch(/Destinataire du courrier rattaché non renseigné/)
  })

  it('J52 : demande de voie postale reçue avant le 25/12/2025, la LRE envoyée depuis ne vaut pas notification', () => {
    const demandesVoiePostale = [creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: d(2025, 12, 1), origine: 'courrier' })]
    const alerte = alerteAvecVoie(lreDu(d(2026, 3, 5)), debiteur({ professionnel: true, demandesVoiePostale }))
    expect(alerte).toMatch(/Voie postale demandée par ce copropriétaire/)
    expect(alerte).toMatch(/J52/)
  })

  it('J50 : LRAR sans demande de voie postale reçue, date calculée avec l’avertissement ; avec la demande, sans réserve', () => {
    const sans = exigibiliteAnticipee(lrar(), debiteur())
    expect(sans).toMatchObject({ etat: 'calculee', exigibleLe: d(2026, 6, 13) })
    if (sans.etat !== 'calculee') throw new Error('calcul attendu')
    expect(sans.avertissements).toEqual([expect.stringMatching(/^LRAR sans demande de voie postale enregistrée/)])
    const demandesVoiePostale = [creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: d(2026, 1, 5), origine: 'courrier' })]
    expect(exigibiliteAnticipee(lrar(), debiteur({ demandesVoiePostale }))).toMatchObject({ etat: 'calculee', avertissements: [] })
  })

  it('analyserRecouvrement transmet la voie du débiteur', () => {
    const analyse = analyserRecouvrement('mise_en_demeure:2026-03-05', '2026-04-20', null, lreDu(d(2026, 3, 5)), debiteur())
    expect(analyse.exigibiliteLe).toBeNull()
    expect(analyse.exigibilite).toMatchObject({ etat: 'non_calculable', alerte: expect.stringMatching(/J53/) })
  })

  it('même contrôle de voie que le délai de contestation de l’AG (fonction partagée)', () => {
    expect(controlerVoieNotification('lre', d(2026, 3, 5), 'id-1', false, {})).toMatchObject({ cause: 'consentement_lre_absent' })
    const ag = finDelaiContestationAg(chaineLe(d(2026, 3, 5)), [lreLe(d(2026, 3, 5))], 'ag-1', { opposantsOuDefaillants: 1, professionnel: false, voie: {} })
    expect(ag).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
  })
})

describe('art. 19-2 : date de présentation ou d’avis inconnue, aucune date d’exigibilité', () => {
  it('sans courrier rattaché : alerte « date de présentation à saisir »', () => {
    const alerte = alerteDe(null)
    expect(alerte).toMatch(/^Exigibilité anticipée non calculable/)
    expect(alerte).toMatch(/date de première présentation .* à saisir/)
    expect(alerte).toMatch(/transmission de l'avis électronique/)
    expect(alerte).toMatch(/jamais de la date de l'étape/)
  })

  it('LRAR sans première présentation saisie, LRE sans avis saisi : la date manquante est nommée', () => {
    expect(alerteDe(lrar({ datePremierePresentation: null }))).toMatch(/date de première présentation de la mise en demeure à saisir \(D\. 1967 art\. 64-1, al\. 2\)/)
    expect(alerteDe(lre({ dateAvisElectronique: null }))).toMatch(/date de transmission de l'avis électronique de la mise en demeure à saisir \(D\. 1967 art\. 64, dernier al\.\)/)
  })

  it('envoi simple (ni LRAR ni envoi électronique qualifié) : il ne fait pas courir les trente jours', () => {
    expect(alerteDe(lrar({ formeEnvoi: 'Normal', modeNotification: null }))).toMatch(
      /ni une lettre recommandée avec avis de réception ni une notification électronique.*D\. 1967 art\. 64 et 64-1/,
    )
  })

  it('avis électronique saisi avant le dépôt : pas une preuve, à corriger', () => {
    expect(alerteDe(lre({ dateAvisElectronique: d(2026, 3, 4) }))).toMatch(/précède le dépôt de l'envoi \(05\/03\/2026\)/)
  })
})

describe('analyserRecouvrement : l’étape enregistrée ne fait plus courir les trente jours', () => {
  it('sans courrier : ni exigibiliteLe ni compte à rebours, l’alerte est rendue (jamais la date du clic + 30 jours)', () => {
    const analyse = analyserRecouvrement('mise_en_demeure:2026-05-12', '2026-06-04')
    expect(analyse.exigibiliteLe).toBeNull()
    expect(analyse.joursAvantExigibilite).toBeNull()
    expect(analyse.exigibilite).toEqual({ etat: 'non_calculable', alerte: alerteDe(null) })
  })

  it('avec le courrier : exigibilité lue sur lui, quelle que soit la date de l’étape', () => {
    const analyse = analyserRecouvrement('mise_en_demeure:2026-05-02', '2026-06-04', null, lrar())
    expect(analyse.depuis).toBe('2026-05-02')
    expect(analyse.exigibiliteLe).toBe('2026-06-13')
    expect(analyse.joursAvantExigibilite).toBe(9)
    expect(analyse.exigibilite).toEqual(exigibiliteAnticipee(lrar()))
  })

  it('hors étape « mise en demeure » : aucune exigibilité à calculer, aucune alerte', () => {
    for (const statut of ['amiable', 'exigibilite:2026-06-01', 'procedure:2026-01-01', 'solde:2026-06-01', null])
      expect(analyserRecouvrement(statut, '2026-06-04', null, lrar())).toMatchObject({ exigibiliteLe: null, joursAvantExigibilite: null, exigibilite: null })
  })
})

describe('veille de Fixy : le rappel « exigibilité » part du courrier de mise en demeure, jamais de la date de l’étape (J3)', () => {
  // Fiche réduite à ce que lit la veille du recouvrement (vue, échéances, débiteurs).
  const fiche = {
    vue: { id: 'C1', code: 'TL', nom: 'Résidence des Tilleuls' },
    echeances: { echeances: [] },
    debiteurs: [{ id: 'P1', nom: 'Débiteur A', solde: -120_000 }],
  } as unknown as Fiche360Copropriete
  const courrier = lrar({ dateDepot: d(2026, 5, 12), datePremierePresentation: d(2026, 5, 13) })
  const rappelExig = (impaye: DossierImpayeFixy, reference: string) =>
    calculerVeilleFixy({ reference, fiches: [fiche], impayes: [impaye], piecesRecues: [], nbPieces: 0 }).find((r) => r.id === 'exig:P1')

  it('étape enregistrée le 02/05, mise en demeure présentée le 13/05 : rappel à partir du 16/06/2026, texte daté de la présentation', () => {
    const impaye = { coproprietaireId: 'P1', statut: 'mise_en_demeure:2026-05-02', miseEnDemeure: courrier }
    expect(rappelExig(impaye, d(2026, 6, 15))).toBeUndefined()
    const rappel = rappelExig(impaye, d(2026, 6, 16))
    expect(rappel?.texte).toBe(
      "Résidence des Tilleuls · Débiteur A : trente jours écoulés depuis la mise en demeure (première présentation le 13/05/2026), sans paiement enregistré ; exigibilité anticipée à partir du 16/06/2026. Constater l'exigibilité anticipée ?",
    )
    expect(rappel?.texte).not.toContain('02/05/2026')
  })

  it('étape sans date lisible : le rappel part quand même, d’après le courrier', () => {
    expect(rappelExig({ coproprietaireId: 'P1', statut: 'mise_en_demeure', miseEnDemeure: courrier }, d(2026, 6, 16))).toBeDefined()
  })

  it('sans courrier rattaché : aucun rappel (comme aujourd’hui, l’impayé ne porte pas le courrier)', () => {
    expect(rappelExig({ coproprietaireId: 'P1', statut: 'mise_en_demeure:2026-05-02' }, d(2026, 7, 16))).toBeUndefined()
  })
})
