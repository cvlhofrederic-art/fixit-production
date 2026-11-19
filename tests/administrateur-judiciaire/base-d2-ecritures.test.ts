import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ajouterEcheancesAppel,
  changerSuiviEcheances,
  echeancesAppelDuSyndicat,
} from '@/lib/administrateur-judiciaire/db/echeances-appel'
import {
  repoClesRepartition,
  repoComptesCoproprietaires,
  repoPositions,
  repoTraitements,
} from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb, type ChampsSuivi, type Copropriete, type Mandat } from '@/lib/administrateur-judiciaire/db/schema'
import {
  annulerPieceTraitement,
  changerStatutTraitement,
  enregistrerPieceTraitement,
} from '@/lib/administrateur-judiciaire/db/traitements'
import { echeancesBudget } from '@/lib/administrateur-judiciaire/domain/appels-budget'
import { creerBudget, creerExercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import { creerCleRepartition, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { creerTraitement, type FamilleTraitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Écritures gardées des tables D1 de la version 3 : une pièce de traitement ne s'écrit que par db/traitements.ts (numéro
 * de la séquence du cabinet tiré dans la transaction, segment du syndicat, statut d'une étape, annulation par écriture
 * contraire, jamais de suppression : R6) ; une échéance d'appel ne change de statut que par une fonction
 * d'echeancier-appels.ts (db/echeances-appel.ts), sous la clé [syndicat + identifiant]. Données fictives.
 */

const SUIVI: ChampsSuivi = { createdAt: '2026-11-19T09:00:00.000Z', updatedAt: '2026-11-19T09:00:00.000Z', createdBy: null, updatedBy: null }

const copro = (id: string, code: string): Copropriete => ({
  id,
  code,
  nom: `Résidence ${code}`,
  adresse: '1 rue Fictive',
  nbLots: 2,
  budget: 0,
  depense: 0,
  impayes: 0,
  fondsTravaux: 0,
  ...SUIVI,
})

const mandat = (id: string, coproprieteId: string): Mandat => ({
  id,
  coproprieteId,
  fondement: 'Art. 29-1',
  motif: 'Essai',
  tribunal: 'TJ Fictif',
  rg: '26/00001',
  ordonnance: new Date(2026, 2, 12),
  dureeMois: 12,
  echeance: new Date(2027, 2, 12),
  statut: 'Actif',
  pill: 'ok',
  notifOrdonnance: '',
  ...SUIVI,
})

const traitement = (id: string, famille: FamilleTraitement = 'Appel de fonds', segment = 'LM00') =>
  creerTraitement({
    id,
    famille,
    date: '2026-01-01',
    mouvements: [
      { compte: `${segment}.45000.00001.0`, sens: famille === 'Encaissement' ? 'credit' : 'debit', montantCentimes: 12_500 },
      { compte: `${segment}.${famille === 'Encaissement' ? '51200' : '70100'}.00000.0`, sens: famille === 'Encaissement' ? 'debit' : 'credit', montantCentimes: 12_500 },
    ],
  })

beforeEach(async () => {
  await viderBaseLocale()
  await ajDb.coproprietes.bulkAdd([copro('C1', 'LM'), copro('C2', 'CV')])
  await ajDb.mandats.bulkAdd([mandat('M1', 'C1'), mandat('M2', 'C2')])
})

describe('pièces de traitement : enregistrerPieceTraitement', () => {
  it('numéro de la séquence du cabinet, segment lu sur le syndicat, statut initial du cycle, journal', async () => {
    const p1 = await enregistrerPieceTraitement({ traitement: traitement('tr-1'), coproprieteId: 'C1', mandatId: 'M1' }, { actor: 'test' })
    const p2 = await enregistrerPieceTraitement({ traitement: traitement('tr-2', 'Appel de fonds', 'CV00'), coproprieteId: 'C2', mandatId: 'M2' })
    const p3 = await enregistrerPieceTraitement({ traitement: traitement('tr-3', 'Encaissement'), coproprieteId: 'C1', mandatId: 'M1' })
    expect([p1.numero, p2.numero, p3.numero]).toEqual([1, 2, 3])
    expect(p1).toMatchObject({ id: 'tr-1', coproprieteId: 'C1', mandatId: 'M1', statut: 'Produit', nbLignes: 2, createdBy: 'test' })
    expect(p3.statut).toBe('Enregistré')
    expect(await ajDb.traitements.get('tr-2')).toEqual(p2)
    const journal = await ajDb.activityLog.where('entiteId').equals('tr-1').toArray()
    expect(journal.map((l) => [l.entite, l.action, l.qui])).toEqual([['traitements', 'create', 'test']])
  })

  it('écritures concurrentes : numéros distincts, à la suite du plus grand', async () => {
    await ajDb.traitements.add({
      ...(await enregistrerPieceTraitement({ traitement: traitement('tr-0'), coproprieteId: 'C1', mandatId: 'M1' })),
      id: 'tr-41',
      numero: 41,
    })
    const pieces = await Promise.all(
      ['a', 'b', 'c'].map((s) => enregistrerPieceTraitement({ traitement: traitement(`tr-${s}`), coproprieteId: 'C1', mandatId: 'M1' })),
    )
    expect(pieces.map((p) => p.numero).sort((x, y) => x - y)).toEqual([42, 43, 44])
  })

  it('refus, rien n’est écrit : syndicat ou mandat introuvable, mandat d’un autre syndicat, compte d’un autre syndicat', async () => {
    await expect(enregistrerPieceTraitement({ traitement: traitement('tr-1'), coproprieteId: 'C9', mandatId: 'M1' })).rejects.toThrow(/introuvable/)
    await expect(enregistrerPieceTraitement({ traitement: traitement('tr-1'), coproprieteId: 'C1', mandatId: 'M9' })).rejects.toThrow(/introuvable/)
    await expect(enregistrerPieceTraitement({ traitement: traitement('tr-1'), coproprieteId: 'C1', mandatId: 'M2' })).rejects.toThrow(
      /autre syndicat/,
    )
    await expect(
      enregistrerPieceTraitement({ traitement: traitement('tr-1', 'Appel de fonds', 'CV00'), coproprieteId: 'C1', mandatId: 'M1' }),
    ).rejects.toThrow(/autre syndicat/)
    expect(await ajDb.traitements.count()).toBe(0)
    expect(await ajDb.activityLog.count()).toBe(0)
  })
})

describe('pièces de traitement : statut et annulation', () => {
  it('statut : une étape en avant seulement (Produit → Émis) ; jamais « Annulé » par un changement de statut', async () => {
    await enregistrerPieceTraitement({ traitement: traitement('tr-1'), coproprieteId: 'C1', mandatId: 'M1' })
    const emise = await changerStatutTraitement('tr-1', 'Émis', { actor: 'test' })
    expect(emise).toMatchObject({ statut: 'Émis', updatedBy: 'test' })
    await expect(changerStatutTraitement('tr-1', 'Produit')).rejects.toThrow(/une étape en avant/)
    await expect(changerStatutTraitement('tr-1', 'Annulé')).rejects.toThrow(/écriture contraire/)
    await expect(changerStatutTraitement('tr-9', 'Émis')).rejects.toThrow(/introuvable/)
    expect((await ajDb.traitements.get('tr-1'))?.statut).toBe('Émis')
    // ordre du journal : par identifiant (aléatoire), pas chronologique
    expect((await ajDb.activityLog.where('entiteId').equals('tr-1').toArray()).map((l) => l.action).sort((a, b) => a.localeCompare(b))).toEqual(['create', 'update'])
  })

  it('annulation d’une pièce « Enregistré » : écriture contraire numérotée à la suite, pièce d’origine « Annulé » avec annuleePar', async () => {
    await enregistrerPieceTraitement({ traitement: traitement('tr-1', 'Encaissement'), coproprieteId: 'C1', mandatId: 'M1' })
    const { piece, annulation } = await annulerPieceTraitement('tr-1', { id: 'tr-1-annul', date: '2026-01-05' }, { actor: 'test' })
    expect(piece).toMatchObject({ id: 'tr-1', statut: 'Annulé', annuleePar: 'tr-1-annul' })
    expect(annulation).toMatchObject({ id: 'tr-1-annul', numero: 2, famille: "Annulation d'encaissement", mandatId: 'M1', coproprieteId: 'C1' })
    expect(await ajDb.traitements.count()).toBe(2)
    await expect(annulerPieceTraitement('tr-1', { id: 'tr-1-bis', date: '2026-01-06' })).rejects.toThrow(/déjà annulée/)
    await expect(changerStatutTraitement('tr-1', 'Imputé')).rejects.toThrow(/annulée/)
  })

  it('annulation refusée pour une pièce de document (appel de fonds : son circuit, echeancier-appels.ts) ; rien n’est écrit', async () => {
    await enregistrerPieceTraitement({ traitement: traitement('tr-1'), coproprieteId: 'C1', mandatId: 'M1' })
    await expect(annulerPieceTraitement('tr-1', { id: 'tr-1-annul', date: '2026-01-05' })).rejects.toThrow(/propre circuit/)
    expect(await ajDb.traitements.count()).toBe(1)
    expect((await ajDb.traitements.get('tr-1'))?.statut).toBe('Produit')
  })
})

describe('repoTraitements : gardé (R6)', () => {
  it('lecture permise ; création, modification des champs de la pièce et suppression refusées', async () => {
    const piece = await enregistrerPieceTraitement({ traitement: traitement('tr-1'), coproprieteId: 'C1', mandatId: 'M1' })
    expect(await repoTraitements.get('tr-1')).toEqual(piece)
    expect(await repoTraitements.list({ coproprieteId: 'C1' })).toEqual([piece])
    const { id: _id, createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub, ...donnees } = piece
    await expect(repoTraitements.create(donnees)).rejects.toThrow(/enregistrerPieceTraitement/)
    for (const patch of [
      { statut: 'Annulé' as const },
      { annuleePar: 'x' },
      { parametres: [] },
      { famille: 'Encaissement' as const },
      { nbLignes: 9 },
      { numero: 7 },
      { date: '2026-02-01' },
      { coproprieteId: 'C2' },
      { mandatId: 'M2' },
      { traitement: piece.traitement },
    ])
      await expect(repoTraitements.update('tr-1', patch), Object.keys(patch)[0]).rejects.toThrow(/figé/)
    await expect(repoTraitements.remove('tr-1')).rejects.toThrow(/écriture contraire/)
    expect(await ajDb.traitements.get('tr-1')).toEqual(piece)
  })
})

describe('repositories sans garde : positions, comptes, clés (écrits par le domaine)', () => {
  it('création et lecture, avec journal', async () => {
    await repoClesRepartition.create(
      creerCleRepartition({ id: 'k', coproprieteId: 'C1', code: '001', libelle: 'Générales', lots: [{ lotId: 'L1', tantiemes: 1 }] }),
      { id: 'k' },
    )
    await repoComptesCoproprietaires.create({ coproprieteId: 'C1', serie: '00001', libelle: 'Durand' }, { id: 'cpt-1' })
    await repoPositions.create(
      {
        identiteId: 'id-1',
        lotId: 'L1',
        compteId: 'cpt-1',
        qualite: 'Copropriétaire',
        part: { numerateur: 1, denominateur: 1 },
        statut: 'En place',
        dateEntree: '2026-01-01',
        dateSortie: null,
      },
      { id: 'pos-1' },
    )
    expect((await repoPositions.list({ lotId: 'L1' })).map((p) => p.id)).toEqual(['pos-1'])
    expect((await ajDb.activityLog.toArray()).map((l) => l.entite).sort((a, b) => a.localeCompare(b))).toEqual([
      'clesRepartition',
      'comptesCoproprietaires',
      'positions',
    ])
  })
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

const echeances = (coproprieteId: string, prevuCentimes: number): EcheanceAppel[] =>
  echeancesBudget({
    exercice: exercice2026(coproprieteId),
    budget: creerBudget([{ cle: '001', compte: '60100', rubrique: 'Eau froide', prevuCentimes }]),
    cles: [creerCleRepartition({ id: `cle-${coproprieteId}`, coproprieteId, code: '001', libelle: 'Générales', lots: [{ lotId: 'L1', tantiemes: 1 }] })],
  })

describe('échéancier des appels : db/echeances-appel.ts', () => {
  it('ajout : suivi par défaut (« Prévu »), par syndicat, mêmes identifiants dans deux syndicats ; journal sous « syndicat:identifiant »', async () => {
    const c1 = await ajouterEcheancesAppel(echeances('C1', 40_000), { actor: 'test' })
    await ajouterEcheancesAppel(echeances('C2', 80_000))
    expect(c1.map((e) => [e.coproprieteId, e.id, e.statut, e.traitementId, e.montantCentimes])).toEqual([
      ['C1', 'B-2026-001-1', 'Prévu', null, 10_000],
      ['C1', 'B-2026-001-2', 'Prévu', null, 10_000],
      ['C1', 'B-2026-001-3', 'Prévu', null, 10_000],
      ['C1', 'B-2026-001-4', 'Prévu', null, 10_000],
    ])
    expect((await echeancesAppelDuSyndicat('C2')).map((e) => e.montantCentimes)).toEqual([20_000, 20_000, 20_000, 20_000])
    expect(await ajDb.echeancesAppel.count()).toBe(8)
    const journal = await ajDb.activityLog.where('entiteId').equals('C1:B-2026-001-1').toArray()
    expect(journal.map((l) => [l.entite, l.action, l.qui])).toEqual([['echeancesAppel', 'create', 'test']])
  })

  it('ajout refusé, rien n’est écrit : échéance déjà dans l’échéancier du syndicat, deux syndicats mêlés, échéance négative', async () => {
    await ajouterEcheancesAppel(echeances('C1', 40_000))
    await expect(ajouterEcheancesAppel(echeances('C1', 40_000))).rejects.toThrow(/déjà/)
    await expect(ajouterEcheancesAppel([...echeances('C2', 4_000), { ...echeances('C1', 4_000)[0], id: 'autre' }])).rejects.toThrow(
      /un seul syndicat/,
    )
    await expect(ajouterEcheancesAppel([{ ...echeances('C2', 4_000)[0], montantCentimes: -1 }])).rejects.toThrow(/montant invalide/)
    expect(await ajDb.echeancesAppel.count()).toBe(4)
  })

  it('suivi par les fonctions du domaine : mise en attente, reprise, annulation avant appel, regroupement, relançable', async () => {
    await ajouterEcheancesAppel(echeances('C1', 40_000))
    await ajouterEcheancesAppel(echeances('C2', 80_000))
    const [enAttente] = await changerSuiviEcheances('C1', { operation: 'mettreEnAttente', id: 'B-2026-001-2', motif: 'Travaux suspendus' }, { actor: 'test' })
    expect(enAttente).toMatchObject({ coproprieteId: 'C1', id: 'B-2026-001-2', statut: 'En attente', motifAttente: 'Travaux suspendus', updatedBy: 'test' })
    // l'échéance de même identifiant de l'autre syndicat ne bouge pas
    expect((await ajDb.echeancesAppel.get(['C2', 'B-2026-001-2']))?.statut).toBe('Prévu')
    await changerSuiviEcheances('C1', { operation: 'reprendre', id: 'B-2026-001-2' })
    await changerSuiviEcheances('C1', { operation: 'annulerAvantAppel', id: 'B-2026-001-4' })
    await changerSuiviEcheances('C1', { operation: 'fixerRegroupement', id: 'B-2026-001-1', regroupement: 2 })
    await changerSuiviEcheances('C1', { operation: 'fixerRelancable', id: 'B-2026-001-1', relancable: false })
    expect((await echeancesAppelDuSyndicat('C1')).map((e) => [e.id, e.statut, e.regroupement, e.relancable])).toEqual([
      ['B-2026-001-1', 'Prévu', 2, false],
      ['B-2026-001-2', 'Prévu', null, true],
      ['B-2026-001-3', 'Prévu', null, true],
      ['B-2026-001-4', 'Annulé', null, true],
    ])
    expect((await ajDb.activityLog.where('entiteId').equals('C1:B-2026-001-2').toArray()).map((l) => l.action).sort((a, b) => a.localeCompare(b))).toEqual([
      'create',
      'update',
      'update',
    ])
  })

  it('refus du domaine, rien n’est écrit : envoi d’une échéance non appelée, annulation avant appel d’une échéance appelée, échéance inconnue', async () => {
    await ajouterEcheancesAppel(echeances('C1', 40_000))
    await expect(changerSuiviEcheances('C1', { operation: 'marquerEnvoyees', ids: ['B-2026-001-1'], le: '2026-01-02' })).rejects.toThrow(
      /seule une échéance appelée/,
    )
    // échéance appelée (telle que l'écrira la PR écran, avec sa pièce) : son annulation passe par l'écriture contraire
    const appelee = await ajDb.echeancesAppel.get(['C1', 'B-2026-001-1'])
    if (!appelee) throw new Error('échéance attendue')
    await ajDb.echeancesAppel.put({ ...appelee, statut: 'Appelé', traitementId: 'tr-1', echeancesDeLAppel: ['B-2026-001-1'] })
    await expect(changerSuiviEcheances('C1', { operation: 'annulerAvantAppel', id: 'B-2026-001-1' })).rejects.toThrow(/écriture contraire/)
    await expect(changerSuiviEcheances('C1', { operation: 'reprendre', id: 'inconnue' })).rejects.toThrow(/introuvable/)
    await expect(changerSuiviEcheances('C2', { operation: 'reprendre', id: 'B-2026-001-2' })).rejects.toThrow(/introuvable/)
    expect((await echeancesAppelDuSyndicat('C1')).map((e) => e.statut)).toEqual(['Appelé', 'Prévu', 'Prévu', 'Prévu'])
    expect(await ajDb.activityLog.where('entite').equals('echeancesAppel').count()).toBe(4)
  })

  it('envoi d’une échéance appelée : date posée une fois', async () => {
    await ajouterEcheancesAppel(echeances('C1', 40_000))
    const appelee = await ajDb.echeancesAppel.get(['C1', 'B-2026-001-1'])
    if (!appelee) throw new Error('échéance attendue')
    await ajDb.echeancesAppel.put({ ...appelee, statut: 'Appelé', traitementId: 'tr-1', echeancesDeLAppel: ['B-2026-001-1'] })
    const [envoyee] = await changerSuiviEcheances('C1', { operation: 'marquerEnvoyees', ids: ['B-2026-001-1'], le: '2025-12-20' })
    expect(envoyee.envoyeLe).toBe('2025-12-20')
    // même date : sans effet, rien de journalisé
    expect(await changerSuiviEcheances('C1', { operation: 'marquerEnvoyees', ids: ['B-2026-001-1'], le: '2025-12-20' })).toEqual([])
    await expect(changerSuiviEcheances('C1', { operation: 'marquerEnvoyees', ids: ['B-2026-001-1'], le: '2025-12-21' })).rejects.toThrow(/ne se réécrit pas/)
  })
})
