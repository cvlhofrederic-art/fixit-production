import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  REGLES_DECISIONS_ANNUELLES,
  TYPES_DECISION_ANNUELLE,
  controlerDecisionAnnuelle,
  creerDecisionAnnuelle,
  decisionsEnVigueur,
  echeancesExercice,
  echeancesMandatsEtDelegations,
  enveloppeDelegationCs,
  exercicesDeLAssemblee,
  seuilsAtteints,
  type DecisionAnnuelle,
  type SaisieDecisionAnnuelle,
} from '@/lib/administrateur-judiciaire/domain/decisions-annuelles-ag'
import { creerExercice, type SaisieExercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import type { TypeMajorite } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import { creerResolution, voterResolution, voterSecondVote } from '@/lib/administrateur-judiciaire/domain/resolutions-ag'

/**
 * Décisions annuelles de l'assemblée et échéances de l'exercice (point 24 du bilan 2 ; Gestéam : fiche AG, bloc Exercice,
 * tranche 31 ; fiche exercice, onglet « Honoraires, suivi », tranche 43 § 9). Textes relus sur Légifrance le 29/10/2026 :
 * - L. 1965 art. 14-1, I : l'assemblée appelée à voter le budget se réunit dans les six mois du dernier jour de l'exercice
 *   précédent ; D. 1967 art. 43 : le budget se vote avant le début de l'exercice qu'il concerne ;
 * - art. 21, al. 2 : seuils de consultation du conseil syndical et de mise en concurrence, à la majorité de l'art. 25 ;
 * - art. 21-1 à 21-3 : délégation générale au conseil syndical (trois membres au moins, deux ans au plus) ; art. 25 a et
 *   D. 1967 art. 21 : délégation de pouvoir, acte délégué mentionné expressément ;
 * - art. 24, II, h et CSI L. 272-1 : seule l'autorisation permanente de la police municipale se vote ;
 * - art. 25 c, D. 1967 art. 22, 28 et 29 : désignation du syndic et du conseil syndical, trois ans au plus ;
 * - L. 1965 art. 18-1, D. 1967 art. 9-1 et 11, I, 1° : comptes notifiés et pièces justificatives consultables entre la
 *   convocation et l'assemblée qui approuve les comptes ;
 * - L. 1965 art. 29-1, I, al. 2 : l'administrateur provisoire peut recevoir tout ou partie des pouvoirs de l'assemblée ;
 *   le mandat du syndic cesse de plein droit à sa désignation ; D. 1967 art. 7, al. 3 : pas d'assemblée annuelle
 *   obligatoire quand il a tous les pouvoirs de l'assemblée ;
 * - D. 1967 art. 26-1 : montant alloué au conseil syndical dans le budget voté chaque année, montant maximum par dépense
 *   de travaux hors budget ; D. 1967 art. 29 et L. 1965 art. 18-1 A, III : majorité des honoraires selon leur objet.
 */

const exercice = (nom: string, surcharge: Partial<SaisieExercice> = {}) =>
  creerExercice({
    coproprieteId: 'copro-1',
    nom,
    ouverture: `${nom}-01-01`,
    cloture: `${nom}-12-31`,
    statut: 'Préparation',
    statutIrc: 'Non déclaré',
    agId: null,
    resolutions: { budget: null, complement: null, honoraires: null, travaux: null },
    ...surcharge,
  })

const E2025 = exercice('2025', { statut: 'Voté' })
const E2026 = exercice('2026')
const E2027 = exercice('2027')

const AG = { origine: 'assemblee', agId: 'ag-1', resolutionId: 'res-1' } as const

const saisie = (surcharge: Partial<SaisieDecisionAnnuelle> = {}): SaisieDecisionAnnuelle => ({
  id: 'dec-1',
  coproprieteId: 'copro-1',
  type: 'approbation_comptes',
  date: '2026-05-20',
  source: AG,
  exerciceId: 'ex-2025',
  ...surcharge,
})

const decision = (surcharge: Partial<SaisieDecisionAnnuelle> = {}) => creerDecisionAnnuelle(saisie(surcharge))

/** Décision permanente (sans exercice). */
const permanente = (surcharge: Partial<SaisieDecisionAnnuelle>) => decision({ exerciceId: null, ...surcharge })

const VOIX = { voixTotales: 1000, membresTotaux: 20, abstention: 0 }

const resolution = (majorite: TypeMajorite, pour: number, contre: number, membresPour?: number) =>
  voterResolution(creerResolution({ id: 'res-1', agId: 'ag-1', numero: 4, intitule: 'Résolution annuelle', majorite }), {
    ...VOIX,
    pour,
    contre,
    membresPour,
  })

const codes = (liste: { code: string }[]) => liste.map((a) => a.code)

/** Source du module, et en-tête mis à plat (sans les « * » de début de ligne). */
const SOURCE = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'decisions-annuelles-ag.ts'), 'utf8')
const EN_TETE = SOURCE.slice(0, SOURCE.indexOf('*/')).replaceAll(/\s*\n\s*\*\s*/g, ' ')
/** Points 🔴 de l'en-tête (à trancher par Frédéric ou Hugo). */
const NON_ETABLI = EN_TETE.slice(EN_TETE.indexOf('🔴 Non établi'))

describe('règles des décisions annuelles', () => {
  it('chaque type a sa règle : majorité, fondement, portée', () => {
    expect(Object.keys(REGLES_DECISIONS_ANNUELLES)).toEqual([...TYPES_DECISION_ANNUELLE])
    const majorites = Object.fromEntries(TYPES_DECISION_ANNUELLE.map((t) => [t, REGLES_DECISIONS_ANNUELLES[t].majorite]))
    expect(majorites).toEqual({
      approbation_comptes: 'art24',
      budget: 'art24',
      complement: 'art24',
      honoraires: null,
      travaux: null,
      enveloppe_delegation_cs: 'art24',
      seuil_consultation_cs: 'art25',
      seuil_mise_en_concurrence: 'art25',
      delegation_art25a: 'art25',
      delegation_generale_cs: 'art25',
      plafond_travaux_cs: 'art25',
      acces_police_municipale: 'art24',
      mandat_syndic: 'art25',
      mandat_cs: 'art25',
    })
    const exercices = TYPES_DECISION_ANNUELLE.filter((t) => REGLES_DECISIONS_ANNUELLES[t].portee === 'exercice')
    expect(exercices).toEqual(['approbation_comptes', 'budget', 'complement', 'honoraires', 'travaux', 'enveloppe_delegation_cs'])
  })

  it('honoraires : majorité selon l’objet (contrat de syndic à l’art. 25, honoraires de travaux avec les travaux), sans l’art. 24 par défaut', () => {
    const regle = REGLES_DECISIONS_ANNUELLES.honoraires
    expect(regle.majorite).toBeNull()
    expect(regle.aConfirmer).toBe(true)
    expect(regle.fondement).toMatch(/D\. 1967 art\. 29/)
    expect(regle.fondement).toMatch(/L\. 1965 art\. 18-1 A, III/)
    expect(regle.fondement).not.toMatch(/art\. 24, I/)
    expect(regle.note).not.toMatch(/29-1, II ; taxation/)
  })

  it('délégation au conseil syndical : enveloppe votée chaque année au budget, montant maximum par dépense de travaux hors budget', () => {
    expect(REGLES_DECISIONS_ANNUELLES.delegation_generale_cs.montant).toBeNull()
    expect(REGLES_DECISIONS_ANNUELLES.delegation_generale_cs.note).toMatch(/Sans montant/)
    expect(REGLES_DECISIONS_ANNUELLES.enveloppe_delegation_cs).toMatchObject({ portee: 'exercice', montant: 'requis' })
    expect(REGLES_DECISIONS_ANNUELLES.enveloppe_delegation_cs.fondement).toMatch(/D\. 1967 art\. 26-1, al\. 1/)
    expect(REGLES_DECISIONS_ANNUELLES.plafond_travaux_cs).toMatchObject({ portee: 'permanente', montant: 'requis', aConfirmer: true })
    expect(REGLES_DECISIONS_ANNUELLES.plafond_travaux_cs.fondement).toMatch(/D\. 1967 art\. 26-1, al\. 2/)
  })

  it('seuil de consultation du conseil syndical : « à partir de » ce montant, comme le texte et le calcul (≥)', () => {
    const note = REGLES_DECISIONS_ANNUELLES.seuil_consultation_cs.note
    expect(note).toMatch(/^À partir de ce montant, l'avis du conseil syndical est notifié avec l'ordre du jour/)
    expect(note).not.toMatch(/Au-delà/)
  })

  it('durées maximales lues sur le texte : syndic et conseil syndical trois ans, délégation générale au CS deux ans', () => {
    expect(REGLES_DECISIONS_ANNUELLES.mandat_syndic.dureeMaxMois).toBe(36)
    expect(REGLES_DECISIONS_ANNUELLES.mandat_cs.dureeMaxMois).toBe(36)
    expect(REGLES_DECISIONS_ANNUELLES.delegation_generale_cs.dureeMaxMois).toBe(24)
    expect(REGLES_DECISIONS_ANNUELLES.mandat_syndic.fondement).toMatch(/D\. 1967 art\. 28/)
    expect(REGLES_DECISIONS_ANNUELLES.mandat_cs.fondement).toMatch(/D\. 1967 art\. 22/)
    expect(REGLES_DECISIONS_ANNUELLES.delegation_generale_cs.fondement).toMatch(/21-3/)
  })

  it('accès : seule la police municipale se vote ; la police nationale, la gendarmerie et les secours entrent sans vote', () => {
    const regle = REGLES_DECISIONS_ANNUELLES.acces_police_municipale
    expect(regle.libelle).toMatch(/police municipale/)
    expect(regle.fondement).toMatch(/L\. 1965 art\. 24, II, h/)
    expect(regle.fondement).toMatch(/L\. 272-1/)
    expect(regle.note).toMatch(/gendarmerie nationales.*sans vote/)
  })

  it('l’approbation des comptes et le budget ne se délèguent pas au conseil syndical', () => {
    expect(REGLES_DECISIONS_ANNUELLES.approbation_comptes.note).toMatch(/21-1, al\. 2/)
    expect(REGLES_DECISIONS_ANNUELLES.budget.note).toMatch(/21-1, al\. 2/)
  })
})

