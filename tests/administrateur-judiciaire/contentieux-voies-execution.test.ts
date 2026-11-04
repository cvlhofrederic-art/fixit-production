import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GARANTIE_ENCHERE_MINIMUM_CENTIMES,
  SAISIES_EXECUTION,
  SANS_VOIES_EXECUTION,
  controlerAutorisationActionEnJustice,
  controlerAutorisationSaisieVente,
  controlerDatesVoiesExecution,
  creerDecisionContentieux,
  creerVoiesExecution,
  engagerSaisieImmobiliere,
  executionEngagee,
  exigerAutorisationVente,
  garantieEnchereCentimes,
  postesHorsInscriptionHypotheque,
  saisieVenteEngagee,
  type AssembleeLiee,
  type ContexteAutorisationVente,
  type SaisieVoiesExecution,
  type SourceDecisionContentieux,
  type VoiesExecutionContentieux,
} from '@/lib/administrateur-judiciaire/domain/contentieux-voies-execution'
import {
  creerDossierContentieux,
  phaseSuggeree,
  type SaisieContentieux,
} from '@/lib/administrateur-judiciaire/domain/contentieux'
import { creerResolution, type Resolution } from '@/lib/administrateur-judiciaire/domain/resolutions-ag'

/**
 * Point 56 du bilan Gestéam — voies d'exécution, hypothèque, mise à prix et rattachement Assemblée + Résolution (tranche 42,
 * onglet Règlements).
 * - Seule la saisie en vue de la vente d'un lot exige une autorisation d'AG (D. 1967 art. 55, al. 3) ; le projet de
 *   résolution porte la mise à prix et les sommes estimées définitivement perdues (art. 11, I, 11°).
 * - Refus structurel à la création du dossier ; contrôle de fond avec la résolution, l'assemblée et le régime du mandat.
 */

const AUJOURDHUI = '2026-10-30'

const saisie = (surcharge: Partial<SaisieContentieux> = {}): SaisieContentieux => ({
  coproprieteId: 'copro-1',
  type: 'Recouvrement de charges/loyer',
  phase: 'Procédure Judiciaire',
  particularite: 'Contentieux sans échéancier',
  dateOuverture: '2026-01-15',
  dateCloture: null,
  objet: 'Charges impayées 2025',
  montantDemandeCentimes: 482_000,
  intervenants: {
    huissier: { nom: null, reference: null, transmisLe: null },
    avocat: { nom: null, reference: null, transmisLe: null },
    expert: { nom: null, reference: null, transmisLe: null },
  },
  jalons: {},
  ...surcharge,
})

const voies = (surcharge: SaisieVoiesExecution = {}): VoiesExecutionContentieux => creerVoiesExecution(surcharge)

const VENTE = { miseAPrixCentimes: 5_000_000, sommesEstimeesPerduesCentimes: 120_000 }
const DECISION_AG: SourceDecisionContentieux = { origine: 'assemblee', agId: 'ag-1', resolutionId: 'res-7' }
const DECISION_AP: SourceDecisionContentieux = { origine: 'administrateur', reference: 'Registre n° 12', date: '2026-04-20' }

const resolution = (surcharge: Partial<Resolution> = {}): Resolution => ({
  ...creerResolution({
    id: 'res-7',
    agId: 'ag-1',
    numero: 7,
    intitule: 'Autorisation de poursuivre la saisie immobilière du lot 12',
    majorite: 'art25',
  }),
  etat: 'adoptee',
  ...surcharge,
})

const assemblee = (surcharge: Partial<AssembleeLiee> = {}): AssembleeLiee => ({
  id: 'ag-1',
  coproprieteId: 'copro-1',
  date: '2026-04-10',
  ...surcharge,
})

/** Dossier dont la saisie immobilière est cochée (engagée ou non) et liée à `decision`. */
const dossierVente = (
  saisieImmobiliere: SaisieVoiesExecution['saisieImmobiliere'] = { engageeLe: '2026-05-04' },
  decision: SourceDecisionContentieux | null = DECISION_AG,
  venteLot: SaisieVoiesExecution['venteLot'] = VENTE,
) => ({ coproprieteId: 'copro-1', decision, voiesExecution: voies({ saisieImmobiliere, venteLot }) })

const CONTEXTE_AG: ContexteAutorisationVente = { resolution: resolution(), assemblee: assemblee() }

describe('voies d’exécution — référentiel des saisies (tranche 42)', () => {
  it('reprend les quatre cases de saisie de la fiche Gestéam, dans l’ordre de la fiche', () => {
    expect(SAISIES_EXECUTION.map((s) => s.libelle)).toEqual([
      'Saisie mobilière',
      'Saisie attribution',
      'Saisie arrêt salaire',
      'Saisie arrêt loyer',
    ])
  })

  it('donne la désignation du code pour les libellés anciens de Gestéam (saisie des rémunérations, saisie-attribution)', () => {
    const parCle = Object.fromEntries(SAISIES_EXECUTION.map((s) => [s.cle, s]))
    expect(parCle.arretSalaire.designationCode).toBe('Saisie des rémunérations')
    expect(parCle.arretSalaire.fondement).toBe('CPCE art. L. 212-1 et suivants')
    expect(parCle.attribution.fondement).toBe('CPCE art. L. 211-1')
    expect(parCle.arretLoyer.fondement).toMatch(/CPCE art\. L\. 211-1/)
    expect(parCle.mobiliere.fondement).toBeNull()
  })

  it('sans voie d’exécution : rien de coché, rien de daté, objet gelé', () => {
    expect(SANS_VOIES_EXECUTION).toEqual({
      saisieImmobiliere: null,
      saisies: [],
      caseEcheancier: false,
      expulsionLe: null,
      hypotheque: null,
      venteLot: null,
    })
    expect(Object.isFrozen(SANS_VOIES_EXECUTION)).toBe(true)
    expect(Object.isFrozen(SANS_VOIES_EXECUTION.saisies)).toBe(true)
  })
})

