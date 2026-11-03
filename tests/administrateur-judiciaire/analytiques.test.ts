import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  alertesBudgetProgressif,
  budgetProgressif,
  controlerBudgetProgressif,
  controlerFicheAnalytique,
  controlerHausseFacture,
  creerFicheAnalytique,
  depensesDepuisTraitements,
  ligneDepuisAnalytique,
  mouvementsBudgetDepuisTraitements,
  poidsEcoules,
  type DepenseAnalytique,
  type FicheAnalytique,
  type MouvementBudgetDate,
  type Saisonnalite,
} from '@/lib/administrateur-judiciaire/domain/analytiques'
import { creerBudget } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import { ecritureFactureVentilee, type LigneFacture } from '@/lib/administrateur-judiciaire/domain/facture-ventilee'
import { creerTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Point 28 du bilan Gestéam → VitFix : fiche analytique et alertes de dépense (cartographie Gestéam T13 § 4.1, T21 § 9.1,
 * T24 § 5, T43 § 14). Règles de GESTION : aucun texte n'impose d'alerte de hausse ni de budget progressif.
 * - La fiche porte le compte, la rubrique, la clé, la part récupérable, la TVA (code), les honoraires et deux alertes.
 * - La ligne de facture porte l'analytique (son id : le code n'est pas unique) ; la clé du syndicat l'emporte sur la fiche.
 * - Alerte de hausse : « si par rapport à la facture précédente le dépassement atteint n % », hors contrat.
 * - Budget progressif : budget × part cumulée des mois écoulés selon une saisonnalité J…D, seuil en %.
 */

/** Saisonnalité « chauffage » : J 20, F 18, M 14, A 8, M 2, J à S 0, O 8, N 12, D 18 (total 100 %). */
const CHAUFFAGE: Saisonnalite = [20, 18, 14, 8, 2, 0, 0, 0, 0, 8, 12, 18]

const fiche = (surcharge: Partial<FicheAnalytique> = {}): FicheAnalytique => ({
  id: 'an-010',
  code: '010',
  libelle: 'Salaires gardien',
  horsService: false,
  comptePlan: '64100',
  rubrique: '010',
  codeFiscal: null,
  tva: null,
  tvaLibre: true,
  unite: null,
  cle: null,
  recuperablePct: 75,
  nonSoumisHonoraires: false,
  nonDeductible: false,
  tauxHonorairesPct: null,
  libelleEcriture: null,
  dossier: null,
  groupeDepenses: null,
  domaine: null,
  alerteHaussePct: null,
  alerteBudgetPct: null,
  saisonnalite: null,
  ...surcharge,
})

const codes = (f: FicheAnalytique) => controlerFicheAnalytique(f).map((a) => a.code)

