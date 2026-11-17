import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  enregistrerEncaissement,
  enregistrerRecette,
  mouvementsRecette,
  rapprocherEncaissements,
  rattacherRemise,
  traitementEncaissements,
  type JournalEncaissement,
  type SaisieRecette,
} from '@/lib/administrateur-judiciaire/domain/encaissements-pieces'
import { creerCompteCoproprietaire } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  imputerEncaissement,
  imputerEncaissements,
  type Encaissement,
  type PosteDette,
} from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { creerPieceTraitement } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import { creerRemiseCheques } from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import type { ArreteRapprochement, ElementRapprochement, PieceRapprochee } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import { annulerTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Encaissements : n° de pièce, journal de banque, statut (Enregistré → Rapproché, propagé depuis l'arrêté comme au
 * point 38), état imputé et traitement ; recettes hors copropriétaires (point 16 du bilan 2 ; Gestéam, tranche 30
 * § Encaissements : N° pièce · Mode · Jo(urnal) · Statut, crédit du 450 mais aussi des 47x et 7xx ; tranche 43 § 2 :
 * statut Rapproché, état Imputé, Journal, Cpte encais. (512), pièce : mode · N° · Banque · Détenteur · Libellé,
 * Traitement).
 */

const SEGMENT = 'TILL'
const JOURNAL: JournalEncaissement = { code: 'BA', banqueId: 'b-courant', compteEncaissement: 'TILL.51200.00000.0' }
const comptes = [
  creerCompteCoproprietaire({ id: 'cpt-A', coproprieteId: 'copro-1', serie: '1', libelle: 'A' }),
  creerCompteCoproprietaire({ id: 'cpt-B', coproprieteId: 'copro-1', serie: '2', libelle: 'B' }),
]
const poste = (id: string, compteId: string, montantCentimes: number): PosteDette => ({
  id,
  compteId,
  appelId: id.split(':')[0],
  typeAppel: 'Budget',
  libelle: 'Appel de provisions',
  exigibilite: '2026-01-01',
  montantCentimes,
  regleCentimes: 0,
  contentieux: false,
})
const POSTES = [poste('B1:lot-1', 'cpt-A', 40_000), poste('B1:lot-2', 'cpt-B', 60_000)]
/** Jour des traitements des tests : les virements et la recette sont reçus ce jour-là, la remise est déposée ce jour-là. */
const JOUR = '2026-01-12'
const brut = (id: string, compteId: string, montantCentimes: number, date = JOUR): Encaissement => ({ id, compteId, date, montantCentimes })
const contexte = { journal: JOURNAL, segmentSyndicat: SEGMENT }
const virement = (id: string, compteId: string, montant: number) =>
  enregistrerEncaissement(brut(id, compteId, montant), { ...contexte, piece: { mode: 'Virement', numero: `VIR-${id}` } })
/** Chèque reçu avant le jour de sa remise. */
const cheque = (id: string, compteId: string, montant: number, numero: string, date = '2026-01-10') =>
  enregistrerEncaissement(brut(id, compteId, montant, date), { ...contexte, piece: { mode: 'Chèque', numero, banqueEmettrice: 'Banque X' } })

const SAISIE_RECETTE: SaisieRecette = {
  id: 'R1',
  date: '2026-01-12',
  montantCentimes: 125_000,
  planCode: '71300',
  tiers: 'Assureur',
  libelle: 'Indemnité dégât des eaux',
  piece: { mode: 'Virement', numero: 'REF-ASS-1' },
  journal: JOURNAL,
  liens: { sinistreId: 'sin-1' },
}

const remiseDe = (lignes: { encaissementId: string; numeroCheque: string; montantCentimes: number }[], surcharge: { id?: string; banqueId?: string } = {}) =>
  creerRemiseCheques({
    id: surcharge.id ?? 'rem-1',
    numero: `REM-${surcharge.id ?? 'rem-1'}`,
    date: JOUR,
    coproprieteId: 'copro-1',
    banqueId: surcharge.banqueId ?? 'b-courant',
    traitementId: 't-enc-1',
    lignes: lignes.map((l) => ({ ...l, tireur: 'Tireur' })),
  })

describe('enregistrement d’un encaissement : pièce et journal', () => {
  it('ajoute la pièce, le journal et le suivi sans toucher à l’encaissement (statut Enregistré, non imputé)', () => {
    const encaissement: Encaissement = { ...brut('E1', 'cpt-A', 40_000), payeur: 'Tiers payeur' }
    const e = enregistrerEncaissement(encaissement, {
      ...contexte,
      piece: { mode: 'Chèque', numero: ' 1234567 ', banqueEmettrice: ' Banque X ', libelle: '' },
    })
    expect(e).toEqual({
      ...encaissement,
      piece: { mode: 'Chèque', numero: '1234567', banqueEmettrice: 'Banque X', libelle: null, remiseId: null },
      journal: JOURNAL,
      statut: 'Enregistré',
      impute: false,
      traitementId: null,
      rapprochement: null,
    })
    expect(encaissement).not.toHaveProperty('piece')
    expect(virement('E2', 'cpt-A', 1_000).piece).toEqual({ mode: 'Virement', numero: 'VIR-E2', banqueEmettrice: null, libelle: null, remiseId: null })
  })

  it('refuse un chèque sans numéro, un mode sans encaissement, les espèces (compte 53), un mode inconnu', () => {
    const enregistrer = (piece: Parameters<typeof enregistrerEncaissement>[1]['piece']) => () =>
      enregistrerEncaissement(brut('E1', 'cpt-A', 1_000), { ...contexte, piece })
    expect(enregistrer({ mode: 'Chèque', numero: '  ' })).toThrow(/numéro du chèque/)
    expect(enregistrer({ mode: 'Pas de règlement' })).toThrow(/Pas de règlement/)
    expect(enregistrer({ mode: 'Espèces' })).toThrow(/compte 53/)
    expect(enregistrer({ mode: 'Carte' as never })).toThrow(/Mode de règlement inconnu/)
    expect(enregistrer({ mode: 'Prélèvement' })).not.toThrow()
    expect(enregistrer({ mode: 'TIP' })).not.toThrow()
  })

  it('refuse un journal sans compte bancaire ou sans code, un compte qui n’est pas un 512 du syndicat (D1)', () => {
    const enregistrer = (journal: JournalEncaissement) => () =>
      enregistrerEncaissement(brut('E1', 'cpt-A', 1_000), { journal, segmentSyndicat: SEGMENT, piece: { mode: 'Virement' } })
    expect(enregistrer({ ...JOURNAL, banqueId: ' ' })).toThrow(/compte bancaire/)
    expect(enregistrer({ ...JOURNAL, code: '' })).toThrow(/code/)
    expect(enregistrer({ ...JOURNAL, compteEncaissement: 'TILL.53000.00000.0' })).toThrow(/compte 512/)
    expect(enregistrer({ ...JOURNAL, compteEncaissement: 'AUTR.51200.00000.0' })).toThrow(/autre syndicat/)
    expect(enregistrer({ ...JOURNAL, compteEncaissement: 'TILL.51210.00000.0' })).not.toThrow()
  })

  it('refuse un montant ou une date invalides, un encaissement sans compte ou déjà enregistré', () => {
    const piece = { mode: 'Virement' } as const
    expect(() => enregistrerEncaissement(brut('E1', 'cpt-A', 0), { ...contexte, piece })).toThrow(/centimes entiers/)
    expect(() => enregistrerEncaissement(brut('E1', 'cpt-A', 10.5), { ...contexte, piece })).toThrow(/centimes entiers/)
    expect(() => enregistrerEncaissement(brut('E1', 'cpt-A', 100, '10/01/2026'), { ...contexte, piece })).toThrow(/AAAA-MM-JJ/)
    expect(() => enregistrerEncaissement(brut('E1', ' ', 100), { ...contexte, piece })).toThrow(/compte copropriétaire/)
    expect(() => enregistrerEncaissement(virement('E1', 'cpt-A', 100), { ...contexte, piece })).toThrow(/déjà enregistré/)
  })
})

describe('recettes hors copropriétaires (47x, 71x, subventions notifiées)', () => {
  it('crédite le compte du plan dans le segment du syndicat, avec ses liens ; débit du 512 du journal', () => {
    const recette = enregistrerRecette(SAISIE_RECETTE, { segmentSyndicat: SEGMENT })
    expect(recette).toEqual({
      id: 'R1',
      date: '2026-01-12',
      montantCentimes: 125_000,
      compteCredite: 'TILL.71300.00000.0',
      tiers: 'Assureur',
      libelle: 'Indemnité dégât des eaux',
      liens: { sinistreId: 'sin-1' },
      piece: { mode: 'Virement', numero: 'REF-ASS-1', banqueEmettrice: null, libelle: null, remiseId: null },
      journal: JOURNAL,
      statut: 'Enregistré',
      impute: false,
      traitementId: null,
      rapprochement: null,
    })
    expect(mouvementsRecette(recette)).toEqual([
      { compte: 'TILL.51200.00000.0', sens: 'debit', montantCentimes: 125_000 },
      { compte: 'TILL.71300.00000.0', sens: 'credit', montantCentimes: 125_000, liens: { sinistreId: 'sin-1' } },
    ])
    const attente = enregistrerRecette({ ...SAISIE_RECETTE, planCode: '47200', auxiliaire: 'VENTI', liens: undefined, tiers: undefined }, { segmentSyndicat: SEGMENT })
    expect(attente).toMatchObject({ compteCredite: 'TILL.47200.VENTI.0', tiers: null, liens: null })
    expect(mouvementsRecette(attente)[1]).not.toHaveProperty('liens')
  })

  it('admet l’attente, l’emprunt, les produits 713, 714, 716 et 718 et les subventions notifiées (441, 443)', () => {
    for (const planCode of ['47100', '47200', '71200', '71300', '71400', '71600', '71800', '44100', '44300'])
      expect(enregistrerRecette({ ...SAISIE_RECETTE, planCode }, { segmentSyndicat: SEGMENT }).compteCredite).toBe(`TILL.${planCode}.00000.0`)
  })

  it('refuse les comptes copropriétaires, les appels, les provisions, la subvention en produit, les reprises, les autres comptes', () => {
    const refuser = (planCode: string) => () => enregistrerRecette({ ...SAISIE_RECETTE, planCode }, { segmentSyndicat: SEGMENT })
    expect(refuser('45000')).toThrow(/enregistrerEncaissement/)
    expect(refuser('70100')).toThrow(/appel de fonds/)
    expect(refuser('10500')).toThrow(/compte 450/)
    expect(refuser('71100')).toThrow(/441 ou 443/)
    expect(refuser('78000')).toThrow(/sans trésorerie/)
    expect(refuser('51200')).toThrow(/non admis/)
    expect(refuser('60100')).toThrow(/non admis/)
    expect(refuser('713')).toThrow(/5 chiffres/)
  })

  it('le motif d’un compte non admis donne la liste exacte des comptes admis (ni 715, ni 717, ni 473 : arrêté du 14 mars 2005, art. 7)', () => {
    const refuser = (planCode: string) => () => enregistrerRecette({ ...SAISIE_RECETTE, planCode }, { segmentSyndicat: SEGMENT })
    for (const planCode of ['71500', '71700', '47300'])
      expect(refuser(planCode)).toThrow(
        `Compte ${planCode} refusé pour une recette hors copropriétaires : compte non admis (admis : 441, 443, 471, 472, 712, 713, 714, 716, 718).`,
      )
  })

  it('refuse un libellé vide, un auxiliaire invalide, une pièce invalide', () => {
    expect(() => enregistrerRecette({ ...SAISIE_RECETTE, libelle: ' ' }, { segmentSyndicat: SEGMENT })).toThrow(/libellé/)
    expect(() => enregistrerRecette({ ...SAISIE_RECETTE, auxiliaire: 'ab' }, { segmentSyndicat: SEGMENT })).toThrow(/auxiliaire/)
    expect(() => enregistrerRecette({ ...SAISIE_RECETTE, piece: { mode: 'Chèque' } }, { segmentSyndicat: SEGMENT })).toThrow(/numéro du chèque/)
    expect(() => enregistrerRecette(SAISIE_RECETTE, { segmentSyndicat: 'AUTR' })).toThrow(/autre syndicat/)
  })
})

describe('remise de chèques : le n° de remise s’ajoute au n° de chaque chèque', () => {
  const c1 = cheque('E1', 'cpt-A', 40_000, '0000001')
  const c2 = cheque('E2', 'cpt-B', 60_000, '0000002')
  const lignes = [
    { encaissementId: 'E1', numeroCheque: '0000001', montantCentimes: 40_000 },
    { encaissementId: 'E2', numeroCheque: '0000002', montantCentimes: 60_000 },
  ]

  it('rattache les chèques à la remise et réserve le traitement de la remise', () => {
    const rattaches = rattacherRemise([c1, c2], remiseDe(lignes))
    expect(rattaches.map((e) => [e.id, e.piece.remiseId, e.piece.numero, e.traitementId])).toEqual([
      ['E1', 'rem-1', '0000001', 't-enc-1'],
      ['E2', 'rem-1', '0000002', 't-enc-1'],
    ])
    expect(rattacherRemise(rattaches, remiseDe(lignes))).toEqual(rattaches)
  })

  it('refuse un autre numéro, un autre montant, un autre compte bancaire, un virement, une remise incomplète ou une autre remise', () => {
    expect(() => rattacherRemise([cheque('E1', 'cpt-A', 40_000, '0000009'), c2], remiseDe(lignes))).toThrow(/n° 0000009.*0000001/)
    expect(() => rattacherRemise([cheque('E1', 'cpt-A', 39_000, '0000001'), c2], remiseDe(lignes))).toThrow(/39000 centimes/)
    expect(() => rattacherRemise([c1, c2], remiseDe(lignes, { banqueId: 'b-ft' }))).toThrow(/compte bancaire/)
    expect(() => rattacherRemise([virement('E1', 'cpt-A', 40_000), c2], remiseDe(lignes))).toThrow(/seul un chèque/)
    expect(() => rattacherRemise([c1], remiseDe(lignes))).toThrow(/E2 non fourni/)
    expect(() => rattacherRemise([c1, c2, cheque('E3', 'cpt-A', 1_000, '0000003')], remiseDe(lignes))).toThrow(/E3 absent de la remise/)
    const rattaches = rattacherRemise([c1, c2], remiseDe(lignes))
    expect(() => rattacherRemise(rattaches, remiseDe(lignes, { id: 'rem-2' }))).toThrow(/déjà dans la remise rem-1/)
  })

  it('refuse une remise qui porte deux lignes pour un même encaissement, ou dont le total ou le nombre de pièces ne concorde pas', () => {
    const double = remiseDe([
      { encaissementId: 'E1', numeroCheque: '0000009', montantCentimes: 99_000 },
      { encaissementId: 'E1', numeroCheque: '0000001', montantCentimes: 40_000 },
    ])
    expect(() => rattacherRemise([c1], double)).toThrow(/Remise REM-rem-1 : encaissement E1 sur deux lignes/)
    expect(() => rattacherRemise([c1, c2], { ...remiseDe(lignes), totalCentimes: 139_000 })).toThrow(/total de 139000 centimes.*100000/)
    expect(() => rattacherRemise([c1, c2], { ...remiseDe(lignes), nombrePieces: 3 })).toThrow(/3 pièces.*2 chèques/)
  })

  it('refuse un chèque reçu après le jour de sa remise', () => {
    expect(() => rattacherRemise([cheque('E1', 'cpt-A', 40_000, '0000001', '2026-01-13'), c2], remiseDe(lignes))).toThrow(
      /chèque du 2026-01-13.*remise du 2026-01-12/,
    )
  })
})

describe('écriture des encaissements : un traitement de la famille Encaissement (R6, R7, R8)', () => {
  const options = { id: 't-enc-1', date: JOUR, segmentSyndicat: SEGMENT, comptes }

  it('débit du 512 du journal, crédit du 450 du compte (calculé, D1) par poste imputé, crédit des recettes ; rend imputés', () => {
    const e1 = virement('E1', 'cpt-A', 50_000)
    const resultat = imputerEncaissement(e1, POSTES)
    const recette = enregistrerRecette(SAISIE_RECETTE, { segmentSyndicat: SEGMENT })
    const ecrit = traitementEncaissements({ encaissements: [{ encaissement: e1, resultat }], recettes: [recette] }, { ...options, famille: 'Fichier Virement reçus' })
    expect(ecrit.traitement.famille).toBe('Fichier Virement reçus')
    expect(ecrit.traitement.mouvements.map((m) => [m.sens, m.compte, m.montantCentimes])).toEqual([
      ['debit', 'TILL.51200.00000.0', 50_000],
      ['credit', 'TILL.45000.00001.0', 40_000],
      ['credit', 'TILL.45000.00001.0', 10_000],
      ['debit', 'TILL.51200.00000.0', 125_000],
      ['credit', 'TILL.71300.00000.0', 125_000],
    ])
    expect(ecrit.traitement.mouvements[1].origine).toEqual({ type: 'appel', appelId: 'B1', typeAppel: 'Budget' })
    expect(ecrit.encaissements).toEqual([{ ...e1, impute: true, traitementId: 't-enc-1' }])
    expect(ecrit.recettes).toEqual([{ ...recette, impute: true, traitementId: 't-enc-1' }])
    expect(() => creerPieceTraitement({ traitement: ecrit.traitement, numero: 1, coproprieteId: 'copro-1', segmentSyndicat: SEGMENT, mandatId: 'm-1', parametres: [] })).not.toThrow()
    expect(() => annulerTraitement(ecrit.traitement, { id: 't-x', date: '2026-01-13' })).toThrow(/Aucune annulation observée/)
  })

  it('famille « Encaissement » par défaut ; une remise s’écrit entière, sous le traitement qu’elle réserve', () => {
    const lignes = [
      { encaissementId: 'E1', numeroCheque: '0000001', montantCentimes: 40_000 },
      { encaissementId: 'E2', numeroCheque: '0000002', montantCentimes: 60_000 },
    ]
    const remise = remiseDe(lignes)
    const [c1, c2] = rattacherRemise([cheque('E1', 'cpt-A', 40_000, '0000001'), cheque('E2', 'cpt-B', 60_000, '0000002')], remise)
    const avec = (e: typeof c1) => ({ encaissement: e, resultat: imputerEncaissement(e, POSTES) })
    const ecrit = traitementEncaissements({ encaissements: [avec(c1), avec(c2)], remises: [remise] }, options)
    expect(ecrit.traitement.famille).toBe('Encaissement')
    expect(annulerTraitement(ecrit.traitement, { id: 't-x', date: '2026-01-13' }).famille).toBe("Annulation d'encaissement")
    expect(ecrit.encaissements.map((e) => [e.id, e.impute, e.traitementId])).toEqual([
      ['E1', true, 't-enc-1'],
      ['E2', true, 't-enc-1'],
    ])
    expect(() => traitementEncaissements({ encaissements: [avec(c1)], remises: [remise] }, options)).toThrow(/E2 non fourni/)
    expect(() => traitementEncaissements({ encaissements: [avec(c1), avec(c2)] }, options)).toThrow(/Remise rem-1 non fournie/)
    expect(() => traitementEncaissements({ encaissements: [avec(c1), avec(c2)], remises: [remise] }, { ...options, id: 't-enc-2' })).toThrow(
      /rattaché au traitement t-enc-1/,
    )
  })

  it('refuse une famille hors encaissement, un mode étranger à la famille, la carte bancaire', () => {
    const e1 = virement('E1', 'cpt-A', 10_000)
    const lignes = { encaissements: [{ encaissement: e1, resultat: imputerEncaissement(e1, POSTES) }] }
    expect(() => traitementEncaissements(lignes, { ...options, famille: 'Relances' })).toThrow(/Famille « Relances »/)
    expect(() => traitementEncaissements(lignes, { ...options, famille: "Annulation d'encaissement" })).toThrow(/Famille/)
    expect(() => traitementEncaissements(lignes, { ...options, famille: 'Fichier carte bancaire' })).toThrow(/carte/)
    expect(() => traitementEncaissements(lignes, { ...options, famille: 'Prélèvement' })).toThrow(/« Prélèvement »/)
    expect(() => traitementEncaissements(lignes, { ...options, famille: 'Fichier TIP' })).toThrow(/« TIP »/)
    expect(() => traitementEncaissements(lignes, { ...options, famille: 'Encaissement' })).not.toThrow()
  })

  it('refuse un encaissement déjà écrit, en double, d’un compte inconnu, d’un autre syndicat, postérieur au traitement', () => {
    const e1 = virement('E1', 'cpt-A', 10_000)
    const ligne = { encaissement: e1, resultat: imputerEncaissement(e1, POSTES) }
    const { encaissements } = traitementEncaissements({ encaissements: [ligne] }, options)
    expect(() => traitementEncaissements({ encaissements: [{ ...ligne, encaissement: encaissements[0] }] }, { ...options, id: 't-enc-2' })).toThrow(
      /déjà écrit dans le traitement t-enc-1/,
    )
    expect(() => traitementEncaissements({ encaissements: [ligne, ligne] }, options)).toThrow(/en double/)
    expect(() => traitementEncaissements({}, options)).toThrow(/aucun encaissement/)
    expect(() => traitementEncaissements({ encaissements: [ligne] }, { ...options, comptes: [] })).toThrow(/introuvable/)
    expect(() => traitementEncaissements({ encaissements: [ligne] }, { ...options, segmentSyndicat: 'AUTR' })).toThrow(/autre syndicat/)
    expect(() => traitementEncaissements({ encaissements: [ligne] }, { ...options, date: '2026-01-09' })).toThrow(/jour par jour/)
    expect(() => traitementEncaissements({ encaissements: [ligne] }, { ...options, date: '09/01/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => traitementEncaissements({ encaissements: [ligne] }, { ...options, id: ' ' })).toThrow(/identifiant/)
  })

  it('écrit chaque entrée au jour de son opération (C. com. R. 123-174) : jamais un autre jour, ni dans l’exercice suivant', () => {
    const tardif = enregistrerEncaissement(brut('E9', 'cpt-A', 10_000, '2026-12-28'), { ...contexte, piece: { mode: 'Virement' } })
    const ligne = { encaissement: tardif, resultat: imputerEncaissement(tardif, POSTES) }
    expect(() => traitementEncaissements({ encaissements: [ligne] }, { ...options, date: '2027-01-05' })).toThrow(
      /Encaissement E9 du 2026-12-28 : traitement daté du 2027-01-05.*jour par jour/,
    )
    expect(() => traitementEncaissements({ encaissements: [ligne] }, { ...options, date: '2026-12-29' })).toThrow(/jour par jour/)
    expect(traitementEncaissements({ encaissements: [ligne] }, { ...options, date: '2026-12-28' }).traitement.date).toBe('2026-12-28')
    const veille = enregistrerRecette({ ...SAISIE_RECETTE, date: '2026-01-11' }, { segmentSyndicat: SEGMENT })
    expect(() => traitementEncaissements({ recettes: [veille] }, options)).toThrow(/Encaissement R1 du 2026-01-11.*jour par jour/)
  })

  it('un chèque remis s’écrit au jour de sa remise, pas au jour de sa réception', () => {
    const remise = remiseDe([{ encaissementId: 'E1', numeroCheque: '0000001', montantCentimes: 40_000 }])
    const [c1] = rattacherRemise([cheque('E1', 'cpt-A', 40_000, '0000001')], remise)
    const encaissements = [{ encaissement: c1, resultat: imputerEncaissement(c1, POSTES) }]
    expect(traitementEncaissements({ encaissements, remises: [remise] }, options).traitement.date).toBe(JOUR)
    expect(() => traitementEncaissements({ encaissements, remises: [remise] }, { ...options, date: '2026-01-10' })).toThrow(
      /Encaissement E1 \(remise REM-rem-1 du 2026-01-12\) : traitement daté du 2026-01-10/,
    )
  })

  it('refuse deux imputations d’un même poste qui ne s’enchaînent pas (R8 : origines au-delà du dû) ; admet celles d’imputerEncaissements', () => {
    const e1 = virement('E1', 'cpt-A', 40_000)
    const e2 = virement('E2', 'cpt-A', 40_000)
    const separes = [e1, e2].map((e) => ({ encaissement: e, resultat: imputerEncaissement(e, POSTES) }))
    expect(() => traitementEncaissements({ encaissements: separes }, options)).toThrow(/Poste B1:lot-1 imputé par E1 et E2.*imputerEncaissements/)
    const enLot = imputerEncaissements([e1, e2], POSTES).resultats
    const ecrit = traitementEncaissements({ encaissements: [e1, e2].map((e, i) => ({ encaissement: e, resultat: enLot[i] })) }, options)
    expect(ecrit.traitement.mouvements.filter((m) => m.sens === 'credit').map((m) => [m.montantCentimes, m.origine?.type ?? null])).toEqual([
      [40_000, 'appel'],
      [40_000, null],
    ])
    const regleEnPartie = [{ ...POSTES[0], regleCentimes: 10_000 }]
    const [e3, e4] = [virement('E3', 'cpt-A', 20_000), virement('E4', 'cpt-A', 20_000)]
    const surLeMemeSolde = [e3, e4].map((e) => ({ encaissement: e, resultat: imputerEncaissement(e, regleEnPartie) }))
    expect(() => traitementEncaissements({ encaissements: surLeMemeSolde }, options)).toThrow(/Poste B1:lot-1.*10000 centimes au lieu de 30000/)
  })

  it('des imputations enchaînées s’écrivent quel que soit l’ordre des entrées', () => {
    const grand = [poste('B1:lot-1', 'cpt-A', 80_000)]
    const e1 = virement('E1', 'cpt-A', 40_000)
    const e2 = virement('E2', 'cpt-A', 40_000)
    const [r1, r2] = imputerEncaissements([e1, e2], grand).resultats
    const ecrit = traitementEncaissements(
      {
        encaissements: [
          { encaissement: e2, resultat: r2 },
          { encaissement: e1, resultat: r1 },
        ],
      },
      options,
    )
    expect(ecrit.traitement.mouvements.filter((m) => m.origine).map((m) => m.montantCentimes)).toEqual([40_000, 40_000])
  })
})

describe('statut « Rapproché » propagé depuis les arrêtés (rapprochement-pieces.ts, au pointage : J8)', () => {
  const pieces = (...ids: string[]): PieceRapprochee[] => ids.map((id) => ({ type: 'encaissement', id }))
  const element = (id: string, montantCentimes: number, porte: PieceRapprochee[], surcharge: Partial<ElementRapprochement> = {}): ElementRapprochement => ({
    id,
    cote: 'banque',
    montantCentimes,
    rapproche: 'manuel',
    date: '2026-01-12',
    rapprocheLe: '2026-01-15',
    pieces: porte,
    ...surcharge,
  })
  const arrete = (elements: ElementRapprochement[], banqueId = 'b-courant'): ArreteRapprochement => ({
    id: 'a-1',
    banqueId,
    dateArrete: '2026-01-20',
    soldeBanqueCentimes: 0,
    soldeComptaCentimes: 0,
    statut: 'En cours',
    elements,
  })
  const lignes = [
    { encaissementId: 'E1', numeroCheque: '0000001', montantCentimes: 40_000 },
    { encaissementId: 'E2', numeroCheque: '0000002', montantCentimes: 60_000 },
  ]
  const [c1, c2] = rattacherRemise([cheque('E1', 'cpt-A', 40_000, '0000001'), cheque('E2', 'cpt-B', 60_000, '0000002')], remiseDe(lignes))
  const recette = enregistrerRecette(SAISIE_RECETTE, { segmentSyndicat: SEGMENT })
  const e3 = virement('E3', 'cpt-A', 5_000)
  const arretes = [arrete([element('rel-remise', 100_000, pieces('E1', 'E2')), element('rel-ass', 125_000, pieces('R1'), { rapproche: 'auto' })])]

  it('la ligne d’une remise rapproche ses chèques ; une recette se rapproche comme un encaissement ; les autres restent Enregistré', () => {
    const { entrees, anomalies } = rapprocherEncaissements([c1, c2, recette, e3], arretes)
    expect(anomalies).toEqual([])
    expect(entrees.map((e) => [e.id, e.statut])).toEqual([
      ['E1', 'Rapproché'],
      ['E2', 'Rapproché'],
      ['R1', 'Rapproché'],
      ['E3', 'Enregistré'],
    ])
    expect(entrees[0]).toEqual({
      ...c1,
      statut: 'Rapproché',
      rapprochement: { arreteId: 'a-1', banqueId: 'b-courant', elementId: 'rel-remise', cote: 'banque', mode: 'manuel', rapprocheLe: '2026-01-15' },
    })
    expect(entrees[0]).not.toHaveProperty('banqueId')
    expect(entrees[2].rapprochement?.mode).toBe('auto')
  })

  it('dépointage : retour à Enregistré ; à une date antérieure au pointage : Enregistré', () => {
    const { entrees } = rapprocherEncaissements([c1, c2], arretes)
    const depointes = rapprocherEncaissements(entrees, []).entrees
    expect(depointes.map((e) => [e.statut, e.rapprochement])).toEqual([
      ['Enregistré', null],
      ['Enregistré', null],
    ])
    expect(rapprocherEncaissements([c1, c2], arretes, { aLaDate: '2026-01-14' }).entrees.map((e) => e.statut)).toEqual(['Enregistré', 'Enregistré'])
  })

  it('arrêté d’un autre compte que le journal de l’encaissement : anomalie, statut inchangé', () => {
    const { entrees, anomalies } = rapprocherEncaissements([e3], [arrete([element('rel-1', 5_000, pieces('E3'))], 'b-ft')])
    expect(anomalies).toMatchObject([{ code: 'autre_compte', pieceId: 'E3' }])
    expect(entrees[0].statut).toBe('Enregistré')
  })
})

describe('en-tête du module', () => {
  const SOURCE = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'encaissements-pieces.ts'), 'utf8')
  const EN_TETE = SOURCE.slice(0, SOURCE.indexOf('*/')).replaceAll(/\s*\n\s*\*\s*/g, ' ')

  it('date de l’écriture : le livre journal enregistre jour par jour (arrêté du 14 mars 2005, art. 2 ; C. com. R. 123-174, renvoi déduit)', () => {
    expect(EN_TETE).toContain(
      '« tenu selon les dispositions du décret n° 83-1020 du 29 novembre 1983, enregistre chronologiquement les opérations ayant une incidence financière sur le fonctionnement du syndicat »',
    )
    expect(EN_TETE).toContain(
      "C. com. R. 123-174 : « Les mouvements affectant le patrimoine de l'entreprise sont enregistrés opération par opération et jour par jour pour le livre-journal »",
    )
    expect(EN_TETE).toContain(
      "« Les opérations de même nature, réalisées en un même lieu et au cours d'une même journée, peuvent être récapitulées sur une pièce justificative unique »",
    )
    expect(EN_TETE).toMatch(/🔵 Déduit :.*le renvoi de l'arrêté au décret n° 83-1020, abrogé, vaut renvoi à C\. com\. R\. 123-174 \(D\. 2007-431 art\. 2 ;/)
    expect(EN_TETE).not.toMatch(/au plus tôt du jour des encaissements/)
    expect(EN_TETE).toMatch(/« Date de prise en compte d'un encaissement : remise, valeur ou relevé \? » \(VitFix : le traitement est daté du jour de l'opération/)
  })
})