describe('voies d’exécution — création et normalisation', () => {
  it('une saisie vide donne SANS_VOIES_EXECUTION', () => {
    expect(creerVoiesExecution({})).toEqual(SANS_VOIES_EXECUTION)
  })

  it('range les saisies cochées dans l’ordre du référentiel, sans doublon', () => {
    expect(voies({ saisies: ['arretLoyer', 'mobiliere', 'arretLoyer'] }).saisies).toEqual(['mobiliere', 'arretLoyer'])
  })

  it('refuse une saisie inconnue', () => {
    expect(() => voies({ saisies: ['saisieVente'] })).toThrow(/Saisie inconnue : « saisieVente »/)
  })

  it('complète la saisie immobilière cochée : dates absentes → null', () => {
    expect(voies({ saisieImmobiliere: { engageeLe: '2026-05-04' } }).saisieImmobiliere).toEqual({
      engageeLe: '2026-05-04',
      audienceLe: null,
      adjudicationLe: null,
    })
    expect(voies({ saisieImmobiliere: {} }).saisieImmobiliere).toEqual({ engageeLe: null, audienceLe: null, adjudicationLe: null })
  })

  it('refuse une date non ISO, quel que soit le bloc', () => {
    expect(() => voies({ saisieImmobiliere: { engageeLe: '2026-02-30' } })).toThrow(/Engagée le/)
    expect(() => voies({ saisieImmobiliere: { adjudicationLe: '04/05/2026' } })).toThrow(/Adjudication/)
    expect(() => voies({ expulsionLe: '2026-13-01' })).toThrow(/Expulsion/)
    expect(() => voies({ hypotheque: { inscriteLe: 'hier' } })).toThrow(/Hypothèque/)
  })

  it('refuse un montant qui n’est pas un entier de centimes positif ou nul ; admet zéro (🔴 Frédéric)', () => {
    expect(() => voies({ hypotheque: { montantCentimes: -1 } })).toThrow(/centimes entiers/)
    expect(() => voies({ venteLot: { miseAPrixCentimes: 12.5 } })).toThrow(/Mise à prix/)
    expect(() => voies({ venteLot: { sommesEstimeesPerduesCentimes: Number.NaN } })).toThrow(/Sommes estimées/)
    expect(voies({ venteLot: { miseAPrixCentimes: 0, sommesEstimeesPerduesCentimes: 0 } }).venteLot).toEqual({
      miseAPrixCentimes: 0,
      sommesEstimeesPerduesCentimes: 0,
    })
  })

  it('complète l’hypothèque et la vente du lot : champs absents → null', () => {
    const v = voies({ hypotheque: { inscriteLe: '2026-03-01' }, venteLot: { miseAPrixCentimes: 5_000_000 } })
    expect(v.hypotheque).toEqual({ inscriteLe: '2026-03-01', montantCentimes: null })
    expect(v.venteLot).toEqual({ miseAPrixCentimes: 5_000_000, sommesEstimeesPerduesCentimes: null })
  })

  it('J33 : la case « Échéancier » (délais de grâce du juge) n’est pas une mesure d’exécution ; refuse une valeur qui n’est pas oui ou non', () => {
    const v = voies({ caseEcheancier: true })
    expect(v.caseEcheancier).toBe(true)
    expect(executionEngagee(v)).toBe(false)
    expect(() => creerVoiesExecution({ caseEcheancier: 'oui' as unknown as boolean })).toThrow(/Échéancier/)
  })

  it('🔵 J35 : la mise à prix se saisit sans que la case Saisie immobilière soit cochée, sans refus ni anomalie', () => {
    const v = voies({ venteLot: { miseAPrixCentimes: 5_000_000 } })
    expect(v.saisieImmobiliere).toBeNull()
    expect(v.venteLot).toEqual({ miseAPrixCentimes: 5_000_000, sommesEstimeesPerduesCentimes: null })
    const dossier = creerDossierContentieux(saisie({ voiesExecution: v }))
    expect(dossier.voiesExecution?.venteLot?.miseAPrixCentimes).toBe(5_000_000)
    expect(controlerAutorisationSaisieVente(dossier).cause).toBe('non_requise')
    expect(controlerDatesVoiesExecution(dossier, AUJOURDHUI)).toEqual([])
  })

  it('décision liée : identifiants rognés ; chaîne vide ou origine inconnue refusées', () => {
    expect(creerDecisionContentieux({ origine: 'assemblee', agId: ' ag-1 ', resolutionId: ' res-7' })).toEqual(DECISION_AG)
    expect(creerDecisionContentieux({ origine: 'administrateur', reference: ' Registre n° 12 ', date: '2026-04-20' })).toEqual(
      DECISION_AP,
    )
    expect(() => creerDecisionContentieux({ origine: 'assemblee', agId: 'ag-1', resolutionId: '  ' })).toThrow(/résolution/)
    expect(() => creerDecisionContentieux({ origine: 'administrateur', reference: '', date: '2026-04-20' })).toThrow(/registre/)
    expect(() =>
      creerDecisionContentieux({ origine: 'juge', reference: 'x' } as unknown as SourceDecisionContentieux),
    ).toThrow(/Origine de la décision inconnue/)
  })

  it('décision de l’administrateur provisoire : date ISO exigée (portée à sa date au registre, D. 1967 art. 62-8)', () => {
    expect(() => creerDecisionContentieux({ origine: 'administrateur', reference: 'Registre n° 12', date: '20/04/2026' })).toThrow(
      /date de la décision.*AAAA-MM-JJ/,
    )
    expect(() =>
      creerDecisionContentieux({ origine: 'administrateur', reference: 'Registre n° 12' } as unknown as SourceDecisionContentieux),
    ).toThrow(/date de la décision/)
  })
})

describe('voies d’exécution — dossier : champs facultatifs, absents quand rien n’est saisi', () => {
  it('sans saisie : ni voies d’exécution, ni décision, ni mandat, ni compte', () => {
    const dossier = creerDossierContentieux(saisie())
    for (const champ of ['voiesExecution', 'decision', 'mandatId', 'compteId']) expect(champ in dossier).toBe(false)
  })

  it('null vaut absence pour la décision, le mandat et le compte', () => {
    const dossier = creerDossierContentieux(saisie({ decision: null, mandatId: null, compteId: null }))
    for (const champ of ['decision', 'mandatId', 'compteId']) expect(champ in dossier).toBe(false)
  })

  it('normalise les voies d’exécution, la décision, le mandat et le compte débiteur (D2)', () => {
    const dossier = creerDossierContentieux(
      saisie({
        mandatId: ' mandat-1 ',
        compteId: ' 450-12 ',
        decision: { origine: 'assemblee', agId: ' ag-1', resolutionId: 'res-7 ' },
        voiesExecution: { ...SANS_VOIES_EXECUTION, saisies: ['arretLoyer', 'attribution'] },
      }),
    )
    expect(dossier.mandatId).toBe('mandat-1')
    expect(dossier.compteId).toBe('450-12')
    expect(dossier.decision).toEqual(DECISION_AG)
    expect(dossier.voiesExecution?.saisies).toEqual(['attribution', 'arretLoyer'])
  })

  it('refuse un mandat ou un compte vide', () => {
    expect(() => creerDossierContentieux(saisie({ mandatId: '  ' }))).toThrow(/Mandat/)
    expect(() => creerDossierContentieux(saisie({ compteId: '' }))).toThrow(/Compte/)
  })

  it('refuse des voies d’exécution invalides', () => {
    expect(() =>
      creerDossierContentieux(saisie({ voiesExecution: { ...SANS_VOIES_EXECUTION, expulsionLe: '2026-02-31' } })),
    ).toThrow(/Expulsion/)
  })
})

