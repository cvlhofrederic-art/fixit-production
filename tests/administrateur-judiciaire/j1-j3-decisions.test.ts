import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  creerCourrierDepuisModele,
  enregistrerAccuseReception,
  enregistrerDepot,
  enregistrerPremierePresentation,
} from '@/lib/administrateur-judiciaire/db/courriers'
import { repoAgs, repoModelesCourrier } from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb, type ChangementStatut, type Courrier } from '@/lib/administrateur-judiciaire/db/schema'
import { changerStatutAg, historiqueStatutAg } from '@/lib/administrateur-judiciaire/db/statut-assemblee'
import { etatNotificationCourrier } from '@/lib/administrateur-judiciaire/domain/courriers'
import {
  AVERTISSEMENTS_PROCEDURE_19_2,
  avertissementsProcedure,
  controlerMiseEnDemeure19_2,
  creerPosteCreance,
  type PosteCreance,
} from '@/lib/administrateur-judiciaire/domain/postes-creance'
import {
  DELAI_CONTESTATION_AG_ART42,
  controlerChaineStatutsAg,
  finDelaiContestationAg,
  preparerChangementStatutAg,
} from '@/lib/administrateur-judiciaire/domain/statut-assemblee'

/**
 * Décisions métier J1 à J3 (Hugo Carvalho, 08/10/2026).
 * J1 — délai de l'art. 42 al. 2 : point de départ = PREMIÈRE PRÉSENTATION du pli ; échéance au même quantième deux
 *      mois plus tard ; report au jour ouvrable désactivé par défaut ; les deux dates sont exposées si elles divergent.
 * J2 — statuts d'AG : saut en avant permis mais « hors séquence » avec motif obligatoire ; retour arrière impossible ;
 *      le moteur de délais refuse de calculer sur une chaîne incomplète ou sans courrier AR présenté.
 * J3 — recouvrement : fondement (19-2 / droit commun) porté par chaque poste de créance, par exercice ; une mise en
 *      demeure 19-2 par exercice, nature et montant de chaque provision ; deux avertissements de procédure.
 */

beforeEach(async () => {
  await viderBaseLocale()
})

const ligne = (surcharge: Partial<ChangementStatut>): ChangementStatut => ({
  id: 'cs',
  entiteType: 'ag',
  entiteId: 'ag-1',
  statutAncien: 'PV signé',
  statutNouveau: 'Notifiée',
  dateEffet: '2026-03-02',
  courrierId: 'k1',
  horsSequence: false,
  motif: null,
  createdAt: '2026-03-05T10:00:00.000Z',
  updatedAt: '2026-03-05T10:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  ...surcharge,
})

/** Chaîne complète Projet → Convoquée → PV signé → Notifiée, notification rattachée au courrier k1. */
const chaineComplete = (notification: Partial<ChangementStatut> = {}): ChangementStatut[] => [
  ligne({ id: 'c1', statutAncien: 'Projet', statutNouveau: 'Convoquée', dateEffet: '2026-01-20', courrierId: null }),
  ligne({ id: 'c2', statutAncien: 'Convoquée', statutNouveau: 'PV signé', dateEffet: '2026-02-20', courrierId: null }),
  ligne({ id: 'c3', ...notification }),
]

const courrier = (surcharge: Partial<Courrier>): Courrier => ({
  id: 'k1',
  modeleId: 'm1',
  formeEnvoi: 'AR',
  statut: 'A Suivre',
  objet: 'Notification du PV',
  coproprieteId: null,
  mandatId: null,
  personneId: null,
  entrepriseId: null,
  dateDepot: '2026-02-27',
  datePremierePresentation: '2026-03-02',
  dateAccuseReception: null,
  referenceDiffusion: null,
  createdAt: '2026-02-27T09:00:00.000Z',
  updatedAt: '2026-02-27T09:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  ...surcharge,
})

