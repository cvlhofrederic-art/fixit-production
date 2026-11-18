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
  REGROUPEMENTS_TABLEAU_HONORAIRES,
  elementsImputes,
  etapeCycleElement,
  etatDeFinDeMission,
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

const elements: ElementAFacturer[] = [
  creerElement(saisie()),
  { ...creerElement(saisie({ id: 'el-2', date: '2026-10-10', nature: 'AR', tarif: 'Gestion - RAR', soumisTva: false, prixUnitaireHtDixMilliemes: 61_500 })), statut: 'Facturé' },
  creerElement(saisie({ id: 'el-3', mandatId: 'mandat-b', date: '2026-10-20', qualification: 'Offert' })),
  creerElement(
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
  { ...creerElement(saisie({ id: 'el-5', mandatId: 'mandat-d', date: '2026-10-01', destinataire: 'Copropriétaire' })), statut: 'Facturé' },
  creerElement(saisie({ id: 'el-6', date: '2026-09-30' })),
  creerElement(saisie({ id: 'el-7', mandatId: 'mandat-b', date: '2026-11-01' })),
  creerElement(saisie({ id: 'el-8', mandatId: 'mandat-e', date: '2026-10-15' })),
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

  it('🔴 les frais de l’administration provisoire : la question reste ouverte, R5 et R6 ne règlent pas les frais d’envoi de la même façon', () => {
    const question = item('🔴 (Hugo) Administration provisoire : les frais')
    expect(question).toMatch(/61-1-5, III/)
    expect(question).toMatch(/arrêté du 8 octobre 2015, art\. 3/)
    expect(question).toMatch(/compte provisoire détaillé des émoluments/)
    expect(question).toMatch(/R5.*R6/)
    expect(question).toMatch(/Choix actuel/)
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
    creerElement(saisie({ id, mandatId: 'mandat-2026', prixUnitaireHtDixMilliemes: htCentimes * 100, ...surcharge }))
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
    facturee('f-droit-fixe', [element('el-df', 150_000)], 'Imputée'),
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