describe('voies d’exécution — refus structurel d’une saisie en vue de la vente (art. 55, al. 3 ; art. 11, I, 11°)', () => {
  const avecVente = (
    saisieImmobiliere: SaisieVoiesExecution['saisieImmobiliere'],
    decision: SourceDecisionContentieux | null,
    venteLot: SaisieVoiesExecution['venteLot'] = VENTE,
  ) => saisie({ decision, voiesExecution: voies({ saisieImmobiliere, venteLot }) })

  it('refuse une saisie immobilière engagée sans décision liée', () => {
    expect(() => creerDossierContentieux(avecVente({ engageeLe: '2026-05-04' }, null))).toThrow(
      /sans décision liée.*D\. 1967 art\. 55, al\. 1 et 3/,
    )
  })

  it('refuse une saisie immobilière engagée sans mise à prix ou sans sommes estimées définitivement perdues', () => {
    expect(() =>
      creerDossierContentieux(avecVente({ engageeLe: '2026-05-04' }, DECISION_AG, { sommesEstimeesPerduesCentimes: 1 })),
    ).toThrow(/mise à prix.*D\. 1967 art\. 11, I, 11°/)
    expect(() =>
      creerDossierContentieux(avecVente({ engageeLe: '2026-05-04' }, DECISION_AG, { miseAPrixCentimes: 1 })),
    ).toThrow(/sommes estimées définitivement perdues/)
    expect(() => creerDossierContentieux(avecVente({ engageeLe: '2026-05-04' }, DECISION_AG, null))).toThrow(
      /mise à prix et sommes estimées définitivement perdues/,
    )
  })

  it('une audience ou une adjudication datée engage la saisie, même sans « Engagée le »', () => {
    expect(() => creerDossierContentieux(avecVente({ audienceLe: '2026-11-20' }, null))).toThrow(/sans décision liée/)
    expect(() => creerDossierContentieux(avecVente({ adjudicationLe: '2026-11-20' }, null))).toThrow(/sans décision liée/)
  })

  it('admet la saisie engagée avec une décision (AG ou administrateur provisoire) et les deux montants', () => {
    expect(creerDossierContentieux(avecVente({ engageeLe: '2026-05-04' }, DECISION_AG)).voiesExecution?.venteLot).toEqual(VENTE)
    expect(() => creerDossierContentieux(avecVente({ engageeLe: '2026-05-04' }, DECISION_AP))).not.toThrow()
  })

  it('admet la saisie cochée sans date ni décision : le projet de résolution se prépare', () => {
    expect(() => creerDossierContentieux(avecVente({}, null, { miseAPrixCentimes: 5_000_000 }))).not.toThrow()
  })

  it('les quatre autres saisies, l’expulsion et l’hypothèque n’exigent ni décision ni montant', () => {
    const v = voies({
      saisies: ['mobiliere', 'attribution', 'arretSalaire', 'arretLoyer'],
      expulsionLe: '2026-09-01',
      hypotheque: { inscriteLe: '2026-03-01', montantCentimes: 482_000 },
    })
    expect(() => exigerAutorisationVente(v, null)).not.toThrow()
    expect(() => creerDossierContentieux(saisie({ voiesExecution: v }))).not.toThrow()
  })
})