describe('J1 — point de départ : la première présentation du pli', () => {
  it('le pli présenté est « notifié », qu’il ait été retiré ou non', () => {
    expect(etatNotificationCourrier(courrier({ dateAccuseReception: null }))).toBe('notifie')
    expect(etatNotificationCourrier(courrier({ dateAccuseReception: '2026-03-10' }))).toBe('notifie')
    expect(etatNotificationCourrier(courrier({ datePremierePresentation: null }))).toBe('envoye_non_notifie')
  })

  it('le délai part de la première présentation : ni le dépôt ni le retrait ne le déplacent', () => {
    const base = finDelaiContestationAg(chaineComplete(), [courrier({})], 'ag-1')
    expect(base).toMatchObject({ etat: 'calcule', datePremierePresentation: '2026-03-02' })
    for (const autre of [courrier({ dateDepot: '2026-02-20' }), courrier({ dateAccuseReception: '2026-03-16' })])
      expect(finDelaiContestationAg(chaineComplete(), [autre], 'ag-1')).toEqual(base)
    expect(finDelaiContestationAg(chaineComplete(), [courrier({ datePremierePresentation: '2026-03-04' })], 'ag-1')).toMatchObject({
      echeanceRetenue: '2026-05-04',
    })
  })

  it('échéance au même quantième deux mois plus tard, sans report par défaut ; les deux dates si elles divergent', () => {
    // Présentation le lundi 02/03/2026 → 02/05/2026, un samedi ; avec report : lundi 04/05 (1er mai férié, 3 dimanche).
    expect(finDelaiContestationAg(chaineComplete(), [courrier({})], 'ag-1')).toEqual({
      etat: 'calcule',
      datePremierePresentation: '2026-03-02',
      echeanceSansReport: '2026-05-02',
      echeanceAvecReport: '2026-05-04',
      echeanceRetenue: '2026-05-02',
      reportApplique: false,
      divergence: true,
      avertissements: [],
    })
    expect(
      finDelaiContestationAg(chaineComplete(), [courrier({})], 'ag-1', { reporterAuJourOuvrable: true }),
    ).toMatchObject({ echeanceRetenue: '2026-05-04', reportApplique: true, divergence: true })
    // Présentation le jeudi 05/03/2026 → mardi 05/05/2026 : un seul calcul, pas de divergence.
    expect(
      finDelaiContestationAg(chaineComplete({ dateEffet: '2026-03-05' }), [courrier({ datePremierePresentation: '2026-03-05' })], 'ag-1'),
    ).toMatchObject({ echeanceSansReport: '2026-05-05', echeanceAvecReport: '2026-05-05', divergence: false })
  })

  it('fin de mois : le quantième absent se ramène au dernier jour du mois', () => {
    const resultat = finDelaiContestationAg(
      chaineComplete({ dateEffet: '2026-12-31' }),
      [courrier({ dateDepot: '2026-12-29', datePremierePresentation: '2026-12-31' })],
      'ag-1',
    )
    expect(resultat).toMatchObject({ echeanceSansReport: '2027-02-28' })
  })

  it('date d’effet de la notification différente de la présentation : le délai suit la présentation, avec un avertissement', () => {
    const resultat = finDelaiContestationAg(chaineComplete({ dateEffet: '2026-02-27' }), [courrier({})], 'ag-1')
    expect(resultat).toMatchObject({ etat: 'calcule', echeanceSansReport: '2026-05-02' })
    expect(resultat.etat === 'calcule' && resultat.avertissements[0]).toMatch(/première présentation/)
  })

  it('la règle porte son fondement, sa certitude, et la jurisprudence citée reste « à confirmer »', () => {
    expect(DELAI_CONTESTATION_AG_ART42.certitude).toBe('A_CONFIRMER')
    expect(DELAI_CONTESTATION_AG_ART42.reportAuJourOuvrableParDefaut).toBe(false)
    expect(DELAI_CONTESTATION_AG_ART42.jurisprudence.map((j) => j.verification)).toEqual(['A_CONFIRMER'])
    expect(DELAI_CONTESTATION_AG_ART42.note).toMatch(/première présentation/)
  })

  it('base locale : seule la première présentation est retenue, et le retrait ne peut la précéder', async () => {
    const modele = await repoModelesCourrier.create({ famille: 'Gestion', libelle: 'NOTIFICATION PROCES VERBAL', contexte: null, formeEnvoi: 'AR' })
    const pli = await creerCourrierDepuisModele(modele.id, { objet: 'Notification du PV' })
    await expect(enregistrerPremierePresentation(pli.id, '2026-03-02')).rejects.toThrow(/dépôt/)
    await enregistrerDepot(pli.id, { dateDepot: '2026-02-27' })
    await expect(enregistrerPremierePresentation(pli.id, '2026-02-26')).rejects.toThrow(/précéder/)
    await expect(enregistrerAccuseReception(pli.id, '2026-03-04')).rejects.toThrow(/présentation/)
    const presente = await enregistrerPremierePresentation(pli.id, '2026-03-02')
    expect(etatNotificationCourrier(presente)).toBe('notifie')
    await expect(enregistrerPremierePresentation(pli.id, '2026-03-09')).rejects.toThrow(/première présentation/)
    await expect(enregistrerAccuseReception(pli.id, '2026-03-01')).rejects.toThrow(/présentation/)
    await enregistrerAccuseReception(pli.id, '2026-03-09')
    expect((await ajDb.courriers.get(pli.id))?.datePremierePresentation).toBe('2026-03-02')
  })
})

