import { describe, expect, it } from 'vitest'
import {
  creerElement,
  preparerFacture,
  type ElementAFacturer,
  type FactureHonoraires,
  type SaisieElement,
} from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import {
  ETAPES_CYCLE_ELEMENT,
  MENTION_TABLEAU_HONORAIRES,
  REGROUPEMENTS_TABLEAU_HONORAIRES,
  anneeDeMissionAu,
  elementsImputes,
  etapeCycleElement,
  etatDeFinDeMission,
  periodeAnneeDeMission,
  periodeMoisPrecedent,
  suiviDesEmoluments,
  tableauDesHonoraires,
  type CumulHonoraires,
  type RetributionTiers,
} from '@/lib/administrateur-judiciaire/domain/honoraires-tableau'
import type { AffectationMandat } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import { AP_120_LOTS, finDeMission, ordonnance } from './donnees-ordonnances-remuneration'
import { enTeteDuModule } from './en-tete-module'

/**
 * Point 67 du bilan 2 — tableau des honoraires (cartographie Gestéam, tranche 43 § 13 ; tranche 27, entrée « 8 - Tableau
 * des honoraires ») : état par période, regroupé par mandat ou par responsable ; qualification et cycle des éléments.
 */

const saisie = (surcharge: Partial<SaisieElement> = {}): SaisieElement => ({
  id: 'el-1',
  coproprieteId: 'copro-tilleuls',
  mandatId: 'mandat-a',
  date: '2026-10-05',
  dossier: 'Gestion',
  nature: 'Honoraires',
  tarif: 'Gestion - HONORAIRES',
  calcul: 'Coût unitaire',
  quantite: 1,
  prixUnitaireHtDixMilliemes: 450_000,
  soumisTva: true,
  tauxTvaPct: 20,
  destinataire: 'Syndicat des copropriétaires',
  ...surcharge,
})

const facture = (id: string, statut: FactureHonoraires['statut'], elementIds: string[]): FactureHonoraires => ({
  id,
  numero: id,
  type: 'Facture',
  date: '2026-10-28',
  statut,
  coproprieteId: 'copro-tilleuls',
  mandatId: 'mandat-a',
  destinataire: 'Syndicat des copropriétaires',
  lignes: elementIds.map((elementId) => ({ elementId, date: '2026-10-05', nature: 'Honoraires', tarif: 'Gestion - HONORAIRES', quantite: 1, htCentimes: 0, tvaCentimes: 0 })),
  tvaParTaux: [],
  totalHtCentimes: 0,
  totalTvaCentimes: 0,
  totalTtcCentimes: 0,
})

const affectations: AffectationMandat[] = [
  { mandatId: 'mandat-a', cabinetId: 'cab-1', responsableId: 'col-1', comptableId: 'col-2', assistantId: null },
  { mandatId: 'mandat-b', cabinetId: 'cab-1', responsableId: 'col-1', comptableId: null, assistantId: null },
  { mandatId: 'mandat-c', cabinetId: 'cab-1', responsableId: 'col-3', comptableId: null, assistantId: 'col-2' },
  { mandatId: 'mandat-d', cabinetId: 'cab-1', responsableId: null, comptableId: null, assistantId: null },
]

/** 45,00 € HT, TVA 20 % : 9,00 € ; 54,00 € TTC. */
const HONORAIRES: CumulHonoraires = { nombre: 1, htCentimes: 4_500, tvaCentimes: 900, ttcCentimes: 5_400 }
const VIDE: CumulHonoraires = { nombre: 0, htCentimes: 0, tvaCentimes: 0, ttcCentimes: 0 }

/** Élément créé en mission judiciaire (J67, R9) ; « Offert » n'y est pas admis, d'où le contrat type pour el-3. */
const creer = (s: SaisieElement): ElementAFacturer => creerElement(s, 'judiciaire')

