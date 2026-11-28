import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ajouterJoursOuvres } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  REGLAGES_SUIVI_EMPLOYEUR_PAR_DEFAUT,
  alertesEmployeur,
  avisExonerationTaxeSalaires,
  dateEcheanceDsn,
  datesVisitePeriodique,
  echeancesEmployeur,
  jourEcheanceDsn,
  periodiciteTaxeSalaires,
  taxeSalairesExigible,
  versElementsAFaire,
  versementCotisations,
  visiteRepriseRequise,
  type ArretTravail,
  type EcheanceEmployeur,
  type EtatEmployeur,
  type ReglagesSuiviEmployeur,
} from '@/lib/administrateur-judiciaire/domain/echeances-employeur'
import {
  PLAN_PAIE_PAR_DEFAUT,
  creerSalarieSyndicat,
  traitementConstatationPaie,
  traitementReglementPaie,
  type BulletinPaie,
  type ReglementPaieEcrit,
} from '@/lib/administrateur-judiciaire/domain/personnel-syndicat'
import { annulerTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'

const AUJ = '2026-10-30'

const gardien = creerSalarieSyndicat({
  id: 'sal-1',
  coproprieteId: 'copro-1',
  identiteId: 'identite-1',
  qualite: 'Gardien',
  auxiliaire421: '00001',
  entreeLe: '2024-03-01',
  sortieLe: null,
})

/** Employeur à jour : DSN de septembre faite, visite passée, DUERP mis à jour, transmis et déposé (ou conservé). */
const etat = (champs: Partial<EtatEmployeur> = {}): EtatEmployeur => ({
  coproprieteId: 'copro-1',
  salaries: [gardien],
  effectif: 1,
  paieDuMoisMeme: true,
  versementTrimestrielCotisations: false,
  derniereDsn: { annee: 2026, mois: 9 },
  radiationLe: null,
  adhesionSanteTravailLe: '2024-03-10',
  suivisMedicaux: [{ salarieId: 'sal-1', derniereVisiteLe: '2025-05-01', prochaineLe: null }],
  arrets: [],
  duerp: { misAJourLe: '2026-02-01', transmisLe: '2026-02-01', deposeLe: '2026-02-01' },
  bulletins: [],
  reglements: [],
  traitements: [],
  taxeSalaires: null,
  ...champs,
})

const echeances = (champs: Partial<EtatEmployeur> = {}, reglages: Partial<ReglagesSuiviEmployeur> = {}, aujourdhui = AUJ) =>
  echeancesEmployeur(etat(champs), aujourdhui, { ...REGLAGES_SUIVI_EMPLOYEUR_PAR_DEFAUT, ...reglages })
const de = (liste: EcheanceEmployeur[], obligation: EcheanceEmployeur['obligation']) => liste.filter((e) => e.obligation === obligation)
const dates = (liste: EcheanceEmployeur[]) => liste.map((e) => e.date)

describe('DSN (CSS R133-14 et R243-6)', () => {
  it('le 15 du mois suivant, sauf effectif d’au moins 50 salariés avec paie du mois : le 5', () => {
    expect(jourEcheanceDsn(1, true)).toBe(15)
    expect(jourEcheanceDsn(49, true)).toBe(15)
    expect(jourEcheanceDsn(50, true)).toBe(5)
    expect(jourEcheanceDsn(50, false)).toBe(15)
  })

  it('DSN de décembre exigible le 15 janvier de l’année suivante', () => {
    expect(dateEcheanceDsn({ annee: 2026, mois: 12 }, { effectif: 1, paieDuMoisMeme: true })).toBe('2027-01-15')
  })

  it('échéance un dimanche : prorogée au jour ouvrable suivant', () => {
    expect(dateEcheanceDsn({ annee: 2026, mois: 10 }, { effectif: 1, paieDuMoisMeme: true })).toBe('2026-11-16')
  })

  it('une échéance par mois non déclaré, jusqu’au mois en cours', () => {
    expect(dates(de(echeances(), 'dsn'))).toEqual(['2026-11-16'])
    const retard = de(echeances({ derniereDsn: { annee: 2026, mois: 7 } }), 'dsn')
    expect(retard.map((e) => e.cle)).toEqual(['dsn:2026-08', 'dsn:2026-09', 'dsn:2026-10'])
    expect(dates(retard)).toEqual(['2026-09-15', '2026-10-15', '2026-11-16'])
    expect(retard[0]).toMatchObject({ libelle: 'DSN de 08/2026 et versement des cotisations', nature: 'legale', aConfirmer: false, salarieId: null })
  })

  it('aucun salarié : aucune échéance du tout', () => {
    expect(echeances({ salaries: [], suivisMedicaux: [], derniereDsn: null })).toEqual([])
  })

  it('due même sans salarié en poste, jusqu’au mois de la radiation du compte', () => {
    const sorti = creerSalarieSyndicat({ ...gardien, sortieLe: '2026-08-01' })
    const base = { salaries: [sorti], suivisMedicaux: [], derniereDsn: { annee: 2026, mois: 7 } }
    expect(de(echeances(base), 'dsn').map((e) => e.cle)).toEqual(['dsn:2026-08', 'dsn:2026-09', 'dsn:2026-10'])
    expect(de(echeances({ ...base, radiationLe: '2026-08-20' }), 'dsn').map((e) => e.cle)).toEqual(['dsn:2026-08'])
  })

  it('sans dernière DSN connue : depuis le mois d’entrée, 24 périodes détaillées et les plus anciennes signalées (à vérifier)', () => {
    const dsn = de(echeances({ derniereDsn: null }), 'dsn')
    expect(dsn).toHaveLength(25)
    expect(dsn[0]).toMatchObject({
      cle: 'dsn:anterieures',
      libelle: 'DSN de 03/2024 à 10/2024 à vérifier (8 périodes non détaillées, dernière DSN inconnue)',
      date: '2024-04-15',
      aConfirmer: true,
    })
    expect(dsn[1].cle).toBe('dsn:2024-11')
    expect(dsn.at(-1)?.cle).toBe('dsn:2026-10')
    const recent = creerSalarieSyndicat({ ...gardien, entreeLe: '2026-09-15' })
    expect(de(echeances({ salaries: [recent], derniereDsn: null }), 'dsn').map((e) => e.cle)).toEqual(['dsn:2026-09', 'dsn:2026-10'])
  })

  it('plus de 24 DSN en retard alors que la dernière est connue : les plus anciennes sont signalées, pas écartées en silence', () => {
    const dsn = de(echeances({ derniereDsn: { annee: 2023, mois: 1 } }), 'dsn')
    expect(dsn).toHaveLength(25)
    expect(dsn[0]).toMatchObject({
      cle: 'dsn:anterieures',
      libelle: 'DSN de 02/2023 à 10/2024 non déclarées (21 périodes non détaillées)',
      date: '2023-03-15',
      nature: 'legale',
      aConfirmer: false,
    })
    expect(dsn[1].cle).toBe('dsn:2024-11')
  })

  it('J28 : DSN (R133-14, I) et versement des cotisations (décision J28) reportés au même jour ouvrable : une seule échéance', () => {
    const toutes = echeances() // DSN de 10/2026 : le 15/11/2026 est un dimanche
    expect(de(toutes, 'dsn').map((e) => [e.cle, e.date, e.libelle, e.fondement])).toEqual([
      [
        'dsn:2026-10',
        '2026-11-16',
        'DSN de 10/2026 et versement des cotisations',
        'CSS art. L133-5-3, R133-14, I et R243-6, II ; versement reporté au jour ouvrable suivant (décision J28)',
      ],
    ])
    expect(de(toutes, 'versement_cotisations')).toEqual([])
    const ouvrable = echeances({ derniereDsn: { annee: 2026, mois: 7 }, radiationLe: '2026-08-20' }) // 15/09/2026 : un mardi
    expect(de(ouvrable, 'dsn').map((e) => [e.libelle, e.fondement])).toEqual([
      ['DSN de 08/2026 et versement des cotisations', 'CSS art. L133-5-3, R133-14, I et R243-6, II'],
    ])
    expect(de(ouvrable, 'versement_cotisations')).toEqual([])
  })

  it('J28 : versement des cotisations reporté au jour ouvrable suivant, aux bornes (samedi, dimanche, férié, pont, veille de pont)', () => {
    const mensuel = { effectif: 1, paieDuMoisMeme: true, versementTrimestrielCotisations: false }
    const leCinq = { effectif: 50, paieDuMoisMeme: true, versementTrimestrielCotisations: false }
    const date = (annee: number, mois: number, etat = mensuel, options = {}) => versementCotisations({ annee, mois }, etat, options)?.date
    expect(date(2027, 12, mensuel)).toBe('2028-01-17') // 15/01/2028 : samedi → lundi 17
    expect(date(2026, 10)).toBe('2026-11-16') // 15/11/2026 : dimanche → lundi 16
    expect(date(2028, 7)).toBe('2028-08-16') // 15/08/2028 : mardi férié (Assomption) → mercredi 16
    expect(date(2031, 7)).toBe('2031-08-18') // 15/08/2031 : vendredi férié, puis le week-end → lundi 18
    expect(date(2028, 5, leCinq)).toBe('2028-06-06') // 05/06/2028 : lundi de Pentecôte → mardi 6
    expect(date(2026, 4)).toBe('2026-05-15') // 15/05/2026 : vendredi de pont (lendemain de l'Ascension), jour ouvrable : aucun report
    expect(date(2027, 4, leCinq)).toBe('2027-05-05') // 05/05/2027 : mercredi, veille de l'Ascension : aucun report
    expect(date(2026, 8)).toBe('2026-09-15') // 15/09/2026 : mardi ordinaire
    // Alsace-Moselle (réglage) : le Vendredi saint 15/04/2033, puis le lundi de Pâques → mardi 19.
    expect(date(2033, 3)).toBe('2033-04-15')
    expect(date(2033, 3, mensuel, { alsaceMoselle: true })).toBe('2033-04-19')
    expect(de(echeances({ derniereDsn: { annee: 2033, mois: 2 } }, { alsaceMoselle: true }, '2033-03-20'), 'dsn')).toMatchObject([
      { cle: 'dsn:2033-03', date: '2033-04-19', libelle: 'DSN de 03/2033 et versement des cotisations' },
    ])
  })

  it('J28 : versement reporté, avec la justification du report ; sans report, le seul texte', () => {
    const mensuel = { effectif: 1, paieDuMoisMeme: true, versementTrimestrielCotisations: false }
    expect(versementCotisations({ annee: 2026, mois: 10 }, mensuel)).toMatchObject({
      date: '2026-11-16',
      libelle: 'Versement des cotisations de 10/2026',
      fondement: 'CSS art. R243-6, II ; versement reporté au jour ouvrable suivant (décision J28)',
    })
    expect(versementCotisations({ annee: 2026, mois: 8 }, mensuel)).toMatchObject({ date: '2026-09-15', fondement: 'CSS art. R243-6, II' })
  })

  it('versement trimestriel : le 15 du mois qui suit le trimestre, reporté comme la DSN (J28)', () => {
    const trimestriel = { effectif: 1, paieDuMoisMeme: true, versementTrimestrielCotisations: true }
    expect(dateEcheanceDsn({ annee: 2027, mois: 12 }, trimestriel)).toBe('2028-01-17') // 15/01/2028 : un samedi
    expect(versementCotisations({ annee: 2027, mois: 12 }, trimestriel)).toMatchObject({
      date: '2028-01-17',
      libelle: 'Versement des cotisations du trimestre achevé en 12/2027',
      fondement: 'CSS art. R243-6-1 ; versement reporté au jour ouvrable suivant (décision J28)',
    })
    expect(versementCotisations({ annee: 2027, mois: 11 }, trimestriel)).toBeNull()
  })

  it('versement trimestriel des cotisations (moins de 11 salariés) : la DSN reste mensuelle', () => {
    const dsn = de(echeances({ versementTrimestrielCotisations: true, derniereDsn: { annee: 2026, mois: 8 } }), 'dsn')
    expect(dsn.map((e) => e.libelle)).toEqual(['DSN de 09/2026 et versement des cotisations du trimestre', 'DSN de 10/2026'])
    expect(dsn[0].fondement).toMatch(/R243-6-1/)
    expect(() => echeances({ versementTrimestrielCotisations: true, effectif: 11 })).toThrow(/moins de 11 salariés/)
  })
})

describe('santé au travail', () => {
  it('adhésion à un service interentreprises : un mois après l’engagement du premier salarié', () => {
    expect(de(echeances({ adhesionSanteTravailLe: null }), 'adhesion_sante_travail')).toMatchObject([
      { date: '2024-04-01', fondement: 'C. trav. art. R7214-5 et R7214-6', aConfirmer: false },
    ])
    expect(de(echeances(), 'adhesion_sante_travail')).toEqual([])
    const sorti = creerSalarieSyndicat({ ...gardien, sortieLe: '2026-08-01' })
    expect(de(echeances({ adhesionSanteTravailLe: null, salaries: [sorti], suivisMedicaux: [] }), 'adhesion_sante_travail')).toEqual([])
  })

  it('visite d’information et de prévention : au plus tard trois mois après l’entrée, plafond du seul suivi simple : à confirmer (🔴 9)', () => {
    // Travailleur de nuit ou de moins de dix-huit ans : visite « préalablement à son affectation sur le poste » (R4624-18) ;
    // suivi individuel renforcé : examen médical d'aptitude, lui aussi préalable (R4624-24). Ni la catégorie de suivi ni
    // l'âge ne sont modélisés : la date à trois mois de l'entrée (R4624-10) n'est donc pas certaine.
    const [visite] = de(echeances({ suivisMedicaux: [] }), 'medecine_travail')
    expect(visite).toMatchObject({ date: '2024-06-01', salarieId: 'sal-1', fondement: 'C. trav. art. R4624-10', aConfirmer: true })
    expect(visite.libelle).toBe(
      "Visite d'information et de prévention (suivi simple : au plus tard 3 mois après l'entrée ; travailleur de nuit, de moins de 18 ans ou en suivi renforcé : avant l'affectation, saisir la visite fixée)",
    )
    // Cas du constat : gardien entré le 01/10/2026, aucun suivi saisi, réglages par défaut.
    const recrue = creerSalarieSyndicat({ ...gardien, entreeLe: '2026-10-01' })
    expect(de(echeancesEmployeur(etat({ salaries: [recrue], suivisMedicaux: [] }), AUJ), 'medecine_travail')).toMatchObject([
      { date: '2027-01-01', aConfirmer: true, fondement: 'C. trav. art. R4624-10' },
    ])
    // Visite fixée par le service de santé au travail, même avant l'affectation : elle prime, certaine.
    const fixee = [{ salarieId: 'sal-1', derniereVisiteLe: null, prochaineLe: '2024-02-26' }]
    expect(de(echeances({ suivisMedicaux: fixee }), 'medecine_travail')).toMatchObject([{ date: '2024-02-26', aConfirmer: false }])
  })

  it('date fixée par le service de santé au travail : elle prime', () => {
    const suivisMedicaux = [{ salarieId: 'sal-1', derniereVisiteLe: '2025-05-01', prochaineLe: '2026-12-01' }]
    expect(de(echeances({ suivisMedicaux }), 'medecine_travail')).toMatchObject([{ date: '2026-12-01', aConfirmer: false }])
  })

  it('prochaine visite dépassée par une visite passée depuis (ou le jour même) : ignorée, visite périodique calculée', () => {
    const perimee = [{ salarieId: 'sal-1', derniereVisiteLe: '2026-06-01', prochaineLe: '2026-05-15' }]
    expect(de(echeances({ suivisMedicaux: perimee }), 'medecine_travail')).toMatchObject([{ date: '2031-06-01', fondement: 'C. trav. art. R4624-16' }])
    const faiteAuJourPrevu = [{ salarieId: 'sal-1', derniereVisiteLe: '2026-05-15', prochaineLe: '2026-05-15' }]
    expect(de(echeances({ suivisMedicaux: faiteAuJourPrevu }), 'medecine_travail')).toMatchObject([{ date: '2031-05-15' }])
  })

  it('J26 : visite périodique selon le Code du travail par défaut (au plus 5 ans, R4624-16) ; la CCN (2 ans) en option', () => {
    expect(REGLAGES_SUIVI_EMPLOYEUR_PAR_DEFAUT.referenceMedicale).toBe('code_du_travail')
    expect(datesVisitePeriodique('2025-05-01')).toEqual({ ccn1043: '2027-05-01', codeDuTravailAuPlusTard: '2030-05-01' })
    expect(de(echeancesEmployeur(etat(), AUJ), 'medecine_travail')).toMatchObject([
      {
        date: '2030-05-01',
        libelle: 'Renouvellement de la visite (suivi simple : au plus tard 5 ans ; suivi adapté ou renforcé : saisir la prochaine visite)',
        fondement: 'C. trav. art. R4624-16',
      },
    ])
    expect(de(echeances({}, { referenceMedicale: 'ccn_1043' }), 'medecine_travail')).toMatchObject([
      { date: '2027-05-01', aConfirmer: true, fondement: 'CCN IDCC 1043, art. 13' },
    ])
  })

  it('J26 : sans prochaine visite saisie, les 5 ans ne sont que le plafond du suivi simple (R4624-16) : à confirmer (🔴 9)', () => {
    // Gardien en suivi adapté (travailleur handicapé, pension d'invalidité, travail de nuit) : R4624-17, trois ans au plus,
    // soit le 01/05/2028 ; la catégorie de suivi n'est pas modélisée, la date du 01/05/2030 n'est donc pas certaine.
    const [visite] = de(echeancesEmployeur(etat(), AUJ), 'medecine_travail')
    expect(visite).toMatchObject({ date: '2030-05-01', aConfirmer: true, fondement: 'C. trav. art. R4624-16' })
    expect(visite.libelle).toMatch(/suivi simple/)
    expect(visite.libelle).toMatch(/saisir la prochaine visite/)
    // La prochaine visite saisie (fixée par le service de santé au travail) prime, et elle est certaine.
    const fixee = [{ salarieId: 'sal-1', derniereVisiteLe: '2025-05-01', prochaineLe: '2028-05-01' }]
    expect(de(echeances({ suivisMedicaux: fixee }), 'medecine_travail')).toMatchObject([{ date: '2028-05-01', aConfirmer: false }])
  })

  it('salarié sorti : plus de visite à suivre', () => {
    const sorti = creerSalarieSyndicat({ ...gardien, sortieLe: '2026-08-01' })
    expect(de(echeances({ salaries: [sorti] }), 'medecine_travail')).toEqual([])
  })

  it('visite de reprise : selon le motif et la durée, CCN (30 jours) ou Code (60 jours) pour une maladie non professionnelle', () => {
    const arret = { du: '2026-07-01', repriseLe: '2026-08-15' } // 45 jours
    expect(visiteRepriseRequise({ ...arret, motif: 'non_professionnel' }, 'ccn_1043')).toBe(true)
    expect(visiteRepriseRequise({ ...arret, motif: 'non_professionnel' }, 'code_du_travail')).toBe(false)
    expect(visiteRepriseRequise({ du: '2026-07-01', repriseLe: '2026-07-30', motif: 'accident_travail' }, 'code_du_travail')).toBe(false)
    expect(visiteRepriseRequise({ du: '2026-07-01', repriseLe: '2026-07-31', motif: 'accident_travail' }, 'code_du_travail')).toBe(true)
    expect(visiteRepriseRequise({ du: '2026-07-01', repriseLe: '2026-07-03', motif: 'maladie_professionnelle' }, 'code_du_travail')).toBe(true)
    expect(visiteRepriseRequise({ du: '2026-07-01', repriseLe: '2026-07-03', motif: 'maternite' }, 'code_du_travail')).toBe(true)
    expect(visiteRepriseRequise({ du: '2026-07-01', repriseLe: null, motif: 'maternite' }, 'ccn_1043')).toBe(false)
  })

  it('visite de reprise : au plus tard huit jours après la reprise ; faite ou antérieure à la version de 2026 du R4624-31', () => {
    const arret = { id: 'arr-1', salarieId: 'sal-1', motif: 'accident_travail' as const, du: '2026-07-01', repriseLe: '2026-08-15', visiteRepriseLe: null }
    expect(de(echeances({ arrets: [arret] }), 'visite_reprise')).toMatchObject([
      { cle: 'visite_reprise:arr-1', date: '2026-08-23', salarieId: 'sal-1', aConfirmer: false },
    ])
    expect(de(echeances({ arrets: [{ ...arret, visiteRepriseLe: '2026-08-17' }] }), 'visite_reprise')).toEqual([])
    // J67, R36 : arrêt commencé du 01/04/2022 au 14/06/2026 : mêmes cas et même délai, sans « à confirmer ».
    expect(de(echeances({ arrets: [{ ...arret, du: '2026-05-01' }] }), 'visite_reprise')).toMatchObject([{ aConfirmer: false }])
    // Maladie non professionnelle de 45 jours : aucune reprise exigée par le Code (60 jours) ; la seule CCN, en option.
    expect(de(echeances({ arrets: [{ ...arret, motif: 'non_professionnel' }] }), 'visite_reprise')).toEqual([])
    expect(de(echeances({ arrets: [{ ...arret, motif: 'non_professionnel' }] }, { referenceMedicale: 'ccn_1043' }), 'visite_reprise')).toMatchObject([
      { aConfirmer: true, fondement: 'CCN IDCC 1043, art. 13' },
    ])
  })

  it('J26 : visite de reprise après 60 jours d’arrêt non professionnel par défaut (R4624-31, 4°), borne incluse', () => {
    const arret = { id: 'arr-1', salarieId: 'sal-1', motif: 'non_professionnel' as const, du: '2026-07-01', visiteRepriseLe: null }
    expect(visiteRepriseRequise({ ...arret, repriseLe: '2026-08-29' }, 'code_du_travail')).toBe(false) // 59 jours
    expect(visiteRepriseRequise({ ...arret, repriseLe: '2026-08-30' }, 'code_du_travail')).toBe(true) // 60 jours
    expect(de(echeances({ arrets: [{ ...arret, repriseLe: '2026-08-29' }] }), 'visite_reprise')).toEqual([])
    expect(de(echeances({ arrets: [{ ...arret, repriseLe: '2026-08-30' }] }), 'visite_reprise')).toMatchObject([
      { cle: 'visite_reprise:arr-1', date: '2026-09-07', aConfirmer: false, fondement: 'C. trav. art. R4624-31' },
    ])
  })

  it('salarié sorti : plus de visite de reprise à suivre, comme pour les autres visites', () => {
    const sorti = creerSalarieSyndicat({ ...gardien, sortieLe: '2026-09-01' })
    const arret = { id: 'arr-1', salarieId: 'sal-1', motif: 'accident_travail' as const, du: '2026-07-01', repriseLe: '2026-08-15', visiteRepriseLe: null }
    expect(de(echeances({ salaries: [sorti], arrets: [arret] }), 'visite_reprise')).toEqual([])
    expect(de(echeances({ salaries: [sorti], arrets: [{ ...arret, repriseLe: '2026-09-15' }] }), 'visite_reprise')).toEqual([])
  })
})

describe('DUERP (C. trav. R4121-1 à R4121-4, L4121-3-1)', () => {
  it('absent : à établir dès la première entrée', () => {
    expect(de(echeances({ duerp: { misAJourLe: null, transmisLe: null } }), 'duerp')).toMatchObject([
      { cle: 'duerp:etablir', date: '2024-03-01', nature: 'legale', aConfirmer: true },
    ])
  })

  it('au moins 11 salariés : mise à jour annuelle, échéance légale', () => {
    expect(de(echeances({ effectif: 11 }), 'duerp')).toMatchObject([
      { cle: 'duerp:mise_a_jour', date: '2027-02-01', nature: 'legale', aConfirmer: false, fondement: 'C. trav. art. R4121-2, 1°' },
    ])
  })

  it('J27 : moins de 11 salariés, rappel de gestion de 12 mois (décision), réglable et désactivable', () => {
    expect(REGLAGES_SUIVI_EMPLOYEUR_PAR_DEFAUT.rappelDuerpMois).toBe(12)
    expect(de(echeances(), 'duerp')).toMatchObject([{ cle: 'duerp:revue', date: '2027-02-01', nature: 'gestion', aConfirmer: false }])
    expect(versElementsAFaire(de(echeances(), 'duerp'), 'mandat-1')).toMatchObject([{ aConfirmer: true }])
    expect(de(echeances({}, { rappelDuerpMois: 24 }), 'duerp')).toMatchObject([{ date: '2028-02-01' }])
    expect(de(echeances({}, { rappelDuerpMois: null }), 'duerp')).toEqual([])
  })

  it('mise à jour non transmise au service de prévention et de santé au travail', () => {
    expect(de(echeances({ duerp: { misAJourLe: '2026-02-01', transmisLe: '2025-01-15', deposeLe: '2026-02-01' } }), 'duerp')).toMatchObject([
      { cle: 'duerp:transmission', date: '2026-02-01', aConfirmer: true, fondement: 'C. trav. art. L4121-3-1, VI' },
      { cle: 'duerp:revue', date: '2027-02-01' },
    ])
  })
})

describe('paiement du salaire (CCN IDCC 1043, art. 22, 3)', () => {
  const bulletin: BulletinPaie = {
    id: 'bul-2026-09',
    salarieId: 'sal-1',
    annee: 2026,
    mois: 9,
    brutCentimes: 200_000,
    cotisations: [],
    prelevementSourceCentimes: 0,
    netAPayerCentimes: 200_000,
  }
  /** Règlement écrit par le traitement « tr-reg-<repère> ». */
  const reglement = (montantCentimes: number, repere = String(montantCentimes)): ReglementPaieEcrit => ({
    id: `reg-${repere}`,
    traitementId: `tr-reg-${repere}`,
    coproprieteId: 'copro-1',
    mandatId: 'mandat-1',
    nature: 'salaire_net',
    salarieId: 'sal-1',
    bulletinId: 'bul-2026-09',
    montantCentimes,
    mode: 'Virement',
    compteBanque: 'M001.51200.00000.0',
    le: '2026-09-30',
    reference: 'VIR',
  })
  /** Grand livre réduit aux traitements des règlements donnés. */
  const ecrits = (reglements: ReglementPaieEcrit[]) => ({ reglements, traitements: reglements.map((r) => ({ id: r.traitementId })) })

  it('net non couvert par ses règlements : à payer au plus tard le dernier jour du mois', () => {
    expect(de(echeances({ bulletins: [bulletin], ...ecrits([reglement(100_000)]) }), 'salaire')).toMatchObject([
      { cle: 'salaire:bul-2026-09', date: '2026-09-30', salarieId: 'sal-1', libelle: 'Paiement du salaire de 09/2026' },
    ])
    expect(de(echeances({ bulletins: [bulletin], ...ecrits([reglement(100_000, 'a'), reglement(100_000, 'b')]) }), 'salaire')).toEqual([])
  })

  it('règlement annulé (virement rejeté, « Annulation de règlements ») : le salaire redevient à payer', () => {
    const CTX = { segmentSyndicat: 'M001', plan: PLAN_PAIE_PAR_DEFAUT }
    const constatee = traitementConstatationPaie({ id: 'tr-paie-09', date: '2026-09-30' }, bulletin, gardien, CTX)
    const constatation = constatee.traitement
    const ecrit = traitementReglementPaie('tr-reg-1', { ...reglement(200_000), id: 'reg-1' }, {
      salarie: gardien,
      bulletin: constatee.bulletin,
      contexte: CTX,
      traitements: [constatation],
      reglements: [],
    })
    const annulation = annulerTraitement(ecrit.traitement, { id: 'tr-annul', date: '2026-10-02' })
    const base = { bulletins: [bulletin], reglements: [ecrit.reglement] }
    expect(de(echeances({ ...base, traitements: [constatation, ecrit.traitement] }), 'salaire')).toEqual([])
    expect(de(echeances({ ...base, traitements: [constatation, ecrit.traitement, annulation] }), 'salaire')).toMatchObject([
      { cle: 'salaire:bul-2026-09', date: '2026-09-30', salarieId: 'sal-1' },
    ])
  })

  it('virement du 05/10 : refusé sur le bulletin de 10 pas encore constaté ; imputé à celui de 09, il le solde (constat du tour 3)', () => {
    const CTX = { segmentSyndicat: 'M001', plan: PLAN_PAIE_PAR_DEFAUT }
    const octobre: BulletinPaie = { ...bulletin, id: 'bul-2026-10', mois: 10 }
    const septembre = traitementConstatationPaie({ id: 'tr-paie-09', date: '2026-09-30' }, bulletin, gardien, CTX)
    const constatationOctobre = traitementConstatationPaie({ id: 'tr-paie-10', date: '2026-10-31' }, octobre, gardien, CTX)
    const virement = { ...reglement(200_000, '0510'), le: '2026-10-05' }
    const contexte = { salarie: gardien, contexte: CTX, traitements: [septembre.traitement, constatationOctobre.traitement], reglements: [] }
    expect(() =>
      traitementReglementPaie('tr-reg-0510', { ...virement, bulletinId: 'bul-2026-10' }, { ...contexte, bulletin: { ...octobre, traitementId: 'tr-paie-10' } }),
    ).toThrow(/constaté le 31\/10\/2026, après le règlement du 05\/10\/2026/)
    expect(constatationOctobre.bulletin).toEqual({ ...octobre, traitementId: 'tr-paie-10' })
    const ecrit = traitementReglementPaie('tr-reg-0510', virement, { ...contexte, bulletin: { ...bulletin, traitementId: 'tr-paie-09' } })
    const suivi = echeances(
      { bulletins: [bulletin, octobre], reglements: [ecrit.reglement], traitements: [...contexte.traitements, ecrit.traitement] },
      {},
      '2026-10-20',
    )
    expect(de(suivi, 'salaire').map((e) => [e.cle, e.date])).toEqual([['salaire:bul-2026-10', '2026-10-31']])
  })

  it('règlement dont le traitement manque au grand livre fourni : erreur, jamais compté en silence', () => {
    expect(() => echeances({ bulletins: [bulletin], reglements: [reglement(200_000)] })).toThrow(/traitement tr-reg-200000 absent du grand livre/)
  })

  it('bulletin réglé introuvable : erreur (le règlement ne solderait aucun salaire)', () => {
    expect(() => echeances({ bulletins: [bulletin], ...ecrits([{ ...reglement(200_000), bulletinId: 'bul-inexistant' }]) })).toThrow(
      /bulletin bul-inexistant introuvable/,
    )
  })

  it('règlements imputés au-delà du net d’un bulletin : erreur (le suivi ne diverge plus de la comptabilité)', () => {
    const octobre: BulletinPaie = { ...bulletin, id: 'bul-2026-10', mois: 10 }
    const deuxMois = { ...reglement(400_000), le: '2026-10-31' }
    expect(() => echeances({ bulletins: [bulletin, octobre], ...ecrits([deuxMois]) }, {}, '2026-11-05')).toThrow(
      /Bulletin bul-2026-09 : 400000 centimes réglés pour un net à payer de 200000 centimes/,
    )
  })

  it('bulletin contrôlé à l’entrée : période, montants, période d’emploi (plus de date « 2026-13-undefined »)', () => {
    expect(() => echeances({ bulletins: [{ ...bulletin, mois: 13 }] })).toThrow(/Période 13\/2026/)
    expect(() => echeances({ bulletins: [{ ...bulletin, mois: 0 }] })).toThrow(/Période 0\/2026/)
    expect(() => echeances({ bulletins: [{ ...bulletin, annee: 99_999 }] })).toThrow(/Période/)
    expect(() => echeances({ bulletins: [{ ...bulletin, netAPayerCentimes: 1.5 }] })).toThrow(/centimes/)
    expect(() => echeances({ bulletins: [{ ...bulletin, annee: 2020, mois: 1 }] })).toThrow(/entrée/)
  })

  it('décision du 20/11/2026 (partie C, F43) : bulletin d’un mois postérieur à la sortie, alerte non bloquante, accepté par le suivi', () => {
    const sorti = creerSalarieSyndicat({ ...gardien, sortieLe: '2026-06-30' })
    expect(de(echeances({ salaries: [sorti], suivisMedicaux: [], bulletins: [bulletin] }), 'salaire')).toMatchObject([
      { cle: 'salaire:bul-2026-09', salarieId: 'sal-1' },
    ])
  })

  it('règlements contrôlés à l’entrée : syndicat, salarié, montant, bulletin du même salarié', () => {
    const employe = creerSalarieSyndicat({ ...gardien, id: 'sal-2', qualite: "Employé d'immeuble", auxiliaire421: '00002' })
    const base = { salaries: [gardien, employe], bulletins: [bulletin], traitements: [{ id: 'tr-reg-200000' }, { id: 'tr-reg--5' }] }
    expect(() => echeances({ ...base, reglements: [{ ...reglement(200_000), salarieId: 'sal-2' }] })).toThrow(/bul-2026-09 du salarié sal-1/)
    expect(() => echeances({ ...base, reglements: [{ ...reglement(200_000), coproprieteId: 'copro-9' }] })).toThrow(/syndicat/)
    expect(() => echeances({ ...base, reglements: [{ ...reglement(200_000), salarieId: 'sal-99' }] })).toThrow(/sal-99/)
    expect(() => echeances({ ...base, reglements: [reglement(-5)] })).toThrow(/centimes/)
    expect(() => echeances({ ...base, reglements: [{ ...reglement(200_000), bulletinId: null }] })).toThrow(/bulletin/)
    expect(() => echeances({ ...base, reglements: [{ ...reglement(200_000), le: 'pas-une-date' }] })).toThrow(/AAAA-MM-JJ/)
  })
})

describe('taxe sur les salaires (CGI art. 231, 1679 ; annexe III, art. 369)', () => {
  it('franchise de 1 200 €, décote jusqu’à 2 040 €', () => {
    expect(taxeSalairesExigible(120_000)).toEqual({ exigibleCentimes: 0, decoteCentimes: 0, declarationAnnuelleRequise: false })
    expect(taxeSalairesExigible(150_000)).toEqual({ exigibleCentimes: 109_500, decoteCentimes: 40_500, declarationAnnuelleRequise: true })
    expect(taxeSalairesExigible(204_000)).toEqual({ exigibleCentimes: 204_000, decoteCentimes: 0, declarationAnnuelleRequise: true })
    expect(() => taxeSalairesExigible(-1)).toThrow(/centimes/)
  })

  it('périodicité selon la taxe acquittée l’année précédente', () => {
    expect(periodiciteTaxeSalaires(399_999)).toBe('annuelle')
    expect(periodiciteTaxeSalaires(400_000)).toBe('trimestrielle')
    expect(periodiciteTaxeSalaires(1_000_000)).toBe('trimestrielle')
    expect(periodiciteTaxeSalaires(1_000_001)).toBe('mensuelle')
  })

  it('non suivie tant que le cabinet ne l’a pas décidé (🔴 exonération)', () => {
    expect(de(echeances(), 'taxe_salaires')).toEqual([])
  })

  it('annuelle : versement et déclaration le 15 janvier, toujours à confirmer', () => {
    expect(de(echeances({ taxeSalaires: { acquitteeAnneePrecedenteCentimes: 300_000 } }), 'taxe_salaires')).toMatchObject([
      { date: '2027-01-15', libelle: 'Taxe sur les salaires de 2026 : versement et déclaration annuelle', aConfirmer: true },
    ])
  })

  it('trimestrielle ou mensuelle : prochain versement, et déclaration annuelle', () => {
    const trimestre = de(echeances({ taxeSalaires: { acquitteeAnneePrecedenteCentimes: 500_000 } }), 'taxe_salaires')
    expect(trimestre.map((e) => [e.date, e.libelle])).toEqual([
      ['2027-01-15', 'Taxe sur les salaires de 2026 : déclaration annuelle'],
      ['2027-01-15', 'Taxe sur les salaires du trimestre commencé en 10/2026 : versement'],
    ])
    const mois = de(echeances({ taxeSalaires: { acquitteeAnneePrecedenteCentimes: 1_500_000 } }), 'taxe_salaires')
    expect(dates(mois)).toEqual(['2026-11-15', '2027-01-15'])
    const debutDeMois = de(echeances({ taxeSalaires: { acquitteeAnneePrecedenteCentimes: 1_500_000 } }, {}, '2026-10-10'), 'taxe_salaires')
    expect(debutDeMois.map((e) => [e.date, e.libelle])).toEqual([
      ['2026-10-15', 'Taxe sur les salaires de 09/2026 : versement'],
      ['2027-01-15', 'Taxe sur les salaires de 2026 : déclaration annuelle'],
    ])
  })

  it('du 1er au 15 janvier, le versement de l’année écoulée suit la taxe acquittée deux ans plus tôt (ann. III art. 369, 1)', () => {
    const auJanvier = (taxeSalaires: EtatEmployeur['taxeSalaires']) =>
      de(echeances({ taxeSalaires }, {}, '2027-01-10'), 'taxe_salaires').map((e) => [e.date, e.libelle])
    // 2026 : 5 000 € (trimestrielle en 2027) ; 2025 : 3 000 € → 2026 était annuelle
    expect(auJanvier({ acquitteeAnneePrecedenteCentimes: 500_000, acquitteeDeuxAnsAvantCentimes: 300_000 })).toEqual([
      ['2027-01-15', 'Taxe sur les salaires de 2026 : versement et déclaration annuelle'],
    ])
    // 2025 : 15 000 € → 2026 était mensuelle
    expect(auJanvier({ acquitteeAnneePrecedenteCentimes: 500_000, acquitteeDeuxAnsAvantCentimes: 1_500_000 })).toEqual([
      ['2027-01-15', 'Taxe sur les salaires de 2026 : déclaration annuelle'],
      ['2027-01-15', 'Taxe sur les salaires de 12/2026 : versement'],
    ])
    // taxe de 2025 non fournie : la période versée n'est pas préjugée
    const inconnue = de(echeances({ taxeSalaires: { acquitteeAnneePrecedenteCentimes: 500_000 } }, {}, '2027-01-10'), 'taxe_salaires')
    expect(inconnue.map((e) => e.libelle)).toEqual([
      'Taxe sur les salaires de 2026 : déclaration annuelle',
      'Taxe sur les salaires de 2026 : versement du solde (périodicité selon la taxe acquittée en 2025, non fournie)',
    ])
    // après le 15 janvier, la taxe de 2026 fixe la périodicité de 2027
    expect(
      de(echeances({ taxeSalaires: { acquitteeAnneePrecedenteCentimes: 500_000 } }, {}, '2027-01-20'), 'taxe_salaires').map((e) => [e.date, e.libelle]),
    ).toEqual([
      ['2027-04-15', 'Taxe sur les salaires du trimestre commencé en 01/2027 : versement'],
      ['2028-01-15', 'Taxe sur les salaires de 2027 : déclaration annuelle'],
    ])
  })
})

describe('J67, R33 — exonération de taxe sur les salaires : trois paliers, toujours à confirmer, jamais calculée', () => {
  const avis = (produits: number) => avisExonerationTaxeSalaires(produits, AUJ)

  it('au plus 37 500 € : exonération possible ; jusqu’à 85 000 € : plafond non établi ; au-delà : taxe due (franchise, décote)', () => {
    expect(avis(3_750_000)).toMatchObject({ palier: 'exoneration_possible', aConfirmer: true })
    expect(avis(3_750_000).message).toMatch(
      /^Produits \(classe 7\) de l'année civile 2025 : 37\s500,00\s€ : exonération possible \(art\. 231, 1, al\. 2\), à confirmer\.$/,
    )
    expect(avis(3_750_001)).toMatchObject({ palier: 'plafond_non_etabli', aConfirmer: true })
    expect(avis(8_500_000).message).toMatch(/: à confirmer : plafond applicable au syndicat non établi \(37\s500,00\s€ ou 85\s000,00\s€/)
    expect(avis(8_500_001)).toMatchObject({ palier: 'taxe_due', aConfirmer: true })
    expect(avis(8_500_001).message).toMatch(/la taxe est due, sous la franchise de 1\s200,00\s€ et la décote jusqu'à 2\s040,00\s€ \(art\. 1679\), à confirmer/)
    expect(avis(8_500_001).fondement).toMatch(/ ; CGI art\. 1679$/)
  })

  it('fondement : art. 293 B jusqu’au 31/12/2026 ; CIBS art. L. 233-9 et L. 233-10 dès le 01/01/2027 ; montants inchangés', () => {
    expect(avisExonerationTaxeSalaires(3_000_000, '2026-12-31').fondement).toBe('CGI art. 231, 1, al. 2 ; art. 293 B, I et I bis')
    const en2027 = avisExonerationTaxeSalaires(3_000_000, '2027-01-01')
    expect(en2027).toMatchObject({ palier: 'exoneration_possible', fondement: 'CGI art. 231, 1, al. 2 ; CIBS art. L. 233-9 et L. 233-10' })
    expect(en2027.message).toMatch(/année civile 2026/)
    expect(() => avis(-1)).toThrow(/centimes/)
    expect(() => avis(1.5)).toThrow(/centimes/)
    expect(() => avisExonerationTaxeSalaires(1, '31/12/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('alertes de l’employeur : l’avis n’apparaît que si la taxe est suivie et les produits saisis ; saisie contrôlée', () => {
    const taxe = { acquitteeAnneePrecedenteCentimes: 300_000 }
    expect(alertesEmployeur(etat(), AUJ)).toEqual([])
    expect(alertesEmployeur(etat({ taxeSalaires: taxe }), AUJ)).toEqual([])
    expect(alertesEmployeur(etat({ taxeSalaires: { ...taxe, produitsAnneeCivilePrecedenteCentimes: 9_000_000 } }), AUJ)).toMatchObject([
      { code: 'taxe_salaires_exoneration', aConfirmer: true, fondement: 'CGI art. 231, 1, al. 2 ; art. 293 B, I et I bis ; CGI art. 1679' },
    ])
    expect(() => echeances({ taxeSalaires: { ...taxe, produitsAnneeCivilePrecedenteCentimes: -5 } })).toThrow(/centimes/)
  })
})

describe('J67, R34 — effectif annuel moyen retenu en DSN (CSS L130-1, R130-1) : saisi, jamais calculé', () => {
  const codesAlertes = (effectif: number) => alertesEmployeur(etat({ effectif }), AUJ).map((a) => a.code)

  it('alerte non bloquante de 9 à 12 salariés et de 45 à 55 ; aucune ailleurs', () => {
    for (const effectif of [0, 1, 8, 13, 44, 56]) expect(codesAlertes(effectif)).toEqual([])
    for (const effectif of [9, 10, 12, 45, 50, 55]) expect(codesAlertes(effectif)).toEqual(['effectif_proche_seuil'])
  })

  it('message : vérifier le décompte, la règle des cinq ans, et pour le DUERP le décompte du Code du travail', () => {
    const [onze] = alertesEmployeur(etat({ effectif: 10 }), AUJ)
    expect(onze).toMatchObject({ code: 'effectif_proche_seuil', aConfirmer: false })
    expect(onze.message).toBe(
      'Effectif de 10 : seuil de 11 salariés proche : vérifier le décompte, la règle des cinq ans, et pour le DUERP le décompte du Code du travail (J67, R34).',
    )
    expect(onze.fondement).toBe('CSS art. L130-1 et R130-1 ; R243-6-1 ; C. trav. art. R4121-2, 1° et L1111-2')
    const [cinquante] = alertesEmployeur(etat({ effectif: 52 }), AUJ)
    expect(cinquante.message).toMatch(/^Effectif de 52 : seuil de 50 salariés proche/)
    expect(cinquante.fondement).toBe('CSS art. L130-1 et R130-1 ; R243-6, II')
  })

  it('effectif au centième (R130-1, I) : un temps partiel est admis ; près d’un seuil, l’alerte l’écrit au format français', () => {
    expect(codesAlertes(0.62)).toEqual([])
    expect(de(echeances({ effectif: 0.75 }), 'dsn').map((e) => e.date)).toEqual(['2026-11-16'])
    const [alerte] = alertesEmployeur(etat({ effectif: 10.53 }), AUJ)
    expect(alerte.message).toMatch(/^Effectif de 10,53 : seuil de 11 salariés proche/)
    expect(alertesEmployeur(etat({ effectif: 10.5 }), AUJ)[0].message).toMatch(/^Effectif de 10,5 : seuil de 11/)
    // Sous 11 salariés, même au centième près : versement trimestriel admis.
    expect(() => echeances({ effectif: 10.99, versementTrimestrielCotisations: true })).not.toThrow()
    for (const effectif of [1.555, -0.5, Number.NaN]) expect(() => echeances({ effectif })).toThrow(/Effectif invalide .* au centième près/)
  })
})

describe('J67, R35 — signalement en DSN des événements (CSS R133-14 ; arrêté du 2 juillet 2013, art. 1)', () => {
  const sortiLe = (sortieLe: string) => creerSalarieSyndicat({ ...gardien, sortieLe })
  const arret = (champs: Partial<ArretTravail> = {}): ArretTravail => ({
    id: 'arr-1',
    salarieId: 'sal-1',
    motif: 'non_professionnel',
    du: '2026-07-01',
    repriseLe: '2026-08-17',
    visiteRepriseLe: null,
    subrogation: false,
    retenueSurSalaire: true,
    ...champs,
  })
  /** Dernière DSN : juin 2026, avant les événements de ces tests (ceux d'une période déjà déclarée ne sont plus suivis). */
  const signalements = (champs: Partial<EtatEmployeur>) => de(echeances({ derniereDsn: { annee: 2026, mois: 6 }, ...champs }), 'signalement_dsn')

  it('cinq jours ouvrés comptés un par un : un mercredi donne le mercredi suivant ; un jour férié ne compte pas ; Alsace-Moselle', () => {
    expect(ajouterJoursOuvres('2026-10-14', 5)).toBe('2026-10-21')
    expect(ajouterJoursOuvres('2026-11-10', 5)).toBe('2026-11-18')
    expect(ajouterJoursOuvres('2027-03-22', 5)).toBe('2027-03-30')
    expect(ajouterJoursOuvres('2027-03-22', 5, { alsaceMoselle: true })).toBe('2027-03-31')
  })

  it('fin de contrat : dernier jour du contrat (veille de la sortie) + 5 jours ouvrés, point de départ à confirmer ; plus rien une fois signalée', () => {
    // Sortie le mercredi 14/10 : dernier jour le mardi 13/10, signalement au plus tard le mardi 20/10.
    const [fin, ...autres] = signalements({ salaries: [sortiLe('2026-10-14')] })
    expect(autres).toEqual([])
    expect(fin).toMatchObject({ cle: 'signalement_dsn:fin_contrat:sal-1', date: '2026-10-20', salarieId: 'sal-1', nature: 'legale', aConfirmer: true })
    expect(fin.libelle).toBe('Signalement en DSN de la fin du contrat de travail (fin du contrat le 13/10/2026, veille de la sortie)')
    expect(fin.fondement).toBe(
      "CSS art. R133-14, II, al. 2 ; arrêté du 2 juillet 2013, art. 1 : 5 jours ouvrés après l'événement, comptés un par un ; point de départ à confirmer (J67, R35)",
    )
    expect(signalements({ salaries: [sortiLe('2026-10-14')], finsDeContratSignalees: [{ salarieId: 'sal-1', le: '2026-10-16' }] })).toEqual([])
    expect(signalements({})).toEqual([])
  })

  it('arrêt sans subrogation, avec retenue : début + 5 jours ouvrés, puis fin (la reprise) + 5 jours ouvrés', () => {
    expect(signalements({ arrets: [arret()] }).map((e) => [e.cle, e.date, e.libelle])).toEqual([
      ['signalement_dsn:debut_arret:arr-1', '2026-07-08', "Signalement en DSN du début de l'arrêt de travail (maladie ou accident non professionnel, du 01/07/2026)"],
      ['signalement_dsn:fin_arret:arr-1', '2026-08-24', "Signalement en DSN de la fin de l'arrêt de travail (maladie ou accident non professionnel, reprise le 17/08/2026)"],
    ])
    expect(signalements({ arrets: [arret({ repriseLe: null })] }).map((e) => e.cle)).toEqual(['signalement_dsn:debut_arret:arr-1'])
    expect(signalements({ arrets: [arret({ debutSignaleLe: '2026-07-03' })] }).map((e) => e.cle)).toEqual(['signalement_dsn:fin_arret:arr-1'])
    expect(signalements({ arrets: [arret({ debutSignaleLe: '2026-07-03', finSignaleeLe: '2026-08-18' })] })).toEqual([])
  })

  it('employeur subrogé, ou aucune retenue sur le salaire du mois : pas de signalement à part (R133-14, II, 1°)', () => {
    expect(signalements({ arrets: [arret({ subrogation: true })] })).toEqual([])
    expect(signalements({ arrets: [arret({ retenueSurSalaire: false })] })).toEqual([])
  })

  it('subrogation et retenue non saisies : signalement dû (lecture prudente), le libellé le dit', () => {
    const [debut] = signalements({ arrets: [arret({ subrogation: null, retenueSurSalaire: null })] })
    expect(debut).toMatchObject({ cle: 'signalement_dsn:debut_arret:arr-1', date: '2026-07-08', aConfirmer: true })
    expect(debut.libelle).toMatch(/ ; subrogation et retenue sur salaire à saisir\)$/)
  })

  it('événement du 1er à la veille du 15, délai fini avant le 15 : la DSN du mois précédent part dans ce délai (R133-14, I, al. 2)', () => {
    // Sortie le 02/10 : contrat fini le jeudi 01/10, délai au jeudi 08/10.
    const avance = echeances({ salaries: [sortiLe('2026-10-02')], derniereDsn: { annee: 2026, mois: 8 } })
    expect(de(avance, 'dsn').map((e) => [e.cle, e.date])).toEqual([
      ['dsn:2026-09', '2026-10-08'],
      ['dsn:2026-10', '2026-11-16'],
    ])
    const [dsn09] = de(avance, 'dsn')
    expect(dsn09).toMatchObject({ libelle: 'DSN de 09/2026', aConfirmer: true })
    expect(dsn09.fondement).toBe(
      'CSS art. L133-5-3, R133-14, I et R243-6, II ; avancée au 08/10/2026 par le signalement de la fin du contrat de travail (CSS art. R133-14, I, al. 2 ; J67, R35)',
    )
    expect(de(avance, 'versement_cotisations').map((e) => [e.cle, e.date])).toEqual([['cotisations:2026-09', '2026-10-15']])
    // Sortie le 08/10 : contrat fini le mercredi 07/10, délai au mercredi 14/10, avant le 15 : la DSN de septembre est avancée.
    const sortie08 = echeances({ salaries: [sortiLe('2026-10-08')], derniereDsn: { annee: 2026, mois: 8 } })
    expect(de(sortie08, 'signalement_dsn').map((e) => e.date)).toEqual(['2026-10-14'])
    expect(de(sortie08, 'dsn').map((e) => e.date)).toEqual(['2026-10-14', '2026-11-16'])
    // Délai qui finit le 15 ou après, événement du 15, ou contrat fini le 30/09 (sortie le 01/10) : rien n'est avancé.
    for (const sortie of ['2026-10-01', '2026-10-09', '2026-10-15', '2026-10-16'])
      expect(de(echeances({ salaries: [sortiLe(sortie)], derniereDsn: { annee: 2026, mois: 8 } }), 'dsn').map((e) => e.date)).toEqual([
        '2026-10-15',
        '2026-11-16',
      ])
  })

  it('événement d’une période déjà déclarée (dernière DSN) : plus de signalement à part ; sans dernière DSN connue, il reste suivi', () => {
    const ancien = creerSalarieSyndicat({ ...gardien, id: 'sal-2', identiteId: 'identite-2', auxiliaire421: '00002', entreeLe: '2017-01-02', sortieLe: '2024-03-12' })
    const ancienArret = arret({ id: 'arr-2', salarieId: 'sal-2', du: '2023-01-09', repriseLe: '2023-01-20' })
    const suivi = { salaries: [gardien, ancien], arrets: [ancienArret] }
    expect(de(echeances({ ...suivi, derniereDsn: { annee: 2026, mois: 9 } }), 'signalement_dsn')).toEqual([])
    // Arrêt commencé en août (déclaré), repris en octobre (pas encore déclaré) : seule la fin reste à signaler.
    const aCheval = arret({ du: '2026-08-24', repriseLe: '2026-10-05' })
    expect(de(echeances({ arrets: [aCheval], derniereDsn: { annee: 2026, mois: 9 } }), 'signalement_dsn').map((e) => e.cle)).toEqual([
      'signalement_dsn:fin_arret:arr-1',
    ])
    expect(de(echeances({ ...suivi, derniereDsn: null }), 'signalement_dsn').map((e) => e.cle)).toEqual([
      'signalement_dsn:debut_arret:arr-2',
      'signalement_dsn:fin_arret:arr-2',
      'signalement_dsn:fin_contrat:sal-2',
    ])
  })

  it('contrôles : fin de contrat signalée d’un salarié inconnu, dates invalides, saisie non booléenne', () => {
    expect(() => echeances({ finsDeContratSignalees: [{ salarieId: 'sal-9', le: '2026-10-16' }] })).toThrow(/sal-9/)
    expect(() => echeances({ finsDeContratSignalees: [{ salarieId: 'sal-1', le: '16/10/2026' }] })).toThrow(/AAAA-MM-JJ/)
    expect(() => echeances({ arrets: [arret({ debutSignaleLe: '2026-02-30' })] })).toThrow(/AAAA-MM-JJ/)
    expect(() => echeances({ arrets: [arret({ subrogation: 'oui' as never })] })).toThrow(/subrogation/)
  })
})

describe('J67, R36 — visite de reprise selon la version de R4624-31 applicable au premier jour d’arrêt', () => {
  const ancien = creerSalarieSyndicat({ ...gardien, entreeLe: '2020-01-06' })
  const arret = (champs: Partial<ArretTravail> = {}): ArretTravail => ({
    id: 'arr-1',
    salarieId: 'sal-1',
    motif: 'non_professionnel',
    du: '2022-03-01',
    repriseLe: '2022-04-05',
    visiteRepriseLe: null,
    ...champs,
  })
  const reprises = (a: ArretTravail) => de(echeances({ salaries: [ancien], arrets: [a] }), 'visite_reprise')

  it('arrêt commencé au plus tard le 31/03/2022 : 30 jours pour une maladie ou un accident non professionnel, à confirmer', () => {
    expect(visiteRepriseRequise(arret(), 'code_du_travail')).toBe(true) // 35 jours
    expect(visiteRepriseRequise(arret({ du: '2022-04-01', repriseLe: '2022-05-06' }), 'code_du_travail')).toBe(false) // 35 jours
    const [reprise] = reprises(arret())
    expect(reprise).toMatchObject({ date: '2022-04-13', aConfirmer: true })
    expect(reprise.fondement).toBe('C. trav. art. R4624-31, version du 01/01/2017 au 31/03/2022 (décret n° 2016-1908 : 30 jours) ; J67, R36')
  })

  it('arrêt commencé du 01/04/2022 au 14/06/2026 : 60 jours et 8 jours certains, sans dispense', () => {
    const [reprise] = reprises(arret({ du: '2026-03-02', repriseLe: '2026-05-04' })) // 63 jours
    expect(reprise).toMatchObject({ date: '2026-05-12', aConfirmer: false })
    expect(reprise.fondement).toBe(
      'C. trav. art. R4624-31, rédaction des arrêts commencés du 01/04/2022 au 14/06/2026 (décret n° 2022-372, art. 6), sans dispense ; J67, R36',
    )
  })

  it('dispense constatée : admise pour un arrêt commencé à partir du 15/06/2026, refusée avant (aucune dérogation dans la version antérieure)', () => {
    const apres = arret({ motif: 'accident_travail', du: '2026-07-01', repriseLe: '2026-08-15', visiteRepriseLe: '2026-08-15', visiteRepriseNature: 'dispense' })
    expect(reprises(apres)).toEqual([])
    const avant = { ...apres, du: '2026-05-01' }
    expect(() => reprises(avant)).toThrow(/Arrêt arr-1 commencé le 01\/05\/2026 : aucune dispense de visite de reprise avant le 15\/06\/2026/)
    expect(reprises({ ...avant, visiteRepriseNature: 'visite' })).toEqual([])
    expect(() => reprises({ ...apres, visiteRepriseLe: null })).toThrow(/date de la visite ou de la dispense attendue/)
    expect(() => reprises({ ...apres, visiteRepriseNature: 'autre' as never })).toThrow(/visite ou dispense attendue/)
  })
})

describe('J67, R37 — DUERP : rappel de dépôt sur le portail, ou de conservation des versions, à chaque mise à jour', () => {
  it('mise à jour sans dépôt ni conservation constatés : rappel de gestion à confirmer, daté de la mise à jour, aucune échéance de dépôt', () => {
    const rappels = de(echeances({ duerp: { misAJourLe: '2026-02-01', transmisLe: '2026-02-01' } }), 'duerp').filter((e) => e.cle === 'duerp:depot')
    expect(rappels).toMatchObject([{ date: '2026-02-01', nature: 'gestion', aConfirmer: true }])
    expect(rappels[0].libelle).toBe(
      "DUERP mis à jour le 01/02/2026 : le déposer sur le portail s'il est ouvert ; sinon, le conserver avec les versions précédentes (40 ans) et afficher l'avis d'accès (rappel de gestion)",
    )
    expect(rappels[0].fondement).toBe('C. trav. art. L4121-3-1, V, B, b (au plus tard depuis le 01/07/2024 sous 150 salariés) et R4121-4 ; J67, R37')
    expect(versElementsAFaire(rappels, 'mandat-1')).toMatchObject([{ aConfirmer: true }])
  })

  it('dépôt ou conservation constaté depuis la mise à jour : plus de rappel ; constat antérieur : le rappel revient', () => {
    const cles = (duerp: EtatEmployeur['duerp']) => de(echeances({ duerp }), 'duerp').map((e) => e.cle)
    expect(cles({ misAJourLe: '2026-02-01', transmisLe: '2026-02-01', deposeLe: '2026-02-01' })).not.toContain('duerp:depot')
    expect(cles({ misAJourLe: '2026-02-01', transmisLe: '2026-02-01', deposeLe: '2025-02-01' })).toContain('duerp:depot')
    expect(cles({ misAJourLe: null, transmisLe: null })).toEqual(['duerp:etablir'])
    expect(() => cles({ misAJourLe: '2026-02-01', transmisLe: null, deposeLe: '2026-02-30' })).toThrow(/AAAA-MM-JJ/)
  })
})

describe('assemblage et adaptateur vers le suivi « à faire »', () => {
  it('échéances triées par date ; contrôles d’entrée', () => {
    const toutes = echeances({ derniereDsn: { annee: 2026, mois: 7 }, adhesionSanteTravailLe: null })
    expect(dates(toutes)).toEqual([...dates(toutes)].sort((a, b) => a.localeCompare(b)))
    expect(() => echeancesEmployeur(etat(), '30/10/2026')).toThrow(/AAAA-MM-JJ/)
    expect(() => echeances({ salaries: [creerSalarieSyndicat({ ...gardien, coproprieteId: 'copro-2' })] })).toThrow(/syndicat/)
    expect(() => echeances({ effectif: -1 })).toThrow(/Effectif/)
    expect(() => echeances({ suivisMedicaux: [{ salarieId: 'sal-9', derniereVisiteLe: null, prochaineLe: null }] })).toThrow(/sal-9/)
    expect(() => echeances({}, { rappelDuerpMois: 0 })).toThrow(/rappel/)
  })

  it('éléments du suivi : famille « mandat », nature « échéance légale », id stable ; un rappel de gestion est à confirmer', () => {
    const elements = versElementsAFaire(echeances(), 'mandat-1')
    expect(elements.find((e) => e.id === 'mandat:mandat-1:employeur:dsn:2026-10')).toEqual({
      id: 'mandat:mandat-1:employeur:dsn:2026-10',
      famille: 'mandat',
      nature: 'echeance_legale',
      libelle: 'DSN de 10/2026 et versement des cotisations',
      date: '2026-11-16',
      mandatId: 'mandat-1',
      objetId: null,
      assigneId: null,
      aConfirmer: false,
    })
    expect(elements.find((e) => e.id === 'mandat:mandat-1:employeur:medecine_travail:sal-1')?.objetId).toBe('sal-1')
    expect(elements.find((e) => e.id === 'mandat:mandat-1:employeur:duerp:revue')?.aConfirmer).toBe(true)
  })
})

describe('en-tête du module (marqueurs 🟢 / 🔵 / 🔴)', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'echeances-employeur.ts'), 'utf8')
  const entete = source.slice(0, source.indexOf('*/')).replaceAll(/\s*\n\s*\*\s*/g, ' ')
  const nonEtabli = entete.slice(entete.indexOf('🔴 Non établi'))
  const deduit = entete.slice(entete.indexOf('🔵 Déduit'), entete.indexOf('🔴 Non établi'))
  const decisions = entete.slice(entete.indexOf('Décisions du 03/11/2026'), entete.indexOf('🔵 Déduit'))

  it('Gestéam : l’absence de calcul de ces échéances est une observation (🔵), pas un fait lu (🟢)', () => {
    const lu = entete.slice(entete.indexOf('Gestéam —'), entete.indexOf('Le droit —'))
    expect(lu).not.toMatch(/ne calcule aucune/)
    expect(deduit).toMatch(/aucun calcul de ces échéances observé/)
  })

  it('J67, R33 : l’exonération est tranchée (les provisions comptent : BOFiP § 180) ; seule la pratique du cabinet reste en 🔴', () => {
    const j67 = entete.slice(entete.indexOf('Décisions du 17/11/2026'), entete.indexOf('🔵 Déduit'))
    expect(j67).toMatch(/J67, R33 : .*§ 180/)
    expect(j67).toMatch(/CIBS art\. L\. 233-9 et L\. 233-10/)
    expect(nonEtabli).not.toMatch(/§ 180/)
    expect(nonEtabli).toMatch(/pratique du cabinet/)
  })

  it('J28 : le report du versement des cotisations est une décision (pratique de l’Urssaf), pas un texte lu', () => {
    expect(decisions).toMatch(/J28/)
    expect(decisions).toMatch(/aucun texte lu/)
    expect(nonEtabli).not.toMatch(/versement des cotisations/)
    expect(deduit).not.toMatch(/même jour, le 15/)
  })

  it('J26 : R4624-16, R4624-28 et R4624-31 relus sur Légifrance, version en vigueur au 03/11/2026, cités exactement', () => {
    expect(entete).toMatch(/En vigueur au 03\/11\/2026/)
    expect(entete).toMatch(/selon une périodicité qui ne peut excéder cinq ans\. Ce délai, qui prend en compte les conditions de travail/)
    expect(entete).toMatch(/selon une périodicité qu'il détermine et qui ne peut être supérieure à quatre ans\. Une visite intermédiaire/)
    expect(entete).toMatch(/au plus tard deux ans après la visite avec le médecin du travail »/)
    expect(entete).toMatch(/4° Après une absence d'au moins soixante jours pour cause de maladie ou d'accident non professionnel\. »/)
    expect(entete).toMatch(/et au plus tard dans un délai de huit jours qui suivent cette reprise »/)
    expect(entete).toMatch(/décret n° 2026-503 du 12 juin 2026, art\. 2/)
    expect(decisions).toMatch(/J26/)
    expect(decisions).toMatch(/J27/)
  })

  it('J26 : R4624-17 cité exactement (suivi adapté, 3 ans) ; les 5 ans, plafond du seul suivi simple ; catégorie de suivi en 🔴', () => {
    expect(entete).toMatch(
      /R4624-17 \(même version\) : .*les travailleurs handicapés, les travailleurs qui déclarent être titulaires d'une pension d'invalidité et les travailleurs de nuit mentionnés à l'article L\. 3122-5.* selon une périodicité qui n'excède pas une durée de trois ans\. »/,
    )
    expect(deduit).toMatch(/R4624-17 : « selon une périodicité qui n'excède pas une durée de trois ans »/)
    expect(decisions).toMatch(/plafond du seul suivi individuel simple \(R4624-16\)/)
    expect(nonEtabli).toMatch(/9\. Frédéric ou le référent métier : la catégorie de suivi du salarié/)
  })

  it('visite initiale : R4624-18 et R4624-24 cités exactement ; les trois mois, plafond du seul suivi simple, à confirmer (🔴 9)', () => {
    expect(entete).toMatch(
      /R4624-18 \(même version\) : « Tout travailleur de nuit mentionné à l'article L\. 3122-5 et tout travailleur âgé de moins de dix-huit ans bénéficie d'une visite d'information et de prévention réalisée par un professionnel de santé mentionné au premier alinéa de l'article L\. 4624-1 préalablement à son affectation sur le poste\. »/,
    )
    expect(entete).toMatch(
      /R4624-24 \(même version\) : « Le suivi individuel renforcé comprend un examen médical d'aptitude, qui se substitue à la visite d'information et de prévention prévue à l'article R\. 4624-10\. Il est effectué par le médecin du travail préalablement à l'affectation sur le poste\. »/,
    )
    expect(deduit).toMatch(/sans visite connue : visite d'information et de prévention au plus tard trois mois après l'entrée, « à confirmer » \(🔴 9\)/)
    expect(nonEtabli).toMatch(/la date à trois mois de l'entrée reste « à confirmer », elle aussi/)
    // Une déduction, pas une décision du référent métier : la rubrique J26 à J28 n'en dit rien.
    expect(decisions).not.toMatch(/R4624-24|trois mois de l'entrée/)
  })

  it('R4624-31 : dérogation du 3e alinéa citée exactement, reliée à la dispense constatée (visiteRepriseLe)', () => {
    expect(entete).toMatch(
      /« Par dérogation aux dispositions des alinéas précédents, et sauf demande du médecin du travail, de l'employeur ou du travailleur, la visite de reprise n'est pas requise si l'ensemble des conditions suivantes sont réunies : 1° Le travailleur a bénéficié d'une visite de préreprise prévue à l'article L\. 4624-2-4 dans les trente jours précédant sa reprise effective du travail ; 2° Lors de cette visite de préreprise, le médecin du travail a conclu qu'aucune mesure individuelle d'aménagement, d'adaptation ou de transformation du poste ni aucune mesure d'aménagement du temps de travail n'était nécessaire en vue de la reprise\. »/,
    )
    const sourceAplatie = source.replaceAll(/\s*\n\s*\*\s*/g, ' ')
    expect(sourceAplatie).toMatch(/dispense constatée au sens de R4624-31, 3e alinéa/)
  })

  it('sources Gestéam, droit relu et marqueurs', () => {
    expect(entete).toMatch(/tranche 43 § 19/)
    expect(entete).toMatch(/Légifrance le 30\/10\/2026/)
    for (const marqueur of ['🟢', '🔵', '🔴']) expect(entete).toContain(marqueur)
  })

  it('🔴 restants : pratique du cabinet pour la taxe, ouverture du portail du DUERP, CCN non lue, catégorie de suivi ; plus les questions tranchées', () => {
    expect(nonEtabli).not.toMatch(/bénéficie-t-il de l'exonération de taxe sur les salaires/)
    expect(nonEtabli).not.toMatch(/faut-il retenir la CCN IDCC 1043, art\. 13/)
    expect(nonEtabli).not.toMatch(/rappel de gestion de 12 mois/)
    // J67, R34 à R36 : effectif, événements DSN et version de R4624-31 tranchés.
    expect(nonEtabli).not.toMatch(/R130-1 non lu/)
    expect(nonEtabli).not.toMatch(/délai fixé par un arrêté non lu/)
    expect(nonEtabli).not.toMatch(/rédaction antérieure non lue/)
    expect(nonEtabli).toMatch(/le portail de dépôt du DUERP est-il ouvert/)
    expect(nonEtabli).toMatch(/contribution conventionnelle à la formation/)
  })

  it('J67, R34 à R37 : décisions citées dans l’en-tête, avec leurs textes', () => {
    const j67 = entete.slice(entete.indexOf('Décisions du 17/11/2026'), entete.indexOf('🔵 Déduit'))
    expect(j67).toMatch(/J67, R34 : .*CSS L130-1/)
    expect(j67).toMatch(/J67, R35 : .*arrêté du 2 juillet 2013, art\. 1/)
    expect(j67).toMatch(/J67, R36 : .*décret n° 2022-372, art\. 6/)
    expect(j67).toMatch(/J67, R37 : .*R4121-4/)
  })

  it('aucune date ISO dans la source', () => {
    expect(source).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})
