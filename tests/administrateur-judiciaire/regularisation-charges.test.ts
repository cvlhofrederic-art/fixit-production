import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { creerDecisionAnnuelle } from '@/lib/administrateur-judiciaire/domain/decisions-annuelles-ag'
import { postesImputables } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import { changerStatutExercice, creerExercice, type Exercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import {
  creerCompteCoproprietaire,
  creerPosition,
  muterLot,
  type NatureMutation,
  type Position,
} from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { annulerPiece, changerStatutPiece, dateEffetPiece } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import {
  DELAI_EXIGIBILITE_OBSERVE_GESTEAM_JOURS,
  annulerRepartition,
  appelsRegularisation,
  approbationDepuisDecision,
  calculerRegularisation,
  debiteurDemembrement,
  decomptesIndividuels,
  depensesDeLExercice,
  depensesDepuisMouvements,
  etatDecompte,
  imputerRepartition,
  justificationExigibilite,
  lancerRepartition,
  lireParametresRepartition,
  parametresRepartition,
  parametresVersLignes,
  postesRegularisation,
  provisionsDepuisAvis,
  repartitionActive,
  sensDuSolde,
  soldesParCle,
  statutExerciceApresRepartition,
  traitementRegularisation,
  type EntreeRegularisation,
  type RepartitionCharges,
  type SaisieRepartition,
} from '@/lib/administrateur-judiciaire/domain/regularisation-charges'
import { avisDAppel, creerCleRepartition, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { depuisExercices } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import { annulerTraitement, creerTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import { borneArreteDesComptes } from '@/lib/administrateur-judiciaire/domain/verrou-saisie'

/**
 * Point 25 du bilan 2 — répartition et régularisation des charges de l'exercice clos (Gestéam, tranche 43 § 6 et § 7).
 * - Traitement « Répartition de charges » daté de la CLÔTURE, d'effet au jour du traitement, paramétré (bornes, date de
 *   passage, exigibilité : délai ou date, toujours fourni — aucune durée en dur), passant par le 471, soldé par le 701
 *   (arrêté du 14 mars 2005, art. 10).
 * - Par copropriétaire : provisions remboursées au crédit, quote-part réelle par clé au débit (décret n° 2005-240
 *   art. 8) ; décompte individuel ; appel de régularisation et poste de dette après imputation.
 * - Statuts Enregistré → Imputé, ou Annulé tant que non imputé ; imputation après l'approbation des comptes, au
 *   copropriétaire en place à cette date (D. 1967 art. 6-2, 3°).
 */

const COPRO = 'copro-tilleuls'
const SEGMENT = 'TILL'

const exercice = (surcharge: Partial<Exercice> = {}): Exercice =>
  creerExercice({
    coproprieteId: COPRO,
    nom: '2025',
    ouverture: '2025-01-01',
    cloture: '2025-12-31',
    statut: 'Voté',
    statutIrc: 'Non déclaré',
    agId: 'ag-2024',
    resolutions: { budget: 'R4', complement: null, honoraires: null, travaux: null },
    ...surcharge,
  })

const cle001 = creerCleRepartition({
  id: 'cle-001',
  coproprieteId: COPRO,
  code: '001',
  libelle: 'Charges communes générales',
  lots: [
    { lotId: 'lot-1', tantiemes: 333 },
    { lotId: 'lot-2', tantiemes: 333 },
    { lotId: 'lot-3', tantiemes: 334 },
  ],
})
const cle002 = creerCleRepartition({
  id: 'cle-002',
  coproprieteId: COPRO,
  code: '002',
  libelle: 'Ascenseur',
  lots: [
    { lotId: 'lot-2', tantiemes: 1 },
    { lotId: 'lot-3', tantiemes: 1 },
  ],
})
const cles = [cle001, cle002]

const comptes = [
  creerCompteCoproprietaire({ id: 'cpt-A', coproprieteId: COPRO, serie: '1', libelle: 'A' }),
  creerCompteCoproprietaire({ id: 'cpt-B', coproprieteId: COPRO, serie: '2', libelle: 'B' }),
  creerCompteCoproprietaire({ id: 'cpt-C', coproprieteId: COPRO, serie: '3', libelle: 'C' }),
  creerCompteCoproprietaire({ id: 'cpt-D', coproprieteId: COPRO, serie: '4', libelle: 'D' }),
]
const UN = { numerateur: 1, denominateur: 1 }
const position = (id: string, lotId: string, compteId: string): Position =>
  creerPosition({ id, identiteId: `i-${id}`, lotId, compteId, qualite: 'Copropriétaire', part: UN, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null })
const positions = [position('p1', 'lot-1', 'cpt-A'), position('p2', 'lot-2', 'cpt-B'), position('p3', 'lot-3', 'cpt-C')]
/** Lot 1 passé du compte A au compte D à la date (nature de la mutation : J67, R111). */
const muterLot1 = (date: string, nature?: NatureMutation): Position[] =>
  muterLot(positions, { lotId: 'lot-1', date, sortantes: ['p1'], nature, entrantes: [{ id: 'p4', identiteId: 'i-D', compteId: 'cpt-D', qualite: 'Copropriétaire', part: UN }] })
    .positions

/** Appels 2025 : quatre provisions trimestrielles par clé ; une provision 2024 et un appel de travaux, hors régularisation. */
const echeances: EcheanceAppel[] = [
  ...['2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01'].flatMap((exigibilite, i): EcheanceAppel[] => [
    { id: `b001-${i}`, coproprieteId: COPRO, cleId: 'cle-001', exigibilite, libelle: 'Budget', montantCentimes: 25_000, nature: 'budget' },
    { id: `b002-${i}`, coproprieteId: COPRO, cleId: 'cle-002', exigibilite, libelle: 'Budget', montantCentimes: 10_000, nature: 'budget' },
  ]),
  { id: 'b001-2024', coproprieteId: COPRO, cleId: 'cle-001', exigibilite: '2024-10-01', libelle: 'Budget 2024', montantCentimes: 25_000, nature: 'budget' },
  { id: 'trx-2025', coproprieteId: COPRO, cleId: 'cle-001', exigibilite: '2025-06-01', libelle: 'Ravalement', montantCentimes: 300_000, nature: 'travaux' },
]
const avis = avisDAppel({ echeances, cles, positions, comptes })

/**
 * Dépenses 2025 : 900 € de charges générales et un avoir de 10 €, 500 € d'ascenseur ; 300 € de travaux (classe 67) et
 * 200 € d'une opération de travaux passés en classe 6 (lien travaux), hors régularisation ; une facture de 2026.
 */
const charges: Traitement[] = [
  creerTraitement({
    id: 'f-1',
    famille: 'Saisie de factures',
    date: '2025-06-15',
    mouvements: [
      { compte: 'TILL.61500.00000.0', sens: 'debit', montantCentimes: 90_000, attributs: { cle: '001' } },
      { compte: 'TILL.61400.00000.0', sens: 'debit', montantCentimes: 50_000, attributs: { cle: '002' } },
      { compte: 'TILL.67100.00000.0', sens: 'debit', montantCentimes: 30_000, attributs: { cle: '001' } },
      { compte: 'TILL.40100.00042.0', sens: 'credit', montantCentimes: 170_000 },
    ],
  }),
  creerTraitement({
    id: 'f-trx',
    famille: 'Saisie de factures',
    date: '2025-05-01',
    mouvements: [
      { compte: 'TILL.61500.00007.0', sens: 'debit', montantCentimes: 20_000, attributs: { cle: '001' }, liens: { travauxId: '00007' } },
      { compte: 'TILL.40100.00042.0', sens: 'credit', montantCentimes: 20_000 },
    ],
  }),
  creerTraitement({
    id: 'f-2',
    famille: 'Saisie de factures',
    date: '2025-09-01',
    mouvements: [
      { compte: 'TILL.40100.00042.0', sens: 'debit', montantCentimes: 1_000 },
      { compte: 'TILL.61500.00000.0', sens: 'credit', montantCentimes: 1_000, attributs: { cle: '001' } },
    ],
  }),
  creerTraitement({
    id: 'f-2026',
    famille: 'Saisie de factures',
    date: '2026-01-10',
    mouvements: [
      { compte: 'TILL.61500.00000.0', sens: 'debit', montantCentimes: 7_000, attributs: { cle: '001' } },
      { compte: 'TILL.40100.00042.0', sens: 'credit', montantCentimes: 7_000 },
    ],
  }),
]

const BORNES = { du: '2025-01-01', au: '2025-12-31' }
const provisions = provisionsDepuisAvis([avis], BORNES)
const depenses = depensesDeLExercice(charges, BORNES)
const QUINZE_JOURS = { delaiJours: DELAI_EXIGIBILITE_OBSERVE_GESTEAM_JOURS }

const saisie = (surcharge: Partial<SaisieRepartition> = {}): SaisieRepartition => ({
  exercice: exercice(),
  dateEffet: '2026-02-01',
  mandatCode: 'TILL',
  exigibilite: QUINZE_JOURS,
  cles,
  provisions,
  depenses: depenses.parCle,
  positions,
  comptes,
  repartitionsExistantes: [],
  ...surcharge,
})
const OPTIONS = { id: 'rep-2025', numero: 120_500, segmentSyndicat: SEGMENT, mandatId: 'mandat-2026' }
const lancer = (surcharge: Partial<SaisieRepartition> = {}): RepartitionCharges => lancerRepartition(saisie(surcharge), OPTIONS)
const APPROBATION = { date: '2026-03-20', reference: 'AG du 20/03/2026, résolution 3' }
const ANNULATION = { id: 'ann-1', numero: 120_501, dateEffet: '2026-02-01' }

const totalSur = (t: Traitement, compte: string) =>
  t.mouvements.filter((m) => m.compte === compte).reduce((s, m) => s + (m.sens === 'debit' ? m.montantCentimes : -m.montantCentimes), 0)

describe('paramètres typés de la répartition (tranche 43 § 6)', () => {
  const parametres = (surcharge: Partial<Parameters<typeof parametresRepartition>[0]> = {}) =>
    parametresRepartition({ exercice: exercice(), dateEffet: '2026-02-01', mandatCode: 'TILL', exigibilite: QUINZE_JOURS, ...surcharge })

  it('bornes de l’exercice, date de passage, exigibilité par délai ou par date, toujours fournie, origine gardée', () => {
    expect(DELAI_EXIGIBILITE_OBSERVE_GESTEAM_JOURS).toBe(15)
    expect(parametres({ mandatCode: ' TILL ' })).toEqual({
      du: '2025-01-01',
      au: '2025-12-31',
      dateEffet: '2026-02-01',
      exigibilite: '2026-02-16',
      delaiExigibiliteJours: 15,
      mandatCode: 'TILL',
    })
    expect(parametres({ exigibilite: { delaiJours: 30 } })).toMatchObject({ exigibilite: '2026-03-03', delaiExigibiliteJours: 30 })
    expect(parametres({ exigibilite: { date: '2026-04-01' } })).toMatchObject({ exigibilite: '2026-04-01', delaiExigibiliteJours: null })
    expect(parametres({ exercice: exercice({ statut: 'Répart. en cours' }) }).au).toBe('2025-12-31')
  })

  it('l’exigibilité sort sa justification selon son origine (délai retenu, valeur Gestéam ou non ; date fixée), sans texte, plancher de l’approbation', () => {
    const sansTexte =
      "aucun texte ne fixe l'exigibilité du solde de régularisation (L. 1965 art. 14-1 ; D. 1967 art. 6-2, 35 et 45-1 ; décret n° 2005-240)"
    const plancher = "le solde définitif « résultera de l'approbation des comptes du syndicat » (D. 1967 art. 45-1)."
    expect(justificationExigibilite(parametres())).toBe(
      `Solde exigible le 16/02/2026 : délai de 15 jour(s) après la date de passage du 01/02/2026, retenu par le gestionnaire (valeur observée chez Gestéam) — ${sansTexte} ; plancher retenu : pas avant l'approbation des comptes (contrôlé à l'imputation), ${plancher}`,
    )
    const trente = justificationExigibilite(parametres({ exigibilite: { delaiJours: 30 } }))
    expect(trente).toBe(
      `Solde exigible le 03/03/2026 : délai de 30 jour(s) après la date de passage du 01/02/2026, retenu par le gestionnaire — ${sansTexte} ; plancher retenu : pas avant l'approbation des comptes (contrôlé à l'imputation), ${plancher}`,
    )
    expect(trente).not.toMatch(/Gestéam|quinze/)
    const fixee = justificationExigibilite(parametres({ exigibilite: { date: '2026-05-15' } }))
    expect(fixee).toMatch(/^Solde exigible le 15\/05\/2026 : date fixée par le gestionnaire, 103 jour\(s\) après la date de passage du 01\/02\/2026 — aucun texte/)
    expect(fixee).not.toMatch(/Gestéam|quinze|délai de/)
    expect(justificationExigibilite(parametres({ exigibilite: { date: '2026-02-16' } }))).toMatch(/date fixée par le gestionnaire, 15 jour\(s\)/)
    expect(justificationExigibilite(parametres(), { date: '2026-02-10' })).toMatch(
      /plancher retenu : pas avant l'approbation des comptes du 10\/02\/2026, le solde définitif/,
    )
    expect(() => justificationExigibilite({ ...parametres(), delaiExigibiliteJours: 30 })).toThrow(/délai.*30.*16\/02\/2026/i)
    expect(() => justificationExigibilite({ ...parametres(), delaiExigibiliteJours: -1 })).toThrow(/délai/i)
  })

  it('refuse un exercice non clos, déjà réparti ou non géré ; une exigibilité antérieure au passage ; un délai invalide', () => {
    expect(() => parametres({ dateEffet: '2025-12-31' })).toThrow(/clos/i)
    expect(() => parametres({ exigibilite: { date: '2026-01-31' } })).toThrow(/exigibilit/i)
    expect(() => parametres({ exigibilite: { delaiJours: -1 } })).toThrow(/délai/i)
    expect(() => parametres({ exigibilite: { delaiJours: 1.5 } })).toThrow(/délai/i)
    expect(() => parametres({ mandatCode: ' ' })).toThrow(/mandat/i)
    expect(() => parametres({ exercice: exercice({ statut: 'Réparti' }) })).toThrow(/Réparti/)
    expect(() => parametres({ exercice: exercice({ statut: 'Non géré' }) })).toThrow(/Non géré/)
  })

  it('J67, R103 : un exercice au budget jamais voté (Préparation, Budgété) se répartit, avec l’alerte « budget non voté »', () => {
    for (const statut of ['Préparation', 'Budgété'] as const) {
      const sansVote = exercice({ statut, agId: null, resolutions: { budget: null, complement: null, honoraires: null, travaux: null } })
      expect(parametres({ exercice: sansVote }).au).toBe('2025-12-31')
      const repartition = lancer({ exercice: sansVote })
      expect(repartition.avertissements).toEqual([
        expect.objectContaining({ code: 'budget_non_vote', message: expect.stringMatching(/comptes présentés sans budget voté \(décret n° 2005-240, art\. 8\)/) }),
      ])
      expect(repartition.piece.statut).toBe('Enregistré')
    }
    expect(lancer().avertissements).toEqual([])
    // Le cycle aboutit : « Répart. en cours », puis « Réparti » à l'imputation ; l'alerte « répartition en retard » s'éteint.
    const sansVote = exercice({ statut: 'Préparation', agId: null, resolutions: { budget: null, complement: null, honoraires: null, travaux: null } })
    const lancee = lancer({ exercice: sansVote })
    const enCours = changerStatutExercice(sansVote, statutExerciceApresRepartition(lancee.piece.statut))
    const imputee = imputerRepartition(lancee, { approbation: { ...APPROBATION, date: '2026-02-10' }, positions })
    const reparti = changerStatutExercice(enCours, statutExerciceApresRepartition(imputee.piece.statut))
    expect([enCours.statut, reparti.statut]).toEqual(['Répart. en cours', 'Réparti'])
    const enRetard = (e: Exercice) => depuisExercices([{ mandatId: OPTIONS.mandatId, exercice: e }], '2026-04-01').map((a) => a.nature)
    expect([enRetard(sansVote), enRetard(enCours), enRetard(reparti)]).toEqual([['repartition_en_retard'], ['repartition_en_retard'], []])
    const sansProvision = lancer({ exercice: exercice({ statut: 'Préparation' }), provisions: [] })
    expect(sansProvision.regularisation.totalProvisionsCentimes).toBe(0)
    expect(sansProvision.regularisation.totalDepensesCentimes).toBe(depenses.parCle.reduce((s, d) => s + d.centimes, 0))
  })

  it('quatre lignes génériques Date · Alpha · Entier · Réel, relues à l’identique', () => {
    const p = parametres()
    const lignes = parametresVersLignes(p)
    expect(lignes).toEqual([
      { date: '2025-01-01', alpha: 'TILL', entier: null, reel: null },
      { date: '2025-12-31', alpha: 'Répartition des dépenses', entier: null, reel: null },
      { date: '2026-02-01', alpha: null, entier: 1, reel: null },
      { date: '2026-02-16', alpha: null, entier: 15, reel: null },
    ])
    expect(lireParametresRepartition(lignes)).toEqual(p)
    const fixee = parametres({ exigibilite: { date: '2026-04-01' } })
    expect(parametresVersLignes(fixee)[3]).toEqual({ date: '2026-04-01', alpha: null, entier: null, reel: null })
    expect(lireParametresRepartition(parametresVersLignes(fixee))).toEqual(fixee)
    expect(() => lireParametresRepartition(lignes.slice(0, 3))).toThrow(/quatre/i)
    expect(() => lireParametresRepartition([lignes[0], lignes[1], { ...lignes[2], date: null }, lignes[3]])).toThrow(/passage/i)
  })

  it('refuse des lignes qui ne sont pas celles d’une répartition : libellé, entier, cases vides, délai incohérent', () => {
    const lignes = parametresVersLignes(parametres())
    const etrangeres = [
      { date: '2025-01-01', alpha: 'X', entier: 9, reel: 3.5 },
      { date: '2025-12-31', alpha: 'Autre chose', entier: 7, reel: null },
      { date: '2026-01-10', alpha: 'Z', entier: 42, reel: null },
      { date: '2026-01-25', alpha: 'W', entier: null, reel: 1 },
    ]
    expect(() => lireParametresRepartition(etrangeres)).toThrow(/ligne 1, entier 9 au lieu de vide.*pas les lignes d'une répartition/)
    expect(() => lireParametresRepartition([lignes[0], { ...lignes[1], alpha: 'Autre' }, lignes[2], lignes[3]])).toThrow(
      /ligne 2, alpha « Autre » au lieu de « Répartition des dépenses »/,
    )
    expect(() => lireParametresRepartition([lignes[0], lignes[1], { ...lignes[2], entier: 7 }, lignes[3]])).toThrow(/ligne 3, entier 7 au lieu de 1/)
    expect(() => lireParametresRepartition([{ ...lignes[0], reel: 3.5 }, lignes[1], lignes[2], lignes[3]])).toThrow(/ligne 1, reel 3\.5/)
    expect(() => lireParametresRepartition([lignes[0], lignes[1], { ...lignes[2], alpha: 'Z' }, lignes[3]])).toThrow(/ligne 3, alpha/)
    expect(() => lireParametresRepartition([lignes[0], lignes[1], lignes[2], { ...lignes[3], alpha: 'W' }])).toThrow(/ligne 4, alpha/)
    expect(() => lireParametresRepartition([lignes[0], lignes[1], lignes[2], { ...lignes[3], entier: 30 }])).toThrow(/délai/i)
  })
})

describe('données : provisions des avis et dépenses à répartir', () => {
  const sommeProvisions = (liste: typeof provisions) => liste.reduce((s, p) => s + p.centimes, 0)

  it('provisions « budget » exigibles dans l’exercice, par lot et par clé (ni 2024, ni travaux)', () => {
    const parLot = (lotId: string, cle: string) => sommeProvisions(provisions.filter((p) => p.lotId === lotId && p.cle === cle))
    expect(parLot('lot-1', '001')).toBe(33_300)
    expect(parLot('lot-3', '001')).toBe(33_400)
    expect(parLot('lot-2', '002')).toBe(20_000)
    expect(sommeProvisions(provisions)).toBe(140_000)
  })

  it('avec l’échéancier, seules les échéances « Appelé » comptent (un appel annulé n’est pas une provision)', () => {
    const suivi = echeances.map((e) => ({ id: e.id, statut: e.id === 'b001-3' ? ('Annulé' as const) : ('Appelé' as const) }))
    expect(sommeProvisions(provisionsDepuisAvis([avis], { ...BORNES, suivi }))).toBe(115_000)
    expect(sommeProvisions(provisionsDepuisAvis([avis], { ...BORNES, suivi: [] }))).toBe(0)
  })

  it('une échéance retenue présente dans deux avis est refusée (elle compterait deux fois) ; des avis disjoints s’additionnent', () => {
    expect(() => provisionsDepuisAvis([avis, avis], BORNES)).toThrow(/échéance b00\d-\d présente dans deux avis/)
    const appelees = echeances.map((e) => ({ id: e.id, statut: 'Appelé' as const }))
    expect(() => provisionsDepuisAvis([avis, avis], { ...BORNES, suivi: appelees })).toThrow(/deux avis/)
    const avisDe = (garder: (e: EcheanceAppel) => boolean) => avisDAppel({ echeances: echeances.filter(garder), cles, positions, comptes })
    const premier = avisDe((e) => e.exigibilite < '2025-04-01')
    const suivants = avisDe((e) => e.exigibilite >= '2025-04-01')
    expect(sommeProvisions(provisionsDepuisAvis([premier, suivants], BORNES))).toBe(140_000)
    const horsExercice = avisDe((e) => e.id === 'b001-2024')
    expect(sommeProvisions(provisionsDepuisAvis([avis, horsExercice], BORNES))).toBe(140_000)
  })

  it('dépenses par clé, débits moins crédits ; classe 67 et lignes de travaux écartées ; hors exercice ignoré', () => {
    expect(depenses.parCle).toEqual([
      { cle: '001', centimes: 89_000 },
      { cle: '002', centimes: 50_000 },
    ])
    expect(depenses.exclues.map((m) => m.compte)).toEqual(['TILL.67100.00000.0', 'TILL.61500.00007.0'])
    expect(depenses.anomalies).toEqual([])
  })

  it('une répartition antérieure et son annulation ne reviennent pas dans la base', () => {
    const ancienne = creerTraitement({
      id: 'rep-ancienne',
      famille: 'Répartition de charges',
      date: '2025-12-31',
      mouvements: [
        { compte: 'TILL.45000.00001.0', sens: 'debit', montantCentimes: 4_000 },
        { compte: 'TILL.61500.00000.0', sens: 'credit', montantCentimes: 4_000, attributs: { cle: '001', etatRepartition: 'reparti' } },
      ],
    })
    const annulation = annulerTraitement(ancienne, { id: 'rep-ancienne-ann', date: '2025-12-31' })
    expect(depensesDeLExercice([...charges, ancienne, annulation], BORNES).parCle).toEqual(depenses.parCle)
  })

  it('une charge sans clé est une anomalie', () => {
    const sansCle = creerTraitement({
      id: 'f-3',
      famille: 'Saisie de factures',
      date: '2025-03-01',
      mouvements: [
        { compte: 'TILL.61100.00000.0', sens: 'debit', montantCentimes: 500 },
        { compte: 'TILL.40100.00042.0', sens: 'credit', montantCentimes: 500 },
      ],
    })
    const attendu = [{ code: 'charge_sans_cle', cle: null, lotId: null, detail: 'TILL.61100.00000.0 (traitement f-3)' }]
    expect(depensesDepuisMouvements(sansCle.mouvements.filter((m) => m.compte.includes('.611'))).anomalies).toEqual(attendu)
    expect(depensesDeLExercice([sansCle], BORNES).anomalies).toEqual(attendu)
  })
})

describe('calcul réalisé − provisions par copropriétaire et par clé', () => {
  const entree = (surcharge: Partial<EntreeRegularisation> = {}): EntreeRegularisation => ({
    coproprieteId: COPRO,
    cles,
    provisions,
    depenses: depenses.parCle,
    positions,
    comptes,
    coproprietairesAu: '2026-02-01',
    ...surcharge,
  })

  it('quote-part au tantième par clé, provisions du lot, solde ; totaux et excédent', () => {
    const r = calculerRegularisation(entree())
    expect(r.anomalies).toEqual([])
    expect(r.decomptes.map((d) => [d.compteId, d.totalProvisionsCentimes, d.totalDepensesCentimes, d.soldeCentimes])).toEqual([
      ['cpt-A', 33_300, 29_637, -3_663],
      ['cpt-B', 53_300, 54_637, 1_337],
      ['cpt-C', 53_400, 54_726, 1_326],
    ])
    const b = r.decomptes[1]
    expect(b.lignes).toEqual([
      { lotId: 'lot-2', cle: '001', libelleCle: 'Charges communes générales', tantiemes: 333, totalTantiemes: 1000, depensesCleCentimes: 89_000, quotePartCentimes: 29_637, provisionsCentimes: 33_300, soldeCentimes: -3_663 },
      { lotId: 'lot-2', cle: '002', libelleCle: 'Ascenseur', tantiemes: 1, totalTantiemes: 2, depensesCleCentimes: 50_000, quotePartCentimes: 25_000, provisionsCentimes: 20_000, soldeCentimes: 5_000 },
    ])
    expect(r.totalProvisionsCentimes).toBe(140_000)
    expect(r.totalDepensesCentimes).toBe(139_000)
    expect(r.excedentCentimes).toBe(1_000)
    expect(r.decomptes.reduce((s, d) => s + d.soldeCentimes, 0)).toBe(-r.excedentCentimes)
  })

  it('par clé : la somme des quotes-parts égale les dépenses de la clé, au centime (T43 § 9 : réalisé − provisions)', () => {
    expect(soldesParCle(calculerRegularisation(entree()))).toEqual([
      { cle: '001', libelleCle: 'Charges communes générales', depensesCentimes: 89_000, provisionsCentimes: 100_000, soldeCentimes: -11_000 },
      { cle: '002', libelleCle: 'Ascenseur', depensesCentimes: 50_000, provisionsCentimes: 40_000, soldeCentimes: 10_000 },
    ])
  })

  it('un crédit net (produit affecté) se répartit au tantième, en négatif', () => {
    const r = calculerRegularisation(entree({ provisions: [], depenses: [{ cle: '002', centimes: -101 }] }))
    expect(r.decomptes.map((d) => d.soldeCentimes)).toEqual([-51, -50])
    expect(r.excedentCentimes).toBe(101)
  })

  it('anomalies : clé d’un autre syndicat, lot hors clé, lot sans compte, comptes multiples, écart au 701', () => {
    const autre = creerCleRepartition({ id: 'x', coproprieteId: 'autre', code: '009', libelle: 'Autre', lots: [{ lotId: 'lot-1', tantiemes: 1 }] })
    const r = calculerRegularisation(
      entree({
        cles: [...cles, autre],
        depenses: [...depenses.parCle, { cle: '009', centimes: 100 }],
        provisions: [...provisions, { lotId: 'lot-1', cle: '002', centimes: 10 }],
        positions: [position('p1', 'lot-1', 'cpt-A'), position('p2', 'lot-2', 'cpt-B'), position('p2b', 'lot-2', 'cpt-D')],
        provisions701Centimes: 140_000,
      }),
    )
    expect(r.anomalies.map((a) => [a.code, a.cle, a.lotId])).toEqual([
      ['lot_hors_cle', '002', 'lot-1'],
      ['cle_inconnue', '009', null],
      ['comptes_multiples', '001', 'lot-2'],
      ['lot_sans_compte', '001', 'lot-3'],
      ['comptes_multiples', '002', 'lot-2'],
      ['lot_sans_compte', '002', 'lot-3'],
      ['ecart_provisions_701', null, null],
    ])
    expect(calculerRegularisation(entree({ provisions701Centimes: 140_000 })).anomalies).toEqual([])
  })

  /** Lot 2 démembré sous deux comptes : usufruit au compte B, nue-propriété au compte D. */
  const demembre = [
    position('p1', 'lot-1', 'cpt-A'),
    position('p3', 'lot-3', 'cpt-C'),
    creerPosition({ ...position('p2u', 'lot-2', 'cpt-B'), qualite: 'Usufruitier' }),
    creerPosition({ ...position('p2n', 'lot-2', 'cpt-D'), qualite: 'Nu propriétaire' }),
  ]

  it('J67, R106 : lot démembré sous deux comptes — rien n’est dit : refus ; sans clause de solidarité : charges courantes à l’usufruitier, à confirmer', () => {
    expect(calculerRegularisation(entree({ positions: demembre })).anomalies.map((a) => [a.code, a.cle, a.lotId])).toEqual([
      ['comptes_multiples', '001', 'lot-2'],
      ['comptes_multiples', '002', 'lot-2'],
    ])
    const usufruitier = calculerRegularisation(entree({ positions: demembre, attribution: { demembrement: { clauseSolidarite: false } } }))
    expect(usufruitier.anomalies).toEqual([])
    expect(usufruitier.decomptes.map((d) => d.compteId)).toEqual(['cpt-A', 'cpt-B', 'cpt-C'])
    expect(usufruitier.avertissements).toEqual([
      expect.objectContaining({ code: 'demembrement_usufruitier', lotId: 'lot-2', message: expect.stringMatching(/C\. civ\. art\. 605 et 608.*à confirmer/) }),
    ])
  })

  it('J67, R106 : clause de solidarité du règlement : le compte choisi par le cabinet, celui qui a reçu les provisions de l’exercice', () => {
    const clause = (comptesChoisis?: Record<string, string>) => ({ demembrement: { clauseSolidarite: true, comptesChoisis } })
    const avecClause = (comptesChoisis?: Record<string, string>, surcharge: Partial<EntreeRegularisation> = {}) =>
      calculerRegularisation(entree({ positions: demembre, attribution: clause(comptesChoisis), ...surcharge }))
    const refusDe = (motif: RegExp) => [
      expect.objectContaining({ code: 'comptes_multiples', lotId: 'lot-2', detail: expect.stringMatching(motif) }),
      expect.objectContaining({ code: 'comptes_multiples', lotId: 'lot-2' }),
    ]
    // Les provisions du lot 2 ont été appelées au compte B (usufruitier) toute l'année : chaque provision garde son compte.
    expect(provisions.filter((p) => p.lotId === 'lot-2').map((p) => p.compteId)).toEqual(Array(8).fill('cpt-B'))
    const choisi = avecClause({ 'lot-2': 'cpt-B' })
    expect(choisi.anomalies).toEqual([])
    expect(choisi.decomptes.map((d) => d.compteId)).toEqual(['cpt-A', 'cpt-B', 'cpt-C'])
    expect(choisi.avertissements).toMatchObject([{ code: 'demembrement_solidarite', lotId: 'lot-2' }])
    for (const refus of [avecClause(), avecClause({ 'lot-2': 'cpt-A' })]) expect(refus.anomalies).toEqual(refusDe(/clause de solidarité.*choisir le compte/))
    // Le compte D n'a payé aucune provision : il ne recevrait pas celles du compte B. Provisions venues de deux comptes : refus aussi.
    const provisionDeD = { lotId: 'lot-2', cle: '002', centimes: 100, compteId: 'cpt-D' }
    expect(avecClause({ 'lot-2': 'cpt-D' }).anomalies).toEqual(refusDe(/provisions de l'exercice reçues par cpt-B, compte choisi cpt-D/))
    expect(avecClause({ 'lot-2': 'cpt-B' }, { provisions: [...provisions, provisionDeD] }).anomalies).toEqual(refusDe(/plusieurs comptes \(cpt-B, cpt-D\)/))
    // Provisions sans compte connu (saisies hors des avis) : le choix du cabinet tient.
    const sansCompte = provisions.map((p) => ({ lotId: p.lotId, cle: p.cle, centimes: p.centimes }))
    expect(avecClause({ 'lot-2': 'cpt-D' }, { provisions: sansCompte }).anomalies).toEqual([])
    // L'imputation relit les mêmes comptes : le choix d'un autre compte à l'approbation est refusé.
    const projet = lancer({ positions: demembre, attribution: clause({ 'lot-2': 'cpt-B' }) })
    const approbation = { ...APPROBATION, date: '2026-02-10' }
    expect(imputerRepartition(projet, { approbation, positions: demembre }).piece.statut).toBe('Imputé')
    expect(() => imputerRepartition(projet, { approbation, positions: demembre, attribution: clause({ 'lot-2': 'cpt-D' }) })).toThrow(/lot-2/)
    expect(calculerRegularisation(entree({ positions: [...positions, position('p2b', 'lot-2', 'cpt-D')], attribution: { demembrement: { clauseSolidarite: false } } })).anomalies).toMatchObject([
      { code: 'comptes_multiples', lotId: 'lot-2' },
      { code: 'comptes_multiples', lotId: 'lot-2' },
    ])
  })

  it('J67, R106 : débiteur d’un poste du lot démembré — courant : usufruitier ; travaux : classement obligatoire, sans défaut', () => {
    expect(debiteurDemembrement({ nature: 'courant' })).toBe('usufruitier')
    expect(debiteurDemembrement({ nature: 'travaux', classement: 'grosse_reparation' })).toBe('nu_proprietaire')
    expect(debiteurDemembrement({ nature: 'travaux', classement: 'entretien' })).toBe('usufruitier')
    expect(() => debiteurDemembrement({ nature: 'travaux' })).toThrow(/classer le poste.*C\. civ\. art\. 606/)
  })

  it('J67, R111 : copropriétaire entré par donation ou succession pendant l’exercice : même règle, « par analogie, à confirmer »', () => {
    const muter = (nature: NatureMutation, date = '2026-03-01') => muterLot1(date, nature)
    const donation = calculerRegularisation(entree({ positions: muter('donation'), coproprietairesAu: '2026-03-20', ouvertureExercice: '2025-01-01' }))
    expect(donation.decomptes.map((d) => d.compteId)).toEqual(['cpt-B', 'cpt-C', 'cpt-D'])
    expect(donation.avertissements).toEqual([
      expect.objectContaining({ code: 'mutation_a_titre_gratuit', lotId: 'lot-1', message: expect.stringMatching(/par analogie, à confirmer/) }),
    ])
    expect(calculerRegularisation(entree({ positions: muter('onereuse'), coproprietairesAu: '2026-03-20' })).avertissements).toEqual([])
    expect(calculerRegularisation(entree({ positions: muter('succession'), coproprietairesAu: '2026-03-20', ouvertureExercice: '2026-04-01' })).avertissements).toEqual([])
    // Donation le jour de l'ouverture : le donateur doit la provision de ce jour (avisDAppel), le donataire reçoit le solde : signalée.
    const ouverture = calculerRegularisation(entree({ positions: muter('donation', '2025-01-01'), coproprietairesAu: '2026-03-20', ouvertureExercice: '2025-01-01' }))
    expect(ouverture.avertissements).toMatchObject([{ code: 'mutation_a_titre_gratuit', lotId: 'lot-1' }])
    // J67, R112 : mutation le jour même de l'approbation (lecture à l'approbation) : vendeur par défaut, acquéreur si l'acte précède le vote.
    const memeJour = (ordre?: 'acte_avant_vote', lectureALApprobation = true) =>
      calculerRegularisation(
        entree({ positions: muter('onereuse'), coproprietairesAu: '2026-03-01', lectureALApprobation, attribution: ordre ? { ordreMutationMemeJour: { 'lot-1': ordre } } : undefined }),
      )
    expect(memeJour().decomptes.map((d) => d.compteId)).toEqual(['cpt-A', 'cpt-B', 'cpt-C'])
    expect(memeJour().avertissements).toMatchObject([{ code: 'mutation_meme_jour', lotId: 'lot-1' }])
    expect(memeJour('acte_avant_vote').decomptes.map((d) => d.compteId)).toEqual(['cpt-B', 'cpt-C', 'cpt-D'])
    expect(memeJour('acte_avant_vote').avertissements).toEqual([])
    // Lecture à une autre date que l'approbation (date de passage) : l'acquéreur en place ce jour-là, sans la règle du même jour.
    expect(memeJour(undefined, false).decomptes.map((d) => d.compteId)).toEqual(['cpt-B', 'cpt-C', 'cpt-D'])
    expect(memeJour(undefined, false).avertissements).toEqual([])
  })

  it('refuse des centimes non entiers ou une provision négative', () => {
    expect(() => calculerRegularisation(entree({ provisions: [{ lotId: 'lot-1', cle: '001', centimes: -1 }] }))).toThrow(/provision/i)
    expect(() => calculerRegularisation(entree({ depenses: [{ cle: '001', centimes: 1.5 }] }))).toThrow(/dépense/i)
    expect(() => calculerRegularisation(entree({ coproprietairesAu: '20/03/2026' }))).toThrow(/date/i)
  })
})

describe('écriture : remboursement et répartition par 450, passage par le 471, solde au 701', () => {
  it('datée de la clôture, famille « Répartition de charges », 471 soldé, 701 débité de l’excédent', () => {
    const rep = lancer()
    const t = rep.piece.traitement
    expect(t.date).toBe('2025-12-31')
    expect(t.famille).toBe('Répartition de charges')
    expect(t.mouvements.filter((m) => m.compte === 'TILL.45000.00002.0').map((m) => [m.sens, m.montantCentimes])).toEqual([
      ['credit', 53_300],
      ['debit', 54_637],
    ])
    expect(totalSur(t, 'TILL.47100.00000.0')).toBe(0)
    expect(t.mouvements.filter((m) => m.compte === 'TILL.47100.00000.0').map((m) => [m.sens, m.montantCentimes])).toEqual([
      ['debit', 140_000],
      ['credit', 139_000],
      ['credit', 1_000],
    ])
    expect(totalSur(t, 'TILL.70100.00000.0')).toBe(1_000)
    expect(totalSur(t, 'TILL.45000.00001.0')).toBe(-3_663)
    expect(t.mouvements.every((m) => m.origine?.type === 'repartition' && m.origine.repartitionId === 'rep-2025')).toBe(true)
    expect(t.mouvements.find((m) => m.compte === 'TILL.45000.00003.0')?.liens).toEqual({ compteCoproprietaireId: 'cpt-C' })
  })

  it('J67, R104 : sous-comptes du 450 créés par l’AG : remboursement et répartition au 450-1, le 471 reste soldé', () => {
    const sousComptes450 = { decision: 'AG du 12/05/2024, résolution 9 (fictive)', planBudget: '45010' }
    const t = lancerRepartition(saisie(), { ...OPTIONS, sousComptes450 }).piece.traitement
    expect(t.mouvements.filter((m) => m.compte.includes('.45000.'))).toEqual([])
    expect(totalSur(t, 'TILL.45010.00001.0')).toBe(-3_663)
    expect(totalSur(t, 'TILL.47100.00000.0')).toBe(0)
    expect(() => lancerRepartition(saisie(), { ...OPTIONS, sousComptes450: { ...sousComptes450, planBudget: '45000' } })).toThrow(/450-1/)
  })

  it('insuffisance : le 701 est crédité, le 471 reste soldé', () => {
    const rep = lancer({ depenses: [{ cle: '001', centimes: 150_000 }] })
    expect(rep.regularisation.excedentCentimes).toBe(-10_000)
    expect(totalSur(rep.piece.traitement, 'TILL.70100.00000.0')).toBe(-10_000)
    expect(totalSur(rep.piece.traitement, 'TILL.47100.00000.0')).toBe(0)
  })

  it('refuse une régularisation à anomalies, vide, ou couverte par l’arrêté des comptes', () => {
    const p = parametresRepartition({ exercice: exercice(), dateEffet: '2026-02-01', mandatCode: 'TILL', exigibilite: QUINZE_JOURS })
    const base = { coproprieteId: COPRO, cles, positions, comptes, coproprietairesAu: '2026-02-01' }
    const vide = calculerRegularisation({ ...base, provisions: [], depenses: [] })
    expect(() => traitementRegularisation(vide, p, { id: 'r', segmentSyndicat: SEGMENT, comptes })).toThrow(/ni provision/i)
    const anormale = calculerRegularisation({ ...base, provisions, depenses: [{ cle: '777', centimes: 1 }] })
    expect(() => traitementRegularisation(anormale, p, { id: 'r', segmentSyndicat: SEGMENT, comptes })).toThrow(/anomalie/i)
    expect(() => lancer({ depenses: [{ cle: '777', centimes: 1 }] })).toThrow(/cle_inconnue 777/)
    expect(() => lancerRepartition(saisie(), { ...OPTIONS, verrou: [borneArreteDesComptes({ nom: '2025', cloture: '2025-12-31' })] })).toThrow(/verrouillée/i)
  })
})

describe('pièce : Enregistré → Imputé, ou Annulé tant que non imputée', () => {
  it('lancée au statut « Enregistré », paramètres typés relus sur la pièce, décompte « projet »', () => {
    const rep = lancer()
    expect(rep.piece.statut).toBe('Enregistré')
    expect(rep.piece.numero).toBe(120_500)
    expect(rep.piece.coproprieteId).toBe(COPRO)
    expect(rep.segmentSyndicat).toBe(SEGMENT)
    expect(lireParametresRepartition(rep.piece.parametres)).toEqual(rep.parametres)
    expect(etatDecompte(rep)).toBe('projet')
    expect(() => appelsRegularisation(rep)).toThrow(/projet/i)
    expect(() => postesRegularisation(rep)).toThrow(/projet/i)
  })

  it('une seule répartition active par exercice : la seconde est refusée tant que la première n’est pas annulée', () => {
    const rep = lancer()
    const bornes = { coproprieteId: COPRO, du: '2025-01-01', au: '2025-12-31' }
    expect(repartitionActive([rep.piece], bornes)).toBe(rep.piece)
    expect(repartitionActive([rep.piece], { ...bornes, coproprieteId: 'autre' })).toBeNull()
    expect(repartitionActive([rep.piece], { ...bornes, du: '2024-01-01', au: '2024-12-31' })).toBeNull()
    expect(() => lancer({ repartitionsExistantes: [rep.piece] })).toThrow(/120500.*active/)
    const { repartition, annulation } = annulerRepartition(rep, ANNULATION)
    expect(repartitionActive([repartition.piece, annulation], bornes)).toBeNull()
    expect(lancerRepartition(saisie({ repartitionsExistantes: [repartition.piece, annulation] }), { ...OPTIONS, id: 'rep-2025-b', numero: 120_502 }).piece.statut).toBe(
      'Enregistré',
    )
  })

  it('annulation d’une pièce enregistrée : statut « Annulé », pièce d’annulation datée de la clôture', () => {
    const rep = lancer()
    const { repartition, annulation } = annulerRepartition(rep, ANNULATION)
    expect(repartition.piece).toMatchObject({ statut: 'Annulé', annuleePar: 'ann-1' })
    expect(rep.piece.statut).toBe('Enregistré')
    expect(etatDecompte(repartition)).toBe('annule')
    expect(annulation).toMatchObject({ numero: 120_501, famille: 'Annulation répartition de charges', date: '2025-12-31', mandatId: 'mandat-2026' })
    expect(annulation.traitement.annule).toBe('rep-2025')
    expect(totalSur(annulation.traitement, 'TILL.70100.00000.0')).toBe(-1_000)
    expect(annulerRepartition(rep, { ...ANNULATION, date: '2025-12-31', mandatId: 'mandat-2027' }).annulation).toMatchObject({ date: '2025-12-31', mandatId: 'mandat-2027' })
    expect(() => annulerRepartition(repartition, { id: 'ann-2', numero: 120_503, dateEffet: '2026-02-01' })).toThrow(/déjà annulée/i)
    expect(() => imputerRepartition(repartition, { approbation: APPROBATION, positions })).toThrow(/annulée/i)
  })

  it('annulation : jamais datée avant la répartition qu’elle contre-passe, jamais sous l’identifiant de la répartition', () => {
    const rep = lancer()
    expect(() => annulerRepartition(rep, { ...ANNULATION, date: '2025-01-01' })).toThrow(/01\/01\/2025.*antérieure.*31\/12\/2025/)
    expect(() => annulerRepartition(rep, { ...ANNULATION, id: 'rep-2025' })).toThrow(/propre identifiant/)
    expect(() => annulerRepartition(rep, { ...ANNULATION, id: '' })).toThrow(/identifiant/)
  })

  it('annulation datée de la clôture, jamais après : l’exercice clos ne garde que la répartition relancée (décret n° 2005-240 art. 5)', () => {
    const rep = lancer()
    expect(() => annulerRepartition(rep, { ...ANNULATION, date: '2026-02-02' })).toThrow(/02\/02\/2026.*postérieure.*clôture.*31\/12\/2025.*art\. 5/)
    expect(() => annulerRepartition(rep, { ...ANNULATION, date: '2026-01-01' })).toThrow(/postérieure.*clôture/)
    const { repartition, annulation } = annulerRepartition(rep, ANNULATION)
    const relancee = lancerRepartition(saisie({ repartitionsExistantes: [repartition.piece, annulation] }), { ...OPTIONS, id: 'rep-2025-b', numero: 120_502 })
    expect([rep.piece.date, annulation.date, relancee.piece.date]).toEqual(['2025-12-31', '2025-12-31', '2025-12-31'])
    const mouvementsClos = [rep.piece.traitement, annulation.traitement, relancee.piece.traitement]
      .filter((t) => t.date <= '2025-12-31')
      .flatMap((t) => t.mouvements)
    const soldeClos = (compte: string) =>
      mouvementsClos.filter((m) => m.compte === compte).reduce((s, m) => s + (m.sens === 'debit' ? m.montantCentimes : -m.montantCentimes), 0)
    expect(soldeClos('TILL.45000.00001.0')).toBe(totalSur(relancee.piece.traitement, 'TILL.45000.00001.0'))
    expect(soldeClos('TILL.70100.00000.0')).toBe(totalSur(relancee.piece.traitement, 'TILL.70100.00000.0'))
    expect(soldeClos('TILL.70100.00000.0')).not.toBe(0)
  })

  it('voie générique annulerPiece : la pièce d’une répartition s’annule à la clôture, jamais après (exercice clos sans doublon)', () => {
    const rep = lancer()
    const generique = { id: 'ann-1', numero: 120_501, segmentSyndicat: SEGMENT, dateEffet: '2026-02-02' }
    expect(() => annulerPiece(rep.piece, { ...generique, date: '2026-02-02' })).toThrow(/02\/02\/2026.*postérieure.*clôture.*31\/12\/2025.*art\. 5/)
    expect(() => annulerPiece(rep.piece, { ...generique, date: '2026-01-01' })).toThrow(/postérieure.*clôture/)
    const { piece, annulation } = annulerPiece(rep.piece, { ...generique, date: '2025-12-31' })
    expect(annulation).toMatchObject({ date: '2025-12-31', famille: 'Annulation répartition de charges' })
    const relancee = lancerRepartition(saisie({ dateEffet: '2026-02-02', repartitionsExistantes: [piece, annulation] }), {
      ...OPTIONS,
      id: 'rep-2025-b',
      numero: 120_502,
    })
    const clos = [rep.piece.traitement, annulation.traitement, relancee.piece.traitement].filter((t) => t.date <= '2025-12-31')
    const soldeClos = (compte: string) => clos.reduce((s, t) => s + totalSur(t, compte), 0)
    expect(clos).toHaveLength(3)
    expect(soldeClos('TILL.45000.00001.0')).toBe(totalSur(relancee.piece.traitement, 'TILL.45000.00001.0'))
    expect(soldeClos('TILL.70100.00000.0')).toBe(totalSur(relancee.piece.traitement, 'TILL.70100.00000.0'))
  })

  it('le jour de l’annulation est sa date d’effet : date comptable à la clôture, date d’effet en paramètre de la pièce', () => {
    const rep = lancer()
    const { repartition, annulation } = annulerRepartition(rep, { ...ANNULATION, dateEffet: '2026-03-01' })
    expect(annulation.date).toBe('2025-12-31')
    expect(annulation.traitement.date).toBe('2025-12-31')
    expect(annulation.parametres).toEqual([{ date: '2026-03-01', alpha: null, entier: null, reel: null }])
    expect(dateEffetPiece(annulation)).toBe('2026-03-01')
    expect(dateEffetPiece(rep.piece)).toBe('2026-02-01')
    expect(dateEffetPiece(repartition.piece)).toBe('2026-02-01')
    const sansEffet = { id: 'ann-1', numero: 120_501 } as Parameters<typeof annulerRepartition>[1]
    expect(() => annulerRepartition(rep, sansEffet)).toThrow(/date d'effet attendue/)
    expect(() => annulerRepartition(rep, { ...ANNULATION, dateEffet: '01/03/2026' })).toThrow(/date d'effet.*invalide/i)
    expect(() => annulerRepartition(rep, { ...ANNULATION, dateEffet: '2026-01-31' })).toThrow(/31\/01\/2026.*antérieure.*01\/02\/2026/)
    expect(() => annulerRepartition(rep, { ...ANNULATION, date: '2026-03-01' })).toThrow(/jour de l'annulation.*date d'effet/)
  })

  it('on annule avant de relancer : la relance n’est pas passée avant la date d’effet de l’annulation (même jour admis)', () => {
    const { repartition, annulation } = annulerRepartition(lancer(), { ...ANNULATION, dateEffet: '2026-03-01' })
    const relancer = (dateEffet: string, existantes = [repartition.piece, annulation]) =>
      lancerRepartition(saisie({ dateEffet, repartitionsExistantes: existantes }), { ...OPTIONS, id: 'rep-2025-b', numero: 120_502 })
    expect(() => relancer('2026-02-28')).toThrow(/28\/02\/2026.*120501.*01\/03\/2026/)
    expect(relancer('2026-03-01').piece.statut).toBe('Enregistré')
    expect(() => relancer('2026-03-01', [repartition.piece])).toThrow(/120500.*pièce d'annulation.*absente/)
  })

  it('imputation après l’approbation : décompte définitif ; une pièce imputée ne s’annule plus', () => {
    const imputee = imputerRepartition(lancer(), { approbation: { ...APPROBATION, date: '2026-02-10' }, positions })
    expect(imputee.piece.statut).toBe('Imputé')
    expect(imputee.approbation).toEqual({ date: '2026-02-10', reference: 'AG du 20/03/2026, résolution 3' })
    expect(etatDecompte(imputee)).toBe('definitif')
    expect(() => annulerRepartition(imputee, { id: 'ann-3', numero: 120_504, dateEffet: '2026-02-11' })).toThrow(/imputée ne s'annule plus/i)
    expect(() => imputerRepartition(imputee, { approbation: APPROBATION, positions })).toThrow(/statut/i)
  })

  it('refuse une approbation sans référence, antérieure à la clôture, ou postérieure à l’exigibilité', () => {
    const rep = lancer()
    expect(() => imputerRepartition(rep, { approbation: { date: '2026-02-10', reference: ' ' }, positions })).toThrow(/référence/i)
    expect(() => imputerRepartition(rep, { approbation: { date: '2025-12-31', reference: 'AG' }, positions })).toThrow(/clos/i)
    expect(() => imputerRepartition(rep, { approbation: APPROBATION, positions })).toThrow(/45-1/)
  })

  it('approbation tirée de la décision annuelle (assemblée ou administrateur provisoire)', () => {
    const decision = (surcharge: Partial<Parameters<typeof creerDecisionAnnuelle>[0]> = {}) =>
      creerDecisionAnnuelle({
        id: 'dec-1',
        coproprieteId: COPRO,
        type: 'approbation_comptes',
        date: '2026-03-20',
        source: { origine: 'assemblee', agId: 'ag-2026', resolutionId: 'res-3' },
        exerciceId: 'ex-2025',
        ...surcharge,
      })
    expect(approbationDepuisDecision(decision(), { coproprieteId: COPRO })).toEqual({ date: '2026-03-20', reference: 'assemblée ag-2026, résolution res-3' })
    expect(
      approbationDepuisDecision(decision({ source: { origine: 'administrateur', reference: 'Décision n° 4' } }), { coproprieteId: COPRO, exerciceId: 'ex-2025' }),
    ).toEqual({ date: '2026-03-20', reference: "décision de l'administrateur provisoire : Décision n° 4" })
    expect(() => approbationDepuisDecision(decision({ type: 'budget', montantCentimes: 140_000 }), { coproprieteId: COPRO })).toThrow(
      /approbation des comptes attendue/i,
    )
    expect(() => approbationDepuisDecision(decision(), { coproprieteId: 'autre' })).toThrow(/syndicat/i)
    expect(() => approbationDepuisDecision(decision(), { coproprieteId: COPRO, exerciceId: 'ex-2024' })).toThrow(/exercice/i)
  })

  it('D. 1967 art. 6-2, 3° : lot vendu avant l’approbation → imputation refusée ; relancée au copropriétaire de l’approbation', () => {
    const vente = muterLot1('2026-03-01')
    const tardive = { date: '2026-04-15' }
    const avant = lancer({ positions: vente, exigibilite: tardive })
    expect(avant.regularisation.decomptes[0].compteId).toBe('cpt-A')
    expect(() => imputerRepartition(avant, { approbation: APPROBATION, positions: vente })).toThrow(
      /lot-1.*D\. 1967 art\. 6-2, 3° pour une mutation à titre onéreux ; art\. 45-1 pour une autre mutation/,
    )
    const { repartition: annulee, annulation } = annulerRepartition(avant, ANNULATION)
    expect(annulee.piece.statut).toBe('Annulé')
    const relancee = lancerRepartition(
      saisie({ positions: vente, exigibilite: tardive, coproprietairesAu: APPROBATION.date, repartitionsExistantes: [annulee.piece, annulation] }),
      { ...OPTIONS, id: 'rep-2025-b', numero: 120_502 },
    )
    expect(relancee.regularisation.decomptes.map((d) => d.compteId)).toEqual(['cpt-B', 'cpt-C', 'cpt-D'])
    expect(relancee.regularisation.decomptes[2].soldeCentimes).toBe(-3_663)
    expect(imputerRepartition(relancee, { approbation: APPROBATION, positions: vente }).piece.statut).toBe('Imputé')
  })

  it('J67, R112 : lot vendu le jour de l’approbation — ordre de l’acte et du vote fourni, sinon vendeur avec « même jour : à confirmer »', () => {
    const memeJour = muterLot1(APPROBATION.date, 'onereuse')
    const tardive = { date: '2026-04-15' }
    const projet = lancer({ positions: memeJour, exigibilite: tardive })
    const imputer = (ordre?: 'acte_avant_vote' | 'acte_apres_vote') =>
      imputerRepartition(projet, { approbation: APPROBATION, positions: memeJour, attribution: ordre ? { ordreMutationMemeJour: { 'lot-1': ordre } } : undefined })
    const parDefaut = imputer()
    expect(parDefaut.piece.statut).toBe('Imputé')
    expect(parDefaut.avertissements).toEqual([
      expect.objectContaining({ code: 'mutation_meme_jour', lotId: 'lot-1', message: expect.stringMatching(/même jour : à confirmer/) }),
    ])
    expect(imputer('acte_apres_vote').avertissements).toEqual([])
    expect(() => imputer('acte_avant_vote')).toThrow(/lot-1/)
    // Lot vendu le jour de la date de passage : le projet, lu ce jour-là, va à l'acquéreur, sans la règle du même jour ;
    // l'imputation à l'approbation plus tardive passe.
    const venteAuPassage = muterLot1('2026-02-01', 'onereuse')
    const projetAuPassage = lancer({ positions: venteAuPassage, exigibilite: tardive })
    expect(projetAuPassage.regularisation.decomptes.map((d) => d.compteId)).toEqual(['cpt-B', 'cpt-C', 'cpt-D'])
    expect(projetAuPassage.avertissements).toEqual([])
    expect(imputerRepartition(projetAuPassage, { approbation: APPROBATION, positions: venteAuPassage }).piece.statut).toBe('Imputé')
    // Lecture déclarée à l'approbation (coproprietairesAu = approbation) : la règle du même jour s'applique dès le projet.
    const projetALApprobation = lancer({ positions: memeJour, exigibilite: tardive, coproprietairesAu: APPROBATION.date, lectureALApprobation: true })
    expect(projetALApprobation.regularisation.decomptes.map((d) => d.compteId)).toEqual(['cpt-A', 'cpt-B', 'cpt-C'])
    expect(projetALApprobation.avertissements).toMatchObject([{ code: 'mutation_meme_jour', lotId: 'lot-1' }])
  })

  it('statut de l’exercice après la répartition : « Répart. en cours », puis « Réparti » à l’imputation', () => {
    expect(statutExerciceApresRepartition('Enregistré')).toBe('Répart. en cours')
    expect(statutExerciceApresRepartition('Annulé')).toBe('Répart. en cours')
    expect(statutExerciceApresRepartition('Imputé')).toBe('Réparti')
    expect(() => statutExerciceApresRepartition('Produit')).toThrow(/répartition/i)
    const enCours = changerStatutExercice(exercice(), statutExerciceApresRepartition('Enregistré'))
    expect(changerStatutExercice(enCours, statutExerciceApresRepartition('Imputé')).statut).toBe('Réparti')
    expect(() => changerStatutPiece(lancer().piece, 'Annulé')).toThrow(/annulerPiece/)
  })
})

describe('décompte individuel et appel de régularisation', () => {
  const imputee = () => imputerRepartition(lancer(), { approbation: { ...APPROBATION, date: '2026-02-10' }, positions })

  it('décomptes : état, bornes, exigibilité et sa justification (règle de gestion), libellés observés', () => {
    const [a] = decomptesIndividuels(lancer())
    expect(a).toMatchObject({ compteId: 'cpt-A', etat: 'projet', du: '2025-01-01', au: '2025-12-31', exigibilite: '2026-02-16', soldeCentimes: -3_663 })
    expect(a.justificationExigibilite).toMatch(
      /délai de 15 jour\(s\) après la date de passage du 01\/02\/2026, retenu par le gestionnaire \(valeur observée chez Gestéam\) — aucun texte.*\(contrôlé à l'imputation\)/,
    )
    expect(a.libelles).toEqual({ remboursement: 'Remboursement de provisions 2025', repartition: 'Répartition des dépenses 2025' })
  })

  it('la justification suit l’origine réelle de l’exigibilité jusque dans le décompte et l’appel, approbation comprise', () => {
    const [fixee] = decomptesIndividuels(lancer({ exigibilite: { date: '2026-05-15' } }))
    expect(fixee.justificationExigibilite).toMatch(/^Solde exigible le 15\/05\/2026 : date fixée par le gestionnaire, 103 jour\(s\)/)
    expect(fixee.justificationExigibilite).not.toMatch(/Gestéam|quinze/)
    const [trente] = decomptesIndividuels(lancer({ exigibilite: { delaiJours: 30 } }))
    expect(trente.justificationExigibilite).toMatch(/délai de 30 jour\(s\).*retenu par le gestionnaire — aucun texte/)
    expect(trente.justificationExigibilite).not.toMatch(/Gestéam|quinze/)
    const [appel] = appelsRegularisation(imputee())
    expect(appel.justificationExigibilite).toMatch(/pas avant l'approbation des comptes du 10\/02\/2026, le solde définitif/)
  })

  it('appels après imputation : sens du solde, solde antérieur repris', () => {
    const appels = appelsRegularisation(imputee(), { soldesAnterieurs: { 'cpt-B': 2_000 } })
    expect(appels.map((x) => [x.compteId, x.sens, x.soldeCentimes, x.soldeAnterieurCentimes, x.totalCentimes, x.exigibilite])).toEqual([
      ['cpt-A', 'a_rembourser', -3_663, 0, -3_663, '2026-02-16'],
      ['cpt-B', 'a_payer', 1_337, 2_000, 3_337, '2026-02-16'],
      ['cpt-C', 'a_payer', 1_326, 0, 1_326, '2026-02-16'],
    ])
    expect(sensDuSolde(0)).toBe('nul')
  })

  it('poste de dette du solde dû (sans appel d’origine, imputable, au compte du budget : J67, R104) ; l’excédent reste au crédit du 450', () => {
    const postes = postesRegularisation(imputee())
    const commun = { appelId: null, typeAppel: null, libelle: 'Régularisation des charges 2025', exigibilite: '2026-02-16', regleCentimes: 0, contentieux: false, compteBudget: true }
    expect(postes).toEqual([
      { id: 'rep-2025:cpt-B', compteId: 'cpt-B', montantCentimes: 1_337, ...commun },
      { id: 'rep-2025:cpt-C', compteId: 'cpt-C', montantCentimes: 1_326, ...commun },
    ])
    expect(postesImputables(postes, [])).toEqual(postes)
  })
})

describe('en-tête et commentaires du module : citations et marqueurs', () => {
  const SOURCE = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'regularisation-charges.ts'), 'utf8').replaceAll(
    /\r?\n\s*\*\s*/g,
    ' ',
  )
  const EN_TETE = SOURCE.slice(0, SOURCE.indexOf('*/'))

  it('L. 1965 art. 14-3 : l’enregistrement dès l’engagement juridique est à l’al. 2', () => {
    expect(EN_TETE).toContain(
      'art. 14-3, al. 2 : charges et produits « enregistrés dès leur engagement juridique par le syndic indépendamment de leur règlement »',
    )
    expect(EN_TETE).not.toMatch(/14-3, al\. 1/)
  })

  it('D. 1967 art. 6-2 cité avec son chapeau ; hors vente, la règle est déduite de l’art. 45-1, appliquée par analogie (J67, R111)', () => {
    expect(EN_TETE).toContain("D. 1967 art. 6-2 : « A l'occasion de la mutation à titre onéreux d'un lot : […] 3° Le trop ou moins perçu sur provisions")
    expect(EN_TETE).toMatch(/🔵 Déduit :.*autre mutation \(succession, donation\).*art\. 45-1/)
    expect(EN_TETE).toMatch(/J67, R111.*« par analogie, à confirmer ».*démembrement.*R106/)
  })

  it('J67 : questions tranchées retirées des 🔴 (R102 à R106, R111, R112) ; la marque « annexes non lues » reste (R105)', () => {
    const ouvert = EN_TETE.slice(EN_TETE.indexOf('🔴 Non établi'), EN_TETE.indexOf('Branchements à faire'))
    for (const tranchee of [
      /Le solde de régularisation peut-il être exigible avant l'approbation/,
      /Lot vendu le jour même de l'approbation/,
      /Sous-compte 450-1/,
      /dont le budget n'a pas été voté/,
      /solde-t-elle aussi les comptes de charges/,
      /Usufruit et nue-propriété/,
      /Mutation à titre gratuit/,
    ])
      expect(ouvert).not.toMatch(tranchee)
    expect(ouvert).toMatch(/Faut-il proposer quinze jours après la date de passage/)
    for (const n of ['R102', 'R103', 'R104', 'R105', 'R106', 'R111', 'R112']) expect(EN_TETE).toContain(`J67, ${n}`)
    // R103 : le cycle de l'exercice aboutit désormais (exercices-budgets.changerStatutExercice) ; plus rien « à revoir ».
    expect(EN_TETE).not.toMatch(/à revoir dans exercices-budgets\.ts/)
    expect(EN_TETE).toMatch(/J67, R103.*« Répart\. en cours », puis « Réparti »/)
    expect(EN_TETE).toMatch(/Annexes 1 à 5 du décret n° 2005-240.*non lues/)
  })

  it('tranche 37 : seul « À répartir » est relevé ; « Réparti » est la valeur VitFix (🔵)', () => {
    expect(EN_TETE).not.toMatch(/À répartir \/ Réparti/)
    expect(EN_TETE).toMatch(/🟢.*tranche 37 : état « À répartir » des mouvements/)
    expect(EN_TETE).toMatch(/🔵 Déduit :.*« Réparti », état VitFix d'un mouvement réparti \(traitements\.ETATS_REPARTITION\), non relevé chez Gestéam/)
  })

  it('suivi-a-faire : l’alerte « exercice clos non réparti » existe déjà (depuisExercices), rien à y brancher', () => {
    expect(EN_TETE).not.toMatch(/qui pourra lire repartitionActive/)
    expect(EN_TETE).toMatch(/suivi-a-faire\.depuisExercices.*repartition_en_retard/)
  })

  it('postesRegularisation : le solde définitif résulte de l’approbation (art. 45-1) ; J3 ne règle que l’éligibilité au 19-2', () => {
    expect(SOURCE).not.toMatch(/J3 : un solde n'est dû qu'après l'approbation/)
    expect(SOURCE).toContain("(D. 1967 art. 45-1 : le solde définitif résulte de l'approbation ; J3 : éligibilité au 19-2 après l'approbation)")
  })
})
