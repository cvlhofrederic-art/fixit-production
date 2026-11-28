import { describe, expect, it } from 'vitest'
import {
  imputerEncaissement,
  imputerEncaissements,
  mouvementsEncaissementImpute,
  reglementsSurContentieux,
  soldePoste,
  type Encaissement,
  type PosteDette,
} from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { creerTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Imputation des encaissements sur les postes d'appel (cartographie Gestéam, tranche 43 § 2 et § 8 : un virement reçu
 * s'impute ligne à ligne sur les dettes du compte — appel de provisions, appel de fonds travaux —, chacune avec son dû et
 * son payé ; la colonne « Ctx » marque une dette passée en contentieux).
 *
 * Règle d'imputation (C. civ. art. 1342-10) : le débiteur peut désigner la dette qu'il paie ; à défaut, d'abord les
 * dettes échues, la plus ancienne en premier, et proportionnellement entre dettes de même ancienneté. Une désignation
 * qui ne solde pas les postes désignés exige l'accord du gestionnaire (art. 1342-4). Le reliquat reste « à imputer » ;
 * sur option, il va aux appels à venir, jamais à un appel de fonds de travaux non échu (L. 1965 art. 14-2-1, III).
 * Montants en centimes entiers, dates ISO.
 */

const poste = (id: string, exigibilite: string, montantCentimes: number, surcharge: Partial<PosteDette> = {}): PosteDette => ({
  id,
  compteId: 'c-1',
  appelId: `appel-${id}`,
  typeAppel: 'Budget',
  libelle: 'APPEL DE PROVISIONS',
  exigibilite,
  montantCentimes,
  regleCentimes: 0,
  contentieux: false,
  ...surcharge,
})

const encaissement = (montantCentimes: number, surcharge: Partial<Encaissement> = {}): Encaissement => ({
  id: 'e-1',
  compteId: 'c-1',
  date: '2026-10-26',
  montantCentimes,
  ...surcharge,
})

const postes = (): PosteDette[] => [
  poste('t3', '2026-07-01', 20_000),
  poste('t3-ft', '2026-07-01', 1_000, { typeAppel: 'Fonds travaux', libelle: 'APPEL FONDS TRAVAUX' }),
  poste('t4', '2026-10-01', 20_000),
  poste('t4-ft', '2026-10-01', 1_000, { typeAppel: 'Fonds travaux', libelle: 'APPEL FONDS TRAVAUX' }),
  poste('t1-27', '2027-01-01', 20_000),
]