describe('fiche analytique', () => {
  it('une fiche complète est conforme ; la clé peut rester vide au paramétrage (T24 § 5)', () => {
    expect(controlerFicheAnalytique(fiche())).toEqual([])
    expect(controlerFicheAnalytique(fiche({ cle: '001', saisonnalite: CHAUFFAGE, alerteBudgetPct: 10, alerteHaussePct: 5 }))).toEqual([])
  })

  it('code sur 3 caractères alphanumériques, compte du plan sur 5', () => {
    expect(codes(fiche({ code: '01' }))).toEqual(['code_invalide'])
    expect(codes(fiche({ code: '01a' }))).toEqual(['code_invalide'])
    expect(codes(fiche({ code: 'X0H' }))).toEqual([])
    expect(codes(fiche({ comptePlan: '641' }))).toEqual(['compte_invalide'])
  })

  it('part récupérable et taux d’honoraires entre 0 et 100 ; taux incohérent avec « Non soumis honoraires »', () => {
    expect(codes(fiche({ recuperablePct: 120 }))).toEqual(['recuperable_invalide'])
    expect(codes(fiche({ recuperablePct: Number.NaN }))).toEqual(['recuperable_invalide'])
    expect(codes(fiche({ tauxHonorairesPct: 150 }))).toEqual(['honoraires_invalide'])
    expect(codes(fiche({ nonSoumisHonoraires: true, tauxHonorairesPct: 5 }))).toEqual(['honoraires_incoherents'])
    expect(codes(fiche({ nonSoumisHonoraires: true, tauxHonorairesPct: 0 }))).toEqual([])
  })

  it('seuils d’alerte : nombre fini positif ou nul, deux décimales au plus', () => {
    expect(codes(fiche({ alerteHaussePct: -1 }))).toEqual(['seuil_invalide'])
    expect(codes(fiche({ alerteBudgetPct: Number.NaN }))).toEqual(['seuil_invalide'])
    expect(codes(fiche({ alerteBudgetPct: 2.555 }))).toEqual(['seuil_invalide'])
    expect(codes(fiche({ alerteHaussePct: 0, alerteBudgetPct: 2.5 }))).toEqual([])
  })

  it('saisonnalité : 12 valeurs entre 0 et 100, deux décimales au plus, total exactement 100 %', () => {
    const egale: Saisonnalite = [8.34, 8.34, 8.34, 8.34, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33]
    expect(codes(fiche({ saisonnalite: egale }))).toEqual([])
    const a99: Saisonnalite = [20, 18, 14, 8, 2, 0, 0, 0, 0, 8, 12, 17]
    expect(codes(fiche({ saisonnalite: a99 }))).toEqual(['saisonnalite_invalide'])
    const treize = [...CHAUFFAGE, 0] as unknown as Saisonnalite
    expect(codes(fiche({ saisonnalite: treize }))).toEqual(['saisonnalite_invalide'])
    const troisDecimales: Saisonnalite = [8.333, 8.333, 8.334, 8.34, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33]
    expect(codes(fiche({ saisonnalite: troisDecimales }))).toEqual(['saisonnalite_invalide'])
    const negative: Saisonnalite = [120, -20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    expect(codes(fiche({ saisonnalite: negative }))).toEqual(['saisonnalite_invalide'])
  })

  it('création : normalise les textes (espaces, champ vide → null), refuse la première anomalie et un identifiant vide', () => {
    const creee = creerFicheAnalytique(fiche({ code: ' 010 ', libelle: ' Salaires gardien ', rubrique: '  ', cle: ' 001 ', domaine: '' }))
    expect(creee).toMatchObject({ code: '010', libelle: 'Salaires gardien', rubrique: null, cle: '001', domaine: null })
    expect(() => creerFicheAnalytique(fiche({ code: '01', comptePlan: '641' }))).toThrow(/Code analytique/)
    expect(() => creerFicheAnalytique(fiche({ id: ' ' }))).toThrow(/identifiant/)
  })

  it('création : les champs facultatifs omis valent null (textes, taux d’honoraires, seuils, saisonnalité)', () => {
    const creee = creerFicheAnalytique({
      id: 'an-460',
      code: '460',
      libelle: 'Entretien espaces verts',
      horsService: false,
      comptePlan: '61500',
      tvaLibre: false,
      recuperablePct: 100,
      nonSoumisHonoraires: false,
      nonDeductible: false,
    })
    expect(creee).toEqual(fiche({ id: 'an-460', code: '460', libelle: 'Entretien espaces verts', comptePlan: '61500', rubrique: null, tvaLibre: false, recuperablePct: 100 }))
  })
})

describe('ligne de facture depuis la fiche analytique', () => {
  it('recopie compte, rubrique, code fiscal, part récupérable et « non déductible » ; l’analytique est l’id de la fiche', () => {
    const ligne = ligneDepuisAnalytique(fiche({ cle: '001', codeFiscal: 'F3', nonDeductible: true }), { montantTtcCentimes: 120_000 })
    expect(ligne).toEqual({
      comptePlan: '64100',
      analytique: 'an-010',
      cleRepartition: '001',
      rubrique: '010',
      codeFiscal: 'F3',
      montantTtcCentimes: 120_000,
      recupLocatairePct: 75,
      nonDeductible: true,
      lotId: null,
      rattachement: null,
      baseHonorairesCentimes: null,
      tauxHonorairesPct: null,
    })
  })

  it('la clé du syndicat l’emporte sur celle de la fiche ; sans clé, la ligne est refusée', () => {
    expect(ligneDepuisAnalytique(fiche({ cle: '001' }), { montantTtcCentimes: 1_000, cleSyndicat: '003' }).cleRepartition).toBe('003')
    expect(ligneDepuisAnalytique(fiche({ cle: '001' }), { montantTtcCentimes: 1_000, cleSyndicat: ' ' }).cleRepartition).toBe('001')
    expect(() => ligneDepuisAnalytique(fiche(), { montantTtcCentimes: 1_000 })).toThrow(/clé du syndicat/)
  })

  it('refuse une fiche hors service, une fiche invalide et un montant nul, négatif ou non entier', () => {
    expect(() => ligneDepuisAnalytique(fiche({ cle: '001', horsService: true }), { montantTtcCentimes: 1_000 })).toThrow(/hors service/)
    expect(() => ligneDepuisAnalytique(fiche({ cle: '001', comptePlan: '641' }), { montantTtcCentimes: 1_000 })).toThrow(/Compte/)
    expect(() => ligneDepuisAnalytique(fiche({ cle: '001' }), { montantTtcCentimes: 0 })).toThrow(/Montant/)
    expect(() => ligneDepuisAnalytique(fiche({ cle: '001' }), { montantTtcCentimes: 10.5 })).toThrow(/Montant/)
    // Aligné sur creerTraitement, seul chemin d'écriture : une ligne négative ne pourrait pas être écrite.
    const soumise = fiche({ cle: '001', tauxHonorairesPct: 3 })
    expect(() => ligneDepuisAnalytique(soumise, { montantTtcCentimes: -12_000 })).toThrow(/Montant invalide \(-12000\) : centimes entiers strictement positifs/)
    expect(() => ligneDepuisAnalytique(soumise, { montantTtcCentimes: -12_000, montantHtCentimes: -10_000 })).toThrow(/strictement positifs/)
  })

  it('honoraires : base = montant HT fourni, taux de la fiche ; aucun si « Non soumis honoraires » ou sans taux', () => {
    const soumise = fiche({ cle: '001', tauxHonorairesPct: 3 })
    expect(ligneDepuisAnalytique(soumise, { montantTtcCentimes: 12_000, montantHtCentimes: 10_000 })).toMatchObject({
      baseHonorairesCentimes: 10_000,
      tauxHonorairesPct: 3,
    })
    // 🔵 Sans HT, la base reste à compléter : jamais le TTC (la base légale est hors taxe).
    expect(ligneDepuisAnalytique(soumise, { montantTtcCentimes: 12_000 })).toMatchObject({ baseHonorairesCentimes: null, tauxHonorairesPct: 3 })
    expect(
      ligneDepuisAnalytique(fiche({ cle: '001', nonSoumisHonoraires: true, tauxHonorairesPct: 0 }), { montantTtcCentimes: 12_000, montantHtCentimes: 10_000 }),
    ).toMatchObject({ baseHonorairesCentimes: null, tauxHonorairesPct: null })
    expect(ligneDepuisAnalytique(fiche({ cle: '001' }), { montantTtcCentimes: 12_000, montantHtCentimes: 10_000 })).toMatchObject({
      baseHonorairesCentimes: null,
      tauxHonorairesPct: null,
    })
    expect(() => ligneDepuisAnalytique(soumise, { montantTtcCentimes: 12_000, montantHtCentimes: 12_001 })).toThrow(/hors taxe/)
    expect(() => ligneDepuisAnalytique(soumise, { montantTtcCentimes: 12_000, montantHtCentimes: -1 })).toThrow(/hors taxe/)
  })

  it('lot, rattachement et contrat suivent la ligne jusqu’à l’écriture (liens), « non déductible » jusqu’aux attributs', () => {
    const ligne = ligneDepuisAnalytique(fiche({ cle: '001', nonDeductible: true }), {
      montantTtcCentimes: 5_000,
      lotId: 'lot-3',
      rattachement: { type: 'travaux', id: 'OP001' },
      contratId: 'ctr-9',
    })
    expect(ligne.rattachement).toEqual({ type: 'travaux', id: 'OP001' })
    const t = ecritureFactureVentilee({ id: 't-1', date: '2026-10-15', segmentSyndicat: 'TILL', auxiliaireFournisseur: 'GARDI', totalTtcCentimes: 5_000, lignes: [ligne] })
    expect(t.mouvements[0]).toMatchObject({
      compte: 'TILL.64100.OP001.0',
      attributs: { analytique: 'an-010', cle: '001', nonDeductible: true, recupLocatairePct: 75 },
      liens: { lotId: 'lot-3', travauxId: 'OP001', contratId: 'ctr-9' },
    })
  })
})

const ligneEau = (montantTtcCentimes: number, surcharge: Partial<LigneFacture> = {}): LigneFacture => ({
  ...ligneDepuisAnalytique(fiche({ id: 'an-210', code: '210', comptePlan: '60100', rubrique: '210', cle: '001', recuperablePct: 100 }), {
    montantTtcCentimes,
  }),
  ...surcharge,
})

const facture = (id: string, date: string, lignes: LigneFacture[]): Traitement =>
  ecritureFactureVentilee({
    id,
    date,
    segmentSyndicat: 'TILL',
    auxiliaireFournisseur: 'EAU01',
    totalTtcCentimes: lignes.reduce((s, l) => s + l.montantTtcCentimes, 0),
    lignes,
  })

const depense = (id: string, date: string, montantTtcCentimes: number, contratId: string | null = null): DepenseAnalytique => ({
  id,
  date,
  analytique: 'an-210',
  montantTtcCentimes,
  contratId,
})

describe('dépenses par analytique tirées des écritures de factures', () => {
  it('une dépense par facture et par analytique (somme des lignes), avec le contrat de la ligne', () => {
    const t1 = facture('t-1', '2026-01-15', [ligneEau(60_000), ligneEau(40_000), ligneEau(7_000, { analytique: 'an-460', comptePlan: '61500' })])
    const t2 = facture('t-2', '2026-04-15', [ligneEau(80_000, { contratId: 'ctr-1' })])
    expect(depensesDepuisTraitements([t1, t2])).toEqual([
      { id: 't-1', date: '2026-01-15', analytique: 'an-210', montantTtcCentimes: 100_000, contratId: null },
      { id: 't-1', date: '2026-01-15', analytique: 'an-460', montantTtcCentimes: 7_000, contratId: null },
      { id: 't-2', date: '2026-04-15', analytique: 'an-210', montantTtcCentimes: 80_000, contratId: 'ctr-1' },
    ])
  })

  it('facture mixte sur une analytique : la part hors contrat forme sa propre dépense, contrôlée et utilisable comme précédente', () => {
    const t0 = facture('t-0', '2026-01-01', [ligneEau(1_000)])
    const t1 = facture('t-1', '2026-02-01', [ligneEau(5_000), ligneEau(500, { contratId: 'c1' })])
    const t1Inverse = facture('t-1', '2026-02-01', [ligneEau(500, { contratId: 'c1' }), ligneEau(5_000)])
    const t2 = facture('t-2', '2026-03-01', [ligneEau(6_000)])
    const depenses = depensesDepuisTraitements([t0, t1, t2])
    expect(depenses).toEqual([
      { id: 't-0', date: '2026-01-01', analytique: 'an-210', montantTtcCentimes: 1_000, contratId: null },
      { id: 't-1', date: '2026-02-01', analytique: 'an-210', montantTtcCentimes: 5_000, contratId: null },
      { id: 't-1', date: '2026-02-01', analytique: 'an-210', montantTtcCentimes: 500, contratId: 'c1' },
      { id: 't-2', date: '2026-03-01', analytique: 'an-210', montantTtcCentimes: 6_000, contratId: null },
    ])
    expect(depensesDepuisTraitements([t1Inverse]).map((d) => [d.montantTtcCentimes, d.contratId])).toEqual([
      [500, 'c1'],
      [5_000, null],
    ])
    // La part hors contrat de t-1 (+400 % sur t-0) est contrôlée ; la part sous contrat relève du prix attendu.
    expect(controlerHausseFacture(depenses[1], depenses, 10)).toMatchObject({ statut: 'alerte', haussePct: 400, precedente: { id: 't-0' } })
    expect(controlerHausseFacture(depenses[2], depenses, 10).statut).toBe('sous_contrat')
    // t-2 se compare à la part hors contrat de t-1 (+20 %), pas à t-0.
    expect(controlerHausseFacture(depenses[3], depenses, 10)).toMatchObject({ statut: 'alerte', haussePct: 20, precedente: { id: 't-1', contratId: null } })
  })

  it('ignore les autres familles, les lignes sans analytique, la facture annulée et son annulation', () => {
    const t1 = facture('t-1', '2026-01-15', [ligneEau(100_000), ligneEau(5_000, { analytique: null })])
    const t3 = facture('t-3', '2026-02-15', [ligneEau(90_000)])
    const annulation = creerTraitement({
      id: 't-3-annul',
      famille: 'Saisie de factures',
      date: '2026-02-20',
      annule: 't-3',
      mouvements: t3.mouvements.map(({ compte, sens, montantCentimes, attributs }) => ({
        compte,
        sens: sens === 'debit' ? ('credit' as const) : ('debit' as const),
        montantCentimes,
        ...(attributs ? { attributs } : {}),
      })),
    })
    const encaissement = creerTraitement({
      id: 'e-1',
      famille: 'Encaissement',
      date: '2026-02-01',
      mouvements: [
        { compte: 'TILL.51200.00000.0', sens: 'debit', montantCentimes: 500, attributs: { analytique: 'an-210' } },
        { compte: 'TILL.45000.00012.0', sens: 'credit', montantCentimes: 500 },
      ],
    })
    expect(depensesDepuisTraitements([t1, t3, annulation, encaissement])).toEqual([
      { id: 't-1', date: '2026-01-15', analytique: 'an-210', montantTtcCentimes: 100_000, contratId: null },
    ])
  })
})

describe('alerte de hausse par rapport à la facture précédente de la même analytique (hors contrat)', () => {
  const historique = [depense('t-1', '2026-01-15', 100_000), depense('t-0', '2025-10-15', 50_000)]

  it('« dépassement atteint » : une hausse de 10 % alerte sur un seuil de 10 %, 9,999 % non', () => {
    const alerte = controlerHausseFacture(depense('t-2', '2026-04-15', 110_000), historique, 10)
    expect(alerte).toMatchObject({ statut: 'alerte', haussePct: 10, precedente: { id: 't-1' } })
    expect(alerte.message).toMatch(/10 %/)
    expect(controlerHausseFacture(depense('t-2', '2026-04-15', 109_999), historique, 10)).toMatchObject({ statut: 'conforme', haussePct: 9.99 })
    expect(controlerHausseFacture(depense('t-2', '2026-04-15', 41_000), [depense('t-1', '2026-01-15', 40_000)], 2.5).statut).toBe('alerte')
  })

  it('le pourcentage affiché (centièmes, arrondi par défaut) atteint le seuil si et seulement si l’alerte est levée', () => {
    const precedente = [depense('t-1', '2026-01-01', 100_000)]
    const sous = controlerHausseFacture(depense('t-2', '2026-04-15', 109_999), precedente, 10)
    expect(sous).toMatchObject({ statut: 'conforme', haussePct: 9.99 })
    expect(sous.message).toBe('Écart de 9,99 % avec la facture du 01/01/2026, sous le seuil de 10 %.')
    expect(controlerHausseFacture(depense('t-2', '2026-04-15', 109_960), precedente, 10)).toMatchObject({ statut: 'conforme', haussePct: 9.96 })
    const auSeuil = controlerHausseFacture(depense('t-2', '2026-04-15', 110_040), precedente, 10.04)
    expect(auSeuil).toMatchObject({ statut: 'alerte', haussePct: 10.04 })
    expect(auSeuil.message).toBe('Hausse de 10,04 % par rapport à la facture du 01/01/2026 (seuil 10,04 %).')
    expect(controlerHausseFacture(depense('t-2', '2026-04-15', 110_049), precedente, 10.05)).toMatchObject({ statut: 'conforme', haussePct: 10.04 })
    // Baisse infime : affichée négative, jamais « 0 % ».
    expect(controlerHausseFacture(depense('t-2', '2026-04-15', 99_999), precedente, 0)).toMatchObject({ statut: 'conforme', haussePct: -0.01 })
  })

  it('montant identique à la précédente sur un seuil de 0 % : aucune hausse, message sans « sous le seuil »', () => {
    const egal = controlerHausseFacture(depense('t-2', '2026-04-15', 100_000), [depense('t-1', '2026-01-01', 100_000)], 0)
    expect(egal).toMatchObject({ statut: 'conforme', haussePct: 0 })
    expect(egal.message).toBe('Montant identique à la facture du 01/01/2026 : aucune hausse.')
  })

  it('une baisse n’alerte jamais ; un seuil de 0 % alerte à la moindre hausse', () => {
    expect(controlerHausseFacture(depense('t-2', '2026-04-15', 90_000), historique, 0)).toMatchObject({ statut: 'conforme', haussePct: -10 })
    expect(controlerHausseFacture(depense('t-2', '2026-04-15', 100_001), historique, 0).statut).toBe('alerte')
  })

  it('sans seuil, sous contrat (controlerFactureContrat), sans facture précédente', () => {
    expect(controlerHausseFacture(depense('t-2', '2026-04-15', 200_000), historique, null).statut).toBe('sans_seuil')
    expect(controlerHausseFacture(depense('t-2', '2026-04-15', 200_000, 'ctr-1'), historique, 10).statut).toBe('sous_contrat')
    expect(controlerHausseFacture(depense('t-2', '2025-01-15', 200_000), historique, 10)).toMatchObject({ statut: 'sans_precedente', precedente: null, haussePct: null })
  })

  it('la précédente : même analytique, hors contrat, strictement antérieure, montant positif ; la plus récente', () => {
    const autres = [
      ...historique,
      depense('t-c', '2026-03-01', 10_000, 'ctr-1'),
      { ...depense('t-a', '2026-03-02', 10_000), analytique: 'an-460' },
      depense('t-j', '2026-04-15', 10_000),
      depense('t-n', '2026-03-03', -5_000),
    ]
    expect(controlerHausseFacture(depense('t-2', '2026-04-15', 110_000), autres, 10).precedente?.id).toBe('t-1')
  })

  it('les écritures de factures alimentent le contrôle de bout en bout', () => {
    const depenses = depensesDepuisTraitements([facture('t-1', '2026-01-15', [ligneEau(100_000)]), facture('t-2', '2026-04-15', [ligneEau(125_000)])])
    expect(controlerHausseFacture(depenses[1], depenses, 20)).toMatchObject({ statut: 'alerte', haussePct: 25 })
  })

  it('refuse un seuil invalide', () => {
    expect(() => controlerHausseFacture(depense('t-2', '2026-04-15', 1), historique, -5)).toThrow(/Seuil/)
  })

  it('refuse, par une erreur en français, un montant non entier ou NaN (facture courante ou précédente)', () => {
    expect(() => controlerHausseFacture(depense('t-2', '2026-04-15', 100.5), historique, 10)).toThrow(
      /Montant de la facture t-2 invalide \(100\.5\) : centimes entiers attendus/,
    )
    expect(() => controlerHausseFacture(depense('t-2', '2026-04-15', 50.5), historique, 10)).toThrow(/centimes entiers/)
    expect(() => controlerHausseFacture(depense('t-2', '2026-04-15', Number.NaN), historique, 10)).toThrow(/centimes entiers/)
    expect(() => controlerHausseFacture(depense('t-2', '2026-04-15', 110_000), [depense('t-1', '2026-01-15', 90.5)], 10)).toThrow(
      /Montant de la facture t-1 invalide \(90\.5\)/,
    )
    // Une dépense invalide d'une autre analytique ne concerne pas ce contrôle.
    const autre = { ...depense('t-x', '2026-01-20', 90.5), analytique: 'an-460' }
    expect(controlerHausseFacture(depense('t-2', '2026-04-15', 110_000), [...historique, autre], 10).statut).toBe('alerte')
  })
})

const CIVIL = { ouverture: '2026-01-01', cloture: '2026-12-31' }
const DECALE = { ouverture: '2026-07-01', cloture: '2027-06-30' }

describe('budget progressif : poids des mois écoulés', () => {
  it('exercice civil : janvier à mars écoulés (le mois en cours compte entier)', () => {
    expect(poidsEcoules(CHAUFFAGE, CIVIL, '2026-03-10')).toEqual({ ecoules: 5_200, total: 10_000 })
  })

  it('exercice décalé (juillet → juin) : chaque mois prend le poids de son mois civil', () => {
    expect(poidsEcoules(CHAUFFAGE, DECALE, '2026-11-20')).toEqual({ ecoules: 2_000, total: 10_000 })
  })

  it('premier exercice de 18 mois : les mois qui reviennent comptent deux fois', () => {
    const long = { ouverture: '2026-01-01', cloture: '2027-06-30' }
    expect(poidsEcoules(CHAUFFAGE, long, '2027-01-15')).toEqual({ ecoules: 12_000, total: 16_200 })
  })

  it('exercice ouvert en milieu de mois : douze périodes d’un mois, sans compter deux fois le mois d’ouverture', () => {
    expect(poidsEcoules(CHAUFFAGE, { ouverture: '2026-07-15', cloture: '2027-07-14' }, '2027-07-10')).toEqual({ ecoules: 10_000, total: 10_000 })
    expect(poidsEcoules(CHAUFFAGE, { ouverture: '2026-07-15', cloture: '2027-07-14' }, '2026-11-14')).toEqual({ ecoules: 800, total: 10_000 })
  })

  it('arrêté avant l’ouverture : rien d’écoulé ; après la clôture : tout', () => {
    expect(poidsEcoules(CHAUFFAGE, CIVIL, '2025-12-31')).toEqual({ ecoules: 0, total: 10_000 })
    expect(poidsEcoules(CHAUFFAGE, CIVIL, '2027-02-01')).toEqual({ ecoules: 10_000, total: 10_000 })
  })

  it('sans saisonnalité, ou si les mois de l’exercice pèsent 0 : douzièmes égaux (un poids par mois)', () => {
    expect(poidsEcoules(null, CIVIL, '2026-03-10')).toEqual({ ecoules: 3, total: 12 })
    expect(poidsEcoules(CHAUFFAGE, { ouverture: '2026-06-01', cloture: '2026-09-30' }, '2026-07-05')).toEqual({ ecoules: 2, total: 4 })
  })

  it('refuse des dates invalides ou une clôture avant l’ouverture', () => {
    expect(() => poidsEcoules(null, { ouverture: '2026-02-30', cloture: '2026-12-31' }, '2026-03-10')).toThrow(/ouverture/)
    expect(() => poidsEcoules(null, { ouverture: '2026-12-31', cloture: '2026-01-01' }, '2026-03-10')).toThrow(/clôture/)
    expect(() => poidsEcoules(null, CIVIL, '2026-13-01')).toThrow(/arrêté/)
  })
})

describe('budget progressif : montant', () => {
  it('budget × part cumulée des mois écoulés, arrondi au centime le plus proche', () => {
    expect(budgetProgressif(1_200_000, CHAUFFAGE, CIVIL, '2026-03-10')).toBe(624_000)
    const trimestre = { ouverture: '2026-01-01', cloture: '2026-03-31' }
    expect(budgetProgressif(100, null, trimestre, '2026-01-10')).toBe(33)
    expect(budgetProgressif(200, null, trimestre, '2026-01-10')).toBe(67)
    expect(budgetProgressif(1_200_000, CHAUFFAGE, CIVIL, '2027-01-01')).toBe(1_200_000)
  })

  it('refuse un prévu négatif, non entier ou au-delà des entiers sûrs', () => {
    expect(() => budgetProgressif(-1, null, CIVIL, '2026-03-10')).toThrow(/prévu/)
    expect(() => budgetProgressif(1.5, null, CIVIL, '2026-03-10')).toThrow(/prévu/)
    expect(() => budgetProgressif(Number.MAX_SAFE_INTEGER + 2, null, CIVIL, '2026-03-10')).toThrow(/prévu/)
  })
})

const ficheChauffage = (surcharge: Partial<FicheAnalytique> = {}): FicheAnalytique =>
  fiche({
    id: 'an-240',
    code: '240',
    libelle: 'Chauffage collectif',
    comptePlan: '60300',
    rubrique: '240',
    cle: '001',
    recuperablePct: 100,
    saisonnalite: CHAUFFAGE,
    alerteBudgetPct: 10,
    ...surcharge,
  })

const ligneChauffage = (montantTtcCentimes: number, cleSyndicat?: string): LigneFacture =>
  ligneDepuisAnalytique(ficheChauffage(), { montantTtcCentimes, ...(cleSyndicat ? { cleSyndicat } : {}) })

const budget = creerBudget([
  { cle: '001', compte: '60300', rubrique: '240', prevuCentimes: 1_200_000 },
  { cle: '001', compte: '64100', rubrique: '010', prevuCentimes: 2_400_000 },
])

const journal = [
  facture('f-0', '2025-12-20', [ligneChauffage(900_000)]),
  facture('f-1', '2026-01-15', [ligneChauffage(300_000)]),
  facture('f-2', '2026-02-15', [ligneChauffage(300_000)]),
  facture('f-3', '2026-03-05', [ligneChauffage(100_000)]),
  facture('f-4', '2026-03-20', [ligneChauffage(400_000)]),
]

/** Mouvement de budget daté saisi à la main, au débit de la ligne chauffage (001 · 60300 · 240). */
const chauffageDebite = (montantCentimes: number): MouvementBudgetDate => ({
  date: '2026-01-05',
  compte: 'TILL.60300.00000.0',
  cle: '001',
  rubrique: '240',
  sens: 'debit',
  montantCentimes,
})

describe('budget progressif : contrôle par analytique', () => {
  const mouvements = mouvementsBudgetDepuisTraitements(journal)

  it('les mouvements datés portent clé, compte et rubrique ; le crédit fournisseur n’en fait pas partie', () => {
    expect(mouvements).toHaveLength(5)
    expect(mouvements[1]).toEqual({ date: '2026-01-15', compte: 'TILL.60300.00000.0', cle: '001', rubrique: '240', sens: 'debit', montantCentimes: 300_000 })
  })

  it('une répartition de charges (ou son annulation) n’est pas une dépense : elle ne compte pas dans le réalisé', () => {
    const ecritures = (famille: 'Répartition de charges' | 'Annulation répartition de charges', id: string) =>
      creerTraitement({
        id,
        famille,
        date: '2026-03-31',
        mouvements: [
          { compte: 'TILL.60300.00000.0', sens: 'credit', montantCentimes: 700_000, attributs: { cle: '001', rubrique: '240' } },
          { compte: 'TILL.45000.00012.0', sens: 'debit', montantCentimes: 700_000, attributs: { cle: '001', rubrique: '240' } },
        ],
      })
    const avecRepartition = [...journal, ecritures('Répartition de charges', 'r-1'), ecritures('Annulation répartition de charges', 'r-2')]
    expect(mouvementsBudgetDepuisTraitements(avecRepartition)).toEqual(mouvements)
  })

  it('réalisé de l’ouverture à l’arrêté contre budget progressif : alerte au-delà du seuil', () => {
    const controle = controlerBudgetProgressif({ fiche: ficheChauffage(), budget, mouvements, exercice: CIVIL, dateArrete: '2026-03-10' })
    expect(controle).toMatchObject({
      analytiqueId: 'an-240',
      ligne: { cle: '001', compte: '60300', rubrique: '240' },
      prevuCentimes: 1_200_000,
      budgetProgressifCentimes: 624_000,
      realiseCentimes: 700_000,
      depassementPct: 12.17,
      seuilPct: 10,
      statut: 'alerte',
    })
    expect(controle.message).toBe('Dépenses de 12,17 % au-dessus du budget progressif au 10/03/2026 (seuil 10 %).')
    expect(controlerBudgetProgressif({ fiche: ficheChauffage({ alerteBudgetPct: 15 }), budget, mouvements, exercice: CIVIL, dateArrete: '2026-03-10' }).statut).toBe(
      'conforme',
    )
  })

  it('sans seuil : les montants sont calculés, sans alerte', () => {
    expect(controlerBudgetProgressif({ fiche: ficheChauffage({ alerteBudgetPct: null }), budget, mouvements, exercice: CIVIL, dateArrete: '2026-03-10' })).toMatchObject({
      statut: 'sans_seuil',
      budgetProgressifCentimes: 624_000,
      realiseCentimes: 700_000,
    })
  })

  it('hors budget : aucune ligne (clé, compte, rubrique) ne correspond, ou la fiche est sans clé ou sans rubrique', () => {
    expect(controlerBudgetProgressif({ fiche: ficheChauffage({ rubrique: '241' }), budget, mouvements, exercice: CIVIL, dateArrete: '2026-03-10' })).toMatchObject({
      statut: 'hors_budget',
      ligne: null,
    })
    const sansLigne = { statut: 'hors_budget', ligne: null, realiseCentimes: null, message: 'Analytique sans clé ou sans rubrique : aucune ligne de budget à suivre.' }
    expect(controlerBudgetProgressif({ fiche: ficheChauffage({ cle: null }), budget, mouvements, exercice: CIVIL, dateArrete: '2026-03-10' })).toMatchObject(sansLigne)
    expect(controlerBudgetProgressif({ fiche: ficheChauffage({ rubrique: null }), budget, mouvements, exercice: CIVIL, dateArrete: '2026-03-10' })).toMatchObject(sansLigne)
  })

  it('dépassement affiché en centièmes, arrondi par défaut : il atteint le seuil si et seulement si l’alerte est levée', () => {
    const budgetMensuel = creerBudget([{ cle: '001', compte: '60300', rubrique: '240', prevuCentimes: 120_000 }])
    const controle = (montantCentimes: number, seuil: number) =>
      controlerBudgetProgressif({
        fiche: ficheChauffage({ saisonnalite: null, alerteBudgetPct: seuil }),
        budget: budgetMensuel,
        mouvements: [chauffageDebite(montantCentimes)],
        exercice: CIVIL,
        dateArrete: '2026-01-10',
      })
    const auSeuil = controle(11_004, 10.04)
    expect(auSeuil).toMatchObject({ budgetProgressifCentimes: 10_000, depassementPct: 10.04, statut: 'alerte' })
    expect(auSeuil.message).toBe('Dépenses de 10,04 % au-dessus du budget progressif au 10/01/2026 (seuil 10,04 %).')
    expect(controle(11_003, 10.04)).toMatchObject({ depassementPct: 10.03, statut: 'conforme' })
  })

  it('refuse un mouvement de budget dont le montant n’est pas en centimes entiers strictement positifs', () => {
    for (const montant of [10.5, Number.NaN, 0, -100]) {
      const invalides = [chauffageDebite(montant)]
      expect(() => controlerBudgetProgressif({ fiche: ficheChauffage(), budget, mouvements: invalides, exercice: CIVIL, dateArrete: '2026-03-10' })).toThrow(
        /Mouvement de budget invalide .* centimes entiers strictement positifs attendus/,
      )
      expect(() => alertesBudgetProgressif([ficheChauffage()], { budget, mouvements: invalides, exercice: CIVIL, dateArrete: '2026-03-10' })).toThrow(
        /centimes entiers strictement positifs/,
      )
    }
  })

  it('la clé du syndicat désigne la ligne de budget quand la fiche n’en porte pas', () => {
    expect(
      controlerBudgetProgressif({ fiche: ficheChauffage({ cle: null }), cleSyndicat: '001', budget, mouvements, exercice: CIVIL, dateArrete: '2026-03-10' }).statut,
    ).toBe('alerte')
  })

  it('budget progressif nul et dépense engagée : alerte, sans pourcentage', () => {
    const ete = [facture('f-5', '2026-08-01', [ligneChauffage(5_000)])]
    const budgetDecale = creerBudget([{ cle: '001', compte: '60300', rubrique: '240', prevuCentimes: 1_200_000 }])
    expect(
      controlerBudgetProgressif({ fiche: ficheChauffage(), budget: budgetDecale, mouvements: mouvementsBudgetDepuisTraitements(ete), exercice: DECALE, dateArrete: '2026-08-10' }),
    ).toMatchObject({ budgetProgressifCentimes: 0, realiseCentimes: 5_000, depassementPct: null, statut: 'alerte' })
  })

  it('alertes de l’exercice : seules les fiches en service, avec un seuil, en dépassement', () => {
    const fiches = [
      ficheChauffage(),
      ficheChauffage({ id: 'an-241', horsService: true }),
      ficheChauffage({ id: 'an-242', alerteBudgetPct: null }),
      fiche({ cle: '001', alerteBudgetPct: 10 }),
    ]
    expect(alertesBudgetProgressif(fiches, { budget, mouvements, exercice: CIVIL, dateArrete: '2026-03-10' }).map((c) => [c.analytiqueId, c.statut])).toEqual([
      ['an-240', 'alerte'],
    ])
    expect(alertesBudgetProgressif([ficheChauffage({ cle: null })], { clesSyndicat: { 'an-240': '001' }, budget, mouvements, exercice: CIVIL, dateArrete: '2026-03-10' })).toHaveLength(1)
  })
})

describe('analytiques — en-tête : barème de l’administrateur provisoire', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'analytiques.ts'),
    'utf8',
  ).replaceAll(/\r?\n\s*\*\s*/g, ' ')

  it('art. 10 de l’arrêté du 8/10/2015 : 3,5 % jusqu’à 15 000 € de budget, 3 % au-delà, partout dans l’en-tête', () => {
    expect(source).not.toMatch(/3,5 % ou 3 % selon que le budget prévisionnel excède ou non/)
    expect(source).toMatch(/art\. 10 : 3,5 % si le budget prévisionnel n'excède pas 15 000 €, 3 % au-delà/)
  })
})