describe('voies d’exécution — contrôle de fond de l’autorisation de la saisie en vue de la vente', () => {
  it('non requise sans saisie immobilière', () => {
    const r = controlerAutorisationSaisieVente({ coproprieteId: 'copro-1', voiesExecution: voies({ saisies: ['mobiliere'] }) })
    expect(r).toMatchObject({ autorise: true, cause: 'non_requise', aConfirmer: false })
    expect(r.fondement).toMatch(/D\. 1967 art\. 55, al\. 3/)
  })

  it('décision manquante, puis montants manquants', () => {
    expect(controlerAutorisationSaisieVente(dossierVente({}, null))).toMatchObject({
      autorise: false,
      cause: 'decision_manquante',
    })
    const r = controlerAutorisationSaisieVente(dossierVente({}, DECISION_AG, { miseAPrixCentimes: 5_000_000 }), CONTEXTE_AG)
    expect(r).toMatchObject({ autorise: false, cause: 'montants_manquants', fondement: 'D. 1967 art. 11, I, 11°' })
    expect(r.motif).toMatch(/sommes estimées définitivement perdues/)
  })

  it('résolution ou assemblée à rattacher', () => {
    expect(controlerAutorisationSaisieVente(dossierVente())).toMatchObject({ autorise: false, cause: 'resolution_a_rattacher' })
    expect(controlerAutorisationSaisieVente(dossierVente(), { resolution: resolution() })).toMatchObject({
      cause: 'resolution_a_rattacher',
    })
  })

  it('une résolution, une assemblée ou un lien qui ne sont pas ceux du dossier sont une erreur d’appel', () => {
    expect(() => controlerAutorisationSaisieVente(dossierVente(), { ...CONTEXTE_AG, resolution: resolution({ id: 'res-8' }) })).toThrow(
      /n'est pas celle du dossier/,
    )
    expect(() => controlerAutorisationSaisieVente(dossierVente(), { ...CONTEXTE_AG, assemblee: assemblee({ id: 'ag-2' }) })).toThrow(
      /n'est pas celle du dossier/,
    )
    expect(() => controlerAutorisationSaisieVente(dossierVente({}, DECISION_AP), CONTEXTE_AG)).toThrow(
      /lié à aucune résolution d'assemblée/,
    )
    expect(() =>
      controlerAutorisationSaisieVente(dossierVente(), { ...CONTEXTE_AG, assemblee: assemblee({ date: '10/04/2026' }) }),
    ).toThrow(/Date de l'assemblée/)
  })

  it('assemblée d’une autre copropriété, résolution non adoptée', () => {
    expect(
      controlerAutorisationSaisieVente(dossierVente(), { ...CONTEXTE_AG, assemblee: assemblee({ coproprieteId: 'copro-2' }) }),
    ).toMatchObject({ autorise: false, cause: 'assemblee_autre_copropriete' })
    const rejetee = controlerAutorisationSaisieVente(dossierVente(), { ...CONTEXTE_AG, resolution: resolution({ etat: 'rejetee' }) })
    expect(rejetee).toMatchObject({ autorise: false, cause: 'resolution_non_adoptee' })
    expect(rejetee.motif).toMatch(/rejetée/)
  })

  it('décision votée après l’engagement de la saisie : refusée', () => {
    const r = controlerAutorisationSaisieVente(dossierVente({ engageeLe: '2026-04-01' }), CONTEXTE_AG)
    expect(r).toMatchObject({ autorise: false, cause: 'decision_apres_engagement', fondement: 'D. 1967 art. 55, al. 1 et 3' })
    expect(r.motif).toMatch(/seuls les copropriétaires/)
    expect(controlerAutorisationSaisieVente(dossierVente({ engageeLe: '2026-04-10' }), CONTEXTE_AG).autorise).toBe(true)
    expect(controlerAutorisationSaisieVente(dossierVente({ audienceLe: '2026-03-01' }), CONTEXTE_AG).cause).toBe(
      'decision_apres_engagement',
    )
  })

  it('le motif nomme l’acte daté le plus ancien de la saisie, avec le libellé de son champ', () => {
    expect(controlerAutorisationSaisieVente(dossierVente({ engageeLe: '2026-04-01' }), CONTEXTE_AG).motif).toMatch(
      /^Engagement de la saisie immobilière daté du 01\/04\/2026, avant l'assemblée du 10\/04\/2026/,
    )
    const parAudience = controlerAutorisationSaisieVente(dossierVente({ audienceLe: '2026-03-01' }), CONTEXTE_AG).motif
    expect(parAudience).toMatch(/^Audience de saisie immobilière datée du 01\/03\/2026, avant l'assemblée du 10\/04\/2026/)
    expect(parAudience).not.toMatch(/engagée le/)
    expect(
      controlerAutorisationSaisieVente(dossierVente({ engageeLe: '2026-05-04', adjudicationLe: '2026-03-01' }), CONTEXTE_AG).motif,
    ).toMatch(/^Adjudication datée du 01\/03\/2026/)
  })

  it('admise : résolution adoptée à la majorité de l’art. 25, avec les rappels de l’art. 19-2, al. 5 et de l’art. 11, I', () => {
    const r = controlerAutorisationSaisieVente(dossierVente(), CONTEXTE_AG)
    expect(r).toMatchObject({ autorise: true, cause: 'admise', aConfirmer: false })
    expect(r.rappels.join(' ')).toMatch(/L\. 1965 art\. 19-2, al\. 5/)
    expect(r.rappels.join(' ')).toMatch(/au plus tard avec l'ordre du jour/)
  })

  it('admise à confirmer : résolution soumise à la majorité de l’art. 24 (🔴 majorité)', () => {
    const r = controlerAutorisationSaisieVente(dossierVente(), { ...CONTEXTE_AG, resolution: resolution({ majorite: 'art24' }) })
    expect(r).toMatchObject({ autorise: true, cause: 'admise', aConfirmer: true })
    expect(r.motif).toMatch(/art\. 24 ou de l'art\. 25/)
  })

  it('résolution d’AG votée alors que l’ordonnance confie tous les pouvoirs de l’AG à l’administrateur provisoire : refusée', () => {
    const sousAp = { ...CONTEXTE_AG, regime: 'ap291', pouvoirsAgConfies: 'tous' } as const
    const r = controlerAutorisationSaisieVente(dossierVente(), sousAp)
    expect(r).toMatchObject({ autorise: false, cause: 'pouvoir_ag_confie_a_l_administrateur', aConfirmer: false })
    expect(r.motif).toMatch(/revient à l'administrateur provisoire/)
    expect(r.fondement).toMatch(/L\. 1965 art\. 29-1, I, al\. 2/)
    expect(() => engagerSaisieImmobiliere(dossierVente({}), '2026-05-04', sousAp)).toThrow(/Saisie immobilière non engagée/)
  })

  it('résolution d’AG sous administrateur provisoire de l’art. 29-1 : à vérifier pour une partie des pouvoirs ou une étendue inconnue', () => {
    for (const pouvoirsAgConfies of ['partie', null] as const) {
      const r = controlerAutorisationSaisieVente(dossierVente(), { ...CONTEXTE_AG, regime: 'ap291', pouvoirsAgConfies })
      expect(r).toMatchObject({ autorise: true, cause: 'pouvoirs_ag_a_verifier', aConfirmer: true })
      expect(r.fondement).toMatch(/L\. 1965 art\. 29-1, I, al\. 2/)
    }
    expect(
      controlerAutorisationSaisieVente(dossierVente(), { ...CONTEXTE_AG, regime: 'ap291', pouvoirsAgConfies: 'aucun' }).cause,
    ).toBe('admise')
    expect(controlerAutorisationSaisieVente(dossierVente(), { ...CONTEXTE_AG, regime: 'sj' }).cause).toBe('admise')
  })

  it('décision de l’administrateur provisoire : admise seulement sous l’art. 29-1 avec les pouvoirs de l’AG', () => {
    const ap = (contexte: ContexteAutorisationVente) => controlerAutorisationSaisieVente(dossierVente(undefined, DECISION_AP), contexte)
    expect(ap({ regime: 'ap291', pouvoirsAgConfies: 'tous' })).toMatchObject({ autorise: true, cause: 'admise', aConfirmer: false })
    expect(ap({ regime: 'ap291', pouvoirsAgConfies: 'partie' })).toMatchObject({
      autorise: true,
      cause: 'pouvoirs_ag_a_verifier',
      aConfirmer: true,
    })
    for (const contexte of [
      { regime: 'ap291', pouvoirsAgConfies: 'aucun' },
      { regime: 'ap47', pouvoirsAgConfies: 'tous' },
      { regime: 'sj' },
    ] as ContexteAutorisationVente[])
      expect(ap(contexte)).toMatchObject({ autorise: false, cause: 'pouvoirs_ag_non_confies' })
  })

  it('décision de l’administrateur provisoire : pouvoirs non établis (régime ou étendue non renseignés), distincts de pouvoirs non confiés', () => {
    const ap = (contexte: ContexteAutorisationVente) => controlerAutorisationSaisieVente(dossierVente(undefined, DECISION_AP), contexte)
    for (const contexte of [{ regime: 'ap291', pouvoirsAgConfies: null }, { regime: null }, {}] as ContexteAutorisationVente[]) {
      const r = ap(contexte)
      expect(r).toMatchObject({ autorise: false, cause: 'pouvoirs_ag_non_etablis' })
      expect(r.motif).toMatch(/n'est pas établie|sans mandat de justice renseigné/)
    }
  })

  it('décision de l’administrateur provisoire admise : rappels de l’avis du conseil syndical et du mode de financement (D. 1967 art. 62-7)', () => {
    const ap = (contexte: ContexteAutorisationVente) => controlerAutorisationSaisieVente(dossierVente(undefined, DECISION_AP), contexte)
    for (const pouvoirsAgConfies of ['tous', 'partie'] as const) {
      const r = ap({ regime: 'ap291', pouvoirsAgConfies })
      expect(r.fondement).toMatch(/D\. 1967 art\. 62-7/)
      expect(r.rappels).toHaveLength(2)
      expect(r.rappels[0]).toMatch(/avis du conseil syndical.*sauf urgence.*D\. 1967 art\. 62-7, al\. 1/)
      expect(r.rappels[1]).toMatch(/mode de financement.*art\. 62-7, al\. 3/)
    }
  })

  it('décision de l’administrateur provisoire prise après le premier acte daté de la saisie : refusée', () => {
    const tardive: SourceDecisionContentieux = { ...DECISION_AP, date: '2026-09-01' }
    const ctx: ContexteAutorisationVente = { regime: 'ap291', pouvoirsAgConfies: 'tous' }
    const r = controlerAutorisationSaisieVente(dossierVente({ engageeLe: '2026-05-04' }, tardive), ctx)
    expect(r).toMatchObject({ autorise: false, cause: 'decision_apres_engagement' })
    expect(r.motif).toMatch(/avant la décision de l'administrateur provisoire du 01\/09\/2026/)
    expect(controlerAutorisationSaisieVente(dossierVente({ audienceLe: '2026-08-01' }, tardive), ctx).cause).toBe(
      'decision_apres_engagement',
    )
    expect(controlerAutorisationSaisieVente(dossierVente({ engageeLe: '2026-09-01' }, tardive), ctx).autorise).toBe(true)
    expect(() => engagerSaisieImmobiliere(dossierVente({}, tardive), '2026-05-04', ctx)).toThrow(/avant la décision/)
  })

  it('les deux montants restent exigés pour la décision de l’administrateur provisoire (🔴 Frédéric)', () => {
    expect(
      controlerAutorisationSaisieVente(dossierVente(undefined, DECISION_AP, { miseAPrixCentimes: 1 }), {
        regime: 'ap291',
        pouvoirsAgConfies: 'tous',
      }).cause,
    ).toBe('montants_manquants')
  })
})

/**
 * Décision J35 de Hugo (03/11/2026), 🔵 interprétation à confirmer : l'Assemblée et la Résolution du dossier autorisent
 * aussi une action en justice hors recouvrement (D. 1967 art. 55, al. 1). Le recouvrement de créance n'en demande pas
 * (al. 3).
 */
describe('🔵 J35 — autorisation d’une action en justice hors recouvrement (D. 1967 art. 55, al. 1)', () => {
  const action = (type: SaisieContentieux['type'], decision: SourceDecisionContentieux | null = DECISION_AG) => ({
    coproprieteId: 'copro-1',
    type,
    decision,
  })

  it('recouvrement de charges : aucune autorisation requise (al. 3)', () => {
    const r = controlerAutorisationActionEnJustice(action('Recouvrement de charges/loyer', null))
    expect(r).toMatchObject({ autorise: true, cause: 'non_requise', aConfirmer: false, fondement: 'D. 1967 art. 55, al. 3' })
  })

  it('hors recouvrement, la résolution adoptée du dossier autorise l’action : admise, à confirmer, avec ses rappels', () => {
    for (const type of ['Garantie décennale', 'Litige entreprise', 'Litige Personne', 'Litige sur un bail', 'Litige autre syndicat'] as const) {
      const r = controlerAutorisationActionEnJustice(action(type), CONTEXTE_AG)
      expect(r).toMatchObject({ autorise: true, cause: 'admise', aConfirmer: true, fondement: 'D. 1967 art. 55, al. 1' })
      expect(r.motif).toMatch(/Action en justice autorisée par la résolution n° 7, adoptée/)
      expect(r.rappels.join(' ')).toMatch(/prochaine assemblée générale des actions introduites \(D\. 1967 art\. 55, al\. 4\)/)
      expect(r.rappels.join(' ')).toMatch(/antériorité de la décision à l'introduction de l'action n'est pas contrôlée/)
    }
  })

  it('hors recouvrement, sans décision liée : non autorisée, à vérifier, avec toutes les dispenses de l’al. 3 en vigueur', () => {
    const r = controlerAutorisationActionEnJustice(action('Garantie décennale', null))
    expect(r).toMatchObject({ autorise: false, cause: 'decision_manquante', aConfirmer: true, fondement: 'D. 1967 art. 55, al. 1 et 3' })
    expect(r.motif).toMatch(/autorisé par une décision de l'assemblée générale/)
    // Al. 3 en vigueur depuis le 25/12/2025 (D. 2025-1292, art. 12), lu sur Légifrance le 30/10/2026.
    for (const dispense of [
      'les actions en recouvrement de créance',
      "la mise en œuvre des voies d'exécution forcée, à l'exception de la saisie en vue de la vente d'un lot",
      'les mesures conservatoires',
      "l'opposition aux travaux permettant la recharge normale des véhicules électriques (CCH art. R. 113-8)",
      'les demandes qui relèvent des pouvoirs du juge des référés',
      'la défense aux actions intentées contre le syndicat',
      'la saisine du président du tribunal judiciaire en application des premiers alinéas des art. 29-1 A et 29-1 de la loi du 10 juillet 1965 ou du premier alinéa de CCH art. L. 615-6',
    ])
      expect(r.motif).toContain(dispense)
    expect(r.motif).toMatch(/à vérifier/)
  })

  it('🔵 contestation d’assemblée : le syndicat défend à l’action des copropriétaires (L. 1965 art. 42, al. 2), sans autorisation (al. 3)', () => {
    for (const decision of [null, DECISION_AG]) {
      const contexte = decision === null ? {} : CONTEXTE_AG
      const r = controlerAutorisationActionEnJustice(action("Contestation d'assemblée", decision), contexte)
      expect(r).toMatchObject({ autorise: true, cause: 'non_requise', aConfirmer: true, fondement: 'D. 1967 art. 55, al. 3 ; L. 1965 art. 42, al. 2' })
      expect(r.motif).toMatch(/copropriétaires opposants ou défaillants/)
      expect(r.motif).toMatch(/défendre aux actions intentées contre le syndicat/)
      expect(r.motif).not.toMatch(/Action en justice autorisée par la résolution/)
    }
  })

  it('hors recouvrement : résolution à rattacher, d’une autre copropriété ou non adoptée', () => {
    expect(controlerAutorisationActionEnJustice(action('Litige entreprise'))).toMatchObject({ autorise: false, cause: 'resolution_a_rattacher' })
    expect(
      controlerAutorisationActionEnJustice(action('Litige entreprise'), { ...CONTEXTE_AG, assemblee: assemblee({ coproprieteId: 'copro-2' }) }),
    ).toMatchObject({ autorise: false, cause: 'assemblee_autre_copropriete' })
    const rejetee = controlerAutorisationActionEnJustice(action('Litige entreprise'), { ...CONTEXTE_AG, resolution: resolution({ etat: 'rejetee' }) })
    expect(rejetee).toMatchObject({ autorise: false, cause: 'resolution_non_adoptee' })
    expect(rejetee.motif).toMatch(/^Action en justice : la résolution n° 7 est rejetée/)
  })

  it('hors recouvrement, sous administrateur provisoire de l’art. 29-1 : mêmes règles des pouvoirs que pour la saisie', () => {
    const sousAp = { ...CONTEXTE_AG, regime: 'ap291', pouvoirsAgConfies: 'tous' } as const
    const dessaisie = controlerAutorisationActionEnJustice(action('Litige entreprise'), sousAp)
    expect(dessaisie).toMatchObject({ autorise: false, cause: 'pouvoir_ag_confie_a_l_administrateur' })
    expect(dessaisie.motif).toMatch(/l'autorisation d'agir en justice revient à l'administrateur provisoire/)
    const parAp = controlerAutorisationActionEnJustice(action('Litige entreprise', DECISION_AP), { regime: 'ap291', pouvoirsAgConfies: 'tous' })
    expect(parAp).toMatchObject({ autorise: true, cause: 'admise', aConfirmer: true })
    expect(parAp.rappels.join(' ')).toMatch(/D\. 1967 art\. 62-7, al\. 1/)
  })

  it('une résolution ou une assemblée qui ne sont pas celles du dossier : erreur d’appel', () => {
    expect(() =>
      controlerAutorisationActionEnJustice(action('Litige entreprise'), { ...CONTEXTE_AG, resolution: resolution({ id: 'res-8' }) }),
    ).toThrow(/n'est pas celle du dossier/)
  })

  it('la saisie en vue de la vente garde son propre contrôle, motif inchangé', () => {
    expect(controlerAutorisationSaisieVente(dossierVente(), { ...CONTEXTE_AG, resolution: resolution({ etat: 'rejetee' }) }).motif).toMatch(
      /^Saisie immobilière : la résolution n° 7 est rejetée/,
    )
  })
})

describe('voies d’exécution — engager la saisie immobilière', () => {
  const preparee = () => dossierVente({})

  it('engage la saisie autorisée : copie datée, original inchangé', () => {
    const avant = preparee()
    const apres = engagerSaisieImmobiliere(avant, '2026-05-04', CONTEXTE_AG)
    expect(apres.voiesExecution?.saisieImmobiliere).toEqual({ engageeLe: '2026-05-04', audienceLe: null, adjudicationLe: null })
    expect(avant.voiesExecution.saisieImmobiliere?.engageeLe).toBeNull()
    expect(apres).not.toBe(avant)
  })

  it('coche la saisie immobilière si elle ne l’était pas', () => {
    const dossier = { coproprieteId: 'copro-1', decision: DECISION_AG, voiesExecution: voies({ venteLot: VENTE }) }
    expect(engagerSaisieImmobiliere(dossier, '2026-05-04', CONTEXTE_AG).voiesExecution?.saisieImmobiliere?.engageeLe).toBe(
      '2026-05-04',
    )
  })

  it('refuse sans décision, sans montants, avant la décision, ou déjà engagée', () => {
    expect(() => engagerSaisieImmobiliere(dossierVente({}, null), '2026-05-04', {})).toThrow(/Saisie immobilière non engagée/)
    expect(() =>
      engagerSaisieImmobiliere(dossierVente({}, DECISION_AG, { miseAPrixCentimes: 1 }), '2026-05-04', CONTEXTE_AG),
    ).toThrow(/sommes estimées définitivement perdues/)
    expect(() => engagerSaisieImmobiliere(preparee(), '2026-04-01', CONTEXTE_AG)).toThrow(/avant/)
    expect(() => engagerSaisieImmobiliere(dossierVente(), '2026-06-01', CONTEXTE_AG)).toThrow(/déjà engagée le 04\/05\/2026/)
    expect(() => engagerSaisieImmobiliere(preparee(), '2026-06-31', CONTEXTE_AG)).toThrow(/AAAA-MM-JJ/)
  })

  it('complète « Engagée le » d’une saisie datée par son audience ou son adjudication, mais pas à une date postérieure', () => {
    const parAudience = dossierVente({ audienceLe: '2026-06-01' })
    expect(() => engagerSaisieImmobiliere(parAudience, '2026-07-01', CONTEXTE_AG)).toThrow(
      /audience de saisie immobilière datée du 01\/06\/2026/,
    )
    expect(engagerSaisieImmobiliere(parAudience, '2026-05-04', CONTEXTE_AG).voiesExecution?.saisieImmobiliere).toEqual({
      engageeLe: '2026-05-04',
      audienceLe: '2026-06-01',
      adjudicationLe: null,
    })
    expect(engagerSaisieImmobiliere(parAudience, '2026-06-01', CONTEXTE_AG).voiesExecution?.saisieImmobiliere?.engageeLe).toBe(
      '2026-06-01',
    )
    expect(() => engagerSaisieImmobiliere(dossierVente({ adjudicationLe: '2026-06-01' }), '2026-06-02', CONTEXTE_AG)).toThrow(
      /adjudication datée du 01\/06\/2026/,
    )
  })

  it('refuse la décision de l’administrateur provisoire sans les pouvoirs de l’AG', () => {
    expect(() =>
      engagerSaisieImmobiliere(dossierVente({}, DECISION_AP), '2026-05-04', { regime: 'ap47', pouvoirsAgConfies: 'tous' }),
    ).toThrow(/art\. 29-1/)
    expect(
      engagerSaisieImmobiliere(dossierVente({}, DECISION_AP), '2026-05-04', { regime: 'ap291', pouvoirsAgConfies: 'tous' })
        .voiesExecution?.saisieImmobiliere?.engageeLe,
    ).toBe('2026-05-04')
  })
})

describe('voies d’exécution — dates : plausibilité et ordre (signale, ne refuse pas)', () => {
  const controler = (v: SaisieVoiesExecution, jalons: SaisieContentieux['jalons'] = {}) =>
    controlerDatesVoiesExecution({ dateOuverture: '2026-01-15', jalons, voiesExecution: voies(v) }, AUJOURDHUI)

  it('aucune anomalie sans voie d’exécution', () => {
    expect(controlerDatesVoiesExecution({ dateOuverture: '2026-01-15', jalons: {} }, AUJOURDHUI)).toEqual([])
  })

  it('audience et adjudication peuvent être futures ; pas l’engagement, l’inscription ni l’expulsion', () => {
    expect(
      controler(
        { saisieImmobiliere: { engageeLe: '2026-05-04', audienceLe: '2026-12-01', adjudicationLe: '2027-02-01' } },
        { jugement: '2026-03-01' },
      ),
    ).toEqual([])
    const anomalies = controler(
      { saisieImmobiliere: { engageeLe: '2026-11-04' }, expulsionLe: '2026-12-01', hypotheque: { inscriteLe: '2026-11-02' } },
      { miseEnDemeure: '2026-02-01', jugement: '2026-06-01' },
    )
    expect(anomalies.filter((a) => a.code === 'date_non_plausible').map((a) => [a.champ, a.nature])).toEqual([
      ['engageeLe', 'future'],
      ['expulsionLe', 'future'],
      ['inscriteLe', 'future'],
    ])
  })

  it('signale une année improbable ou une date trop lointaine (Gestéam accepte 2525)', () => {
    const anomalies = controler({ saisieImmobiliere: { engageeLe: '0026-05-04', adjudicationLe: '2525-02-01' } })
    expect(anomalies.filter((a) => a.code === 'date_non_plausible').map((a) => [a.champ, a.nature])).toEqual([
      ['engageeLe', 'annee_improbable'],
      ['adjudicationLe', 'trop_lointaine'],
    ])
    expect(anomalies[0].message).toMatch(/04\/05\/0026/)
  })

  it('ordre : engagée ≤ audience ≤ adjudication, engagée après l’ouverture', () => {
    const anomalies = controler(
      { saisieImmobiliere: { engageeLe: '2026-01-10', audienceLe: '2026-01-05', adjudicationLe: '2026-01-02' } },
      { jugement: '2025-12-01' },
    )
    expect(anomalies.map((a) => [a.code, a.champ])).toEqual([
      ['ordre_saisie_immobiliere', 'audienceLe'],
      ['ordre_saisie_immobiliere', 'adjudicationLe'],
      ['engagement_avant_ouverture', 'engageeLe'],
    ])
  })

  it('audience ou adjudication datée sans date d’engagement', () => {
    expect(controler({ saisieImmobiliere: { audienceLe: '2026-06-01' } }, { jugement: '2026-03-01' }).map((a) => a.code)).toEqual([
      'engagement_non_date',
    ])
  })

  it('saisie immobilière sans jugement ni ordonnance datés au plus tard à son premier acte : à vérifier (CPCE L. 311-2)', () => {
    const sans = controler({ saisieImmobiliere: { engageeLe: '2026-05-04' } })
    expect(sans).toMatchObject([{ code: 'saisie_sans_titre', champ: 'engageeLe', aConfirmer: true }])
    expect(sans[0].message).toMatch(/CPCE L\. 311-2/)
    expect(sans[0].message).toMatch(/R\. 321-3, 2°/)
    expect(controler({ saisieImmobiliere: { engageeLe: '2026-05-04' } }, { jugement: '2026-05-04' })).toEqual([])
    expect(controler({ saisieImmobiliere: { engageeLe: '2026-05-04' } }, { ordonnance: '2026-03-01' })).toEqual([])
    expect(controler({ saisieImmobiliere: { engageeLe: '2026-05-04' } }, { jugement: '2026-06-01' }).map((a) => a.code)).toEqual([
      'saisie_sans_titre',
    ])
    expect(controler({ saisieImmobiliere: { audienceLe: '2026-06-01' } }).map((a) => [a.code, a.champ])).toEqual([
      ['engagement_non_date', 'engageeLe'],
      ['saisie_sans_titre', 'audienceLe'],
    ])
    expect(controler({ saisieImmobiliere: {} })).toEqual([])
  })

  it('hypothèque inscrite sans mise en demeure préalable : à vérifier (art. 33 possible)', () => {
    const sans = controler({ hypotheque: { inscriteLe: '2026-03-01' } })
    expect(sans).toMatchObject([{ code: 'hypotheque_sans_mise_en_demeure', aConfirmer: true }])
    expect(sans[0].message).toMatch(/L\. 1965 art\. 19, al\. 1/)
    expect(controler({ hypotheque: { inscriteLe: '2026-03-01' } }, { miseEnDemeure: '2026-03-15' })).toHaveLength(1)
    expect(controler({ hypotheque: { inscriteLe: '2026-03-01' } }, { miseEnDemeure: '2026-02-01' })).toEqual([])
  })

  it('mise en demeure du jour même de l’inscription : elle n’a pu rester infructueuse (L. 1965 art. 19, al. 1)', () => {
    expect(controler({ hypotheque: { inscriteLe: '2026-03-01' } }, { miseEnDemeure: '2026-03-01' })).toMatchObject([
      { code: 'hypotheque_sans_mise_en_demeure', aConfirmer: true },
    ])
    expect(controler({ hypotheque: { inscriteLe: '2026-03-01' } }, { miseEnDemeure: '2026-02-28' })).toEqual([])
  })

  it('expulsion sans titre : ni jugement, ni ordonnance, ni adjudication antérieurs', () => {
    expect(controler({ expulsionLe: '2026-09-01' })).toMatchObject([{ code: 'expulsion_sans_titre', aConfirmer: true }])
    expect(controler({ expulsionLe: '2026-09-01' }, { jugement: '2026-06-01' })).toEqual([])
    expect(
      controler({ expulsionLe: '2026-09-01', saisieImmobiliere: { engageeLe: '2026-05-04', adjudicationLe: '2026-08-01' } }).filter(
        (a) => a.code === 'expulsion_sans_titre',
      ),
    ).toEqual([])
    expect(controler({ expulsionLe: '2026-09-01' }, { jugement: '2026-10-01' }).map((a) => a.code)).toEqual(['expulsion_sans_titre'])
  })

  it('refuse une date du jour invalide', () => {
    expect(() => controlerDatesVoiesExecution({ dateOuverture: '2026-01-15', jalons: {} }, '30/10/2026')).toThrow(/Date du jour/)
  })
})

describe('voies d’exécution — exécution engagée et phase « Exécution en cours »', () => {
  it('saisie cochée, saisie immobilière engagée ou expulsion datée ; ni l’hypothèque, ni la case Échéancier', () => {
    expect(executionEngagee(undefined)).toBe(false)
    expect(executionEngagee(SANS_VOIES_EXECUTION)).toBe(false)
    expect(executionEngagee(voies({ hypotheque: { inscriteLe: '2026-03-01' } }))).toBe(false)
    expect(executionEngagee(voies({ saisieImmobiliere: {} }))).toBe(false)
    expect(executionEngagee(voies({ saisies: ['attribution'] }))).toBe(true)
    expect(executionEngagee(voies({ expulsionLe: '2026-09-01' }))).toBe(true)
    expect(saisieVenteEngagee(voies({ saisieImmobiliere: { adjudicationLe: '2026-08-01' } }))).toBe(true)
    expect(saisieVenteEngagee(voies({ saisieImmobiliere: { audienceLe: '2026-08-01' } }))).toBe(true)
    expect(saisieVenteEngagee(voies({ saisieImmobiliere: {} }))).toBe(false)
  })

  it('la phase suggérée passe à « Exécution en cours » sans commandement ; la clôture l’emporte', () => {
    const dossier = creerDossierContentieux(saisie({ voiesExecution: voies({ saisies: ['arretLoyer'] }) }))
    expect(phaseSuggeree(dossier)).toEqual({ phase: 'Exécution en cours', ecart: true })
    const clos = creerDossierContentieux(saisie({ dateCloture: '2026-10-01', voiesExecution: voies({ saisies: ['arretLoyer'] }) }))
    expect(phaseSuggeree(clos).phase).toBe('Clos')
  })
})

describe('voies d’exécution — garantie de l’enchérisseur et hypothèque', () => {
  it('garantie : 10 % de la mise à prix, au moins 3 000 € (CPCE R. 322-41), arrondie au centime supérieur', () => {
    expect(GARANTIE_ENCHERE_MINIMUM_CENTIMES).toBe(300_000)
    expect(garantieEnchereCentimes(10_000_000)).toBe(1_000_000)
    expect(garantieEnchereCentimes(1_000_000)).toBe(300_000)
    expect(garantieEnchereCentimes(3_000_005)).toBe(300_001)
    expect(() => garantieEnchereCentimes(-1)).toThrow(/Mise à prix/)
  })

  it('postes exigibles depuis plus de cinq ans à l’inscription : exclus de l’hypothèque (L. 1965 art. 19, al. 4)', () => {
    const postes = [
      { id: 'p-1', exigibilite: '2021-03-09' },
      { id: 'p-2', exigibilite: '2021-03-10' },
      { id: 'p-3', exigibilite: '2025-10-01' },
    ]
    expect(postesHorsInscriptionHypotheque('2026-03-10', postes)).toEqual(['p-1'])
  })

  it('cinq ans de date à date : une inscription un 29 février exclut le poste exigible le 28 février cinq ans plus tôt', () => {
    const postes = [
      { id: 'a', exigibilite: '2023-02-28' },
      { id: 'b', exigibilite: '2023-02-27' },
    ]
    expect(postesHorsInscriptionHypotheque('2028-02-28', postes)).toEqual(['b'])
    expect(postesHorsInscriptionHypotheque('2028-02-29', postes)).toEqual(['a', 'b'])
    expect(postesHorsInscriptionHypotheque('2029-02-28', [{ id: 'c', exigibilite: '2024-02-29' }])).toEqual([])
    expect(postesHorsInscriptionHypotheque('2029-03-01', [{ id: 'c', exigibilite: '2024-02-29' }])).toEqual(['c'])
  })

  it('refuse une date d’inscription ou une exigibilité invalide', () => {
    const postes = [{ id: 'p-1', exigibilite: '2021-03-09' }]
    expect(() => postesHorsInscriptionHypotheque('2026-02-30', postes)).toThrow(/inscription/)
    expect(() => postesHorsInscriptionHypotheque('2026-03-10', [{ id: 'p-4', exigibilite: 'x' }])).toThrow(/p-4/)
  })
})

describe('voies d’exécution — en-têtes : sources et points ouverts', () => {
  // Les lignes de commentaire sont recollées : une phrase de l'en-tête peut courir sur plusieurs lignes.
  const lire = (fichier: string) =>
    readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', fichier), 'utf8').replaceAll(
      /\r?\n\s*\*\s*/g,
      ' ',
    )
  const source = lire('contentieux-voies-execution.ts')

  it('cite les textes du bilan : art. 55, al. 1 et 3, art. 11, I, 11°, L. 322-6', () => {
    expect(source).toMatch(/D\. 1967 art\. 55, al\. 1/)
    expect(source).toMatch(/« à l'exception de la saisie en vue de la vente d'un lot »/)
    expect(source).toMatch(/D\. 1967 art\. 11, I, 11°/)
    expect(source).toMatch(/CPCE art\. L\. 322-6/)
    expect(source).toMatch(/manque dans Gestéam/)
  })

  it('pose les questions 🔴 : majorité, administrateur provisoire, zéro euro', () => {
    expect(source).toMatch(/majorité de l'art\. 24 \(règle par défaut, L\. 1965 art\. 24, I/)
    expect(source).toMatch(/L'administrateur provisoire de l'art\. 29-1 investi des pouvoirs de l'AG/)
    expect(source).toMatch(/égales à 0 € sont-elles admises/)
  })

  it('rubrique « Décisions de Hugo du 03/11/2026 » : J33, J35 et J36 inscrites, 🔵 à confirmer ; questions 3 et 5 fermées', () => {
    const decisions = source.slice(source.indexOf('Décisions de Hugo du 03/11/2026'), source.indexOf('🔵 Déduit :'))
    expect(decisions).toMatch(/J33/)
    expect(decisions).toMatch(/C\. civ\. art\. 1343-5/)
    expect(decisions).toMatch(/J35 \(🔵 interprétation à confirmer\)/)
    expect(decisions).toMatch(/controlerAutorisationActionEnJustice/)
    expect(decisions).toMatch(/D\. 2025-1292, art\. 12/)
    expect(decisions).toMatch(/recharge normale des véhicules électriques \(CCH art\. R\. 113-8\)/)
    expect(decisions).toMatch(/29-1 A et 29-1 de la loi du 10 juillet 1965 ou du premier alinéa de CCH art\. L\. 615-6/)
    expect(source).not.toMatch(/04\/11\/2026/)
    expect(decisions).toMatch(/Contestation d'assemblée.*L\. 1965 art\. 42, al\. 2/)
    expect(decisions).not.toMatch(/les mesures conservatoires, les demandes qui relèvent des pouvoirs du juge des référés et la défense aux actions intentées contre le syndicat n'en demandent pas \(al\. 3\), ce que/)
    expect(decisions).toMatch(/J36 \(🔵 interprétation à confirmer\)/)
    expect(decisions).toMatch(/audience d'orientation \(CPCE R\. 322-15\)/)
    expect(decisions).toMatch(/commandement de payer valant saisie \(CPCE R\. 321-1\)/)
    const nonEtabli = source.slice(source.indexOf('🔴 Non établi'))
    expect(nonEtabli).not.toMatch(/se saisit-elle sans que la case Saisie/)
    expect(nonEtabli).not.toMatch(/dates fixées à l'avance ou constats/)
    expect(source).not.toMatch(/case « Échéancier » est conservée sans effet/)
  })

  it('cite l’art. 62-7 (avis du conseil syndical, mode de financement) et le titre exécutoire de la saisie immobilière', () => {
    expect(source).toMatch(/D\. 1967 art\. 62-7/)
    expect(source).toMatch(/recueille, sauf urgence, l'avis du conseil syndical/)
    expect(source).not.toMatch(/décide seul/)
    expect(source).toMatch(/CPCE art\. L\. 311-2/)
    expect(source).toMatch(/en vigueur à la date de la décision/)
  })

  it('l’en-tête de contentieux.ts renvoie au point 56', () => {
    const contentieux = lire('contentieux.ts')
    expect(contentieux).toMatch(/Point 56 du bilan Gestéam/)
    expect(contentieux).toMatch(/contentieux-voies-execution\.ts/)
  })
})