describe('imputation — règle par défaut (C. civ. art. 1342-10)', () => {
  it('impute un paiement exact sur les postes de l’échéance la plus ancienne', () => {
    const resultat = imputerEncaissement(encaissement(21_000), postes())
    expect(resultat.lignes).toEqual([
      { posteId: 't3', montantCentimes: 20_000 },
      { posteId: 't3-ft', montantCentimes: 1_000 },
    ])
    expect(resultat.resteAImputerCentimes).toBe(0)
    expect(resultat.postes.filter((p) => soldePoste(p) === 0).map((p) => p.id)).toEqual(['t3', 't3-ft'])
  })

  it('solde les échues dans l’ordre d’ancienneté avant de passer à l’échéance suivante', () => {
    const resultat = imputerEncaissement(encaissement(30_000), postes())
    expect(resultat.lignes).toEqual([
      { posteId: 't3', montantCentimes: 20_000 },
      { posteId: 't3-ft', montantCentimes: 1_000 },
      { posteId: 't4', montantCentimes: 8_571 },
      { posteId: 't4-ft', montantCentimes: 429 },
    ])
  })

  it('répartit proportionnellement entre postes de même ancienneté, au centime près', () => {
    const resultat = imputerEncaissement(encaissement(10_000), postes())
    expect(resultat.lignes).toEqual([
      { posteId: 't3', montantCentimes: 9_524 },
      { posteId: 't3-ft', montantCentimes: 476 },
    ])
    expect(resultat.lignes.reduce((s, l) => s + l.montantCentimes, 0)).toBe(10_000)
  })

  it('tient compte de ce qui est déjà réglé sur un poste', () => {
    const deja = postes().map((p) => (p.id === 't3' ? { ...p, regleCentimes: 15_000 } : p))
    expect(imputerEncaissement(encaissement(6_000), deja).lignes).toEqual([
      { posteId: 't3', montantCentimes: 5_000 },
      { posteId: 't3-ft', montantCentimes: 1_000 },
    ])
  })

  it('par défaut, laisse le reliquat à imputer ; sur option, l’impute sur les appels à venir', () => {
    const parDefaut = imputerEncaissement(encaissement(70_000), postes())
    expect(parDefaut.lignes.map((l) => l.posteId)).toEqual(['t3', 't3-ft', 't4', 't4-ft'])
    expect(parDefaut.resteAImputerCentimes).toBe(28_000)
    const surAVenir = imputerEncaissement(encaissement(70_000), postes(), { imputerSurAVenir: true })
    expect(surAVenir.lignes.at(-1)).toEqual({ posteId: 't1-27', montantCentimes: 20_000 })
    expect(surAVenir.resteAImputerCentimes).toBe(8_000)
  })

  it('ne sert jamais d’office un appel de fonds de travaux non échu, même sur option (L. 1965 art. 14-2-1, III)', () => {
    const avecFtAVenir = [...postes(), poste('t1-27-ft', '2027-01-01', 1_000, { typeAppel: 'Fonds travaux' })]
    const resultat = imputerEncaissement(encaissement(70_000), avecFtAVenir, { imputerSurAVenir: true })
    expect(resultat.lignes.map((l) => l.posteId)).not.toContain('t1-27-ft')
    expect(resultat.resteAImputerCentimes).toBe(8_000)
  })

  it('un appel exigible le jour même de l’encaissement est échu', () => {
    const resultat = imputerEncaissement(encaissement(1_000, { date: '2026-07-01' }), postes(), { imputerSurAVenir: false })
    expect(resultat.lignes.map((l) => l.posteId)).toEqual(['t3', 't3-ft'])
  })

  it('n’impute que sur les postes du compte crédité', () => {
    const autres = [...postes(), poste('autre', '2026-01-01', 5_000, { compteId: 'c-2' })]
    const resultat = imputerEncaissement(encaissement(1_000), autres)
    expect(resultat.lignes.map((l) => l.posteId)).not.toContain('autre')
    expect(resultat.postes.find((p) => p.id === 'autre')?.regleCentimes).toBe(0)
  })
})

describe('imputation — désignation par le débiteur', () => {
  it('impute d’abord sur les postes désignés, dans l’ordre donné, puis applique la règle par défaut', () => {
    const resultat = imputerEncaissement(encaissement(22_000, { postesDesignes: ['t4-ft', 't4'] }), postes())
    expect(resultat.lignes).toEqual([
      { posteId: 't4-ft', montantCentimes: 1_000 },
      { posteId: 't4', montantCentimes: 20_000 },
      { posteId: 't3', montantCentimes: 952 },
      { posteId: 't3-ft', montantCentimes: 48 },
    ])
  })

  it('n’applique une désignation qui ne solde pas les postes désignés que si le gestionnaire l’accepte (art. 1342-4)', () => {
    const refusee = imputerEncaissement(encaissement(5_000, { postesDesignes: ['t4'] }), postes())
    expect(refusee.designationPartielleRefusee).toBe(true)
    expect(refusee.lignes).toEqual([
      { posteId: 't3', montantCentimes: 4_762 },
      { posteId: 't3-ft', montantCentimes: 238 },
    ])
    const acceptee = imputerEncaissement(encaissement(5_000, { postesDesignes: ['t4'], designationPartielleAcceptee: true }), postes())
    expect(acceptee.designationPartielleRefusee).toBe(false)
    expect(acceptee.lignes).toEqual([{ posteId: 't4', montantCentimes: 5_000 }])
  })

  it('refuse un poste désigné inconnu, d’un autre compte, déjà soldé, ou désigné deux fois', () => {
    const autres = [...postes(), poste('autre', '2026-01-01', 5_000, { compteId: 'c-2' })]
    expect(() => imputerEncaissement(encaissement(100, { postesDesignes: ['x'] }), autres)).toThrow(/inconnu/i)
    expect(() => imputerEncaissement(encaissement(100, { postesDesignes: ['autre'] }), autres)).toThrow(/autre compte/i)
    const solde = postes().map((p) => (p.id === 't3' ? { ...p, regleCentimes: 20_000 } : p))
    expect(() => imputerEncaissement(encaissement(100, { postesDesignes: ['t3'] }), solde)).toThrow(/soldé/i)
    expect(() => imputerEncaissement(encaissement(100, { postesDesignes: ['t3', 't3'] }), postes())).toThrow(/deux fois/i)
  })
})

