import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ecrireAppelDeFonds, enregistrerNouvelAppel, ouvrirExercice } from '@/lib/administrateur-judiciaire/db/appels-de-fonds'
import { changerSuiviEcheances } from '@/lib/administrateur-judiciaire/db/echeances-appel'
import {
  annulerEncaissementEcrit,
  ecrireEncaissements,
  lireEtatDesComptes,
  lireSoldesAnterieurs,
  lirePostesDuCompte,
  type OptionsEncaissements,
  type SaisieEncaissement,
} from '@/lib/administrateur-judiciaire/db/encaissements'
import { repoComptesCoproprietaires, repoIdentites, repoPositions } from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb, type Banque, type ChampsSuivi, type Copropriete, type Lot, type Mandat } from '@/lib/administrateur-judiciaire/db/schema'
import type { JournalEncaissement } from '@/lib/administrateur-judiciaire/domain/encaissements-pieces'
import { creerCompteCoproprietaire, creerIdentite, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import type { SousComptes450 } from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Imputation des encaissements aux comptes copropriétaires D2, couche données (db/encaissements.ts), sans écran :
 * - les postes d'un compte se relisent de l'échéancier appelé (ecrireAppelDeFonds), recoupés avec l'écriture de l'appel ;
 * - un encaissement s'enregistre, s'impute (C. civ. art. 1342-10) et s'écrit (R7, R8) dans une seule transaction ;
 * - il s'annule par une écriture contraire qui défait son imputation (F110) ;
 * - un refus n'écrit rien.
 * Données fictives. Lots 1, 2 et 3 du syndicat C1 : 450, 350 et 200 millièmes, comptes c1, c2 et c3.
 */

const SUIVI: ChampsSuivi = { createdAt: '2026-11-24T09:00:00.000Z', updatedAt: '2026-11-24T09:00:00.000Z', createdBy: null, updatedBy: null }

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

const banque = (id: string, coproprieteId: string, surcharge: Partial<Banque> = {}): Banque => ({
  id,
  coproprieteId,
  nature: 'courant',
  libelle: `Compte courant ${id} (fictif)`,
  ...surcharge,
  ...SUIVI,
})

/** Identité, compte et position fictifs d'un lot. */
async function titulaire(n: string, lotId: string, coproprieteId: string) {
  const { id: _i, ...identite } = creerIdentite({ id: `i${n}`, nature: 'physique', civilite: '', nom: `Personne ${n}`, prenom: null, telecoms: [] })
  await repoIdentites.create(identite, { id: `i${n}` })
  const { id: _c, ...compte } = creerCompteCoproprietaire({ id: `c${n}`, coproprieteId, serie: n, libelle: `Copropriétaire ${n} (fictif)` })
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

const T4_2026 = 'A-20261001-001-1'
const T1_2027 = 'A-20270101-001-1'
const FONDS_T1_2027 = 'A-20270101-001-2'

const JOURNAL: JournalEncaissement = { code: 'BA', banqueId: 'b1', compteEncaissement: 'ACAC.51200.00000.0' }
const OPTIONS: OptionsEncaissements = { date: '2027-01-15', mandatId: 'M1', journal: JOURNAL }
const virement = (compteId: string, montantCentimes: number, surcharge: Partial<SaisieEncaissement> = {}): SaisieEncaissement => ({
  compteId,
  montantCentimes,
  piece: { mode: 'Virement', numero: 'VIR-0001' },
  ...surcharge,
})

/**
 * Trois échéances sur la clé générale : provisions T4 2026 (600,00 € : 270,00 / 210,00 / 120,00), provisions T1 2027
 * (1 000,01 € : 450,01 / 350,00 / 200,00) et fonds de travaux T1 2027 (50,00 € : 22,50 / 17,50 / 10,00).
 */
async function saisirLesEcheances() {
  await ouvrirExercice('C1', { ouverture: '2026-01-01', cloture: '2026-12-31' })
  await ouvrirExercice('C1', { ouverture: '2027-01-01', cloture: '2027-12-31' })
  const { cle } = await enregistrerNouvelAppel('C1', { libelle: 'Provisions T4 2026', nature: 'budget', exigibilite: '2026-10-01', montantCentimes: 60_000, cleId: null })
  await enregistrerNouvelAppel('C1', { libelle: 'Provisions T1 2027', nature: 'budget', exigibilite: '2027-01-01', montantCentimes: 100_001, cleId: cle.id })
  await enregistrerNouvelAppel('C1', { libelle: 'Fonds de travaux T1 2027', nature: 'fonds_travaux', exigibilite: '2027-01-01', montantCentimes: 5_000, cleId: cle.id })
  return cle
}

/** Les deux appels écrits : pièce n° 1 (T4 2026), pièce n° 2 (T1 2027, budget et fonds de travaux). */
async function appeler(sousComptes450: SousComptes450 | null = null) {
  await saisirLesEcheances()
  const t4 = await ecrireAppelDeFonds('C1', { jusquAu: '2026-10-01', mandatId: 'M1', sousComptes450 })
  const t1 = await ecrireAppelDeFonds('C1', { jusquAu: '2027-01-01', mandatId: 'M1', sousComptes450 })
  return { t4: t4.piece, t1: t1.piece }
}

const regles = async (compteId: string) => (await lirePostesDuCompte('C1', compteId)).map((p) => [p.appelId, p.regleCentimes])
const sansTraitement = <T extends { traitementId: string }>(mouvements: T[]) => mouvements.map(({ traitementId: _t, ...m }) => m)
const origine = (appelId: string, typeAppel: 'Budget' | 'Fonds travaux') => ({ origine: { type: 'appel', appelId, typeAppel } })

/** Ce qu'un refus ne doit pas changer. */
const compter = async () => ({ pieces: await ajDb.traitements.count(), encaissements: await ajDb.encaissements.count(), journal: await ajDb.activityLog.count() })

beforeEach(async () => {
  await viderBaseLocale()
  await ajDb.coproprietes.bulkAdd([copro('C1', 'ACAC'), copro('C2', 'BOUL')])
  await ajDb.mandats.bulkAdd([mandat('M1', 'C1'), mandat('M2', 'C2')])
  await ajDb.lots.bulkAdd([lot('L1', 'C1', '1', 450), lot('L2', 'C1', '2', 350), lot('L3', 'C1', '3', 200), lot('L9', 'C2', '1', 1000)])
  await ajDb.banques.bulkAdd([banque('b1', 'C1'), banque('b2', 'C2'), banque('b-clos', 'C1', { actif: false })])
  await titulaire('1', 'L1', 'C1')
  await titulaire('2', 'L2', 'C1')
  await titulaire('3', 'L3', 'C1')
  await titulaire('9', 'L9', 'C2')
})

describe('postes d’un compte : relus de l’échéancier appelé', () => {
  it('aucun poste tant que l’échéance est « Prévu » ; un poste par échéance appelée et par lot, non réglé', async () => {
    await saisirLesEcheances()
    expect(await lirePostesDuCompte('C1', 'c1')).toEqual([])
    await ecrireAppelDeFonds('C1', { jusquAu: '2026-10-01', mandatId: 'M1' })
    expect(await lirePostesDuCompte('C1', 'c1')).toEqual([
      {
        id: `${T4_2026}:L1`,
        compteId: 'c1',
        appelId: T4_2026,
        typeAppel: 'Budget',
        libelle: 'Provisions T4 2026',
        exigibilite: '2026-10-01',
        montantCentimes: 27_000,
        regleCentimes: 0,
        contentieux: false,
        lotId: 'L1',
        cle: '001',
        baseCentimes: 60_000,
        tantiemes: { lot: 450, total: 1000 },
      },
    ])
    await ecrireAppelDeFonds('C1', { jusquAu: '2027-01-01', mandatId: 'M1' })
    expect((await lirePostesDuCompte('C1', 'c1')).map((p) => [p.appelId, p.typeAppel, p.exigibilite, p.montantCentimes])).toEqual([
      [T4_2026, 'Budget', '2026-10-01', 27_000],
      [T1_2027, 'Budget', '2027-01-01', 45_001],
      [FONDS_T1_2027, 'Fonds travaux', '2027-01-01', 2_250],
    ])
    expect((await lirePostesDuCompte('C1', 'c3')).map((p) => p.montantCentimes)).toEqual([12_000, 20_000, 1_000])
  })

  it('D1 : compte d’un autre syndicat refusé ; les postes d’un syndicat ne se lisent pas dans un autre', async () => {
    await appeler()
    await expect(lirePostesDuCompte('C1', 'c9')).rejects.toThrow(/autre syndicat/)
    await expect(lirePostesDuCompte('C1', 'inconnu')).rejects.toThrow(/introuvable/)
    expect((await lireEtatDesComptes('C2')).postes).toEqual([])
  })

  it('clé modifiée après l’appel : la répartition relue ne correspond plus à l’écriture, lecture et encaissement refusés', async () => {
    await appeler()
    const cle = await ajDb.clesRepartition.where('coproprieteId').equals('C1').first()
    await ajDb.clesRepartition.update(cle!.id, {
      lots: [
        { lotId: 'L1', tantiemes: 500 },
        { lotId: 'L2', tantiemes: 300 },
        { lotId: 'L3', tantiemes: 200 },
      ],
    })
    await expect(lirePostesDuCompte('C1', 'c1')).rejects.toThrow(/ne correspond pas à l'écriture de l'appel n° 1/)
    const avant = await compter()
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000)], OPTIONS)).rejects.toThrow(/ne correspond pas à l'écriture/)
    expect(await compter()).toEqual(avant)
  })
})

