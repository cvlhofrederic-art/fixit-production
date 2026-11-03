import { describe, expect, it } from 'vitest'
import { creerCompteCoproprietaire, creerPosition, muterLot, type Position } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  avisDAppel,
  creerCleRepartition,
  repartir,
  traitementAppelDeFonds,
  type EcheanceAppel,
  type NatureEcheance,
} from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Répartition des charges et avis d'appel (cartographie Gestéam, tranches 21, 25 et 30 ; D1 et D2).
 * - Clé de répartition du syndicat : tantièmes de chaque lot ; total = somme des tantièmes.
 * - Répartition au tantième, au centime près, sans perte ni création (méthode des plus forts restes).
 * - Avis d'appel par COMPTE copropriétaire (D2) : quotes-parts des lots dont le compte détient les droits à
 *   l'exigibilité ; solde antérieur repris.
 * - Mutation du lot le jour de l'exigibilité (décision de Hugo du 30/10/2026 ; D. 1967 art. 6-2, relu sur Légifrance le
 *   30/10/2026) : l'appel va au compte du VENDEUR, pour le budget, les travaux et le fonds de travaux.
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

describe('mutation du lot le jour de l’exigibilité : appel au compte du vendeur (D. 1967 art. 6-2 ; décision du 30/10/2026)', () => {
  const comptes = [
    creerCompteCoproprietaire({ id: 'cpt-V', coproprieteId: 'copro-tilleuls', serie: '10', libelle: 'Vendeur' }),
    creerCompteCoproprietaire({ id: 'cpt-Q', coproprieteId: 'copro-tilleuls', serie: '11', libelle: 'Acquéreur' }),
    creerCompteCoproprietaire({ id: 'cpt-T', coproprieteId: 'copro-tilleuls', serie: '12', libelle: 'Tiers' }),
  ]
  const UN = { numerateur: 1, denominateur: 1 }
  const DEMI = { numerateur: 1, denominateur: 2 }
  const cleLot = creerCleRepartition({ id: 'cle-L9', coproprieteId: 'copro-tilleuls', code: '009', libelle: 'Lot 9', lots: [{ lotId: 'lot-9', tantiemes: 100 }] })
  const enPlace = (id: string, compteId: string, surcharge: Partial<Position> = {}): Position =>
    creerPosition({ id, identiteId: `i-${id}`, lotId: 'lot-9', compteId, qualite: 'Copropriétaire', part: UN, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null, ...surcharge })
  const VEILLE = '2026-03-31'
  const MUTATION = '2026-04-01'
  const LENDEMAIN = '2026-04-02'
  /** Vente du lot 9 le 01/04/2026 (muterLot) : les positions `sortantes` sortent, l'acquéreur (cpt-Q) entre. */
  const vente = (avant: Position[], sortantes = avant.map((p) => p.id)) =>
    muterLot(avant, { lotId: 'lot-9', date: MUTATION, sortantes, entrantes: [{ id: 'pQ', identiteId: 'i-Q', compteId: 'cpt-Q', qualite: 'Copropriétaire', part: UN }] }).positions
  const echeance = (nature: NatureEcheance, exigibilite: string): EcheanceAppel => ({
    id: `${nature}:${exigibilite}`,
    coproprieteId: 'copro-tilleuls',
    cleId: 'cle-L9',
    exigibilite,
    libelle: `Appel ${nature} du ${exigibilite}`,
    montantCentimes: 10_000,
    nature,
  })
  const avis = (positions: Position[], nature: NatureEcheance, exigibilite: string) =>
    avisDAppel({ echeances: [echeance(nature, exigibilite)], cles: [cleLot], positions, comptes })
  /** Comptes appelés (avec le montant) et codes d'anomalie, pour une échéance du lot 9. */
  const appeles = (positions: Position[], nature: NatureEcheance, exigibilite: string) => {
    const resultat = avis(positions, nature, exigibilite)
    return { comptes: resultat.parCompte.map((a) => [a.compteId, a.totalAppeleCentimes]), anomalies: resultat.anomalies.map((a) => a.code) }
  }
  const au = (compteId: string) => ({ comptes: [[compteId, 10_000]], anomalies: [] })
  const NATURES = ['budget', 'travaux', 'fonds_travaux'] as const
  /** Lot 9 en indivision par moitiés, sous le seul compte cpt-V (D2 : une dette = un compte). */
  const indivision = [enPlace('pI1', 'cpt-V', { qualite: 'Indivisaire', part: DEMI }), enPlace('pI2', 'cpt-V', { qualite: 'Indivisaire', part: DEMI })]

  it.each(NATURES)('%s : exigible la veille ou le jour de la mutation → vendeur ; le lendemain → acquéreur', (nature) => {
    const positions = vente([enPlace('pV', 'cpt-V')])
    expect(appeles(positions, nature, VEILLE)).toEqual(au('cpt-V'))
    expect(appeles(positions, nature, MUTATION)).toEqual(au('cpt-V'))
    expect(appeles(positions, nature, LENDEMAIN)).toEqual(au('cpt-Q'))
  })

  it('l’appel exigible le jour de la mutation fait une ligne du compte vendeur, avec son lot et sa clé', () => {
    expect(avis(vente([enPlace('pV', 'cpt-V')]), 'budget', MUTATION).parCompte).toEqual([
      {
        compteId: 'cpt-V',
        lignes: [{ echeanceId: `budget:${MUTATION}`, lotId: 'lot-9', cle: '009', centimes: 10_000 }],
        totalAppeleCentimes: 10_000,
        soldeAnterieurCentimes: 0,
        totalAPayerCentimes: 10_000,
      },
    ])
  })

  it.each(NATURES)('%s : lot sans mutation — première position ou position de reprise : son compte dès son entrée', (nature) => {
    // Première position du lot (ou position de reprise à la prise de fonction) le 01/04/2026 : aucune position ne sort ce jour-là.
    const premiere = [enPlace('pQ', 'cpt-Q', { dateEntree: MUTATION })]
    expect(appeles(premiere, nature, VEILLE)).toEqual({ comptes: [], anomalies: ['lot_sans_compte'] })
    expect(appeles(premiere, nature, MUTATION)).toEqual(au('cpt-Q'))
    // Lot détenu depuis 2020, sans mutation : toujours le même compte.
    const stable = [enPlace('pV', 'cpt-V')]
    for (const jour of [VEILLE, MUTATION, LENDEMAIN]) expect(appeles(stable, nature, jour)).toEqual(au('cpt-V'))
  })

  it('sortie sans entrée le même jour : pas une mutation, le lot reste sans compte ce jour-là', () => {
    const sortieSeule = [enPlace('pV', 'cpt-V', { dateSortie: MUTATION, statut: 'Sorti' })]
    expect(appeles(sortieSeule, 'budget', VEILLE)).toEqual(au('cpt-V'))
    expect(appeles(sortieSeule, 'budget', MUTATION)).toEqual({ comptes: [], anomalies: ['lot_sans_compte'] })
  })

  it.each(NATURES)('%s : mutation d’un lot en indivision (ou démembré) — un seul avis, au compte du vendeur', (nature) => {
    const vendue = vente(indivision)
    expect(appeles(vendue, nature, VEILLE)).toEqual(au('cpt-V'))
    expect(appeles(vendue, nature, MUTATION)).toEqual(au('cpt-V'))
    expect(appeles(vendue, nature, LENDEMAIN)).toEqual(au('cpt-Q'))
    const demembre = [enPlace('pNu', 'cpt-V', { qualite: 'Nu propriétaire' }), enPlace('pUs', 'cpt-V', { qualite: 'Usufruitier' })]
    expect(appeles(vente(demembre), nature, MUTATION)).toEqual(au('cpt-V'))
    expect(appeles(vente(demembre), nature, LENDEMAIN)).toEqual(au('cpt-Q'))
  })

  it('cession d’une part indivise à un tiers sous un autre compte : le jour même, le vendeur seul ; ensuite, deux comptes signalés', () => {
    const cession = muterLot(indivision, {
      lotId: 'lot-9',
      date: MUTATION,
      sortantes: ['pI2'],
      entrantes: [{ id: 'pT', identiteId: 'i-T', compteId: 'cpt-T', qualite: 'Indivisaire', part: DEMI }],
    }).positions
    expect(appeles(cession, 'budget', MUTATION)).toEqual(au('cpt-V'))
    expect(appeles(cession, 'budget', LENDEMAIN)).toEqual({ comptes: [], anomalies: ['comptes_multiples'] })
  })

  it('réorganisation de l’indivision sous le même compte le jour de l’exigibilité : même redevable', () => {
    const reorganisee = muterLot(indivision, {
      lotId: 'lot-9',
      date: MUTATION,
      sortantes: ['pI1', 'pI2'],
      entrantes: [{ id: 'pV1', identiteId: 'i-pI1', compteId: 'cpt-V', qualite: 'Copropriétaire', part: UN }],
    }).positions
    for (const jour of [VEILLE, MUTATION, LENDEMAIN]) expect(appeles(reorganisee, 'fonds_travaux', jour)).toEqual(au('cpt-V'))
  })

  it('refuse une échéance dont l’exigibilité n’est pas une date ISO', () => {
    expect(() => avis([enPlace('pV', 'cpt-V')], 'budget', '01/04/2026')).toThrow(/exigibilit/i)
  })
})
