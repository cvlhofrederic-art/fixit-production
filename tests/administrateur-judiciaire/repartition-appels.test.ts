import { describe, expect, it } from 'vitest'
import { creerCompteCoproprietaire, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  avisDAppel,
  creerCleRepartition,
  repartir,
  traitementAppelDeFonds,
  type EcheanceAppel,
} from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Répartition des charges et avis d'appel (cartographie Gestéam, tranches 21, 25 et 30 ; D1 et D2).
 * - Clé de répartition du syndicat : tantièmes de chaque lot ; total = somme des tantièmes.
 * - Répartition au tantième, au centime près, sans perte ni création (méthode des plus forts restes).
 * - Avis d'appel par COMPTE copropriétaire (D2) : quotes-parts des lots dont le compte détient les droits à
 *   l'exigibilité ; solde antérieur repris.
 * - Écriture de l'appel : traitement « Appel de fonds », débit des comptes 450, crédit du compte de l'échéance.
 */

const cle = creerCleRepartition({
  id: 'cle-001',
  coproprieteId: 'copro-tilleuls',
  code: '001',
  libelle: 'Charges communes générales',
  lots: [
    { lotId: 'lot-1', tantiemes: 333 },
    { lotId: 'lot-2', tantiemes: 333 },
    { lotId: 'lot-3', tantiemes: 334 },
  ],
})

describe('clé de répartition', () => {
  it('total des tantièmes ; refuse un lot en double, des tantièmes nuls ou non entiers', () => {
    expect(cle.totalTantiemes).toBe(1000)
    expect(() => creerCleRepartition({ id: 'c', coproprieteId: 'x', code: '002', libelle: 'Ascenseur', lots: [{ lotId: 'a', tantiemes: 1 }, { lotId: 'a', tantiemes: 2 }] })).toThrow(/double/i)
    expect(() => creerCleRepartition({ id: 'c', coproprieteId: 'x', code: '002', libelle: 'Ascenseur', lots: [{ lotId: 'a', tantiemes: 0 }] })).toThrow(/tanti/i)
    expect(() => creerCleRepartition({ id: 'c', coproprieteId: 'x', code: '002', libelle: 'Ascenseur', lots: [] })).toThrow(/aucun lot/i)
  })
})

describe('répartition au tantième', () => {
  it('la somme des quotes-parts égale exactement le montant (plus forts restes)', () => {
    const parts = repartir(100_000, cle)
    expect(parts).toEqual([
      { lotId: 'lot-1', centimes: 33_300 },
      { lotId: 'lot-2', centimes: 33_300 },
      { lotId: 'lot-3', centimes: 33_400 },
    ])
    const impair = repartir(100, cle)
    expect(impair.reduce((s, p) => s + p.centimes, 0)).toBe(100)
    expect(impair.map((p) => p.centimes)).toEqual([33, 33, 34])
  })

  it('égalité de restes : départage stable par ordre des lots', () => {
    const egal = creerCleRepartition({ id: 'c', coproprieteId: 'x', code: '003', libelle: 'Escalier', lots: [{ lotId: 'b', tantiemes: 1 }, { lotId: 'a', tantiemes: 1 }] })
    expect(repartir(1, egal)).toEqual([
      { lotId: 'b', centimes: 1 },
      { lotId: 'a', centimes: 0 },
    ])
  })

  it('refuse un montant non entier ou négatif', () => {
    expect(() => repartir(10.5, cle)).toThrow(/montant/i)
    expect(() => repartir(-1, cle)).toThrow(/montant/i)
  })
})

