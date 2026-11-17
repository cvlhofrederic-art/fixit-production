import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  REGLAGES_SUIVI_EMPLOYEUR_PAR_DEFAUT,
  dateEcheanceDsn,
  datesVisitePeriodique,
  echeancesEmployeur,
  jourEcheanceDsn,
  periodiciteTaxeSalaires,
  taxeSalairesExigible,
  versElementsAFaire,
  versementCotisations,
  visiteRepriseRequise,
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

/** Employeur à jour : DSN de septembre faite, visite passée, DUERP mis à jour et transmis. */
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
  duerp: { misAJourLe: '2026-02-01', transmisLe: '2026-02-01' },
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
    expect(de(echeances({ arrets: [{ ...arret, du: '2026-05-01' }] }), 'visite_reprise')).toMatchObject([{ aConfirmer: true }])
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
    expect(de(echeances({ duerp: { misAJourLe: '2026-02-01', transmisLe: '2025-01-15' } }), 'duerp')).toMatchObject([
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

describe('assemblage et adaptateur vers le suivi « à faire »', () => {
  it('échéances triées par date ; contrôles d’entrée', () => {
    const toutes = echeances({ derniereDsn: { annee: 2026, mois: 7 }, adhesionSanteTravailLe: null })
    expect(dates(toutes)).toEqual([...dates(toutes)].sort((a, b) => a.localeCompare(b)))
    expect(() => echeancesEmployeur(etat(), '30/10/2026')).toThrow(/AAAA-MM-JJ/)
    expect(() => echeances({ salaries: [creerSalarieSyndicat({ ...gardien, coproprieteId: 'copro-2' })] })).toThrow(/syndicat/)
    expect(() => echeances({ effectif: 1.5 })).toThrow(/Effectif/)
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
  const decisions = entete.slice(entete.indexOf('Décisions de Hugo du 03/11/2026'), entete.indexOf('🔵 Déduit'))

  it('Gestéam : l’absence de calcul de ces échéances est une observation (🔵), pas un fait lu (🟢)', () => {
    const lu = entete.slice(entete.indexOf('Gestéam —'), entete.indexOf('Le droit —'))
    expect(lu).not.toMatch(/ne calcule aucune/)
    expect(deduit).toMatch(/aucun calcul de ces échéances observé/)
  })

  it('🔴 2 : la question sur l’exonération cite le BOFiP § 180, déjà lu', () => {
    expect(entete).toMatch(/§ 180/)
    expect(nonEtabli).toMatch(/§ 180/)
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
    expect(nonEtabli).toMatch(/9\. Frédéric ou Hugo : la catégorie de suivi du salarié/)
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
    // Une déduction, pas une décision de Hugo : la rubrique J26 à J28 n'en dit rien.
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

  it('🔴 restants : exonération de taxe sur les salaires ; plus les questions tranchées (CCN ou Code, DUERP, report)', () => {
    expect(nonEtabli).toMatch(/bénéficie-t-il de l'exonération de taxe sur les salaires/)
    expect(nonEtabli).not.toMatch(/faut-il retenir la CCN IDCC 1043, art\. 13/)
    expect(nonEtabli).not.toMatch(/rappel de gestion de 12 mois/)
  })

  it('aucune date ISO dans la source', () => {
    expect(source).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})
