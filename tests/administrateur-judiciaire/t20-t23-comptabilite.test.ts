import './fuseau-paris'
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import {
  formaterNumeroCompte,
  genererSegmentAuxiliaire,
  type PlanComptable,
} from '@/lib/administrateur-judiciaire/domain/plan-comptable'
import type { TypeSru } from '@/lib/administrateur-judiciaire/domain/referentiels-vitfix'
import {
  annulerTraitement,
  creerTraitement,
  mouvementsDecaissement,
  mouvementsEncaissement,
  type Mouvement,
} from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Lot 2 — seules les parties praticables sans la décision D1 : T20 (plan comptable, règle R5 du numéro de compte)
 * et les règles pures de T23 (partie double, R6 annulation symétrique, R7, R8). Montants en centimes entiers.
 */

const entreePlan = (surcharge: Partial<PlanComptable>): PlanComptable => ({
  id: 'pc-1',
  code: '45000',
  libelle: 'Copropriétaires',
  source: 'Copropriété',
  horsService: false,
  nature: 'Copropriétaire',
  analytique: 'libre',
  regleNumeroCompte: 'A zéro',
  libelleCompteIdentiquePlan: true,
  lettrageActif: true,
  ajoutManuelActif: false,
  parDefautSiNouveauMandat: true,
  ...surcharge,
})

describe('T20 — PlanComptable', () => {
  it('le code est une chaîne : « 512CB » est accepté, le tri est lexicographique', () => {
    const banque = entreePlan({ code: '512CB', libelle: 'CDC banque CB' })
    expect(banque.code).toBe('512CB')
    expect(['51210', '5120D', '51209'].sort()).toEqual(['51209', '5120D', '51210'])
    // @ts-expect-error — un code numérique ne compile pas
    const numerique: PlanComptable['code'] = 45000
    expect(numerique).toBe(45000)
  })

  it('typeSru est typé par le référentiel', () => {
    const entree = entreePlan({ typeSru: 'Travaux - Provisions' })
    expect(entree.typeSru).toBe('Travaux - Provisions')
    // @ts-expect-error — valeur hors TYPE_SRU
    const horsListe: TypeSru = 'Travaux - Provision'
    expect(horsListe).toBe('Travaux - Provision')
  })

  it('la table planComptable existe en version 2, clé primaire chaîne', async () => {
    await viderBaseLocale()
    await ajDb.planComptable.add(entreePlan({ id: 'pc-512CB', code: '512CB' }))
    expect((await ajDb.planComptable.get('pc-512CB'))?.code).toBe('512CB')
    expect(await ajDb.planComptable.where('code').equals('512CB').count()).toBe(1)
  })
})

describe('T20 — règle R5 : segment auxiliaire selon la règle déclarée sur l’entrée de plan', () => {
  it('« A zéro » → 00000, sans valeur fournie', () => {
    expect(genererSegmentAuxiliaire(entreePlan({ regleNumeroCompte: 'A zéro' }), { regle: 'A zéro' })).toBe('00000')
  })

  it.each([
    ['Libre', 'MAIRI'],
    ['Fixe', '0EPF3'],
    ['Série', '00101'],
    ["No d'identité", '01234'],
    ["No d'entreprises", 'ANTIL'],
    ['No des travaux', '00042'],
    ['No de lot', '00137'],
    ["No d'indivisaire", '00003'],
  ] as const)('« %s » → la valeur fournie pour cette règle (%s)', (regle, valeur) => {
    expect(genererSegmentAuxiliaire(entreePlan({ regleNumeroCompte: regle }), { regle, valeur })).toBe(valeur)
  })

  it('la valeur doit correspondre à la règle déclarée sur l’entrée de plan', () => {
    expect(() =>
      genererSegmentAuxiliaire(entreePlan({ regleNumeroCompte: 'No de lot' }), { regle: "No d'identité", valeur: '01234' }),
    ).toThrow(/No de lot/)
  })

  it('« Ajouter des 0 » complète à gauche ; sans l’option, une valeur de moins de 5 caractères est refusée', () => {
    expect(
      genererSegmentAuxiliaire(entreePlan({ regleNumeroCompte: 'No de lot', ajouterDesZeros: 5 }), { regle: 'No de lot', valeur: '137' }),
    ).toBe('00137')
    expect(() =>
      genererSegmentAuxiliaire(entreePlan({ regleNumeroCompte: 'No de lot' }), { regle: 'No de lot', valeur: '137' }),
    ).toThrow(/5 caractères/)
    expect(() =>
      genererSegmentAuxiliaire(entreePlan({ regleNumeroCompte: 'Libre' }), { regle: 'Libre', valeur: 'TROPLONG' }),
    ).toThrow(/5 caractères/)
  })

  it('numéro complet <Mandat(4)>.<Plan(5)>.<Auxiliaire(5)>.<Repère(1)>, mandat vide « ____ » comme observé', () => {
    expect(formaterNumeroCompte({ planCode: '51230', auxiliaire: '00000' })).toBe('____.51230.00000.0')
    expect(formaterNumeroCompte({ mandat: '0042', planCode: '45000', auxiliaire: '00137', repere: '0' })).toBe(
      '0042.45000.00137.0',
    )
    expect(() => formaterNumeroCompte({ mandat: '42', planCode: '45000', auxiliaire: '00137' })).toThrow(/Mandat/)
    expect(() => formaterNumeroCompte({ planCode: '4500', auxiliaire: '00137' })).toThrow(/Plan/)
  })
})

