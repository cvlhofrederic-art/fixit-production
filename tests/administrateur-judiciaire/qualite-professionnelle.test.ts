import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import { composerDateIso as d } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  avecQualiteProfessionnelleALEnvoi,
  changerQualiteProfessionnelle,
  qualiteProfessionnelleA,
  qualiteProfessionnelleALEnvoi,
  type EtatQualiteProfessionnelle,
  type IdentiteQualiteDatee,
} from '@/lib/administrateur-judiciaire/domain/qualite-professionnelle'
import { dateEnvoiCourrierNotification, finDelaiContestationAgParDestinataire } from '@/lib/administrateur-judiciaire/domain/statut-assemblee'
import { chaineLe, lreLe } from './donnees-delai-contestation'

/**
 * J78 — case « professionnel » datée, codée avec la table des identités (décisions du 19/11/2026, à valider par
 * Frédéric avant toute fusion) : cochée seulement sur une justification écrite ; lue à la date de l'envoi (le dépôt s'il
 * est saisi, sinon l'événement, telle que le code de J50 la calcule : dateEnvoiCourrierNotification, extraite
 * d'evaluerNotification) ; décocher plus tard ne change pas les envois déjà faits. Un changement prend effet le
 * lendemain de sa saisie : un envoi du jour même est relu avec l'état d'avant, coché comme décoché. Données fictives.
 */

const JUSTIFICATION = 'Société qui reçoit l’envoi pour son activité (SIREN 000 000 000, exemple fictif)'

/** Identité dont la case a été saisie, dans l'ordre, aux jours donnés. */
function saisie(...etats: [boolean, string][]): IdentiteQualiteDatee {
  let identite: IdentiteQualiteDatee = { id: 'id-1' }
  for (const [professionnel, jour] of etats)
    identite = {
      ...identite,
      ...changerQualiteProfessionnelle(identite, { professionnel, justification: professionnel ? JUSTIFICATION : null }, { aujourdhui: jour }),
    }
  return identite
}

describe('changerQualiteProfessionnelle : cochée sur justification écrite, états datés ajoutés à la suite', () => {
  it('cocher sans justification écrite : refusé', () => {
    for (const justification of [null, undefined, '', '   '])
      expect(() => changerQualiteProfessionnelle({}, { professionnel: true, justification }, { aujourdhui: d(2026, 3, 1) }), String(justification)).toThrow(
        /justification écrite/,
      )
  })

  it('cocher avec justification : état ajouté, effet le lendemain de la saisie ; la case sans date suit le dernier état saisi', () => {
    const resultat = changerQualiteProfessionnelle({}, { professionnel: true, justification: `  ${JUSTIFICATION}  `, documentId: 'ged-1' }, { aujourdhui: d(2026, 3, 1) })
    expect(resultat).toEqual({
      professionnel: true,
      historiqueProfessionnel: [{ professionnel: true, saisiLe: d(2026, 3, 1), du: d(2026, 3, 2), justification: JUSTIFICATION, documentId: 'ged-1' }],
    })
  })

  it('décocher : justification facultative ; les états précédents ne sont jamais réécrits', () => {
    const cochee = saisie([true, d(2026, 3, 1)])
    const precedent = cochee.historiqueProfessionnel?.[0]
    const resultat = changerQualiteProfessionnelle(cochee, { professionnel: false }, { aujourdhui: d(2026, 3, 10) })
    expect(resultat.professionnel).toBe(false)
    expect(resultat.historiqueProfessionnel).toEqual([
      precedent,
      { professionnel: false, saisiLe: d(2026, 3, 10), du: d(2026, 3, 11), justification: null, documentId: null },
    ])
    // l'identité reçue n'est pas modifiée
    expect(cochee.historiqueProfessionnel).toHaveLength(1)
  })

  it('saisie datée avant le dernier état : refusée ; valeur non booléenne, date invalide : refusées', () => {
    const cochee = saisie([true, d(2026, 3, 10)])
    expect(() => changerQualiteProfessionnelle(cochee, { professionnel: false }, { aujourdhui: d(2026, 3, 9) })).toThrow(/antérieure au dernier état/)
    expect(() =>
      changerQualiteProfessionnelle({}, { professionnel: 'oui' as unknown as boolean, justification: JUSTIFICATION }, { aujourdhui: d(2026, 3, 1) }),
    ).toThrow(/cochée ou décochée attendue/)
    expect(() => changerQualiteProfessionnelle({}, { professionnel: false }, { aujourdhui: '2026-02-30' })).toThrow(/AAAA-MM-JJ/)
  })
})

