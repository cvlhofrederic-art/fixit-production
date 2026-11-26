import './fuseau-paris'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ecrireAppelDeFonds, enregistrerNouvelAppel, ouvrirExercice } from '@/lib/administrateur-judiciaire/db/appels-de-fonds'
import { changerSuiviEcheances } from '@/lib/administrateur-judiciaire/db/echeances-appel'
import {
  annulerEncaissementEcrit,
  annulerPieceEncaissementsPourErreur,
  ecrireEncaissements,
  lireEtatDesComptes,
  lireSoldesAnterieurs,
  lirePostesDuCompte,
  MOTIFS_ERREUR_DE_SAISIE,
  type OptionsEncaissements,
  type SaisieAnnulationPourErreur,
  type SaisieAnnulationEncaissementEcrit,
  type SaisieEncaissement,
} from '@/lib/administrateur-judiciaire/db/encaissements'
import { repoComptesCoproprietaires, repoIdentites, repoPositions } from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb, type Banque, type ChampsSuivi, type Copropriete, type Lot, type Mandat } from '@/lib/administrateur-judiciaire/db/schema'
import { annulerPieceTraitement, changerStatutTraitement, marquerPieceEncaissementsAnnulee } from '@/lib/administrateur-judiciaire/db/traitements'
import type { JournalEncaissement } from '@/lib/administrateur-judiciaire/domain/encaissements-pieces'
import { creerCompteCoproprietaire, creerIdentite, creerPosition } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import type { SousComptes450 } from '@/lib/administrateur-judiciaire/domain/repartition-appels'

/**
 * Imputation des encaissements aux comptes copropriétaires D2, couche données (db/encaissements.ts), sans écran :
 * - les postes d'un compte se relisent de l'échéancier appelé (ecrireAppelDeFonds), recoupés avec l'écriture de l'appel ;
 * - un encaissement s'enregistre, s'impute (C. civ. art. 1342-10) et s'écrit (R7, R8) dans une seule transaction ;
 * - il s'annule par une écriture contraire qui défait son imputation (F110), une seule fois, par son propre circuit ;
 * - chaque poste est crédité au compte 450 que son appel a débité (sous-comptes du 450 : J67, R104) ;
 * - un écart entre la répartition relue et l'écriture d'un appel ne touche que les comptes concernés ;
 * - un encaissement se saisit dans l'ordre des dates de son compte : saisi en retard, il est refusé, ou, sur demande,
 *   écrit avec la réimputation des encaissements postérieurs du compte dans l'ordre des dates, par un reclassement interne
 *   au compte 450, sans mouvement de banque (décision du 24/11/2026, question 6, option 3) ;
 * - une pièce d'encaissement saisie par erreur (montant, compte, doublon) s'annule entière, à part du rejet de la banque
 *   (décision du 24/11/2026, question 6, option 4) ;
 * - un encaissement daté hors des exercices du syndicat ouverts dans VitFix est refusé (décision du 24/11/2026) ;
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
async function titulaire(n: string, lotId: string, coproprieteId: string, dateEntree = '2020-01-01') {
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
    dateEntree,
    dateSortie: null,
  })
  await repoPositions.create(position, { id: `p${n}` })
}

const T4_2026 = 'A-20261001-001-1'
const T1_2027 = 'A-20270101-001-1'
const FONDS_T1_2027 = 'A-20270101-001-2'

const JOURNAL: JournalEncaissement = { code: 'BA', banqueId: 'b1', compteEncaissement: 'ACAC.51200.00000.0' }
const OPTIONS: OptionsEncaissements = { date: '2027-01-15', mandatId: 'M1', journal: JOURNAL, aujourdhui: '2027-02-15' }
const REGLAGE_450: SousComptes450 = { decision: 'AG du 10/06/2026, résolution 12 (fictive)', planBudget: '45010' }
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
async function appeler(sousComptesT4: SousComptes450 | null = null, sousComptesT1: SousComptes450 | null = sousComptesT4) {
  await saisirLesEcheances()
  const t4 = await ecrireAppelDeFonds('C1', { jusquAu: '2026-10-01', mandatId: 'M1', sousComptes450: sousComptesT4 })
  const t1 = await ecrireAppelDeFonds('C1', { jusquAu: '2027-01-01', mandatId: 'M1', sousComptes450: sousComptesT1 })
  return { t4: t4.piece, t1: t1.piece }
}

const regles = async (compteId: string) => (await lirePostesDuCompte('C1', compteId)).map((p) => [p.appelId, p.regleCentimes])
const sansTraitement = <T extends { traitementId: string }>(mouvements: T[]) => mouvements.map(({ traitementId: _t, ...m }) => m)
const origine = (appelId: string, typeAppel: 'Budget' | 'Fonds travaux') => ({ origine: { type: 'appel', appelId, typeAppel } })

/** Annulation saisie le même jour que les encaissements des essais (OPTIONS.aujourdhui), sauf jour de saisie donné. */
const annuler = (coproprieteId: string, encaissementId: string, saisie: SaisieAnnulationEncaissementEcrit, options?: { actor?: string | null }) =>
  annulerEncaissementEcrit(coproprieteId, encaissementId, { aujourdhui: '2027-02-15', ...saisie }, options)