describe('encaissement imputé : ordre de l’art. 1342-10 du code civil, écriture R7 et R8', () => {
  it('le poste échu le plus ancien d’abord, puis proportionnellement à ancienneté égale ; pièce, ligne et journal', async () => {
    await appeler()
    const { piece, encaissements, postes } = await ecrireEncaissements('C1', [virement('c1', 40_000, { id: 'enc-1', payeur: 'Personne 1' })], OPTIONS, { actor: 'test' })
    // 270,00 € sur le T4 2026 ; le reste (130,00 €) au prorata des deux postes du 01/01/2027 (450,01 € et 22,50 €).
    const lignes = [
      { posteId: `${T4_2026}:L1`, montantCentimes: 27_000 },
      { posteId: `${T1_2027}:L1`, montantCentimes: 12_381 },
      { posteId: `${FONDS_T1_2027}:L1`, montantCentimes: 619 },
    ]
    expect(encaissements).toHaveLength(1)
    expect(encaissements[0]).toMatchObject({
      id: 'enc-1',
      coproprieteId: 'C1',
      compteId: 'c1',
      date: '2027-01-15',
      montantCentimes: 40_000,
      payeur: 'Personne 1',
      statut: 'Enregistré',
      impute: true,
      traitementId: piece.id,
      rapprochement: null,
      piece: { mode: 'Virement', numero: 'VIR-0001', banqueEmettrice: null, libelle: null, remiseId: null },
      journal: JOURNAL,
      imputation: { lignes, resteAImputerCentimes: 0, designationsIgnorees: [], designationPartielleRefusee: false, imputerSurAVenir: false, sousComptes450: null },
      createdBy: 'test',
    })
    expect(await ajDb.encaissements.get('enc-1')).toEqual(encaissements[0])
    // R7 : débit du 512, crédit du 450 ; R8 : l'appel d'origine sur chaque crédit.
    expect(piece).toMatchObject({ numero: 3, famille: 'Encaissement', date: '2027-01-15', coproprieteId: 'C1', mandatId: 'M1', statut: 'Enregistré', nbLignes: 4 })
    expect(sansTraitement(piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'debit', montantCentimes: 40_000 },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 27_000, ...origine(T4_2026, 'Budget') },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 12_381, ...origine(T1_2027, 'Budget') },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 619, ...origine(FONDS_T1_2027, 'Fonds travaux') },
    ])
    expect(postes.filter((p) => p.compteId === 'c1').map((p) => p.regleCentimes)).toEqual([27_000, 12_381, 619])
    expect(await regles('c1')).toEqual([
      [T4_2026, 27_000],
      [T1_2027, 12_381],
      [FONDS_T1_2027, 619],
    ])
    expect(await regles('c2')).toEqual([
      [T4_2026, 0],
      [T1_2027, 0],
      [FONDS_T1_2027, 0],
    ])
    const journal = (await ajDb.activityLog.where('entite').anyOf('encaissements', 'traitements').toArray()).filter((e) => e.entiteId === 'enc-1' || e.entiteId === piece.id)
    // Clé primaire du journal tirée au hasard : l'ordre de lecture n'est pas celui de l'écriture.
    expect(journal.map((e) => `${e.entite} ${e.action} ${e.qui}`).sort((a, b) => a.localeCompare(b))).toEqual(['encaissements create test', 'traitements create test'])
  })

  it('désignation par le débiteur : le poste désigné est servi avant un poste plus ancien', async () => {
    await appeler()
    const { encaissements, piece } = await ecrireEncaissements('C1', [virement('c1', 2_250, { postesDesignes: [`${FONDS_T1_2027}:L1`] })], OPTIONS)
    expect(encaissements[0].imputation.lignes).toEqual([{ posteId: `${FONDS_T1_2027}:L1`, montantCentimes: 2_250 }])
    expect(encaissements[0].postesDesignes).toEqual([`${FONDS_T1_2027}:L1`])
    expect(sansTraitement(piece.traitement.mouvements)[1]).toEqual({ compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 2_250, ...origine(FONDS_T1_2027, 'Fonds travaux') })
    expect(await regles('c1')).toEqual([
      [T4_2026, 0],
      [T1_2027, 0],
      [FONDS_T1_2027, 2_250],
    ])
  })

  it('désignation qui ne solde pas le poste : imputation légale et signalement, sauf paiement partiel accepté (art. 1342-4)', async () => {
    await appeler()
    const refusee = await ecrireEncaissements('C1', [virement('c1', 1_000, { postesDesignes: [`${T1_2027}:L1`] })], OPTIONS)
    expect(refusee.encaissements[0].imputation).toMatchObject({ lignes: [{ posteId: `${T4_2026}:L1`, montantCentimes: 1_000 }], designationPartielleRefusee: true })
    const acceptee = await ecrireEncaissements('C1', [virement('c1', 1_000, { postesDesignes: [`${T1_2027}:L1`], designationPartielleAcceptee: true })], OPTIONS)
    expect(acceptee.encaissements[0].imputation).toMatchObject({ lignes: [{ posteId: `${T1_2027}:L1`, montantCentimes: 1_000 }], designationPartielleRefusee: false })
  })

  it('reliquat « à imputer » : crédit du 450 sans appel d’origine, gardé sur l’encaissement et dans le solde du compte', async () => {
    await saisirLesEcheances()
    await ecrireAppelDeFonds('C1', { jusquAu: '2026-10-01', mandatId: 'M1' })
    const { encaissements, piece } = await ecrireEncaissements('C1', [virement('c2', 25_000)], { ...OPTIONS, date: '2026-10-05' })
    expect(encaissements[0].imputation).toMatchObject({ lignes: [{ posteId: `${T4_2026}:L2`, montantCentimes: 21_000 }], resteAImputerCentimes: 4_000 })
    expect(sansTraitement(piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'debit', montantCentimes: 25_000 },
      { compte: 'ACAC.45000.00002.0', sens: 'credit', montantCentimes: 21_000, ...origine(T4_2026, 'Budget') },
      { compte: 'ACAC.45000.00002.0', sens: 'credit', montantCentimes: 4_000 },
    ])
    const { soldes } = await lireEtatDesComptes('C1')
    expect(soldes).toEqual([
      { compteId: 'c1', appeleCentimes: 27_000, regleCentimes: 0, resteDuCentimes: 27_000, creditAImputerCentimes: 0, soldeCentimes: 27_000 },
      { compteId: 'c2', appeleCentimes: 21_000, regleCentimes: 21_000, resteDuCentimes: 0, creditAImputerCentimes: 4_000, soldeCentimes: -4_000 },
      { compteId: 'c3', appeleCentimes: 12_000, regleCentimes: 0, resteDuCentimes: 12_000, creditAImputerCentimes: 0, soldeCentimes: 12_000 },
    ])
  })

  it('appels non échus : rien n’est servi d’office ; à la demande du débiteur, le budget à venir l’est, jamais le fonds de travaux', async () => {
    await saisirLesEcheances()
    // L'appel du T1 2027 est écrit avant son exigibilité : ses postes ne sont pas échus le 20/12/2026.
    await changerSuiviEcheances('C1', { operation: 'mettreEnAttente', id: T4_2026, motif: 'Essai' })
    await ecrireAppelDeFonds('C1', { jusquAu: '2027-01-01', mandatId: 'M1' })
    const avant = { ...OPTIONS, date: '2026-12-20' }
    const office = await ecrireEncaissements('C1', [virement('c3', 5_000)], avant)
    expect(office.encaissements[0].imputation).toMatchObject({ lignes: [], resteAImputerCentimes: 5_000, imputerSurAVenir: false })
    const demande = await ecrireEncaissements('C1', [virement('c3', 25_000, { imputerSurAVenir: true })], avant)
    expect(demande.encaissements[0].imputation).toMatchObject({
      lignes: [{ posteId: `${T1_2027}:L3`, montantCentimes: 20_000 }],
      resteAImputerCentimes: 5_000,
      imputerSurAVenir: true,
    })
    expect(await regles('c3')).toEqual([
      [T1_2027, 20_000],
      [FONDS_T1_2027, 0],
    ])
    expect((await lireEtatDesComptes('C1')).soldes.find((s) => s.compteId === 'c3')).toMatchObject({ resteDuCentimes: 1_000, creditAImputerCentimes: 10_000, soldeCentimes: -9_000 })
  })

  it('deux encaissements successifs : le second part du réglé laissé par le premier', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 10_000)], OPTIONS)
    expect(await regles('c1')).toEqual([
      [T4_2026, 10_000],
      [T1_2027, 0],
      [FONDS_T1_2027, 0],
    ])
    const second = await ecrireEncaissements('C1', [virement('c1', 20_000, { piece: { mode: 'Virement', numero: 'VIR-0002' } })], { ...OPTIONS, date: '2027-01-20' })
    // 170,00 € soldent le T4 2026 ; 30,00 € au prorata des deux postes du 01/01/2027.
    expect(second.encaissements[0].imputation.lignes).toEqual([
      { posteId: `${T4_2026}:L1`, montantCentimes: 17_000 },
      { posteId: `${T1_2027}:L1`, montantCentimes: 2_857 },
      { posteId: `${FONDS_T1_2027}:L1`, montantCentimes: 143 },
    ])
    expect(await regles('c1')).toEqual([
      [T4_2026, 27_000],
      [T1_2027, 2_857],
      [FONDS_T1_2027, 143],
    ])
    expect(second.piece.numero).toBe(4)
  })

  it('plusieurs encaissements du même jour dans une pièce : chacun sur les soldes laissés par le précédent', async () => {
    await appeler()
    const { piece, encaissements } = await ecrireEncaissements(
      'C1',
      [virement('c1', 20_000), virement('c2', 21_000, { piece: { mode: 'Virement', numero: 'VIR-0002' } }), virement('c1', 7_000, { piece: { mode: 'Virement', numero: 'VIR-0003' } })],
      { ...OPTIONS, famille: 'Fichier Virement reçus' },
    )
    expect(piece.famille).toBe('Fichier Virement reçus')
    expect(encaissements.map((e) => e.imputation.lignes)).toEqual([
      [{ posteId: `${T4_2026}:L1`, montantCentimes: 20_000 }],
      [{ posteId: `${T4_2026}:L2`, montantCentimes: 21_000 }],
      [{ posteId: `${T4_2026}:L1`, montantCentimes: 7_000 }],
    ])
    expect(encaissements.every((e) => e.traitementId === piece.id)).toBe(true)
    expect(await ajDb.encaissements.where('coproprieteId').equals('C1').count()).toBe(3)
    expect((await regles('c1'))[0]).toEqual([T4_2026, 27_000])
  })

  it('sous-comptes du 450 (J67, R104) : le budget crédité au 450-1 qui l’a porté ; réglage différent de celui de l’appel refusé', async () => {
    const reglage: SousComptes450 = { decision: 'AG du 10/06/2026, résolution 12 (fictive)', planBudget: '45010' }
    await appeler(reglage)
    const avant = await compter()
    await expect(ecrireEncaissements('C1', [virement('c1', 40_000)], OPTIONS)).rejects.toThrow(/ACAC\.45000\.00001\.0.*n'a pas été débité par l'appel/)
    expect(await compter()).toEqual(avant)
    const { piece, encaissements } = await ecrireEncaissements('C1', [virement('c1', 40_000)], { ...OPTIONS, sousComptes450: reglage })
    expect(piece.traitement.mouvements.map((m) => [m.compte, m.montantCentimes])).toEqual([
      ['ACAC.51200.00000.0', 40_000],
      ['ACAC.45010.00001.0', 27_000],
      ['ACAC.45010.00001.0', 12_381],
      ['ACAC.45000.00001.0', 619],
    ])
    expect(encaissements[0].imputation.sousComptes450).toEqual(reglage)
    // L'annulation contre-passe ce qui a été écrit : le réglage gardé sur l'encaissement, sans le repasser.
    const { piece: annulation } = await annulerEncaissementEcrit('C1', encaissements[0].id, { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-0001' })
    expect(annulation.traitement.mouvements.filter((m) => m.sens === 'debit').map((m) => m.compte)).toEqual(['ACAC.45010.00001.0', 'ACAC.45010.00001.0', 'ACAC.45000.00001.0'])
  })
})

