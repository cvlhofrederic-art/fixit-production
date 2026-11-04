import { describe, expect, it } from 'vitest'
import { marquerAppelees, suivreEcheances } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import { creerCompteCoproprietaire, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import type { ReglementFournisseur, StatutReglementFournisseur } from '@/lib/administrateur-judiciaire/domain/reglements-fournisseurs'
import { avisDAppel, creerCleRepartition, traitementAppelDeFonds, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { creerResolution, voterResolution, voterSecondVote } from '@/lib/administrateur-judiciaire/domain/resolutions-ag'
import { annulerTraitement, creerTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import type { PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import {
  adopterOperationTravaux,
  annulerDernierChangementStatut,
  annulerRepartitionOperation,
  changementsStatutAHistoriser,
  changerStatutOperationTravaux,
  constaterRepartitionOperation,
  creerOperationTravaux,
  decisionDepuisResolution,
  echeancesTravaux,
  emploisFondsTravauxDesTranches,
  estOperationEnCours,
  idsEcheancesDeLaTranche,
  numeroCompteTravaux,
  referenceDecisionTravaux,
  reglementsDeLOperation,
  reglementsSansOperation,
  statutsDesTranches,
  traitementAppelDeFondsTravaux,
  type ChangementStatutTravaux,
  type OperationTravaux,
  type SaisieOperationTravaux,
} from '@/lib/administrateur-judiciaire/domain/travaux-operations'
import { STATUT_TRAVAUX } from '@/lib/data/referentiels-gesteam-judiciaire'
import { enTeteDuModule } from './en-tete-module'

/**
 * Point 30 du bilan — opération de travaux (cartographie Gestéam, tranches 19, 24, 32 et 43) : statut et type, décision
 * et majorité, clés, statut des tranches, série de comptes, appels et règlements sur l'auxiliaire de l'opération. Le
 * fichier travaux-operations.test.ts (création, tranches, fonds de travaux, retenue de garantie) reste inchangé : une
 * opération à une seule clé produit les mêmes échéances qu'avant.
 * - Statut typé sur STATUT_TRAVAUX, distinct du statut des tranches ; « Adopté » exige la décision ; « Réparti » suit la
 *   répartition de l'opération au segment de son syndicat, à la clôture définitive (D. 2005-240 art. 8) ; un statut ne
 *   recule pas, un saut se motive, la création trace son statut (J2) ; chaque annulation remonte d'un changement.
 * - Majorité de la décision : requise et second vote (L. 1965 art. 25-1, 26-1) ; administrateur provisoire : sans vote.
 * - Plusieurs clés : une échéance par tranche et par clé, sur le montant à appeler de la clé.
 * - Série de comptes à la création : 10200, 12000, 67100, 70200, 71147, auxiliaire = n° d'opération (arrêté du 14 mars
 *   2005, art. 7 et 8 ; Gestéam « No des travaux »).
 * - Part du fonds de travaux (J4) : même majorité que les travaux (art. 14-2-1, I, al. 7) ; par clé quand il y en a
 *   plusieurs.
 */

const saisie = (surcharge: Partial<SaisieOperationTravaux> = {}): SaisieOperationTravaux => ({
  numero: '00042',
  coproprieteId: 'copro-tilleuls',
  libelle: 'Ravalement façade rue',
  cleId: 'cle-001',
  decision: { date: '2026-03-12', resolution: 'Résolution 8' },
  budgetTtcCentimes: 12_000_000,
  financementFondsTravauxCentimes: 2_000_000,
  affectationFonds: { objet: 'travaux_hors_ppt' },
  tranches: [
    { date: '2026-05-01', tauxPct: 30 },
    { date: '2026-08-01', tauxPct: 40 },
    { date: '2026-11-01', tauxPct: 30 },
  ],
  ...surcharge,
})

const projet = (surcharge: Partial<SaisieOperationTravaux> = {}): OperationTravaux =>
  creerOperationTravaux(saisie({ decision: null, financementFondsTravauxCentimes: 0, affectationFonds: null, ...surcharge }))

/** Adoption tracée à la date de la décision (création avec la décision, ou adopterOperationTravaux). */
const ADOPTION: ChangementStatutTravaux = { de: 'Projet', vers: 'Adopté', le: '2026-03-12', motif: null, horsSequence: false, annulation: false, traitementId: null }

/** Reprise d'une opération déjà engagée : statut saisi à la création avec sa date et son motif (J2). */
const reprise = (statut: SaisieOperationTravaux['statut'], le: string): Partial<SaisieOperationTravaux> => ({
  statut,
  changementStatut: { le, motif: 'Reprise : opération engagée par le précédent syndic' },
})

describe('compatibilité : une opération à une seule clé', () => {
  it('mêmes échéances qu’avant le point 30 : ids « <n°>-T<k> », contrepartie 70200, aucun champ ajouté', () => {
    const [premiere] = echeancesTravaux(creerOperationTravaux(saisie()))
    expect(Object.keys(premiere).sort((a, b) => a.localeCompare(b))).toEqual(
      ['cleId', 'compteContrepartie', 'coproprieteId', 'exigibilite', 'id', 'libelle', 'montantCentimes', 'nature'],
    )
    expect(premiere).toMatchObject({ id: '00042-T1', compteContrepartie: '70200', montantCentimes: 3_000_000 })
  })
})

describe('statut et type de l’opération (STATUT_TRAVAUX, TYPE_TRAVAUX)', () => {
  it('statut par défaut : « Adopté » avec la décision, « Projet » sans ; type facultatif, typé sur TYPE_TRAVAUX', () => {
    const votee = creerOperationTravaux(saisie({ type: 'Ravalement' }))
    expect(votee).toMatchObject({ statut: 'Adopté', type: 'Ravalement', historiqueStatuts: [ADOPTION] })
    expect(projet()).toMatchObject({ statut: 'Projet', type: null, historiqueStatuts: [] })
    // @ts-expect-error — type hors TYPE_TRAVAUX
    expect(() => creerOperationTravaux(saisie({ type: 'Toiture' }))).toThrow(/type de travaux inconnu « Toiture »/)
  })

  it('« Adopté » exige la décision : aucun statut décidé sans elle, ni décision sur un projet ou un rejet', () => {
    expect(() => projet({ statut: 'Adopté' })).toThrow(/« Adopté » sans décision \(assemblée ou administrateur provisoire\)/)
    expect(() => projet({ statut: 'Commandé' })).toThrow(/« Commandé » sans décision/)
    expect(() => creerOperationTravaux(saisie({ statut: 'Projet' }))).toThrow(/« Projet » avec une décision enregistrée/)
    expect(creerOperationTravaux(saisie(reprise('Commencé', '2026-05-02'))).statut).toBe('Commencé')
  })

  it('la création trace son statut : l’adoption à la date de la décision ; au-delà, ou « Rejeté », date et motif aux règles des transitions (J2)', () => {
    expect(changementsStatutAHistoriser(creerOperationTravaux(saisie())).map((c) => [c.statutAncien, c.statutNouveau, c.dateEffet])).toEqual([
      ['Projet', 'Adopté', '2026-03-12'],
    ])
    expect(() => projet({ statut: 'Rejeté' })).toThrow(/statut « Rejeté » à la création sans sa date ni son motif/)
    expect(() => projet({ statut: 'Rejeté', changementStatut: { le: '2026-03-12', motif: ' ' } })).toThrow(/motif du rejet exigé/)
    expect(projet({ statut: 'Rejeté', changementStatut: { le: '2026-03-12', motif: 'Résolution 8 rejetée' } }).historiqueStatuts).toEqual([
      { de: 'Projet', vers: 'Rejeté', le: '2026-03-12', motif: 'Résolution 8 rejetée', horsSequence: false, annulation: false, traitementId: null },
    ])
    expect(() => creerOperationTravaux(saisie({ statut: 'A clôturer' }))).toThrow(/statut « A clôturer » à la création sans sa date ni son motif/)
    expect(() => creerOperationTravaux(saisie({ statut: 'A clôturer', changementStatut: { le: '2027-01-15' } }))).toThrow(/saut « Adopté » → « A clôturer » sans motif/)
    expect(() => creerOperationTravaux(saisie({ statut: 'Commandé', changementStatut: { le: '2026-03-01' } }))).toThrow(/avant la décision du 12\/03\/2026/)
    expect(creerOperationTravaux(saisie(reprise('A clôturer', '2027-01-15'))).historiqueStatuts).toEqual([
      ADOPTION,
      { de: 'Adopté', vers: 'A clôturer', le: '2027-01-15', motif: 'Reprise : opération engagée par le précédent syndic', horsSequence: true, annulation: false, traitementId: null },
    ])
    const commandee = creerOperationTravaux(saisie({ statut: 'Commandé', changementStatut: { le: '2026-04-01' } }))
    expect(commandee.historiqueStatuts.at(-1)).toMatchObject({ de: 'Adopté', vers: 'Commandé', motif: null, horsSequence: false })
    expect(commandee).not.toHaveProperty('changementStatut')
    expect(() => creerOperationTravaux(saisie({ changementStatut: { le: '2026-04-01', motif: 'x' } }))).toThrow(/date et motif du statut sans objet/)
  })

  it('ni « En cours » (regroupement de la recherche) ni « Réparti » (suit la répartition) ni statut inconnu à la saisie', () => {
    expect(() => creerOperationTravaux(saisie({ statut: 'En cours' }))).toThrow(/« En cours » regroupe/)
    expect(() => creerOperationTravaux(saisie({ statut: 'Réparti' }))).toThrow(/« Réparti » suit la répartition/)
    // @ts-expect-error — statut hors STATUT_TRAVAUX
    expect(() => creerOperationTravaux(saisie({ statut: 'Voté' }))).toThrow(/statut inconnu « Voté »/)
  })
})

describe('transitions du statut de l’opération', () => {
  it('adoption d’un projet avec sa décision : « Adopté » à la date de la décision, tracé', () => {
    const adoptee = adopterOperationTravaux(projet(), { date: '2026-03-12', resolution: 'Résolution 8', majorite: 'art25' })
    expect(adoptee.statut).toBe('Adopté')
    expect(adoptee.decision).toEqual({ date: '2026-03-12', resolution: 'Résolution 8', majorite: 'art25' })
    expect(adoptee.historiqueStatuts).toEqual([
      { de: 'Projet', vers: 'Adopté', le: '2026-03-12', motif: null, horsSequence: false, annulation: false, traitementId: null },
    ])
    expect(() => adopterOperationTravaux(adoptee, { date: '2026-03-12', resolution: 'Résolution 8' })).toThrow(/seul un projet s'adopte/)
    expect(() => changerStatutOperationTravaux(projet(), 'Adopté', { le: '2026-03-12' })).toThrow(/adopterOperationTravaux/)
  })

  it('en avant, étape par étape ; un saut exige un motif et reste marqué hors séquence', () => {
    const commandee = changerStatutOperationTravaux(creerOperationTravaux(saisie()), 'Commandé', { le: '2026-04-01' })
    expect(commandee.historiqueStatuts.at(-1)).toMatchObject({ de: 'Adopté', vers: 'Commandé', horsSequence: false })
    expect(() => changerStatutOperationTravaux(commandee, 'Terminé', { le: '2026-10-01' })).toThrow(/saut « Commandé » → « Terminé » sans motif/)
    const terminee = changerStatutOperationTravaux(commandee, 'Terminé', { le: '2026-10-01', motif: 'Reprise : chantier commencé par le précédent syndic' })
    expect(terminee.historiqueStatuts.at(-1)).toEqual({
      de: 'Commandé',
      vers: 'Terminé',
      le: '2026-10-01',
      motif: 'Reprise : chantier commencé par le précédent syndic',
      horsSequence: true,
      annulation: false,
      traitementId: null,
    })
  })

  it('un statut ne recule pas ; ni « Réparti » à la main, ni avant la décision, ni avant le changement précédent', () => {
    const commandee = changerStatutOperationTravaux(creerOperationTravaux(saisie()), 'Commandé', { le: '2026-04-01' })
    expect(() => changerStatutOperationTravaux(commandee, 'Adopté', { le: '2026-04-02', motif: 'erreur' })).toThrow(/un statut ne recule pas/)
    expect(() => changerStatutOperationTravaux(commandee, 'Réparti', { le: '2026-04-02', motif: 'x' })).toThrow(/constaterRepartitionOperation/)
    expect(() => changerStatutOperationTravaux(commandee, 'En cours', { le: '2026-04-02' })).toThrow(/« En cours » regroupe/)
    expect(() => changerStatutOperationTravaux(creerOperationTravaux(saisie()), 'Commandé', { le: '2026-03-01' })).toThrow(/avant la décision du 12\/03\/2026/)
    expect(() => changerStatutOperationTravaux(commandee, 'Commencé', { le: '2026-03-31' })).toThrow(
      /changement du 31\/03\/2026 antérieur au dernier changement en vigueur \(« Adopté » → « Commandé » du 01\/04\/2026\)/,
    )
  })

  it('« Rejeté » : depuis un projet, avec son motif ; puis aucun changement en avant, seule l’annulation tracée du rejet le quitte', () => {
    expect(() => changerStatutOperationTravaux(projet(), 'Rejeté', { le: '2026-03-12' })).toThrow(/motif du rejet exigé/)
    const rejete = changerStatutOperationTravaux(projet(), 'Rejeté', { le: '2026-03-12', motif: 'Résolution 8 rejetée' })
    expect(rejete.statut).toBe('Rejeté')
    expect(() => changerStatutOperationTravaux(creerOperationTravaux(saisie()), 'Rejeté', { le: '2026-04-01', motif: 'x' })).toThrow(/seul un projet est rejeté/)
    expect(() => changerStatutOperationTravaux(rejete, 'Adopté', { le: '2026-04-01' })).toThrow(
      /statut définitif ; seule l'annulation tracée du rejet \(annulerDernierChangementStatut\) le quitte/,
    )
  })

  it('décision annulée en justice ou rapportée : aucune transition établie (🔴), le refus le dit', () => {
    const adoptee = creerOperationTravaux(saisie())
    expect(() => changerStatutOperationTravaux(adoptee, 'Rejeté', { le: '2026-06-01', motif: 'Résolution annulée par jugement' })).toThrow(
      /rapportée par une nouvelle assemblée : transition non établie ; suspendre ou annuler ses échéances \(echeancier-appels\.ts\)/,
    )
  })

  it('erreur corrigée par une annulation tracée : nouveau changement, historique conservé ; jamais l’adoption', () => {
    const commandee = changerStatutOperationTravaux(creerOperationTravaux(saisie()), 'Commandé', { le: '2026-04-01' })
    expect(() => annulerDernierChangementStatut(commandee, { le: '2026-04-02', motif: ' ' })).toThrow(/motif de l'annulation exigé/)
    const corrigee = annulerDernierChangementStatut(commandee, { le: '2026-04-02', motif: 'Ordre de service non signé' })
    expect(corrigee.statut).toBe('Adopté')
    expect(corrigee.historiqueStatuts).toHaveLength(3)
    expect(corrigee.historiqueStatuts.at(-1)).toMatchObject({ de: 'Commandé', vers: 'Adopté', annulation: true })
    expect(() => annulerDernierChangementStatut(corrigee, { le: '2026-04-03', motif: 'x' })).toThrow(/l'adoption porte la décision/)
    expect(() => annulerDernierChangementStatut(creerOperationTravaux(saisie()), { le: '2026-04-03', motif: 'x' })).toThrow(/l'adoption porte la décision/)
    expect(() => annulerDernierChangementStatut(projet(), { le: '2026-04-03', motif: 'x' })).toThrow(/aucun changement de statut en vigueur à annuler/)
    const adoptee = adopterOperationTravaux(projet(), { date: '2026-03-12', resolution: 'Résolution 8' })
    expect(() => annulerDernierChangementStatut(adoptee, { le: '2026-03-13', motif: 'x' })).toThrow(/l'adoption porte la décision/)
    const rejete = changerStatutOperationTravaux(projet(), 'Rejeté', { le: '2026-03-12', motif: 'Résolution 8 rejetée' })
    const retour = annulerDernierChangementStatut(rejete, { le: '2026-03-13', motif: 'Résolution reportée, non rejetée' })
    expect(retour.statut).toBe('Projet')
    expect(() => annulerDernierChangementStatut(retour, { le: '2026-03-14', motif: 'x' })).toThrow(/aucun changement de statut en vigueur à annuler/)
  })

  it('deux erreurs successives : chaque annulation remonte d’un changement en vigueur, jusqu’à l’adoption exclue', () => {
    const commandee = changerStatutOperationTravaux(creerOperationTravaux(saisie()), 'Commandé', { le: '2026-04-01' })
    const commencee = changerStatutOperationTravaux(commandee, 'Commencé', { le: '2026-04-01' })
    const r1 = annulerDernierChangementStatut(commencee, { le: '2026-04-02', motif: 'Commencé saisi par erreur' })
    expect(r1.statut).toBe('Commandé')
    const r2 = annulerDernierChangementStatut(r1, { le: '2026-04-02', motif: 'Commandé saisi par erreur' })
    expect(r2.statut).toBe('Adopté')
    expect(r2.historiqueStatuts.slice(-2).map((c) => [c.de, c.vers, c.annulation])).toEqual([
      ['Commencé', 'Commandé', true],
      ['Commandé', 'Adopté', true],
    ])
    expect(() => annulerDernierChangementStatut(r2, { le: '2026-04-03', motif: 'x' })).toThrow(/l'adoption porte la décision/)
    const terminee = changerStatutOperationTravaux(r1, 'Terminé', { le: '2026-05-01', motif: 'Chantier achevé, étape non saisie' })
    const t1 = annulerDernierChangementStatut(terminee, { le: '2026-05-02', motif: 'Terminé saisi par erreur' })
    expect(t1.statut).toBe('Commandé')
    expect(annulerDernierChangementStatut(t1, { le: '2026-05-02', motif: 'Commandé saisi par erreur' }).statut).toBe('Adopté')
  })

  it('« En cours » (recherche Gestéam) : toute opération du cycle ni répartie ni rejetée, projets compris', () => {
    expect(STATUT_TRAVAUX.filter((s) => estOperationEnCours(s))).toEqual(['Projet', 'Adopté', 'Commandé', 'Commencé', 'Terminé', 'A clôturer'])
  })

  it('historique prêt pour la table des changements de statut (entité « travaux », clé syndicat + n°, D1)', () => {
    const adoptee = adopterOperationTravaux(projet(), { date: '2026-03-12', resolution: 'Résolution 8' })
    const commencee = changerStatutOperationTravaux(adoptee, 'Commencé', { le: '2026-05-02', motif: 'Ordre de service du 15/04 non saisi' })
    expect(changementsStatutAHistoriser(commencee)).toEqual([
      { entiteType: 'travaux', entiteId: 'copro-tilleuls:00042', statutAncien: 'Projet', statutNouveau: 'Adopté', dateEffet: '2026-03-12', courrierId: null, horsSequence: false, motif: null },
      {
        entiteType: 'travaux',
        entiteId: 'copro-tilleuls:00042',
        statutAncien: 'Adopté',
        statutNouveau: 'Commencé',
        dateEffet: '2026-05-02',
        courrierId: null,
        horsSequence: true,
        motif: 'Ordre de service du 15/04 non saisi',
      },
    ])
    const corrigee = annulerDernierChangementStatut(commencee, { le: '2026-05-03', motif: 'Saisie sur la mauvaise opération' })
    expect(changementsStatutAHistoriser(corrigee).at(-1)).toMatchObject({
      statutAncien: 'Commencé',
      statutNouveau: 'Adopté',
      motif: 'Annulation — Saisie sur la mauvaise opération',
    })
    expect(changementsStatutAHistoriser(projet())).toEqual([])
  })
})

describe('« Réparti » suit la répartition (D. 2005-240 art. 8)', () => {
  const repartition = (compte: string) =>
    creerTraitement({
      id: 'REP-2027',
      famille: 'Répartition de charges',
      date: '2027-03-31',
      mouvements: [
        { compte, sens: 'credit', montantCentimes: 10_000 },
        { compte: 'TILL.45000.00001.0', sens: 'debit', montantCentimes: 10_000 },
      ],
    })
  const terminee = () => creerOperationTravaux(saisie(reprise('Terminé', '2026-12-01')))
  const aCloturer = () => changerStatutOperationTravaux(terminee(), 'A clôturer', { le: '2027-01-15' })

  it('posé par la répartition de l’opération, depuis « A clôturer » seulement', () => {
    const repartie = constaterRepartitionOperation(aCloturer(), repartition('TILL.67100.00042.0'), 'TILL')
    expect(repartie.statut).toBe('Réparti')
    expect(repartie.historiqueStatuts.at(-1)).toMatchObject({ de: 'A clôturer', vers: 'Réparti', le: '2027-03-31', traitementId: 'REP-2027' })
    expect(() => constaterRepartitionOperation(terminee(), repartition('TILL.67100.00042.0'), 'TILL')).toThrow(
      /clôture définitive de l'opération \(D\. 2005-240 art\. 8\)/,
    )
    expect(() => constaterRepartitionOperation(aCloturer(), repartition('TILL.67100.00043.0'), 'TILL')).toThrow(/aucun mouvement de l'opération 00042/)
    const appel = creerTraitement({ ...repartition('TILL.67100.00042.0'), famille: 'Appel de fonds' })
    expect(() => constaterRepartitionOperation(aCloturer(), appel, 'TILL')).toThrow(/« Répartition de charges » est attendue/)
  })

  it('la répartition d’un autre syndicat (autre segment) ne porte pas l’opération de même n° (D1)', () => {
    expect(() => constaterRepartitionOperation(aCloturer(), repartition('AUTR.67100.00042.0'), 'TILL')).toThrow(
      /aucun mouvement de l'opération 00042 au segment TILL/,
    )
    const parLien = creerTraitement({
      id: 'REP-AUTR',
      famille: 'Répartition de charges',
      date: '2027-03-31',
      mouvements: [
        { compte: 'AUTR.61500.00000.0', sens: 'credit', montantCentimes: 10_000, liens: { travauxId: '00042' } },
        { compte: 'AUTR.45000.00001.0', sens: 'debit', montantCentimes: 10_000 },
      ],
    })
    expect(() => constaterRepartitionOperation(aCloturer(), parLien, 'TILL')).toThrow(/aucun mouvement de l'opération 00042 au segment TILL/)
    expect(constaterRepartitionOperation(aCloturer(), { ...parLien, mouvements: parLien.mouvements.map((m) => ({ ...m, compte: m.compte.replace('AUTR', 'TILL') })) }, 'TILL').statut).toBe(
      'Réparti',
    )
  })

  it('une répartition datée avant la décision est refusée, même sans historique (reprise d’une table)', () => {
    const avant = creerTraitement({ ...repartition('TILL.67100.00042.0'), date: '2025-12-31' })
    const repriseACloturer = creerOperationTravaux(saisie(reprise('A clôturer', '2027-01-15')))
    expect(() => constaterRepartitionOperation(repriseACloturer, avant, 'TILL')).toThrow(/répartition REP-2027 au 31\/12\/2025, avant la décision du 12\/03\/2026/)
    expect(() => constaterRepartitionOperation({ ...repriseACloturer, historiqueStatuts: [] }, avant, 'TILL')).toThrow(/avant la décision du 12\/03\/2026/)
  })

  it('une répartition annulée ne repose pas « Réparti » : une nouvelle répartition est attendue', () => {
    const rep = repartition('TILL.67100.00042.0')
    const repartie = constaterRepartitionOperation(aCloturer(), rep, 'TILL')
    const retour = annulerRepartitionOperation(repartie, annulerTraitement(rep, { id: 'ANN-1', date: '2027-03-31' }), { motif: 'Clé erronée' })
    expect(retour.statut).toBe('A clôturer')
    expect(() => constaterRepartitionOperation(retour, rep, 'TILL')).toThrow(/REP-2027 déjà constatée puis annulée/)
    expect(constaterRepartitionOperation(retour, { ...rep, id: 'REP-2027-BIS' }, 'TILL').historiqueStatuts.at(-1)).toMatchObject({ vers: 'Réparti', traitementId: 'REP-2027-BIS' })
  })

  it('retiré par l’annulation de cette répartition, avec motif ; « Réparti » ne s’annule pas autrement', () => {
    const rep = repartition('TILL.67100.00042.0')
    const repartie = constaterRepartitionOperation(aCloturer(), rep, 'TILL')
    expect(() => changerStatutOperationTravaux(repartie, 'Terminé', { le: '2027-04-01' })).toThrow(
      /statut définitif ; seule l'annulation de sa répartition \(annulerRepartitionOperation\) le quitte/,
    )
    expect(() => annulerDernierChangementStatut(repartie, { le: '2027-04-01', motif: 'x' })).toThrow(/annulerRepartitionOperation/)
    const annulation = annulerTraitement(rep, { id: 'ANN-REP-2027', date: '2027-04-02' })
    const retour = annulerRepartitionOperation(repartie, annulation, { motif: 'Clé erronée' })
    expect(retour.statut).toBe('A clôturer')
    expect(retour.historiqueStatuts.at(-1)).toMatchObject({ de: 'Réparti', vers: 'A clôturer', annulation: true, traitementId: 'ANN-REP-2027' })
    expect(changementsStatutAHistoriser(retour).slice(-2).map((c) => [c.statutNouveau, c.motif])).toEqual([
      ['Réparti', 'traitement REP-2027'],
      ['A clôturer', 'Annulation — Clé erronée — traitement ANN-REP-2027'],
    ])
    const autre = annulerTraitement(repartition('TILL.67100.00042.0'), { id: 'ANN-X', date: '2027-04-02' })
    expect(() => annulerRepartitionOperation(repartie, { ...autre, annule: 'REP-AUTRE' }, { motif: 'x' })).toThrow(/l'annulation de la répartition REP-2027/)
  })

  it('répartition datée par erreur puis annulée : la nouvelle répartition se constate à sa date vraie, même antérieure', () => {
    const rep1 = creerTraitement({ ...repartition('TILL.67100.00042.0'), id: 'REP-1', date: '2027-04-30' })
    const repartie = constaterRepartitionOperation(aCloturer(), rep1, 'TILL')
    expect(() => annulerRepartitionOperation(repartie, annulerTraitement(rep1, { id: 'ANN-1', date: '2027-01-10' }), { motif: 'x' })).toThrow(
      /annulation ANN-1 du 10\/01\/2027 antérieure à la répartition REP-1 du 30\/04\/2027 qu'elle contre-passe/,
    )
    const retour = annulerRepartitionOperation(repartie, annulerTraitement(rep1, { id: 'ANN-1', date: '2027-04-30' }), {
      motif: 'Répartition datée du 30/04 au lieu du 31/03',
    })
    const rep2 = creerTraitement({ ...rep1, id: 'REP-2', date: '2027-03-31' })
    expect(constaterRepartitionOperation(retour, rep2, 'TILL').historiqueStatuts.at(-1)).toMatchObject({
      de: 'A clôturer',
      vers: 'Réparti',
      le: '2027-03-31',
      traitementId: 'REP-2',
    })
    const avantLaCloture = creerTraitement({ ...rep1, id: 'REP-3', date: '2027-01-14' })
    expect(() => constaterRepartitionOperation(retour, avantLaCloture, 'TILL')).toThrow(
      /changement du 14\/01\/2027 antérieur au dernier changement en vigueur \(« Terminé » → « A clôturer » du 15\/01\/2027\)/,
    )
  })

  it('l’annulation, écriture contraire, ne précède pas la répartition qu’elle contre-passe (arrêté du 14 mars 2005, art. 5)', () => {
    // « A clôturer » le 15/01/2027, répartition REP-1 le 30/04/2027 : une annulation du 01/02/2027, postérieure au statut
    // rétabli, contre-passerait du 01/02 au 30/04 une répartition pas encore passée (comptes 450 et 67100 faux).
    const rep1 = creerTraitement({ ...repartition('TILL.67100.00042.0'), id: 'REP-1', date: '2027-04-30' })
    const repartie = constaterRepartitionOperation(aCloturer(), rep1, 'TILL')
    expect(() => annulerRepartitionOperation(repartie, annulerTraitement(rep1, { id: 'ANN-1', date: '2027-02-01' }), { motif: 'x' })).toThrow(
      /Opération 00042 : annulation ANN-1 du 01\/02\/2027 antérieure à la répartition REP-1 du 30\/04\/2027 qu'elle contre-passe ; l'écriture contraire annule une écriture passée \(arrêté du 14 mars 2005, art\. 5\), elle ne la précède pas\./,
    )
    expect(() => annulerRepartitionOperation(repartie, annulerTraitement(rep1, { id: 'ANN-1', date: '2027-04-29' }), { motif: 'x' })).toThrow(
      /antérieure à la répartition REP-1/,
    )
    expect(repartie.statut).toBe('Réparti')
    // Le jour même de la répartition, ou après : admise, retour à « A clôturer » à la date de l'annulation.
    const memeJour = annulerRepartitionOperation(repartie, annulerTraitement(rep1, { id: 'ANN-1', date: '2027-04-30' }), { motif: 'Clé erronée' })
    expect(memeJour.historiqueStatuts.slice(-2).map((c) => [c.vers, c.le])).toEqual([
      ['Réparti', '2027-04-30'],
      ['A clôturer', '2027-04-30'],
    ])
    expect(annulerRepartitionOperation(repartie, annulerTraitement(rep1, { id: 'ANN-1', date: '2027-05-02' }), { motif: 'Clé erronée' }).statut).toBe('A clôturer')
  })
})

describe('correction d’une date erronée par l’annulation tracée (J2 : une donnée fausse vaut moins qu’une donnée incomplète)', () => {
  it('« Commandé » saisi au 10/04 au lieu du 01/04 : l’annulation est datée de la correction, puis la date vraie se saisit', () => {
    const erreur = changerStatutOperationTravaux(creerOperationTravaux(saisie()), 'Commandé', { le: '2026-04-10' })
    const annulee = annulerDernierChangementStatut(erreur, { le: '2026-04-02', motif: 'Date erronée : ordre de service du 01/04' })
    expect(annulee.statut).toBe('Adopté')
    const corrigee = changerStatutOperationTravaux(annulee, 'Commandé', { le: '2026-04-01' })
    expect(corrigee.statut).toBe('Commandé')
    // Ordre de saisie conservé : la date vraie précède l'annulation et la date erronée, qui restent tracées.
    expect(changementsStatutAHistoriser(corrigee).map((c) => [c.statutAncien, c.statutNouveau, c.dateEffet])).toEqual([
      ['Projet', 'Adopté', '2026-03-12'],
      ['Adopté', 'Commandé', '2026-04-10'],
      ['Commandé', 'Adopté', '2026-04-02'],
      ['Adopté', 'Commandé', '2026-04-01'],
    ])
    expect(() => changerStatutOperationTravaux(annulee, 'Commandé', { le: '2026-03-01' })).toThrow(/avant la décision du 12\/03\/2026/)
  })

  it('la chronologie se contrôle sur les changements en vigueur : la date vraie suit le statut rétabli, l’annulation aussi', () => {
    const commandee = changerStatutOperationTravaux(creerOperationTravaux(saisie()), 'Commandé', { le: '2026-04-01' })
    const erreur = changerStatutOperationTravaux(commandee, 'Commencé', { le: '2026-04-20' })
    expect(() => annulerDernierChangementStatut(erreur, { le: '2026-03-31', motif: 'x' })).toThrow(
      /annulation du 31\/03\/2026 antérieure au statut « Commandé » qu'elle rétablit \(depuis le 01\/04\/2026\)/,
    )
    const annulee = annulerDernierChangementStatut(erreur, { le: '2026-04-05', motif: 'Commencé le 10/04, non le 20/04' })
    expect(annulee.statut).toBe('Commandé')
    expect(() => changerStatutOperationTravaux(annulee, 'Commencé', { le: '2026-03-31' })).toThrow(
      /changement du 31\/03\/2026 antérieur au dernier changement en vigueur \(« Adopté » → « Commandé » du 01\/04\/2026\)/,
    )
    expect(changerStatutOperationTravaux(annulee, 'Commencé', { le: '2026-04-10' }).historiqueStatuts.at(-1)).toMatchObject({
      de: 'Commandé',
      vers: 'Commencé',
      le: '2026-04-10',
      annulation: false,
    })
  })

  it('rejet saisi par erreur, annulé le lendemain : l’adoption se saisit à la date de l’AG, reprise dans la référence de la décision', () => {
    const rejete = changerStatutOperationTravaux(creerOperationTravaux(saisie({ decision: null })), 'Rejeté', { le: '2026-03-12', motif: 'Résolution 8 rejetée' })
    const retour = annulerDernierChangementStatut(rejete, { le: '2026-03-13', motif: 'Résolution 8 adoptée selon le procès-verbal' })
    const adoptee = adopterOperationTravaux(retour, { date: '2026-03-12', resolution: 'Résolution 8' })
    expect(adoptee.statut).toBe('Adopté')
    expect(adoptee.historiqueStatuts.map((c) => [c.de, c.vers, c.le, c.annulation])).toEqual([
      ['Projet', 'Rejeté', '2026-03-12', false],
      ['Rejeté', 'Projet', '2026-03-13', true],
      ['Projet', 'Adopté', '2026-03-12', false],
    ])
    expect(emploisFondsTravauxDesTranches(adoptee)[0].affectation.decisionAg).toBe('Résolution 8 (AG du 12/03/2026)')
    expect(changerStatutOperationTravaux(adoptee, 'Commandé', { le: '2026-03-12' }).statut).toBe('Commandé')
  })
})

describe('majorité de la décision', () => {
  it('majorité requise et second vote immédiat cohérents (art. 25-1, al. 1 ; art. 26-1)', () => {
    expect(creerOperationTravaux(saisie({ decision: { date: '2026-03-12', resolution: 'Résolution 8', majorite: 'art25', secondVote: 'art24' } })).decision?.secondVote).toBe('art24')
    expect(creerOperationTravaux(saisie({ decision: { date: '2026-03-12', resolution: 'Résolution 8', majorite: 'art26', secondVote: 'art25' } })).statut).toBe('Adopté')
    expect(() => creerOperationTravaux(saisie({ decision: { date: '2026-03-12', resolution: 'R 8', majorite: 'art25', secondVote: 'art25' } }))).toThrow(/second vote immédiat à l'art\. 24 après l'art\. 25/)
    expect(() => creerOperationTravaux(saisie({ decision: { date: '2026-03-12', resolution: 'R 8', secondVote: 'art24' } }))).toThrow(/majorité « non précisée »/)
    // @ts-expect-error — majorité hors TypeMajorite
    expect(() => creerOperationTravaux(saisie({ decision: { date: '2026-03-12', resolution: 'R 8', majorite: 'art27' } }))).toThrow(/majorité inconnue/)
  })

  it('décision de l’administrateur provisoire (art. 29-1) : ni vote ni majorité', () => {
    const decision = { date: '2026-03-12', resolution: 'Registre des décisions, n° 4', origine: 'administrateur' as const }
    expect(creerOperationTravaux(saisie({ decision })).statut).toBe('Adopté')
    expect(() => creerOperationTravaux(saisie({ decision: { ...decision, majorite: 'art24' } }))).toThrow(/ni vote ni majorité/)
  })

  it('affectation du fonds par la décision de l’administrateur provisoire : référée à sa décision (registre), pas à une AG', () => {
    const decision = { date: '2026-03-12', resolution: 'Registre des décisions, n° 4', origine: 'administrateur' as const }
    const reference = "Registre des décisions, n° 4 (décision de l'administrateur provisoire du 12/03/2026)"
    expect(referenceDecisionTravaux(decision)).toBe(reference)
    expect(new Set(emploisFondsTravauxDesTranches(creerOperationTravaux(saisie({ decision }))).map((e) => e.affectation.decisionAg))).toEqual(new Set([reference]))
    expect(emploisFondsTravauxDesTranches(creerOperationTravaux(saisie()))[0].affectation.decisionAg).toBe('Résolution 8 (AG du 12/03/2026)')
    expect(() => creerOperationTravaux(saisie({ decision: { ...decision, resolution: ' ' } }))).toThrow(
      /Décision incomplète \(assemblée ou administrateur provisoire\) : date \(AAAA-MM-JJ\) et résolution ou référence au registre attendues/,
    )
    expect(() => echeancesTravaux(projet())).toThrow(/pas d'appel de travaux sans décision \(assemblée ou administrateur provisoire\)/)
  })

  it('décision tirée d’une résolution adoptée, au second vote le cas échéant ; refusée si la résolution n’est pas adoptée', () => {
    const vote = { voixTotales: 1_000, membresTotaux: 10, pour: 400, contre: 200, abstention: 0 }
    const resolution = voterResolution(creerResolution({ id: 'R8', agId: 'AG-2026', numero: 8, intitule: 'Ravalement', majorite: 'art25' }), vote)
    expect(() => decisionDepuisResolution(resolution, '2026-03-12')).toThrow(/seule une résolution adoptée/)
    expect(decisionDepuisResolution(voterSecondVote(resolution, vote), '2026-03-12')).toEqual({
      date: '2026-03-12',
      resolution: 'Résolution n° 8',
      origine: 'assemblee',
      majorite: 'art25',
      secondVote: 'art24',
    })
    const premier = voterResolution(creerResolution({ id: 'R9', agId: 'AG-2026', numero: 9, intitule: 'Toiture', majorite: 'art24' }), vote)
    expect(decisionDepuisResolution(premier, '2026-03-12')).toMatchObject({ majorite: 'art24', secondVote: null })
  })

  it('affectation du fonds votée à part : même majorité que les travaux (art. 14-2-1, I, al. 7)', () => {
    const decision = { date: '2026-03-12', resolution: 'Résolution 8', majorite: 'art25' as const }
    const affectation = { objet: 'travaux_hors_ppt' as const, decisionAg: 'Résolution 9', majorite: 'art24' as const }
    expect(() => creerOperationTravaux(saisie({ decision, affectationFonds: affectation }))).toThrow(/même majorité que les dépenses concernées/)
    expect(creerOperationTravaux(saisie({ decision, affectationFonds: { ...affectation, majorite: 'art25' } })).statut).toBe('Adopté')
    const projetFonds = creerOperationTravaux(saisie({ decision: null, affectationFonds: affectation }))
    expect(() => adopterOperationTravaux(projetFonds, decision)).toThrow(/même majorité/)
  })
})

describe('opération sur plusieurs clés', () => {
  const surDeuxCles = (surcharge: Partial<SaisieOperationTravaux> = {}) =>
    saisie({
      cles: [
        { cleId: 'cle-001', budgetTtcCentimes: 8_000_000, financementFondsTravauxCentimes: 2_000_000 },
        { cleId: 'cle-bat-B', budgetTtcCentimes: 4_000_000, financementFondsTravauxCentimes: 0 },
      ],
      ...surcharge,
    })

  it('chaque tranche donne une échéance par clé, sur le montant à appeler de la clé ; sans grille, une seule clé', () => {
    const op = creerOperationTravaux(surDeuxCles())
    expect(echeancesTravaux(op).map((e) => [e.id, e.cleId, e.montantCentimes])).toEqual([
      ['00042-T1-C1', 'cle-001', 1_800_000],
      ['00042-T1-C2', 'cle-bat-B', 1_200_000],
      ['00042-T2-C1', 'cle-001', 2_400_000],
      ['00042-T2-C2', 'cle-bat-B', 1_600_000],
      ['00042-T3-C1', 'cle-001', 1_800_000],
      ['00042-T3-C2', 'cle-bat-B', 1_200_000],
    ])
    expect(idsEcheancesDeLaTranche(op, 2)).toEqual(['00042-T2-C1', '00042-T2-C2'])
    expect(creerOperationTravaux(saisie()).cles).toEqual([{ cleId: 'cle-001', budgetTtcCentimes: 12_000_000, financementFondsTravauxCentimes: 2_000_000 }])
    expect(idsEcheancesDeLaTranche(creerOperationTravaux(saisie()), 1)).toEqual(['00042-T1'])
  })

  it('plafond d’emploi du fonds : la part de chaque clé, répartie comme ses appels', () => {
    expect(emploisFondsTravauxDesTranches(creerOperationTravaux(surDeuxCles())).map((e) => [e.echeanceId, e.plafondCentimes])).toEqual([
      ['00042-T1-C1', 600_000],
      ['00042-T2-C1', 800_000],
      ['00042-T3-C1', 600_000],
    ])
  })

  it('refuse : part du fonds par clé manquante, totaux différents de l’opération, clé en double, première ligne autre que la clé', () => {
    const sansPart = surDeuxCles({ cles: [{ cleId: 'cle-001', budgetTtcCentimes: 8_000_000 }, { cleId: 'cle-bat-B', budgetTtcCentimes: 4_000_000 }] })
    expect(() => creerOperationTravaux(sansPart)).toThrow(/part du fonds de travaux par clé exigée/)
    expect(creerOperationTravaux({ ...sansPart, financementFondsTravauxCentimes: 0, affectationFonds: null }).cles[1].financementFondsTravauxCentimes).toBe(0)
    expect(() => creerOperationTravaux(surDeuxCles({ budgetTtcCentimes: 11_000_000 }))).toThrow(/budget des clés 12000000 centimes, celui de l'opération 11000000/)
    const partsCourtes = surDeuxCles({ cles: [{ cleId: 'cle-001', budgetTtcCentimes: 8_000_000, financementFondsTravauxCentimes: 1_000_000 }, { cleId: 'cle-bat-B', budgetTtcCentimes: 4_000_000, financementFondsTravauxCentimes: 0 }] })
    expect(() => creerOperationTravaux(partsCourtes)).toThrow(/part du fonds des clés 1000000 centimes, celui de l'opération 2000000/)
    const doublon = surDeuxCles({ cles: [{ cleId: 'cle-001', budgetTtcCentimes: 6_000_000, financementFondsTravauxCentimes: 1_000_000 }, { cleId: 'cle-001', budgetTtcCentimes: 6_000_000, financementFondsTravauxCentimes: 1_000_000 }] })
    expect(() => creerOperationTravaux(doublon)).toThrow(/clé « cle-001 » vide ou en double/)
    expect(() => creerOperationTravaux(surDeuxCles({ cleId: 'cle-bat-B' }))).toThrow(/première ligne n'est pas la clé « cle-bat-B »/)
    const partTrop = surDeuxCles({ cles: [{ cleId: 'cle-001', budgetTtcCentimes: 8_000_000, financementFondsTravauxCentimes: 0 }, { cleId: 'cle-bat-B', budgetTtcCentimes: 4_000_000, financementFondsTravauxCentimes: 5_000_000 }] })
    expect(() => creerOperationTravaux(partTrop)).toThrow(/au plus le budget de la clé/)
  })
})

describe('série de comptes de l’opération', () => {
  it('générée à la création : 102, 12, 671, 702 et 71147, auxiliaire = n° d’opération, libellé = objet de l’opération', () => {
    const op = creerOperationTravaux(saisie())
    expect(op.serieComptes.map((c) => [c.role, c.planCode, c.auxiliaire, c.intitule])).toEqual([
      ['provisionsTravauxDecides', '10200', '00042', 'Provisions pour travaux décidés'],
      ['soldeEnAttente', '12000', '00042', 'Solde en attente sur travaux et opérations exceptionnelles'],
      ['travauxDecides', '67100', '00042', "Travaux décidés par l'assemblée générale"],
      ['provisionsSurTravaux', '70200', '00042', "Provisions sur travaux du I de l'article 14-2 et opérations exceptionnelles"],
      ['subventions', '71147', '00042', 'Subventions'],
    ])
    expect(new Set(op.serieComptes.map((c) => c.libelle))).toEqual(new Set(['Ravalement façade rue']))
    expect(numeroCompteTravaux(op, 'travauxDecides', 'TILL')).toBe('TILL.67100.00042.0')
    expect(numeroCompteTravaux(op, 'subventions', 'TILL')).toBe('TILL.71147.00042.0')
    expect(projet().serieComptes).toHaveLength(5)
  })
})

describe('écriture de l’appel sur l’auxiliaire de l’opération et statut des tranches', () => {
  const SEGMENT = 'TILL'
  const cle = creerCleRepartition({
    id: 'cle-001',
    coproprieteId: 'copro-1',
    code: '001',
    libelle: 'Charges communes générales',
    lots: [
      { lotId: 'lot-1', tantiemes: 400 },
      { lotId: 'lot-2', tantiemes: 600 },
    ],
  })
  const comptes = [
    creerCompteCoproprietaire({ id: 'cpt-A', coproprieteId: 'copro-1', serie: '1', libelle: 'A' }),
    creerCompteCoproprietaire({ id: 'cpt-B', coproprieteId: 'copro-1', serie: '2', libelle: 'B' }),
  ]
  const position = (id: string, lotId: string, compteId: string) =>
    creerPosition({ id, identiteId: `i-${id}`, lotId, compteId, qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 }, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null })
  const positions = [position('p1', 'lot-1', 'cpt-A'), position('p2', 'lot-2', 'cpt-B')]
  const operation = (numero: string, budget: number) =>
    creerOperationTravaux(
      saisie({ numero, coproprieteId: 'copro-1', budgetTtcCentimes: budget, financementFondsTravauxCentimes: 0, affectationFonds: null, tranches: [{ date: '2026-05-01', tauxPct: 50 }, { date: '2026-09-01', tauxPct: 50 }] }),
    )
  const budget: EcheanceAppel = { id: 'B-2026-2', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-04-01', libelle: 'Budget 2026 — provision 2/4', montantCentimes: 20_000, nature: 'budget' }

  it('crédits par compte complet <syndicat>.70200.<n°>.0 avec le lien travaux ; débits 450 inchangés ; admis par marquerAppelees', () => {
    const op42 = operation('00042', 200_000)
    const op43 = operation('00043', 100_000)
    const horsOperation: EcheanceAppel = { ...echeancesTravaux(op43)[1], id: 'REPRISE-T1', libelle: 'Appel repris', montantCentimes: 4_000 }
    const echeances = [budget, echeancesTravaux(op42)[0], echeancesTravaux(op43)[0], horsOperation]
    const avis = avisDAppel({ echeances, cles: [cle], positions, comptes })
    const contexte = { id: 't-appel-1', date: '2026-04-20', segmentSyndicat: SEGMENT, comptes }
    // Même n° 00043 dans un autre syndicat (D1) : ne capte rien.
    const ailleurs = { ...op43, coproprieteId: 'copro-autre' }
    const traitement = traitementAppelDeFondsTravaux(avis, { ...contexte, operations: [ailleurs, op42, op43] })
    const base = traitementAppelDeFonds(avis, contexte)
    expect(traitement.mouvements.filter((m) => m.sens === 'debit')).toEqual(base.mouvements.filter((m) => m.sens === 'debit'))
    expect(traitement.mouvements.filter((m) => m.sens === 'credit').map((m) => [m.compte, m.montantCentimes, m.liens?.travauxId ?? null])).toEqual([
      ['TILL.70100.00000.0', 20_000, null],
      ['TILL.70200.00042.0', 100_000, '00042'],
      ['TILL.70200.00043.0', 50_000, '00043'],
      ['TILL.70200.00000.0', 4_000, null],
    ])
    const appelees = marquerAppelees(suivreEcheances(echeances), traitement, avis)
    expect(statutsDesTranches(op42, appelees).map((t) => [t.rang, t.statut, t.montantCentimes])).toEqual([
      [1, 'Appelé', 100_000],
      [2, 'Prévu', 100_000],
    ])
  })

  it('une échéance ne capte pas l’opération d’un autre syndicat qui émet le même identifiant (D1)', () => {
    const echeance = echeancesTravaux(operation('00044', 100_000))[0]
    const op44Ailleurs = { ...operation('00044', 100_000), coproprieteId: 'copro-autre' }
    const avis = avisDAppel({ echeances: [echeance], cles: [cle], positions, comptes })
    const contexte = { id: 't-appel-3', date: '2026-04-20', segmentSyndicat: SEGMENT, comptes }
    expect(echeance).toMatchObject({ id: '00044-T1', coproprieteId: 'copro-1' })
    expect(
      traitementAppelDeFondsTravaux(avis, { ...contexte, operations: [op44Ailleurs] })
        .mouvements.filter((m) => m.sens === 'credit')
        .map((m) => [m.compte, m.montantCentimes, m.liens?.travauxId ?? null]),
    ).toEqual([['TILL.70200.00000.0', 50_000, null]])
  })

  it('sans opération fournie, les crédits restent sur 00000 ; un n° en double dans le syndicat est refusé (D1)', () => {
    const op42 = operation('00042', 200_000)
    const avis = avisDAppel({ echeances: [echeancesTravaux(op42)[0]], cles: [cle], positions, comptes })
    const contexte = { id: 't-appel-2', date: '2026-04-20', segmentSyndicat: SEGMENT, comptes }
    expect(traitementAppelDeFondsTravaux(avis, { ...contexte, operations: [] }).mouvements.filter((m) => m.sens === 'credit')).toEqual(
      traitementAppelDeFonds(avis, contexte).mouvements.filter((m) => m.sens === 'credit'),
    )
    const homonyme = operation('00042', 50_000)
    expect(() => traitementAppelDeFondsTravaux(avis, { ...contexte, operations: [op42, homonyme] })).toThrow(/n° d'opération 00042 en double dans le syndicat copro-1/)
  })

  it('encaissements effectués de chaque tranche : le réglé des postes nés de ses échéances (Gestéam « Encaissements effectués »)', () => {
    const op42 = operation('00042', 200_000)
    const poste = (id: string, appelId: string | null, regleCentimes: number): PosteDette => ({
      id,
      compteId: 'cpt-A',
      appelId,
      typeAppel: 'Travaux',
      libelle: id,
      exigibilite: '2026-05-01',
      montantCentimes: 40_000,
      regleCentimes,
      contentieux: false,
    })
    const postes = [poste('P1', '00042-T1', 40_000), poste('P2', '00042-T1', 15_000), poste('P3', '00042-T2', 0), poste('P4', '00043-T1', 9_999), poste('P5', null, 1)]
    expect(statutsDesTranches(op42, [], postes).map((t) => [t.rang, t.encaisseCentimes])).toEqual([
      [1, 55_000],
      [2, 0],
    ])
    expect(statutsDesTranches(op42, []).map((t) => t.encaisseCentimes)).toEqual([0, 0])
  })

  it('statut de chaque tranche, distinct du statut de l’opération ; null quand les clés divergent ; autre syndicat ignoré', () => {
    const op = creerOperationTravaux(
      saisie({
        cles: [
          { cleId: 'cle-001', budgetTtcCentimes: 8_000_000, financementFondsTravauxCentimes: 2_000_000 },
          { cleId: 'cle-bat-B', budgetTtcCentimes: 4_000_000, financementFondsTravauxCentimes: 0 },
        ],
      }),
    )
    const suivies = suivreEcheances(echeancesTravaux(op)).map((e) => (e.id === '00042-T1-C1' ? { ...e, statut: 'Appelé' as const } : e))
    const ailleurs = suivreEcheances(echeancesTravaux(op)).map((e) => ({ ...e, coproprieteId: 'copro-autre', statut: 'Annulé' as const }))
    // L'autre syndicat en dernier : sans le filtre par syndicat, ses « Annulé » remplaceraient les statuts suivis.
    const tranches = statutsDesTranches(op, [...suivies, ...ailleurs])
    expect(tranches.map((t) => [t.rang, t.statut, t.echeanceIds.length])).toEqual([
      [1, null, 2],
      [2, 'Prévu', 2],
      [3, 'Prévu', 2],
    ])
    expect(op.statut).toBe('Adopté')
    expect(statutsDesTranches(projet(), []).map((t) => t.statut)).toEqual(['Prévu', 'Prévu', 'Prévu'])
  })
})

describe('règlements rattachés à l’opération', () => {
  const reglement = (id: string, statut: StatutReglementFournisseur, montantCentimes: number, travauxId: string | null, coproprieteId = 'copro-tilleuls') =>
    ({ id, coproprieteId, travauxId, statut, montantCentimes }) as ReglementFournisseur
  const reglements = [
    reglement('r1', 'Enregistré', 300_000, '00042'),
    reglement('r2', 'Rapproché', 200_000, '00042'),
    reglement('r3', 'À régler', 150_000, '00042'),
    reglement('r4', 'Annulé', 999_000, '00042'),
    reglement('r5', 'Enregistré', 50_000, '00042', 'copro-autre'),
    reglement('r6', 'Demandé', 70_000, '00099'),
    reglement('r7', 'Enregistré', 10_000, null),
  ]

  it('réglé (enregistré, rapproché) et en cours (demandé, à régler), du même syndicat seulement', () => {
    expect(reglementsDeLOperation(creerOperationTravaux(saisie()), reglements)).toEqual({
      reglementIds: ['r1', 'r2', 'r3', 'r4'],
      regleCentimes: 500_000,
      enCoursCentimes: 150_000,
    })
  })

  it('signale les règlements dont le n° ne désigne aucune opération de leur syndicat', () => {
    expect(reglementsSansOperation([creerOperationTravaux(saisie())], reglements)).toEqual(['r5', 'r6'])
  })
})

describe('en-tête : textes cités et questions ouvertes', () => {
  const { texte, item } = enTeteDuModule('travaux-operations')

  it('ventilation entre clés : au prorata du montant à appeler de chaque clé, comme le code (🔵 et 🔴)', () => {
    expect(texte).not.toContain('au prorata du budget de chaque clé')
    expect(item('ventilation d')).toContain('au prorata du montant à appeler de chaque clé (budget de la clé − part du fonds de travaux de la clé)')
    expect(texte).toContain(
      "« Un appel d'une opération sur plusieurs clés se ventile-t-il au prorata du montant à appeler de chaque clé (budget de la clé − part du fonds de travaux de la clé) ? »",
    )
  })

  it('D. 1967 art. 35 : le syndic « peut exiger » ; travaux urgents (art. 37) posés en question, hors de ce module', () => {
    expect(texte).not.toMatch(/le syndic exige les provisions/)
    expect(texte).toContain('art. 35 : « Le syndic peut exiger le versement » (3° : des provisions de ces dépenses)')
    expect(texte).toMatch(/art\. 37, par dérogation à l'art\. 35 : en cas d'urgence, une provision d'au plus le tiers du devis estimatif/)
    expect(texte).toContain(
      '« Les travaux urgents (L. 1965 art. 18, I ; D. 1967 art. 37 ; compte 672 "Travaux urgents" ; Gestéam "Appel travaux urgents" et "Travaux urgents - Provisions") forment-ils une filière distincte de l\'opération décidée ? »',
    )
  })

  it('décision qui tombe (jugement, nouvelle assemblée) : question posée mot pour mot', () => {
    expect(texte).toContain(
      '« Une opération adoptée dont la résolution est annulée par jugement ou abandonnée par une nouvelle assemblée passe-t-elle à "Rejeté", et depuis quels statuts ? »',
    )
  })

  it('compte de charge des études et diagnostics : question sur le 673 (arrêté, art. 7 et 8)', () => {
    expect(texte).toContain(
      '« Les opérations d\'études, de diagnostic ou d\'expertise gardent-elles le 671xx de Gestéam ou passent-elles au 673 "Etudes techniques, diagnostic, consultation" (arrêté, art. 7 et 8) ? »',
    )
  })

  it('affectation du fonds par l’administrateur provisoire : référence au registre et question ouverte', () => {
    expect(texte).toContain("« <référence au registre> (décision de l'administrateur provisoire du <date>) »")
    expect(texte).toContain(
      "« La décision de l'administrateur provisoire investi des pouvoirs de l'assemblée (art. 29-1, I, al. 2) tient-elle lieu de la décision d'affectation du fonds de travaux par l'assemblée (art. 14-2-1, I, al. 7) ? »",
    )
  })

  it('« Rejeté » et « Réparti » : définitifs, chacun avec sa seule sortie', () => {
    expect(item('statut par défaut')).toContain(
      '« Réparti » ne se quitte que par l\'annulation de sa répartition (annulerRepartitionOperation), « Rejeté » que par l\'annulation tracée du rejet (annulerDernierChangementStatut)',
    )
    expect(texte).not.toContain('« Réparti » et « Rejeté » sont définitifs (sauf annulation de la répartition)')
  })

  it('dates des changements : lues sur les changements en vigueur ; la date vraie se saisit après l’annulation', () => {
    expect(item('dates des changements')).toContain(
      'un changement annulé ne borne plus aucune date, ni son annulation : la date vraie, même antérieure à la date erronée, se saisit après l\'annulation (statut, adoption après un rejet annulé, répartition)',
    )
    expect(texte).toContain('lignes écrites et relues dans l\'ordre de saisie (createdAt), pas par date d\'effet')
  })

  it('annulation d’une répartition : écriture contraire, jamais avant la répartition qu’elle contre-passe (art. 5)', () => {
    expect(item('dates des changements')).toContain(
      'sauf l\'annulation d\'une répartition : écriture contraire, elle ne précède pas la répartition qu\'elle contre-passe (arrêté, art. 5 ; comme J9, reglements-fournisseurs.ts)',
    )
    expect(texte).toContain('art. 5 : « Une écriture erronée est annulée par une écriture contraire »')
  })
})