/** Ce qu'un refus ne doit pas changer. */
const compter =async () => ({ pieces: await ajDb.traitements.count(), encaissements: await ajDb.encaissements.count(), journal: await ajDb.activityLog.count() })

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
        planCompte: '45000',
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

  it('clé modifiée après l’appel : seuls les comptes dont la part a changé sont en écart (série, lot, échéance) ; les autres s’encaissent', async () => {
    await appeler()
    const cle = await ajDb.clesRepartition.where('coproprieteId').equals('C1').first()
    // Lots 1 et 2 : 500 et 300 millièmes au lieu de 450 et 350 ; le lot 3 ne change pas.
    await ajDb.clesRepartition.update(cle!.id, {
      lots: [
        { lotId: 'L1', tantiemes: 500 },
        { lotId: 'L2', tantiemes: 300 },
        { lotId: 'L3', tantiemes: 200 },
      ],
    })
    await expect(lirePostesDuCompte('C1', 'c1')).rejects.toThrow(
      /série 00001, appel n° 1 \(échéance « A-20261001-001-1 »\) : 27000 centimes écrits au compte, 30000 centimes relus \(échéance « A-20261001-001-1 », lot L1 : 30000\)/,
    )
    const etat = await lireEtatDesComptes('C1')
    // Un écart par compte et par appel : comptes 1 et 2, appels n° 1 et n° 2.
    expect(etat.ecarts.map((e) => [e.compteId, e.serie])).toEqual([
      ['c1', '00001'],
      ['c2', '00002'],
      ['c1', '00001'],
      ['c2', '00002'],
    ])
    expect(etat.ecarts[0].message).toMatch(/Séries en écart sur cet appel : 00001, 00002\./)
    expect([...new Set(etat.postes.map((p) => p.compteId))]).toEqual(['c3'])
    expect(etat.soldes.map((x) => x.compteId)).toEqual(['c3'])
    expect(await lireSoldesAnterieurs('C1')).toMatchObject({ soldes: { c3: 33_000 }, ecarts: etat.ecarts })
    const avant = await compter()
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000)], OPTIONS)).rejects.toThrow(/série 00001, appel n° 1/)
    await expect(ecrireEncaissements('C1', [virement('c3', 10_000), virement('c2', 10_000)], OPTIONS)).rejects.toThrow(/série 00002, appel n° 1/)
    expect(await compter()).toEqual(avant)
    const { encaissements } = await ecrireEncaissements('C1', [virement('c3', 10_000)], OPTIONS)
    expect(encaissements[0].imputation.lignes).toMatchObject([{ posteId: `${T4_2026}:L3`, montantCentimes: 10_000 }])
  })

  it('mutation notifiée après l’appel (vente antérieure à l’exigibilité) : vendeur et acquéreur en écart ; les autres comptes encaissent et annulent', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 5_000, { id: 'enc-c1' }), virement('c2', 21_000, { id: 'enc-c2', piece: { mode: 'Virement', numero: 'VIR-0002' } })], OPTIONS)
    // Lot 1 vendu le 15/12/2026, notifié après l'appel du T1 2027 : ses postes du 01/01/2027 reviennent à l'acquéreur.
    await ajDb.positions.update('p1', { dateSortie: '2026-12-15' })
    await titulaire('4', 'L1', 'C1', '2026-12-15')
    const { ecarts, postes } = await lireEtatDesComptes('C1')
    expect(ecarts.map((e) => [e.compteId, e.serie])).toEqual([
      ['c1', '00001'],
      ['c4', '00004'],
    ])
    expect(ecarts[0].message).toMatch(/série 00001, appel n° 2 \(échéances « A-20270101-001-1 », « A-20270101-001-2 »\) : 47251 centimes écrits au compte, 0 centime relu \(aucun lot\)/)
    expect(ecarts[1].message).toMatch(/série 00004, appel n° 2 .* 0 centime écrit au compte, 47251 centimes relus \(échéance « A-20270101-001-1 », lot L1 : 45001 ; échéance « A-20270101-001-2 », lot L1 : 2250\)/)
    expect(ecarts[1].message).toMatch(/Séries en écart sur cet appel : 00001, 00004\./)
    expect([...new Set(postes.map((p) => p.compteId))]).toEqual(['c2', 'c3'])
    const avant = await compter()
    const debit = { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-0005' }
    await expect(ecrireEncaissements('C1', [virement('c1', 1_000)], OPTIONS)).rejects.toThrow(/série 00001, appel n° 2/)
    await expect(ecrireEncaissements('C1', [virement('c4', 1_000)], OPTIONS)).rejects.toThrow(/série 00004, appel n° 2/)
    await expect(lirePostesDuCompte('C1', 'c4')).rejects.toThrow(/série 00004/)
    expect(await compter()).toEqual(avant)
    // Les comptes 2 et 3 ne sont pas touchés : encaissement et annulation F110 passent.
    await ecrireEncaissements('C1', [virement('c3', 12_000)], OPTIONS)
    const { encaissement } = await annuler('C1', 'enc-c2', debit)
    expect(encaissement.statut).toBe('Annulé')
    expect((await regles('c2'))[0]).toEqual([T4_2026, 0])
    expect((await regles('c3'))[0]).toEqual([T4_2026, 12_000])
  })

  it('chèque impayé d’un compte en écart : la banque l’a déjà rejeté, l’écriture contraire passe ; le compte reste en écart', async () => {
    await appeler()
    // Un chèque du compte 1 et un virement du compte 2 dans la même pièce, puis la vente du lot 1 notifiée après l'appel.
    const { piece: pieceDuCheque } = await ecrireEncaissements(
      'C1',
      [virement('c1', 40_000, { id: 'enc-cheque', piece: { mode: 'Chèque', numero: '0001234' } }), virement('c2', 21_000, { id: 'enc-c2' })],
      OPTIONS,
    )
    await ajDb.positions.update('p1', { dateSortie: '2026-12-15' })
    await titulaire('4', 'L1', 'C1', '2026-12-15')
    const ecartsAvant = (await lireEtatDesComptes('C1')).ecarts
    expect(ecartsAvant.map((e) => e.compteId)).toEqual(['c1', 'c4'])
    const { piece, encaissement, postes } = await annuler('C1', 'enc-cheque', { date: '2027-01-25', motif: 'Chèque impayé : provision insuffisante', piece: 'AVIS-2027-0042' })
    // Ce qui a été écrit pour ce chèque, et rien d'autre : ses trois crédits du 450 et son débit du 512.
    expect(piece).toMatchObject({ famille: "Annulation d'encaissement", date: '2027-01-25', coproprieteId: 'C1', mandatId: 'M1' })
    expect(piece.traitement.annule).toBe(pieceDuCheque.id)
    expect(sansTraitement(piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'credit', montantCentimes: 40_000 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 27_000, ...origine(T4_2026, 'Budget') },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 12_381, ...origine(T1_2027, 'Budget') },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 619, ...origine(FONDS_T1_2027, 'Fonds travaux') },
    ])
    expect(encaissement).toMatchObject({ id: 'enc-cheque', statut: 'Annulé', annulation: { le: '2027-01-25', piece: 'AVIS-2027-0042', traitementId: piece.id } })
    // Le compte reste en écart : ses postes restent illisibles, aucun n'est rendu ; l'écart n'est pas levé par l'annulation.
    expect((await lireEtatDesComptes('C1')).ecarts).toEqual(ecartsAvant)
    expect([...new Set(postes.map((p) => p.compteId))]).toEqual(['c2', 'c3'])
    await expect(lirePostesDuCompte('C1', 'c1')).rejects.toThrow(/série 00001, appel n° 2/)
    await expect(annuler('C1', 'enc-cheque', { date: '2027-01-26', motif: 'Chèque impayé', piece: 'AVIS-2027-0043' })).rejects.toThrow(/déjà annulé/)
    // L'encaissement du compte 2, dans la même pièce, n'est pas touché.
    expect((await regles('c2'))[0]).toEqual([T4_2026, 21_000])
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
      imputation: { lignes, resteAImputerCentimes: 0, designationsIgnorees: [], designationPartielleRefusee: false, imputerSurAVenir: false },
      createdBy: 'test',
    })
    expect(await ajDb.encaissements.get('enc-1')).toEqual(encaissements[0])
    // Chaque ligne garde l'appel d'origine et le compte 450 crédité : de quoi passer l'écriture contraire sans relire les postes.
    expect(encaissements[0].imputation.lignes).toEqual([
      { ...lignes[0], appelId: T4_2026, typeAppel: 'Budget', planCompte: '45000' },
      { ...lignes[1], appelId: T1_2027, typeAppel: 'Budget', planCompte: '45000' },
      { ...lignes[2], appelId: FONDS_T1_2027, typeAppel: 'Fonds travaux', planCompte: '45000' },
    ])
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
    expect(encaissements[0].imputation.lignes).toMatchObject([{ posteId: `${FONDS_T1_2027}:L1`, montantCentimes: 2_250 }])
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
    expect(second.encaissements[0].imputation.lignes).toMatchObject([
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
    expect(encaissements.map((e) => e.imputation.lignes)).toMatchObject([
      [{ posteId: `${T4_2026}:L1`, montantCentimes: 20_000 }],
      [{ posteId: `${T4_2026}:L2`, montantCentimes: 21_000 }],
      [{ posteId: `${T4_2026}:L1`, montantCentimes: 7_000 }],
    ])
    expect(encaissements.every((e) => e.traitementId === piece.id)).toBe(true)
    expect(await ajDb.encaissements.where('coproprieteId').equals('C1').count()).toBe(3)
    expect((await regles('c1'))[0]).toEqual([T4_2026, 27_000])
  })

  it('sous-comptes du 450 (J67, R104) : chaque poste est crédité au compte que son appel a débité, sans réglage à repasser', async () => {
    await appeler(REGLAGE_450)
    expect((await lirePostesDuCompte('C1', 'c1')).map((p) => [p.typeAppel, p.planCompte])).toEqual([
      ['Budget', '45010'],
      ['Budget', '45010'],
      ['Fonds travaux', '45000'],
    ])
    // Le budget du T1 2027, désigné : son appel porte aussi le fonds de travaux (débité au 45000) ; le crédit va au 450-1.
    const designe = await ecrireEncaissements('C1', [virement('c1', 45_001, { postesDesignes: [`${T1_2027}:L1`] })], OPTIONS)
    expect(sansTraitement(designe.piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'debit', montantCentimes: 45_001 },
      { compte: 'ACAC.45010.00001.0', sens: 'credit', montantCentimes: 45_001, ...origine(T1_2027, 'Budget') },
    ])
    // 210,00 € sur le T4 2026 ; 190,00 € au prorata du budget (350,00 €) et du fonds de travaux (17,50 €) du 01/01/2027.
    const { piece, encaissements } = await ecrireEncaissements('C1', [virement('c2', 40_000)], OPTIONS)
    expect(piece.traitement.mouvements.map((m) => [m.compte, m.montantCentimes])).toEqual([
      ['ACAC.51200.00000.0', 40_000],
      ['ACAC.45010.00002.0', 21_000],
      ['ACAC.45010.00002.0', 18_095],
      ['ACAC.45000.00002.0', 905],
    ])
    // L'annulation contre-passe ce qui a été écrit, compte par compte.
    const { piece: annulation } = await annuler('C1', encaissements[0].id, { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-0001' })
    expect(annulation.traitement.mouvements.filter((m) => m.sens === 'debit').map((m) => m.compte)).toEqual(['ACAC.45010.00002.0', 'ACAC.45010.00002.0', 'ACAC.45000.00002.0'])
  })

  it('450-1 créé en cours d’année : un encaissement couvre un ancien appel (45000) et un nouveau (450-1), sans compensation entre les deux', async () => {
    await appeler(null, REGLAGE_450)
    expect((await lirePostesDuCompte('C1', 'c1')).map((p) => [p.appelId, p.planCompte])).toEqual([
      [T4_2026, '45000'],
      [T1_2027, '45010'],
      [FONDS_T1_2027, '45000'],
    ])
    const { piece, encaissements } = await ecrireEncaissements('C1', [virement('c1', 40_000)], OPTIONS)
    expect(sansTraitement(piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'debit', montantCentimes: 40_000 },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 27_000, ...origine(T4_2026, 'Budget') },
      { compte: 'ACAC.45010.00001.0', sens: 'credit', montantCentimes: 12_381, ...origine(T1_2027, 'Budget') },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 619, ...origine(FONDS_T1_2027, 'Fonds travaux') },
    ])
    const { piece: annulation } = await annuler('C1', encaissements[0].id, { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-0001' })
    expect(annulation.traitement.mouvements.filter((m) => m.sens === 'debit').map((m) => m.compte)).toEqual(['ACAC.45000.00001.0', 'ACAC.45010.00001.0', 'ACAC.45000.00001.0'])
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
    const { piece, encaissement, postes } = await annuler(
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
    expect(apres.encaissements[0].imputation.lignes).toMatchObject([{ posteId: `${T4_2026}:L1`, montantCentimes: 5_000 }])
  })

  it('reliquat annulé avec l’encaissement : le crédit « à imputer » disparaît du solde', async () => {
    await saisirLesEcheances()
    await ecrireAppelDeFonds('C1', { jusquAu: '2026-10-01', mandatId: 'M1' })
    const { encaissements } = await ecrireEncaissements('C1', [virement('c2', 25_000)], { ...OPTIONS, date: '2026-10-05' })
    const { piece } = await annuler('C1', encaissements[0].id, { date: '2026-10-09', motif: 'Virement retourné', piece: 'AVIS-0002' })
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
    await expect(annuler('C1', 'enc-1', { ...saisie, date: '2027-01-14' })).rejects.toThrow(/antérieur à l'écriture/)
    await expect(annuler('C1', 'enc-1', { ...saisie, motif: ' ' })).rejects.toThrow(/motif/)
    await expect(annuler('C1', 'enc-1', { ...saisie, piece: '' })).rejects.toThrow(/pièce/)
    await expect(annuler('C1', 'enc-1', { ...saisie, date: '2027-02-30' })).rejects.toThrow(/date/i)
    await expect(annuler('C2', 'enc-1', saisie)).rejects.toThrow(/autre syndicat/)
    await expect(annuler('C1', 'enc-1', { ...saisie, mandatId: 'M2' })).rejects.toThrow(/autre syndicat/)
    await expect(annuler('C1', 'inconnu', saisie)).rejects.toThrow(/introuvable/)
    expect(await compter()).toEqual(avant)
    await annuler('C1', 'enc-1', saisie)
    const apres = await compter()
    await expect(annuler('C1', 'enc-1', saisie)).rejects.toThrow(/déjà annulé/)
    expect(await compter()).toEqual(apres)
  })
})

describe('une seule annulation, par le circuit des encaissements', () => {
  it('l’annulation générique des pièces refuse une pièce d’encaissement : les postes resteraient réglés', async () => {
    await appeler()
    const { piece } = await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-1' })], OPTIONS)
    const avant = await compter()
    await expect(annulerPieceTraitement(piece.id, { id: 'annulation-generique', date: '2027-01-16' })).rejects.toThrow(/annulerEncaissementEcrit/)
    expect(await compter()).toEqual(avant)
    expect((await ajDb.traitements.get(piece.id))?.statut).toBe('Enregistré')
    expect((await regles('c1'))[0]).toEqual([T4_2026, 27_000])
  })

  it('pièce d’origine déjà « Annulé » hors de ce circuit : aucune seconde écriture contraire, compte signalé en écart', async () => {
    await appeler()
    const { piece } = await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-1' })], OPTIONS)
    // État que l'annulation générique laissait avant sa garde : pièce annulée, encaissement inchangé.
    await ajDb.traitements.update(piece.id, { statut: 'Annulé', annuleePar: 'annulation-generique' })
    const avant = await compter()
    await expect(annuler('C1', 'enc-1', { date: '2027-01-17', motif: 'Chèque impayé', piece: 'AVIS-0004' })).rejects.toThrow(/pièce n° 3 est déjà annulée/)
    expect(await compter()).toEqual(avant)
    const { ecarts, postes } = await lireEtatDesComptes('C1')
    expect(ecarts.map((e) => [e.compteId, e.serie])).toEqual([['c1', '00001']])
    expect(ecarts[0].message).toMatch(/Encaissement enc-1 : sa pièce n° 3 a été annulée hors du circuit des encaissements/)
    expect([...new Set(postes.map((p) => p.compteId))]).toEqual(['c2', 'c3'])
  })
})