describe('annulation d’un encaissement (F110) : écriture contraire, imputation défaite', () => {
  it('chèque impayé : pièce « Annulation d’encaissement », encaissement « Annulé », postes de nouveau dus ; l’encaissement suivant est gardé', async () => {
    await appeler()
    const cheque = await ecrireEncaissements('C1', [virement('c1', 40_000, { id: 'enc-cheque', piece: { mode: 'Chèque', numero: '0001234', banqueEmettrice: 'Banque fictive' } })], OPTIONS)
    await ecrireEncaissements('C1', [virement('c1', 20_000, { id: 'enc-suivant' })], { ...OPTIONS, date: '2027-01-20' })
    // Le second est parti des soldes laissés par le premier : 326,20 € et 16,31 € restaient dus au 01/01/2027.
    expect(await regles('c1')).toEqual([
      [T4_2026, 27_000],
      [T1_2027, 12_381 + 19_048],
      [FONDS_T1_2027, 619 + 952],
    ])
    const { piece, encaissement, postes } = await annulerEncaissementEcrit(
      'C1',
      'enc-cheque',
      { date: '2027-01-25', motif: ' Chèque impayé : provision insuffisante ', piece: 'AVIS-2027-0042' },
      { actor: 'test' },
    )
    expect(piece).toMatchObject({ numero: 5, famille: "Annulation d'encaissement", date: '2027-01-25', coproprieteId: 'C1', mandatId: 'M1', statut: 'Enregistré' })
    expect(piece.traitement.annule).toBe(cheque.piece.id)
    expect(sansTraitement(piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'credit', montantCentimes: 40_000 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 27_000, ...origine(T4_2026, 'Budget') },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 12_381, ...origine(T1_2027, 'Budget') },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 619, ...origine(FONDS_T1_2027, 'Fonds travaux') },
    ])
    expect(encaissement).toMatchObject({
      id: 'enc-cheque',
      statut: 'Annulé',
      impute: true,
      traitementId: cheque.piece.id,
      annulation: { le: '2027-01-25', motif: 'Chèque impayé : provision insuffisante', piece: 'AVIS-2027-0042', traitementId: piece.id, dateComptable: '2027-01-25' },
      updatedBy: 'test',
    })
    expect(await ajDb.encaissements.get('enc-cheque')).toEqual(encaissement)
    // La pièce de l'encaissement ne change pas : seule son écriture contraire s'ajoute.
    expect((await ajDb.traitements.get(cheque.piece.id))?.statut).toBe('Enregistré')
    expect(postes.filter((p) => p.compteId === 'c1').map((p) => p.regleCentimes)).toEqual([0, 19_048, 952])
    expect(await regles('c1')).toEqual([
      [T4_2026, 0],
      [T1_2027, 19_048],
      [FONDS_T1_2027, 952],
    ])
    // Le T4 2026, de nouveau dû à son exigibilité d'origine, est servi le premier par l'encaissement suivant.
    const apres = await ecrireEncaissements('C1', [virement('c1', 5_000)], { ...OPTIONS, date: '2027-01-26' })
    expect(apres.encaissements[0].imputation.lignes).toEqual([{ posteId: `${T4_2026}:L1`, montantCentimes: 5_000 }])
  })

  it('reliquat annulé avec l’encaissement : le crédit « à imputer » disparaît du solde', async () => {
    await saisirLesEcheances()
    await ecrireAppelDeFonds('C1', { jusquAu: '2026-10-01', mandatId: 'M1' })
    const { encaissements } = await ecrireEncaissements('C1', [virement('c2', 25_000)], { ...OPTIONS, date: '2026-10-05' })
    const { piece } = await annulerEncaissementEcrit('C1', encaissements[0].id, { date: '2026-10-09', motif: 'Virement retourné', piece: 'AVIS-0002' })
    expect(sansTraitement(piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'credit', montantCentimes: 25_000 },
      { compte: 'ACAC.45000.00002.0', sens: 'debit', montantCentimes: 21_000, ...origine(T4_2026, 'Budget') },
      { compte: 'ACAC.45000.00002.0', sens: 'debit', montantCentimes: 4_000 },
    ])
    expect((await lireEtatDesComptes('C1')).soldes.find((s) => s.compteId === 'c2')).toEqual({
      compteId: 'c2',
      appeleCentimes: 21_000,
      regleCentimes: 0,
      resteDuCentimes: 21_000,
      creditAImputerCentimes: 0,
      soldeCentimes: 21_000,
    })
  })

  it('refus, rien n’est écrit : déjà annulé, débit antérieur à l’écriture, sans motif ni pièce, date invalide, autre syndicat, inconnu', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 40_000, { id: 'enc-1' })], OPTIONS)
    const saisie = { date: '2027-01-25', motif: 'Chèque impayé', piece: 'AVIS-0003' }
    const avant = await compter()
    await expect(annulerEncaissementEcrit('C1', 'enc-1', { ...saisie, date: '2027-01-14' })).rejects.toThrow(/antérieur à l'écriture/)
    await expect(annulerEncaissementEcrit('C1', 'enc-1', { ...saisie, motif: ' ' })).rejects.toThrow(/motif/)
    await expect(annulerEncaissementEcrit('C1', 'enc-1', { ...saisie, piece: '' })).rejects.toThrow(/pièce/)
    await expect(annulerEncaissementEcrit('C1', 'enc-1', { ...saisie, date: '2027-02-30' })).rejects.toThrow(/date/i)
    await expect(annulerEncaissementEcrit('C2', 'enc-1', saisie)).rejects.toThrow(/autre syndicat/)
    await expect(annulerEncaissementEcrit('C1', 'enc-1', { ...saisie, mandatId: 'M2' })).rejects.toThrow(/autre syndicat/)
    await expect(annulerEncaissementEcrit('C1', 'inconnu', saisie)).rejects.toThrow(/introuvable/)
    expect(await compter()).toEqual(avant)
    await annulerEncaissementEcrit('C1', 'enc-1', saisie)
    const apres = await compter()
    await expect(annulerEncaissementEcrit('C1', 'enc-1', saisie)).rejects.toThrow(/déjà annulé/)
    expect(await compter()).toEqual(apres)
  })
})

