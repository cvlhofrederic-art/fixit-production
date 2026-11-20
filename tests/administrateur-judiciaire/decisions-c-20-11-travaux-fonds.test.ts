import { describe, expect, it } from 'vitest'
import { suivreEcheances, type EcheanceAppelSuivie } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import {
  controlerAffectationFondsTravaux,
  estDecisionAdministrateurProvisoire,
  type DecisionAdministrateurProvisoire,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import {
  alertesPartsDesClesAuFondsDisponible,
  emploiDepuisOperation,
  LIBELLE_PART_CLE_AU_DELA_DU_FONDS,
  partsFondsTravauxParLot,
  type EmploiFondsTravaux,
  type VersementFondsTravaux,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux-lots'
import type { ReglementFournisseur } from '@/lib/administrateur-judiciaire/domain/reglements-fournisseurs'
import { creerCleRepartition } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import {
  CONSIGNE_OPERATION_EN_DOUBLE,
  controlerReglementDepuisLeFondsOperation,
  droitsProportionnelsTravauxParOperation,
} from '@/lib/administrateur-judiciaire/domain/travaux-budget'
import {
  adopterOperationTravaux,
  aideMajoriteDesTravaux,
  annulerAdoptionOperationTravaux,
  annulerDernierChangementStatut,
  annulerEcheancesNonAppeleesDeLOperation,
  changerStatutOperationTravaux,
  controlerPouvoirsDecisionTravaux,
  creerOperationTravaux,
  echeancesTravaux,
  majoriteHabituelleDesTravaux,
  refusAppelOuOrdreDeServiceOperation,
  rejeterOperationTravauxAdoptee,
  type DecisionTravaux,
  type OperationTravaux,
  type SaisieOperationTravaux,
} from '@/lib/administrateur-judiciaire/domain/travaux-operations'
import {
  creerVirementInterne,
  rattacherReglementAuVirementEmploi,
  type CompteVirementInterne,
  type SaisieVirementInterne,
} from '@/lib/administrateur-judiciaire/domain/virement-interne'
import { enTeteDuModule } from './en-tete-module'

/**
 * Décisions du 20/11/2026 (partie C du relevé des questions ouvertes du code), thème « travaux et fonds de travaux » :
 * F62, F65, F66, F67, F69 (opérations de travaux) ; F93, F94, F95, F96 (fonds de travaux). Données fictives.
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
    { date: '2026-08-01', tauxPct: 70 },
  ],
  ...surcharge,
})

const adoptee = (): OperationTravaux => creerOperationTravaux(saisie())
const commencee = (): OperationTravaux =>
  changerStatutOperationTravaux(changerStatutOperationTravaux(adoptee(), 'Commandé', { le: '2026-04-01' }), 'Commencé', { le: '2026-05-15' })
const terminee = (): OperationTravaux => changerStatutOperationTravaux(commencee(), 'Terminé', { le: '2026-09-30' })

const reglement = (surcharge: Partial<ReglementFournisseur> = {}): ReglementFournisseur =>
  ({
    id: 'reg-1',
    coproprieteId: 'copro-tilleuls',
    mandatId: 'm-1',
    banqueId: 'b-courant',
    travauxId: '00042',
    factureId: 'fac-1',
    statut: 'Enregistré',
    montantCentimes: 150_000,
    ...surcharge,
  }) as ReglementFournisseur

const cleFonds = creerCleRepartition({
  id: 'cle-001',
  coproprieteId: 'copro-tilleuls',
  code: '001',
  libelle: 'Charges communes générales',
  lots: [
    { lotId: 'lot-1', tantiemes: 400 },
    { lotId: 'lot-2', tantiemes: 600 },
  ],
})
const versementFonds = (id: string, lotId: string, montantCentimes: number, date = '2026-01-10'): VersementFondsTravaux => ({
  id,
  lotId,
  compteId: `cpt-${lotId}`,
  date,
  montantCentimes,
  appelId: 'FT-1',
  cle: '001',
  source: 'encaissement',
  cotisation: { posteId: `FT-1:${lotId}`, exigibilite: '2026-01-01', appeleCentimes: montantCentimes },
})
const emploiFonds = (surcharge: Partial<EmploiFondsTravaux> = {}): EmploiFondsTravaux => ({
  id: 'EMP-1',
  date: '2026-02-01',
  montantCentimes: 3_000,
  cleId: 'cle-001',
  decaissement: { objet: 'travaux_ppt', montantCentimes: 3_000, decisionAg: { dateAg: '2026-01-15', numeroResolution: '12' } },
  operationNumero: null,
  partOperationCentimes: null,
  dateDecision: null,
  ...surcharge,
})

// ─── F62 ──────────────────────────────────────────────────────────────────────────────────────

describe('F62 — droit proportionnel : une opération fournie deux fois reste refusée, message plus clair', () => {
  const doublon = () =>
    droitsProportionnelsTravauxParOperation([
      { numero: 'T-1', montantTravauxHtCentimes: 1_000_000 },
      { numero: ' T-1 ', montantTravauxHtCentimes: 250_000 },
    ])

  it('le refus dit d’additionner les montants de l’opération avant le calcul, et cite la décision', () => {
    expect(CONSIGNE_OPERATION_EN_DOUBLE).toBe("additionnez les montants de l'opération avant le calcul")
    expect(doublon).toThrow(/Opération T-1 fournie deux fois : refusée ; additionnez les montants de l'opération avant le calcul/)
    expect(doublon).toThrow(/deux calculs pour une même opération feraient repartir le barème de sa première tranche/)
    expect(doublon).toThrow(/des travaux supplémentaires qui complètent le même objet restent la même opération/)
    expect(doublon).toThrow(/décision du 20\/11\/2026, partie C, F62/)
    expect(doublon).not.toThrow(/à confirmer/)
  })

  it('en-tête : la question quitte le 🔴, la décision est citée', () => {
    const { texte } = enTeteDuModule('travaux-budget')
    const nonEtabli = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(nonEtabli).not.toContain('Une même opération fournie deux fois')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F62)')
    expect(texte).toContain('arrêté du 8 octobre 2015, art. 11')
  })
})

// ─── F65 ──────────────────────────────────────────────────────────────────────────────────────

describe('F65 — part du fonds de la clé comparée, dès la décision, au fonds disponible de ses lots (alerte, sans blocage)', () => {
  const cleGenerale = cleFonds
  const cleBatB = creerCleRepartition({ id: 'cle-bat-B', coproprieteId: 'copro-tilleuls', code: '002', libelle: 'Bâtiment B', lots: [{ lotId: 'lot-2', tantiemes: 1 }] })
  const verse = versementFonds
  const etat = partsFondsTravauxParLot({
    versements: [verse('v1', 'lot-1', 1_200_000), verse('v2', 'lot-2', 500_000)],
    emplois: [],
    cles: [cleGenerale, cleBatB],
    date: '2026-03-12',
  })
  const deuxCles = creerOperationTravaux(
    saisie({
      financementFondsTravauxCentimes: 2_000_000,
      cles: [
        { cleId: 'cle-001', budgetTtcCentimes: 8_000_000, financementFondsTravauxCentimes: 1_400_000 },
        { cleId: 'cle-bat-B', budgetTtcCentimes: 4_000_000, financementFondsTravauxCentimes: 600_000 },
      ],
    }),
  )

  it('alerte « part de la clé supérieure au fonds disponible de ses lots au [date] », clé par clé', () => {
    expect(LIBELLE_PART_CLE_AU_DELA_DU_FONDS).toBe('part de la clé supérieure au fonds disponible de ses lots au')
    const alertes = alertesPartsDesClesAuFondsDisponible(deuxCles, etat, [cleGenerale, cleBatB])
    expect(alertes.map((a) => [a.cleId, a.partCleCentimes, a.disponibleCentimes])).toEqual([['cle-bat-B', 600_000, 500_000]])
    expect(alertes[0].code).toBe('part_cle_superieure_au_fonds_disponible')
    expect(alertes[0].bloquant).toBe(false)
    expect(alertes[0].message).toContain('part de la clé supérieure au fonds disponible de ses lots au 12/03/2026')
    expect(alertes[0].message).toContain('versé, moins les emplois déjà faits')
    expect(alertes[0].message).toContain('décision du 20/11/2026, partie C, F65')
  })

  it('aucune alerte quand chaque part est couverte ; la clé de l’opération doit être fournie', () => {
    expect(alertesPartsDesClesAuFondsDisponible(adoptee(), etat, [cleGenerale])).toHaveLength(1)
    const petite = creerOperationTravaux(saisie({ financementFondsTravauxCentimes: 1_000_000 }))
    expect(alertesPartsDesClesAuFondsDisponible(petite, etat, [cleGenerale])).toEqual([])
    expect(() => alertesPartsDesClesAuFondsDisponible(deuxCles, etat, [cleGenerale])).toThrow(/clé « cle-bat-B »/)
  })

  it('les emplois déjà faits réduisent le fonds disponible', () => {
    const apresEmploi = partsFondsTravauxParLot({
      versements: [verse('v1', 'lot-1', 1_200_000), verse('v2', 'lot-2', 900_000)],
      emplois: [
        emploiFonds({
          montantCentimes: 500_000,
          cleId: 'cle-bat-B',
          decaissement: { objet: 'travaux_hors_ppt', montantCentimes: 500_000, decisionAg: { dateAg: '2026-01-15', numeroResolution: '3' } },
        }),
      ],
      cles: [cleGenerale, cleBatB],
      date: '2026-03-12',
    })
    const alertes = alertesPartsDesClesAuFondsDisponible(deuxCles, apresEmploi, [cleGenerale, cleBatB])
    expect(alertes.map((a) => [a.cleId, a.disponibleCentimes])).toEqual([['cle-bat-B', 400_000]])
  })

  it('en-tête de travaux-operations : la question du rapprochement par clé quitte le 🔴', () => {
    const { texte } = enTeteDuModule('travaux-operations')
    const nonEtabli = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(nonEtabli).not.toContain('La part du fonds de travaux par clé doit-elle être rapprochée des cotisations versées')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F65)')
  })
})

// ─── F66 ──────────────────────────────────────────────────────────────────────────────────────

describe('F66 (1) — opération reprise déjà répartie : création à « Réparti » en mode « reprise » seulement', () => {
  const reprise = {
    motif: "Opération répartie par le précédent syndic, reprise à la prise de fonction",
    exercice: '2025',
    date: '2025-12-31',
    assembleeApprobation: { date: '2026-06-20', resolution: 'Résolution 3' },
  }
  const ancienne = (surcharge: Partial<SaisieOperationTravaux> = {}) =>
    saisie({ decision: { date: '2025-03-12', resolution: 'Résolution 8' }, statut: 'Réparti', repriseRepartie: reprise, ...surcharge })

  it('admise avec le motif et la référence de la répartition d’origine, sans aucune écriture, tracée', () => {
    const op = creerOperationTravaux(ancienne())
    expect(op.statut).toBe('Réparti')
    expect(op.historiqueStatuts).toHaveLength(2)
    expect(op.historiqueStatuts[1]).toMatchObject({ de: 'Adopté', vers: 'Réparti', le: '2025-12-31', horsSequence: true, annulation: false, traitementId: null })
    expect(op.historiqueStatuts[1].reprise).toEqual(reprise)
    expect(op.historiqueStatuts[1].motif).toContain('exercice 2025')
    expect(op.historiqueStatuts[1].motif).toContain('20/06/2026')
    expect(op.historiqueStatuts[1].motif).toContain(reprise.motif)
  })

  it('refusée sans le mode « reprise », sans motif, sans référence complète, avant la décision, ou hors de « Réparti »', () => {
    expect(() => creerOperationTravaux(saisie({ statut: 'Réparti' }))).toThrow(/mode « reprise »/)
    expect(() => creerOperationTravaux(ancienne({ repriseRepartie: { ...reprise, motif: ' ' } }))).toThrow(/motif/)
    expect(() => creerOperationTravaux(ancienne({ repriseRepartie: { ...reprise, exercice: '' } }))).toThrow(/exercice/)
    expect(() => creerOperationTravaux(ancienne({ repriseRepartie: { ...reprise, assembleeApprobation: { date: '2026-13-01' } } }))).toThrow(/assemblée/)
    expect(() => creerOperationTravaux(ancienne({ repriseRepartie: { ...reprise, date: '2025-01-31' } }))).toThrow(/avant la décision/)
    expect(() => creerOperationTravaux(ancienne({ statut: 'Terminé' }))).toThrow(/réservé à la création à « Réparti »/)
    expect(() => creerOperationTravaux(ancienne({ changementStatut: { le: '2025-12-31', motif: 'x' } }))).toThrow(/sans objet/)
  })
})

describe('F66 (2) — adoption saisie par erreur : annulation tracée (motif, date, auteur), sans appel, règlement ni emploi', () => {
  const sansActe = { suivies: [], reglements: [], emplois: [] }

  it('retour tracé à « Projet » : la décision quitte l’opération, la ligne reste à l’historique', () => {
    const op = adoptee()
    const annulee = annulerAdoptionOperationTravaux(op, { le: '2026-03-20', motif: 'Résolution saisie sur la mauvaise opération', auteur: 'collaborateur-7' }, sansActe)
    expect(annulee.statut).toBe('Projet')
    expect(annulee.decision).toBeNull()
    expect(annulee.historiqueStatuts).toHaveLength(2)
    expect(annulee.historiqueStatuts[1]).toMatchObject({ de: 'Adopté', vers: 'Projet', le: '2026-03-20', annulation: true, auteur: 'collaborateur-7' })
    expect(annulee.historiqueStatuts[1].motif).toContain('Résolution 8 (AG du 12/03/2026)')
    // une nouvelle adoption reste possible, à sa vraie date
    expect(adopterOperationTravaux(annulee, { date: '2026-03-10', resolution: 'Résolution 9' }).statut).toBe('Adopté')
  })

  it('refusée avec un appel, un règlement ou un emploi du fonds : il faut d’abord annuler ces actes', () => {
    const op = adoptee()
    const suivies = suivreEcheances(echeancesTravaux(op)).map((e, i): EcheanceAppelSuivie => (i === 0 ? { ...e, statut: 'Appelé', traitementId: 't-appel' } : e))
    const quand = { le: '2026-03-20', motif: 'Erreur de saisie', auteur: 'collaborateur-7' }
    expect(() => annulerAdoptionOperationTravaux(op, quand, { ...sansActe, suivies })).toThrow(/appel.*00042-T1.*annuler d'abord ces actes/)
    expect(() => annulerAdoptionOperationTravaux(op, quand, { ...sansActe, reglements: [reglement()] })).toThrow(/règlement.*reg-1/)
    expect(() => annulerAdoptionOperationTravaux(op, quand, { ...sansActe, reglements: [reglement({ statut: 'Annulé' })] })).not.toThrow()
    expect(() =>
      annulerAdoptionOperationTravaux(op, quand, { ...sansActe, emplois: [{ id: 'EMP-1', operationNumero: '00042' }] }),
    ).toThrow(/emploi du fonds.*EMP-1/)
    expect(() => annulerAdoptionOperationTravaux(op, quand, { ...sansActe, emplois: [{ id: 'EMP-2', operationNumero: '00099' }] })).not.toThrow()
  })

  it('refusée sans motif ou sans auteur, et au-delà d’« Adopté » (annuler d’abord les changements suivants)', () => {
    expect(() => annulerAdoptionOperationTravaux(adoptee(), { le: '2026-03-20', motif: ' ', auteur: 'c-7' }, sansActe)).toThrow(/motif/)
    expect(() => annulerAdoptionOperationTravaux(adoptee(), { le: '2026-03-20', motif: 'x', auteur: '' }, sansActe)).toThrow(/auteur/)
    expect(() => annulerAdoptionOperationTravaux(commencee(), { le: '2026-06-01', motif: 'x', auteur: 'c-7' }, sansActe)).toThrow(/annulerDernierChangementStatut/)
    expect(() => annulerDernierChangementStatut(adoptee(), { le: '2026-03-20', motif: 'x' })).toThrow(/annulerAdoptionOperationTravaux/)
  })
})

// ─── F67 ──────────────────────────────────────────────────────────────────────────────────────

describe('F67 — résolution annulée en justice ou rapportée : passage tracé à « Rejeté »', () => {
  const jugement = { nature: 'jugement' as const, juridiction: 'Tribunal judiciaire de Lyon', date: '2026-06-10', numero: 'RG 26/04567' }
  const nouvelleAg = { nature: 'assemblee' as const, dateAg: '2026-06-15', numeroResolution: '5' }

  it('depuis « Commencé » : « Rejeté » tracé avec le motif et l’acte ; la décision reste, l’opération ne s’appelle plus', () => {
    const { operation, alerte } = rejeterOperationTravauxAdoptee(commencee(), { le: '2026-06-12', motif: 'Résolution 8 annulée', acte: jugement })
    expect(alerte).toBeNull()
    expect(operation.statut).toBe('Rejeté')
    expect(operation.decision).toEqual({ date: '2026-03-12', resolution: 'Résolution 8' })
    const dernier = operation.historiqueStatuts.at(-1)
    expect(dernier).toMatchObject({ de: 'Commencé', vers: 'Rejeté', le: '2026-06-12', annulation: false, acte: jugement })
    expect(dernier?.motif).toContain('jugement n° RG 26/04567 du 10/06/2026, Tribunal judiciaire de Lyon')
    expect(() => echeancesTravaux(operation)).toThrow(/plus aucun appel ni ordre de service/)
    expect(refusAppelOuOrdreDeServiceOperation(operation)?.motif).toMatch(/plus aucun appel ni ordre de service/)
    expect(refusAppelOuOrdreDeServiceOperation(commencee())).toBeNull()
  })

  it('depuis « Adopté » ou « Commandé », sur une nouvelle assemblée ; l’annulation tracée du rejet rétablit le statut', () => {
    expect(rejeterOperationTravauxAdoptee(adoptee(), { le: '2026-06-15', motif: 'Travaux abandonnés', acte: nouvelleAg }).operation.statut).toBe('Rejeté')
    const commandee = changerStatutOperationTravaux(adoptee(), 'Commandé', { le: '2026-04-01' })
    const { operation } = rejeterOperationTravauxAdoptee(commandee, { le: '2026-06-15', motif: 'Travaux abandonnés', acte: nouvelleAg })
    expect(operation.historiqueStatuts.at(-1)?.motif).toContain("résolution n° 5 de l'assemblée du 15/06/2026")
    expect(annulerDernierChangementStatut(operation, { le: '2026-06-16', motif: 'Résolution rapportée par erreur' }).statut).toBe('Commandé')
  })

  it('motif et acte exigés, acte complet, ni avant la décision, ni après le passage', () => {
    const op = commencee()
    expect(() => rejeterOperationTravauxAdoptee(op, { le: '2026-06-12', motif: ' ', acte: jugement })).toThrow(/motif/)
    expect(() => rejeterOperationTravauxAdoptee(op, { le: '2026-06-12', motif: 'x', acte: { ...jugement, numero: '' } })).toThrow(/n° du jugement/)
    expect(() => rejeterOperationTravauxAdoptee(op, { le: '2026-06-12', motif: 'x', acte: { ...jugement, date: '2026-03-01' } })).toThrow(/antérieur à la décision/)
    expect(() => rejeterOperationTravauxAdoptee(op, { le: '2026-06-09', motif: 'x', acte: jugement })).toThrow(/avant l'acte/)
    expect(() => rejeterOperationTravauxAdoptee(creerOperationTravaux(saisie({ decision: null, financementFondsTravauxCentimes: 0, affectationFonds: null })), { le: '2026-06-12', motif: 'x', acte: jugement })).toThrow(/projet/)
  })

  it('depuis « Terminé », « À clôturer » ou « Réparti » : pas de passage automatique, une alerte à traiter', () => {
    const op = terminee()
    const { operation, alerte } = rejeterOperationTravauxAdoptee(op, { le: '2026-10-12', motif: 'Résolution 8 annulée', acte: { ...jugement, date: '2026-10-10' } })
    expect(operation).toBe(op)
    expect(alerte?.code).toBe('decision_annulee_travaux_faits')
    expect(alerte?.message).toMatch(/« Terminé » : travaux faits ; pas de passage automatique à « Rejeté »/)
    expect(alerte?.message).toContain('décision du 20/11/2026, partie C, F67')
  })

  it('le passage « à la main » vers « Rejeté » reste réservé au projet et renvoie à la transition tracée', () => {
    expect(() => changerStatutOperationTravaux(adoptee(), 'Rejeté', { le: '2026-06-01', motif: 'Résolution annulée par jugement' })).toThrow(
      /seul un projet est rejeté ici.*rejeterOperationTravauxAdoptee/,
    )
  })

  it('les échéances non appelées de l’opération s’annulent, les appelées restent (écritures gardées)', () => {
    const op = commencee()
    const suivies = suivreEcheances(echeancesTravaux(op))
    // première tranche appelée (traitement fictif), seconde encore prévue
    const appelees = suivies.map((e, i): EcheanceAppelSuivie => (i === 0 ? { ...e, statut: 'Appelé', traitementId: 't-appel-1', echeancesDeLAppel: [e.id] } : e))
    const autre = { ...suivies[1], id: '00099-T1' }
    const { operation } = rejeterOperationTravauxAdoptee(op, { le: '2026-06-12', motif: 'Résolution 8 annulée', acte: jugement })
    const apres = annulerEcheancesNonAppeleesDeLOperation(operation, [...appelees, autre])
    expect(apres.map((e) => [e.id, e.statut])).toEqual([
      ['00042-T1', 'Appelé'],
      ['00042-T2', 'Annulé'],
      ['00099-T1', 'Prévu'],
    ])
    expect(() => annulerEcheancesNonAppeleesDeLOperation(op, suivies)).toThrow(/« Rejeté »/)
  })
})

// ─── F69 ──────────────────────────────────────────────────────────────────────────────────────

describe('F69 (1) — pouvoirs de l’assemblée portés par le mandat : décision de l’administrateur provisoire contrôlée', () => {
  const decisionAp: DecisionTravaux = { date: '2026-03-12', resolution: 'Registre AP-12', origine: 'administrateur' }

  it('aucun pouvoir : bloquant ; une partie : alerte « à vérifier dans l’ordonnance » ; tous : rien', () => {
    expect(controlerPouvoirsDecisionTravaux(decisionAp, 'aucun')).toMatchObject({ bloquant: true, fondement: 'L. 1965 art. 29-1, I, al. 2' })
    const partie = controlerPouvoirsDecisionTravaux(decisionAp, 'partie')
    expect(partie).toMatchObject({ bloquant: false, aConfirmer: false })
    expect(partie?.message).toContain("à vérifier dans l'ordonnance")
    expect(partie?.message).toContain('décision du 20/11/2026, partie C, F69')
    expect(controlerPouvoirsDecisionTravaux(decisionAp, 'tous')).toBeNull()
    expect(controlerPouvoirsDecisionTravaux({ date: '2026-03-12', resolution: 'Résolution 8' }, 'aucun')).toBeNull()
    expect(controlerPouvoirsDecisionTravaux(decisionAp, undefined)).toBeNull()
  })

  it('étendue inconnue au mandat (null) : alerte non bloquante, à confirmer (question restée ouverte)', () => {
    expect(controlerPouvoirsDecisionTravaux(decisionAp, null)).toMatchObject({ bloquant: false, aConfirmer: true })
  })

  it('création et adoption refusées quand le mandat ne confie aucun pouvoir ; étendue contraire à celle de la décision : refus', () => {
    const sansFonds = { financementFondsTravauxCentimes: 0, affectationFonds: null }
    expect(() => creerOperationTravaux(saisie({ ...sansFonds, decision: decisionAp }), { pouvoirsAgDuMandat: 'aucun' })).toThrow(/aucun pouvoir de l'assemblée/)
    expect(creerOperationTravaux(saisie({ ...sansFonds, decision: decisionAp }), { pouvoirsAgDuMandat: 'partie' }).statut).toBe('Adopté')
    const projet = creerOperationTravaux(saisie({ ...sansFonds, decision: null }))
    expect(() => adopterOperationTravaux(projet, decisionAp, { pouvoirsAgDuMandat: 'aucun' })).toThrow(/aucun pouvoir de l'assemblée/)
    expect(() => creerOperationTravaux(saisie({ ...sansFonds, decision: { ...decisionAp, pouvoirsAgConfies: 'tous' } }), { pouvoirsAgDuMandat: 'partie' })).toThrow(
      /différente de celle du mandat/,
    )
  })
})

describe('F69 (2) — majorité : majorité habituelle du type de travaux, alerte si la majorité saisie est plus faible', () => {
  it('majorité habituelle lue sur le type, ou sur la nature donnée', () => {
    expect(majoriteHabituelleDesTravaux({ type: 'Ravalement' })).toMatchObject({ majorite: 'art24', nature: 'entretien', source: 'type' })
    expect(majoriteHabituelleDesTravaux({ type: 'Sécurité' })).toMatchObject({ majorite: 'art24', fondement: 'L. 1965 art. 24, II, a' })
    expect(majoriteHabituelleDesTravaux({ type: 'Etudes' })).toBeNull()
    expect(majoriteHabituelleDesTravaux({ type: 'Ascenseur' }, 'transformation_amelioration')).toMatchObject({ majorite: 'art25', source: 'nature' })
  })

  it('majorité saisie plus faible : alerte, jamais un blocage ; égale ou plus forte : aucune', () => {
    const op = (majorite: DecisionTravaux['majorite']) => creerOperationTravaux(saisie({ type: 'Ascenseur', decision: { date: '2026-03-12', resolution: 'Résolution 8', majorite } }))
    const aide = aideMajoriteDesTravaux(op('art24'), 'transformation_amelioration')
    expect(aide.habituelle?.majorite).toBe('art25')
    expect(aide.alerte).toMatch(/majorité saisie \(art\. 24\) plus faible que la majorité habituelle \(art\. 25\)/)
    expect(aide.alerte).toContain('décision du 20/11/2026, partie C, F69')
    expect(aideMajoriteDesTravaux(op('art25'), 'transformation_amelioration').alerte).toBeNull()
    expect(aideMajoriteDesTravaux(op('art24')).alerte).toBeNull()
    expect(aideMajoriteDesTravaux(op(null), 'transformation_amelioration').alerte).toBeNull()
  })

  it('en-tête : les deux questions de F69 quittent le 🔴, sauf l’étendue non saisie', () => {
    const { texte } = enTeteDuModule('travaux-operations')
    const nonEtabli = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(nonEtabli).not.toContain('La majorité requise se contrôle-t-elle selon la nature des travaux ?')
    expect(nonEtabli).not.toContain("Faut-il vérifier que l'ordonnance confie à l'administrateur provisoire le pouvoir de décider ces travaux ?")
    expect(nonEtabli).toContain('étendue des pouvoirs non saisie au mandat')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F69)')
  })
})

// ─── F93 ──────────────────────────────────────────────────────────────────────────────────────

const versementsFonds = [versementFonds('v1', 'lot-1', 2_000), versementFonds('v2', 'lot-2', 1_000)]
describe('F93 — dépense du fonds : par défaut, tantièmes de la clé plafonnés à la part disponible de chaque lot', () => {
  it('défaut : quote-part en tantièmes, plafonnée ; le reste n’est jamais pris sur les autres lots, il est « reste à appeler »', () => {
    const etat = partsFondsTravauxParLot({ versements: versementsFonds, emplois: [emploiFonds()], cles: [cleFonds], date: '2026-02-01' })
    expect(etat.parts.map((p) => [p.lotId, p.employeCentimes, p.partCentimes])).toEqual([
      ['lot-1', 1_200, 800],
      ['lot-2', 1_000, 0],
    ])
    const reste = etat.anomalies.filter((a) => a.code === 'reste_a_appeler_lot')
    expect(reste).toHaveLength(1)
    expect(reste[0]).toMatchObject({ refId: 'EMP-1', lotIds: ['lot-2'], nonCouvertCentimes: 800 })
    expect(reste[0].message).toContain('reste à appeler auprès de ce lot')
    expect(reste[0].message).toContain('décision du 20/11/2026, partie C, F93')
    expect(etat.anomalies.some((a) => a.code === 'part_negative')).toBe(false)
    expect(etat.totalPreleveCentimes).toBe(3_000)
    expect(etat.soldeFondsCentimes).toBe(0)
  })

  it('le mode « tantièmes » explicite est le même : il ne rend plus de part négative', () => {
    const etat = partsFondsTravauxParLot({ versements: versementsFonds, emplois: [emploiFonds()], cles: [cleFonds], date: '2026-02-01', mode: 'tantiemes' })
    expect(etat.parts.every((p) => p.partCentimes >= 0)).toBe(true)
    expect(etat.anomalies.map((a) => a.code)).toEqual(['reste_a_appeler_lot'])
  })

  it('le prorata des parts reste une option', () => {
    const etat = partsFondsTravauxParLot({ versements: versementsFonds, emplois: [emploiFonds()], cles: [cleFonds], date: '2026-02-01', mode: 'prorata' })
    expect(etat.parts.map((p) => [p.lotId, p.employeCentimes])).toEqual([
      ['lot-1', 2_000],
      ['lot-2', 1_000],
    ])
    expect(etat.anomalies).toEqual([])
  })

  it('en-têtes : la méthode de déduction quitte le 🔴 (fonds-travaux-lots.ts et fonds-travaux.ts)', () => {
    for (const nom of ['fonds-travaux-lots', 'fonds-travaux']) {
      const { texte } = enTeteDuModule(nom)
      expect(texte).toContain('Décision du 20/11/2026 (partie C, F93)')
    }
    const lots = enTeteDuModule('fonds-travaux-lots').texte
    const nonEtabli = lots.slice(lots.indexOf('🔴 Non établi'), lots.indexOf('(D. 1967 art. 6-2, relu sur Légifrance le 30/10/2026)'))
    expect(nonEtabli).toContain('dernière cotisation versée')
    expect(nonEtabli).not.toContain('méthode de déduction')
    expect(nonEtabli).not.toContain("date d'une ordonnance du juge, même structurée")
  })
})

// ─── F94 ──────────────────────────────────────────────────────────────────────────────────────

describe('F94 — dépense du fonds datée avant l’ordonnance du juge qui l’autorise', () => {
  const ordonnance = { juridiction: 'Tribunal judiciaire de Lyon', date: '2026-02-02', numero: 'RG 26/00042' }
  const surOrdonnance = (date: string) =>
    emploiFonds({ date, montantCentimes: 1_000, decaissement: { objet: 'redressement_29_14', montantCentimes: 1_000, decisionAg: null, autorisationJuge: ordonnance } })

  it('la veille : signalée, non déduite des parts, mais sortie du fonds ; le même jour : admise', () => {
    const veille = partsFondsTravauxParLot({ versements: versementsFonds, emplois: [surOrdonnance('2026-02-01')], cles: [cleFonds], date: '2026-02-28' })
    const avant = veille.anomalies.find((a) => a.code === 'emploi_avant_decision')
    expect(avant?.message).toContain("avant l'ordonnance du juge du 02/02/2026")
    expect(veille.totalDeduitDesPartsCentimes).toBe(0)
    expect(veille.totalPreleveCentimes).toBe(1_000)
    const memeJour = partsFondsTravauxParLot({ versements: versementsFonds, emplois: [surOrdonnance('2026-02-02')], cles: [cleFonds], date: '2026-02-28' })
    expect(memeJour.anomalies.some((a) => a.code === 'emploi_avant_decision')).toBe(false)
    expect(memeJour.totalDeduitDesPartsCentimes).toBe(1_000)
  })

  it('décision d’AG en texte libre d’avant J30 : alerte « date non contrôlée », à ressaisir en forme structurée', () => {
    const libre = emploiFonds({ montantCentimes: 1_000, decaissement: { objet: 'travaux_ppt', montantCentimes: 1_000, decisionAg: 'AG du 15/01/2026, résolution 12' } })
    const etat = partsFondsTravauxParLot({ versements: versementsFonds, emplois: [libre], cles: [cleFonds], date: '2026-02-28' })
    const forme = etat.anomalies.find((a) => a.code === 'emploi_forme_incomplete')
    expect(forme?.message).toContain('date non contrôlée')
    expect(forme?.message).toContain('la ressaisir en forme structurée')
    expect(etat.totalDeduitDesPartsCentimes).toBe(1_000)
  })
})

// ─── F95 ──────────────────────────────────────────────────────────────────────────────────────

const compteBancaire = (surcharge: Partial<CompteVirementInterne> = {}): CompteVirementInterne => ({
  banqueId: 'b-courant',
  coproprieteId: 'copro-tilleuls',
  nature: 'courant',
  iban: 'FR76 3000 6000 0112 3456 7890 189',
  bic: 'AGRIFRPP',
  compte512: 'TILL.51200.00000.0',
  actif: true,
  ...surcharge,
})
const COURANT = compteBancaire()
const FONDS = compteBancaire({ banqueId: 'b-fonds', nature: 'fonds_travaux', iban: 'FR14 2004 1010 0505 0001 3M02 606', bic: 'PSSTFRPP', compte512: 'TILL.51210.00000.0' })
const virementSortie = (surcharge: Partial<SaisieVirementInterne> = {}) =>
  creerVirementInterne(
    {
      id: 'vi-1',
      numero: 'BAB-0001',
      date: '2026-10-29',
      coproprieteId: 'copro-tilleuls',
      mandatId: 'm-1',
      traitementId: 't-bab-1',
      rang: 1,
      nombreOrdresDuLot: 1,
      source: FONDS,
      destination: COURANT,
      montantCentimes: 250_000,
      libelle: 'Travaux du plan, tranche 1',
      emploiFondsTravaux: { objet: 'travaux_ppt', decisionAg: { dateAg: '2026-06-12', numeroResolution: '14' } },
      ...surcharge,
    },
    { segmentSyndicat: 'TILL', aujourdhui: '2026-10-29' },
  )

describe('F95 — paiement direct depuis le compte du fonds par défaut ; virement vers le compte courant admis, marqué « emploi »', () => {
  it('virement vers le compte courant : pour le seul montant affecté (paramètre explicite), marqué « emploi »', () => {
    const v = virementSortie({ plafondAffectation: { montantAffecteCentimes: 300_000, dejaEmployeCentimes: 50_000 } })
    expect(v.marque).toBe('emploi')
    expect(v.alertes).toEqual([])
    expect(() => virementSortie({ plafondAffectation: { montantAffecteCentimes: 300_000, dejaEmployeCentimes: 60_000 } })).toThrow(
      /au-delà du montant affecté/,
    )
  })

  it('montant affecté non fourni : admis, avec l’alerte qu’il n’est pas contrôlé ; une alimentation n’est jamais un emploi', () => {
    const v = virementSortie()
    expect(v.marque).toBe('emploi')
    expect(v.alertes).toEqual([expect.stringMatching(/montant affecté par la décision non fourni : non contrôlé/)])
    const alimentation = virementSortie({ source: COURANT, destination: FONDS, emploiFondsTravaux: null, libelle: 'Cotisations' })
    expect(alimentation.marque).toBeNull()
    expect(() => virementSortie({ source: COURANT, destination: FONDS, emploiFondsTravaux: null, plafondAffectation: { montantAffecteCentimes: 1 } })).toThrow(
      /sans objet/,
    )
  })

  it('la facture payée ensuite depuis le compte courant se rattache au virement « emploi », dans sa limite', () => {
    const v = virementSortie({ plafondAffectation: { montantAffecteCentimes: 250_000 } })
    expect(rattacherReglementAuVirementEmploi(v, reglement())).toEqual({ virementId: 'vi-1', reglementId: 'reg-1', factureId: 'fac-1', montantCentimes: 150_000 })
    expect(() => rattacherReglementAuVirementEmploi(v, reglement(), { dejaRattacheCentimes: 200_000 })).toThrow(/au-delà du virement/)
    expect(() => rattacherReglementAuVirementEmploi(v, reglement({ banqueId: 'b-autre' }))).toThrow(/compte qui a reçu/)
    expect(() => rattacherReglementAuVirementEmploi(v, reglement({ statut: 'Annulé' }))).toThrow(/annulé/)
    expect(() => rattacherReglementAuVirementEmploi(v, reglement({ factureId: null }))).toThrow(/facture/)
    const alimentation = virementSortie({ source: COURANT, destination: FONDS, emploiFondsTravaux: null })
    expect(() => rattacherReglementAuVirementEmploi(alimentation, reglement())).toThrow(/« emploi »/)
  })

  it('paiement direct depuis le compte du fonds : le règlement est l’emploi, contrôlé au paiement', () => {
    const op = adoptee()
    expect(controlerReglementDepuisLeFondsOperation(op, reglement({ banqueId: 'b-fonds', montantCentimes: 1_500_000 }))).toMatchObject({ autorise: true })
    expect(
      controlerReglementDepuisLeFondsOperation(op, reglement({ banqueId: 'b-fonds', montantCentimes: 1_500_000 }), { dejaEmployeCentimes: 1_000_000 }),
    ).toMatchObject({ autorise: false, cause: 'au_dela_de_la_part' })
    expect(() => controlerReglementDepuisLeFondsOperation(op, reglement({ travauxId: '00099' }))).toThrow(/n'est pas un règlement de l'opération 00042/)
  })

  it('en-têtes : la question du paiement quitte le 🔴 (virement-interne.ts et travaux-budget.ts)', () => {
    const virement = enTeteDuModule('virement-interne').texte
    expect(virement.slice(virement.indexOf('🔴 Non établi'))).not.toContain('la facture de travaux se règle-t-elle directement depuis le compte du fonds')
    expect(virement).toContain('Décision du 20/11/2026 (partie C, F95)')
    const budget = enTeteDuModule('travaux-budget').texte
    expect(budget.slice(budget.indexOf('🔴 Non établi'))).not.toContain('ses factures se règlent-elles directement depuis le compte')
    expect(budget).toContain('Décision du 20/11/2026 (partie C, F95)')
  })
})

// ─── F96 ──────────────────────────────────────────────────────────────────────────────────────

const DECISION_AP: DecisionAdministrateurProvisoire = {
  forme: 'decision_administrateur_provisoire',
  ordonnance: { juridiction: 'Tribunal judiciaire de Lyon', date: '2026-01-05', numero: 'RG 26/00011' },
  pouvoirsAgConfies: true,
  decision: { date: '2026-01-20', numeroRegistre: 'AP-2026-03' },
  avisOuUrgence: { nature: 'avis_conseil_syndical', date: '2026-01-18' },
}

describe('F96 — troisième forme structurée : « décision de l’administrateur provisoire »', () => {
  const controler = (decisionAg: DecisionAdministrateurProvisoire, aujourdhui: string | null = '2026-02-01') =>
    controlerAffectationFondsTravaux({ objet: 'travaux_ppt', montantCentimes: 1_000, decisionAg }, { aujourdhui, nouvelleSaisie: true })

  it('admise : ordonnance de l’art. 29-1, pouvoirs de l’AG confiés, décision au registre, avis du conseil syndical', () => {
    expect(estDecisionAdministrateurProvisoire(DECISION_AP)).toBe(true)
    expect(estDecisionAdministrateurProvisoire({ dateAg: '2026-01-15', numeroResolution: '12' })).toBe(false)
    const resultat = controler(DECISION_AP)
    expect(resultat).toMatchObject({ autorise: true, cause: 'admis', formeIncomplete: null })
    expect(resultat.motif).toContain("décision n° AP-2026-03 du registre de l'administrateur provisoire, du 20/01/2026")
    expect(resultat.motif).toContain('ordonnance n° RG 26/00011 du 05/01/2026, Tribunal judiciaire de Lyon')
    expect(resultat.motif).toContain('avis du conseil syndical du 18/01/2026')
    expect(controler({ ...DECISION_AP, avisOuUrgence: { nature: 'constat_urgence', date: '2026-01-19' } }).motif).toContain('urgence constatée le 19/01/2026')
  })

  it('refus : pouvoirs non confiés, forme incomplète, décision avant l’ordonnance, date postérieure au jour', () => {
    expect(controler({ ...DECISION_AP, pouvoirsAgConfies: false })).toMatchObject({ autorise: false, cause: 'decision_manquante' })
    const incomplete = controler({ ...DECISION_AP, decision: { date: '2026-01-20', numeroRegistre: ' ' }, avisOuUrgence: { nature: 'avis_conseil_syndical', date: '' } })
    expect(incomplete).toMatchObject({ autorise: false, cause: 'reference_invalide' })
    expect(incomplete.motif).toMatch(/manque : n° de la décision au registre, date de l'avis du conseil syndical ou du constat d'urgence/)
    expect(controler({ ...DECISION_AP, decision: { date: '2026-01-04', numeroRegistre: 'AP-1' } })).toMatchObject({ cause: 'reference_invalide' })
    expect(controler({ ...DECISION_AP, decision: { date: '2026-01-04', numeroRegistre: 'AP-1' } }).motif).toMatch(/antérieure à l'ordonnance/)
    expect(controler(DECISION_AP, '2026-01-19')).toMatchObject({ cause: 'reference_invalide' })
    expect(() => controlerAffectationFondsTravaux({ objet: 'travaux_ppt', montantCentimes: 1_000, decisionAg: DECISION_AP }, { nouvelleSaisie: true })).toThrow(
      /date du jour attendue/,
    )
    // valeur enregistrée : forme contrôlée, date non comparée au jour (J30)
    expect(controler(DECISION_AP, null)).toMatchObject({ autorise: true })
  })

  it('fonds-travaux-lots.ts : la date comparée à la dépense est celle de la décision au registre', () => {
    const surDecision = (date: string) => emploiFonds({ date, montantCentimes: 1_000, decaissement: { objet: 'travaux_ppt', montantCentimes: 1_000, decisionAg: DECISION_AP } })
    const veille = partsFondsTravauxParLot({ versements: versementsFonds, emplois: [surDecision('2026-01-19')], cles: [cleFonds], date: '2026-02-28' })
    expect(veille.anomalies.find((a) => a.code === 'emploi_avant_decision')?.message).toContain("avant la décision de l'administrateur provisoire du 20/01/2026")
    expect(veille.totalDeduitDesPartsCentimes).toBe(0)
    const memeJour = partsFondsTravauxParLot({ versements: versementsFonds, emplois: [surDecision('2026-01-20')], cles: [cleFonds], date: '2026-02-28' })
    expect(memeJour.anomalies).toEqual([])
    expect(memeJour.totalDeduitDesPartsCentimes).toBe(1_000)
  })

  it('emploiDepuisOperation : la décision de l’administrateur provisoire passe en forme structurée (paramètre explicite)', () => {
    const op = creerOperationTravaux(saisie({ decision: { date: '2026-01-20', resolution: 'AP-2026-03', origine: 'administrateur', pouvoirsAgConfies: 'tous' } }))
    const decision = structuredClone(DECISION_AP)
    const e = emploiDepuisOperation(op, { id: 'EMP-AP', date: '2026-02-01', decisionAdministrateurProvisoire: decision })
    expect(e.decaissement.decisionAg).toEqual(DECISION_AP)
    decision.ordonnance.numero = 'modifié'
    expect(e.decaissement.decisionAg).toEqual(DECISION_AP)
    expect(e.dateDecision).toBe('2026-01-20')
    expect(controlerAffectationFondsTravaux(e.decaissement, { aujourdhui: null })).toMatchObject({ autorise: true, cause: 'admis' })
    // sans le paramètre : la résolution de l'opération, comme avant (l'opération ne porte pas l'ordonnance de l'art. 29-1)
    expect(emploiDepuisOperation(op, { id: 'EMP-AP', date: '2026-02-01' }).decaissement.decisionAg).toEqual({ dateAg: '2026-01-20', numeroResolution: 'AP-2026-03' })
  })

  it('emploiDepuisOperation : décision de l’administrateur provisoire refusée pour une opération décidée par l’assemblée, ou qui n’est pas celle de l’opération', () => {
    expect(() => emploiDepuisOperation(adoptee(), { id: 'EMP-AG', date: '2026-04-01', decisionAdministrateurProvisoire: DECISION_AP })).toThrow(
      /pas une décision de l'administrateur provisoire/,
    )
    const op = creerOperationTravaux(saisie({ decision: { date: '2026-01-20', resolution: 'AP-2026-03', origine: 'administrateur', pouvoirsAgConfies: 'tous' } }))
    const autreDate = { ...DECISION_AP, decision: { date: '2026-01-21', numeroRegistre: 'AP-2026-03' } }
    const autreNumero = { ...DECISION_AP, decision: { date: '2026-01-20', numeroRegistre: 'AP-2026-04' } }
    for (const d of [autreDate, autreNumero])
      expect(() => emploiDepuisOperation(op, { id: 'EMP-AP', date: '2026-02-01', decisionAdministrateurProvisoire: d })).toThrow(/n'est pas celle de l'opération/)
    const distincte = creerOperationTravaux(
      saisie({
        decision: { date: '2026-01-20', resolution: 'AP-2026-03', origine: 'administrateur', pouvoirsAgConfies: 'tous' },
        affectationFonds: { objet: 'travaux_hors_ppt', decisionAg: 'Décision AP-2026-02 du 15/01/2026' },
      }),
    )
    expect(() => emploiDepuisOperation(distincte, { id: 'EMP-AP', date: '2026-02-01', decisionAdministrateurProvisoire: DECISION_AP })).toThrow(/décision distincte/)
  })

  it('virement-interne.ts : une sortie du fonds sur une décision de l’administrateur provisoire, copiée et non partagée', () => {
    const decision = structuredClone(DECISION_AP)
    const v = virementSortie({ emploiFondsTravaux: { objet: 'travaux_ppt', decisionAg: decision } })
    expect(v.affectation?.autorise).toBe(true)
    expect(v.emploiFondsTravaux?.decisionAg).toEqual(DECISION_AP)
    decision.ordonnance.numero = 'modifié'
    expect(v.emploiFondsTravaux?.decisionAg).toEqual(DECISION_AP)
    expect(() => virementSortie({ emploiFondsTravaux: { objet: 'travaux_ppt', decisionAg: { ...DECISION_AP, pouvoirsAgConfies: false } } })).toThrow(/pouvoirs de l'assemblée/)
  })

  it('en-tête de virement-interne.ts : la forme de la décision de l’administrateur provisoire quitte le 🔴', () => {
    const { texte } = enTeteDuModule('virement-interne')
    expect(texte.slice(texte.indexOf('🔴 Non établi'))).not.toContain("prend-elle la même forme que celle de l'art. 29-14, 2°")
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F96)')
    expect(enTeteDuModule('fonds-travaux').texte).toContain('Décision du 20/11/2026 (partie C, F96)')
  })
})