describe('À valider — date de l’encaissement : ordre des paiements du compte, plausibilité', () => {
  it('encaissement daté avant le dernier encaissement non annulé du même compte : refusé, rien n’est écrit, sans proposer d’annuler les suivants', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-janvier' })], OPTIONS)
    const cheque = [virement('c1', 20_000, { piece: { mode: 'Chèque', numero: '0001234' } })]
    const avant = await compter()
    const refus = await ecrireEncaissements('C1', cheque, { ...OPTIONS, date: '2026-12-20' }).catch((erreur: Error) => erreur.message)
    expect(refus).toMatch(
      /du 20\/12\/2026 sur le compte « c1 » : antérieur au dernier encaissement de ce compte \(enc-janvier du 15\/01\/2027\).*Encaissement refusé tel quel : il ne s'enregistre qu'avec la réimputation, dans l'ordre des dates, des encaissements postérieurs de ce compte, par un reclassement interne au compte 450, sans mouvement de banque, demandée à l'écriture ; signaler/,
    )
    // L'annulation pour erreur de saisie ne sert pas à remettre dans l'ordre un encaissement saisi dans le désordre des dates.
    expect(refus).toMatch(/l'annulation est réservée à un rejet de la banque ou à une vraie erreur de saisie \(montant, compte, doublon\)/)
    // L'annulation est celle d'un rejet de la banque : la proposer ici fabriquerait un rejet absent du relevé.
    expect(refus).toMatch(/ne pas annuler les encaissements postérieurs/)
    expect(refus).not.toMatch(/ressaisir/)
    // Dans un lot, un seul encaissement hors ordre refuse tout le lot.
    await expect(ecrireEncaissements('C1', [virement('c2', 1_000), ...cheque], { ...OPTIONS, date: '2026-12-20' })).rejects.toThrow(/antérieur au dernier encaissement/)
    expect(await compter()).toEqual(avant)
    // Le même jour que le dernier, ou sur un autre compte : admis.
    await ecrireEncaissements('C1', [virement('c1', 1_000, { id: 'enc-meme-jour', piece: { mode: 'Virement', numero: 'VIR-0002' } })], OPTIONS)
    await ecrireEncaissements('C1', [virement('c2', 1_000)], { ...OPTIONS, date: '2026-12-20' })
    // Seuls les encaissements NON annulés comptent : les deux virements de janvier rejetés par la banque (avis), le chèque
    // du 20/12/2026 n'est plus antérieur à aucun encaissement du compte ; il sert le T4 2026, seul échu ce jour-là.
    const rejet = { date: '2027-01-16', motif: 'Virement retourné par la banque', piece: 'AVIS-2027-0007' }
    await annuler('C1', 'enc-janvier', rejet)
    await annuler('C1', 'enc-meme-jour', rejet)
    const { encaissements } = await ecrireEncaissements('C1', cheque, { ...OPTIONS, date: '2026-12-20' })
    expect(encaissements[0].imputation).toMatchObject({ lignes: [{ posteId: `${T4_2026}:L1`, montantCentimes: 20_000 }], resteAImputerCentimes: 0 })
  })

  it('date du débit de la banque (annulation) : année improbable ou postérieure au jour de la saisie refusée, rien n’est écrit', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-1' })], OPTIONS)
    const saisie = { motif: 'Chèque impayé', piece: 'AVIS-0006' }
    const avant = await compter()
    await expect(annuler('C1', 'enc-1', { ...saisie, date: '2127-01-25' })).rejects.toThrow(/Débit de la banque daté du 25\/01\/2127 : année improbable/)
    await expect(annuler('C1', 'enc-1', { ...saisie, date: '1027-01-25' })).rejects.toThrow(/Débit de la banque daté du 25\/01\/1027 : année improbable/)
    await expect(annuler('C1', 'enc-1', { ...saisie, date: '2027-02-16' })).rejects.toThrow(/Débit de la banque daté du 16\/02\/2027, après aujourd'hui/)
    await expect(annuler('C1', 'enc-1', { ...saisie, date: '2027-01-25', aujourdhui: '2027-01-24' })).rejects.toThrow(/après aujourd'hui/)
    await expect(annuler('C1', 'enc-1', { ...saisie, date: '2027-01-25', aujourdhui: 'demain' })).rejects.toThrow(/Date du jour invalide/)
    expect(await compter()).toEqual(avant)
    expect((await ajDb.encaissements.get('enc-1'))?.statut).toBe('Enregistré')
    // Le jour même de la saisie : admis.
    expect((await annuler('C1', 'enc-1', { ...saisie, date: '2027-02-15' })).encaissement.statut).toBe('Annulé')
  })

  it('année improbable, date postérieure au jour de la saisie, jour de la saisie invalide : refusés, rien n’est écrit', async () => {
    await appeler()
    const avant = await compter()
    const un = [virement('c1', 10_000)]
    await expect(ecrireEncaissements('C1', un, { ...OPTIONS, date: '1027-01-15' })).rejects.toThrow(/Encaissement daté du 15\/01\/1027 : année improbable/)
    await expect(ecrireEncaissements('C1', un, { ...OPTIONS, date: '2127-01-15' })).rejects.toThrow(/année improbable/)
    await expect(ecrireEncaissements('C1', un, { ...OPTIONS, date: '2027-02-16' })).rejects.toThrow(/Encaissement daté du 16\/02\/2027, après aujourd'hui/)
    await expect(ecrireEncaissements('C1', un, { ...OPTIONS, aujourdhui: 'demain' })).rejects.toThrow(/Date du jour invalide/)
    expect(await compter()).toEqual(avant)
    // Le jour même de la saisie : admis.
    await ecrireEncaissements('C1', un, { ...OPTIONS, date: '2027-02-15' })
  })
})

describe('Décision du 24/11/2026 (question 6 bis) — encaissement daté hors des exercices du syndicat ouverts dans VitFix : refusé', () => {
  it('date ancienne mais plausible, ou après le dernier exercice : refusée, rien n’est écrit ; le premier et le dernier jour d’un exercice sont admis', async () => {
    await appeler()
    const avant = await compter()
    const un = [virement('c1', 10_000)]
    // La veille du premier exercice et le lendemain du dernier : refusés.
    const refus = await ecrireEncaissements('C1', un, { ...OPTIONS, date: '2025-12-31' }).catch((erreur: Error) => erreur.message)
    expect(refus).toBe(
      "Encaissement daté du 31/12/2025 : hors des exercices du syndicat ouverts dans VitFix : 2026 (01/01/2026 – 31/12/2026), 2027 (01/01/2027 – 31/12/2027). Encaissement refusé : corriger la date ; si elle est juste, l'exercice qui la comprend doit d'abord être ouvert dans VitFix.",
    )
    // Aucun renvoi à un écran : « Ouvrir l'exercice » n'y est proposé qu'à l'écriture d'un appel.
    expect(refus).not.toMatch(/écran/)
    await expect(ecrireEncaissements('C1', un, { ...OPTIONS, date: '2028-01-01', aujourdhui: '2028-02-01' })).rejects.toThrow(
      /Encaissement daté du 01\/01\/2028 : hors des exercices du syndicat ouverts dans VitFix : 2026 /,
    )
    // La date est celle de la pièce : tout le lot est refusé.
    await expect(ecrireEncaissements('C1', [virement('c2', 1_000), ...un], { ...OPTIONS, date: '2025-12-20' })).rejects.toThrow(/hors des exercices/)
    expect(await compter()).toEqual(avant)
    // Premier jour du premier exercice, dernier jour du dernier : admis.
    await ecrireEncaissements('C1', [virement('c2', 1_000)], { ...OPTIONS, date: '2026-01-01' })
    await ecrireEncaissements('C1', [virement('c3', 1_000)], { ...OPTIONS, date: '2027-12-31', aujourdhui: '2028-01-10' })
    expect((await ajDb.encaissements.toArray()).map((e) => [e.compteId, e.date]).sort((a, b) => a[1].localeCompare(b[1]))).toEqual([
      ['c2', '2026-01-01'],
      ['c3', '2027-12-31'],
    ])
  })

  it('D1 : l’exercice d’un autre syndicat ne compte pas ; un syndicat sans exercice refuse tout encaissement', async () => {
    await appeler()
    await ouvrirExercice('C2', { ouverture: '2025-01-01', cloture: '2025-12-31' })
    await expect(ecrireEncaissements('C1', [virement('c1', 10_000)], { ...OPTIONS, date: '2025-12-20' })).rejects.toThrow(
      /hors des exercices du syndicat ouverts dans VitFix : 2026 \(01\/01\/2026 – 31\/12\/2026\), 2027 \(01\/01\/2027 – 31\/12\/2027\)\./,
    )
    const pourC2: OptionsEncaissements = { ...OPTIONS, mandatId: 'M2', journal: { code: 'BA', banqueId: 'b2', compteEncaissement: 'BOUL.51200.00000.0' } }
    await expect(ecrireEncaissements('C2', [virement('c9', 10_000)], pourC2)).rejects.toThrow(
      /Encaissement daté du 15\/01\/2027 : hors des exercices du syndicat ouverts dans VitFix : 2025 \(01\/01\/2025 – 31\/12\/2025\)\./,
    )
    await ajDb.exercices.where('coproprieteId').equals('C2').delete()
    const avant = await compter()
    await expect(ecrireEncaissements('C2', [virement('c9', 10_000)], { ...pourC2, date: '2025-12-20' })).rejects.toThrow(
      "Encaissement daté du 20/12/2025 : aucun exercice du syndicat n'est ouvert dans VitFix. Encaissement refusé : l'exercice qui comprend cette date doit d'abord être ouvert dans VitFix.",
    )
    expect(await compter()).toEqual(avant)
  })

  it('exercices séparés par un trou, exercice qui ne suit pas l’année civile : seule une date d’un exercice est admise', async () => {
    await ouvrirExercice('C2', { ouverture: '2024-01-01', cloture: '2024-12-31' })
    await ouvrirExercice('C2', { ouverture: '2026-07-01', cloture: '2027-06-30' })
    const pourC2: OptionsEncaissements = { ...OPTIONS, mandatId: 'M2', journal: { code: 'BA', banqueId: 'b2', compteEncaissement: 'BOUL.51200.00000.0' } }
    const un = [virement('c9', 1_000)]
    const avant = await compter()
    // Dans le trou entre 2024 et l'exercice 2026-2027, et la veille de son ouverture.
    await expect(ecrireEncaissements('C2', un, { ...pourC2, date: '2025-06-15' })).rejects.toThrow(
      /Encaissement daté du 15\/06\/2025 : hors des exercices du syndicat ouverts dans VitFix : 2024 \(01\/01\/2024 – 31\/12\/2024\), 2026-2027 \(01\/07\/2026 – 30\/06\/2027\)\./,
    )
    await expect(ecrireEncaissements('C2', un, { ...pourC2, date: '2026-06-30' })).rejects.toThrow(/30\/06\/2026 : hors des exercices/)
    expect(await compter()).toEqual(avant)
    // Le jour d'ouverture de l'exercice 2026-2027 : admis.
    await ecrireEncaissements('C2', un, { ...pourC2, date: '2026-07-01' })
    expect((await ajDb.encaissements.toArray()).map((e) => e.date)).toEqual(['2026-07-01'])
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
    // Ordre de saisie inverse de l'ordre des dates, sur deux comptes différents : admis (l'ordre se contrôle par compte).
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
    expect(etat.ecarts).toEqual([])
  })

  it('soldes antérieurs pour un avis d’appel : par compte, sans les échéances de l’avis ; crédit « à imputer » en négatif', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 40_000), virement('c2', 25_000, { piece: { mode: 'Virement', numero: 'VIR-0002' } })], { ...OPTIONS, date: '2026-10-05' })
    // Le 05/10/2026, seul le T4 2026 est échu : 270,00 € et 210,00 € imputés, 130,00 € et 40,00 € « à imputer ».
    expect(await lireSoldesAnterieurs('C1')).toEqual({ soldes: { c1: 47_251 - 13_000, c2: 36_750 - 4_000, c3: 33_000 }, ecarts: [] })
    expect((await lireSoldesAnterieurs('C1', { horsAppels: [T1_2027, FONDS_T1_2027] })).soldes).toEqual({ c1: -13_000, c2: -4_000, c3: 12_000 })
    expect(await lireSoldesAnterieurs('C2')).toEqual({ soldes: {}, ecarts: [] })
    await expect(lireSoldesAnterieurs('inconnue')).rejects.toThrow(/Copropriété introuvable/)
  })
})

// ─── Décision du 24/11/2026 (question 6) : réimputation dans l'ordre des dates, annulation pour erreur de saisie ───

afterEach(() => {
  vi.useRealTimers()
})

const LIENS_C1 = { liens: { compteCoproprietaireId: 'c1' } }
/** Chèque remis le 20/12/2026, saisi le 15/02/2027 avec la réimputation des encaissements postérieurs du compte. */
const EN_RETARD: OptionsEncaissements = { ...OPTIONS, date: '2026-12-20', reimputerDansLOrdreDesDates: true }
const cheque = (montantCentimes: number, surcharge: Partial<SaisieEncaissement> = {}): SaisieEncaissement =>
  virement('c1', montantCentimes, { id: 'enc-cheque', piece: { mode: 'Chèque', numero: '0001234' }, ...surcharge })
const lignesDe = async (id: string) => (await ajDb.encaissements.get(id))?.imputation.lignes.map((l) => [l.appelId, l.montantCentimes])
const soldeDu512 = async () =>
  (await ajDb.traitements.toArray())
    .flatMap((p) => p.traitement.mouvements)
    .filter((m) => m.compte === 'ACAC.51200.00000.0')
    .reduce((s, m) => s + (m.sens === 'debit' ? m.montantCentimes : -m.montantCentimes), 0)

/** Virement du 15/01/2027 (270,00 €, pièce n° 3) qui solde le T4 2026, puis le chèque de 200,00 € remis le 20/12/2026, saisi en retard. */
async function janvierPuisChequeEnRetard() {
  await appeler()
  const janvier = await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-janvier' })], OPTIONS)
  const retard = await ecrireEncaissements('C1', [cheque(20_000)], EN_RETARD, { actor: 'test' })
  return { janvier, retard, reclassement: retard.reimputations[0].piece }
}