describe('J2 — séquence des statuts d’AG', () => {
  it('saut en avant : permis seulement avec un motif, et marqué « hors séquence »', () => {
    expect(() => preparerChangementStatutAg({ id: 'ag-1', statut: 'Projet' }, 'PV signé', '2026-02-20')).toThrow(/motif/)
    expect(() => preparerChangementStatutAg({ id: 'ag-1', statut: 'Projet' }, 'PV signé', '2026-02-20', null, '   ')).toThrow(/motif/)
    const saut = preparerChangementStatutAg({ id: 'ag-1', statut: 'Projet' }, 'PV signé', '2026-02-20', null, 'AG tenue sur convocation du juge')
    expect(saut.changement).toMatchObject({ horsSequence: true, motif: 'AG tenue sur convocation du juge' })
    const suivant = preparerChangementStatutAg({ id: 'ag-1', statut: 'Projet' }, 'Convoquée', '2026-01-20')
    expect(suivant.changement).toMatchObject({ horsSequence: false, motif: null })
  })

  it('retour arrière impossible, même avec un motif', () => {
    expect(() =>
      preparerChangementStatutAg({ id: 'ag-1', statut: 'Notifiée' }, 'PV signé', '2026-03-10', null, 'erreur de saisie'),
    ).toThrow(/retour arrière/i)
  })

  it('la chaîne complète (y compris un saut justifié) est acceptée', () => {
    expect(controlerChaineStatutsAg(chaineComplete(), 'ag-1')).toBeNull()
    const avecSaut = [
      ligne({ id: 's1', statutAncien: 'Projet', statutNouveau: 'PV signé', dateEffet: '2026-02-20', courrierId: null, horsSequence: true, motif: 'Reprise de dossier' }),
      ligne({ id: 's2' }),
    ]
    expect(controlerChaineStatutsAg(avecSaut, 'ag-1')).toBeNull()
  })

  it('le moteur de délais refuse une chaîne incomplète, avec un message explicite', () => {
    const sansDebut = [ligne({})]
    expect(finDelaiContestationAg(sansDebut, [courrier({})], 'ag-1')).toEqual({
      etat: 'refuse',
      motif: expect.stringMatching(/chaîne.*incomplète/i),
    })
    const sautNonJustifie = [
      ligne({ id: 's1', statutAncien: 'Projet', statutNouveau: 'PV signé', dateEffet: '2026-02-20', courrierId: null }),
      ligne({ id: 's2' }),
    ]
    expect(finDelaiContestationAg(sautNonJustifie, [courrier({})], 'ag-1')).toMatchObject({
      etat: 'refuse',
      motif: expect.stringMatching(/motif/),
    })
  })

  it('le moteur de délais refuse sans courrier AR présenté', () => {
    const refus = (historique: ChangementStatut[], courriers: Courrier[]) => finDelaiContestationAg(historique, courriers, 'ag-1')
    expect(refus(chaineComplete({ courrierId: null }), [])).toMatchObject({ etat: 'refuse', motif: expect.stringMatching(/Aucun courrier/) })
    expect(refus(chaineComplete(), [courrier({ formeEnvoi: 'Normal' })])).toMatchObject({ etat: 'refuse', motif: expect.stringMatching(/AR/) })
    expect(refus(chaineComplete(), [courrier({ datePremierePresentation: null })])).toMatchObject({
      etat: 'refuse',
      motif: expect.stringMatching(/première présentation/),
    })
    expect(finDelaiContestationAg([ligne({ statutNouveau: 'PV signé' })], [], 'ag-1')).toEqual({ etat: 'non_notifiee' })
  })

  it('base locale : le saut hors séquence est historisé avec son motif ; le retour arrière n’écrit rien', async () => {
    const ag = await repoAgs.create({ coproprieteId: 'C1', date: new Date(2026, 1, 10), nature: 'Judiciaire', statut: 'Projet' })
    await expect(changerStatutAg(ag.id, 'PV signé', { dateEffet: '2026-02-20' })).rejects.toThrow(/motif/)
    await changerStatutAg(ag.id, 'PV signé', { dateEffet: '2026-02-20', motif: 'Reprise de dossier' })
    await expect(changerStatutAg(ag.id, 'Convoquée', { dateEffet: '2026-02-21' })).rejects.toThrow(/retour arrière/i)
    const historique = await historiqueStatutAg(ag.id)
    expect(historique.map((l) => [l.statutNouveau, l.horsSequence, l.motif])).toEqual([['PV signé', true, 'Reprise de dossier']])
    expect((await repoAgs.get(ag.id))?.statut).toBe('PV signé')
  })
})

