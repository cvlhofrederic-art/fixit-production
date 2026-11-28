import './fuseau-paris'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb, type ChampsSuivi } from '@/lib/administrateur-judiciaire/db/schema'
import { echeancesBudget } from '@/lib/administrateur-judiciaire/domain/appels-budget'
import { suivreEcheances } from '@/lib/administrateur-judiciaire/domain/echeancier-appels'
import { creerBudget, creerExercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import { echeancesCotisationFondsTravaux } from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import { creerCompteCoproprietaire, creerIdentite, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { creerPieceTraitement } from '@/lib/administrateur-judiciaire/domain/journal-traitements'
import { creerCleRepartition, type CleRepartition } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { creerTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * PR « base D2 » (plan des écrans, § 5.5 et 5.7) — base locale en version 3 : six tables ajoutées après le bloc
 * version(2), sans toucher aux blocs 1 et 2. Chaque table reçoit un objet du domaine tel quel ; les index servent les
 * lectures de l'écran Appels ; les index uniques refusent les doublons ; les échéances, dont l'identifiant n'est unique
 * qu'au sein du syndicat (D1), sont rangées sous la clé [syndicat + identifiant]. Données fictives.
 * Version 4 (imputation des encaissements aux comptes D2) : une table de plus, « encaissements », après ces six tables.
 * Version 5 (décision du 26/11/2026 du référent métier, PR 799, point 10 B) : la table des relevés importés, à la suite.
 */

const SUIVI: ChampsSuivi = { createdAt: '2026-11-19T09:00:00.000Z', updatedAt: '2026-11-19T09:00:00.000Z', createdBy: null, updatedBy: null }

/** Tables de la version 3, dans l'ordre du bloc, et leurs index tels que Dexie les écrit. */
const TABLES_V3: [string, string][] = [
  ['identites', 'id'],
  ['positions', 'id, lotId, identiteId'],
  ['comptesCoproprietaires', 'id, coproprieteId, &[coproprieteId+serie]'],
  ['clesRepartition', 'id, coproprieteId, &[coproprieteId+code]'],
  ['echeancesAppel', '[coproprieteId+id], coproprieteId'],
  ['traitements', 'id, coproprieteId, mandatId, &numero'],
]

/** Table de la version 4 : les encaissements des copropriétaires, lus par syndicat (D1). */
const TABLES_V4: [string, string][] = [['encaissements', 'id, coproprieteId']]

/** Table de la version 5 : les relevés importés, lus par syndicat (D1) et par compte bancaire. */
const TABLES_V5: [string, string][] = [['relevesImportes', 'id, coproprieteId, banqueId']]

const indexDe = (t: (typeof ajDb.tables)[number]): string => [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(', ')

/** Tables des versions 1 et 2, figées par l'oracle (scénario « schema »). */
function tablesV1V2(): [string, string][] {
  const oracle = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'base-locale-scenarios.json'), 'utf8')) as {
    cas: { id: string; attendu: { tables: [string, string][] } }[]
  }
  const schema = oracle.cas.find((c) => c.id === 'schema')
  if (!schema) throw new Error('Scénario « schema » absent de l’oracle.')
  return schema.attendu.tables.filter(([nom]) => ![...TABLES_V3, ...TABLES_V4, ...TABLES_V5].some(([apres]) => apres === nom))
}

const cle = (coproprieteId: string, surcharge: Partial<CleRepartition> = {}): CleRepartition =>
  creerCleRepartition({
    id: `cle-${coproprieteId}-001`,
    coproprieteId,
    code: '001',
    libelle: 'Charges communes générales',
    lots: [
      { lotId: `${coproprieteId}-lot-1`, tantiemes: 600 },
      { lotId: `${coproprieteId}-lot-2`, tantiemes: 400 },
    ],
    ...surcharge,
  })

const exercice2026 = (coproprieteId: string) =>
  creerExercice({
    coproprieteId,
    nom: '2026',
    ouverture: '2026-01-01',
    cloture: '2026-12-31',
    statut: 'Voté',
    statutIrc: 'Non déclaré',
    agId: `AG-${coproprieteId}`,
    resolutions: { budget: '4', complement: null, honoraires: null, travaux: null },
  })

/** Échéances « budget » d'un syndicat : exercice « 2026 », clé « 001 » — mêmes identifiants d'un syndicat à l'autre. */
const echeancesDuBudget = (coproprieteId: string, prevuCentimes: number) =>
  suivreEcheances(
    echeancesBudget({
      exercice: exercice2026(coproprieteId),
      budget: creerBudget([{ cle: '001', compte: '60100', rubrique: 'Eau froide', prevuCentimes }]),
      cles: [cle(coproprieteId)],
    }),
  )

const piece = (numero: number, surcharge: { coproprieteId?: string; mandatId?: string; id?: string } = {}) => {
  const id = surcharge.id ?? `tr-${numero}`
  return creerPieceTraitement({
    traitement: creerTraitement({
      id,
      famille: 'Appel de fonds',
      date: '2026-01-01',
      mouvements: [
        { compte: 'LM00.45000.00001.0', sens: 'debit', montantCentimes: 12_500 },
        { compte: 'LM00.70100.00000.0', sens: 'credit', montantCentimes: 12_500 },
      ],
    }),
    numero,
    coproprieteId: surcharge.coproprieteId ?? 'C1',
    segmentSyndicat: 'LM00',
    mandatId: surcharge.mandatId ?? 'M1',
    parametres: [],
  })
}

beforeEach(async () => {
  await viderBaseLocale()
})

describe('version 3 : six tables ajoutées, versions 1 et 2 inchangées ; version 4 : les encaissements ; version 5 : les relevés importés', () => {
  it('version 5 : les six tables de la version 3 dans l’ordre du bloc, puis « encaissements », puis « relevesImportes », avec leurs index exacts', () => {
    expect(ajDb.verno).toBe(5)
    const toutes = ajDb.tables.map((t): [string, string] => [t.name, indexDe(t)])
    expect(toutes.slice(-(TABLES_V3.length + TABLES_V4.length + TABLES_V5.length))).toEqual([...TABLES_V3, ...TABLES_V4, ...TABLES_V5])
  })

  it('les tables des versions 1 et 2 sont toutes là, dans le même ordre, index inchangés', () => {
    const avant = tablesV1V2()
    expect(avant).toHaveLength(44)
    const toutes = ajDb.tables.map((t): [string, string] => [t.name, indexDe(t)])
    expect(toutes.slice(0, avant.length)).toEqual(avant)
  })
})

describe('chaque table reçoit un objet du domaine et le rend tel quel', () => {
  it('identité, position, compte, clé, échéance, pièce de traitement', async () => {
    const identite = { ...creerIdentite({ id: 'id-1', nature: 'physique', civilite: 'Madame', nom: 'Durand', prenom: 'Anne', telecoms: [] }), ...SUIVI }
    const compte = { ...creerCompteCoproprietaire({ id: 'cpt-1', coproprieteId: 'C1', serie: '1', libelle: 'Durand' }), ...SUIVI }
    const position = {
      ...creerPosition({
        id: 'pos-1',
        identiteId: 'id-1',
        lotId: 'lot-1',
        compteId: 'cpt-1',
        qualite: 'Copropriétaire',
        part: { numerateur: 1, denominateur: 1 },
        statut: 'En place',
        dateEntree: '2026-03-12',
        dateSortie: null,
      }),
      ...SUIVI,
    }
    const cleC1 = { ...cle('C1'), ...SUIVI }
    const [echeance] = echeancesDuBudget('C1', 40_000).map((e) => ({ ...e, ...SUIVI }))
    const pieceC1 = { ...piece(1), ...SUIVI }

    await ajDb.identites.add(identite)
    await ajDb.comptesCoproprietaires.add(compte)
    await ajDb.positions.add(position)
    await ajDb.clesRepartition.add(cleC1)
    await ajDb.echeancesAppel.add(echeance)
    await ajDb.traitements.add(pieceC1)

    expect(await ajDb.identites.get('id-1')).toEqual(identite)
    expect(await ajDb.comptesCoproprietaires.get('cpt-1')).toEqual(compte)
    expect(await ajDb.positions.get('pos-1')).toEqual(position)
    expect(await ajDb.clesRepartition.get(cleC1.id)).toEqual(cleC1)
    expect(await ajDb.echeancesAppel.get(['C1', echeance.id])).toEqual(echeance)
    expect(await ajDb.traitements.get('tr-1')).toEqual(pieceC1)
  })
})

describe('lectures de l’écran Appels', () => {
  it('positions par lot (anyOf) et par identité ; comptes, clés, échéances et pièces par syndicat ; pièces par mandat ; dernière pièce', async () => {
    const position = (id: string, lotId: string, identiteId: string) => ({
      ...creerPosition({
        id,
        identiteId,
        lotId,
        compteId: `cpt-${identiteId}`,
        qualite: 'Copropriétaire',
        part: { numerateur: 1, denominateur: 1 },
        statut: 'En place',
        dateEntree: '2026-01-01',
        dateSortie: null,
      }),
      ...SUIVI,
    })
    await ajDb.positions.bulkAdd([position('pos-1', 'lot-1', 'id-1'), position('pos-2', 'lot-2', 'id-1'), position('pos-3', 'lot-3', 'id-2')])
    await ajDb.comptesCoproprietaires.bulkAdd([
      { ...creerCompteCoproprietaire({ id: 'cpt-a', coproprieteId: 'C1', serie: '1', libelle: 'A' }), ...SUIVI },
      { ...creerCompteCoproprietaire({ id: 'cpt-b', coproprieteId: 'C2', serie: '1', libelle: 'B' }), ...SUIVI },
    ])
    await ajDb.clesRepartition.bulkAdd([
      { ...cle('C1'), ...SUIVI },
      { ...cle('C2'), ...SUIVI },
    ])
    await ajDb.echeancesAppel.bulkAdd([...echeancesDuBudget('C1', 40_000), ...echeancesDuBudget('C2', 80_000)].map((e) => ({ ...e, ...SUIVI })))
    await ajDb.traitements.bulkAdd([
      { ...piece(1), ...SUIVI },
      { ...piece(3, { coproprieteId: 'C2', mandatId: 'M2' }), ...SUIVI },
      { ...piece(2, { mandatId: 'M9' }), ...SUIVI },
    ])

    const triees = (ids: string[]) => [...ids].sort((a, b) => a.localeCompare(b))
    expect(triees((await ajDb.positions.where('lotId').anyOf(['lot-1', 'lot-3']).toArray()).map((p) => p.id))).toEqual(['pos-1', 'pos-3'])
    expect(triees((await ajDb.positions.where('identiteId').equals('id-1').toArray()).map((p) => p.id))).toEqual(['pos-1', 'pos-2'])
    expect((await ajDb.comptesCoproprietaires.where('coproprieteId').equals('C2').toArray()).map((c) => c.id)).toEqual(['cpt-b'])
    expect((await ajDb.clesRepartition.where('coproprieteId').equals('C1').toArray()).map((c) => c.id)).toEqual(['cle-C1-001'])
    expect((await ajDb.echeancesAppel.where('coproprieteId').equals('C1').toArray()).map((e) => e.coproprieteId)).toEqual(['C1', 'C1', 'C1', 'C1'])
    expect(triees((await ajDb.traitements.where('coproprieteId').equals('C1').toArray()).map((p) => p.id))).toEqual(['tr-1', 'tr-2'])
    expect((await ajDb.traitements.where('mandatId').equals('M9').toArray()).map((p) => p.id)).toEqual(['tr-2'])
    expect((await ajDb.traitements.orderBy('numero').last())?.numero).toBe(3)
    // compte d'un numéro 450 : syndicat et série
    expect((await ajDb.comptesCoproprietaires.where('[coproprieteId+serie]').equals(['C1', '00001']).first())?.id).toBe('cpt-a')
  })
})

describe('doublons refusés par les index uniques', () => {
  it('même série dans un syndicat : refusée ; dans un autre : permise', async () => {
    await ajDb.comptesCoproprietaires.add({ ...creerCompteCoproprietaire({ id: 'cpt-1', coproprieteId: 'C1', serie: '7', libelle: 'A' }), ...SUIVI })
    await expect(
      ajDb.comptesCoproprietaires.add({ ...creerCompteCoproprietaire({ id: 'cpt-2', coproprieteId: 'C1', serie: '00007', libelle: 'B' }), ...SUIVI }),
    ).rejects.toMatchObject({ name: 'ConstraintError' })
    await ajDb.comptesCoproprietaires.add({ ...creerCompteCoproprietaire({ id: 'cpt-3', coproprieteId: 'C2', serie: '7', libelle: 'C' }), ...SUIVI })
    expect(await ajDb.comptesCoproprietaires.count()).toBe(2)
  })

  it('même code de clé dans un syndicat : refusé ; dans un autre : permis', async () => {
    await ajDb.clesRepartition.add({ ...cle('C1'), ...SUIVI })
    await expect(ajDb.clesRepartition.add({ ...cle('C1', { id: 'autre-cle' }), ...SUIVI })).rejects.toMatchObject({ name: 'ConstraintError' })
    await ajDb.clesRepartition.add({ ...cle('C2'), ...SUIVI })
    expect(await ajDb.clesRepartition.count()).toBe(2)
  })

  it('même numéro de pièce : refusé, même dans un autre syndicat (séquence unique du cabinet)', async () => {
    await ajDb.traitements.add({ ...piece(1), ...SUIVI })
    await expect(ajDb.traitements.add({ ...piece(1, { id: 'tr-autre', coproprieteId: 'C2' }), ...SUIVI })).rejects.toMatchObject({
      name: 'ConstraintError',
    })
    expect(await ajDb.traitements.count()).toBe(1)
  })
})

describe('échéances : identifiant unique au sein du syndicat seulement (D1)', () => {
  it('deux syndicats, même exercice « 2026 », même clé « 001 » : les deux échéanciers du budget sont gardés', async () => {
    const c1 = echeancesDuBudget('C1', 40_000)
    const c2 = echeancesDuBudget('C2', 80_000)
    // mêmes identifiants produits par le domaine (B-2026-001-1…4)
    expect(c1.map((e) => e.id)).toEqual(c2.map((e) => e.id))
    await ajDb.echeancesAppel.bulkAdd(c1.map((e) => ({ ...e, ...SUIVI })))
    await ajDb.echeancesAppel.bulkAdd(c2.map((e) => ({ ...e, ...SUIVI })))
    expect(await ajDb.echeancesAppel.count()).toBe(8)
    expect((await ajDb.echeancesAppel.get(['C1', c1[0].id]))?.montantCentimes).toBe(10_000)
    expect((await ajDb.echeancesAppel.get(['C2', c2[0].id]))?.montantCentimes).toBe(20_000)
  })

  it('cotisations au fonds de travaux (FT-2026-n) : gardées pour chaque syndicat ; un doublon dans le même syndicat est refusé', async () => {
    const cotisations = (coproprieteId: string, centimes: number) =>
      suivreEcheances(
        echeancesCotisationFondsTravaux({
          coproprieteId,
          cleId: `cle-${coproprieteId}-001`,
          exercice: '2026',
          cotisationAnnuelleCentimes: centimes,
          provisions: [
            { exigibilite: '2026-01-01', montantCentimes: 10_000 },
            { exigibilite: '2026-04-01', montantCentimes: 10_000 },
          ],
        }),
      ).map((e) => ({ ...e, ...SUIVI }))
    await ajDb.echeancesAppel.bulkAdd(cotisations('C1', 2_000))
    await ajDb.echeancesAppel.bulkAdd(cotisations('C2', 4_000))
    expect((await ajDb.echeancesAppel.toArray()).map((e) => [e.coproprieteId, e.id, e.montantCentimes])).toEqual([
      ['C1', 'FT-2026-1', 1_000],
      ['C1', 'FT-2026-2', 1_000],
      ['C2', 'FT-2026-1', 2_000],
      ['C2', 'FT-2026-2', 2_000],
    ])
    await expect(ajDb.echeancesAppel.add(cotisations('C1', 2_000)[0])).rejects.toMatchObject({ name: 'ConstraintError' })
  })

  it('les identifiants des clés et des pièces viennent de l’appelant, pas d’un code ou d’un libellé du syndicat', () => {
    expect(cle('C1', { id: 'k-aleatoire', code: '001' }).id).toBe('k-aleatoire')
    expect(piece(5, { id: 'p-aleatoire' }).id).toBe('p-aleatoire')
  })
})