const elements: ElementAFacturer[] = [
  creer(saisie()),
  { ...creer(saisie({ id: 'el-2', date: '2026-10-10', nature: 'AR', tarif: 'Gestion - RAR', soumisTva: false, prixUnitaireHtDixMilliemes: 61_500 })), statut: 'Facturé' },
  creerElement(saisie({ id: 'el-3', mandatId: 'mandat-b', date: '2026-10-20', qualification: 'Offert' }), 'contrat_type_syndic'),
  creer(
    saisie({
      id: 'el-4',
      mandatId: 'mandat-c',
      date: '2026-10-31',
      nature: 'Vacations',
      calcul: 'Coût horaire',
      quantite: 1.5,
      prixUnitaireHtDixMilliemes: 1_200_000,
      qualification: 'Contrôle coûts',
    }),
  ),
  { ...creer(saisie({ id: 'el-5', mandatId: 'mandat-d', date: '2026-10-01', destinataire: 'Copropriétaire' })), statut: 'Facturé' },
  creer(saisie({ id: 'el-6', date: '2026-09-30' })),
  creer(saisie({ id: 'el-7', mandatId: 'mandat-b', date: '2026-11-01' })),
  creer(saisie({ id: 'el-8', mandatId: 'mandat-e', date: '2026-10-15' })),
]
const factures = [facture('f-imputee', 'Imputée', ['el-2']), facture('f-validee', 'Validée, non imputée', ['el-5'])]
const octobre = { du: '2026-10-01', au: '2026-10-31' }

describe('tableau des honoraires — référentiels', () => {
  it('deux regroupements (Mandat, Responsable) ; trois étapes du cycle de l’élément (statuts de la tranche 43 § 13)', () => {
    expect(REGROUPEMENTS_TABLEAU_HONORAIRES).toEqual(['Mandat', 'Responsable'])
    expect(ETAPES_CYCLE_ELEMENT).toEqual(['A facturer', 'Facturé, non imputé', 'Imputé'])
  })
})

describe('tableau des honoraires — période par défaut : le mois précédent (tranche 43 § 13)', () => {
  it('du premier au dernier jour du mois précédent ; janvier → décembre de l’année précédente ; février bissextile', () => {
    expect(periodeMoisPrecedent('2026-10-30')).toEqual({ du: '2026-09-01', au: '2026-09-30' })
    expect(periodeMoisPrecedent('2026-01-15')).toEqual({ du: '2025-12-01', au: '2025-12-31' })
    expect(periodeMoisPrecedent('2024-03-31')).toEqual({ du: '2024-02-01', au: '2024-02-29' })
    expect(periodeMoisPrecedent('2026-11-01')).toEqual({ du: '2026-10-01', au: '2026-10-31' })
  })

  it('refuse une date du jour invalide', () => {
    expect(() => periodeMoisPrecedent('30/10/2026')).toThrow(/date/i)
    expect(() => periodeMoisPrecedent('2026-02-30')).toThrow(/date/i)
  })
})