describe('avis d’appel par compte (D2)', () => {
  const comptes = [
    creerCompteCoproprietaire({ id: 'cpt-A', coproprieteId: 'copro-tilleuls', serie: '1', libelle: 'Indivision A' }),
    creerCompteCoproprietaire({ id: 'cpt-B', coproprieteId: 'copro-tilleuls', serie: '2', libelle: 'B' }),
  ]
  const pos = (id: string, lotId: string, compteId: string, qualite: 'Copropriétaire' | 'Indivisaire', part = { numerateur: 1, denominateur: 1 }, dateEntree = '2020-01-01', dateSortie: string | null = null) =>
    creerPosition({ id, identiteId: `id-${id}`, lotId, compteId, qualite, part, statut: dateSortie ? 'Sorti' : 'En place', dateEntree, dateSortie })
  const positions = [
    pos('p1', 'lot-1', 'cpt-A', 'Indivisaire', { numerateur: 1, denominateur: 2 }),
    pos('p2', 'lot-1', 'cpt-A', 'Indivisaire', { numerateur: 1, denominateur: 2 }),
    pos('p3', 'lot-2', 'cpt-A', 'Copropriétaire'),
    pos('p4', 'lot-3', 'cpt-B', 'Copropriétaire', undefined, '2026-03-01'),
    pos('p5', 'lot-3', 'cpt-A', 'Copropriétaire', undefined, '2015-01-01', '2026-03-01'),
  ]
  const echeances: EcheanceAppel[] = [
    { id: 'e-T1', coproprieteId: 'copro-tilleuls', cleId: 'cle-001', exigibilite: '2026-01-01', libelle: 'Appel T1 2026', montantCentimes: 100_000, nature: 'budget' },
    { id: 'e-T2', coproprieteId: 'copro-tilleuls', cleId: 'cle-001', exigibilite: '2026-04-01', libelle: 'Appel T2 2026', montantCentimes: 100_000, nature: 'budget' },
  ]

  it('additionne par compte les quotes-parts des lots qu’il détient à chaque exigibilité ; reprend le solde antérieur', () => {
    const avis = avisDAppel({ echeances, cles: [cle], positions, comptes, soldesAnterieurs: { 'cpt-A': 5_000 } })
    expect(avis.anomalies).toEqual([])
    expect(avis.parCompte.map((a) => [a.compteId, a.totalAppeleCentimes, a.soldeAnterieurCentimes, a.totalAPayerCentimes])).toEqual([
      ['cpt-A', 33_300 + 33_300 + 33_400 + 33_300 + 33_300, 5_000, 166_600 + 5_000],
      ['cpt-B', 33_400, 0, 33_400],
    ])
    expect(avis.parCompte[1].lignes).toEqual([{ echeanceId: 'e-T2', lotId: 'lot-3', cle: '001', centimes: 33_400 }])
  })

  it('signale un lot sans compte en place à l’exigibilité, ou une clé inconnue', () => {
    const sansLot3 = positions.filter((p) => p.lotId !== 'lot-3')
    expect(avisDAppel({ echeances: [echeances[0]], cles: [cle], positions: sansLot3, comptes }).anomalies).toEqual([
      { code: 'lot_sans_compte', echeanceId: 'e-T1', lotId: 'lot-3' },
    ])
    expect(avisDAppel({ echeances: [{ ...echeances[0], cleId: 'cle-999' }], cles: [cle], positions, comptes }).anomalies).toEqual([
      { code: 'cle_inconnue', echeanceId: 'e-T1', lotId: null },
    ])
  })

  it('écriture de l’appel : débit 450 par compte, crédit du compte de l’échéance, équilibrée', () => {
    const avis = avisDAppel({ echeances: [echeances[1]], cles: [cle], positions, comptes })
    const traitement = traitementAppelDeFonds(avis, { id: 't-appel', date: '2026-03-20', segmentSyndicat: 'TILL', comptes })
    expect(traitement.famille).toBe('Appel de fonds')
    expect(traitement.mouvements).toEqual([
      expect.objectContaining({ compte: 'TILL.45000.00001.0', sens: 'debit', montantCentimes: 66_600 }),
      expect.objectContaining({ compte: 'TILL.45000.00002.0', sens: 'debit', montantCentimes: 33_400 }),
      expect.objectContaining({ compte: 'TILL.70100.00000.0', sens: 'credit', montantCentimes: 100_000 }),
    ])
  })

  it('cotisation au fonds de travaux : crédit du compte 10500', () => {
    const avis = avisDAppel({ echeances: [{ ...echeances[1], nature: 'fonds_travaux', id: 'e-FT' }], cles: [cle], positions, comptes })
    const traitement = traitementAppelDeFonds(avis, { id: 't-ft', date: '2026-03-20', segmentSyndicat: 'TILL', comptes })
    expect(traitement.mouvements.at(-1)).toMatchObject({ compte: 'TILL.10500.00000.0', sens: 'credit', montantCentimes: 100_000 })
  })

  it('refuse d’écrire un appel qui comporte des anomalies', () => {
    const avis = avisDAppel({ echeances: [echeances[0]], cles: [cle], positions: [], comptes })
    expect(() => traitementAppelDeFonds(avis, { id: 't', date: '2026-01-01', segmentSyndicat: 'TILL', comptes })).toThrow(/anomalie/i)
  })
})