describe('Décision du 24/11/2026 (question 6, option 3) — encaissement saisi en retard : réimputation dans l’ordre des dates', () => {
  it('option demandée : pièce « Encaissement » au jour du paiement, pièce « Correction de mouvements » au jour du traitement, encaissement postérieur réimputé avec son historique', async () => {
    const { janvier, retard, reclassement } = await janvierPuisChequeEnRetard()
    // Le chèque ne trouve que le T4 2026 d'échu le 20/12/2026 : sa pièce garde la forme ordinaire.
    expect(retard.piece).toMatchObject({ numero: 4, famille: 'Encaissement', date: '2026-12-20', statut: 'Enregistré' })
    expect(sansTraitement(retard.piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'debit', montantCentimes: 20_000 },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 20_000, ...origine(T4_2026, 'Budget') },
    ])
    // Le virement du 15/01 ne trouve plus que 70,00 € sur le T4 : 200,00 € passent aux deux postes du 01/01/2027, au prorata.
    expect(retard.reimputations).toHaveLength(1)
    expect(retard.reimputations[0].compteId).toBe('c1')
    expect(reclassement).toMatchObject({ numero: 5, famille: 'Correction de mouvements', date: '2027-02-15', statut: 'Enregistré', coproprieteId: 'C1', mandatId: 'M1' })
    expect(reclassement.traitement.annule).toBeUndefined()
    const lignesDuReclassement = [
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 20_000, ...origine(T4_2026, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 19_048, ...origine(T1_2027, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 952, ...origine(FONDS_T1_2027, 'Fonds travaux'), ...LIENS_C1 },
    ]
    expect(sansTraitement(reclassement.traitement.mouvements)).toEqual(lignesDuReclassement)
    // L'encaissement réimputé : `imputation` porte l'imputation courante, l'imputation d'avant est gardée, jamais effacée.
    const [reimpute] = retard.reimputations[0].encaissements
    expect(reimpute.id).toBe('enc-janvier')
    expect(reimpute.imputation.lignes.map((l) => [l.appelId, l.montantCentimes])).toEqual([
      [T4_2026, 7_000],
      [T1_2027, 19_048],
      [FONDS_T1_2027, 952],
    ])
    expect(reimpute.reimputations).toEqual([
      {
        traitementId: reclassement.id,
        le: '2027-02-15',
        cause: { type: 'encaissement-en-retard', encaissementIds: ['enc-cheque'], traitementId: retard.piece.id, date: '2026-12-20' },
        avant: janvier.encaissements[0].imputation,
        mouvements: lignesDuReclassement,
        mention:
          "Réimputation dans l'ordre des dates (C. civ. art. 1342-10 ; arrêté du 14/03/2005, art. 9) du compte 00001 : encaissement enc-cheque du 20/12/2026 (pièce n° 4) saisi le 15/02/2027 ; encaissement réimputé enc-janvier du 15/01/2027 (pièce n° 3).",
      },
    ])
    expect(reimpute).toMatchObject({ statut: 'Enregistré', traitementId: janvier.piece.id, updatedBy: 'test' })
    expect(await ajDb.encaissements.get('enc-janvier')).toEqual(reimpute)
    // Le paiement en retard garde le renvoi à la pièce de reclassement qu'il a causée.
    expect(retard.encaissements[0]).toMatchObject({ id: 'enc-cheque', rang: 0, reclassementIds: [reclassement.id], imputation: { lignes: [{ posteId: `${T4_2026}:L1`, montantCentimes: 20_000 }], resteAImputerCentimes: 0 } })
    expect(await ajDb.encaissements.get('enc-cheque')).toEqual(retard.encaissements[0])
    // Le retour rend l'état d'après la réimputation, celui que la base relit.
    expect(retard.postes.filter((p) => p.compteId === 'c1').map((p) => p.regleCentimes)).toEqual([27_000, 19_048, 952])
    expect(await regles('c1')).toEqual([
      [T4_2026, 27_000],
      [T1_2027, 19_048],
      [FONDS_T1_2027, 952],
    ])
    // La pièce d'origine du virement n'est pas réécrite (arrêté du 14/03/2005, art. 5).
    expect(await ajDb.traitements.get(janvier.piece.id)).toEqual(janvier.piece)
    const journal = (await ajDb.activityLog.where('entite').equals('encaissements').toArray()).filter((e) => e.qui === 'test')
    expect(journal.map((e) => `${e.entiteId} ${e.action}`).sort((a, b) => a.localeCompare(b))).toEqual(['enc-cheque create', 'enc-janvier update'])
  })

  it('aucune ligne de banque dans le reclassement : le 512 ne porte que les deux encaissements, comme le relevé', async () => {
    const { reclassement } = await janvierPuisChequeEnRetard()
    expect(reclassement.traitement.mouvements.some((m) => m.compte.includes('.512'))).toBe(false)
    expect(await soldeDu512()).toBe(47_000)
    // Le solde du compte ne change que du paiement en retard : reste dû 742,51 − 470,00.
    expect((await lireEtatDesComptes('C1')).soldes.find((s) => s.compteId === 'c1')).toEqual({
      compteId: 'c1',
      appeleCentimes: 74_251,
      regleCentimes: 47_000,
      resteDuCentimes: 27_251,
      creditAImputerCentimes: 0,
      soldeCentimes: 27_251,
    })
  })

  it('option demandée sans encaissement postérieur, ou le même jour que le dernier : circuit ordinaire, ni pièce de reclassement ni mise à jour', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 10_000, { id: 'enc-janvier' })], OPTIONS)
    const avant = await compter()
    const memeJour = await ecrireEncaissements('C1', [virement('c1', 1_000, { id: 'enc-meme-jour' })], { ...OPTIONS, reimputerDansLOrdreDesDates: true })
    const apres = await ecrireEncaissements('C1', [virement('c1', 1_000, { id: 'enc-apres' })], { ...OPTIONS, date: '2027-01-20', reimputerDansLOrdreDesDates: true })
    expect(memeJour.reimputations).toEqual([])
    expect(apres.reimputations).toEqual([])
    expect(memeJour.encaissements[0]).not.toHaveProperty('reclassementIds')
    // Deux pièces et deux encaissements de plus, chacun avec ses deux entrées au journal d'activité.
    expect(await compter()).toEqual({ pieces: avant.pieces + 2, encaissements: avant.encaissements + 2, journal: avant.journal + 4 })
    expect(await ajDb.encaissements.get('enc-janvier')).not.toHaveProperty('reimputations')
  })

  it('le paiement en retard ne change rien à l’encaissement postérieur (désignation du débiteur) : aucune pièce de reclassement', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 10_000, { id: 'enc-janvier', postesDesignes: [`${T1_2027}:L1`], designationPartielleAcceptee: true })], OPTIONS)
    const janvier = await ajDb.encaissements.get('enc-janvier')
    const avant = await compter()
    const retard = await ecrireEncaissements('C1', [cheque(10_000)], EN_RETARD)
    expect(retard.reimputations).toEqual([])
    expect(retard.encaissements[0]).not.toHaveProperty('reclassementIds')
    expect(await compter()).toEqual({ pieces: avant.pieces + 1, encaissements: avant.encaissements + 1, journal: avant.journal + 2 })
    expect(await ajDb.encaissements.get('enc-janvier')).toEqual(janvier)
    expect(await regles('c1')).toEqual([
      [T4_2026, 10_000],
      [T1_2027, 10_000],
      [FONDS_T1_2027, 0],
    ])
  })

  it('rejeu sans changement : aucune pièce de reclassement n’est écrite, sa date n’est donc pas contrôlée ; le paiement en retard est écrit', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 10_000, { id: 'enc-decembre', postesDesignes: [`${T1_2027}:L1`], designationPartielleAcceptee: true })], { ...OPTIONS, date: '2027-12-25', aujourdhui: '2027-12-28' })
    const decembre = await ajDb.encaissements.get('enc-decembre')
    const avant = await compter()
    // Saisi le 10/01/2028, jour hors des exercices ouverts : seule une pièce de reclassement porterait ce jour, et il n'y en a pas.
    const horsExercice = await ecrireEncaissements('C1', [cheque(10_000)], { ...EN_RETARD, date: '2027-12-20', aujourdhui: '2028-01-10' })
    expect(horsExercice.reimputations).toEqual([])
    expect(horsExercice.piece).toMatchObject({ famille: 'Encaissement', date: '2027-12-20' })
    // Jour du traitement antérieur à la pièce de l'encaissement postérieur : celui-ci n'est pas corrigé, rien n'est refusé.
    const avantLaPiece = await ecrireEncaissements('C1', [cheque(5_000, { id: 'enc-cheque-2', piece: { mode: 'Chèque', numero: '0001235' } })], { ...EN_RETARD, date: '2027-12-20', aujourdhui: '2027-12-22' })
    expect(avantLaPiece.reimputations).toEqual([])
    expect(await compter()).toEqual({ pieces: avant.pieces + 2, encaissements: avant.encaissements + 2, journal: avant.journal + 4 })
    expect(await ajDb.encaissements.get('enc-decembre')).toEqual(decembre)
  })

  it('lot de deux comptes : seul le compte qui a des encaissements postérieurs est réimputé', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-janvier' })], OPTIONS)
    const retard = await ecrireEncaissements('C1', [virement('c2', 1_000, { id: 'enc-c2' }), cheque(20_000)], EN_RETARD)
    expect(retard.reimputations.map((r) => [r.compteId, r.encaissements.map((e) => e.id)])).toEqual([['c1', ['enc-janvier']]])
    expect(retard.encaissements.map((e) => [e.id, e.rang, e.reclassementIds])).toEqual([
      ['enc-c2', 0, undefined],
      ['enc-cheque', 1, [retard.reimputations[0].piece.id]],
    ])
    expect((await regles('c2'))[0]).toEqual([T4_2026, 1_000])
    expect(await lignesDe('enc-janvier')).toEqual([
      [T4_2026, 7_000],
      [T1_2027, 19_048],
      [FONDS_T1_2027, 952],
    ])
  })

  it('deux paiements en retard du même compte dans le lot : imputés dans l’ordre reçu, les encaissements postérieurs rejoués une seule fois', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-janvier' })], OPTIONS)
    const avant = await compter()
    const retard = await ecrireEncaissements('C1', [cheque(12_000, { id: 'enc-a' }), cheque(8_000, { id: 'enc-b', piece: { mode: 'Chèque', numero: '0001235' } })], EN_RETARD)
    expect(retard.encaissements.map((e) => e.imputation.lignes.map((l) => l.montantCentimes))).toEqual([[12_000], [8_000]])
    // Une seule pièce de reclassement pour le compte, et les deux paiements en retard dans la cause et dans la mention.
    expect(await compter()).toMatchObject({ pieces: avant.pieces + 2 })
    expect(retard.reimputations).toHaveLength(1)
    const janvier = await ajDb.encaissements.get('enc-janvier')
    expect(janvier?.reimputations).toHaveLength(1)
    expect(janvier?.reimputations?.[0].cause.encaissementIds).toEqual(['enc-a', 'enc-b'])
    expect(janvier?.reimputations?.[0].mention).toMatch(/encaissements enc-a, enc-b du 20\/12\/2026 \(pièce n° 4\) saisis le 15\/02\/2027/)
    expect(retard.encaissements.map((e) => e.reclassementIds)).toEqual([[retard.reimputations[0].piece.id], [retard.reimputations[0].piece.id]])
    expect(await regles('c1')).toEqual([
      [T4_2026, 27_000],
      [T1_2027, 19_048],
      [FONDS_T1_2027, 952],
    ])
  })

  it('sous-comptes du 450 : le reclassement débite le 45000 de l’appel perdu et crédite le 450-1 de l’appel gagné', async () => {
    await appeler(null, REGLAGE_450)
    await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-janvier' })], OPTIONS)
    const { reimputations } = await ecrireEncaissements('C1', [cheque(20_000)], EN_RETARD)
    expect(reimputations[0].piece.traitement.mouvements.map((m) => [m.sens, m.compte, m.montantCentimes])).toEqual([
      ['debit', 'ACAC.45000.00001.0', 20_000],
      ['credit', 'ACAC.45010.00001.0', 19_048],
      ['credit', 'ACAC.45000.00001.0', 952],
    ])
  })

  it('reliquat déplacé : le crédit « à imputer » de l’encaissement postérieur augmente, le solde du compte ne bouge que du paiement en retard', async () => {
    await saisirLesEcheances()
    await ecrireAppelDeFonds('C1', { jusquAu: '2026-10-01', mandatId: 'M1' })
    await ecrireEncaissements('C1', [virement('c2', 25_000, { id: 'enc-virement' })], { ...OPTIONS, date: '2026-10-20' })
    expect((await lireSoldesAnterieurs('C1')).soldes.c2).toBe(-4_000)
    const { reimputations } = await ecrireEncaissements('C1', [virement('c2', 10_000, { id: 'enc-retard', piece: { mode: 'Chèque', numero: '0000777' } })], { ...EN_RETARD, date: '2026-10-05' })
    // Sens : débit du 450 avec l'origine perdue, crédit du 45000 SANS origine (le reliquat augmente).
    expect(sansTraitement(reimputations[0].piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.45000.00002.0', sens: 'debit', montantCentimes: 10_000, ...origine(T4_2026, 'Budget'), liens: { compteCoproprietaireId: 'c2' } },
      { compte: 'ACAC.45000.00002.0', sens: 'credit', montantCentimes: 10_000, liens: { compteCoproprietaireId: 'c2' } },
    ])
    expect((await ajDb.encaissements.get('enc-virement'))?.imputation).toMatchObject({ lignes: [{ posteId: `${T4_2026}:L2`, montantCentimes: 11_000 }], resteAImputerCentimes: 14_000 })
    expect((await lireEtatDesComptes('C1')).soldes.find((s) => s.compteId === 'c2')).toEqual({
      compteId: 'c2',
      appeleCentimes: 21_000,
      regleCentimes: 21_000,
      resteDuCentimes: 0,
      creditAImputerCentimes: 14_000,
      soldeCentimes: -14_000,
    })
    expect(await lireSoldesAnterieurs('C1')).toMatchObject({ soldes: { c2: -14_000 }, ecarts: [] })
  })

  it('encaissement postérieur rejeté par la banque (F110) : hors du rejeu, le paiement en retard suit le circuit ordinaire', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-janvier' })], OPTIONS)
    await annuler('C1', 'enc-janvier', { date: '2027-01-16', motif: 'Virement retourné par la banque', piece: 'AVIS-2027-0007' })
    const { reimputations, encaissements } = await ecrireEncaissements('C1', [cheque(20_000)], EN_RETARD)
    expect(reimputations).toEqual([])
    expect(encaissements[0].imputation.lignes).toMatchObject([{ posteId: `${T4_2026}:L1`, montantCentimes: 20_000 }])
  })

  it('réimputation à deux niveaux : un second paiement en retard, plus ancien, ajoute une seconde réimputation ; le rejet de la banque croise ensuite les deux pièces de reclassement', async () => {
    const { reclassement: premier } = await janvierPuisChequeEnRetard()
    const second = await ecrireEncaissements('C1', [cheque(5_000, { id: 'enc-decembre', piece: { mode: 'Chèque', numero: '0001200' } })], { ...EN_RETARD, date: '2026-12-10', aujourdhui: '2027-02-16' })
    // Le chèque du 20/12 garde le T4 (200,00 €) ; seul le virement de janvier bouge encore : 50,00 € du T4 vers le 01/01/2027.
    expect(second.reimputations.map((r) => r.encaissements.map((e) => e.id))).toEqual([['enc-janvier']])
    expect(sansTraitement(second.reimputations[0].piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 5_000, ...origine(T4_2026, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 4_762, ...origine(T1_2027, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 238, ...origine(FONDS_T1_2027, 'Fonds travaux'), ...LIENS_C1 },
    ])
    const janvier = await ajDb.encaissements.get('enc-janvier')
    expect(janvier?.reimputations?.map((r) => [r.traitementId, r.le])).toEqual([
      [premier.id, '2027-02-15'],
      [second.reimputations[0].piece.id, '2027-02-16'],
    ])
    // Chaque réimputation garde l'imputation d'avant : la première celle de la pièce d'origine, la seconde celle de la première.
    expect(janvier?.reimputations?.map((r) => r.avant.lignes.map((l) => l.montantCentimes))).toEqual([[27_000], [7_000, 19_048, 952]])
    expect(await ajDb.encaissements.get('enc-cheque')).not.toHaveProperty('reimputations')
    expect(await regles('c1')).toEqual([
      [T4_2026, 27_000],
      [T1_2027, 23_810],
      [FONDS_T1_2027, 1_190],
    ])
    // Rejet du virement de janvier : (a) ses lignes d'origine au jour du débit, (b) le net des deux reclassements au jour de la saisie.
    const rejet = await annuler('C1', 'enc-janvier', { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-0010', aujourdhui: '2027-02-20' })
    expect(sansTraitement(rejet.piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'credit', montantCentimes: 27_000 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 27_000, ...origine(T4_2026, 'Budget') },
    ])
    expect(sansTraitement(rejet.correction?.traitement.mouvements ?? [])).toEqual([
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 25_000, ...origine(T4_2026, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 23_810, ...origine(T1_2027, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 1_190, ...origine(FONDS_T1_2027, 'Fonds travaux'), ...LIENS_C1 },
    ])
    expect(rejet.encaissement.annulation).toMatchObject({ reclassements: [premier.id, second.reimputations[0].piece.id], correctionId: rejet.correction?.id })
    expect(await regles('c1')).toEqual([
      [T4_2026, 25_000],
      [T1_2027, 0],
      [FONDS_T1_2027, 0],
    ])
  })

  it('ordre des encaissements d’un compte : deux lots du même jour écrits dans la même milliseconde gardent l’ordre de leurs pièces, puis leur rang', async () => {
    await appeler()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-02-15T10:00:00.000Z'))
    await ecrireEncaissements('C1', [virement('c1', 1_000, { id: 'enc-z' })], OPTIONS)
    await ecrireEncaissements('C1', [virement('c1', 1_000, { id: 'enc-m' }), virement('c1', 1_000, { id: 'enc-a' })], OPTIONS)
    vi.useRealTimers()
    const { encaissements } = await lireEtatDesComptes('C1')
    expect(new Set(encaissements.map((e) => e.createdAt)).size).toBe(1)
    expect(encaissements.map((e) => [e.id, e.rang])).toEqual([
      ['enc-z', 0],
      ['enc-m', 0],
      ['enc-a', 1],
    ])
  })

  it('pièce de reclassement annulée hors de son circuit, ou absente : le compte passe en écart ; l’annulation générique la refuse', async () => {
    const { reclassement } = await janvierPuisChequeEnRetard()
    const avant = await compter()
    // Aucune annulation n'est observée pour la famille « Correction de mouvements ».
    await expect(annulerPieceTraitement(reclassement.id, { id: 'annulation-generique', date: '2027-02-16' })).rejects.toThrow(/Aucune annulation observée/)
    expect(await compter()).toEqual(avant)
    expect((await lireEtatDesComptes('C1')).ecarts).toEqual([])
    await ajDb.traitements.update(reclassement.id, { statut: 'Annulé' })
    const annulee = await lireEtatDesComptes('C1')
    expect(annulee.ecarts.map((e) => [e.compteId, e.serie])).toEqual([['c1', '00001']])
    expect(annulee.ecarts[0].message).toMatch(/Encaissement enc-janvier : sa pièce de reclassement n° 5 a été annulée hors du circuit des encaissements/)
    expect([...new Set(annulee.postes.map((p) => p.compteId))]).toEqual(['c2', 'c3'])
    // Le rejet de la banque ne contre-passe pas un reclassement qu'il ne retrouve pas tel qu'il a été écrit.
    await expect(annuler('C1', 'enc-janvier', { date: '2027-02-15', motif: 'Virement retourné', piece: 'AVIS-0011' })).rejects.toThrow(/pièce de reclassement n° 5.*annulée/)
    await ajDb.traitements.delete(reclassement.id)
    expect((await lireEtatDesComptes('C1')).ecarts[0].message).toMatch(/Encaissement enc-janvier : sa pièce de reclassement .* est introuvable/)
    await expect(annuler('C1', 'enc-janvier', { date: '2027-02-15', motif: 'Virement retourné', piece: 'AVIS-0011' })).rejects.toThrow(/pièce de reclassement .* introuvable/)
  })
})

describe('Décision du 24/11/2026 (question 6, option 3) — réimputation refusée : rien n’est écrit', () => {
  it('garde du rejeu à blanc : un encaissement antérieur rejeté par la banque sans réimputation des suivants', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-a' })], { ...OPTIONS, date: '2027-01-10' })
    await ecrireEncaissements('C1', [virement('c1', 10_000, { id: 'enc-b' })], OPTIONS)
    // Le T4 redevient dû ; enc-b, imputé sur les postes du 01/01/2027, ne se rejouerait plus ainsi.
    await annuler('C1', 'enc-a', { date: '2027-01-20', motif: 'Virement retourné', piece: 'AVIS-0012' })
    const avant = await compter()
    await expect(ecrireEncaissements('C1', [cheque(5_000)], EN_RETARD)).rejects.toThrow(
      /Encaissement enc-b du 15\/01\/2027 : son imputation écrite ne se rejoue pas à l'identique.*Réimputation refusée, rien n'est écrit/,
    )
    expect(await compter()).toEqual(avant)
  })

  it('garde du rejeu à blanc : demande d’imputation sur les appels à venir suivie d’un appel écrit après coup', async () => {
    await saisirLesEcheances()
    await ecrireAppelDeFonds('C1', { jusquAu: '2026-10-01', mandatId: 'M1' })
    // Le 22/12/2026 : T4 soldé, 30,00 € « à imputer », aucun appel à venir n'étant encore écrit.
    const { encaissements } = await ecrireEncaissements('C1', [virement('c3', 15_000, { id: 'enc-avenir', imputerSurAVenir: true })], { ...OPTIONS, date: '2026-12-22' })
    expect(encaissements[0].imputation).toMatchObject({ lignes: [{ montantCentimes: 12_000 }], resteAImputerCentimes: 3_000 })
    await ecrireAppelDeFonds('C1', { jusquAu: '2027-01-01', mandatId: 'M1' })
    const avant = await compter()
    await expect(ecrireEncaissements('C1', [virement('c3', 1_000, { id: 'enc-retard' })], EN_RETARD)).rejects.toThrow(/Encaissement enc-avenir du 22\/12\/2026 : son imputation écrite ne se rejoue pas à l'identique.*reliquat/)
    expect(await compter()).toEqual(avant)
  })

  it('garde du rejeu à blanc : poste désigné disparu (appel annulé depuis) : refus expliqué, avec sa cause', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 1_000, { id: 'enc-janvier', postesDesignes: [`${T1_2027}:L1`] })], OPTIONS)
    // L'appel du T1 2027 est annulé depuis : ses postes, non réglés, sont écartés sans écart.
    await ajDb.echeancesAppel
      .where('coproprieteId')
      .equals('C1')
      .filter((e) => e.id === T1_2027 || e.id === FONDS_T1_2027)
      .modify({ statut: 'Annulé' })
    expect((await lireEtatDesComptes('C1')).ecarts).toEqual([])
    const avant = await compter()
    await expect(ecrireEncaissements('C1', [cheque(5_000)], EN_RETARD)).rejects.toThrow(/Encaissement enc-janvier du 15\/01\/2027 : son imputation écrite ne se rejoue pas à l'identique.*Poste désigné inconnu/)
    expect(await compter()).toEqual(avant)
  })

  it('désignation du débiteur : refus si elle a joué et serait déplacée ; pas de refus si elle était refusée avant et le reste après', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-janvier', postesDesignes: [`${T4_2026}:L1`] })], OPTIONS)
    await ecrireEncaissements('C1', [virement('c2', 10_000, { id: 'enc-c2', postesDesignes: [`${T1_2027}:L2`] })], OPTIONS)
    expect((await ajDb.encaissements.get('enc-c2'))?.imputation.designationPartielleRefusee).toBe(true)
    const avant = await compter()
    await expect(ecrireEncaissements('C1', [cheque(10_000)], EN_RETARD)).rejects.toThrow(/Encaissement enc-janvier du 15\/01\/2027 : le débiteur a désigné le poste .*Réimputation refusée, rien n'est écrit/)
    // Un seul compte refusé refuse tout le lot.
    await expect(ecrireEncaissements('C1', [virement('c3', 1_000), cheque(10_000)], EN_RETARD)).rejects.toThrow(/le débiteur a désigné/)
    expect(await compter()).toEqual(avant)
    // Compte 2 : désignation partielle refusée avant et après ; le chèque solde le T4, le virement passe aux postes du 01/01/2027.
    const { reimputations } = await ecrireEncaissements('C1', [virement('c2', 21_000, { id: 'enc-c2-retard', piece: { mode: 'Chèque', numero: '0000778' } })], EN_RETARD)
    expect(reimputations.map((r) => r.compteId)).toEqual(['c2'])
    expect((await ajDb.encaissements.get('enc-c2'))?.imputation).toMatchObject({ lignes: [{ montantCentimes: 9_524 }, { montantCentimes: 476 }], designationPartielleRefusee: true })
  })

  it('date : jour du traitement hors des exercices ouverts, ou antérieur à une pièce corrigée ; paiement en retard hors exercice (question 6 bis)', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-decembre' })], { ...OPTIONS, date: '2027-12-25', aujourdhui: '2027-12-28' })
    const avant = await compter()
    // La pièce de reclassement serait datée du 10/01/2028 : aucun exercice n'est ouvert pour ce jour.
    await expect(ecrireEncaissements('C1', [cheque(5_000)], { ...EN_RETARD, date: '2027-12-20', aujourdhui: '2028-01-10' })).rejects.toThrow(
      /Pièce de reclassement datée du 10\/01\/2028, jour du traitement : hors des exercices du syndicat ouverts dans VitFix : 2026 .*Réimputation refusée/,
    )
    // Une correction ne précède pas la pièce qu'elle corrige : le jour du traitement donné est antérieur à la pièce n° 3.
    await expect(ecrireEncaissements('C1', [cheque(5_000)], { ...EN_RETARD, date: '2027-12-20', aujourdhui: '2027-12-22' })).rejects.toThrow(
      /Pièce de reclassement datée du 22\/12\/2027, jour du traitement : antérieure à la pièce n° 3 du 25\/12\/2027.*enc-decembre.*Réimputation refusée/,
    )
    // Question 6 bis : le paiement en retard lui-même reste refusé hors des exercices, option demandée ou non.
    await expect(ecrireEncaissements('C1', [cheque(5_000)], { ...EN_RETARD, date: '2025-12-20' })).rejects.toThrow(/Encaissement daté du 20\/12\/2025 : hors des exercices/)
    expect(await compter()).toEqual(avant)
  })

  it('compte en écart, solde repris dû : refusés comme sans l’option', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c2', 21_000, { id: 'enc-c2' })], OPTIONS)
    await ecrireEncaissements('C1', [virement('c3', 12_000, { id: 'enc-c3' })], OPTIONS)
    await ajDb.comptesCoproprietaires.update('c2', { reprise: { coproprietaireId: 'f2', soldeDuCentimes: 12_300, statutFiche: 'Impayé', releveLe: '2026-11-01' } })
    await ajDb.traitements.update((await ajDb.encaissements.get('enc-c3'))?.traitementId ?? '', { statut: 'Annulé' })
    const avant = await compter()
    await expect(ecrireEncaissements('C1', [virement('c2', 1_000)], EN_RETARD)).rejects.toThrow(/solde repris/)
    await expect(ecrireEncaissements('C1', [virement('c3', 1_000)], EN_RETARD)).rejects.toThrow(/annulée hors du circuit des encaissements/)
    expect(await compter()).toEqual(avant)
  })
})