describe('création d’une décision', () => {
  it('approbation des comptes d’un exercice, adoptée en assemblée', () => {
    expect(decision()).toEqual({
      id: 'dec-1',
      coproprieteId: 'copro-1',
      type: 'approbation_comptes',
      date: '2026-05-20',
      source: AG,
      exerciceId: 'ex-2025',
      montantCentimes: null,
      autorisee: null,
      delegataire: null,
      objet: null,
      autoriseDepenses: null,
      dureeMois: null,
      prendEffetLe: null,
      terme: null,
      designesIds: [],
    })
  })

  it('refuse un identifiant, un syndicat, un type ou une date invalides', () => {
    expect(() => decision({ id: ' ' })).toThrow(/identifiant/)
    expect(() => decision({ coproprieteId: '' })).toThrow(/syndicat/)
    expect(() => decision({ type: 'quitus' as never })).toThrow(/inconnu/)
    expect(() => decision({ date: '20/05/2026' })).toThrow(/AAAA-MM-JJ/)
  })

  it('exige l’assemblée et la résolution, ou la référence de la décision de l’administrateur provisoire', () => {
    expect(() => decision({ source: { origine: 'assemblee', agId: 'ag-1', resolutionId: ' ' } })).toThrow(/résolution/)
    expect(() => decision({ source: { origine: 'administrateur', reference: '' } })).toThrow(/62-8/)
    expect(() => decision({ source: { origine: 'juge' } as never })).toThrow(/Source/)
    expect(decision({ source: { origine: 'administrateur', reference: 'Décision AP n° 3' } }).source).toEqual({
      origine: 'administrateur',
      reference: 'Décision AP n° 3',
    })
  })

  it('une décision d’exercice exige l’exercice ; une décision permanente n’en a pas', () => {
    expect(() => decision({ exerciceId: null })).toThrow(/exercice attendu/)
    expect(() => decision({ type: 'seuil_consultation_cs', montantCentimes: 500000 })).toThrow(/permanente/)
    expect(permanente({ type: 'seuil_consultation_cs', montantCentimes: 500000 }).exerciceId).toBeNull()
  })

  it('montant en centimes entiers ; le complément peut être négatif ; sans objet pour l’approbation', () => {
    expect(decision({ type: 'budget', exerciceId: 'ex-2027', montantCentimes: 4200000 }).montantCentimes).toBe(4200000)
    expect(() => decision({ type: 'budget', exerciceId: 'ex-2027' })).toThrow(/montant attendu/)
    expect(() => decision({ type: 'budget', exerciceId: 'ex-2027', montantCentimes: -1 })).toThrow(/montant invalide/)
    expect(() => decision({ type: 'budget', exerciceId: 'ex-2027', montantCentimes: 10.5 })).toThrow(/montant invalide/)
    expect(decision({ type: 'complement', exerciceId: 'ex-2026', montantCentimes: -150000 }).montantCentimes).toBe(-150000)
    expect(() => decision({ montantCentimes: 100 })).toThrow(/sans objet/)
  })

  it('police municipale : autorisation accordée ou retirée, à dire expressément', () => {
    expect(permanente({ type: 'acces_police_municipale', autorisee: true }).autorisee).toBe(true)
    expect(permanente({ type: 'acces_police_municipale', autorisee: false }).autorisee).toBe(false)
    expect(() => permanente({ type: 'acces_police_municipale' })).toThrow(/accordée ou retirée/)
    expect(() => decision({ autorisee: true })).toThrow(/sans objet/)
  })

  it('délégation de l’art. 25 a : délégataire et acte délégué expressément ; plafond exigé si elle autorise des dépenses', () => {
    const delegation = permanente({
      type: 'delegation_art25a',
      delegataire: 'syndic',
      objet: '  Choix de l’entreprise   de ravalement ',
      autoriseDepenses: true,
      montantCentimes: 1500000,
    })
    expect(delegation).toMatchObject({
      delegataire: 'syndic',
      objet: 'Choix de l’entreprise de ravalement',
      autoriseDepenses: true,
      montantCentimes: 1500000,
    })
    const sansDepense = permanente({ type: 'delegation_art25a', delegataire: 'conseil_syndical', objet: 'Choix du coloris', autoriseDepenses: false })
    expect(sansDepense).toMatchObject({ autoriseDepenses: false, montantCentimes: null })
    expect(() => permanente({ type: 'delegation_art25a', delegataire: 'conseil_syndical', objet: 'Contrat d’entretien' })).toThrow(
      /dépenses.*L\. 1965 art\. 25, a/,
    )
    expect(() =>
      permanente({ type: 'delegation_art25a', delegataire: 'conseil_syndical', objet: 'Contrat d’entretien', autoriseDepenses: true }),
    ).toThrow(/montant maximum.*L\. 1965 art\. 25, a/)
    expect(() =>
      permanente({ type: 'delegation_art25a', delegataire: 'syndic', objet: 'Coloris', autoriseDepenses: false, montantCentimes: 100 }),
    ).toThrow(/sans dépense/)
    expect(() => permanente({ type: 'delegation_art25a', objet: 'Contrat', autoriseDepenses: false })).toThrow(/délégataire/)
    expect(() => permanente({ type: 'delegation_art25a', delegataire: 'syndic', objet: ' ', autoriseDepenses: false })).toThrow(
      /D\. 1967 art\. 21/,
    )
    expect(() => decision({ delegataire: 'syndic' })).toThrow(/sans objet/)
    expect(() => decision({ autoriseDepenses: true })).toThrow(/sans objet/)
  })

  it('délégation de l’art. 25 a : fin facultative (exécution, compte rendu à l’assemblée), sans durée', () => {
    const base = { type: 'delegation_art25a', delegataire: 'syndic', objet: 'Ravalement', autoriseDepenses: false } as const
    expect(permanente(base).terme).toBeNull()
    expect(permanente({ ...base, terme: '2026-12-31' })).toMatchObject({ terme: '2026-12-31', dureeMois: null, prendEffetLe: null })
    expect(() => permanente({ ...base, terme: '2026-05-19' })).toThrow(/antérieure à la décision/)
    expect(() => permanente({ ...base, terme: '31/12/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => permanente({ ...base, dureeMois: 6 })).toThrow(/sans objet/)
    expect(() => permanente({ type: 'seuil_consultation_cs', montantCentimes: 1, terme: '2026-12-31' })).toThrow(/sans objet/)
  })

  it('délégation générale au conseil syndical : sans montant ; enveloppe de l’exercice et plafond par dépense de travaux hors budget', () => {
    expect(permanente({ type: 'delegation_generale_cs', dureeMois: 24 }).montantCentimes).toBeNull()
    expect(() => permanente({ type: 'delegation_generale_cs', dureeMois: 24, montantCentimes: 300000 })).toThrow(/montant.*sans objet/)
    const enveloppe = decision({ type: 'enveloppe_delegation_cs', exerciceId: 'ex-2027', montantCentimes: 500000 })
    expect(enveloppe).toMatchObject({ exerciceId: 'ex-2027', montantCentimes: 500000 })
    expect(() => decision({ type: 'enveloppe_delegation_cs', exerciceId: 'ex-2027' })).toThrow(/montant attendu/)
    expect(() => permanente({ type: 'enveloppe_delegation_cs', montantCentimes: 500000 })).toThrow(/exercice attendu/)
    const plafond = permanente({ type: 'plafond_travaux_cs', objet: ' Remplacement   des boîtes aux lettres', montantCentimes: 800000 })
    expect(plafond).toMatchObject({ objet: 'Remplacement des boîtes aux lettres', montantCentimes: 800000 })
    expect(() => permanente({ type: 'plafond_travaux_cs', montantCentimes: 800000 })).toThrow(/26-1, al\. 2/)
    expect(() => permanente({ type: 'plafond_travaux_cs', objet: 'Boîtes aux lettres' })).toThrow(/montant attendu/)
  })

  it('mandat du conseil syndical : terme calculé depuis l’assemblée (veille du même quantième)', () => {
    const mandat = permanente({ type: 'mandat_cs', dureeMois: 36, designesIds: ['pos-1', 'pos-2'] })
    expect(mandat).toMatchObject({ dureeMois: 36, prendEffetLe: '2026-05-20', terme: '2029-05-19', designesIds: ['pos-1', 'pos-2'] })
  })

  it('terme calculé quand le quantième manque dans le mois d’arrivée : dernier jour de ce mois, sans perdre un jour', () => {
    const terme = (date: string, dureeMois: number) => permanente({ type: 'mandat_cs', date, dureeMois }).terme
    expect(terme('2028-02-29', 36)).toBe('2031-02-28')
    expect(terme('2028-02-28', 36)).toBe('2031-02-27')
    expect(terme('2028-03-01', 36)).toBe('2031-02-28')
    expect(terme('2027-03-01', 12)).toBe('2028-02-29')
    expect(terme('2027-08-31', 18)).toBe('2029-02-28')
    expect(terme('2027-03-31', 1)).toBe('2027-04-30')
  })

  it('mandat du syndic : dates calendaires du contrat conservées ; incohérences refusées', () => {
    const mandat = permanente({ type: 'mandat_syndic', dureeMois: 36, prendEffetLe: '2026-07-01', terme: '2029-06-30' })
    expect(mandat).toMatchObject({ prendEffetLe: '2026-07-01', terme: '2029-06-30' })
    expect(() => permanente({ type: 'mandat_syndic', prendEffetLe: '2026-07-01' })).toThrow(/durée/)
    expect(() => permanente({ type: 'mandat_syndic', dureeMois: 0 })).toThrow(/durée/)
    expect(() => permanente({ type: 'mandat_syndic', dureeMois: 12, prendEffetLe: '2026-05-01' })).toThrow(/antérieure à la décision/)
    expect(() => permanente({ type: 'mandat_syndic', dureeMois: 12, prendEffetLe: '2026-07-01', terme: '2026-06-30' })).toThrow(/terme/)
    expect(() => decision({ dureeMois: 12 })).toThrow(/sans objet/)
  })

  it('désignés : identifiants de positions ou d’identités, sans vide ni doublon, pour les seuls mandats', () => {
    expect(() => permanente({ type: 'mandat_cs', dureeMois: 36, designesIds: ['pos-1', ' '] })).toThrow(/vide/)
    expect(() => permanente({ type: 'mandat_cs', dureeMois: 36, designesIds: ['pos-1', 'pos-1'] })).toThrow(/double/)
    expect(() => decision({ designesIds: ['pos-1'] })).toThrow(/sans objet/)
  })
})

describe('contrôle d’une décision', () => {
  it('approbation des comptes adoptée à la majorité de l’art. 24, après la clôture : rien à signaler', () => {
    expect(controlerDecisionAnnuelle(decision(), { resolution: resolution('art24', 300, 100), exercice: E2025 })).toEqual([])
  })

  it('résolution non fournie : à rattacher', () => {
    expect(codes(controlerDecisionAnnuelle(decision()))).toEqual(['resolution_a_rattacher'])
  })

  it('résolution d’une autre assemblée ou d’un autre numéro : erreur', () => {
    const autre = { ...resolution('art24', 300, 100), agId: 'ag-2' }
    expect(() => controlerDecisionAnnuelle(decision(), { resolution: autre })).toThrow(/n'est pas celle/)
    const autreId = { ...resolution('art24', 300, 100), id: 'res-9' }
    expect(() => controlerDecisionAnnuelle(decision(), { resolution: autreId })).toThrow(/n'est pas celle/)
  })

  it('résolution rejetée : la décision n’est pas fondée, l’état est dit en clair', () => {
    const [anomalie] = controlerDecisionAnnuelle(decision(), { resolution: resolution('art24', 100, 300) })
    expect(anomalie.code).toBe('resolution_non_adoptee')
    expect(anomalie.message).toMatch(/rejetée/)
  })

  it('désignation du syndic soumise à la majorité de l’art. 24 : majorité insuffisante', () => {
    const mandat = permanente({ type: 'mandat_syndic', dureeMois: 36, prendEffetLe: '2026-07-01' })
    const anomalies = controlerDecisionAnnuelle(mandat, { resolution: resolution('art24', 300, 100) })
    expect(codes(anomalies)).toEqual(['majorite_insuffisante'])
    expect(anomalies[0].message).toMatch(/L\. 1965 art\. 25/)
  })

  it('désignation du syndic adoptée au second vote de l’art. 25-1 : régulière', () => {
    const premier = resolution('art25', 400, 100)
    expect(premier.etat).toBe('second_vote')
    const adoptee = voterSecondVote(premier, { ...VOIX, pour: 400, contre: 100 })
    const mandat = permanente({ type: 'mandat_syndic', dureeMois: 36, prendEffetLe: '2026-07-01' })
    expect(controlerDecisionAnnuelle(mandat, { resolution: adoptee })).toEqual([])
  })

  it('majorité plus forte que requise admise ; travaux : pas de majorité imposée par le type', () => {
    expect(controlerDecisionAnnuelle(decision(), { resolution: resolution('art26', 800, 100, 15) })).toEqual([])
    const travaux = decision({ type: 'travaux', exerciceId: 'ex-2026', montantCentimes: 9000000 })
    expect(controlerDecisionAnnuelle(travaux, { resolution: resolution('art24', 300, 100) })).toEqual([])
  })

  it('décision de l’administrateur provisoire : pouvoirs de l’assemblée selon le régime et l’ordonnance', () => {
    const parAp = decision({ source: { origine: 'administrateur', reference: 'Décision AP n° 3' } })
    expect(controlerDecisionAnnuelle(parAp, { regime: 'ap291', pouvoirsAgConfies: 'tous' })).toEqual([])
    const partie = controlerDecisionAnnuelle(parAp, { regime: 'ap291', pouvoirsAgConfies: 'partie' })
    expect(partie).toMatchObject([{ code: 'pouvoir_ag_a_verifier', aConfirmer: true }])
    const inconnus = controlerDecisionAnnuelle(parAp, { regime: 'ap291' })
    expect(codes(inconnus)).toEqual(['pouvoirs_ag_non_etablis'])
    expect(inconnus[0].message).toMatch(/n'est pas établie/)
    const aucun = controlerDecisionAnnuelle(parAp, { regime: 'ap291', pouvoirsAgConfies: 'aucun' })
    expect(codes(aucun)).toEqual(['aucun_pouvoir_ag_confie'])
    expect(aucun[0].message).toMatch(/l'ordonnance ne lui confie aucun pouvoir de l'assemblée/)
    expect(aucun[0].message).not.toMatch(/n'est pas établie/)
    const sj = controlerDecisionAnnuelle(parAp, { regime: 'sj', pouvoirsAgConfies: 'tous' })
    expect(codes(sj)).toEqual(['aucun_pouvoir_ag_confie'])
    expect(codes(controlerDecisionAnnuelle(parAp, { regime: 'ap47' }))).toEqual(['aucun_pouvoir_ag_confie'])
    const sansRegime = controlerDecisionAnnuelle(parAp)
    expect(codes(sansRegime)).toEqual(['pouvoirs_ag_non_etablis'])
    expect(sansRegime[0].message).toMatch(/sans mandat de justice renseigné/)
  })

  it('décision votée en assemblée alors que l’administrateur provisoire de l’art. 29-1 détient les pouvoirs de l’assemblée', () => {
    const adoptee = { resolution: resolution('art24', 600, 100) }
    const budget = decision({ type: 'budget', exerciceId: 'ex-2027', montantCentimes: 4200000 })
    const tous = controlerDecisionAnnuelle(budget, { ...adoptee, regime: 'ap291', pouvoirsAgConfies: 'tous' })
    expect(tous).toMatchObject([{ code: 'pouvoir_ag_confie_a_l_administrateur', fondement: 'L. 1965 art. 29-1, I, al. 2', aConfirmer: false }])
    expect(controlerDecisionAnnuelle(budget, { ...adoptee, regime: 'ap291', pouvoirsAgConfies: 'partie' })).toMatchObject([
      { code: 'pouvoir_ag_a_verifier', aConfirmer: true },
    ])
    expect(codes(controlerDecisionAnnuelle(budget, { ...adoptee, regime: 'ap291' }))).toEqual(['pouvoir_ag_a_verifier'])
    expect(controlerDecisionAnnuelle(budget, { ...adoptee, regime: 'ap291', pouvoirsAgConfies: 'aucun' })).toEqual([])
    expect(controlerDecisionAnnuelle(budget, { ...adoptee, regime: 'sj' })).toEqual([])
    const syndic = permanente({ type: 'mandat_syndic', dureeMois: 36, prendEffetLe: '2026-07-01' })
    const art25 = { resolution: resolution('art25', 600, 100) }
    expect(controlerDecisionAnnuelle(syndic, { ...art25, regime: 'ap291', pouvoirsAgConfies: 'tous' })).toMatchObject([
      { code: 'pouvoir_ag_confie_a_l_administrateur', aConfirmer: true },
    ])
  })

  it('durée au-delà du maximum légal, par la durée ou par le terme saisi', () => {
    const adoptee = { resolution: resolution('art25', 600, 100) }
    const cs = permanente({ type: 'mandat_cs', dureeMois: 48 })
    expect(controlerDecisionAnnuelle(cs, adoptee)).toMatchObject([{ code: 'duree_au_dela_du_maximum', aConfirmer: false }])
    const delegation = permanente({ type: 'delegation_generale_cs', dureeMois: 24, terme: '2028-12-31' })
    expect(codes(controlerDecisionAnnuelle(delegation, adoptee))).toEqual(['duree_au_dela_du_maximum', 'duree_et_terme_discordants'])
    expect(controlerDecisionAnnuelle(permanente({ type: 'mandat_cs', dureeMois: 36 }), adoptee)).toEqual([])
  })

  it('prise d’effet au 29 février : trois ans jusqu’au 28 février, sans fausse anomalie de durée', () => {
    const adoptee = { resolution: resolution('art25', 600, 100) }
    const contrat = permanente({ type: 'mandat_syndic', date: '2028-02-01', dureeMois: 36, prendEffetLe: '2028-02-29', terme: '2031-02-28' })
    expect(controlerDecisionAnnuelle(contrat, adoptee)).toEqual([])
    const tropLong = permanente({ type: 'mandat_syndic', date: '2028-02-01', dureeMois: 36, prendEffetLe: '2028-02-29', terme: '2031-03-01' })
    expect(controlerDecisionAnnuelle(tropLong, adoptee)[0].message).toMatch(/terme le 28\/02\/2031 au plus tard/)
  })

  it('durée et terme saisis discordants : à vérifier, sans refus (D. 1967 art. 29 : durée et dates calendaires)', () => {
    const adoptee = { resolution: resolution('art25', 600, 100) }
    const unMois = permanente({ type: 'mandat_syndic', dureeMois: 1, prendEffetLe: '2026-07-01', terme: '2029-06-30' })
    const anomalies = controlerDecisionAnnuelle(unMois, adoptee)
    expect(anomalies).toMatchObject([{ code: 'duree_et_terme_discordants', aConfirmer: true }])
    expect(anomalies[0].message).toMatch(/1 mois à compter du 01\/07\/2026 donnent un terme le 31\/07\/2026 ; terme saisi le 30\/06\/2029/)
    const court = permanente({ type: 'mandat_syndic', dureeMois: 36, prendEffetLe: '2026-07-01', terme: '2026-07-02' })
    expect(codes(controlerDecisionAnnuelle(court, adoptee))).toEqual(['duree_et_terme_discordants'])
  })

  it('comptes approuvés avant la clôture de l’exercice', () => {
    const anticipee = decision({ date: '2025-12-15' })
    expect(codes(controlerDecisionAnnuelle(anticipee, { resolution: resolution('art24', 300, 100), exercice: E2025 }))).toEqual([
      'approbation_avant_cloture',
    ])
  })

  it('budget voté après l’ouverture de l’exercice qu’il concerne (D. 1967 art. 43) ; N+2 voté avant : régulier', () => {
    const adoptee = { resolution: resolution('art24', 300, 100) }
    const tardif = decision({ type: 'budget', exerciceId: 'ex-2026', montantCentimes: 4000000 })
    const anomalies = controlerDecisionAnnuelle(tardif, { ...adoptee, exercice: E2026 })
    expect(anomalies).toMatchObject([{ code: 'budget_vote_apres_ouverture', fondement: 'D. 1967 art. 43', aConfirmer: false }])
    const nPlus2 = decision({ type: 'budget', exerciceId: 'ex-2027', montantCentimes: 4200000 })
    expect(controlerDecisionAnnuelle(nPlus2, { ...adoptee, exercice: E2027 })).toEqual([])
  })

  it('exercice d’un autre syndicat : erreur', () => {
    const autre = exercice('2025', { coproprieteId: 'copro-2' })
    expect(() => controlerDecisionAnnuelle(decision(), { exercice: autre })).toThrow(/autre syndicat/)
  })

  it('honoraires : une résolution à la majorité de l’art. 24 est à vérifier (contrat de syndic à l’art. 25, travaux à leur majorité)', () => {
    const honoraires = decision({ type: 'honoraires', exerciceId: 'ex-2026', montantCentimes: 360000 })
    const art24 = controlerDecisionAnnuelle(honoraires, { resolution: resolution('art24', 300, 100) })
    expect(art24).toMatchObject([{ code: 'majorite_a_verifier', aConfirmer: true }])
    expect(art24[0].message).toMatch(/D\. 1967 art\. 29/)
    expect(art24[0].message).toMatch(/L\. 1965 art\. 18-1 A, III/)
    expect(controlerDecisionAnnuelle(honoraires, { resolution: resolution('art25', 600, 100) })).toEqual([])
  })

  it('honoraires votés sous mandat de justice : à vérifier, fondement selon le régime ; délégation générale à un conseil de moins de trois membres', () => {
    const adoptee = { resolution: resolution('art25', 600, 100) }
    const honoraires = decision({ type: 'honoraires', exerciceId: 'ex-2026', montantCentimes: 360000 })
    const ap291 = controlerDecisionAnnuelle(honoraires, { ...adoptee, regime: 'ap291', pouvoirsAgConfies: 'aucun' })
    expect(ap291).toMatchObject([
      { code: 'honoraires_sous_mandat_judiciaire', fondement: 'L. 1965 art. 29-1, II ; D. 1967 art. 61-1-5', aConfirmer: true },
    ])
    expect(ap291[0].message).toMatch(/arrêtée par le président du tribunal judiciaire.*n'est pas votée par l'assemblée/)
    // Syndic désigné par le juge : il administre selon les art. 18 à 18-2 (D. 1967 art. 46, al. 3), donc avec des honoraires
    // de travaux votés par l'assemblée (art. 18-1 A, III) ; aucun texte relu sur sa rémunération.
    const sj = controlerDecisionAnnuelle(honoraires, { ...adoptee, regime: 'sj' })
    expect(sj).toMatchObject([
      { code: 'honoraires_sous_mandat_judiciaire', fondement: 'D. 1967 art. 46, al. 3 ; L. 1965 art. 18-1 A, III', aConfirmer: true },
    ])
    expect(sj[0].message).toMatch(/aucun texte relu ne dit qui fixe sa rémunération/)
    expect(sj[0].message).toMatch(/art\. 18 à 18-2/)
    expect(sj[0].message).not.toMatch(/n'est pas votée/)
    expect(sj[0].message).not.toMatch(/29-1, II/)
    // Administrateur provisoire de l'art. 47 : le texte du régime ne dit rien de la rémunération, et le fondement le dit.
    const ap47 = controlerDecisionAnnuelle(honoraires, { ...adoptee, regime: 'ap47' })
    expect(ap47).toMatchObject([
      { code: 'honoraires_sous_mandat_judiciaire', fondement: 'D. 1967 art. 47 (régime seul ; aucun texte relu sur la rémunération)' },
    ])
    expect(ap47[0].message).toMatch(/aucun texte relu ne dit qui fixe sa rémunération/)
    expect(ap47[0].message).not.toMatch(/n'est pas votée/)
    expect(REGLES_DECISIONS_ANNUELLES.honoraires.note).not.toMatch(/mandataire de justice, qui n'est pas votée/)
    expect(REGLES_DECISIONS_ANNUELLES.honoraires.note).toMatch(/administrateur provisoire de l'art\. 29-1/)
    expect(controlerDecisionAnnuelle(honoraires, adoptee)).toEqual([])
    const delegation = permanente({ type: 'delegation_generale_cs', dureeMois: 24 })
    const art25 = { resolution: resolution('art25', 600, 100) }
    expect(codes(controlerDecisionAnnuelle(delegation, { ...art25, membresConseilSyndical: 2 }))).toEqual(['conseil_syndical_insuffisant'])
    expect(controlerDecisionAnnuelle(delegation, { ...art25, membresConseilSyndical: 3 })).toEqual([])
    expect(() => controlerDecisionAnnuelle(delegation, { membresConseilSyndical: -1 })).toThrow(/membres/)
  })
})

describe('décisions permanentes en vigueur et seuils', () => {
  const seuilAncien = permanente({ id: 's-1', type: 'seuil_consultation_cs', date: '2024-05-10', montantCentimes: 500000 })
  const seuilNouveau = permanente({ id: 's-2', type: 'seuil_consultation_cs', date: '2026-05-20', montantCentimes: 800000 })
  const concurrence = permanente({ id: 's-3', type: 'seuil_mise_en_concurrence', date: '2024-05-10', montantCentimes: 1000000 })
  const cs1 = permanente({ id: 'cs-1', type: 'mandat_cs', date: '2023-06-01', dureeMois: 36 })
  const cs2 = permanente({ id: 'cs-2', type: 'mandat_cs', date: '2025-06-01', dureeMois: 36 })
  const syndic = permanente({ id: 'sy-1', type: 'mandat_syndic', date: '2024-06-01', dureeMois: 12 })
  const art25a = { type: 'delegation_art25a', date: '2025-06-01', autoriseDepenses: false } as const
  const deleg1 = permanente({ ...art25a, id: 'd-1', delegataire: 'syndic', objet: 'Ravalement' })
  const deleg2 = permanente({ ...art25a, id: 'd-2', delegataire: 'autre', objet: 'Ascenseur' })
  const budget = decision({ id: 'b-1', type: 'budget', exerciceId: 'ex-2027', montantCentimes: 4200000 })
  const toutes: DecisionAnnuelle[] = [seuilNouveau, cs1, budget, seuilAncien, concurrence, cs2, syndic, deleg1, deleg2]
  const ids = (liste: DecisionAnnuelle[]) => liste.map((d) => d.id)

  it('la décision la plus récente remplace la précédente ; mandats du CS et délégations de l’art. 25 a se cumulent', () => {
    expect(ids(decisionsEnVigueur(toutes, '2025-07-01'))).toEqual(['s-1', 's-3', 'd-1', 'd-2', 'cs-1', 'cs-2'])
    expect(ids(decisionsEnVigueur(toutes, '2026-06-01'))).toEqual(['s-2', 's-3', 'd-1', 'd-2', 'cs-2'])
  })

  it('décision à venir pas encore en vigueur ; mandat échu sorti ; décisions d’exercice ignorées', () => {
    expect(ids(decisionsEnVigueur(toutes, '2023-01-01'))).toEqual([])
    expect(ids(decisionsEnVigueur(toutes, '2025-05-31'))).toEqual(['s-1', 's-3', 'sy-1', 'cs-1'])
    expect(ids(decisionsEnVigueur(toutes, '2025-06-01'))).not.toContain('sy-1')
    expect(ids(decisionsEnVigueur(toutes, '2026-06-01'))).not.toContain('b-1')
  })

  it('délégation de l’art. 25 a : sortie à sa fin (exécution, compte rendu), sinon toujours en vigueur', () => {
    const finie = permanente({ ...art25a, id: 'd-3', delegataire: 'syndic', objet: 'Toiture', terme: '2025-12-31' })
    expect(ids(decisionsEnVigueur([deleg1, finie], '2025-12-31'))).toEqual(['d-1', 'd-3'])
    expect(ids(decisionsEnVigueur([deleg1, finie], '2040-01-01'))).toEqual(['d-1'])
  })

  it('mandat du syndic : sorti à la désignation de l’administrateur provisoire de l’art. 29-1 (cessation de plein droit)', () => {
    const sy = permanente({ id: 'sy-9', type: 'mandat_syndic', date: '2025-06-01', dureeMois: 36 })
    const fins = { finsMandatSyndic: [{ date: '2026-03-01', motif: 'administrateur_provisoire' as const }] }
    expect(ids(decisionsEnVigueur([sy], '2026-02-28', fins))).toEqual(['sy-9'])
    expect(ids(decisionsEnVigueur([sy], '2026-03-01', fins))).toEqual([])
    expect(ids(decisionsEnVigueur([sy], '2026-10-29', fins))).toEqual([])
    expect(ids(decisionsEnVigueur([sy], '2026-10-29'))).toEqual(['sy-9'])
    const suivant = permanente({ id: 'sy-10', type: 'mandat_syndic', date: '2027-06-01', dureeMois: 36 })
    expect(ids(decisionsEnVigueur([sy, suivant], '2027-06-01', fins))).toEqual(['sy-10'])
    expect(() => decisionsEnVigueur([sy], '2026-10-29', { finsMandatSyndic: [{ date: '2026-03-01', motif: 'deces' as never }] })).toThrow(
      /Motif/,
    )
    expect(() => decisionsEnVigueur([sy], '2026-10-29', { finsMandatSyndic: [{ date: '01/03/2026', motif: 'revocation' }] })).toThrow(
      /AAAA-MM-JJ/,
    )
  })

  it('montant maximum par dépense de travaux hors budget : vaut avec la délégation générale en vigueur', () => {
    const dg = permanente({ id: 'dg-1', type: 'delegation_generale_cs', date: '2026-05-20', dureeMois: 24 })
    const plafond = permanente({ id: 'pl-1', type: 'plafond_travaux_cs', date: '2026-05-20', objet: 'Interphone', montantCentimes: 400000 })
    const plafond2 = permanente({ id: 'pl-2', type: 'plafond_travaux_cs', date: '2027-05-20', objet: 'Éclairage', montantCentimes: 300000 })
    expect(ids(decisionsEnVigueur([dg, plafond, plafond2], '2027-06-01'))).toEqual(['dg-1', 'pl-1', 'pl-2'])
    expect(ids(decisionsEnVigueur([dg, plafond, plafond2], '2028-05-20'))).toEqual([])
    expect(ids(decisionsEnVigueur([plafond], '2027-06-01'))).toEqual([])
  })

  it('montant maximum par dépense de travaux : la délégation générale votée à la même assemblée vaut, même si elle prend effet plus tard', () => {
    const dg = permanente({ id: 'dg-1', type: 'delegation_generale_cs', dureeMois: 24, prendEffetLe: '2026-07-01' })
    const plafond = permanente({ id: 'pl-1', type: 'plafond_travaux_cs', objet: 'Interphone', montantCentimes: 400000 })
    expect(ids(decisionsEnVigueur([dg, plafond], '2026-06-01'))).toEqual([])
    expect(ids(decisionsEnVigueur([dg, plafond], '2026-08-01'))).toEqual(['dg-1', 'pl-1'])
    const anterieur = permanente({ id: 'pl-0', type: 'plafond_travaux_cs', date: '2025-05-20', objet: 'Portail', montantCentimes: 200000 })
    expect(ids(decisionsEnVigueur([dg, plafond, anterieur], '2026-08-01'))).toEqual(['dg-1', 'pl-1'])
  })

  it('montant maximum par dépense de travaux : un renouvellement de la délégation générale décidé après lui ne le reconduit pas (🔴, à saisir de nouveau)', () => {
    const dgA = permanente({ id: 'dg-a', type: 'delegation_generale_cs', dureeMois: 24 })
    const toiture = permanente({ id: 'pl-t', type: 'plafond_travaux_cs', date: '2027-01-15', objet: 'Toiture', montantCentimes: 900000 })
    const dgB = permanente({ id: 'dg-b', type: 'delegation_generale_cs', date: '2028-05-15', dureeMois: 24 })
    expect(ids(decisionsEnVigueur([dgA, toiture, dgB], '2027-06-01'))).toEqual(['dg-a', 'pl-t'])
    expect(ids(decisionsEnVigueur([dgA, toiture, dgB], '2028-06-01'))).toEqual(['dg-b'])
    const resaisi = permanente({ id: 'pl-t2', type: 'plafond_travaux_cs', date: '2028-05-15', objet: 'Toiture', montantCentimes: 900000 })
    expect(ids(decisionsEnVigueur([dgA, toiture, dgB, resaisi], '2028-06-01'))).toEqual(['dg-b', 'pl-t2'])
    expect(NON_ETABLI).toMatch(
      /montant maximum par dépense de travaux hors budget au renouvellement exprès de la délégation générale \(L\. 1965 art\. 21-3\) : est-il reconduit avec elle, ou l'assemblée doit-elle le fixer de nouveau \?/,
    )
    expect(EN_TETE).toMatch(/décidée \(date de la décision, non de sa prise d'effet\) au plus tard avec lui/)
  })

  it('conseil syndical dont chaque membre est désigné de nouveau au-delà du terme : la désignation précédente sort, comme son échéance est accomplie', () => {
    const csA = permanente({ id: 'cs-a', type: 'mandat_cs', date: '2024-05-20', dureeMois: 36, designesIds: ['p1', 'p2'] })
    const csB = permanente({ id: 'cs-b', type: 'mandat_cs', date: '2026-05-20', dureeMois: 36, designesIds: ['p1', 'p2'] })
    expect(ids(decisionsEnVigueur([csA, csB], '2026-05-19'))).toEqual(['cs-a'])
    expect(ids(decisionsEnVigueur([csA, csB], '2026-06-01'))).toEqual(['cs-b'])
    const echeances = echeancesMandatsEtDelegations([csA, csB]).map((e) => [e.objetId, e.accomplie])
    expect(echeances).toEqual([
      ['cs-a', true],
      ['cs-b', false],
    ])
  })

  it('conseil syndical dont un seul membre est désigné de nouveau : la désignation précédente reste (🔴), son échéance aussi', () => {
    const csA = permanente({ id: 'cs-a', type: 'mandat_cs', date: '2024-05-20', dureeMois: 36, designesIds: ['p1', 'p2'] })
    const csC = permanente({ id: 'cs-c', type: 'mandat_cs', date: '2026-05-20', dureeMois: 36, designesIds: ['p1'] })
    expect(ids(decisionsEnVigueur([csA, csC], '2026-06-01'))).toEqual(['cs-a', 'cs-c'])
    expect(echeancesMandatsEtDelegations([csA, csC]).map((e) => [e.objetId, e.accomplie])).toEqual([
      ['cs-a', false],
      ['cs-c', false],
    ])
    expect(NON_ETABLI).toMatch(/membre du conseil syndical désigné de nouveau avant le terme de son mandat.*le mandat précédent prend-il fin \?/)
  })

  it('enveloppe de la délégation au conseil syndical : celle du budget de chaque exercice, pas un montant figé sur deux ans', () => {
    const dg = permanente({ id: 'dg-1', type: 'delegation_generale_cs', date: '2026-05-20', dureeMois: 24 })
    const env2027 = decision({ id: 'e-1', type: 'enveloppe_delegation_cs', exerciceId: 'ex-2027', montantCentimes: 300000 })
    const env2028 = decision({ id: 'e-2', type: 'enveloppe_delegation_cs', date: '2027-05-20', exerciceId: 'ex-2028', montantCentimes: 500000 })
    const decisions = [dg, env2027, env2028]
    expect(enveloppeDelegationCs(decisions, 'ex-2027')).toBe(300000)
    expect(enveloppeDelegationCs(decisions, 'ex-2028')).toBe(500000)
    expect(enveloppeDelegationCs(decisions, 'ex-2029')).toBeNull()
    expect(ids(decisionsEnVigueur(decisions, '2027-12-01'))).toEqual(['dg-1'])
    expect(echeancesMandatsEtDelegations(decisions).map((e) => [e.objetId, e.accomplie])).toEqual([['dg-1', false]])
  })

  it('refuse un mélange de syndicats et une date invalide', () => {
    const autre = permanente({ id: 'x', coproprieteId: 'copro-2', type: 'seuil_consultation_cs', montantCentimes: 1 })
    expect(() => decisionsEnVigueur([seuilAncien, autre], '2026-06-01')).toThrow(/syndicat/)
    expect(() => decisionsEnVigueur(toutes, '01/06/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('seuils : « à partir duquel » s’entend du montant égal ou supérieur ; sans décision, on ne sait pas', () => {
    const enVigueur = decisionsEnVigueur(toutes, '2026-06-01')
    expect(seuilsAtteints(800000, enVigueur)).toEqual({ consultationCs: true, miseEnConcurrence: false })
    expect(seuilsAtteints(799999, enVigueur)).toEqual({ consultationCs: false, miseEnConcurrence: false })
    expect(seuilsAtteints(1000000, enVigueur)).toEqual({ consultationCs: true, miseEnConcurrence: true })
    expect(seuilsAtteints(1000000, [])).toEqual({ consultationCs: null, miseEnConcurrence: null })
    expect(() => seuilsAtteints(-1, enVigueur)).toThrow(/centimes/)
  })
})

describe('exercices de l’assemblée (bloc Exercice de la fiche AG)', () => {
  it('assemblée de 2026 : comptes 2025 approuvés, exercice 2026 en cours, budget 2027 (N+2) à voter', () => {
    const blocs = exercicesDeLAssemblee('2026-05-20', [E2027, E2025, E2026])
    expect(blocs.approuve?.nom).toBe('2025')
    expect(blocs.enCours?.nom).toBe('2026')
    expect(blocs.aVoter?.nom).toBe('2027')
  })

  it('sans exercice : rien ; exercices de plusieurs syndicats : erreur', () => {
    expect(exercicesDeLAssemblee('2026-05-20', [])).toEqual({ approuve: null, enCours: null, aVoter: null })
    expect(() => exercicesDeLAssemblee('2026-05-20', [E2025, exercice('2026', { coproprieteId: 'copro-2' })])).toThrow(/syndicat/)
  })
})

describe('échéances de l’exercice', () => {
  const options = { exerciceId: 'ex-2025', dateAg: null, conseilSyndical: true }

  it('assemblée appelée à voter le budget : six mois après la clôture (L. 1965 art. 14-1, I)', () => {
    expect(echeancesExercice(E2025, options)).toEqual([
      {
        code: 'assemblee_budget',
        objetId: 'ex-2025',
        libelle: 'Exercice 2025 clos le 31/12/2025 : assemblée appelée à voter le budget, à réunir au plus tard le 30/06/2026',
        date: '2026-06-30',
        fondement: 'L. 1965 art. 14-1, I, al. 1 ; D. 1967 art. 7, al. 1',
        aConfirmer: false,
        accomplie: false,
      },
    ])
  })

  it('accomplie par un budget voté après la clôture (en assemblée ou par l’administrateur provisoire), pas avant', () => {
    const avant = decision({ id: 'b-0', type: 'budget', date: '2025-11-15', exerciceId: 'ex-2026', montantCentimes: 4000000 })
    expect(echeancesExercice(E2025, { ...options, decisions: [avant] })[0].accomplie).toBe(false)
    const enAssemblee = decision({ id: 'b-2', type: 'budget', exerciceId: 'ex-2027', montantCentimes: 4200000 })
    expect(enAssemblee.source.origine).toBe('assemblee')
    expect(echeancesExercice(E2025, { ...options, decisions: [avant, enAssemblee] })[0].accomplie).toBe(true)
    const parAp = decision({
      id: 'b-1',
      type: 'budget',
      exerciceId: 'ex-2027',
      montantCentimes: 4200000,
      source: { origine: 'administrateur', reference: 'Décision AP n° 3' },
    })
    expect(echeancesExercice(E2025, { ...options, decisions: [avant, parAp] })[0].accomplie).toBe(true)
    const autreSyndicat = { ...parAp, coproprieteId: 'copro-2' }
    expect(echeancesExercice(E2025, { ...options, decisions: [autreSyndicat] })[0].accomplie).toBe(false)
  })

  it('un budget voté plus d’un an après la clôture n’accomplit pas l’échéance de cet exercice', () => {
    const E2024 = exercice('2024', { statut: 'Voté' })
    const tardif = decision({ id: 'b-9', type: 'budget', date: '2027-05-20', exerciceId: 'ex-2028', montantCentimes: 4400000 })
    const avecTardif = { ...options, exerciceId: 'ex-2024', decisions: [tardif] }
    expect(echeancesExercice(E2024, avecTardif)[0]).toMatchObject({ date: '2025-06-30', accomplie: false })
    const dansLAnnee = decision({ id: 'b-8', type: 'budget', date: '2025-12-31', exerciceId: 'ex-2026', montantCentimes: 4000000 })
    expect(echeancesExercice(E2024, { ...avecTardif, decisions: [tardif, dansLAnnee] })[0].accomplie).toBe(true)
  })

  it('administrateur provisoire de l’art. 29-1 investi de tous les pouvoirs de l’assemblée : budget à décider par lui (D. 1967 art. 7, al. 3)', () => {
    const [tous] = echeancesExercice(E2025, { ...options, regime: 'ap291', pouvoirsAgConfies: 'tous' })
    expect(tous.libelle).toMatch(/budget à décider par l'administrateur provisoire/)
    expect(tous.libelle).not.toMatch(/assemblée appelée/)
    expect(tous.fondement).toMatch(/D\. 1967 art\. 7, al\. 3/)
    expect(tous.fondement).not.toMatch(/art\. 7, al\. 1/)
    expect(tous).toMatchObject({ date: '2026-06-30', aConfirmer: true })
    const [partie] = echeancesExercice(E2025, { ...options, regime: 'ap291', pouvoirsAgConfies: 'partie' })
    expect(partie).toMatchObject({ aConfirmer: true, fondement: 'L. 1965 art. 14-1, I, al. 1 ; D. 1967 art. 7, al. 1 et 3' })
    expect(partie.libelle).toMatch(/selon les pouvoirs que lui confie l'ordonnance/)
    const [sj] = echeancesExercice(E2025, { ...options, regime: 'sj', pouvoirsAgConfies: null })
    expect(sj).toMatchObject({ fondement: 'L. 1965 art. 14-1, I, al. 1 ; D. 1967 art. 7, al. 1', aConfirmer: false })
  })

  it('exercice « Non géré » : aucune échéance', () => {
    expect(echeancesExercice(exercice('2025', { statut: 'Non géré' }), options)).toEqual([])
  })

  it('avec l’assemblée des comptes : remise au conseil syndical (repère de gestion) et convocation, triées par date', () => {
    const echeances = echeancesExercice(E2025, { ...options, dateAg: '2026-05-20', avanceRemiseCsJours: 15 })
    expect(echeances.map((e) => [e.code, e.date, e.aConfirmer, e.accomplie])).toEqual([
      ['comptes_au_conseil_syndical', '2026-04-13', true, false],
      ['convocation_comptes', '2026-04-28', true, false],
      ['assemblee_budget', '2026-06-30', false, false],
    ])
    expect(echeances[0].libelle).toMatch(/aucun délai légal/)
    expect(echeances[1].fondement).toMatch(/art\. 9-1/)
    expect(echeances[1].fondement).toMatch(/L\. 1965 art\. 18-1/)
    expect(echeances[1].fondement).toMatch(/11, I, 1°/)
  })

  it('sans conseil syndical : pas de remise ; délai de convocation plus long du règlement', () => {
    const echeances = echeancesExercice(E2025, { ...options, dateAg: '2026-05-20', conseilSyndical: false, delaiConvocationJours: 30 })
    expect(echeances.map((e) => [e.code, e.date])).toEqual([
      ['convocation_comptes', '2026-04-19'],
      ['assemblee_budget', '2026-06-30'],
    ])
  })

  it('dates de clôture renseignées (« CS avant AG », « Rendu des comptes N ») ou comptes approuvés : accomplies', () => {
    const suivi = { comptesRemisAuCsLe: '2026-04-10', redditionComptesLe: '2026-04-25' }
    const avecSuivi = echeancesExercice(E2025, { ...options, dateAg: '2026-05-20', suivi })
    expect(avecSuivi.filter((e) => e.code !== 'assemblee_budget').every((e) => e.accomplie)).toBe(true)
    const approuves = echeancesExercice(E2025, { ...options, dateAg: '2026-05-20', decisions: [decision()] })
    expect(approuves.find((e) => e.code === 'convocation_comptes')?.accomplie).toBe(true)
    expect(approuves.find((e) => e.code === 'comptes_au_conseil_syndical')?.accomplie).toBe(false)
  })

  it('refuse des dates ou des réglages incohérents', () => {
    expect(() => echeancesExercice(E2025, { ...options, exerciceId: ' ' })).toThrow(/identifiant/)
    expect(() => echeancesExercice(E2025, { ...options, dateAg: '2025-12-31' })).toThrow(/clôture/)
    const suivi = { comptesRemisAuCsLe: '2025-12-01', redditionComptesLe: null }
    expect(() => echeancesExercice(E2025, { ...options, suivi })).toThrow(/clôture/)
    expect(() => echeancesExercice(E2025, { ...options, suivi: { comptesRemisAuCsLe: null, redditionComptesLe: '25/04/2026' } })).toThrow(
      /AAAA-MM-JJ/,
    )
    expect(() => echeancesExercice(E2025, { ...options, delaiConvocationJours: 15 })).toThrow(/21/)
    expect(() => echeancesExercice(E2025, { ...options, avanceRemiseCsJours: -1 })).toThrow(/avance/)
  })
})

describe('échéances des mandats et de la délégation au conseil syndical', () => {
  const syndic = permanente({ id: 'sy-1', type: 'mandat_syndic', dureeMois: 36, prendEffetLe: '2026-07-01', terme: '2029-06-30' })
  const cs = permanente({ id: 'cs-1', type: 'mandat_cs', dureeMois: 36, designesIds: ['pos-1', 'pos-2'] })
  const delegation = permanente({ id: 'dg-1', type: 'delegation_generale_cs', dureeMois: 24 })
  const seuil = permanente({ id: 's-1', type: 'seuil_consultation_cs', montantCentimes: 500000 })

  it('terme du mandat du syndic, du conseil syndical, fin de la délégation, triés par date', () => {
    const echeances = echeancesMandatsEtDelegations([syndic, cs, delegation, seuil])
    expect(echeances.map((e) => [e.code, e.objetId, e.date, e.accomplie])).toEqual([
      ['fin_delegation_cs', 'dg-1', '2028-05-19', false],
      ['terme_mandat_cs', 'cs-1', '2029-05-19', false],
      ['terme_mandat_syndic', 'sy-1', '2029-06-30', false],
    ])
    expect(echeances[2].libelle).toMatch(/décision expresse/)
    expect(echeances[2].fondement).toMatch(/art\. 18, VI/)
  })

  const accomplies = (liste: DecisionAnnuelle[]) =>
    Object.fromEntries(echeancesMandatsEtDelegations(liste).map((e) => [e.objetId, e.accomplie]))

  it('renouvellement : une décision plus récente du même type accomplit l’échéance', () => {
    const syndic2 = permanente({ id: 'sy-2', type: 'mandat_syndic', date: '2029-05-15', dureeMois: 36, prendEffetLe: '2029-07-01' })
    expect(accomplies([syndic, syndic2])).toEqual({ 'sy-1': true, 'sy-2': false })
  })

  it('conseil syndical : la désignation qui le porte au-delà du terme accomplit l’échéance, même sans reconduire chaque membre', () => {
    const nouveauConseil = permanente({ id: 'cs-2', type: 'mandat_cs', date: '2029-05-15', dureeMois: 36, designesIds: ['pos-3', 'pos-4'] })
    expect(accomplies([cs, nouveauConseil])).toEqual({ 'cs-1': true, 'cs-2': false })
    const partiel = permanente({ id: 'cs-3', type: 'mandat_cs', date: '2029-05-15', dureeMois: 36, designesIds: ['pos-1'] })
    expect(accomplies([cs, partiel])['cs-1']).toBe(true)
  })

  it('conseil syndical : une élection complémentaire alignée sur le terme en cours ne renouvelle pas le conseil', () => {
    const complementaire = permanente({ id: 'cs-4', type: 'mandat_cs', date: '2027-05-20', dureeMois: 24, designesIds: ['pos-3'] })
    expect(complementaire.terme).toBe(cs.terme)
    expect(accomplies([cs, complementaire])).toEqual({ 'cs-1': false, 'cs-4': false })
  })

  it('conseil syndical : l’élection en cours de mandat d’un membre pour trois ans pleins ne renouvelle pas tout le conseil', () => {
    const conseil = permanente({ id: 'cs-1', type: 'mandat_cs', dureeMois: 36, designesIds: ['p1', 'p2', 'p3'] })
    expect(conseil.terme).toBe('2029-05-19')
    const unMembre = permanente({ id: 'cs-2', type: 'mandat_cs', date: '2027-05-20', dureeMois: 36, designesIds: ['p4'] })
    expect(unMembre.terme).toBe('2030-05-19')
    expect(accomplies([conseil, unMembre])).toEqual({ 'cs-1': false, 'cs-2': false })
    const anneePrecedente = permanente({ id: 'cs-3', type: 'mandat_cs', date: '2028-05-20', dureeMois: 36, designesIds: ['p4'] })
    expect(accomplies([conseil, anneePrecedente])['cs-1']).toBe(false)
  })

  it('conseil syndical : renouvelé par une désignation qui prend effet moins de six mois avant son terme, ou après', () => {
    const conseil = permanente({ id: 'cs-1', type: 'mandat_cs', dureeMois: 36, designesIds: ['p1', 'p2', 'p3'] })
    const designation = (id: string, date: string) => permanente({ id, type: 'mandat_cs', date, dureeMois: 36, designesIds: ['p5'] })
    expect(accomplies([conseil, designation('cs-6', '2028-11-19')])['cs-1']).toBe(false)
    expect(accomplies([conseil, designation('cs-7', '2028-11-20')])['cs-1']).toBe(true)
    expect(accomplies([conseil, designation('cs-8', '2029-06-10')])['cs-1']).toBe(true)
    const unMembre = permanente({ id: 'cs-2', type: 'mandat_cs', date: '2027-05-20', dureeMois: 36, designesIds: ['p4'] })
    expect(accomplies([conseil, unMembre, designation('cs-8', '2029-06-10')])).toEqual({ 'cs-1': true, 'cs-2': false, 'cs-8': false })
    expect(NON_ETABLI).toMatch(
      /assemblée tenue hors du délai de six mois après la clôture, ou par une assemblée extraordinaire : la fenêtre de six mois avant le terme suffit-elle à reconnaître son renouvellement, ou faut-il le saisir expressément \?/,
    )
  })

  it('mandat du syndic cessé avant son terme (administrateur provisoire de l’art. 29-1, révocation…) : échéance close', () => {
    const sy = permanente({ id: 'sy-9', type: 'mandat_syndic', date: '2025-06-01', dureeMois: 36 })
    const fins = [{ date: '2026-03-01', motif: 'administrateur_provisoire' as const }]
    const [echeance] = echeancesMandatsEtDelegations([sy], { finsMandatSyndic: fins })
    expect(echeance).toMatchObject({ code: 'terme_mandat_syndic', date: '2028-05-31', accomplie: true, fondement: 'L. 1965 art. 29-1, I, al. 2' })
    expect(echeance.libelle).toMatch(/fin le 01\/03\/2026/)
    expect(echeance.libelle).toMatch(/administrateur provisoire/)
    expect(echeance.libelle).not.toMatch(/décision expresse/)
    const [revoque] = echeancesMandatsEtDelegations([sy], { finsMandatSyndic: [{ date: '2027-01-15', motif: 'revocation' }] })
    expect(revoque).toMatchObject({ accomplie: true, fondement: 'L. 1965 art. 25, c' })
    const [apresTerme] = echeancesMandatsEtDelegations([sy], { finsMandatSyndic: [{ date: '2028-06-01', motif: 'resiliation' }] })
    expect(apresTerme).toMatchObject({ accomplie: false, fondement: 'L. 1965 art. 18, VI ; D. 1967 art. 29' })
    const [csIntact] = echeancesMandatsEtDelegations([cs], { finsMandatSyndic: fins })
    expect(csIntact.accomplie).toBe(false)
  })
})

describe('en-tête du module', () => {
  it('sources Gestéam, droit relu, marqueurs et distinction avec la reddition de fin de mission', () => {
    expect(SOURCE).toMatch(/Légifrance le 29\/10\/2026/)
    expect(SOURCE).toMatch(/tranche 31/)
    expect(SOURCE).toMatch(/tranche 43 § 9/)
    for (const marqueur of ['🟢', '🔵', '🔴']) expect(SOURCE).toContain(marqueur)
    expect(SOURCE).toMatch(/planification-mandat\.ts/)
  })

  it('🔴 honoraires sous mandat de justice : la question est posée régime par régime, sans affirmer une règle non lue', () => {
    expect(NON_ETABLI).not.toMatch(/la rémunération du mandataire n'étant pas votée par l'assemblée/)
    expect(NON_ETABLI).toMatch(/syndic désigné par le juge : qui fixe sa rémunération \?/)
    expect(NON_ETABLI).toMatch(/administrateur provisoire de l'art\. 47 : qui fixe sa rémunération \?/)
  })

  it('L. 1965 art. 25-1 cité à la lettre (droit24/loi65.txt)', () => {
    expect(EN_TETE).toContain("« en application de l'article 25 ou d'une autre disposition »")
    expect(EN_TETE).not.toContain('« ou une autre disposition »')
  })

  it('J7 : l’alerte de l’art. 29-1 A est modélisée dans un module voisin, elle ne figure plus parmi les points non établis', () => {
    expect(NON_ETABLI).not.toMatch(/alerte de l'art\. 29-1 A/)
    expect(NON_ETABLI).not.toMatch(/non modélisée/)
    expect(EN_TETE).toMatch(/alerte de l'art\. 29-1 A.*\(alerte-mandataire-ad-hoc\.ts\)/)
  })
})