describe('compte provisoire détaillé des émoluments — période par défaut : l’année de mission (décision du 20/11/2026, partie C, F3)', () => {
  /** Année de mission d'une désignation plausible (null seulement pour une année improbable). */
  const anneeDeMission = (designation: string, n: number): { du: string; au: string } => {
    const periode = periodeAnneeDeMission(designation, n)
    if (periode === null) throw new Error(`Désignation ${designation} : année de mission attendue.`)
    return periode
  }

  it('année de mission n : du quantième de la désignation au jour qui précède le n-ième anniversaire', () => {
    expect(periodeAnneeDeMission('2026-03-15', 1)).toEqual({ du: '2026-03-15', au: '2027-03-14' })
    expect(periodeAnneeDeMission('2026-03-15', 2)).toEqual({ du: '2027-03-15', au: '2028-03-14' })
    expect(periodeAnneeDeMission('2026-03-15', 3)).toEqual({ du: '2028-03-15', au: '2029-03-14' })
    // Désignation un 1er janvier : l'année de mission coïncide avec l'année civile.
    expect(periodeAnneeDeMission('2027-01-01', 1)).toEqual({ du: '2027-01-01', au: '2027-12-31' })
  })

  it('désignation un 29 février : anniversaire le 28 février des années non bissextiles (comme dates.ajouterMois, Q3 du 17/11)', () => {
    expect(periodeAnneeDeMission('2028-02-29', 1)).toEqual({ du: '2028-02-29', au: '2029-02-27' })
    expect(periodeAnneeDeMission('2028-02-29', 2)).toEqual({ du: '2029-02-28', au: '2030-02-27' })
    expect(periodeAnneeDeMission('2028-02-29', 4)).toEqual({ du: '2031-02-28', au: '2032-02-28' })
    expect(periodeAnneeDeMission('2028-02-29', 5)).toEqual({ du: '2032-02-29', au: '2033-02-27' })
  })

  it('les années de mission se suivent sans trou ni chevauchement', () => {
    for (const designation of ['2026-03-15', '2028-02-29', '2026-08-31', '2026-12-31'])
      for (let n = 1; n <= 8; n++) {
        const { au } = anneeDeMission(designation, n)
        const suivante = anneeDeMission(designation, n + 1)
        expect(anneeDeMissionAu(designation, au)).toBe(n)
        expect(anneeDeMissionAu(designation, suivante.du)).toBe(n + 1)
        expect(suivante.du > au).toBe(true)
      }
  })

  it('rang de l’année de mission qui contient une date ; une date antérieure à la désignation est refusée', () => {
    expect(anneeDeMissionAu('2026-03-15', '2026-03-15')).toBe(1)
    expect(anneeDeMissionAu('2026-03-15', '2027-03-14')).toBe(1)
    expect(anneeDeMissionAu('2026-03-15', '2027-03-15')).toBe(2)
    expect(anneeDeMissionAu('2026-03-15', '2026-12-31')).toBe(1)
    expect(anneeDeMissionAu('2026-03-15', '2031-01-10')).toBe(5)
    expect(anneeDeMissionAu('2028-02-29', '2029-02-27')).toBe(1)
    expect(anneeDeMissionAu('2028-02-29', '2029-02-28')).toBe(2)
    expect(() => anneeDeMissionAu('2026-03-15', '2026-03-14')).toThrow(/antérieure à la désignation/)
  })

  it('désignation ou date d’une année improbable (faute de frappe) : aucune année de mission, au lieu de lever en l’an 10000', () => {
    // Depuis le 01/06/9999, le premier anniversaire tombait en l'an 10000 : « Date ISO invalide » levée.
    for (const designation of ['9999-06-01', '2525-03-15', '0026-03-15']) {
      expect(periodeAnneeDeMission(designation, 1), designation).toBeNull()
      expect(periodeAnneeDeMission(designation, 3), designation).toBeNull()
    }
    expect(anneeDeMissionAu('0026-03-15', '2026-11-20')).toBeNull()
    expect(anneeDeMissionAu('9999-06-01', '9999-07-01')).toBeNull()
    expect(anneeDeMissionAu('2026-03-15', '2525-03-15')).toBeNull()
    // Une date antérieure à la désignation et d'une année improbable : aucun rang, pas de refus.
    expect(anneeDeMissionAu('2026-03-15', '0026-03-15')).toBeNull()
    // Bornes : 1900 et 2100 restent plausibles.
    expect(periodeAnneeDeMission('1900-01-01', 1)).toEqual({ du: '1900-01-01', au: '1900-12-31' })
    expect(periodeAnneeDeMission('2100-01-01', 1)).toEqual({ du: '2100-01-01', au: '2100-12-31' })
    expect(anneeDeMissionAu('2026-03-15', '2100-12-31')).toBe(75)
  })

  it('refuse une date de désignation invalide et un rang qui n’est pas un entier à partir de 1', () => {
    expect(() => periodeAnneeDeMission('15/03/2026', 1)).toThrow(/date de désignation invalide/i)
    expect(() => periodeAnneeDeMission('2026-02-30', 1)).toThrow(/date de désignation invalide/i)
    for (const rang of [0, -1, 1.5, Number.NaN]) expect(() => periodeAnneeDeMission('2026-03-15', rang)).toThrow(/année de mission invalide/i)
    expect(() => anneeDeMissionAu('2026-03-15', '2026-13-01')).toThrow(/date invalide/i)
  })

  it('période modifiable : le tableau accepte l’année de mission comme n’importe quelle période du / au', () => {
    const annee = anneeDeMission('2026-03-15', 1)
    const tableau = tableauDesHonoraires(elements, affectations, { ...annee, regroupement: 'Mandat' }, factures)
    expect(tableau).toMatchObject({ du: '2026-03-15', au: '2027-03-14' })
    expect(tableau.total.parQualification.Facturable.nombre).toBe(6)
  })

  it('le tableau mensuel reste un contrôle interne : mention du domaine, à afficher avec l’écran', () => {
    expect(MENTION_TABLEAU_HONORAIRES).toMatch(/contrôle interne/)
    expect(MENTION_TABLEAU_HONORAIRES).toMatch(/pas le compte provisoire détaillé des émoluments/)
    expect(MENTION_TABLEAU_HONORAIRES).toMatch(/année de mission/)
  })

  it('en-tête : la question de la période est tranchée, avec ses fondements', () => {
    const { texte, item } = enTeteDuModule('honoraires-tableau')
    expect(texte).not.toMatch(/Quelle période le cabinet présente-t-il au juge/)
    const decision = item('- Décision du 20/11/2026 (partie C, F3)')
    expect(decision).toMatch(/année de mission, comptée depuis la date de désignation enregistrée sur le mandat/)
    expect(decision).toMatch(/période modifiable/)
    expect(decision).toMatch(/contrôle interne/)
    expect(decision).toMatch(/année civile, on change le défaut/)
    expect(decision).toMatch(/D\. 1967 art\. 61-1-5, II.*art\. 62-11, I/)
    expect(decision).toMatch(/periodeAnneeDeMission/)
    expect(decision).toMatch(/periodeMoisPrecedent/)
    // La date de désignation est enregistrée sur le mandat (son ordonnance) : la nommer, et écarter le repli de la vue.
    expect(decision).toMatch(/date de l'ordonnance enregistrée sur le mandat \(MandatEnregistre\.ordonnance/)
    expect(decision).toMatch(/jamais la date de création de la copropriété.*fusionnerCoproMandat/)
    expect(decision).not.toMatch(/Donnée hors du domaine/)
  })
})

describe('tableau des honoraires — étape du cycle de l’élément', () => {
  it('éléments imputés : ceux des factures « Imputée » seulement', () => {
    expect([...elementsImputes(factures)]).toEqual(['el-2'])
    expect(elementsImputes([]).size).toBe(0)
  })

  it('A facturer, puis facturé non imputé, puis imputé', () => {
    const imputes = elementsImputes(factures)
    expect(etapeCycleElement(elements[0], imputes)).toBe('A facturer')
    expect(etapeCycleElement(elements[1], imputes)).toBe('Imputé')
    expect(etapeCycleElement(elements[4], imputes)).toBe('Facturé, non imputé')
  })
})

describe('tableau des honoraires — regroupement par mandat', () => {
  const tableau = tableauDesHonoraires(elements, affectations, { ...octobre, regroupement: 'Mandat' }, factures)

  it('une ligne par mandat, dans l’ordre des mandats ; seuls les éléments datés dans la période (bornes incluses)', () => {
    expect(tableau.lignes.map((l) => [l.cle, l.mandatIds])).toEqual([
      ['mandat-a', ['mandat-a']],
      ['mandat-b', ['mandat-b']],
      ['mandat-c', ['mandat-c']],
      ['mandat-d', ['mandat-d']],
      ['mandat-e', ['mandat-e']],
    ])
    expect(tableau).toMatchObject({ du: '2026-10-01', au: '2026-10-31', regroupement: 'Mandat', collaborateurId: null })
  })

  it('cumuls par qualification : les offerts et le contrôle des coûts sont valorisés à part', () => {
    const [a, b, c] = tableau.lignes
    expect(a.parQualification).toEqual({
      Facturable: { nombre: 2, htCentimes: 5_115, tvaCentimes: 900, ttcCentimes: 6_015 },
      Offert: VIDE,
      'Contrôle coûts': VIDE,
    })
    expect(b.parQualification).toEqual({ Facturable: VIDE, Offert: HONORAIRES, 'Contrôle coûts': VIDE })
    expect(c.parQualification['Contrôle coûts']).toEqual({ nombre: 1, htCentimes: 18_000, tvaCentimes: 3_600, ttcCentimes: 21_600 })
  })

  it('facturables par étape du cycle ; offerts et contrôle des coûts hors cycle', () => {
    const [a, b, c, d] = tableau.lignes
    expect(a.facturablesParEtape).toEqual({
      'A facturer': HONORAIRES,
      'Facturé, non imputé': VIDE,
      Imputé: { nombre: 1, htCentimes: 615, tvaCentimes: 0, ttcCentimes: 615 },
    })
    expect(b.facturablesParEtape).toEqual({ 'A facturer': VIDE, 'Facturé, non imputé': VIDE, Imputé: VIDE })
    expect(c.facturablesParEtape).toEqual({ 'A facturer': VIDE, 'Facturé, non imputé': VIDE, Imputé: VIDE })
    expect(d.facturablesParEtape['Facturé, non imputé']).toEqual(HONORAIRES)
  })

  it('facturables par destinataire : le syndicat et le copropriétaire à part (L. 1965 art. 10-1, b)', () => {
    expect(tableau.lignes[0].facturablesParDestinataire).toEqual([
      { destinataire: 'Syndicat des copropriétaires', cumul: { nombre: 2, htCentimes: 5_115, tvaCentimes: 900, ttcCentimes: 6_015 } },
    ])
    expect(tableau.lignes[1].facturablesParDestinataire).toEqual([])
    expect(tableau.lignes[3].facturablesParDestinataire).toEqual([{ destinataire: 'Copropriétaire', cumul: HONORAIRES }])
    expect(tableau.total.facturablesParDestinataire.map((d) => [d.destinataire, d.cumul.nombre])).toEqual([
      ['Copropriétaire', 1],
      ['Syndicat des copropriétaires', 3],
    ])
  })

  it('facturables par catégorie : la rémunération (émoluments) et les frais (timbre, AR…) à part', () => {
    const [a, b, c, d] = tableau.lignes
    expect(a.facturablesParCategorie).toEqual({ Rémunération: HONORAIRES, Frais: { nombre: 1, htCentimes: 615, tvaCentimes: 0, ttcCentimes: 615 } })
    expect(b.facturablesParCategorie).toEqual({ Rémunération: VIDE, Frais: VIDE })
    expect(c.facturablesParCategorie).toEqual({ Rémunération: VIDE, Frais: VIDE })
    expect(d.facturablesParCategorie).toEqual({ Rémunération: HONORAIRES, Frais: VIDE })
    expect(tableau.total.facturablesParCategorie).toEqual({
      Rémunération: { nombre: 3, htCentimes: 13_500, tvaCentimes: 2_700, ttcCentimes: 16_200 },
      Frais: { nombre: 1, htCentimes: 615, tvaCentimes: 0, ttcCentimes: 615 },
    })
    const { Rémunération, Frais } = tableau.total.facturablesParCategorie
    expect(Rémunération.ttcCentimes + Frais.ttcCentimes).toBe(tableau.total.parQualification.Facturable.ttcCentimes)
  })

  it('total : somme des lignes', () => {
    expect(tableau.total.parQualification).toEqual({
      Facturable: { nombre: 4, htCentimes: 14_115, tvaCentimes: 2_700, ttcCentimes: 16_815 },
      Offert: HONORAIRES,
      'Contrôle coûts': { nombre: 1, htCentimes: 18_000, tvaCentimes: 3_600, ttcCentimes: 21_600 },
    })
    expect(tableau.total.facturablesParEtape).toEqual({
      'A facturer': { nombre: 2, htCentimes: 9_000, tvaCentimes: 1_800, ttcCentimes: 10_800 },
      'Facturé, non imputé': HONORAIRES,
      Imputé: { nombre: 1, htCentimes: 615, tvaCentimes: 0, ttcCentimes: 615 },
    })
    const somme = tableau.lignes.reduce((s, l) => s + l.parQualification.Facturable.ttcCentimes, 0)
    expect(somme).toBe(tableau.total.parQualification.Facturable.ttcCentimes)
  })

  it('sans les factures, aucun élément n’est réputé imputé', () => {
    const sansFactures = tableauDesHonoraires(elements, affectations, { ...octobre, regroupement: 'Mandat' })
    expect(sansFactures.lignes[0].facturablesParEtape['Facturé, non imputé']).toEqual({ nombre: 1, htCentimes: 615, tvaCentimes: 0, ttcCentimes: 615 })
    expect(sansFactures.lignes[0].facturablesParEtape.Imputé).toEqual(VIDE)
  })
})

describe('tableau des honoraires — regroupement par responsable du mandat (RolesMandat)', () => {
  const tableau = tableauDesHonoraires(elements, affectations, { ...octobre, regroupement: 'Responsable' }, factures)

  it('une ligne par responsable, avec ses mandats ; mandat sans responsable ou sans affectation : ligne « null », en dernier', () => {
    expect(tableau.lignes.map((l) => [l.cle, l.mandatIds])).toEqual([
      ['col-1', ['mandat-a', 'mandat-b']],
      ['col-3', ['mandat-c']],
      [null, ['mandat-d', 'mandat-e']],
    ])
    expect(tableau.lignes[0].parQualification).toMatchObject({
      Facturable: { nombre: 2, htCentimes: 5_115 },
      Offert: HONORAIRES,
    })
  })

  it('le total ne dépend pas du regroupement', () => {
    const parMandat = tableauDesHonoraires(elements, affectations, { ...octobre, regroupement: 'Mandat' }, factures)
    expect(tableau.total).toEqual(parMandat.total)
  })
})

describe('tableau des honoraires — collaborateur : mandats de son portefeuille (trois rôles)', () => {
  it('responsable de deux mandats', () => {
    const tableau = tableauDesHonoraires(elements, affectations, { ...octobre, regroupement: 'Mandat', collaborateurId: 'col-1' }, factures)
    expect(tableau.lignes.map((l) => l.cle)).toEqual(['mandat-a', 'mandat-b'])
    expect(tableau.collaborateurId).toBe('col-1')
  })

  it('comptable d’un mandat, assistant d’un autre ; regroupés par leur responsable', () => {
    const tableau = tableauDesHonoraires(elements, affectations, { ...octobre, regroupement: 'Responsable', collaborateurId: 'col-2' }, factures)
    expect(tableau.lignes.map((l) => [l.cle, l.mandatIds])).toEqual([
      ['col-1', ['mandat-a']],
      ['col-3', ['mandat-c']],
    ])
  })

  it('collaborateur sans mandat : tableau vide, totaux nuls', () => {
    const tableau = tableauDesHonoraires(elements, affectations, { ...octobre, regroupement: 'Mandat', collaborateurId: 'col-9' })
    expect(tableau.lignes).toEqual([])
    expect(tableau.total.parQualification.Facturable).toEqual(VIDE)
    expect(tableau.total.facturablesParDestinataire).toEqual([])
  })
})

describe('tableau des honoraires — en-tête : le tableau n’est pas le compte des émoluments présenté au juge', () => {
  const { texte, item } = enTeteDuModule('honoraires-tableau')

  it('🔵 la période libre n’en fait pas le compte provisoire détaillé des émoluments : un timbre n’est pas un émolument', () => {
    expect(texte).not.toMatch(/le même calcul sert à ce compte annuel/)
    expect(texte).toMatch(/Le tableau n'est pas ce compte/)
    expect(texte).toMatch(/facturablesParCategorie/)
  })

  it('🟢 Gestéam sépare honoraires et frais : type « Remboursement de frais » ; 62111 ↔ 901 et 62120 ↔ 951 « DEBOURS »', () => {
    expect(texte).toMatch(/« Remboursement de frais »/)
    expect(texte).toMatch(/62120 ↔ 951 « DEBOURS »/)
  })

  it('J67, R5 : frais à part de la rémunération (choix confirmé), jamais facturés sans ordonnance, annexe « frais et débours » ; plus de 🔴', () => {
    expect(texte).not.toMatch(/🔴 \(Hugo\) Administration provisoire : les frais/)
    const decision = item('- J67, R5 (recommandation L1-09)')
    expect(decision).toMatch(/ne sont pas remboursés automatiquement au cabinet/)
    expect(decision).toMatch(/Choix actuel confirmé : le tableau les cumule à part de la rémunération \(facturablesParCategorie\), sans rien en déduire/)
    expect(decision).toMatch(/jamais facturés sans une ordonnance qui les couvre \(preparerFacture, J67, R3\)/)
    expect(decision).toMatch(/annexe « frais et débours exposés »/)
    expect(decision).toMatch(/61-1-5, III,\s+al\. 2, pour les seuls droits proportionnels au-delà de 75 000 € HT/)
    // J72 concilie R5 et R6 : plus de choix « resté ouvert » ; la dépense du syndicat (a) n'est pas un élément du cabinet
    expect(decision).not.toMatch(/reste ouvert/)
    expect(decision).toMatch(/J72 \(décision de Hugo du 18\/11\/2026\) : \(a\) .*dépense du syndicat.*Contrôle coûts.*hors des facturables/)
    expect(decision).toMatch(/\(b\) .*frais du cabinet.*annexe « frais et débours ».*honoraires-sinistre\.ts/)
  })

  it('J67, R5 (correction de texte) : le III, al. 2 du 61-1-5 ne joue que si les droits proportionnels des art. 11 à 13 dépassent 75 000 € HT', () => {
    expect(texte).toMatch(/III, al\. 2, qui ne joue que lorsque les droits proportionnels des art\. 11 à 13 de l'arrêté du 8 octobre 2015 dépassent 75 000 € HT/)
  })

  it('J67, R4 : la question des règles 810.4, 900.2 et 900.3 est tranchée ; suivi et état de fin de mission cités', () => {
    expect(texte).not.toMatch(/Le cabinet applique-t-il à l'administration provisoire de copropriété les règles 810\.4/)
    const decision = item('- J67, R4')
    expect(decision).toMatch(/L\. 1965 art\. 29-1, III, dernier al\./)
    expect(decision).toMatch(/suiviDesEmoluments.*etatDeFinDeMission/)
    expect(decision).toMatch(/900\.2.*900\.3/)
  })
})

describe('tableau des honoraires — émoluments taxés, perçus et restant à percevoir (J67, R4 ; règles 810.4, 900.2, 900.3)', () => {
  /** Élément du mandat « mandat-2026 », de ce montant HT (centimes). */
  const element = (id: string, htCentimes: number, surcharge: Partial<SaisieElement> = {}): ElementAFacturer =>
    creer(saisie({ id, mandatId: 'mandat-2026', prixUnitaireHtDixMilliemes: htCentimes * 100, ...surcharge }))
  const facturee = (id: string, elementsFactures: ElementAFacturer[], statut: FactureHonoraires['statut']): FactureHonoraires => ({
    ...preparerFacture(elementsFactures, {
      id,
      numero: id,
      date: '2026-04-15',
      mandatId: 'mandat-2026',
      destinataire: 'Syndicat des copropriétaires',
      cadre: { mission: 'judiciaire', mandat: AP_120_LOTS, ordonnances: [ordonnance()], factures: [] },
    }).facture,
    statut,
  })
  const facturesDuMandat = [
    facturee('f-droit-fixe', [element('el-df', 150_000, { droitFixe: true })], 'Imputée'),
    facturee('f-acompte', [element('el-ac', 100_000), element('el-ar', 10_000, { nature: 'AR', tarif: 'Gestion - RAR', soumisTva: false })], 'Imputée'),
    facturee('f-validee', [element('el-va', 50_000)], 'Validée, non imputée'),
  ]

  it('par catégorie : taxé par les ordonnances, droit fixe à part, perçu (factures imputées), restant à percevoir', () => {
    expect(suiviDesEmoluments('mandat-2026', AP_120_LOTS, [ordonnance()], facturesDuMandat)).toEqual({
      mandatId: 'mandat-2026',
      parCategorie: {
        Rémunération: { taxeHtCentimes: 300_000, droitFixeHtCentimes: 150_000, percuHtCentimes: 250_000, resteAPercevoirHtCentimes: 200_000 },
        Frais: { taxeHtCentimes: 20_000, droitFixeHtCentimes: 0, percuHtCentimes: 10_000, resteAPercevoirHtCentimes: 10_000 },
      },
      ordonnanceIds: ['ord-1'],
    })
  })

  it('l’ordonnance de fin de mission arrête toute la rémunération : le droit fixe et les acomptes s’imputent sur elle', () => {
    const suivi = suiviDesEmoluments('mandat-2026', AP_120_LOTS, [ordonnance(), finDeMission()], facturesDuMandat)
    expect(suivi.parCategorie.Rémunération).toEqual({ taxeHtCentimes: 600_000, droitFixeHtCentimes: 0, percuHtCentimes: 250_000, resteAPercevoirHtCentimes: 350_000 })
    expect(suivi.parCategorie.Frais.resteAPercevoirHtCentimes).toBe(30_000)
    expect(suivi.ordonnanceIds).toEqual(['ord-fin'])
  })

  const retribution = (surcharge: Partial<RetributionTiers> = {}): RetributionTiers => ({
    id: 'ret-1',
    mandatId: 'mandat-2026',
    tiers: "Tiers désigné par le juge pour assister l'administrateur provisoire",
    date: '2026-06-30',
    montantHtCentimes: 80_000,
    ordonnance: 'Ordonnance du 02/03/2026',
    ...surcharge,
  })

  it('état de fin de mission : synthèse par catégorie, ordonnances, rétributions des tiers et restant à percevoir (900.2, 900.3)', () => {
    const etat = etatDeFinDeMission('mandat-2026', AP_120_LOTS, [ordonnance(), finDeMission()], facturesDuMandat, [
      retribution(),
      retribution({ id: 'ret-2', montantHtCentimes: 20_000, ordonnance: null }),
    ])
    expect(etat.emoluments.Rémunération.resteAPercevoirHtCentimes).toBe(350_000)
    expect(etat.ordonnances.map((o) => [o.id, o.type, o.retenue, o.montants.emolumentsHtCentimes])).toEqual([
      ['ord-1', 'acompte', false, 300_000],
      ['ord-fin', 'fin_de_mission', true, 600_000],
    ])
    expect(etat.retributionsTiers.map((r) => r.id)).toEqual(['ret-1', 'ret-2'])
    expect(etat.totalRetributionsTiersHtCentimes).toBe(100_000)
    expect(etat.resteAPercevoirHtCentimes).toBe(350_000 + 30_000)
    expect(etat.signalements).toEqual([expect.stringMatching(/^Rétribution ret-2 .*sans ordonnance enregistrée.*règle professionnelle 900\.2/)])
  })

  it('perçu au-delà du taxé : restant négatif, signalé à vérifier', () => {
    const etat = etatDeFinDeMission('mandat-2026', { regime: 'ap291', nbLots: 600 }, [], facturesDuMandat, [])
    expect(etat.emoluments.Rémunération.resteAPercevoirHtCentimes).toBe(-250_000)
    expect(etat.signalements).toEqual([
      expect.stringMatching(/^Rémunération : perçu au-delà du taxé \(2\s500,00\s€ HT\), à vérifier/),
      expect.stringMatching(/^Frais : perçu au-delà du taxé \(100,00\s€ HT\), à vérifier/),
    ])
  })

  it('les factures d’un autre mandat ne comptent pas ; refuse une rétribution invalide, d’un autre mandat ou en double', () => {
    const autre = { ...facturesDuMandat[0], id: 'f-autre', mandatId: 'autre-mandat' }
    expect(suiviDesEmoluments('mandat-2026', AP_120_LOTS, [], [autre]).parCategorie.Rémunération.percuHtCentimes).toBe(0)
    const etat = (retributions: RetributionTiers[]) => () => etatDeFinDeMission('mandat-2026', AP_120_LOTS, [], [], retributions)
    expect(etat([retribution({ mandatId: 'autre' })])).toThrow(/autre mandat/i)
    expect(etat([retribution(), retribution()])).toThrow(/deux fois/i)
    expect(etat([retribution({ montantHtCentimes: -1 })])).toThrow(/montant/i)
    expect(etat([retribution({ date: '30/06/2026' })])).toThrow(/date/i)
    expect(etat([retribution({ tiers: ' ' })])).toThrow(/tiers/i)
    // Une référence blanche ne passe pas pour une ordonnance enregistrée (règle 900.2) : null si aucune.
    expect(etat([retribution({ ordonnance: '  ' })])).toThrow(/Rétribution ret-1 : référence d'ordonnance vide ; null attendu/)
  })
})

describe('tableau des honoraires — paramètres refusés', () => {
  it('dates invalides, période inversée, regroupement inconnu, collaborateur vide, mandat affecté deux fois', () => {
    expect(() => tableauDesHonoraires(elements, affectations, { du: '01/10/2026', au: '2026-10-31', regroupement: 'Mandat' })).toThrow(/date/i)
    expect(() => tableauDesHonoraires(elements, affectations, { du: '2026-10-01', au: '2026-13-01', regroupement: 'Mandat' })).toThrow(/date/i)
    expect(() => tableauDesHonoraires(elements, affectations, { du: '2026-10-31', au: '2026-10-01', regroupement: 'Mandat' })).toThrow(/période/i)
    expect(() => tableauDesHonoraires(elements, affectations, { ...octobre, regroupement: 'Immeuble' as never })).toThrow(/regroupement/i)
    expect(() => tableauDesHonoraires(elements, affectations, { ...octobre, regroupement: 'Mandat', collaborateurId: '  ' })).toThrow(/collaborateur/i)
    expect(() => tableauDesHonoraires(elements, [...affectations, affectations[0]], { ...octobre, regroupement: 'Responsable' })).toThrow(
      /mandat-a/,
    )
  })

  it('une qualification inconnue (donnée corrompue) est refusée', () => {
    const corrompu = { ...elements[0], qualification: 'Gratuit' as never }
    expect(() => tableauDesHonoraires([corrompu], affectations, { ...octobre, regroupement: 'Mandat' })).toThrow(/qualification inconnue/i)
  })
})