describe('Décision du 24/11/2026 (question 6) — rejet de la banque (F110) d’un encaissement réimputé : deux écritures', () => {
  it('débit de la banque antérieur au reclassement : l’annulation contre-passe les lignes d’origine au jour du débit, la correction contre-passe le reclassement au jour de la saisie', async () => {
    const { janvier, reclassement } = await janvierPuisChequeEnRetard()
    const debit = { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-2027-0050' }
    // Refus : la correction, datée du jour de la saisie, précéderait la pièce de reclassement du 15/02/2027.
    const avant = await compter()
    await expect(annuler('C1', 'enc-janvier', { ...debit, aujourdhui: '2027-02-10' })).rejects.toThrow(/antérieure à la pièce de reclassement/)
    await expect(annuler('C1', 'enc-janvier', { ...debit, aujourdhui: '2028-01-10' })).rejects.toThrow(/Correction du reclassement datée du 10\/01\/2028, jour de la saisie : hors des exercices/)
    expect(await compter()).toEqual(avant)
    const { piece, correction, encaissement, postes } = await annuler('C1', 'enc-janvier', { ...debit, aujourdhui: '2027-02-20' }, { actor: 'test' })
    // (a) Les lignes d'origine exactes, à la date du débit : rien de ce qui n'existe que depuis le 15/02/2027.
    expect(piece).toMatchObject({ numero: 6, famille: "Annulation d'encaissement", date: '2027-01-25' })
    expect(piece.traitement.annule).toBe(janvier.piece.id)
    expect(sansTraitement(piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'credit', montantCentimes: 27_000 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 27_000, ...origine(T4_2026, 'Budget') },
    ])
    // (b) La contre-passation du reclassement, au jour de la saisie.
    expect(correction).toMatchObject({ numero: 7, famille: 'Correction de mouvements', date: '2027-02-20', statut: 'Enregistré', mandatId: 'M1' })
    expect(correction?.traitement.annule).toBeUndefined()
    expect(sansTraitement(correction?.traitement.mouvements ?? [])).toEqual([
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 20_000, ...origine(T4_2026, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 19_048, ...origine(T1_2027, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 952, ...origine(FONDS_T1_2027, 'Fonds travaux'), ...LIENS_C1 },
    ])
    expect(encaissement).toMatchObject({
      statut: 'Annulé',
      annulation: { le: '2027-01-25', traitementId: piece.id, dateComptable: '2027-01-25', reclassements: [reclassement.id], correctionId: correction?.id },
    })
    expect(encaissement.annulation).not.toHaveProperty('nature')
    expect(await ajDb.encaissements.get('enc-janvier')).toEqual(encaissement)
    // Il ne reste que le chèque du 20/12/2026 : 200,00 € sur le T4.
    expect(postes.filter((p) => p.compteId === 'c1').map((p) => p.regleCentimes)).toEqual([20_000, 0, 0])
    expect(await regles('c1')).toEqual([
      [T4_2026, 20_000],
      [T1_2027, 0],
      [FONDS_T1_2027, 0],
    ])
    expect(await soldeDu512()).toBe(20_000)
    expect((await lireEtatDesComptes('C1')).ecarts).toEqual([])
  })

  it('sous-comptes du 450 : l’annulation débite le 45000 de l’appel d’origine, la correction reprend le 450-1 et le 45000 que le reclassement a crédités', async () => {
    await appeler(null, REGLAGE_450)
    await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-janvier' })], OPTIONS)
    await ecrireEncaissements('C1', [cheque(20_000)], EN_RETARD)
    const { piece, correction } = await annuler('C1', 'enc-janvier', { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-2027-0052', aujourdhui: '2027-02-20' })
    expect(piece.traitement.mouvements.map((m) => [m.sens, m.compte, m.montantCentimes])).toEqual([
      ['credit', 'ACAC.51200.00000.0', 27_000],
      ['debit', 'ACAC.45000.00001.0', 27_000],
    ])
    expect(sansTraitement(correction?.traitement.mouvements ?? [])).toEqual([
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 20_000, ...origine(T4_2026, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45010.00001.0', sens: 'debit', montantCentimes: 19_048, ...origine(T1_2027, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 952, ...origine(FONDS_T1_2027, 'Fonds travaux'), ...LIENS_C1 },
    ])
    expect(await regles('c1')).toEqual([
      [T4_2026, 20_000],
      [T1_2027, 0],
      [FONDS_T1_2027, 0],
    ])
    expect((await lireEtatDesComptes('C1')).ecarts).toEqual([])
  })

  it('imputation courante qui ne se recoupe plus avec la pièce d’origine et les reclassements : refus, rien n’est écrit', async () => {
    await janvierPuisChequeEnRetard()
    // Imputation gardée modifiée hors du circuit : 80,00 € sur le T4 au lieu des 70,00 € que les pièces donnent.
    await ajDb.encaissements.where('id').equals('enc-janvier').modify((e) => {
      e.imputation.lignes[0].montantCentimes += 1_000
      e.imputation.lignes[1].montantCentimes -= 1_000
    })
    const avant = await compter()
    await expect(annuler('C1', 'enc-janvier', { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-2027-0053', aujourdhui: '2027-02-20' })).rejects.toThrow(
      /Encaissement enc-janvier : sa pièce d'origine et ses pièces de reclassement ne redonnent pas son imputation courante \(compte ACAC\.45000\.00001\.0, appel A-20261001-001-1 \(Budget\) : 70,00\s€ écrits au crédit, 80,00\s€ attendus\) ; l'écriture contraire ne contre-passe que ce qui a été écrit/,
    )
    expect(await compter()).toEqual(avant)
    expect((await ajDb.encaissements.get('enc-janvier'))?.statut).toBe('Enregistré')
  })

  it('rejet d’un encaissement jamais réimputé : une seule écriture, ni correction, ni renvoi à un reclassement', async () => {
    await appeler()
    await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-1' })], OPTIONS)
    const resultat = await annuler('C1', 'enc-1', { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-0013' })
    expect(resultat.correction).toBeNull()
    expect(resultat).not.toHaveProperty('reimputationsCausees')
    expect(resultat.encaissement.annulation).toEqual({
      le: '2027-01-25',
      motif: 'Virement retourné',
      piece: 'AVIS-0013',
      traitementId: resultat.piece.id,
      dateComptable: '2027-01-25',
      mention: 'pièce « AVIS-0013 » du 25/01/2027',
    })
  })

  it('À valider — rejet par la banque du paiement en retard qui a causé une réimputation : l’encaissement réimputé garde sa réimputation, le résultat le signale', async () => {
    await janvierPuisChequeEnRetard()
    const janvier = await ajDb.encaissements.get('enc-janvier')
    const { piece, correction, reimputationsCausees } = await annuler('C1', 'enc-cheque', { date: '2027-01-05', motif: 'Chèque impayé', piece: 'AVIS-2027-0051', aujourdhui: '2027-02-20' })
    expect(sansTraitement(piece.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'credit', montantCentimes: 20_000 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 20_000, ...origine(T4_2026, 'Budget') },
    ])
    expect(correction).toBeNull()
    expect(reimputationsCausees).toEqual(['enc-janvier'])
    // Solution prudente : la décision F110 couvre la désimputation du chèque, pas l'annulation de la réimputation qu'il a causée.
    expect(await ajDb.encaissements.get('enc-janvier')).toEqual(janvier)
    expect(await regles('c1')).toEqual([
      [T4_2026, 7_000],
      [T1_2027, 19_048],
      [FONDS_T1_2027, 952],
    ])
    // Conséquence : une réimputation ultérieure de ce compte est refusée par la garde du rejeu à blanc.
    await expect(ecrireEncaissements('C1', [cheque(1_000, { id: 'enc-autre', piece: { mode: 'Chèque', numero: '0001300' } })], { ...EN_RETARD, date: '2026-12-22', aujourdhui: '2027-02-21' })).rejects.toThrow(
      /Encaissement enc-janvier.*ne se rejoue pas à l'identique/,
    )
  })
})

/** Annulation pour erreur de saisie des essais : doublon, saisie le 15/02/2027. */
const corriger = (pieceId: string, saisie: Partial<SaisieAnnulationPourErreur> = {}, options?: { actor?: string | null }, coproprieteId = 'C1') =>
  annulerPieceEncaissementsPourErreur(coproprieteId, pieceId, { motif: 'doublon', explication: 'virement VIR-0001 saisi deux fois', aujourdhui: '2027-02-15', ...saisie }, options)

describe('Décision du 24/11/2026 (question 6, option 4) — annulation d’une pièce d’encaissement pour erreur de saisie', () => {
  it('motifs admis : montant, compte, doublon', () => {
    expect(MOTIFS_ERREUR_DE_SAISIE).toEqual(['montant', 'compte', 'doublon'])
  })

  it('doublon : la pièce la plus récente est contre-passée entière, 512 compris ; elle passe « Annulé », son encaissement aussi, les postes reviennent à l’état d’avant', async () => {
    await appeler()
    const premier = await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-1' })], OPTIONS)
    const reglesAvant = await regles('c1')
    const doublon = await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-2' })], OPTIONS)
    expect(doublon.piece.numero).toBe(4)
    // La pièce n° 3 ne s'annule pas : l'encaissement de la n° 4 a été imputé sur les soldes qu'elle a laissés.
    const avant = await compter()
    await expect(corriger(premier.piece.id)).rejects.toThrow(
      /Pièce n° 3 : l'encaissement enc-2 du 15\/01\/2027 \(pièce n° 4\), postérieur sur le compte « c1 ».*Annulation refusée.*Pour un doublon, c'est la pièce la plus récente \(n° 4\) qui s'annule/,
    )
    expect(await compter()).toEqual(avant)
    const { piece, annulation, correction, encaissements, postes } = await corriger(doublon.piece.id, {}, { actor: 'test' })
    expect(annulation).toMatchObject({ numero: 5, famille: "Annulation d'encaissement", date: '2027-02-15', statut: 'Enregistré', coproprieteId: 'C1', mandatId: 'M1' })
    expect(annulation.traitement.annule).toBe(doublon.piece.id)
    expect(sansTraitement(annulation.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'credit', montantCentimes: 27_000 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 25_714, ...origine(T1_2027, 'Budget') },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 1_286, ...origine(FONDS_T1_2027, 'Fonds travaux') },
    ])
    expect(correction).toBeNull()
    expect(piece).toMatchObject({ id: doublon.piece.id, statut: 'Annulé', annuleePar: annulation.id, updatedBy: 'test' })
    expect(await ajDb.traitements.get(doublon.piece.id)).toEqual(piece)
    expect(encaissements).toHaveLength(1)
    expect(encaissements[0]).toMatchObject({ id: 'enc-2', statut: 'Annulé', impute: true, traitementId: doublon.piece.id, updatedBy: 'test' })
    expect(encaissements[0].annulation).toEqual({
      le: '2027-02-15',
      motif: 'Erreur de saisie (doublon) : virement VIR-0001 saisi deux fois',
      piece: "Note de correction du 15/02/2027 (pièce d'origine n° 4)",
      traitementId: annulation.id,
      dateComptable: '2027-02-15',
      mention: 'Annulation pour erreur de saisie (doublon) de la pièce n° 4 du 15/01/2027 (« Encaissement »)',
      nature: 'erreur-saisie',
    })
    expect(await ajDb.encaissements.get('enc-2')).toEqual(encaissements[0])
    expect(postes.filter((p) => p.compteId === 'c1').map((p) => p.regleCentimes)).toEqual([27_000, 0, 0])
    expect(await regles('c1')).toEqual(reglesAvant)
    expect(await soldeDu512()).toBe(27_000)
    expect((await lireEtatDesComptes('C1')).ecarts).toEqual([])
    const journal = (await ajDb.activityLog.toArray()).filter((e) => e.qui === 'test')
    expect(journal.map((e) => `${e.entite} ${e.action}`).sort((a, b) => a.localeCompare(b))).toEqual(['encaissements update', 'traitements create', 'traitements update'])
    // La pièce est annulée une fois : ni seconde annulation pour erreur, ni rejet de la banque, ni annulation générique.
    const apres = await compter()
    await expect(corriger(doublon.piece.id)).rejects.toThrow(/Pièce n° 4 déjà annulée/)
    await expect(annuler('C1', 'enc-2', { date: '2027-02-15', motif: 'Virement retourné', piece: 'AVIS-0014' })).rejects.toThrow(/pièce n° 4 est déjà annulée/)
    await expect(annulerPieceTraitement(doublon.piece.id, { id: 'annulation-generique', date: '2027-02-16' })).rejects.toThrow(/annulerEncaissementEcrit.*annulerPieceEncaissementsPourErreur/)
    await expect(annulerPieceTraitement(premier.piece.id, { id: 'annulation-generique', date: '2027-02-16' })).rejects.toThrow(/annulerPieceEncaissementsPourErreur/)
    expect(await compter()).toEqual(apres)
  })

  it('lot de trois virements (deux comptes) : toute la pièce est contre-passée, les trois encaissements sont annulés, aucun compte en écart', async () => {
    await appeler()
    const lot = await ecrireEncaissements(
      'C1',
      [virement('c1', 20_000, { id: 'enc-a' }), virement('c2', 21_000, { id: 'enc-b', piece: { mode: 'Virement', numero: 'VIR-0002' } }), virement('c1', 7_000, { id: 'enc-c', piece: { mode: 'Virement', numero: 'VIR-0003' } })],
      { ...OPTIONS, famille: 'Fichier Virement reçus' },
    )
    const { annulation, encaissements, piece } = await corriger(lot.piece.id, { motif: 'compte', explication: 'fichier de virements d’un autre syndicat' })
    expect(annulation.famille).toBe("Annulation d'encaissement")
    expect(annulation.traitement.mouvements.map((m) => [m.sens, m.compte, m.montantCentimes])).toEqual([
      ['credit', 'ACAC.51200.00000.0', 20_000],
      ['debit', 'ACAC.45000.00001.0', 20_000],
      ['credit', 'ACAC.51200.00000.0', 21_000],
      ['debit', 'ACAC.45000.00002.0', 21_000],
      ['credit', 'ACAC.51200.00000.0', 7_000],
      ['debit', 'ACAC.45000.00001.0', 7_000],
    ])
    expect(piece.statut).toBe('Annulé')
    expect(encaissements.map((e) => [e.id, e.statut, e.annulation?.nature, e.annulation?.motif])).toEqual([
      ['enc-a', 'Annulé', 'erreur-saisie', 'Erreur de saisie (compte) : fichier de virements d’un autre syndicat'],
      ['enc-b', 'Annulé', 'erreur-saisie', 'Erreur de saisie (compte) : fichier de virements d’un autre syndicat'],
      ['enc-c', 'Annulé', 'erreur-saisie', 'Erreur de saisie (compte) : fichier de virements d’un autre syndicat'],
    ])
    const etat = await lireEtatDesComptes('C1')
    expect(etat.ecarts).toEqual([])
    expect(etat.soldes.map((s) => s.regleCentimes)).toEqual([0, 0, 0])
    expect(await soldeDu512()).toBe(0)
  })

  it('erreur de montant : 2 000,00 € saisis pour 200,00 € ; annulation, puis ressaisie sous un nouvel identifiant', async () => {
    await appeler()
    const faux = await ecrireEncaissements('C1', [virement('c1', 200_000, { id: 'enc-faux' })], OPTIONS)
    expect(faux.encaissements[0].imputation.resteAImputerCentimes).toBe(125_749)
    await corriger(faux.piece.id, { motif: 'montant', explication: '2 000,00 € saisis pour 200,00 €' })
    expect((await lireEtatDesComptes('C1')).soldes[0]).toMatchObject({ compteId: 'c1', regleCentimes: 0, creditAImputerCentimes: 0 })
    // L'identifiant de l'encaissement annulé reste pris : la ressaisie a le sien.
    await expect(ecrireEncaissements('C1', [virement('c1', 20_000, { id: 'enc-faux' })], OPTIONS)).rejects.toThrow(/enc-faux déjà enregistré/)
    const juste = await ecrireEncaissements('C1', [virement('c1', 20_000, { id: 'enc-juste' })], OPTIONS)
    expect(juste.encaissements[0].imputation).toMatchObject({ lignes: [{ posteId: `${T4_2026}:L1`, montantCentimes: 20_000 }], resteAImputerCentimes: 0 })
    expect(await soldeDu512()).toBe(20_000)
  })

  it('encaissement réimputé, puis sa pièce annulée pour erreur : lignes d’origine contre-passées, reclassement contre-passé par une « Correction de mouvements » du même jour', async () => {
    const { janvier, reclassement } = await janvierPuisChequeEnRetard()
    const avant = await compter()
    await expect(corriger(janvier.piece.id, { aujourdhui: '2027-02-10' })).rejects.toThrow(/antérieure à la pièce de reclassement/)
    expect(await compter()).toEqual(avant)
    const { annulation, correction, encaissements } = await corriger(janvier.piece.id, { motif: 'compte', explication: 'virement d’un autre copropriétaire', aujourdhui: '2027-02-20' })
    expect(annulation).toMatchObject({ numero: 6, date: '2027-02-20' })
    expect(sansTraitement(annulation.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'credit', montantCentimes: 27_000 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 27_000, ...origine(T4_2026, 'Budget') },
    ])
    expect(correction).toMatchObject({ numero: 7, famille: 'Correction de mouvements', date: '2027-02-20' })
    expect(sansTraitement(correction?.traitement.mouvements ?? [])).toEqual([
      { compte: 'ACAC.45000.00001.0', sens: 'credit', montantCentimes: 20_000, ...origine(T4_2026, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 19_048, ...origine(T1_2027, 'Budget'), ...LIENS_C1 },
      { compte: 'ACAC.45000.00001.0', sens: 'debit', montantCentimes: 952, ...origine(FONDS_T1_2027, 'Fonds travaux'), ...LIENS_C1 },
    ])
    expect(encaissements[0].annulation).toMatchObject({ nature: 'erreur-saisie', reclassements: [reclassement.id], correctionId: correction?.id })
    expect(await regles('c1')).toEqual([
      [T4_2026, 20_000],
      [T1_2027, 0],
      [FONDS_T1_2027, 0],
    ])
    expect((await lireEtatDesComptes('C1')).ecarts).toEqual([])
  })

  it('pièce d’un paiement en retard qui a causé une réimputation : refusée, des encaissements postérieurs ont été réimputés d’après elle', async () => {
    const { retard } = await janvierPuisChequeEnRetard()
    const avant = await compter()
    await expect(corriger(retard.piece.id, { motif: 'montant', explication: 'chèque de 20,00 €' })).rejects.toThrow(
      /Pièce n° 4 : l'encaissement enc-janvier du 15\/01\/2027 \(pièce n° 3\), postérieur sur le compte « c1 ».*Annulation refusée/,
    )
    expect(await compter()).toEqual(avant)
  })

  it('doublon suivi d’un vrai paiement : le refus nomme la pièce en double, jamais le dernier encaissement du compte', async () => {
    await appeler()
    const premier = await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-1' })], OPTIONS)
    const doublon = await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-2' })], OPTIONS)
    const vrai = await ecrireEncaissements('C1', [virement('c1', 5_000, { id: 'enc-3', piece: { mode: 'Virement', numero: 'VIR-0002' } })], { ...OPTIONS, date: '2027-02-01' })
    expect([premier.piece.numero, doublon.piece.numero, vrai.piece.numero]).toEqual([3, 4, 5])
    const avant = await compter()
    const refus = (pieceId: string) => corriger(pieceId).then(() => 'annulée', (erreur: Error) => erreur.message)
    // La pièce n° 3 : son double est la n° 4 (même date, même montant), pas la n° 5, vrai paiement et dernière pièce du compte.
    const refusDuPremier = await refus(premier.piece.id)
    expect(refusDuPremier).toMatch(/Pièce n° 3 : l'encaissement enc-2 du 15\/01\/2027 \(pièce n° 4\), postérieur sur le compte « c1 ».*Annulation refusée, rien n'est écrit/)
    expect(refusDuPremier).toMatch(
      /Pour un doublon : la pièce en double la plus récente est la n° 4 \(encaissement enc-2, de même date et de même montant\) ; elle ne s'annule pas non plus tant que l'encaissement enc-3 du 01\/02\/2027 \(pièce n° 5\), postérieur sur le compte « c1 », existe : aucune des deux pièces ne s'annule par ce circuit pour l'instant \(à valider\)\.$/,
    )
    expect(refusDuPremier).not.toMatch(/n° 5\) qui s'annule/)
    // La pièce n° 4, le double : refusée à cause du vrai paiement, sans conseiller d'annuler celui-ci.
    const refusDuDouble = await refus(doublon.piece.id)
    expect(refusDuDouble).toMatch(/Pièce n° 4 : l'encaissement enc-3 du 01\/02\/2027 \(pièce n° 5\), postérieur sur le compte « c1 ».*Annulation refusée, rien n'est écrit/)
    expect(refusDuDouble).not.toMatch(/Pour un doublon/)
    expect(await compter()).toEqual(avant)
  })

  it('doublon dont le double est dans un lot à deux comptes : le refus nomme l’autre encaissement de la pièce, contre-passé avec elle et à ressaisir', async () => {
    await appeler()
    const premier = await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-1' })], OPTIONS)
    const lot = await ecrireEncaissements(
      'C1',
      [virement('c1', 27_000, { id: 'enc-2' }), virement('c2', 21_000, { id: 'enc-b', piece: { mode: 'Virement', numero: 'VIR-0002' } })],
      OPTIONS,
    )
    expect([premier.piece.numero, lot.piece.numero]).toEqual([3, 4])
    const avant = await compter()
    const refus = await corriger(premier.piece.id).then(() => 'annulée', (erreur: Error) => erreur.message)
    expect(refus).toMatch(
      /Pour un doublon, c'est la pièce la plus récente \(n° 4\) qui s'annule : celle de l'encaissement enc-2, de même date et de même montant\. Elle porte aussi l'encaissement enc-b \(compte « c2 », 210,00\s€\) : la pièce se contre-passe entière, cet encaissement passe « Annulé » avec elle et sera à ressaisir \(annuler un seul encaissement d'un lot : à valider\)\.$/,
    )
    expect(await compter()).toEqual(avant)
    // Le conseil suivi : la pièce n° 4 se contre-passe entière, le vrai paiement de c2 compris (option 4), puis il se ressaisit.
    const { encaissements } = await corriger(lot.piece.id)
    expect(encaissements.map((e) => [e.id, e.statut, e.annulation?.nature])).toEqual([
      ['enc-2', 'Annulé', 'erreur-saisie'],
      ['enc-b', 'Annulé', 'erreur-saisie'],
    ])
    await ecrireEncaissements('C1', [virement('c2', 21_000, { id: 'enc-b-ressaisi', piece: { mode: 'Virement', numero: 'VIR-0002' } })], OPTIONS)
    expect((await ajDb.encaissements.get('enc-b-ressaisi'))?.statut).not.toBe('Annulé')
  })

  it('compte en écart : pas un refus ; l’écriture contraire se lit dans les lignes gardées, le compte reste en écart', async () => {
    await appeler()
    const ancienne = await ecrireEncaissements('C1', [virement('c3', 1_000, { id: 'enc-c3a' })], { ...OPTIONS, date: '2027-01-10' })
    const fausse = await ecrireEncaissements('C1', [virement('c3', 2_000, { id: 'enc-c3b' })], OPTIONS)
    // La pièce de l'encaissement du 10/01 annulée hors du circuit des encaissements : le compte c3 passe en écart.
    await ajDb.traitements.update(ancienne.piece.id, { statut: 'Annulé' })
    expect((await lireEtatDesComptes('C1')).ecarts.map((e) => e.compteId)).toEqual(['c3'])
    const { piece, annulation, encaissements } = await corriger(fausse.piece.id, { motif: 'montant', explication: '20,00 € saisis pour 2,00 €' })
    expect(piece).toMatchObject({ statut: 'Annulé', annuleePar: annulation.id })
    expect(sansTraitement(annulation.traitement.mouvements)).toEqual([
      { compte: 'ACAC.51200.00000.0', sens: 'credit', montantCentimes: 2_000 },
      { compte: 'ACAC.45000.00003.0', sens: 'debit', montantCentimes: 2_000, ...origine(T4_2026, 'Budget') },
    ])
    expect(encaissements.map((e) => [e.id, e.statut, e.annulation?.nature])).toEqual([['enc-c3b', 'Annulé', 'erreur-saisie']])
    expect((await lireEtatDesComptes('C1')).ecarts.map((e) => e.compteId)).toEqual(['c3'])
  })

  it('db/traitements.marquerPieceEncaissementsAnnulee, réservée à ce circuit : refusée sans l’écriture contraire de TOUTE la pièce', async () => {
    const { t4 } = await appeler()
    const lot = await ecrireEncaissements('C1', [virement('c1', 20_000, { id: 'enc-a' }), virement('c2', 21_000, { id: 'enc-b' })], OPTIONS)
    const autre = await ecrireEncaissements('C1', [virement('c3', 12_000, { id: 'enc-c' })], OPTIONS)
    // Rejets de la banque d'UN encaissement : chacun renvoie (annule) à sa pièce d'origine, sans la contre-passer entière.
    const rejet = await annuler('C1', 'enc-b', { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-0016' })
    const rejetAutre = await annuler('C1', 'enc-c', { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-0017' })
    const avant = await compter()
    await expect(marquerPieceEncaissementsAnnulee('inconnue', rejet.piece.id)).rejects.toThrow(/introuvable/)
    await expect(marquerPieceEncaissementsAnnulee(t4.id, rejet.piece.id)).rejects.toThrow(/Pièce n° 1 \(« Appel de fonds »\) : seule une pièce d'encaissement/)
    const sansEcritureContraire = /Pièce n° 3 : son écriture contraire .* n'est pas enregistrée ; la pièce ne passe « Annulé » qu'avec elle/
    await expect(marquerPieceEncaissementsAnnulee(lot.piece.id, 'inconnue')).rejects.toThrow(sansEcritureContraire)
    await expect(marquerPieceEncaissementsAnnulee(lot.piece.id, autre.piece.id)).rejects.toThrow(sansEcritureContraire)
    await expect(marquerPieceEncaissementsAnnulee(lot.piece.id, rejetAutre.piece.id)).rejects.toThrow(sansEcritureContraire)
    // Le rejet de la banque d'enc-b renvoie bien à la pièce du lot, mais enc-a reste actif : la pièce ne passe pas « Annulé ».
    await expect(marquerPieceEncaissementsAnnulee(lot.piece.id, rejet.piece.id)).rejects.toThrow(
      /Pièce n° 3 : l'écriture contraire n° 5 ne contre-passe pas toutes ses lignes \(rejet de la banque d'un seul encaissement \?\) ; la pièce ne passe « Annulé » qu'avec l'écriture contraire de toute la pièce/,
    )
    expect(await compter()).toEqual(avant)
    expect((await ajDb.traitements.get(lot.piece.id))?.statut).toBe('Enregistré')
    // Écriture contraire d'un autre syndicat (D1), puis pièce déjà imputée.
    await ajDb.traitements.update(rejet.piece.id, { coproprieteId: 'C2' })
    await expect(marquerPieceEncaissementsAnnulee(lot.piece.id, rejet.piece.id)).rejects.toThrow(sansEcritureContraire)
    await changerStatutTraitement(lot.piece.id, 'Imputé')
    await expect(marquerPieceEncaissementsAnnulee(lot.piece.id, rejet.piece.id)).rejects.toThrow(/Pièce n° 3 au statut « Imputé »/)
  })

  it('refus, rien n’est écrit : motif hors liste, explication vide, jour de la correction, pièce introuvable, d’un autre syndicat, d’une autre famille, imputée, mandat étranger', async () => {
    const { t4 } = await appeler()
    const { piece } = await ecrireEncaissements('C1', [virement('c1', 27_000, { id: 'enc-1' })], OPTIONS)
    const avant = await compter()
    await expect(corriger(piece.id, { motif: 'date' as never })).rejects.toThrow(/motif « date » hors de la liste \(montant, compte, doublon\)/)
    await expect(corriger(piece.id, { explication: '  ' })).rejects.toThrow(/explication attendue/)
    await expect(corriger(piece.id, { aujourdhui: 'demain' })).rejects.toThrow(/Date du jour invalide/)
    await expect(corriger(piece.id, { aujourdhui: '2127-02-15' })).rejects.toThrow(/Correction datée du 15\/02\/2127 : année improbable/)
    await expect(corriger(piece.id, { aujourdhui: '2028-01-10' })).rejects.toThrow(/Correction datée du 10\/01\/2028, jour de la saisie : hors des exercices du syndicat ouverts dans VitFix/)
    await expect(corriger(piece.id, { aujourdhui: '2027-01-10' })).rejects.toThrow(/Correction datée du 10\/01\/2027, antérieure à la pièce n° 3 du 15\/01\/2027/)
    await expect(corriger('inconnue')).rejects.toThrow(/Pièce introuvable/)
    await expect(corriger(piece.id, {}, undefined, 'C2')).rejects.toThrow(/autre syndicat.*D1/)
    await expect(corriger(t4.id)).rejects.toThrow(/Pièce n° 1 \(« Appel de fonds »\) : seule une pièce d'encaissement/)
    await expect(corriger(piece.id, { mandatId: 'M2' })).rejects.toThrow(/autre syndicat/)
    expect(await compter()).toEqual(avant)
    await changerStatutTraitement(piece.id, 'Imputé')
    await expect(corriger(piece.id)).rejects.toThrow(/Pièce n° 3 au statut « Imputé »/)
    expect((await ajDb.encaissements.get('enc-1'))?.statut).toBe('Enregistré')
  })

  it('À valider — refus : un encaissement de la pièce déjà rejeté par la banque, pointé au rapprochement, ou chèque d’une remise', async () => {
    await appeler()
    const lot = await ecrireEncaissements('C1', [virement('c1', 20_000, { id: 'enc-a' }), virement('c2', 21_000, { id: 'enc-b' })], OPTIONS)
    const pointe = await ecrireEncaissements('C1', [virement('c3', 12_000, { id: 'enc-pointe' })], OPTIONS)
    await annuler('C1', 'enc-b', { date: '2027-01-25', motif: 'Virement retourné', piece: 'AVIS-0015' })
    const avant = await compter()
    await expect(corriger(lot.piece.id)).rejects.toThrow(/Encaissement enc-b déjà annulé le 25\/01\/2027/)
    // Pointé : le statut « Rapproché » seul, puis le rapprochement gardé seul, refusent chacun.
    await ajDb.encaissements.update('enc-pointe', { statut: 'Rapproché' })
    await expect(corriger(pointe.piece.id)).rejects.toThrow(/Encaissement enc-pointe pointé au rapprochement bancaire/)
    await ajDb.encaissements.update('enc-pointe', {
      statut: 'Enregistré',
      rapprochement: { arreteId: 'a-1', banqueId: 'b1', elementId: 'rel-1', cote: 'banque', mode: 'manuel', rapprocheLe: '2027-01-20' },
    })
    await expect(corriger(pointe.piece.id)).rejects.toThrow(/Encaissement enc-pointe pointé au rapprochement bancaire/)
    await ajDb.encaissements.update('enc-pointe', { statut: 'Enregistré', rapprochement: null })
    const pieceDuCheque = (await ajDb.encaissements.get('enc-pointe'))?.piece
    await ajDb.encaissements.update('enc-pointe', { piece: { mode: 'Chèque', numero: '0000001', banqueEmettrice: null, libelle: null, ...pieceDuCheque, remiseId: 'remise-1' } })
    await expect(corriger(pointe.piece.id)).rejects.toThrow(/Encaissement enc-pointe : chèque de la remise remise-1/)
    expect(await compter()).toEqual(avant)
  })
})

describe('À valider — réimputation qui ne déplace l’imputation qu’entre les lots d’un même appel : aucune ligne à écrire, refus', () => {
  /**
   * Le compte 1 porte aussi le lot 4 (50 millièmes, pris au lot 3) : deux postes par appel, de même exigibilité, servis au
   * prorata (270,00 € et 30,00 € sur le T4 2026).
   */
  async function appelerAvecDeuxLotsAuCompte1() {
    await ajDb.lots.update('L3', { tantiemes: { numerateur: 150, denominateur: 1000 } })
    await ajDb.lots.add(lot('L4', 'C1', '4', 50))
    const { id: _p, ...position } = creerPosition({ id: 'p1b', identiteId: 'i1', lotId: 'L4', compteId: 'c1', qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 }, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null })
    await repoPositions.create(position, { id: 'p1b' })
    await appeler()
  }
  const REFUS = /Compte « c1 » : .*qu'entre les lots d'un même appel, sans aucune ligne à écrire au compte 450.*Réimputation refusée, rien n'est écrit/

  it('paiement en retard qui désigne le poste d’un lot : des euros entiers changent de lot dans le même appel, même refus', async () => {
    await appelerAvecDeuxLotsAuCompte1()
    const { encaissements } = await ecrireEncaissements('C1', [virement('c1', 10_000, { id: 'enc-janvier' })], OPTIONS)
    expect(encaissements[0].imputation.lignes.map((l) => [l.posteId, l.montantCentimes])).toEqual([
      [`${T4_2026}:L1`, 9_000],
      [`${T4_2026}:L4`, 1_000],
    ])
    const avant = await compter()
    // Le chèque de 30,00 € solde le poste du lot 4, que le débiteur désigne : les 10,00 € du virement passent du lot 4 au lot 1.
    await expect(ecrireEncaissements('C1', [cheque(3_000, { postesDesignes: [`${T4_2026}:L4`] })], EN_RETARD)).rejects.toThrow(REFUS)
    expect(await compter()).toEqual(avant)
  })

  it('compte à deux lots, paiement en retard et encaissement postérieur sur le même appel (arrondi du prorata) : refusé, rien n’est écrit', async () => {
    await appelerAvecDeuxLotsAuCompte1()
    const { encaissements } = await ecrireEncaissements('C1', [virement('c1', 15, { id: 'enc-janvier' })], OPTIONS)
    expect(encaissements[0].imputation.lignes.map((l) => [l.posteId, l.montantCentimes])).toEqual([
      [`${T4_2026}:L1`, 14],
      [`${T4_2026}:L4`, 1],
    ])
    const avant = await compter()
    // Le chèque de 0,05 € déplace d'un centime le partage du virement entre les deux lots : même appel, même compte 450.
    await expect(ecrireEncaissements('C1', [cheque(5)], EN_RETARD)).rejects.toThrow(REFUS)
    expect(await compter()).toEqual(avant)
  })
})