describe('T23 — traitements et mouvements (règles pures)', () => {
  const banque = '____.51200.00000.0'
  const copro = '____.45000.00137.0'
  const charge = '____.61500.00000.0'

  it('R7 encaissement : débit banque / crédit copropriétaire', () => {
    expect(mouvementsEncaissement({ montantCentimes: 12_345, compteBanque: banque, compteCoproprietaire: copro })).toEqual([
      { compte: banque, sens: 'debit', montantCentimes: 12_345 },
      { compte: copro, sens: 'credit', montantCentimes: 12_345 },
    ])
  })

  it('R7 décaissement : le compte de charge débité est celui de l’ANALYTIQUE de la ligne', () => {
    const analytique = { id: 'an-460', comptePlanCharge: charge }
    expect(mouvementsDecaissement({ montantCentimes: 50_000, compteBanque: banque, analytique })).toEqual([
      { compte: charge, sens: 'debit', montantCentimes: 50_000 },
      { compte: banque, sens: 'credit', montantCentimes: 50_000 },
    ])
  })

  it('tout mouvement appartient à un traitement équilibré ; un traitement déséquilibré est refusé', () => {
    const traitement = creerTraitement({
      id: 't1',
      famille: 'Encaissement',
      date: '2026-10-08',
      mouvements: mouvementsEncaissement({ montantCentimes: 10_000, compteBanque: banque, compteCoproprietaire: copro }),
    })
    expect(traitement.mouvements.every((m: Mouvement) => m.traitementId === 't1')).toBe(true)
    expect(() =>
      creerTraitement({
        id: 't2',
        famille: 'Saisie de mouvements',
        date: '2026-10-08',
        mouvements: [
          { compte: banque, sens: 'debit', montantCentimes: 100 },
          { compte: copro, sens: 'credit', montantCentimes: 99 },
        ],
      }),
    ).toThrow(/équilibr/)
    expect(() => creerTraitement({ id: 't3', famille: 'Encaissement', date: '2026-10-08', mouvements: [] })).toThrow()
  })

  it('montants : centimes entiers strictement positifs ; famille hors référentiel refusée', () => {
    expect(() =>
      creerTraitement({
        id: 't4',
        famille: 'Encaissement',
        date: '2026-10-08',
        mouvements: [
          { compte: banque, sens: 'debit', montantCentimes: 10.5 },
          { compte: copro, sens: 'credit', montantCentimes: 10.5 },
        ],
      }),
    ).toThrow(/centimes/)
    expect(() =>
      // @ts-expect-error — famille hors FAMILLE_TRAITEMENT
      creerTraitement({ id: 't5', famille: 'Paiement', date: '2026-10-08', mouvements: [] }),
    ).toThrow()
  })

  it('R6 : annuler produit un second traitement symétrique et laisse le premier intact', () => {
    const original = creerTraitement({
      id: 't1',
      famille: 'Encaissement',
      date: '2026-10-08',
      mouvements: mouvementsEncaissement({ montantCentimes: 10_000, compteBanque: banque, compteCoproprietaire: copro }),
    })
    const instantane = structuredClone(original)
    const annulation = annulerTraitement(original, { id: 't1-annul', date: '2026-10-09' })
    expect(annulation.famille).toBe("Annulation d'encaissement")
    expect(annulation.annule).toBe('t1')
    expect(annulation.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      [banque, 'credit', 10_000],
      [copro, 'debit', 10_000],
    ])
    expect(original).toEqual(instantane)
  })

  it('R6 : une répartition de charges s’annule par « Annulation répartition de charges » ; une famille sans annulation observée est refusée', () => {
    const repartition = creerTraitement({
      id: 'r1',
      famille: 'Répartition de charges',
      date: '2026-10-08',
      mouvements: [
        { compte: copro, sens: 'debit', montantCentimes: 300 },
        { compte: charge, sens: 'credit', montantCentimes: 300 },
      ],
    })
    expect(annulerTraitement(repartition, { id: 'r1-a', date: '2026-10-09' }).famille).toBe('Annulation répartition de charges')
    const saisie = creerTraitement({
      id: 's1',
      famille: 'Saisie de mouvements',
      date: '2026-10-08',
      mouvements: [
        { compte: banque, sens: 'debit', montantCentimes: 1 },
        { compte: copro, sens: 'credit', montantCentimes: 1 },
      ],
    })
    expect(() => annulerTraitement(saisie, { id: 's1-a', date: '2026-10-09' })).toThrow(/annulation/i)
  })

  it('R8 : un mouvement issu d’un appel porte son lien et son type d’appel', () => {
    const traitement = creerTraitement({
      id: 'a1',
      famille: 'Appel de fonds',
      date: '2026-10-01',
      mouvements: [
        { compte: copro, sens: 'debit', montantCentimes: 25_000, origine: { type: 'appel', appelId: 'adf-2026-T4', typeAppel: 'Budget' } },
        { compte: '____.70120.00000.0', sens: 'credit', montantCentimes: 25_000, origine: { type: 'appel', appelId: 'adf-2026-T4', typeAppel: 'Budget' } },
      ],
    })
    expect(traitement.mouvements[0].origine).toEqual({ type: 'appel', appelId: 'adf-2026-T4', typeAppel: 'Budget' })
    expect(() =>
      creerTraitement({
        id: 'a2',
        famille: 'Appel de fonds',
        date: '2026-10-01',
        mouvements: [
          // @ts-expect-error — type d'appel hors TYPE_APPEL_LIE_AU_MOUVEMENT
          { compte: copro, sens: 'debit', montantCentimes: 1, origine: { type: 'appel', appelId: 'x', typeAppel: 'Charges' } },
          { compte: banque, sens: 'credit', montantCentimes: 1 },
        ],
      }),
    ).toThrow(/type d'appel/i)
  })
})