describe('imputation — contrôles', () => {
  it('refuse un encaissement mal formé', () => {
    expect(() => imputerEncaissement(encaissement(0), postes())).toThrow(/montant/i)
    expect(() => imputerEncaissement(encaissement(12.5), postes())).toThrow(/montant/i)
    expect(() => imputerEncaissement(encaissement(100, { date: '26/10/2026' }), postes())).toThrow(/date/i)
  })

  it('refuse des postes mal formés : identifiant en double, date, montant, réglé hors bornes, type d’appel inconnu', () => {
    expect(() => imputerEncaissement(encaissement(100), [poste('a', '2026-07-01', 100), poste('a', '2026-08-01', 100)])).toThrow(
      /double/i,
    )
    expect(() => imputerEncaissement(encaissement(100), [poste('a', '01/07/2026', 100)])).toThrow(/date/i)
    expect(() => imputerEncaissement(encaissement(100), [poste('a', '2026-07-01', 0)])).toThrow(/montant/i)
    expect(() => imputerEncaissement(encaissement(100), [poste('a', '2026-07-01', 100, { regleCentimes: 150 })])).toThrow(
      /réglé/i,
    )
    expect(() =>
      imputerEncaissement(encaissement(100), [poste('a', '2026-07-01', 100, { typeAppel: 'Charges' as never })]),
    ).toThrow(/type d'appel/i)
  })

  it('départage les égalités de prorata par l’ordre reçu, en arithmétique entière', () => {
    const ex = [poste('a', '2026-07-01', 600), poste('b', '2026-07-01', 100), poste('c', '2026-07-01', 300)]
    expect(imputerEncaissement(encaissement(4), ex).lignes).toEqual([
      { posteId: 'a', montantCentimes: 3 },
      { posteId: 'c', montantCentimes: 1 },
    ])
  })

  it('refuse un poste dont l’appel d’origine et le type d’appel ne vont pas ensemble', () => {
    expect(() => imputerEncaissement(encaissement(100), [poste('a', '2026-07-01', 100, { typeAppel: null })])).toThrow(/appel/i)
    expect(() => imputerEncaissement(encaissement(100), [poste('a', '2026-07-01', 100, { appelId: null })])).toThrow(/appel/i)
  })

  it('ne modifie pas les postes reçus (fonction pure)', () => {
    const entree = postes()
    imputerEncaissement(encaissement(21_000), entree)
    expect(entree.every((p) => p.regleCentimes === 0)).toBe(true)
  })
})

describe('imputation — plusieurs encaissements', () => {
  it('impute les encaissements dans l’ordre des dates, chacun sur les soldes laissés par le précédent', () => {
    const { resultats, postes: finaux } = imputerEncaissements(
      [
        encaissement(10_000, { id: 'e-2', date: '2026-10-20' }),
        encaissement(21_000, { id: 'e-1', date: '2026-08-05' }),
      ],
      postes(),
    )
    expect(resultats.map((r) => r.encaissementId)).toEqual(['e-1', 'e-2'])
    expect(resultats[0].lignes.map((l) => l.posteId)).toEqual(['t3', 't3-ft'])
    expect(resultats[1].lignes).toEqual([
      { posteId: 't4', montantCentimes: 9_524 },
      { posteId: 't4-ft', montantCentimes: 476 },
    ])
    expect(finaux.find((p) => p.id === 't4')?.regleCentimes).toBe(9_524)
  })

  it('refuse un encaissement compté deux fois', () => {
    expect(() => imputerEncaissements([encaissement(100), encaissement(200)], postes())).toThrow(/deux fois/i)
  })

  it('garde l’ordre reçu entre encaissements du même jour (ordre du relevé), sans trier les identifiants', () => {
    const { resultats } = imputerEncaissements(
      [encaissement(100, { id: 'e-2' }), encaissement(100, { id: 'e-10' })],
      postes(),
    )
    expect(resultats.map((r) => r.encaissementId)).toEqual(['e-2', 'e-10'])
  })

  it('ignore, en lot, la désignation d’un poste soldé par un encaissement antérieur, et le signale', () => {
    const { resultats } = imputerEncaissements(
      [
        encaissement(21_000, { id: 'e-1', date: '2026-08-05' }),
        encaissement(5_000, { id: 'e-2', date: '2026-10-20', postesDesignes: ['t3'] }),
      ],
      postes(),
    )
    expect(resultats[1].designationsIgnorees).toEqual(['t3'])
    expect(resultats[1].lignes.map((l) => l.posteId)).toEqual(['t4', 't4-ft'])
  })

  it('cumule le crédit laissé à imputer sur le lot', () => {
    const lot = imputerEncaissements(
      [encaissement(41_000, { id: 'e-1', date: '2026-08-05' }), encaissement(100, { id: 'e-2', date: '2026-10-20' })],
      postes(),
      { imputerSurAVenir: false },
    )
    expect(lot.creditAImputerCentimes).toBe(20_000)
  })

  it('renvoie une copie des postes même pour un lot vide', () => {
    const entree = postes()
    const lot = imputerEncaissements([], entree)
    expect(lot.postes).not.toBe(entree)
    expect(lot.postes).toEqual(entree)
  })
})

describe('imputation — écriture et contentieux', () => {
  it('écrit l’encaissement en partie double, chaque crédit portant l’appel d’origine (R7, R8)', () => {
    const e = encaissement(25_000)
    const resultat = imputerEncaissement(e, postes(), { imputerSurAVenir: false })
    const lignes = mouvementsEncaissementImpute({
      encaissement: e,
      resultat,
      compteBanque: 'S1.51200.00000.0',
      compteCoproprietaire: 'S1.45000.00001.0',
    })
    expect(lignes[0]).toEqual({ compte: 'S1.51200.00000.0', sens: 'debit', montantCentimes: 25_000 })
    expect(lignes.slice(1).map((l) => [l.montantCentimes, l.origine?.type === 'appel' ? l.origine.typeAppel : null])).toEqual([
      [20_000, 'Budget'],
      [1_000, 'Fonds travaux'],
      [3_810, 'Budget'],
      [190, 'Fonds travaux'],
    ])
    expect(() => creerTraitement({ id: 't', famille: 'Encaissement', date: e.date, mouvements: lignes })).not.toThrow()
  })

  it('porte le reste à imputer en crédit sans appel d’origine', () => {
    const e = encaissement(80_000)
    const resultat = imputerEncaissement(e, postes(), { imputerSurAVenir: false })
    const lignes = mouvementsEncaissementImpute({
      encaissement: e,
      resultat,
      compteBanque: 'S1.51200.00000.0',
      compteCoproprietaire: 'S1.45000.00001.0',
    })
    expect(lignes.at(-1)).toEqual({ compte: 'S1.45000.00001.0', sens: 'credit', montantCentimes: 38_000 })
  })

  it('extrait, pour le décompte du contentieux, la part de chaque encaissement imputée sur des dettes « Ctx »', () => {
    const avecCtx = postes().map((p) => (p.id === 't3' || p.id === 't3-ft' ? { ...p, contentieux: true } : p))
    const encaissements = [encaissement(15_000, { id: 'e-1', date: '2026-08-05' }), encaissement(20_000, { id: 'e-2', date: '2026-10-20' })]
    const { resultats } = imputerEncaissements(encaissements, avecCtx)
    expect(reglementsSurContentieux(resultats, encaissements, avecCtx, 'c-1')).toEqual([
      { id: 'e-1', date: '2026-08-05', montantCentimes: 15_000 },
      { id: 'e-2', date: '2026-10-20', montantCentimes: 6_000 },
    ])
  })

  it('ne retient que les règlements du compte demandé', () => {
    const lot = [
      poste('a', '2026-07-01', 1_000, { contentieux: true }),
      poste('b', '2026-07-01', 2_000, { compteId: 'c-2', contentieux: true }),
    ]
    const encaissements = [encaissement(1_000, { id: 'e-1' }), encaissement(2_000, { id: 'e-2', compteId: 'c-2' })]
    const { resultats } = imputerEncaissements(encaissements, lot)
    expect(reglementsSurContentieux(resultats, encaissements, lot, 'c-1')).toEqual([
      { id: 'e-1', date: '2026-10-26', montantCentimes: 1_000 },
    ])
  })
})
