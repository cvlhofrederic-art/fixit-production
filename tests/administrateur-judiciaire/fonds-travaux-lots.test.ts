import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  creerVersementReprise,
  emploiDepuisOperation,
  fondsTravauxALaMutation,
  informationsFondsTravauxAcquereur,
  partsFondsTravauxParLot,
  versementsFondsTravauxDepuisImputations,
  type EmploiFondsTravaux,
  type VersementFondsTravaux,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux-lots'
import { creerCompteCoproprietaire, creerPosition, muterLot, type Position } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { imputerEncaissements, postesDepuisAvis, type Encaissement, type PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'
import { avisDAppel, creerCleRepartition, type EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import { creerOperationTravaux, type SaisieOperationTravaux } from '@/lib/administrateur-judiciaire/domain/travaux-operations'

/**
 * Part du fonds de travaux rattachée à chaque lot (point 20 du bilan 2 ; Gestéam, tranche 37 § Lots : « Fonds travaux non
 * remboursables € » sur la fiche lot ; tranche 43 § 23 : appels « Fonds travaux non remb. », compte 10500). Droit relu sur
 * Légifrance le 29/10/2026 : L. 1965 art. 14-2-1 (I, al. 6 et 7 ; III), 29-14 ; ancien art. 14-2, II ; loi n° 2021-1104,
 * art. 171, VI ; D. 1967 art. 6-2 ; CCH art. L. 721-2, II, 2°, d) et alinéa suivant, III ; décret n° 2019-502, art. 2, 3°.
 */

const cle = creerCleRepartition({
  id: 'cle-001',
  coproprieteId: 'copro-1',
  code: '001',
  libelle: 'Charges communes générales',
  lots: [
    { lotId: 'lot-1', tantiemes: 400 },
    { lotId: 'lot-2', tantiemes: 600 },
  ],
})
const cleAscenseur = creerCleRepartition({ id: 'cle-002', coproprieteId: 'copro-1', code: '002', libelle: 'Ascenseur', lots: [{ lotId: 'lot-2', tantiemes: 1 }] })
const cles = [cle, cleAscenseur]
const comptes = [
  creerCompteCoproprietaire({ id: 'cpt-A', coproprieteId: 'copro-1', serie: '1', libelle: 'A' }),
  creerCompteCoproprietaire({ id: 'cpt-B', coproprieteId: 'copro-1', serie: '2', libelle: 'B' }),
]
const position = (id: string, lotId: string, compteId: string, surcharge: Partial<Parameters<typeof creerPosition>[0]> = {}) =>
  creerPosition({ id, identiteId: `i-${id}`, lotId, compteId, qualite: 'Copropriétaire', part: { numerateur: 1, denominateur: 1 }, statut: 'En place', dateEntree: '2020-01-01', dateSortie: null, ...surcharge })
const positions = [position('p1', 'lot-1', 'cpt-A'), position('p2', 'lot-2', 'cpt-B')]
const echeances: EcheanceAppel[] = [
  { id: 'B-1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-01-01', libelle: 'Budget 2026 — provision 1/4', montantCentimes: 100_000, nature: 'budget' },
  { id: 'FT-1', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-01-01', libelle: 'Fonds de travaux 2026 — appel n° 1', montantCentimes: 5_000, nature: 'fonds_travaux' },
  { id: 'FT-2', coproprieteId: 'copro-1', cleId: 'cle-001', exigibilite: '2026-04-01', libelle: 'Fonds de travaux 2026 — appel n° 2', montantCentimes: 5_000, nature: 'fonds_travaux' },
]
const postes = postesDepuisAvis(avisDAppel({ echeances, cles: [cle], positions, comptes }), [cle])
const encaissements: Encaissement[] = [
  // cpt-A règle le budget et le premier appel du fonds (lot-1 : 40 000 + 2 000).
  { id: 'E1', compteId: 'cpt-A', date: '2026-01-10', montantCentimes: 42_000 },
  // cpt-B ne règle qu'une partie de ses dettes échues : imputation légale au prorata entre budget et fonds.
  { id: 'E2', compteId: 'cpt-B', date: '2026-01-15', montantCentimes: 30_000 },
]
const { resultats, postes: postesApresImputation } = imputerEncaissements(encaissements, postes)

/** Versement d'un encaissement sur l'appel `appelId` du lot (poste « appel:lot »). */
const versement = (
  id: string,
  lotId: string,
  compteId: string,
  date: string,
  montantCentimes: number,
  appel: { id: string; exigibilite: string; appeleCentimes: number },
): VersementFondsTravaux => ({
  id,
  lotId,
  compteId,
  date,
  montantCentimes,
  appelId: appel.id,
  cle: '001',
  source: 'encaissement',
  cotisation: { posteId: `${appel.id}:${lotId}`, exigibilite: appel.exigibilite, appeleCentimes: appel.appeleCentimes },
})
const FT1_LOT1 = { id: 'FT-1', exigibilite: '2026-01-01', appeleCentimes: 2_000 }
const FT1_LOT2 = { id: 'FT-1', exigibilite: '2026-01-01', appeleCentimes: 3_000 }

const emploi = (surcharge: Partial<EmploiFondsTravaux> = {}): EmploiFondsTravaux => ({
  id: 'EMP-1',
  date: '2026-02-01',
  montantCentimes: 1_000,
  cleId: 'cle-001',
  decaissement: { objet: 'travaux_ppt', montantCentimes: 1_000, decisionAg: 'Résolution 12 (AG du 15/01/2026)' },
  operationNumero: null,
  partOperationCentimes: null,
  dateDecision: null,
  ...surcharge,
})

/** Vendeur cpt-A en place sur lot-1 jusqu'à la mutation, acquéreur cpt-C ensuite. */
const cession = (date: string, lotId = 'lot-1', vendeur = 'cpt-A', acquereur = 'cpt-C', entreeVendeur = '2020-01-01') => [
  position(`pv-${lotId}`, lotId, vendeur, { dateEntree: entreeVendeur, dateSortie: date, statut: 'Sorti' }),
  position(`pa-${lotId}`, lotId, acquereur, { dateEntree: date }),
]

/** Exercices civils du syndicat, bornes incluses. */
const exercices = [2022, 2023, 2024, 2025, 2026].map((a) => ({ ouverture: `${a}-01-01`, cloture: `${a}-12-31` }))
const UN = { numerateur: 1, denominateur: 1 }
const DEMI = { numerateur: 1, denominateur: 2 }

describe('versements au fonds de travaux, depuis les imputations', () => {
  it('seule la part imputée sur les appels du fonds compte, au lot du poste, à la date de l’encaissement, avec sa cotisation', () => {
    const { versements, anomalies } = versementsFondsTravauxDepuisImputations(resultats, encaissements)
    expect(anomalies).toEqual([])
    const lot1 = versements.filter((v) => v.lotId === 'lot-1')
    expect(lot1).toEqual([
      {
        id: 'E1:FT-1:lot-1',
        lotId: 'lot-1',
        compteId: 'cpt-A',
        date: '2026-01-10',
        montantCentimes: 2_000,
        appelId: 'FT-1',
        cle: '001',
        source: 'encaissement',
        cotisation: { posteId: 'FT-1:lot-1', exigibilite: '2026-01-01', appeleCentimes: 2_000 },
      },
    ])
    const lot2 = versements.filter((v) => v.lotId === 'lot-2')
    const imputeSurFonds = resultats[1].lignes.filter((l) => l.posteId === 'FT-1:lot-2').reduce((s, l) => s + l.montantCentimes, 0)
    expect(lot2.map((v) => v.montantCentimes)).toEqual([imputeSurFonds])
    expect(imputeSurFonds).toBeGreaterThan(0)
    expect(imputeSurFonds).toBeLessThan(3_000)
  })

  it('un poste du fonds sans lot est signalé ; un encaissement introuvable est refusé', () => {
    const sansLot = resultats.map((r) => ({ ...r, postes: r.postes.map((p) => (p.id === 'FT-1:lot-1' ? { ...p, lotId: null } : p)) }))
    expect(versementsFondsTravauxDepuisImputations(sansLot, encaissements).anomalies).toMatchObject([{ code: 'versement_sans_lot', refId: 'E1:FT-1:lot-1' }])
    expect(() => versementsFondsTravauxDepuisImputations(resultats, [encaissements[0]])).toThrow(/E2/)
  })

  it('K — encaissement annulé : on réimpute sans lui ; l’ancienne option « annules » n’existe plus', () => {
    // Revue 20, P1 : E1 (42 000) solde B-1 et FT-1 ; E3 (2 000, avril) paie FT-2. E1 est rejeté.
    const E3: Encaissement = { id: 'E3', compteId: 'cpt-A', date: '2026-04-10', montantCentimes: 2_000 }
    const avecE1 = imputerEncaissements([encaissements[0], E3], postes)
    const sansE1 = imputerEncaissements([E3], postes)
    // Sans E1, E3 va aux dettes les plus anciennes, B-1 et FT-1 au prorata : 95 seulement au fonds.
    expect(versementsFondsTravauxDepuisImputations(sansE1.resultats, [E3]).versements).toMatchObject([{ id: 'E3:FT-1:lot-1', montantCentimes: 95 }])
    // L'option supprimée n'a plus d'effet : écarter E1 seul aurait laissé E3 sur FT-2 pour 2 000.
    // @ts-expect-error — option « annules » supprimée : réimputer sans l'encaissement annulé
    const ignore = versementsFondsTravauxDepuisImputations(avecE1.resultats, [encaissements[0], E3], { annules: ['E1'] })
    expect(ignore.versements.map((v) => [v.id, v.montantCentimes])).toEqual([
      ['E1:FT-1:lot-1', 2_000],
      ['E3:FT-2:lot-1', 2_000],
    ])
  })

  it('H — un encaissement présent deux fois est refusé ; deux lignes d’un même poste font un seul versement', () => {
    expect(() => versementsFondsTravauxDepuisImputations([resultats[0], resultats[0]], encaissements)).toThrow(/E1.*deux fois/)
    const deuxLignes = { ...resultats[0], lignes: [...resultats[0].lignes.filter((l) => l.posteId !== 'FT-1:lot-1'), { posteId: 'FT-1:lot-1', montantCentimes: 1_500 }, { posteId: 'FT-1:lot-1', montantCentimes: 500 }] }
    expect(versementsFondsTravauxDepuisImputations([deuxLignes], encaissements).versements).toMatchObject([{ id: 'E1:FT-1:lot-1', montantCentimes: 2_000 }])
  })

  it('reprise de la part d’un lot à la prise de fonction : sans cotisation', () => {
    expect(creerVersementReprise({ id: 'R-1', lotId: 'lot-1', compteId: 'cpt-A', date: '2025-12-31', montantCentimes: 50_000 })).toMatchObject({ source: 'reprise', appelId: null, cotisation: null })
    expect(() => creerVersementReprise({ id: 'R-1', lotId: 'lot-1', compteId: 'cpt-A', date: '31/12/2025', montantCentimes: 50_000 })).toThrow(/AAAA-MM-JJ/)
    expect(() => creerVersementReprise({ id: 'R-1', lotId: 'lot-1', compteId: 'cpt-A', date: '2025-12-31', montantCentimes: 0 })).toThrow(/centimes/)
    expect(() => creerVersementReprise({ id: 'R-1', lotId: ' ', compteId: 'cpt-A', date: '2025-12-31', montantCentimes: 1 })).toThrow(/lot/)
  })
})

describe('part par lot à une date', () => {
  const versements: VersementFondsTravaux[] = [versement('V1', 'lot-1', 'cpt-A', '2026-01-10', 2_000, FT1_LOT1), versement('V2', 'lot-2', 'cpt-B', '2026-01-15', 1_429, FT1_LOT2)]

  it('cumul de l’encaissé, bornes incluses ; un lot sans versement n’a pas de part', () => {
    expect(partsFondsTravauxParLot({ versements, emplois: [], cles, date: '2026-01-12' }).parts).toEqual([
      {
        lotId: 'lot-1',
        verseCentimes: 2_000,
        repriseCentimes: 0,
        employeCentimes: 0,
        partCentimes: 2_000,
        verseParCompte: [{ compteId: 'cpt-A', verseCentimes: 2_000 }],
        derniereCotisation: { posteId: 'FT-1:lot-1', appelId: 'FT-1', exigibilite: '2026-01-01', montantCentimes: 2_000, date: '2026-01-10', compteId: 'cpt-A' },
      },
    ])
    expect(partsFondsTravauxParLot({ versements, emplois: [], cles, date: '2026-01-15' }).totalVerseCentimes).toBe(3_429)
    expect(() => partsFondsTravauxParLot({ versements, emplois: [], cles, date: '15/01/2026' })).toThrow(/AAAA-MM-JJ/)
  })

  it('emploi admis : déduit au prorata des parts des lots de sa clé, au centime, sans rien perdre', () => {
    const etat = partsFondsTravauxParLot({ versements, emplois: [emploi()], cles, date: '2026-02-01' })
    expect(etat.parts.map((p) => [p.lotId, p.verseCentimes, p.employeCentimes, p.partCentimes])).toEqual([
      ['lot-1', 2_000, 583, 1_417],
      ['lot-2', 1_429, 417, 1_012],
    ])
    expect(etat.parts.reduce((s, p) => s + p.partCentimes, 0)).toBe(etat.totalVerseCentimes - etat.totalDeduitDesPartsCentimes)
    expect(etat).toMatchObject({ totalDeduitDesPartsCentimes: 1_000, totalPreleveCentimes: 1_000, soldeFondsCentimes: 2_429, anomalies: [], aConfirmer: true })
    // Un emploi postérieur à la date n'est pas déduit.
    expect(partsFondsTravauxParLot({ versements, emplois: [emploi()], cles, date: '2026-01-31' }).totalDeduitDesPartsCentimes).toBe(0)
  })

  it('mode « tantièmes » : l’emploi suit la clé, une part peut devenir négative et le contrôle le signale', () => {
    const etat = partsFondsTravauxParLot({ versements, emplois: [emploi({ montantCentimes: 3_000, decaissement: { objet: 'travaux_ppt', montantCentimes: 3_000, decisionAg: 'Résolution 12' } })], cles, date: '2026-02-01', mode: 'tantiemes' })
    expect(etat.parts.map((p) => [p.lotId, p.partCentimes])).toEqual([
      ['lot-1', 800],
      ['lot-2', -371],
    ])
    expect(etat.anomalies).toMatchObject([{ code: 'part_negative', refId: 'lot-2' }])
  })

  it('emploi sur une clé spéciale au-delà des parts de ses lots : seul le disponible est déduit, le reste est signalé', () => {
    const special = emploi({ id: 'EMP-2', cleId: 'cle-002', montantCentimes: 2_000, decaissement: { objet: 'travaux_hors_ppt', montantCentimes: 2_000, decisionAg: 'Résolution 4' } })
    const etat = partsFondsTravauxParLot({ versements, emplois: [special], cles, date: '2026-02-01' })
    expect(etat.parts.find((p) => p.lotId === 'lot-2')).toMatchObject({ employeCentimes: 1_429, partCentimes: 0 })
    expect(etat.parts.find((p) => p.lotId === 'lot-1')).toMatchObject({ partCentimes: 2_000 })
    expect(etat.anomalies).toMatchObject([{ code: 'emploi_excede_parts_cle', refId: 'EMP-2', nonCouvertCentimes: 571 }])
  })

  it('emploi non autorisé ou sur une clé inconnue : signalé, jamais déduit', () => {
    const exclu = emploi({ id: 'EMP-3', decaissement: { objet: 'charges_courantes', montantCentimes: 1_000, decisionAg: 'Résolution 2' } })
    const sansDecision = emploi({ id: 'EMP-4', decaissement: { objet: 'travaux_ppt', montantCentimes: 1_000, decisionAg: null } })
    const cleInconnue = emploi({ id: 'EMP-5', cleId: 'cle-999' })
    const etat = partsFondsTravauxParLot({ versements, emplois: [exclu, sansDecision, cleInconnue], cles, date: '2026-02-01' })
    expect(etat.totalDeduitDesPartsCentimes).toBe(0)
    expect(etat.anomalies.map((a) => [a.code, a.refId])).toEqual([
      ['emploi_non_autorise', 'EMP-3'],
      ['emploi_non_autorise', 'EMP-4'],
      ['cle_emploi_inconnue', 'EMP-5'],
    ])
  })

  it('refuse un emploi dont le montant diffère de son décaissement', () => {
    expect(() => partsFondsTravauxParLot({ versements, emplois: [emploi({ montantCentimes: 900 })], cles, date: '2026-02-01' })).toThrow(/EMP-1/)
  })

  it('D — solde du fonds = versé − prélevé, quel que soit le mode, part non couverte et emploi refusé compris', () => {
    // Revue 20, C2 / C8 / P3 : 2 000 + 1 429 versés, emploi admis de 2 000 sur la clé 002 (lot-2 seul).
    const special = emploi({ id: 'EMP-2', cleId: 'cle-002', montantCentimes: 2_000, decaissement: { objet: 'travaux_hors_ppt', montantCentimes: 2_000, decisionAg: 'Résolution 4' } })
    const prorata = partsFondsTravauxParLot({ versements, emplois: [special], cles, date: '2026-02-01' })
    const tantiemes = partsFondsTravauxParLot({ versements, emplois: [special], cles, date: '2026-02-01', mode: 'tantiemes' })
    expect(prorata).toMatchObject({ totalVerseCentimes: 3_429, totalDeduitDesPartsCentimes: 1_429, totalPreleveCentimes: 2_000, soldeFondsCentimes: 1_429 })
    expect(tantiemes).toMatchObject({ totalVerseCentimes: 3_429, totalDeduitDesPartsCentimes: 2_000, totalPreleveCentimes: 2_000, soldeFondsCentimes: 1_429 })
    // L'invariant des parts reste : somme des parts = versé − déduit.
    expect(prorata.parts.reduce((s, p) => s + p.partCentimes, 0)).toBe(3_429 - 1_429)
    // Un emploi refusé est sorti du fonds, sans être déduit des parts.
    const refuse = partsFondsTravauxParLot({ versements, emplois: [emploi({ decaissement: { objet: 'charges_courantes', montantCentimes: 1_000, decisionAg: 'Résolution 2' } })], cles, date: '2026-02-01' })
    expect(refuse).toMatchObject({ totalDeduitDesPartsCentimes: 0, totalPreleveCentimes: 1_000, soldeFondsCentimes: 2_429 })
  })

  it('F — emplois du même jour : résultat indépendant de l’ordre reçu (tri par date, puis identifiant)', () => {
    // Revue 20, C7 : A (1 000, clé 002) et B (2 000, clé 001), le même jour.
    const A = emploi({ id: 'EMP-A', cleId: 'cle-002', montantCentimes: 1_000, decaissement: { objet: 'travaux_hors_ppt', montantCentimes: 1_000, decisionAg: 'Résolution 4' } })
    const B = emploi({ id: 'EMP-B', montantCentimes: 2_000, decaissement: { objet: 'travaux_ppt', montantCentimes: 2_000, decisionAg: 'Résolution 12' } })
    const ab = partsFondsTravauxParLot({ versements, emplois: [A, B], cles, date: '2026-02-01' })
    const ba = partsFondsTravauxParLot({ versements, emplois: [B, A], cles, date: '2026-02-01' })
    expect(ba).toEqual(ab)
    expect(ab.parts.map((p) => [p.lotId, p.partCentimes])).toEqual([
      ['lot-1', 353],
      ['lot-2', 76],
    ])
    expect(ab.anomalies).toEqual([])
  })

  it('G — emploi daté avant la décision qui affecte le fonds : signalé, non déduit, mais sorti du fonds', () => {
    // Revue 20, C15 : décision du 15/06/2026, prélèvement du 01/02/2026.
    const etat = partsFondsTravauxParLot({ versements, emplois: [emploi({ id: 'EMP-7', dateDecision: '2026-06-15' })], cles, date: '2026-03-01' })
    expect(etat.anomalies).toMatchObject([{ code: 'emploi_avant_decision', refId: 'EMP-7' }])
    expect(etat).toMatchObject({ totalDeduitDesPartsCentimes: 0, totalPreleveCentimes: 1_000 })
    expect(etat.parts.find((p) => p.lotId === 'lot-1')).toMatchObject({ partCentimes: 2_000 })
    // Le jour même de la décision : déduit.
    expect(partsFondsTravauxParLot({ versements, emplois: [emploi({ dateDecision: '2026-02-01' })], cles, date: '2026-03-01' }).totalDeduitDesPartsCentimes).toBe(1_000)
    expect(() => partsFondsTravauxParLot({ versements, emplois: [emploi({ dateDecision: '15/06/2026' })], cles, date: '2026-03-01' })).toThrow(/AAAA-MM-JJ/)
  })

  it('H — versement ou emploi en double : refusés, jamais comptés deux fois', () => {
    // Revue 20, C10 : [V1, V1] donnait 4 000.
    expect(() => partsFondsTravauxParLot({ versements: [versements[0], versements[0]], emplois: [], cles, date: '2026-02-01' })).toThrow(/V1.*deux fois/)
    expect(() => partsFondsTravauxParLot({ versements, emplois: [emploi(), emploi()], cles, date: '2026-02-01' })).toThrow(/EMP-1.*deux fois/)
  })

  it('5 — plusieurs emplois d’une même opération (prélèvements échelonnés) : admis ; seul un identifiant en double est refusé', () => {
    const tranche = (id: string, date: string, montantCentimes: number) =>
      emploi({ id, date, montantCentimes, decaissement: { objet: 'travaux_ppt', montantCentimes, decisionAg: 'Résolution 12' }, operationNumero: '00042', partOperationCentimes: 1_000 })
    const etat = partsFondsTravauxParLot({ versements, emplois: [tranche('EMP-8', '2026-02-01', 400), tranche('EMP-9', '2026-02-15', 600)], cles, date: '2026-03-01' })
    expect(etat).toMatchObject({ totalDeduitDesPartsCentimes: 1_000, totalPreleveCentimes: 1_000, anomalies: [] })
    expect(() => partsFondsTravauxParLot({ versements, emplois: [tranche('EMP-8', '2026-02-01', 400), tranche('EMP-8', '2026-02-15', 600)], cles, date: '2026-03-01' })).toThrow(
      /EMP-8.*deux fois/,
    )
  })

  it('C — une reprise entre dans la part du lot, jamais dans le versé d’un compte', () => {
    const reprise = creerVersementReprise({ id: 'R-1', lotId: 'lot-1', compteId: 'cpt-A', date: '2025-12-31', montantCentimes: 50_000 })
    const etat = partsFondsTravauxParLot({ versements: [reprise, ...versements], emplois: [], cles, date: '2026-01-31' })
    expect(etat.parts.find((p) => p.lotId === 'lot-1')).toMatchObject({ verseCentimes: 52_000, repriseCentimes: 50_000, partCentimes: 52_000, verseParCompte: [{ compteId: 'cpt-A', verseCentimes: 2_000 }] })
  })
})

describe('dernière cotisation versée', () => {
  it('B — paiement partiel puis solde : la cotisation appelée (3 000), datée du jour du solde', () => {
    // Revue 20, C12 : E2 (30 000) impute 1 429 sur FT-1:lot-2, puis E4 (33 000) solde les 1 571 restants.
    const E4: Encaissement = { id: 'E4', compteId: 'cpt-B', date: '2026-02-01', montantCentimes: 33_000 }
    const tous = [...encaissements, E4]
    const { versements } = versementsFondsTravauxDepuisImputations(imputerEncaissements(tous, postes).resultats, tous)
    expect(versements.filter((v) => v.lotId === 'lot-2').map((v) => v.montantCentimes)).toEqual([1_429, 1_571])
    const lot2 = (date: string) => partsFondsTravauxParLot({ versements, emplois: [], cles, date }).parts.find((p) => p.lotId === 'lot-2')
    expect(lot2('2026-02-01')?.derniereCotisation).toEqual({ posteId: 'FT-1:lot-2', appelId: 'FT-1', exigibilite: '2026-01-01', montantCentimes: 3_000, date: '2026-02-01', compteId: 'cpt-B' })
    // Avant le solde, la cotisation n'est pas entièrement versée : aucune.
    expect(lot2('2026-01-20')?.derniereCotisation).toBeNull()
  })

  it('B — le dernier appel soldé, par exigibilité ; un appel plus récent non soldé ne compte pas', () => {
    const FT2 = { id: 'FT-2', exigibilite: '2026-04-01', appeleCentimes: 2_000 }
    const versements = [versement('V1', 'lot-1', 'cpt-A', '2026-01-10', 2_000, FT1_LOT1), versement('V5', 'lot-1', 'cpt-A', '2026-04-05', 1_000, FT2)]
    expect(partsFondsTravauxParLot({ versements, emplois: [], cles, date: '2026-04-30' }).parts[0].derniereCotisation).toMatchObject({ posteId: 'FT-1:lot-1', montantCentimes: 2_000, date: '2026-01-10' })
    // Un appel ancien soldé tardivement ne passe pas devant l'appel plus récent déjà soldé.
    const tardif = [versement('V6', 'lot-1', 'cpt-A', '2026-04-05', 2_000, FT2), versement('V7', 'lot-1', 'cpt-A', '2026-05-10', 2_000, FT1_LOT1)]
    expect(partsFondsTravauxParLot({ versements: tardif, emplois: [], cles, date: '2026-05-31' }).parts[0].derniereCotisation).toMatchObject({ posteId: 'FT-2:lot-1', date: '2026-04-05' })
  })

  it('B — une reprise seule n’est pas une cotisation : null', () => {
    // Revue 20, C6 / C13.
    const reprise = creerVersementReprise({ id: 'R-1', lotId: 'lot-1', compteId: 'cpt-A', date: '2025-12-31', montantCentimes: 50_000 })
    expect(partsFondsTravauxParLot({ versements: [reprise], emplois: [], cles, date: '2026-01-05' }).parts[0].derniereCotisation).toBeNull()
  })
})

describe('emploi depuis une opération de travaux', () => {
  const saisie = (surcharge: Partial<SaisieOperationTravaux> = {}): SaisieOperationTravaux => ({
    numero: '00042',
    coproprieteId: 'copro-1',
    libelle: 'Ravalement',
    cleId: 'cle-001',
    decision: { date: '2026-01-15', resolution: 'Résolution 12' },
    budgetTtcCentimes: 100_000,
    financementFondsTravauxCentimes: 20_000,
    affectationFonds: { objet: 'travaux_ppt' },
    tranches: [{ date: '2026-03-01', tauxPct: 100 }],
    ...surcharge,
  })

  it('reprend la part du fonds, la clé, l’affectation, le n° d’opération et la date de la résolution', () => {
    expect(emploiDepuisOperation(creerOperationTravaux(saisie()), { id: 'EMP-9', date: '2026-03-01' })).toEqual({
      id: 'EMP-9',
      date: '2026-03-01',
      montantCentimes: 20_000,
      cleId: 'cle-001',
      decaissement: { objet: 'travaux_ppt', montantCentimes: 20_000, decisionAg: 'Résolution 12 (AG du 15/01/2026)', autorisationJuge: null },
      operationNumero: '00042',
      partOperationCentimes: 20_000,
      dateDecision: '2026-01-15',
    })
  })

  it('refuse une opération sans part du fonds ou dont l’affectation n’est pas admise', () => {
    expect(() => emploiDepuisOperation(creerOperationTravaux(saisie({ financementFondsTravauxCentimes: 0, affectationFonds: null })), { id: 'E', date: '2026-03-01' })).toThrow(/fonds/)
    expect(() => emploiDepuisOperation({ ...creerOperationTravaux(saisie()), affectationFonds: { objet: 'charges_courantes' } }, { id: 'E', date: '2026-03-01' })).toThrow(/exclue/)
    expect(() => emploiDepuisOperation(creerOperationTravaux(saisie()), { id: 'E', date: '01/03/2026' })).toThrow(/AAAA-MM-JJ/)
  })

  it('G — refuse un emploi daté avant la résolution qui tient lieu d’affectation ; décision distincte : non contrôlée', () => {
    // Revue 20, C9 : résolution du 15/06/2026, emploi du 01/02/2026.
    const tardive = creerOperationTravaux(saisie({ decision: { date: '2026-06-15', resolution: 'Résolution 12' } }))
    expect(() => emploiDepuisOperation(tardive, { id: 'EMP-9', date: '2026-02-01' })).toThrow(/antérieur à la résolution du 15\/06\/2026/)
    expect(emploiDepuisOperation(tardive, { id: 'EMP-9', date: '2026-06-15' }).dateDecision).toBe('2026-06-15')
    const distincte = creerOperationTravaux(saisie({ decision: { date: '2026-06-15', resolution: 'Résolution 12' }, affectationFonds: { objet: 'travaux_ppt', decisionAg: 'Résolution 3 (AG du 10/01/2026)' } }))
    expect(emploiDepuisOperation(distincte, { id: 'EMP-9', date: '2026-02-01' }).dateDecision).toBeNull()
  })

  it('5 — prélèvement échelonné : un emploi pour une partie de la part du fonds de l’opération, jamais au-delà', () => {
    const operation = creerOperationTravaux(saisie())
    expect(emploiDepuisOperation(operation, { id: 'EMP-10', date: '2026-03-01', montantCentimes: 8_000 })).toMatchObject({
      montantCentimes: 8_000,
      decaissement: { montantCentimes: 8_000 },
      operationNumero: '00042',
    })
    expect(() => emploiDepuisOperation(operation, { id: 'EMP-11', date: '2026-03-01', montantCentimes: 20_001 })).toThrow(/part du fonds/)
    expect(() => emploiDepuisOperation(operation, { id: 'EMP-11', date: '2026-03-01', montantCentimes: 0 })).toThrow(/centimes/)
  })

  it('P5a — une tranche égale à toute la part du fonds de l’opération est admise', () => {
    // Contrôle 20d, mutant P5a (« >= » au lieu de « > ») : 20 000 pour une part de 20 000.
    expect(emploiDepuisOperation(creerOperationTravaux(saisie()), { id: 'EMP-12', date: '2026-03-01', montantCentimes: 20_000 })).toMatchObject({
      montantCentimes: 20_000,
      partOperationCentimes: 20_000,
    })
  })

  describe('S5 — somme des emplois d’une opération rapprochée de la part du fonds de celle-ci', () => {
    // Contrôle 20d, sonde S5 : 30 000 versés sur chaque lot de la clé 001 ; part du fonds de l'opération : 20 000.
    const versementsCle = [
      versement('V1', 'lot-1', 'cpt-A', '2026-01-10', 30_000, { id: 'FT-1', exigibilite: '2026-01-01', appeleCentimes: 30_000 }),
      versement('V2', 'lot-2', 'cpt-B', '2026-01-10', 30_000, { id: 'FT-1', exigibilite: '2026-01-01', appeleCentimes: 30_000 }),
    ]
    const operation = creerOperationTravaux(saisie())
    const etat = (emplois: EmploiFondsTravaux[]) => partsFondsTravauxParLot({ versements: versementsCle, emplois, cles, date: '2026-03-31' })

    it('deux emplois de la part entière : le second est un excédent signalé, sorti du fonds, non déduit des parts', () => {
      const premier = emploiDepuisOperation(operation, { id: 'EMP-1', date: '2026-03-01' })
      const second = emploiDepuisOperation(operation, { id: 'EMP-2', date: '2026-03-02' })
      const double = etat([second, premier])
      expect(double).toMatchObject({ totalDeduitDesPartsCentimes: 20_000, totalPreleveCentimes: 40_000, soldeFondsCentimes: 20_000 })
      expect(double.anomalies).toMatchObject([{ code: 'emplois_operation_excedent', refId: 'EMP-2', excedentCentimes: 20_000 }])
      expect(double.parts.reduce((s, p) => s + p.partCentimes, 0)).toBe(40_000)
      // Une seule fois la part : rien à signaler.
      expect(etat([premier])).toMatchObject({ totalDeduitDesPartsCentimes: 20_000, totalPreleveCentimes: 20_000, anomalies: [] })
    })

    it('trois emplois de la part entière : chaque emploi au-delà de la part n’est écarté que de son propre montant', () => {
      const emplois = ['EMP-1', 'EMP-2', 'EMP-3'].map((id, rang) =>
        emploiDepuisOperation(operation, { id, date: `2026-03-0${rang + 1}` }),
      )
      for (const mode of ['prorata', 'tantiemes'] as const) {
        const triple = partsFondsTravauxParLot({ versements: versementsCle, emplois, cles, date: '2026-03-31', mode })
        expect(triple).toMatchObject({ totalDeduitDesPartsCentimes: 20_000, totalPreleveCentimes: 60_000, soldeFondsCentimes: 0 })
        expect(triple.anomalies.map((a) => [a.code, a.refId, a.excedentCentimes])).toEqual([
          ['emplois_operation_excedent', 'EMP-2', 20_000],
          ['emplois_operation_excedent', 'EMP-3', 20_000],
        ])
      }
    })

    it('tranches dont la somme dépasse la part : seul l’excédent de la dernière est écarté', () => {
      const tranches = [
        emploiDepuisOperation(operation, { id: 'EMP-3', date: '2026-03-01', montantCentimes: 12_000 }),
        emploiDepuisOperation(operation, { id: 'EMP-4', date: '2026-03-02', montantCentimes: 12_000 }),
      ]
      const depassement = etat(tranches)
      expect(depassement).toMatchObject({ totalDeduitDesPartsCentimes: 20_000, totalPreleveCentimes: 24_000, soldeFondsCentimes: 36_000 })
      expect(depassement.anomalies).toMatchObject([{ code: 'emplois_operation_excedent', refId: 'EMP-4', excedentCentimes: 4_000 }])
      // Un emploi refusé pour un autre motif est sorti du fonds : il compte dans la somme des emplois de l'opération.
      const refuse = { ...tranches[0], cleId: 'cle-999' }
      expect(etat([refuse, tranches[1]]).anomalies.map((a) => [a.code, a.refId, a.excedentCentimes])).toEqual([
        ['cle_emploi_inconnue', 'EMP-3', undefined],
        ['emplois_operation_excedent', 'EMP-4', 4_000],
      ])
    })

    it('part de l’opération absente, ou différente d’un emploi à l’autre : refusé', () => {
      const premier = emploiDepuisOperation(operation, { id: 'EMP-1', date: '2026-03-01', montantCentimes: 5_000 })
      expect(() => etat([{ ...premier, partOperationCentimes: null }])).toThrow(/vont ensemble/)
      expect(() => etat([{ ...premier, operationNumero: null }])).toThrow(/vont ensemble/)
      expect(() => etat([premier, { ...premier, id: 'EMP-2', partOperationCentimes: 10_000 }])).toThrow(/00042.*différente/)
      expect(() => etat([{ ...premier, partOperationCentimes: 0 }])).toThrow(/centimes/)
    })
  })
})

describe('mutation d’un lot', () => {
  const versements: VersementFondsTravaux[] = [
    versement('V1', 'lot-1', 'cpt-A', '2026-01-10', 2_000, FT1_LOT1),
    versement('V3', 'lot-1', 'cpt-C', '2026-07-10', 2_000, { id: 'FT-3', exigibilite: '2026-07-01', appeleCentimes: 2_000 }),
  ]
  const avant = cession('2026-05-01')

  it('la part reste au lot, sans remboursement au vendeur ; versé par le vendeur, appels impayés', () => {
    const mutation = fondsTravauxALaMutation({ positions: avant, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements, emplois: [], cles, postes: postesApresImputation })
    expect(mutation).toMatchObject({
      lotId: 'lot-1',
      compteVendeurId: 'cpt-A',
      partRattacheeCentimes: 2_000,
      verseParLeVendeurCentimes: 2_000,
      partRepriseCentimes: 0,
      cotisationsImpayeesVendeur: [{ posteId: 'FT-2:lot-1', exigibilite: '2026-04-01', resteCentimes: 2_000, regleDepuisCentimes: 0 }],
      postesAReattribuer: [],
      anomalies: [],
      aConfirmer: true,
    })
    expect(mutation.mention).toMatch(/aucun remboursement/i)
    expect(mutation.fondements).toContain('L. 1965 art. 14-2-1, III')
    // Après la mutation, les versements de l'acquéreur s'ajoutent à la même part.
    expect(partsFondsTravauxParLot({ versements, emplois: [], cles, date: '2026-07-31' }).parts).toMatchObject([
      { lotId: 'lot-1', verseCentimes: 4_000, verseParCompte: [{ compteId: 'cpt-A', verseCentimes: 2_000 }, { compteId: 'cpt-C', verseCentimes: 2_000 }] },
    ])
  })

  it('refuse une mutation sans vendeur unique la veille, ou un nombre de lots invalide', () => {
    expect(() => fondsTravauxALaMutation({ positions: [], lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements, emplois: [], cles, postes: postesApresImputation })).toThrow(/vendeur/i)
    const deuxComptes = [...avant, position('p8', 'lot-1', 'cpt-B', { dateSortie: '2026-05-01', statut: 'Sorti' })]
    expect(() => fondsTravauxALaMutation({ positions: deuxComptes, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements, emplois: [], cles, postes: postesApresImputation })).toThrow(/vendeur/i)
    expect(() => fondsTravauxALaMutation({ positions: avant, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: -1, versements, emplois: [], cles, postes: [] })).toThrow(/lots/)
  })

  it('C — une reprise n’est ni « versé par le vendeur » ni une dernière cotisation : part reprise à part', () => {
    // Revue 20, C13 : reprise de 50 000, aucun encaissement, mutation au 01/05/2026.
    const reprise = creerVersementReprise({ id: 'R-1', lotId: 'lot-1', compteId: 'cpt-A', date: '2025-12-31', montantCentimes: 50_000 })
    const mutation = fondsTravauxALaMutation({ positions: avant, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements: [reprise], emplois: [], cles, postes })
    expect(mutation).toMatchObject({ partRattacheeCentimes: 50_000, verseParLeVendeurCentimes: 0, partRepriseCentimes: 50_000 })
    expect(mutation.cotisationsImpayeesVendeur.map((c) => [c.posteId, c.resteCentimes])).toEqual([
      ['FT-1:lot-1', 2_000],
      ['FT-2:lot-1', 2_000],
    ])
    const info = informationsFondsTravauxAcquereur({ positions: avant, lotId: 'lot-1', datePromesse: '2026-04-01', dateArrete: '2025-12-31', nbLotsPrincipaux: 40, versements: [reprise], emplois: [], cles, exercices })
    expect(info).toMatchObject({ partRattacheeCentimes: 50_000, derniereCotisationVendeur: null, cotisationAnnuelleVendeur: null })
  })

  it('1 — versé par le vendeur : depuis sa présence continue sur le lot, à travers les réorganisations sous le même compte', () => {
    const versementsA = [
      versement('V22', 'lot-1', 'cpt-A', '2022-01-10', 2_000, { id: 'FT-22', exigibilite: '2022-01-01', appeleCentimes: 2_000 }),
      versement('V1', 'lot-1', 'cpt-A', '2026-01-10', 2_000, FT1_LOT1),
    ]
    const indivisaire = (id: string, identiteId: string) => ({ id, identiteId, compteId: 'cpt-A', qualite: 'Indivisaire' as const, part: DEMI })
    const vente = (positions: Position[], sortantes: string[]) =>
      muterLot(positions, { lotId: 'lot-1', date: '2026-05-01', sortantes, entrantes: [{ id: 'pC', identiteId: 'i-C', compteId: 'cpt-C', qualite: 'Copropriétaire', part: UN }] }).positions
    const verseParLeVendeur = (positions: Position[]) =>
      fondsTravauxALaMutation({ positions, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements: versementsA, emplois: [], cles, postes: [] })
    // A cède la moitié du lot à B le 01/01/2024 (muterLot) ; l'indivision reste sous le compte cpt-A.
    const cession1sur2 = muterLot([position('pA', 'lot-1', 'cpt-A')], { lotId: 'lot-1', date: '2024-01-01', sortantes: ['pA'], entrantes: [indivisaire('pA2', 'i-A'), indivisaire('pB2', 'i-B')] }).positions
    expect(verseParLeVendeur(vente(cession1sur2, ['pA2', 'pB2']))).toMatchObject({ compteVendeurId: 'cpt-A', verseParLeVendeurCentimes: 4_000 })
    // B sort de l'indivision le 01/01/2024 : A rouvre une position 1/1 sous le même compte.
    const indivision = [position('pA', 'lot-1', 'cpt-A', { qualite: 'Indivisaire', part: DEMI }), position('pB', 'lot-1', 'cpt-A', { qualite: 'Indivisaire', part: DEMI })]
    const sortie = muterLot(indivision, { lotId: 'lot-1', date: '2024-01-01', sortantes: ['pA', 'pB'], entrantes: [{ id: 'pA3', identiteId: 'i-pA', compteId: 'cpt-A', qualite: 'Copropriétaire', part: UN }] }).positions
    expect(verseParLeVendeur(vente(sortie, ['pA3'])).verseParLeVendeurCentimes).toBe(4_000)
  })

  it('1 — compte sorti puis revenu sur le lot : son séjour antérieur ne compte ni dans le versé ni dans la dernière cotisation', () => {
    const allerRetour = [
      position('pA1', 'lot-1', 'cpt-A', { dateEntree: '2018-01-01', dateSortie: '2021-01-01', statut: 'Sorti' }),
      position('pB1', 'lot-1', 'cpt-B', { dateEntree: '2021-01-01', dateSortie: '2025-06-01', statut: 'Sorti' }),
      position('pA2', 'lot-1', 'cpt-A', { dateEntree: '2025-06-01', dateSortie: '2026-05-01', statut: 'Sorti' }),
      position('pC', 'lot-1', 'cpt-C', { dateEntree: '2026-05-01' }),
    ]
    const v = [
      versement('V20', 'lot-1', 'cpt-A', '2020-01-10', 2_000, { id: 'FT-20', exigibilite: '2020-01-01', appeleCentimes: 2_000 }),
      versement('V26', 'lot-1', 'cpt-A', '2026-01-10', 2_000, FT1_LOT1),
    ]
    const mutation = fondsTravauxALaMutation({ positions: allerRetour, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements: v, emplois: [], cles, postes: [] })
    expect(mutation).toMatchObject({ compteVendeurId: 'cpt-A', partRattacheeCentimes: 4_000, verseParLeVendeurCentimes: 2_000 })
    // Arrêté au 31/12/2025 : depuis son retour (01/06/2025), cpt-A n'a soldé aucun appel ; FT-20 (2020) n'est pas « sa » dernière cotisation.
    const info = informationsFondsTravauxAcquereur({ positions: allerRetour, lotId: 'lot-1', datePromesse: '2026-04-01', dateArrete: '2025-12-31', nbLotsPrincipaux: 40, versements: v, emplois: [], cles, exercices })
    expect(info).toMatchObject({ compteVendeurId: 'cpt-A', derniereCotisationVendeur: null, cotisationAnnuelleVendeur: null })
    // Retour un jour après la sortie (01/01/2021 → 02/01/2021) : la présence est interrompue, même sous le même compte.
    const interrompue = [
      position('pA1', 'lot-1', 'cpt-A', { dateEntree: '2018-01-01', dateSortie: '2021-01-01', statut: 'Sorti' }),
      position('pA2', 'lot-1', 'cpt-A', { dateEntree: '2021-01-02', dateSortie: '2026-05-01', statut: 'Sorti' }),
      position('pC', 'lot-1', 'cpt-C', { dateEntree: '2026-05-01' }),
    ]
    expect(fondsTravauxALaMutation({ positions: interrompue, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements: v, emplois: [], cles, postes: [] }).verseParLeVendeurCentimes).toBe(2_000)
    const infoInterrompue = informationsFondsTravauxAcquereur({ positions: interrompue, lotId: 'lot-1', datePromesse: '2026-04-01', dateArrete: '2020-12-31', nbLotsPrincipaux: 40, versements: v, emplois: [], cles, exercices })
    expect(infoInterrompue.derniereCotisationVendeur).toBeNull()
  })

  it('C — versé par le vendeur : ses seuls encaissements, depuis son entrée sur le lot', () => {
    const versements2 = [
      versement('V0', 'lot-1', 'cpt-A', '2019-06-10', 2_000, { id: 'FT-0', exigibilite: '2019-06-01', appeleCentimes: 2_000 }),
      versement('V1', 'lot-1', 'cpt-A', '2026-01-10', 2_000, FT1_LOT1),
    ]
    const mutation = fondsTravauxALaMutation({ positions: avant, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements: versements2, emplois: [], cles, postes: [] })
    // cpt-A est entré le 01/01/2020 : le versement de 2019 (séjour antérieur sur ce compte) n'est pas « pendant qu'il était en place ».
    expect(mutation).toMatchObject({ partRattacheeCentimes: 4_000, verseParLeVendeurCentimes: 2_000 })
  })

  it('I — les anomalies de l’état par lot qui touchent le lot remontent dans le résultat', () => {
    // Revue 20, C14.
    const v = [versement('V1', 'lot-1', 'cpt-A', '2026-01-10', 2_000, FT1_LOT1), versement('V2', 'lot-2', 'cpt-B', '2026-01-15', 1_429, FT1_LOT2)]
    const lot2 = cession('2026-05-01', 'lot-2', 'cpt-B', 'cpt-D')
    const tantiemes = emploi({ montantCentimes: 3_000, decaissement: { objet: 'travaux_ppt', montantCentimes: 3_000, decisionAg: 'Résolution 12' } })
    const negatif = fondsTravauxALaMutation({ positions: lot2, lotId: 'lot-2', date: '2026-05-01', nbLotsPrincipaux: 40, versements: v, emplois: [tantiemes], cles, postes: [], mode: 'tantiemes' })
    expect(negatif.partRattacheeCentimes).toBe(-371)
    expect(negatif.anomalies).toMatchObject([{ code: 'part_negative', refId: 'lot-2' }])
    const sansDecision = emploi({ id: 'EMP-4', decaissement: { objet: 'travaux_ppt', montantCentimes: 1_000, decisionAg: null } })
    const nonDeduit = fondsTravauxALaMutation({ positions: lot2, lotId: 'lot-2', date: '2026-05-01', nbLotsPrincipaux: 40, versements: v, emplois: [sansDecision], cles, postes: [] })
    expect(nonDeduit).toMatchObject({ partRattacheeCentimes: 1_429, anomalies: [{ code: 'emploi_non_autorise', refId: 'EMP-4' }] })
    // Un emploi sur une clé qui ne contient pas le lot ne le concerne pas.
    const ascenseur = emploi({ id: 'EMP-2', cleId: 'cle-002', montantCentimes: 2_000, decaissement: { objet: 'travaux_hors_ppt', montantCentimes: 2_000, decisionAg: 'Résolution 4' } })
    expect(fondsTravauxALaMutation({ positions: avant, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements: v, emplois: [ascenseur], cles, postes: [] }).anomalies).toEqual([])
  })

  it('J — appel du fonds exigible le jour de la mutation, au compte vendeur et impayé : dû par le vendeur', () => {
    // Revue 20, P0 : mutation le 01/04/2026, jour de l'exigibilité de FT-2.
    const mutation = fondsTravauxALaMutation({ positions: cession('2026-04-01'), lotId: 'lot-1', date: '2026-04-01', nbLotsPrincipaux: 40, versements: [], emplois: [], cles, postes })
    expect(mutation.cotisationsImpayeesVendeur.map((c) => c.posteId)).toEqual(['FT-1:lot-1', 'FT-2:lot-1'])
  })

  it('J2 — appel émis après l’enregistrement de la mutation : avisDAppel porte au vendeur l’appel exigible le jour même, dû par lui', () => {
    // Décision de Hugo du 30/10/2026 (D. 1967 art. 6-2) : mutation le 01/04/2026, jour de l'exigibilité de FT-2.
    const vente = [...cession('2026-04-01'), positions[1]]
    const postesVente = postesDepuisAvis(avisDAppel({ echeances, cles: [cle], positions: vente, comptes }), [cle])
    expect(postesVente.filter((p) => p.lotId === 'lot-1').map((p) => [p.id, p.compteId])).toEqual([
      ['B-1:lot-1', 'cpt-A'],
      ['FT-1:lot-1', 'cpt-A'],
      ['FT-2:lot-1', 'cpt-A'],
    ])
    const mutation = fondsTravauxALaMutation({ positions: vente, lotId: 'lot-1', date: '2026-04-01', nbLotsPrincipaux: 40, versements: [], emplois: [], cles, postes: postesVente })
    expect(mutation.cotisationsImpayeesVendeur.map((c) => c.posteId)).toEqual(['FT-1:lot-1', 'FT-2:lot-1'])
    expect(mutation.postesAReattribuer).toEqual([])
  })

  it('L — impayés lus à la date de mutation : un arriéré réglé après reste dû à la mutation', () => {
    // Revue 20, P2 : le vendeur règle FT-2 le 01/06/2026, après la mutation du 01/05/2026.
    const E3: Encaissement = { id: 'E3', compteId: 'cpt-A', date: '2026-06-01', montantCentimes: 2_000 }
    const tous = [encaissements[0], E3]
    const imputation = imputerEncaissements(tous, postes)
    const { versements: lus } = versementsFondsTravauxDepuisImputations(imputation.resultats, tous)
    const mutation = fondsTravauxALaMutation({ positions: avant, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements: lus, emplois: [], cles, postes: imputation.postes })
    expect(mutation.cotisationsImpayeesVendeur).toEqual([{ posteId: 'FT-2:lot-1', exigibilite: '2026-04-01', resteCentimes: 2_000, regleDepuisCentimes: 2_000 }])
    expect(mutation.verseParLeVendeurCentimes).toBe(2_000)
  })

  it('6 — poste repris en partie réglé à la prise de fonction : le réglé fait foi, reste dû sans erreur ; incohérence signalée', () => {
    // Poste repris du syndic précédent : 2 000 appelés, 1 500 réglés avant la prise de fonction, sans versement connu ici.
    const repris: PosteDette = {
      id: 'FT-0:lot-1',
      compteId: 'cpt-A',
      appelId: 'FT-0',
      typeAppel: 'Fonds travaux',
      libelle: 'Fonds de travaux — appel repris',
      exigibilite: '2025-10-01',
      montantCentimes: 2_000,
      regleCentimes: 1_500,
      contentieux: false,
      lotId: 'lot-1',
      cle: '001',
    }
    const aLaMutation = (poste: PosteDette, versementsPoste: VersementFondsTravaux[]) =>
      fondsTravauxALaMutation({ positions: avant, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements: versementsPoste, emplois: [], cles, postes: [poste] })
    expect(aLaMutation(repris, [])).toMatchObject({ cotisationsImpayeesVendeur: [{ posteId: 'FT-0:lot-1', resteCentimes: 500, regleDepuisCentimes: 0 }], anomalies: [] })
    // Le vendeur verse 300 après la mutation (réglé porté à 1 800) : 500 restaient dus à la mutation.
    const FT0 = { id: 'FT-0', exigibilite: '2025-10-01', appeleCentimes: 2_000 }
    const apres = aLaMutation({ ...repris, regleCentimes: 1_800 }, [versement('V9', 'lot-1', 'cpt-A', '2026-06-01', 300, FT0)])
    expect(apres).toMatchObject({ cotisationsImpayeesVendeur: [{ posteId: 'FT-0:lot-1', resteCentimes: 500, regleDepuisCentimes: 300 }], anomalies: [] })
    // Versements après la mutation (1 900) supérieurs au réglé (1 800) : anomalie, reste plafonné à l'appelé.
    const incoherent = aLaMutation({ ...repris, regleCentimes: 1_800 }, [versement('V9', 'lot-1', 'cpt-A', '2026-06-01', 1_900, FT0)])
    expect(incoherent.cotisationsImpayeesVendeur).toMatchObject([{ posteId: 'FT-0:lot-1', resteCentimes: 2_000, regleDepuisCentimes: 1_900 }])
    expect(incoherent.anomalies).toMatchObject([{ code: 'versements_poste_incoherents', refId: 'FT-0:lot-1' }])
  })

  it('S6 — postes et versements de deux imputations différentes : total des versements d’un poste au-delà de son réglé, signalé', () => {
    // Contrôle 20d, sonde S6 : E1 solde B-1 et FT-1 ; E3 (1 000) avant et E5 (1 000) après la mutation du 01/05/2026 règlent FT-2.
    const E3: Encaissement = { id: 'E3', compteId: 'cpt-A', date: '2026-04-10', montantCentimes: 1_000 }
    const E5: Encaissement = { id: 'E5', compteId: 'cpt-A', date: '2026-06-01', montantCentimes: 1_000 }
    const tous = [encaissements[0], E3, E5]
    const complete = imputerEncaissements(tous, postes)
    const { versements: lus } = versementsFondsTravauxDepuisImputations(complete.resultats, tous)
    const aLaMutation = (postesLus: PosteDette[]) =>
      fondsTravauxALaMutation({ positions: avant, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements: lus, emplois: [], cles, postes: postesLus })
    // Même imputation : 1 000 restaient dus à la mutation, rien à signaler.
    expect(aLaMutation(complete.postes)).toMatchObject({ cotisationsImpayeesVendeur: [{ posteId: 'FT-2:lot-1', resteCentimes: 1_000, regleDepuisCentimes: 1_000 }], anomalies: [] })
    // Postes d'une imputation sans E5 (FT-2 réglé 1 000) : 2 000 versés sur FT-2, dont 1 000 seulement après la mutation.
    const incoherent = aLaMutation(imputerEncaissements([encaissements[0], E3], postes).postes)
    expect(incoherent.anomalies).toMatchObject([{ code: 'versements_poste_incoherents', refId: 'FT-2:lot-1' }])
    expect(incoherent.anomalies[0].message).toMatch(/2000 centimes de versements, dont 1000 après la mutation du 01\/05\/2026, pour 1000 centimes réglés ; le réglé fait foi/)
  })

  it('P6d — un versement du jour même de la mutation la précède : il éteint la dette du vendeur', () => {
    // Contrôle 20d, mutant P6d (« >= » au lieu de « > ») : FT-2 (01/04/2026) réglé le 01/05/2026, jour de la mutation.
    const E3: Encaissement = { id: 'E3', compteId: 'cpt-A', date: '2026-05-01', montantCentimes: 2_000 }
    const tous = [encaissements[0], E3]
    const imputation = imputerEncaissements(tous, postes)
    const { versements: lus } = versementsFondsTravauxDepuisImputations(imputation.resultats, tous)
    const mutation = fondsTravauxALaMutation({ positions: avant, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements: lus, emplois: [], cles, postes: imputation.postes })
    expect(mutation).toMatchObject({ cotisationsImpayeesVendeur: [], verseParLeVendeurCentimes: 4_000, anomalies: [] })
  })

  it('7 — appel du fonds exigible après la mutation et encore au compte du vendeur : à réattribuer, jamais dû par le vendeur', () => {
    // Les postes ont été appelés avant l'enregistrement de la mutation du 01/03/2026 : FT-2 (01/04/2026) est resté à cpt-A.
    const mutation = fondsTravauxALaMutation({ positions: cession('2026-03-01'), lotId: 'lot-1', date: '2026-03-01', nbLotsPrincipaux: 40, versements: [], emplois: [], cles, postes })
    expect(mutation.cotisationsImpayeesVendeur.map((c) => c.posteId)).toEqual(['FT-1:lot-1'])
    expect(mutation.postesAReattribuer).toEqual([{ posteId: 'FT-2:lot-1', exigibilite: '2026-04-01', montantCentimes: 2_000, regleCentimes: 0 }])
  })

  it('P7b — appel à réattribuer réglé par le vendeur après la mutation : son réglé est repris ; des versements au-delà sont signalés', () => {
    // Contrôle 20d, mutant P7b (réglé mis à 0) : mutation le 01/03/2026 ; FT-2 (01/04/2026), resté à cpt-A, réglé par lui le 10/04/2026.
    const E3: Encaissement = { id: 'E3', compteId: 'cpt-A', date: '2026-04-10', montantCentimes: 2_000 }
    const tous = [encaissements[0], E3]
    const imputation = imputerEncaissements(tous, postes)
    const { versements: lus } = versementsFondsTravauxDepuisImputations(imputation.resultats, tous)
    const aLaMutation = (postesLus: PosteDette[]) =>
      fondsTravauxALaMutation({ positions: cession('2026-03-01'), lotId: 'lot-1', date: '2026-03-01', nbLotsPrincipaux: 40, versements: lus, emplois: [], cles, postes: postesLus })
    expect(aLaMutation(imputation.postes)).toMatchObject({
      cotisationsImpayeesVendeur: [],
      postesAReattribuer: [{ posteId: 'FT-2:lot-1', exigibilite: '2026-04-01', montantCentimes: 2_000, regleCentimes: 2_000 }],
      verseParLeVendeurCentimes: 2_000,
      anomalies: [],
    })
    // Postes lus avant ce règlement (FT-2 réglé 0) : le contrôle vaut aussi pour un poste à réattribuer.
    expect(aLaMutation(imputerEncaissements([encaissements[0]], postes).postes).anomalies).toMatchObject([{ code: 'versements_poste_incoherents', refId: 'FT-2:lot-1' }])
  })

  const fondsA = (date: string, nbLotsPrincipaux: number | null) =>
    fondsTravauxALaMutation({ positions: cession(date, 'lot-1', 'cpt-A', 'cpt-C', '2010-01-01'), lotId: 'lot-1', date, nbLotsPrincipaux, versements: [], emplois: [], cles, postes: [] })
  const ANCIEN_14_2 = 'L. 1965 art. 14-2, II (rédaction antérieure à la loi n° 2021-1104)'

  it('E — fondement selon la date et le nombre de lots (loi n° 2021-1104, art. 171, VI)', () => {
    // Revue 20, C3 : 40 lots, mutation le 01/06/2024 → ancien art. 14-2, II, sans la phrase sur l'acquéreur.
    const ancien = fondsA('2024-06-01', 40)
    expect(ancien.fondements).toContain('L. 1965 art. 14-2, II (rédaction antérieure à la loi n° 2021-1104)')
    expect(ancien.fondements).not.toContain('L. 1965 art. 14-2-1, III')
    expect(ancien.mention).not.toMatch(/acquéreur/)
    const actuel = fondsA('2025-02-01', 40)
    expect(actuel.fondements).toContain('L. 1965 art. 14-2-1, III')
    expect(actuel.mention).toMatch(/acquéreur peut consentir/)
    expect(fondsA('2024-06-01', 250).fondements).toContain('L. 1965 art. 14-2-1, III')
    expect(fondsA('2022-06-01', null).fondements).toContain('L. 1965 art. 14-2, II (rédaction antérieure à la loi n° 2021-1104)')
    // Nombre de lots inconnu entre 2023 et 2025, ou rédaction de l'ancien article non relue : à établir.
    expect(fondsA('2024-06-01', null)).toMatchObject({ fondements: ['Loi n° 2021-1104 du 22 août 2021, art. 171, VI'], mention: expect.stringMatching(/à établir/) })
    expect(fondsA('2018-01-01', 40).mention).toMatch(/non relue/)
  })

  it('8 — bornes exactes du régime : 200/201 et 50/51 lots, le 01/01 de chaque palier et la veille', () => {
    const regime = (date: string, nbLots: number | null): string => {
      const { fondements } = fondsA(date, nbLots)
      if (fondements.includes('L. 1965 art. 14-2-1, III')) return 'actuel'
      if (fondements.includes(ANCIEN_14_2)) return 'ancien'
      return 'à établir'
    }
    const cas: [string, number | null, string][] = [
      ['2022-12-31', 201, 'ancien'],
      ['2023-01-01', 201, 'actuel'],
      ['2023-01-01', 200, 'ancien'],
      ['2023-12-31', 200, 'ancien'],
      ['2024-01-01', 200, 'actuel'],
      ['2023-12-31', 51, 'ancien'],
      ['2024-01-01', 51, 'actuel'],
      ['2024-01-01', 50, 'ancien'],
      ['2024-12-31', 50, 'ancien'],
      ['2025-01-01', 50, 'actuel'],
      ['2022-12-31', null, 'ancien'],
      ['2023-01-01', null, 'à établir'],
      ['2024-12-31', null, 'à établir'],
      ['2025-01-01', null, 'actuel'],
      ['2018-11-24', 40, 'à établir'],
      ['2018-11-25', 40, 'ancien'],
    ]
    expect(cas.map(([date, nbLots]) => [date, nbLots, regime(date, nbLots)])).toEqual(cas)
  })
})

describe('informations dues à l’acquéreur (CCH L. 721-2, II, 2°, d)', () => {
  // Revue 20, C0 / C4 / C11 : exercice 2025 clos le 31/12/2025, AG d'approbation le 15/03/2026, promesse le 01/04/2026,
  // mutation le 01/05/2026 ; quatre cotisations de 2 000 en 2025, puis 2 000 le 10/01/2026 et le 10/04/2026.
  const appel = (id: string, exigibilite: string) => ({ id, exigibilite, appeleCentimes: 2_000 })
  const versements = [
    versement('V25-1', 'lot-1', 'cpt-A', '2025-01-10', 2_000, appel('FT25-1', '2025-01-01')),
    versement('V25-2', 'lot-1', 'cpt-A', '2025-04-10', 2_000, appel('FT25-2', '2025-04-01')),
    versement('V25-3', 'lot-1', 'cpt-A', '2025-07-10', 2_000, appel('FT25-3', '2025-07-01')),
    versement('V25-4', 'lot-1', 'cpt-A', '2025-10-10', 2_000, appel('FT25-4', '2025-10-01')),
    versement('V26-1', 'lot-1', 'cpt-A', '2026-01-10', 2_000, appel('FT26-1', '2026-01-01')),
    versement('V26-2', 'lot-1', 'cpt-A', '2026-04-10', 2_000, appel('FT26-2', '2026-04-01')),
  ]
  const avant = cession('2026-05-01')

  it('A — part et dernière cotisation arrêtées à la clôture approuvée avant la promesse ; L. 721-2 cité pour elles seules', () => {
    const info = informationsFondsTravauxAcquereur({ positions: avant, lotId: 'lot-1', datePromesse: '2026-04-01', dateArrete: '2025-12-31', nbLotsPrincipaux: 40, versements, emplois: [], cles, exercices })
    expect(info).toMatchObject({
      compteVendeurId: 'cpt-A',
      partRattacheeCentimes: 8_000,
      derniereCotisationVendeur: { posteId: 'FT25-4:lot-1', montantCentimes: 2_000, date: '2025-10-10' },
      anomalies: [],
      fondements: ['CCH art. L. 721-2, II, 2°, d) et alinéa suivant', expect.stringMatching(/^Rédaction issue de la loi n° 2021-1104/)],
      aConfirmer: true,
    })
    expect(info.mention).toMatch(/31\/12\/2025/)
    // La mutation, elle, porte la part du jour et ne cite pas L. 721-2.
    const mutation = fondsTravauxALaMutation({ positions: avant, lotId: 'lot-1', date: '2026-05-01', nbLotsPrincipaux: 40, versements, emplois: [], cles, postes: [] })
    expect(mutation.partRattacheeCentimes).toBe(12_000)
    expect(mutation.fondements.some((f) => f.includes('L. 721-2'))).toBe(false)
  })

  it('A — la date d’arrêté précède la promesse ; le vendeur est celui en place à la promesse', () => {
    expect(() => informationsFondsTravauxAcquereur({ positions: avant, lotId: 'lot-1', datePromesse: '2026-04-01', dateArrete: '2026-04-01', nbLotsPrincipaux: 40, versements, emplois: [], cles, exercices })).toThrow(/précéder la promesse/)
    expect(() => informationsFondsTravauxAcquereur({ positions: avant, lotId: 'lot-1', datePromesse: '2026-04-01', dateArrete: '31/12/2025', nbLotsPrincipaux: 40, versements, emplois: [], cles, exercices })).toThrow(/AAAA-MM-JJ/)
    // Promesse après la mutation : le copropriétaire en place est cpt-C, qui n'a rien versé à l'arrêté.
    expect(informationsFondsTravauxAcquereur({ positions: avant, lotId: 'lot-1', datePromesse: '2026-06-01', dateArrete: '2025-12-31', nbLotsPrincipaux: 40, versements, emplois: [], cles, exercices })).toMatchObject({ compteVendeurId: 'cpt-C', partRattacheeCentimes: 8_000, derniereCotisationVendeur: null })
  })

  it('3 — 🔴 « dernière cotisation » : dernier appel soldé ET cotisation annuelle de son exercice, sans choisir', () => {
    const info = (versementsLus: VersementFondsTravaux[], exercicesConnus: { ouverture: string; cloture: string }[]) =>
      informationsFondsTravauxAcquereur({ positions: avant, lotId: 'lot-1', datePromesse: '2026-04-01', dateArrete: '2025-12-31', nbLotsPrincipaux: 40, versements: versementsLus, emplois: [], cles, exercices: exercicesConnus })
    const deuxLectures = info(versements, exercices)
    expect(deuxLectures.derniereCotisationVendeur).toMatchObject({ posteId: 'FT25-4:lot-1', montantCentimes: 2_000 })
    expect(deuxLectures.cotisationAnnuelleVendeur).toEqual({
      ouverture: '2025-01-01',
      cloture: '2025-12-31',
      montantCentimes: 8_000,
      posteIds: ['FT25-1:lot-1', 'FT25-2:lot-1', 'FT25-3:lot-1', 'FT25-4:lot-1'],
    })
    expect(deuxLectures.mention).toMatch(/choisie par le notaire/)
    // Un appel de l'exercice non soldé n'entre pas dans la somme.
    expect(info(versements.filter((v) => v.id !== 'V25-2'), exercices).cotisationAnnuelleVendeur).toMatchObject({ montantCentimes: 6_000 })
    // Aucun exercice connu ne contient le dernier appel soldé : pas de cotisation annuelle.
    expect(info(versements, [{ ouverture: '2026-01-01', cloture: '2026-12-31' }]).cotisationAnnuelleVendeur).toBeNull()
    // Exercices invalides ou qui se chevauchent : refusés.
    expect(() => info(versements, [{ ouverture: '2025-01-01', cloture: '2025-12-31' }, { ouverture: '2025-07-01', cloture: '2026-06-30' }])).toThrow(/chevauchent/)
    expect(() => info(versements, [{ ouverture: '2025-12-31', cloture: '2025-01-01' }])).toThrow(/clôture/)
  })

  it('P3a — cotisation annuelle : les seuls appels soldés de l’exercice du dernier appel, pas ceux d’un exercice antérieur', () => {
    // Contrôle 20d, mutant P3a (filtre sur l'exercice retiré) : un appel de 2024 soldé par le vendeur.
    const avec2024 = [versement('V24-4', 'lot-1', 'cpt-A', '2024-10-10', 2_000, appel('FT24-4', '2024-10-01')), ...versements]
    const info = informationsFondsTravauxAcquereur({ positions: avant, lotId: 'lot-1', datePromesse: '2026-04-01', dateArrete: '2025-12-31', nbLotsPrincipaux: 40, versements: avec2024, emplois: [], cles, exercices })
    expect(info.cotisationAnnuelleVendeur).toEqual({
      ouverture: '2025-01-01',
      cloture: '2025-12-31',
      montantCentimes: 8_000,
      posteIds: ['FT25-1:lot-1', 'FT25-2:lot-1', 'FT25-3:lot-1', 'FT25-4:lot-1'],
    })
  })

  it('P3b — un appel exigible le jour de la clôture appartient à l’exercice qui se clôt', () => {
    // Contrôle 20d, mutant P3b (clôture exclue) : appel exigible et soldé le 31/12/2025, arrêté au 31/12/2025.
    const cloture = [...versements, versement('V25-5', 'lot-1', 'cpt-A', '2025-12-31', 2_000, appel('FT25-5', '2025-12-31'))]
    const info = informationsFondsTravauxAcquereur({ positions: avant, lotId: 'lot-1', datePromesse: '2026-04-01', dateArrete: '2025-12-31', nbLotsPrincipaux: 40, versements: cloture, emplois: [], cles, exercices })
    expect(info.derniereCotisationVendeur).toMatchObject({ posteId: 'FT25-5:lot-1', date: '2025-12-31' })
    expect(info.cotisationAnnuelleVendeur).toMatchObject({ cloture: '2025-12-31', montantCentimes: 10_000 })
  })

  it('P3d — deux exercices qui partagent un jour (clôture = ouverture suivante) se chevauchent', () => {
    // Contrôle 20d, mutant P3d (« < » au lieu de « <= ») ; exercices contigus admis.
    const info = (exercicesConnus: { ouverture: string; cloture: string }[]) =>
      informationsFondsTravauxAcquereur({ positions: avant, lotId: 'lot-1', datePromesse: '2026-04-01', dateArrete: '2025-12-31', nbLotsPrincipaux: 40, versements, emplois: [], cles, exercices: exercicesConnus })
    expect(() => info([{ ouverture: '2025-01-01', cloture: '2025-12-31' }, { ouverture: '2025-12-31', cloture: '2026-12-30' }])).toThrow(/chevauchent/)
    expect(info([{ ouverture: '2025-01-01', cloture: '2025-12-31' }, { ouverture: '2026-01-01', cloture: '2026-12-31' }]).cotisationAnnuelleVendeur).toMatchObject({ montantCentimes: 8_000 })
  })

  it('S4 — rédaction de L. 721-2 selon la date de la promesse et le nombre de lots (loi n° 2021-1104, art. 171, VII) ; à établir avant le 29/08/2015', () => {
    // Contrôle 20d, sonde S4 : 40 lots, promesse du 01/06/2025 → rédaction issue de l'ordonnance n° 2015-1075 (la loi de
    // 2021 n'entre en vigueur que le 01/01/2026 jusqu'à 50 lots), dont le d) et l'alinéa suivant sont les mêmes.
    const informations = (datePromesse: string, nbLotsPrincipaux: number | null) =>
      informationsFondsTravauxAcquereur({ positions: cession('2026-05-01', 'lot-1', 'cpt-A', 'cpt-C', '2010-01-01'), lotId: 'lot-1', datePromesse, dateArrete: '2014-12-31', nbLotsPrincipaux, versements: [], emplois: [], cles, exercices: [] })
    const redaction = (datePromesse: string, nbLots: number | null): string => {
      const [premier, second] = informations(datePromesse, nbLots).fondements
      if (premier !== 'CCH art. L. 721-2, II, 2°, d) et alinéa suivant') return 'à établir'
      if (second.includes('ordonnance n° 2015-1075 ou de la loi n° 2021-1104')) return 'selon les lots'
      return second.startsWith("Rédaction issue de l'ordonnance n° 2015-1075") ? '2015' : '2021'
    }
    const sonde = informations('2025-06-01', 40)
    expect(sonde.fondements).toEqual([
      'CCH art. L. 721-2, II, 2°, d) et alinéa suivant',
      "Rédaction issue de l'ordonnance n° 2015-1075, en vigueur depuis le 29/08/2015 jusqu'à l'entrée en vigueur fixée par la loi n° 2021-1104, art. 171, VII : d) et alinéa suivant identiques à ceux de la rédaction issue de cette loi",
    ])
    expect(sonde.mention).not.toMatch(/à établir/)
    const cas: [string, number | null, string][] = [
      ['2015-08-28', 40, 'à établir'],
      ['2015-08-29', 40, '2015'],
      ['2023-12-31', 201, '2015'],
      ['2024-01-01', 201, '2021'],
      ['2024-01-01', 200, '2015'],
      ['2024-12-31', 200, '2015'],
      ['2025-01-01', 51, '2021'],
      ['2025-01-01', 50, '2015'],
      ['2025-06-01', 40, '2015'],
      ['2025-12-31', 50, '2015'],
      ['2026-01-01', 50, '2021'],
      ['2023-12-31', null, '2015'],
      ['2024-01-01', null, 'selon les lots'],
      ['2025-12-31', null, 'selon les lots'],
      ['2026-01-01', null, '2021'],
    ]
    expect(cas.map(([date, nbLots]) => [date, nbLots, redaction(date, nbLots)])).toEqual(cas)
    expect(informations('2015-08-28', 40)).toMatchObject({
      aConfirmer: true,
      fondements: ['CCH art. L. 721-2 : rédaction antérieure au 29/08/2015 à établir (non relue)'],
      mention: expect.stringMatching(/^Fondement à établir : promesse antérieure au 29\/08\/2015/),
    })
    expect(() => informations('2025-06-01', -1)).toThrow(/lots/)
  })

  it('8 — anomalies de l’information à l’acquéreur : part négative à l’arrêté ; un emploi postérieur à l’arrêté n’y figure pas', () => {
    const v = [
      versement('V1', 'lot-1', 'cpt-A', '2025-01-10', 2_000, appel('FT25-1', '2025-01-01')),
      versement('V2', 'lot-2', 'cpt-B', '2025-01-15', 1_429, { id: 'FT25-1', exigibilite: '2025-01-01', appeleCentimes: 3_000 }),
    ]
    const tantiemes = (date: string) => emploi({ date, montantCentimes: 3_000, decaissement: { objet: 'travaux_ppt', montantCentimes: 3_000, decisionAg: 'Résolution 12' } })
    const informations = (emplois: EmploiFondsTravaux[]) =>
      informationsFondsTravauxAcquereur({ positions: cession('2026-05-01', 'lot-2', 'cpt-B', 'cpt-D'), lotId: 'lot-2', datePromesse: '2026-04-01', dateArrete: '2025-12-31', nbLotsPrincipaux: 40, versements: v, emplois, cles, exercices, mode: 'tantiemes' })
    const negative = informations([tantiemes('2025-06-01')])
    expect(negative.partRattacheeCentimes).toBe(-371)
    expect(negative.anomalies).toMatchObject([{ code: 'part_negative', refId: 'lot-2' }])
    expect(informations([tantiemes('2026-02-01')])).toMatchObject({ partRattacheeCentimes: 1_429, anomalies: [] })
  })
})

describe('en-tête du module (marqueurs 🟢 / 🔵 / 🔴)', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'fonds-travaux-lots.ts'), 'utf8')
  // En-tête d'une ligne : retours à la ligne et astérisques de commentaire retirés.
  const entete = source.slice(0, source.indexOf('*/')).replaceAll(/\s*\n\s*\*\s?/g, ' ')
  const deduit = entete.slice(entete.indexOf('🔵'), entete.indexOf('🔴'))
  const nonEtabli = entete.slice(entete.indexOf('🔴'))

  it('2 — loi n° 2021-1104, art. 171, II, 4° : ne modifie ni le d) ni l’alinéa qui le suit (il ne se borne pas aux 6° et 7°)', () => {
    expect(entete).toMatch(/art\. 171, II, 4° ne modifie ni le d\) ni l'alinéa qui le suit/)
    expect(entete).not.toMatch(/n'insère que les 6° et 7°/)
  })

  it('3 — « dernière cotisation versée » : 🔴 laissée ouverte (le notaire choisit), deux lectures exposées, plus en 🔵', () => {
    expect(nonEtabli).toMatch(/« dernière cotisation versée » \(L\. 721-2, II, 2°, d\) — laissée ouverte \(Hugo, 30\/10\/2026 : le notaire choisit la/)
    expect(nonEtabli).toMatch(/cotisation ANNUELLE \(art\. 14-2-1, I, al\. 6\)/)
    expect(nonEtabli).toMatch(/\(1\) le dernier appel du fonds entièrement versé/)
    expect(nonEtabli).toMatch(/\(2\) la cotisation annuelle de l'exercice de cet appel/)
    expect(deduit).not.toMatch(/« dernière cotisation versée »/)
  })
})