describe('qualiteProfessionnelleA : lecture à une date', () => {
  it('décocher plus tard ne change pas la lecture des jours passés', () => {
    const identite = saisie([true, d(2026, 3, 1)], [false, d(2026, 3, 10)])
    expect(qualiteProfessionnelleA(identite, d(2026, 3, 1))).toBe(false) // jour de la saisie : état d'avant (aucun)
    expect(qualiteProfessionnelleA(identite, d(2026, 3, 2))).toBe(true)
    expect(qualiteProfessionnelleA(identite, d(2026, 3, 10))).toBe(true) // jour du décochage : état d'avant
    expect(qualiteProfessionnelleA(identite, d(2026, 3, 11))).toBe(false)
  })

  it('changement saisi le jour d’un envoi : la lecture de ce jour ne change pas, coché comme décoché', () => {
    const J = d(2026, 3, 5)
    // envoi du jour J, case cochée depuis le 01/03, puis décochée le jour J : l'envoi reste lu professionnel
    const avant = saisie([true, d(2026, 3, 1)])
    const decocheeLeJour = saisie([true, d(2026, 3, 1)], [false, J])
    expect(qualiteProfessionnelleA(decocheeLeJour, J)).toBe(qualiteProfessionnelleA(avant, J))
    // envoi du jour J, case jamais cochée, puis cochée le jour J : l'envoi reste lu non professionnel
    expect(qualiteProfessionnelleA(saisie([true, J]), J)).toBe(qualiteProfessionnelleA({ id: 'id-1' }, J))
    expect(qualiteProfessionnelleA(saisie([true, J]), J)).toBe(false)
  })

  it('deux saisies le même jour : la dernière l’emporte, à compter du lendemain', () => {
    const identite = saisie([true, d(2026, 3, 5)], [false, d(2026, 3, 5)])
    expect(qualiteProfessionnelleA(identite, d(2026, 3, 6))).toBe(false)
    expect(saisie([false, d(2026, 3, 5)], [true, d(2026, 3, 5)]).professionnel).toBe(true)
    expect(qualiteProfessionnelleA(saisie([false, d(2026, 3, 5)], [true, d(2026, 3, 5)]), d(2026, 3, 6))).toBe(true)
  })

  it('identité absente : null ; aucun état à la date : false ; case cochée sans état daté (écrite hors application) : false', () => {
    expect(qualiteProfessionnelleA(null, d(2026, 3, 1))).toBeNull()
    expect(qualiteProfessionnelleA(undefined, d(2026, 3, 1))).toBeNull()
    expect(qualiteProfessionnelleA({ id: 'id-1' }, d(2026, 3, 1))).toBe(false)
    expect(qualiteProfessionnelleA({ id: 'id-1', professionnel: true }, d(2026, 3, 1))).toBe(false)
    expect(() => qualiteProfessionnelleA({ id: 'id-1' }, '05/03/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('état enregistré invalide (base, reprise) : lecture prudente de J53, non professionnelle', () => {
    const invalide = (etat: Partial<EtatQualiteProfessionnelle> | null): IdentiteQualiteDatee => ({
      id: 'id-1',
      historiqueProfessionnel: [
        { professionnel: true, saisiLe: d(2026, 1, 1), du: d(2026, 1, 2), justification: JUSTIFICATION, documentId: null },
        etat as EtatQualiteProfessionnelle,
      ],
    })
    expect(qualiteProfessionnelleA(invalide({ professionnel: 'oui' as unknown as boolean, saisiLe: d(2026, 2, 1), du: d(2026, 2, 2) }), d(2026, 3, 1))).toBe(false)
    expect(qualiteProfessionnelleA(invalide({ professionnel: false, saisiLe: d(2026, 2, 1), du: 'pas-une-date' }), d(2026, 3, 1))).toBe(false)
    expect(qualiteProfessionnelleA(invalide(null), d(2026, 3, 1))).toBe(false)
    // états dans le désordre (le second avant le premier)
    expect(qualiteProfessionnelleA(invalide({ professionnel: true, saisiLe: d(2025, 12, 1), du: d(2025, 12, 2) }), d(2026, 3, 1))).toBe(false)
    expect(qualiteProfessionnelleA({ id: 'id-1', historiqueProfessionnel: 'x' as unknown as EtatQualiteProfessionnelle[] }, d(2026, 3, 1))).toBe(false)
  })
})

describe('date de l’envoi : celle du code de J50 (dateEnvoiCourrierNotification, extraite d’evaluerNotification)', () => {
  it('dépôt saisi qui ne suit pas l’événement : le dépôt ; sans dépôt : l’événement ; dépôt après l’événement : l’événement', () => {
    expect(dateEnvoiCourrierNotification(lreLe(d(2026, 3, 5), { dateDepot: d(2026, 3, 3) }))).toBe(d(2026, 3, 3))
    expect(dateEnvoiCourrierNotification(lreLe(d(2026, 3, 5), { dateDepot: null }))).toBe(d(2026, 3, 5))
    const lrar = { formeEnvoi: 'AR' as const, modeNotification: 'lrar' as const, dateAvisElectronique: null, datePremierePresentation: d(2026, 3, 5) }
    expect(dateEnvoiCourrierNotification(lreLe(d(2026, 3, 5), { ...lrar, dateDepot: d(2026, 3, 3) }))).toBe(d(2026, 3, 3))
    expect(dateEnvoiCourrierNotification(lreLe(d(2026, 3, 5), { ...lrar, dateDepot: d(2026, 3, 7) }))).toBe(d(2026, 3, 5))
  })

  it('notification non prouvée (avis ou présentation non saisis, envoi non qualifié) : null', () => {
    expect(dateEnvoiCourrierNotification(lreLe(d(2026, 3, 5), { dateAvisElectronique: null }))).toBeNull()
    expect(dateEnvoiCourrierNotification(lreLe(d(2026, 3, 5), { formeEnvoi: 'Normal', modeNotification: null }))).toBeNull()
  })
})

describe('qualité à la date de l’envoi, pour le contrôle J53', () => {
  const cocheeLe = (jour: string) => saisie([true, jour])

  it('qualiteProfessionnelleALEnvoi : lue à la date de l’envoi (dépôt saisi, sinon événement) ; identité absente ou envoi non prouvé : null', () => {
    const identite = cocheeLe(d(2026, 3, 3)) // effet le 04/03
    expect(qualiteProfessionnelleALEnvoi(identite, lreLe(d(2026, 3, 5), { dateDepot: d(2026, 3, 3) }))).toBe(false) // dépôt du jour de la saisie
    expect(qualiteProfessionnelleALEnvoi(identite, lreLe(d(2026, 3, 5), { dateDepot: d(2026, 3, 4) }))).toBe(true)
    expect(qualiteProfessionnelleALEnvoi(identite, lreLe(d(2026, 3, 5), { dateDepot: null }))).toBe(true) // l'événement, le 05/03
    expect(qualiteProfessionnelleALEnvoi(null, lreLe(d(2026, 3, 5)))).toBeNull()
    expect(qualiteProfessionnelleALEnvoi(identite, null)).toBeNull()
    expect(qualiteProfessionnelleALEnvoi(identite, lreLe(d(2026, 3, 5), { dateAvisElectronique: null }))).toBeNull()
  })

  const delai = (identites: IdentiteQualiteDatee[], courrier = lreLe(d(2026, 3, 5))) =>
    finDelaiContestationAgParDestinataire(chaineLe(d(2026, 3, 5)), [courrier], 'ag-1', {
      opposantsOuDefaillants: 1,
      notifications: avecQualiteProfessionnelleALEnvoi([{ identiteId: 'id-1', courrierId: 'k1' }], identites, [courrier]),
    })

  it('LRE du 05/03 sans consentement : case cochée avant l’envoi, calculé ; décochée ensuite, toujours calculé (envoi passé inchangé)', () => {
    expect(delai([cocheeLe(d(2026, 3, 1))])).toMatchObject({ etat: 'calcule' })
    expect(delai([saisie([true, d(2026, 3, 1)], [false, d(2026, 3, 20)])])).toMatchObject({ etat: 'calcule' })
  })

  it('case cochée le jour de l’envoi, ou jamais : consentement exigé, refus (consentement_lre_absent)', () => {
    expect(delai([cocheeLe(d(2026, 3, 5))])).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
    expect(delai([{ id: 'id-1' }])).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
    // case cochée sans état daté (ligne écrite hors application) : non crue
    expect(delai([{ id: 'id-1', professionnel: true }])).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
  })

  it('identité en double dans les fiches : erreur (données incohérentes), comme avecQualiteProfessionnelle ; l’entrée n’est pas modifiée', () => {
    const notifications = [{ identiteId: 'id-1', courrierId: 'k1' }]
    expect(() => avecQualiteProfessionnelleALEnvoi(notifications, [{ id: 'id-1' }, { id: 'id-1' }], [lreLe(d(2026, 3, 5))])).toThrow(/en double/)
    const resultat = avecQualiteProfessionnelleALEnvoi(notifications, [cocheeLe(d(2026, 3, 1))], [lreLe(d(2026, 3, 5))])
    expect(resultat).toEqual([{ identiteId: 'id-1', courrierId: 'k1', professionnel: true }])
    expect(notifications).toEqual([{ identiteId: 'id-1', courrierId: 'k1' }])
    // courrier introuvable : null
    expect(avecQualiteProfessionnelleALEnvoi([{ identiteId: 'id-1', courrierId: 'k9' }], [cocheeLe(d(2026, 3, 1))], [lreLe(d(2026, 3, 5))])[0].professionnel).toBeNull()
  })
})