describe('refus nets : rien n’est écrit', () => {
  it('compte d’un autre syndicat (D1), montant nul ou non entier, date invalide', async () => {
    await appeler()
    const avant = await compter()
    await expect(ecrireEncaissements('C1', [virement('c9', 10_000)], OPTIONS)).rejects.toThrow(/c9.*autre syndicat.*D1/)
    await expect(ecrireEncaissements('C1', [virement('inconnu', 10_000)], OPTIONS)).rejects.toThrow(/introuvable/)
    await expect(ecrireEncaissements('C1', [virement('c1', 0)], OPTIONS)).rejects.toThrow(/montant/i)
    await expect(ecrireEncaissements('C1', [virement('c1', 12.5)], OPTIONS)).rejects.toThrow(/montant/i)
    await expect(ecrireEncaissements('C1', [virement('c1', -500)], OPTIONS)).rejects.toThrow(/montant/i)
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000)], { ...OPTIONS, date: '2027-02-30' })).rejects.toThrow(/date/i)
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000)], { ...OPTIONS, date: '15/01/2027' })).rejects.toThrow(/date/i)
    // Un encaissement refusé dans un lot : aucun du lot n'est écrit.
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000), virement('c9', 10_000)], OPTIONS)).rejects.toThrow(/autre syndicat/)
    expect(await compter()).toEqual(avant)
    expect(await regles('c1')).toEqual([
      [T4_2026, 0],
      [T1_2027, 0],
      [FONDS_T1_2027, 0],
    ])
  })

  it('syndicat, mandat, compte bancaire et journal : D1 et D-BANQUE', async () => {
    await appeler()
    const avant = await compter()
    const un = [virement('c1', 10_000)]
    await expect(ecrireEncaissements('inconnue', un, OPTIONS)).rejects.toThrow(/Copropriété introuvable/)
    await expect(ecrireEncaissements('C1', un, { ...OPTIONS, mandatId: 'M2' })).rejects.toThrow(/autre syndicat/)
    await expect(ecrireEncaissements('C1', un, { ...OPTIONS, journal: { ...JOURNAL, banqueId: 'b2' } })).rejects.toThrow(/Compte bancaire « b2 ».*autre syndicat/)
    await expect(ecrireEncaissements('C1', un, { ...OPTIONS, journal: { ...JOURNAL, banqueId: 'inconnu' } })).rejects.toThrow(/Compte bancaire « inconnu » introuvable/)
    await expect(ecrireEncaissements('C1', un, { ...OPTIONS, journal: { ...JOURNAL, banqueId: 'b-clos' } })).rejects.toThrow(/clôturé/)
    await expect(ecrireEncaissements('C1', un, { ...OPTIONS, journal: { ...JOURNAL, compteEncaissement: 'BOUL.51200.00000.0' } })).rejects.toThrow(/autre syndicat/)
    await expect(ecrireEncaissements('C1', un, { ...OPTIONS, journal: { ...JOURNAL, compteEncaissement: 'ACAC.53000.00000.0' } })).rejects.toThrow(/compte 512/)
    expect(await compter()).toEqual(avant)
  })

  it('pièce et saisie : aucun encaissement, chèque sans numéro, espèces, identifiant en double ou déjà pris, poste désigné étranger', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 1_000, { id: 'enc-1' })], OPTIONS)
    const avant = await compter()
    await expect(ecrireEncaissements('C1', [], OPTIONS)).rejects.toThrow(/aucun encaissement/i)
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000, { piece: { mode: 'Chèque' } })], OPTIONS)).rejects.toThrow(/numéro du chèque/)
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000, { piece: { mode: 'Espèces' } })], OPTIONS)).rejects.toThrow(/Espèces/)
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000, { id: 'enc-1' })], OPTIONS)).rejects.toThrow(/enc-1.*déjà enregistré/)
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000, { id: 'x' }), virement('c2', 10_000, { id: 'x' })], OPTIONS)).rejects.toThrow(/double/)
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000, { postesDesignes: [`${T4_2026}:L2`] })], OPTIONS)).rejects.toThrow(/autre compte/)
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000, { postesDesignes: ['inconnu'] })], OPTIONS)).rejects.toThrow(/inconnu/)
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000)], { ...OPTIONS, famille: 'Prélèvement' })).rejects.toThrow(/Prélèvement/)
    expect(await compter()).toEqual(avant)
  })

  it('À valider — compte repris avec un solde dû que l’ancienne fiche porte encore, sans écriture : encaissement refusé', async () => {
    await appeler()
    await ajDb.comptesCoproprietaires.update('c2', { reprise: { coproprietaireId: 'f2', soldeDuCentimes: 12_300, statutFiche: 'Impayé', releveLe: '2026-11-01' } })
    await ajDb.comptesCoproprietaires.update('c3', { reprise: { coproprietaireId: 'f3', soldeDuCentimes: 0, statutFiche: 'À jour', releveLe: '2026-11-01' } })
    const avant = await compter()
    await expect(ecrireEncaissements('C1', [virement('c2', 10_000)], OPTIONS)).rejects.toThrow(/solde repris de 123,00\s€.*aucune écriture/)
    expect(await compter()).toEqual(avant)
    // Un compte repris sans solde dû s'encaisse ; le solde repris est rendu à part, jamais ajouté au solde des postes.
    await ecrireEncaissements('C1', [virement('c3', 10_000)], OPTIONS)
    const { soldesRepris } = await lireEtatDesComptes('C1')
    expect(soldesRepris).toEqual([
      { compteId: 'c2', soldeDuCentimes: 12_300, releveLe: '2026-11-01' },
      { compteId: 'c3', soldeDuCentimes: 0, releveLe: '2026-11-01' },
    ])
  })
})

