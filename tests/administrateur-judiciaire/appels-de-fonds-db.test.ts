import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ecrireAppelDeFonds,
  enregistrerNouvelAppel,
  lireDonneesAppels,
  ouvrirExercice,
} from '@/lib/administrateur-judiciaire/db/appels-de-fonds'
import { echeancesAppelDuSyndicat } from '@/lib/administrateur-judiciaire/db/echeances-appel'
import { repoComptesCoproprietaires, repoIdentites, repoPositions } from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb, type ChampsSuivi, type Copropriete, type Lot, type Mandat } from '@/lib/administrateur-judiciaire/db/schema'
import { creerCompteCoproprietaire, creerIdentite, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'

/**
 * Écritures de l'écran « Appels de fonds » (db/appels-de-fonds.ts), dans la base locale, hors du store :
 * - « Nouvel appel de fonds » : une échéance « Prévu » (ajouterEcheancesAppel), sur une clé du syndicat ou sur la clé
 *   générale « 001 » tirée des tantièmes des lots, créée dans la même transaction ;
 * - « Écrire l'appel » : la pièce « Appel de fonds » (enregistrerPieceTraitement) et le passage « Appelé » des échéances
 *   (marquerAppelees), dans une seule transaction ; refusé, rien n'est écrit ;
 * - « Ouvrir l'exercice » : un exercice du syndicat, sans chevauchement.
 * Données fictives.
 */

const SUIVI: ChampsSuivi = { createdAt: '2026-11-20T09:00:00.000Z', updatedAt: '2026-11-20T09:00:00.000Z', createdBy: null, updatedBy: null }

const copro = (id: string, code: string): Copropriete => ({
  id,
  code,
  nom: `Résidence ${code} (fictive)`,
  adresse: '1 rue de l’Exemple, 75000 Paris',
  nbLots: 3,
  budget: 0,
  depense: 0,
  impayes: 0,
  fondsTravaux: 0,
  ...SUIVI,
})

const mandat = (id: string, coproprieteId: string): Mandat => ({
  id,
  coproprieteId,
  fondement: 'L. 1965 art. 29-1',
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

const lot = (id: string, coproprieteId: string, numero: string, numerateur: number): Lot => ({
  id,
  coproprieteId,
  numero,
  tantiemes: { numerateur, denominateur: 1000 },
  ...SUIVI,
})

const SAISIE = { libelle: 'Provisions T1 2027', nature: 'budget' as const, exigibilite: '2027-01-01', montantCentimes: 100_001, cleId: null }

/** Identités, comptes et positions fictifs : un compte par lot, sauf le lot 3 si `sansLot3`. */
async function d2({ sansLot3 = false } = {}) {
  for (const [n, lotId] of [
    ['1', 'L1'],
    ['2', 'L2'],
    ['3', 'L3'],
  ] as const) {
    if (sansLot3 && lotId === 'L3') continue
    const { id: _i, ...identite } = creerIdentite({ id: `i${n}`, nature: 'physique', civilite: '', nom: `Personne ${n}`, prenom: null, telecoms: [] })
    await repoIdentites.create(identite, { id: `i${n}` })
    const { id: _c, ...compte } = creerCompteCoproprietaire({ id: `c${n}`, coproprieteId: 'C1', serie: n, libelle: `Copropriétaire ${n} (fictif)` })
    await repoComptesCoproprietaires.create(compte, { id: `c${n}` })
    const { id: _p, ...position } = creerPosition({
      id: `p${n}`,
      identiteId: `i${n}`,
      lotId,
      compteId: `c${n}`,
      qualite: 'Copropriétaire',
      part: { numerateur: 1, denominateur: 1 },
      statut: 'En place',
      dateEntree: '2020-01-01',
      dateSortie: null,
    })
    await repoPositions.create(position, { id: `p${n}` })
  }
}

beforeEach(async () => {
  await viderBaseLocale()
  await ajDb.coproprietes.bulkAdd([copro('C1', 'ACAC'), copro('C2', 'BOUL')])
  await ajDb.mandats.bulkAdd([mandat('M1', 'C1'), mandat('M2', 'C2')])
  await ajDb.lots.bulkAdd([lot('L1', 'C1', '1', 450), lot('L2', 'C1', '2', 350), lot('L3', 'C1', '3', 200), lot('L9', 'C2', '1', 1000)])
})

describe('« Nouvel appel de fonds » : une échéance « Prévu »', () => {
  it('clé générale « 001 » créée depuis les tantièmes des lots du syndicat, dans la même transaction', async () => {
    const { echeance, cle, cleCreee } = await enregistrerNouvelAppel('C1', SAISIE, { actor: 'test' })
    expect(cleCreee).toBe(true)
    expect(cle).toMatchObject({ coproprieteId: 'C1', code: '001', libelle: 'Charges communes générales', totalTantiemes: 1000 })
    expect(cle.lots).toEqual([
      { lotId: 'L1', tantiemes: 450 },
      { lotId: 'L2', tantiemes: 350 },
      { lotId: 'L3', tantiemes: 200 },
    ])
    expect(echeance).toMatchObject({
      id: 'A-20270101-001-1',
      coproprieteId: 'C1',
      cleId: cle.id,
      statut: 'Prévu',
      montantCentimes: 100_001,
      nature: 'budget',
      libelle: 'Provisions T1 2027',
      traitementId: null,
      relancable: true,
      createdBy: 'test',
    })
    const journal = (await ajDb.activityLog.toArray()).map((e) => [e.entite, e.action])
    expect(journal).toEqual([
      ['clesRepartition', 'create'],
      ['echeancesAppel', 'create'],
    ])
  })

  it('même date et même clé : numéro suivant ; clé existante réutilisée', async () => {
    const premier = await enregistrerNouvelAppel('C1', SAISIE)
    const second = await enregistrerNouvelAppel('C1', { ...SAISIE, libelle: 'Fonds de travaux T1 2027', nature: 'fonds_travaux', montantCentimes: 5_000, cleId: premier.cle.id })
    expect(second.cleCreee).toBe(false)
    expect(second.echeance.id).toBe('A-20270101-001-2')
    expect(await ajDb.clesRepartition.count()).toBe(1)
    expect((await echeancesAppelDuSyndicat('C1')).map((e) => e.id)).toEqual(['A-20270101-001-1', 'A-20270101-001-2'])
  })

  it('refus, rien n’est écrit : libellé vide, montant nul ou non entier, date invalide, clé d’un autre syndicat, aucun lot à tantièmes', async () => {
    await expect(enregistrerNouvelAppel('C1', { ...SAISIE, libelle: '  ' })).rejects.toThrow(/libellé/i)
    await expect(enregistrerNouvelAppel('C1', { ...SAISIE, montantCentimes: 0 })).rejects.toThrow(/montant/i)
    await expect(enregistrerNouvelAppel('C1', { ...SAISIE, montantCentimes: 12.5 })).rejects.toThrow(/montant/i)
    await expect(enregistrerNouvelAppel('C1', { ...SAISIE, exigibilite: '2027-02-30' })).rejects.toThrow(/date/i)
    const autre = await enregistrerNouvelAppel('C2', SAISIE)
    await ajDb.activityLog.clear()
    await expect(enregistrerNouvelAppel('C1', { ...SAISIE, cleId: autre.cle.id })).rejects.toThrow(/clé/i)
    await ajDb.lots.where('coproprieteId').equals('C1').modify({ tantiemes: { numerateur: 0, denominateur: 1000 } })
    await expect(enregistrerNouvelAppel('C1', SAISIE)).rejects.toThrow(/tantièmes/i)
    expect(await echeancesAppelDuSyndicat('C1')).toEqual([])
    expect(await ajDb.clesRepartition.where('coproprieteId').equals('C1').count()).toBe(0)
    expect(await ajDb.activityLog.count()).toBe(0)
  })
})

describe('« Ouvrir l’exercice »', () => {
  it('exercice du syndicat en préparation ; chevauchement refusé', async () => {
    const exercice = await ouvrirExercice('C1', { ouverture: '2027-01-01', cloture: '2027-12-31' })
    expect(exercice).toMatchObject({ coproprieteId: 'C1', nom: '2027', annee: 2027, ouverture: '2027-01-01', cloture: '2027-12-31', statut: 'Préparation' })
    await expect(ouvrirExercice('C1', { ouverture: '2027-07-01', cloture: '2028-06-30' })).rejects.toThrow(/chevauche/i)
    await expect(ouvrirExercice('C1', { ouverture: '2028-01-01', cloture: '2027-12-31' })).rejects.toThrow(/clôture/i)
    expect(await ouvrirExercice('C2', { ouverture: '2027-07-01', cloture: '2028-06-30' })).toMatchObject({ nom: '2027-2028', annee: 2027 })
    expect(await ajDb.exercices.count()).toBe(2)
  })
})

describe('« Écrire l’appel » : pièce et statut « Appelé » ensemble', () => {
  it('pièce « Appel de fonds » équilibrée, numérotée, au mandat ; échéances « Appelé » ; journal', async () => {
    await d2()
    await ouvrirExercice('C1', { ouverture: '2027-01-01', cloture: '2027-12-31' })
    const { cle } = await enregistrerNouvelAppel('C1', SAISIE)
    await enregistrerNouvelAppel('C1', { ...SAISIE, libelle: 'Provisions T2 2027', exigibilite: '2027-04-01', montantCentimes: 60_000, cleId: cle.id })
    const { piece, appelees, avertissements } = await ecrireAppelDeFonds('C1', { jusquAu: '2027-01-01', mandatId: 'M1' }, { actor: 'test' })
    expect(piece).toMatchObject({ numero: 1, famille: 'Appel de fonds', date: '2027-01-01', coproprieteId: 'C1', mandatId: 'M1', statut: 'Produit', nbLignes: 4 })
    const debits = piece.traitement.mouvements.filter((m) => m.sens === 'debit').reduce((s, m) => s + m.montantCentimes, 0)
    const credits = piece.traitement.mouvements.filter((m) => m.sens === 'credit').reduce((s, m) => s + m.montantCentimes, 0)
    expect([debits, credits]).toEqual([100_001, 100_001])
    expect(piece.traitement.mouvements.map((m) => m.compte)).toEqual(['ACAC.45000.00001.0', 'ACAC.45000.00002.0', 'ACAC.45000.00003.0', 'ACAC.70100.00000.0'])
    expect(appelees.map((e) => [e.id, e.statut, e.traitementId])).toEqual([['A-20270101-001-1', 'Appelé', piece.id]])
    expect(avertissements).toEqual([])
    const echeancier = await echeancesAppelDuSyndicat('C1')
    expect(echeancier.map((e) => [e.id, e.statut])).toEqual([
      ['A-20270101-001-1', 'Appelé'],
      ['A-20270401-001-1', 'Prévu'],
    ])
    expect(echeancier[0].echeancesDeLAppel).toEqual(['A-20270101-001-1'])
    const journal = await ajDb.activityLog.where('entite').anyOf('traitements', 'echeancesAppel').toArray()
    expect(journal.filter((e) => e.action === 'update').map((e) => [e.entite, e.entiteId])).toEqual([['echeancesAppel', 'C1:A-20270101-001-1']])
    expect(journal.filter((e) => e.entite === 'traitements').map((e) => e.entiteId)).toEqual([piece.id])
  })

  it('deux exigibilités dans le même exercice : une pièce, datée de la plus ancienne, avertissement pour l’autre', async () => {
    await d2()
    await ouvrirExercice('C1', { ouverture: '2027-01-01', cloture: '2027-12-31' })
    const { cle } = await enregistrerNouvelAppel('C1', SAISIE)
    await enregistrerNouvelAppel('C1', { ...SAISIE, libelle: 'Provisions T2 2027', exigibilite: '2027-04-01', montantCentimes: 60_000, cleId: cle.id })
    const { piece, appelees, avertissements } = await ecrireAppelDeFonds('C1', { jusquAu: '2027-04-01', mandatId: 'M1' })
    expect(piece.date).toBe('2027-01-01')
    expect(appelees).toHaveLength(2)
    expect(avertissements.map((a) => a.code)).toEqual(['date_autre_que_exigibilite'])
  })

  it('sous-comptes du 450 (réglage passé par l’appelant) : le budget au 450-1', async () => {
    await d2()
    await ouvrirExercice('C1', { ouverture: '2027-01-01', cloture: '2027-12-31' })
    await enregistrerNouvelAppel('C1', SAISIE)
    const { piece } = await ecrireAppelDeFonds('C1', {
      jusquAu: '2027-01-01',
      mandatId: 'M1',
      sousComptes450: { decision: 'AG du 10/06/2026, résolution 12 (fictive)', planBudget: '45010' },
    })
    expect(piece.traitement.mouvements.filter((m) => m.sens === 'debit').map((m) => m.compte)).toEqual([
      'ACAC.45010.00001.0',
      'ACAC.45010.00002.0',
      'ACAC.45010.00003.0',
    ])
  })

  it('refus, rien n’est écrit : lot sans compte, clé inconnue, exercice absent, rien à appeler, mandat d’un autre syndicat', async () => {
    await d2({ sansLot3: true })
    await enregistrerNouvelAppel('C1', SAISIE)
    await expect(ecrireAppelDeFonds('C1', { jusquAu: '2027-01-01', mandatId: 'M1' })).rejects.toThrow(/anomalie/i)
    const { id: _c, ...compte } = creerCompteCoproprietaire({ id: 'c3', coproprieteId: 'C1', serie: '3', libelle: 'Copropriétaire 3 (fictif)' })
    await repoComptesCoproprietaires.create(compte, { id: 'c3' })
    const { id: _p, ...position } = creerPosition({ id: 'p3', identiteId: 'i1', lotId: 'L3', compteId: 'c3', qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 }, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null })
    await repoPositions.create(position, { id: 'p3' })
    await expect(ecrireAppelDeFonds('C1', { jusquAu: '2027-01-01', mandatId: 'M1' })).rejects.toThrow(/exercice/i)
    await ouvrirExercice('C1', { ouverture: '2027-01-01', cloture: '2027-12-31' })
    await expect(ecrireAppelDeFonds('C1', { jusquAu: '2027-01-01', mandatId: 'M2' })).rejects.toThrow(/autre syndicat/i)
    await ajDb.clesRepartition.clear()
    await expect(ecrireAppelDeFonds('C1', { jusquAu: '2027-01-01', mandatId: 'M1' })).rejects.toThrow(/anomalie/i)
    await expect(ecrireAppelDeFonds('C1', { jusquAu: '2026-12-31', mandatId: 'M1' })).rejects.toThrow(/aucune échéance/i)
    expect(await ajDb.traitements.count()).toBe(0)
    expect((await echeancesAppelDuSyndicat('C1')).map((e) => e.statut)).toEqual(['Prévu'])
  })
})

describe('lecture des données de l’écran', () => {
  it('tables du syndicat seulement ; fiches non reprises comptées ; contentieux lu sur le dossier de recouvrement de la fiche reprise', async () => {
    await d2()
    await enregistrerNouvelAppel('C1', SAISIE)
    await enregistrerNouvelAppel('C2', SAISIE)
    await ajDb.coproprietaires.bulkAdd([
      { id: 'f1', lotId: 'L1', nom: 'Ancienne fiche (fictive)', tel: '', mail: '', solde: 0, statut: 'À jour', ...SUIVI },
      { id: 'f9', lotId: 'L9', nom: 'Autre syndicat (fictive)', tel: '', mail: '', solde: 0, statut: 'À jour', ...SUIVI },
    ])
    await ajDb.comptesCoproprietaires.update('c2', { reprise: { coproprietaireId: 'f2', soldeDuCentimes: 0, statutFiche: 'Contentieux', releveLe: '2026-11-01' } })
    await ajDb.impayes.add({ id: 'imp-1', coproprietaireId: 'f2', montant: 100, statut: 'procedure:2026-10-01', ...SUIVI })
    const lues = await lireDonneesAppels('C1')
    expect(lues.lots.map((l) => l.id)).toEqual(['L1', 'L2', 'L3'])
    expect(lues.comptes.map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
    expect(lues.positions.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(lues.identites.map((i) => i.id)).toEqual(['i1', 'i2', 'i3'])
    expect(lues.echeances.map((e) => e.coproprieteId)).toEqual(['C1'])
    expect(lues.cles).toHaveLength(1)
    expect(lues.fichesNonReprises).toBe(1)
    expect([...lues.comptesEnContentieux]).toEqual(['c2'])
    expect(lues.exercices).toEqual([])
    expect(lues.pieces).toEqual([])
  })
})