const poste = (surcharge: Partial<PosteCreance>): PosteCreance => ({
  id: 'p1',
  exercice: '2025',
  nature: 'Provision budget prévisionnel — 1er trimestre',
  montantCentimes: 45_000,
  fondement: 'art_19_2',
  ...surcharge,
})

describe('J3 — postes de créance et mise en demeure 19-2', () => {
  it('le fondement est porté par chaque poste, par exercice ; les deux voies coexistent', () => {
    const p19 = creerPosteCreance(poste({}))
    const pCommun = creerPosteCreance(poste({ id: 'p2', exercice: '2024', nature: 'Charges travaux', fondement: 'droit_commun' }))
    expect([p19.fondement, pCommun.fondement]).toEqual(['art_19_2', 'droit_commun'])
    // @ts-expect-error — fondement hors référentiel
    expect(() => creerPosteCreance(poste({ fondement: 'refere' }))).toThrow(/fondement/i)
    expect(() => creerPosteCreance(poste({ exercice: ' ' }))).toThrow(/exercice/)
    expect(() => creerPosteCreance(poste({ montantCentimes: 12.5 }))).toThrow(/centimes/)
    expect(() => creerPosteCreance(poste({ nature: '' }))).toThrow(/nature/)
  })

  it('une mise en demeure 19-2 visant plusieurs exercices déclenche une alerte', () => {
    const postes = [poste({}), poste({ id: 'p2', exercice: '2026' })]
    const alertes = controlerMiseEnDemeure19_2({ postesVises: [{ posteId: 'p1' }, { posteId: 'p2' }].map((v) => ({ ...v, natureMentionnee: 'x', montantMentionneCentimes: 45_000 })) }, postes)
    expect(alertes.map((a) => a.code)).toContain('plusieurs_exercices')
    expect(alertes.find((a) => a.code === 'plusieurs_exercices')?.source).toMatch(/23-23\.534/)
  })

  it('nature et montant de chaque provision doivent figurer dans la mise en demeure (à peine d’irrecevabilité)', () => {
    const alertes = controlerMiseEnDemeure19_2(
      {
        postesVises: [
          { posteId: 'p1', natureMentionnee: null, montantMentionneCentimes: 45_000 },
          { posteId: 'p2', natureMentionnee: 'Provision T2', montantMentionneCentimes: null },
        ],
      },
      [poste({}), poste({ id: 'p2' })],
    )
    expect(alertes.map((a) => [a.code, a.posteId])).toEqual([
      ['nature_ou_montant_manquant', 'p1'],
      ['nature_ou_montant_manquant', 'p2'],
    ])
    expect(alertes[0].source).toMatch(/24-70\.007/)
  })

  it('une mise en demeure conforme (un exercice, nature et montant) ne déclenche rien ; les postes de droit commun ne sont pas contrôlés', () => {
    const postes = [poste({}), poste({ id: 'p2', nature: 'Provision T2' }), poste({ id: 'p3', exercice: '2023', fondement: 'droit_commun' })]
    const visees = postes.map((p) => ({ posteId: p.id, natureMentionnee: p.nature, montantMentionneCentimes: p.montantCentimes }))
    expect(controlerMiseEnDemeure19_2({ postesVises: visees }, postes)).toEqual([])
    expect(() => controlerMiseEnDemeure19_2({ postesVises: [{ posteId: 'absent', natureMentionnee: 'x', montantMentionneCentimes: 1 }] }, postes)).toThrow(
      /introuvable/,
    )
  })

  it('les deux avertissements de procédure s’affichent dès qu’un poste relève de l’art. 19-2', () => {
    expect(AVERTISSEMENTS_PROCEDURE_19_2.map((a) => a.code)).toEqual(['autorite_chose_jugee', 'pas_de_demande_reconventionnelle'])
    expect(avertissementsProcedure([poste({})])).toEqual(AVERTISSEMENTS_PROCEDURE_19_2)
    expect(avertissementsProcedure([poste({ fondement: 'droit_commun' })])).toEqual([])
  })
})