describe('lecture de l’état des comptes du syndicat', () => {
  it('postes imputables, encaissements dans l’ordre des dates, soldes par compte dans l’ordre des séries', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c2', 5_000, { id: 'enc-b' })], { ...OPTIONS, date: '2027-01-20' })
    await ecrireEncaissements('C1', [virement('c1', 40_000, { id: 'enc-a' })], OPTIONS)
    const etat = await lireEtatDesComptes('C1')
    expect(etat.postes).toHaveLength(9)
    expect(etat.encaissements.map((e) => [e.id, e.date])).toEqual([
      ['enc-a', '2027-01-15'],
      ['enc-b', '2027-01-20'],
    ])
    expect(etat.soldes).toEqual([
      { compteId: 'c1', appeleCentimes: 74_251, regleCentimes: 40_000, resteDuCentimes: 34_251, creditAImputerCentimes: 0, soldeCentimes: 34_251 },
      { compteId: 'c2', appeleCentimes: 57_750, regleCentimes: 5_000, resteDuCentimes: 52_750, creditAImputerCentimes: 0, soldeCentimes: 52_750 },
      { compteId: 'c3', appeleCentimes: 33_000, regleCentimes: 0, resteDuCentimes: 33_000, creditAImputerCentimes: 0, soldeCentimes: 33_000 },
    ])
    expect(etat.soldesRepris).toEqual([])
  })

  it('soldes antérieurs pour un avis d’appel : par compte, sans les échéances de l’avis ; crédit « à imputer » en négatif', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 40_000), virement('c2', 25_000, { piece: { mode: 'Virement', numero: 'VIR-0002' } })], { ...OPTIONS, date: '2026-10-05' })
    // Le 05/10/2026, seul le T4 2026 est échu : 270,00 € et 210,00 € imputés, 130,00 € et 40,00 € « à imputer ».
    expect(await lireSoldesAnterieurs('C1')).toEqual({ c1: 47_251 - 13_000, c2: 36_750 - 4_000, c3: 33_000 })
    expect(await lireSoldesAnterieurs('C1', { horsAppels: [T1_2027, FONDS_T1_2027] })).toEqual({ c1: -13_000, c2: -4_000, c3: 12_000 })
    expect(await lireSoldesAnterieurs('C2')).toEqual({})
    await expect(lireSoldesAnterieurs('inconnue')).rejects.toThrow(/Copropriété introuvable/)
  })
})
