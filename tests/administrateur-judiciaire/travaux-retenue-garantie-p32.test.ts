import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COMPTE_ATTENTE_RETENUE_GARANTIE,
  controlerEnTeteFactureTravaux,
  echeanceReglement,
  ecritureFactureVentilee,
  plafondRetenueGarantie,
  retenueAuTaux,
  TAUX_MAXIMAL_RETENUE_GARANTIE_PCT,
  type LigneFacture,
} from '@/lib/administrateur-judiciaire/domain/facture-ventilee'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import type { ReglementFournisseur, StatutReglementFournisseur } from '@/lib/administrateur-judiciaire/domain/reglements-fournisseurs'
import { retourFactureApresRejet, type FactureAPayer } from '@/lib/administrateur-judiciaire/domain/statuts-facture'
import { creerOperationTravaux, retenueGarantie } from '@/lib/administrateur-judiciaire/domain/travaux-operations'
import {
  baseRetourApresRejet,
  creerMarcheTravaux,
  echeancesLiberationGarantie,
  ecritureLiberationRetenue,
  enTeteFactureDuMarche,
  expirationDelaiGarantie,
  garantieDeLOperation,
  MENTION_PART_DEDUCTIBLE,
  partsDeductiblesBailleurs,
  suiviRetenueMarche,
  type ChargesCoproprietaireOperation,
  type ConsignationRetenue,
  type FactureDeLOperation,
  type FactureDuMarche,
  type MarcheTravaux,
  type RestitutionRetenue,
  type SaisieMarcheTravaux,
  type SuiviRetenueMarche,
} from '@/lib/administrateur-judiciaire/domain/travaux-retenue-garantie'
import { enTeteDuModule } from './en-tete-module'

/**
 * Point 32 du bilan — retenue de garantie et déduction fiscale des marchés de travaux (Gestéam, tranche 32 : « Garantie
 * (taux, montant, restituée), Déduction fiscale € » ; tranche 36 : « Avancement %, Retenue de garantie € » de la
 * facture). Loi n° 71-584 du 16 juillet 1971, art. 1er et 2 ; arrêté du 14 mars 2005, art. 7 et 10 ; CGI art. 31, I, 1°.
 *
 * Relectures, regroupées ici :
 * - tour 1 : caution « pour un montant égal » (art. 1er, al. 4), mainlevée de l'opposition et opposition antérieure à la
 *   réception (art. 2), états de la garantie, restitution antérieure à l'opposition, arrondis entiers (retenue au taux,
 *   avancement), retenue nulle, retenue invalide hors des totaux, parts déductibles réparties une seule fois, total à
 *   passer au retour après rejet (statuts-facture.ts, J9) ;
 * - tour 2 : opposition notifiée sans réception datée (tenue pour notifiée dans le délai), caution fournie après des
 *   retenues pratiquées (la condition s'apprécie à la date de la facture, la retenue déjà pratiquée reste libérable),
 *   montants des restitutions et des consignations contrôlés (centimes entiers strictement positifs, hors des totaux sinon) ;
 * - tour 3 : TTC et date des factures du marché contrôlés (facture invalide bloquante et écartée des totaux, du suivi par
 *   marché comme du pied de l'opération), dates des restitutions et des consignations contrôlées ;
 * - restes du contrôle, tour 1 : règlements d'une facture écartée retirés du réglé (marché et pied de l'opération) ;
 *   libération refusée tant qu'une saisie écartée fausse le reste retenu ;
 * - restes du contrôle, tour 2 : restitution dont seule la date est invalide comptée au restitué (reste retenu, garantie
 *   et dû du marché comme du pied), hors des classements par date ; un réglé au-delà du dû nomme les saisies qui
 *   faussent encore le reste retenu (restitution au montant invalide).
 */

const COPRO = 'copro-tilleuls'

const marche = (surcharge: Partial<SaisieMarcheTravaux> = {}): MarcheTravaux =>
  creerMarcheTravaux({
    id: 'm1',
    coproprieteId: COPRO,
    travauxId: '00042',
    fournisseurId: 'f-facade',
    libelle: 'Ravalement — lot façade',
    montantTtcCentimes: 10_000_000,
    garantie: 'retenue',
    tauxRetenuePct: 5,
    dateReception: '2027-03-15',
    ...surcharge,
  })

const facture = (id: string, date: string, totalTtcCentimes: number, avancementPct: number | null, retenueGarantieCentimes: number | null): FactureDuMarche => ({
  id,
  coproprieteId: COPRO,
  marcheId: 'm1',
  date,
  totalTtcCentimes,
  avancementPct,
  retenueGarantieCentimes,
})

const restitution = (id: string, le: string, montantCentimes: number): RestitutionRetenue => ({ id, coproprieteId: COPRO, marcheId: 'm1', le, montantCentimes })
const consignation = (id: string, le: string, montantCentimes: number): ConsignationRetenue => ({ id, coproprieteId: COPRO, marcheId: 'm1', le, montantCentimes, consignataireId: 'consignataire-1' })

const FACTURES: FactureDuMarche[] = [
  facture('f2', '2027-02-01', 4_000_000, 70, 200_000),
  facture('f1', '2026-12-01', 3_000_000, 30, 150_000),
  facture('f3', '2027-03-20', 3_000_000, 100, 150_000),
]

const CONSIGNATION = consignation('c1', '2027-03-25', 500_000)
const RETENUE_500 = [facture('f1', '2027-01-10', 10_000_000, 100, 500_000)]
const OPPOSITION = { notifieeLe: '2028-03-01', motif: 'Réserves non levées' }
const CONTEXTE = { id: 't-lib', segmentSyndicat: 'TILL', auxiliaireFournisseur: 'FACAD' }

const operation = creerOperationTravaux({
  numero: '00042',
  coproprieteId: COPRO,
  libelle: 'Ravalement façade rue',
  cleId: 'cle-001',
  decision: { date: '2026-03-12', resolution: 'Résolution 8', majorite: 'art24' },
  budgetTtcCentimes: 12_000_000,
  financementFondsTravauxCentimes: 0,
  affectationFonds: null,
  tranches: [{ date: '2026-05-01', tauxPct: 100 }],
})

const deLOperation = (f: FactureDuMarche, marcheId: string | null = f.marcheId): FactureDeLOperation => ({ ...f, travauxId: '00042', marcheId })
const reglement = (id: string, factureId: string, statut: StatutReglementFournisseur, montantCentimes: number, coproprieteId = COPRO) =>
  ({ id, coproprieteId, travauxId: '00042', factureId, statut, montantCentimes }) as ReglementFournisseur

const codes = (anomalies: { code: string }[]): string[] => anomalies.map((a) => a.code)
const gravites = (anomalies: { code: string; gravite: string }[]): [string, string][] => anomalies.map((a) => [a.code, a.gravite])
const parObjet = (anomalies: { code: string; objetId: string; gravite: string }[]): [string, string, string][] => anomalies.map((a) => [a.code, a.objetId, a.gravite])
const eur = (centimes: number): string => formatEurosCentimes(centimes / 100)

describe('facture : avancement et retenue de garantie (facture-ventilee.ts)', () => {
  const lignes: LigneFacture[] = [
    {
      comptePlan: '67100',
      analytique: null,
      cleRepartition: '001 - Charges communes générales',
      rubrique: null,
      codeFiscal: null,
      montantTtcCentimes: 3_000_000,
      recupLocatairePct: 0,
      lotId: null,
      rattachement: { type: 'travaux', id: '00042' },
    },
  ]
  const base = { id: 't-f1', date: '2026-12-01', segmentSyndicat: 'TILL', auxiliaireFournisseur: 'FACAD', fournisseurId: 'f-facade', totalTtcCentimes: 3_000_000, lignes }

  it('plafond légal de 5 % et compte 472 « Compte en attente d’imputation créditeur » (arrêté, art. 7)', () => {
    expect(TAUX_MAXIMAL_RETENUE_GARANTIE_PCT).toBe(5)
    expect(COMPTE_ATTENTE_RETENUE_GARANTIE).toEqual({ planCode: '47200', intitule: "Compte en attente d'imputation créditeur" })
  })

  it('contrôle l’en-tête : avancement entre 0 et 100 %, retenue au plus 5 % du TTC, rattachée à une opération', () => {
    expect(controlerEnTeteFactureTravaux(3_000_000, { avancementPct: 30, retenueGarantie: { montantCentimes: 150_000, travauxId: '00042' } })).toEqual([])
    expect(codes(controlerEnTeteFactureTravaux(3_000_000, { avancementPct: 120 }))).toEqual(['avancement_invalide'])
    expect(codes(controlerEnTeteFactureTravaux(3_000_000, { retenueGarantie: { montantCentimes: 150_001, travauxId: '00042' } }))).toEqual(['retenue_plafond'])
    expect(codes(controlerEnTeteFactureTravaux(3_000_000, { retenueGarantie: { montantCentimes: 100, travauxId: '42' } }))).toEqual(['retenue_invalide'])
    expect(codes(controlerEnTeteFactureTravaux(3_000_000, { retenueGarantie: { montantCentimes: -1, travauxId: '00042' } }))).toEqual(['retenue_invalide'])
  })

  it('écriture : le 401 crédité du TTC (art. 10), puis la retenue du 401 au 47200 du fournisseur, liens fournisseur et travaux', () => {
    const t = ecritureFactureVentilee({ ...base, avancementPct: 30, retenueGarantie: { montantCentimes: 150_000, travauxId: '00042', marcheId: 'm1' } })
    expect(t.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      ['TILL.67100.00042.0', 'debit', 3_000_000],
      ['TILL.40100.FACAD.0', 'credit', 3_000_000],
      ['TILL.40100.FACAD.0', 'debit', 150_000],
      ['TILL.47200.FACAD.0', 'credit', 150_000],
    ])
    expect(t.mouvements[3].liens).toEqual({ fournisseurId: 'f-facade', travauxId: '00042' })
  })

  it('sans retenue, ou retenue nulle : écriture inchangée ; au-delà de 5 % : refusée', () => {
    const sans = ecritureFactureVentilee(base).mouvements.map((m) => m.compte)
    expect(ecritureFactureVentilee({ ...base, retenueGarantie: { montantCentimes: 0, travauxId: '00042' } }).mouvements.map((m) => m.compte)).toEqual(sans)
    expect(sans).toEqual(['TILL.67100.00042.0', 'TILL.40100.FACAD.0'])
    expect(() => ecritureFactureVentilee({ ...base, retenueGarantie: { montantCentimes: 200_000, travauxId: '00042' } })).toThrow(/5 % au plus/)
  })

  it('reste dû net des acomptes et de la retenue ; sans retenue, inchangé', () => {
    const aRegler = { dateFacture: '2026-12-01', joursEcheance: 30, totalTtcCentimes: 3_000_000, acomptesCentimes: 1_000_000 }
    expect(echeanceReglement({ ...aRegler, retenueGarantieCentimes: 150_000 }, '2026-12-15').resteDuCentimes).toBe(1_850_000)
    expect(echeanceReglement(aRegler, '2026-12-15').resteDuCentimes).toBe(2_000_000)
    expect(echeanceReglement({ ...aRegler, acomptesCentimes: 2_850_000, retenueGarantieCentimes: 150_000 }, '2027-02-01')).toMatchObject({ resteDuCentimes: 0, enRetard: false })
  })

  it('retenue d’une opération dont aucune ligne ne relève : refusée', () => {
    const autre = { montantCentimes: 150_000, travauxId: '00043' }
    expect(codes(controlerEnTeteFactureTravaux(3_000_000, { retenueGarantie: autre }, lignes))).toEqual(['retenue_sans_travaux'])
    expect(controlerEnTeteFactureTravaux(3_000_000, { retenueGarantie: autre })).toEqual([])
    expect(() => ecritureFactureVentilee({ ...base, retenueGarantie: autre })).toThrow(/aucune ligne/)
  })

  it('en-tête depuis le marché : retenue proposée au taux du marché, aucune sous caution ; acceptée par l’écriture', () => {
    const enTete = enTeteFactureDuMarche(marche(), { totalTtcCentimes: 3_000_000, avancementPct: 30 })
    expect(enTete).toEqual({ avancementPct: 30, retenueGarantie: { montantCentimes: 150_000, travauxId: '00042', marcheId: 'm1' } })
    expect(ecritureFactureVentilee({ ...base, ...enTete }).mouvements).toHaveLength(4)
    expect(enTeteFactureDuMarche(marche(), { totalTtcCentimes: 3_000_000, avancementPct: 30, retenueCentimes: 100_000 }).retenueGarantie?.montantCentimes).toBe(100_000)
    const caution = marche({ garantie: 'caution', cautionCentimes: 500_000 })
    expect(enTeteFactureDuMarche(caution, { totalTtcCentimes: 3_000_000, avancementPct: null })).toEqual({ avancementPct: null, retenueGarantie: null })
    expect(() => enTeteFactureDuMarche(caution, { totalTtcCentimes: 3_000_000, avancementPct: null, retenueCentimes: 1 })).toThrow(/caution/)
  })
})

describe('taux et arrondi : jamais au-delà de 5 % (retenueGarantie corrigée)', () => {
  it('plafond au centime inférieur ; retenue au taux bornée au plafond', () => {
    expect(plafondRetenueGarantie(1_000_010)).toBe(50_000)
    expect(retenueAuTaux(1_000_010, 5)).toBe(50_000)
    expect(retenueAuTaux(1_000_000, 3)).toBe(30_000)
    expect(retenueAuTaux(1_000_050, 2.5)).toBe(25_001)
  })

  it('retenueGarantie : taux non fini refusé, arrondi borné à 5 % du TTC', () => {
    expect(() => retenueGarantie({ montantTtcCentimes: 1_000_000, tauxPct: Number.NaN, dateReception: null })).toThrow(/5 % au plus/)
    expect(() => retenueGarantie({ montantTtcCentimes: 1_000_000, tauxPct: Number.POSITIVE_INFINITY, dateReception: null })).toThrow(/5 % au plus/)
    expect(retenueGarantie({ montantTtcCentimes: 1_000_010, tauxPct: 5, dateReception: null })).toEqual({ retenueCentimes: 50_000, netAPayerCentimes: 950_010, liberationLe: null })
  })

  it('suivi : la retenue au plafond (vingtième du TTC à un demi-centime ou plus) n’est pas un écart au taux du marché', () => {
    const factures = [facture('x', '2027-01-01', 1_000_010, 20, 50_000)]
    expect(suiviRetenueMarche(marche(), { factures, consignations: [{ ...CONSIGNATION, montantCentimes: 50_000 }] }, '2027-11-04').anomalies).toEqual([])
  })
})

describe('marché : garantie, réception, opposition, déduction', () => {
  it('retenue stipulée de 5 % au plus (loi n° 71-584, art. 1er) ; caution avec la retenue stipulée et son montant ; ni taux ni caution sans garantie', () => {
    expect(marche().tauxRetenuePct).toBe(5)
    expect(() => marche({ tauxRetenuePct: 6 })).toThrow(/5 % au plus/)
    expect(() => marche({ tauxRetenuePct: null })).toThrow(/taux stipulé/)
    expect(marche({ garantie: 'caution', tauxRetenuePct: 5, cautionCentimes: 500_000 }).tauxRetenuePct).toBe(5)
    expect(() => marche({ garantie: 'caution', tauxRetenuePct: null, cautionCentimes: 500_000 })).toThrow(/taux stipulé/)
    expect(() => marche({ garantie: 'caution' })).toThrow(/montant de la caution/)
    expect(marche({ garantie: 'caution', cautionCentimes: 500_000 }).cautionCentimes).toBe(500_000)
    expect(() => marche({ garantie: 'aucune', tauxRetenuePct: null, cautionCentimes: 1 })).toThrow(/caution sans caution/)
  })

  it('opposition motivée sur un marché garanti ; notifiée avant la réception : admise (signalée au suivi)', () => {
    const opposition = { notifieeLe: '2028-01-10', motif: 'Réserves non levées' }
    expect(marche({ opposition }).opposition).toEqual(opposition)
    expect(() => marche({ opposition: { ...opposition, motif: ' ' } })).toThrow(/motif exigé/)
    expect(marche({ opposition: { ...opposition, notifieeLe: '2027-03-01' } }).opposition?.notifieeLe).toBe('2027-03-01')
    expect(marche({ dateReception: null, opposition }).opposition).toEqual(opposition)
    expect(() => marche({ garantie: 'aucune', tauxRetenuePct: null, opposition })).toThrow(/sans garantie/)
  })

  it('déduction fiscale : au plus le marché, qualifiée (CGI art. 31, I, 1°)', () => {
    expect(() => marche({ deductionFiscaleCentimes: 1_000 })).toThrow(/sans qualification/)
    expect(() => marche({ deductionFiscaleCentimes: 10_000_001, qualificationFiscale: 'reparation_entretien' })).toThrow(/au plus le montant du marché/)
    expect(marche({ deductionFiscaleCentimes: 6_000_000, qualificationFiscale: 'reparation_entretien' }).deductionFiscaleCentimes).toBe(6_000_000)
  })

  it('expiration du délai d’un an depuis la réception (art. 2) : même quantième ; même date que retenueGarantie', () => {
    expect(expirationDelaiGarantie(marche())).toBe('2028-03-15')
    expect(expirationDelaiGarantie(marche({ dateReception: '2028-02-29' }))).toBe('2029-02-28')
    expect(expirationDelaiGarantie(marche({ dateReception: null }))).toBeNull()
    expect(retenueGarantie({ montantTtcCentimes: 1_000_000, tauxPct: 5, dateReception: '2027-03-15' }).liberationLe).toBe('2028-03-15')
  })

  it('variante à confirmer : délai parti du lendemain de la réception (comme J1), rendue à côté', () => {
    const sources = { factures: FACTURES, consignations: [CONSIGNATION] }
    expect(suiviRetenueMarche(marche(), sources, '2027-11-04')).toMatchObject({ expirationLe: '2028-03-15', expirationSiDepartLendemainLe: '2028-03-16' })
    expect(suiviRetenueMarche(marche({ dateReception: '2028-02-29' }), sources, '2027-11-04')).toMatchObject({
      expirationLe: '2029-02-28',
      expirationSiDepartLendemainLe: '2029-03-01',
    })
    expect(suiviRetenueMarche(marche({ dateReception: null }), sources, '2027-11-04').expirationSiDepartLendemainLe).toBeNull()
  })
})

describe('suivi de la garantie par marché', () => {
  it('facturé, retenu, consigné, reste retenu, réglé et dû, dernier avancement ; factures dans l’ordre des dates', () => {
    const suivi = suiviRetenueMarche(marche(), { factures: FACTURES, consignations: [CONSIGNATION], regleCentimes: 9_000_000 }, '2027-11-04')
    expect(suivi).toMatchObject({
      factureIds: ['f1', 'f2', 'f3'],
      factureCentimes: 10_000_000,
      retenuCentimes: 500_000,
      consigneCentimes: 500_000,
      restitueCentimes: 0,
      restitueLe: null,
      resteRetenuCentimes: 500_000,
      regleCentimes: 9_000_000,
      duCentimes: 500_000,
      dernierAvancementPct: 100,
      expirationLe: '2028-03-15',
      etat: 'en_delai',
      anomalies: [],
    })
  })

  it('D1 : une facture d’un marché de même identifiant dans un autre syndicat est ignorée', () => {
    const etrangere = { ...facture('f9', '2027-01-01', 1_000_000, 50, 50_000), coproprieteId: 'copro-autre' }
    expect(suiviRetenueMarche(marche(), { factures: [...FACTURES, etrangere] }, '2027-11-04').factureIds).toEqual(['f1', 'f2', 'f3'])
  })

  it('états : avant réception ; en délai jusqu’au jour de l’expiration ; à libérer le lendemain ; restituée', () => {
    const sources = { factures: FACTURES, consignations: [CONSIGNATION] }
    expect(suiviRetenueMarche(marche({ dateReception: null }), sources, '2027-11-04').etat).toBe('avant_reception')
    expect(suiviRetenueMarche(marche(), sources, '2028-03-15').etat).toBe('en_delai')
    expect(suiviRetenueMarche(marche(), sources, '2028-03-16').etat).toBe('a_liberer')
    const restitution = { id: 'r1', coproprieteId: COPRO, marcheId: 'm1', le: '2028-03-20', montantCentimes: 500_000 }
    expect(suiviRetenueMarche(marche(), { ...sources, restitutions: [restitution] }, '2028-03-21')).toMatchObject({
      etat: 'restituee',
      restitueCentimes: 500_000,
      restitueLe: '2028-03-20',
      resteRetenuCentimes: 0,
      anomalies: [],
    })
    expect(suiviRetenueMarche(marche({ garantie: 'aucune', tauxRetenuePct: null }), {}, '2028-03-21').etat).toBe('sans_garantie')
  })

  it('opposition notifiée le dernier jour : retient la garantie ; le lendemain : tardive, la retenue reste à libérer', () => {
    const sources = { factures: FACTURES, consignations: [CONSIGNATION] }
    const dansLeDelai = suiviRetenueMarche(marche({ opposition: { notifieeLe: '2028-03-15', motif: 'Réserves non levées' } }), sources, '2028-04-01')
    expect(dansLeDelai.etat).toBe('opposition')
    const tardive = suiviRetenueMarche(marche({ opposition: { notifieeLe: '2028-03-16', motif: 'Réserves non levées' } }), sources, '2028-04-01')
    expect(tardive.etat).toBe('a_liberer')
    expect(codes(tardive.anomalies)).toEqual(['opposition_tardive'])
  })

  it('retenue sur un marché couvert par une caution, ou sans retenue stipulée : bloquant (art. 1er)', () => {
    const avecCaution = suiviRetenueMarche(marche({ garantie: 'caution', cautionCentimes: 500_000 }), { factures: FACTURES.slice(0, 1) }, '2027-11-04')
    expect(avecCaution.anomalies.map((a) => [a.code, a.gravite])).toContainEqual(['retenue_malgre_caution', 'bloquant'])
    const sansGarantie = suiviRetenueMarche(marche({ garantie: 'aucune', tauxRetenuePct: null }), { factures: FACTURES.slice(0, 1) }, '2027-11-04')
    expect(sansGarantie.anomalies.map((a) => [a.code, a.gravite])).toContainEqual(['retenue_non_stipulee', 'bloquant'])
  })

  it('retenue au-delà de 5 % (bloquant), écart au taux du marché, retenue ou avancement invalides', () => {
    const factures = [
      facture('a', '2026-12-01', 1_000_000, 10, 60_000),
      facture('b', '2027-01-01', 1_000_000, 40, 30_000),
      facture('c', '2027-02-01', 1_000_000, 130, 10.5),
    ]
    const suivi = suiviRetenueMarche(marche(), { factures, consignations: [{ ...CONSIGNATION, montantCentimes: 1_000_000 }] }, '2027-11-04')
    expect(suivi.anomalies.map((a) => [a.code, a.objetId, a.gravite])).toEqual([
      ['retenue_au_dela_du_plafond', 'a', 'bloquant'],
      ['ecart_taux_contractuel', 'b', 'avertissement'],
      ['retenue_invalide', 'c', 'bloquant'],
      ['avancement_invalide', 'c', 'bloquant'],
    ])
  })

  it('avancement en baisse, facturé au-delà de l’avancement ou du marché : avertissements', () => {
    const enBaisse = [facture('a', '2026-12-01', 3_000_000, 40, 150_000), facture('b', '2027-01-01', 2_000_000, 35, 100_000)]
    expect(gravites(suiviRetenueMarche(marche(), { factures: enBaisse, consignations: [CONSIGNATION] }, '2027-11-04').anomalies)).toEqual([
      ['avancement_en_baisse', 'avertissement'],
      ['facture_au_dela_de_l_avancement', 'avertissement'],
    ])
    const auDela = [...FACTURES, facture('f4', '2027-04-01', 100, 100, 5)]
    expect(gravites(suiviRetenueMarche(marche(), { factures: auDela, consignations: [{ ...CONSIGNATION, montantCentimes: 500_005 }] }, '2027-11-04').anomalies)).toEqual([
      ['facture_au_dela_du_marche', 'avertissement'],
    ])
  })

  it('consignation insuffisante (art. 1er, al. 2 et 3) ; réception non datée ; réglé au-delà du dû', () => {
    const suivi = suiviRetenueMarche(
      marche({ dateReception: null }),
      { factures: FACTURES, consignations: [{ ...CONSIGNATION, montantCentimes: 400_000 }], regleCentimes: 9_600_000 },
      '2027-11-04',
    )
    expect(codes(suivi.anomalies)).toEqual(['consignation_insuffisante', 'reception_non_datee', 'regle_au_dela_du_du'])
    expect(suivi.anomalies[0].message).toContain('art. 1er, al. 2 et 3')
    expect(suivi.duCentimes).toBe(0)
  })

  it('restitutions : au-delà du retenu (bloquant) ; anticipée (information) ; malgré opposition (avertissement)', () => {
    const r = (id: string, le: string, montantCentimes: number) => ({ id, coproprieteId: COPRO, marcheId: 'm1', le, montantCentimes })
    const sources = { factures: FACTURES, consignations: [CONSIGNATION] }
    expect(suiviRetenueMarche(marche(), { ...sources, restitutions: [r('r1', '2028-03-20', 600_000)] }, '2028-04-01').anomalies.map((a) => [a.code, a.gravite])).toEqual([
      ['restitution_au_dela_du_retenu', 'bloquant'],
    ])
    expect(gravites(suiviRetenueMarche(marche(), { ...sources, restitutions: [r('r1', '2028-03-15', 500_000)] }, '2028-04-01').anomalies)).toEqual([
      ['restitution_anticipee', 'information'],
    ])
    const opposee = marche({ opposition: { notifieeLe: '2028-03-01', motif: 'Réserves non levées' } })
    expect(gravites(suiviRetenueMarche(opposee, { ...sources, restitutions: [r('r1', '2028-04-01', 100_000)] }, '2028-04-02').anomalies)).toEqual([
      ['restitution_malgre_opposition', 'avertissement'],
    ])
  })

  it('réglé invalide : refusé', () => {
    expect(() => suiviRetenueMarche(marche(), { regleCentimes: -1 }, '2027-11-04')).toThrow(/réglé/)
  })

  it('anomalies au format du point 31 : fondement (null pour une règle de gestion) et aConfirmer (jour exact du délai)', () => {
    const factures = [facture('a', '2026-12-01', 1_000_000, 10, 60_000), facture('b', '2027-01-01', 1_000_000, 40, 30_000)]
    const [plafond, ecart] = suiviRetenueMarche(marche(), { factures, consignations: [{ ...CONSIGNATION, montantCentimes: 90_000 }] }, '2027-11-04').anomalies
    expect(plafond).toMatchObject({ code: 'retenue_au_dela_du_plafond', fondement: 'Loi n° 71-584 du 16/07/1971, art. 1er, al. 1', aConfirmer: false })
    expect(ecart).toMatchObject({ code: 'ecart_taux_contractuel', fondement: null, aConfirmer: false })
    const tardive = suiviRetenueMarche(marche({ opposition: { notifieeLe: '2028-03-16', motif: 'Réserves non levées' } }), { factures: FACTURES, consignations: [CONSIGNATION] }, '2028-04-01')
    expect(tardive.anomalies).toEqual([expect.objectContaining({ code: 'opposition_tardive', fondement: 'Loi n° 71-584 du 16/07/1971, art. 2', aConfirmer: true })])
  })
})

describe('libération de la retenue', () => {
  const sources = { factures: FACTURES, consignations: [CONSIGNATION] }
  const contexte = { id: 't-lib', date: '2028-03-16', segmentSyndicat: 'TILL', auxiliaireFournisseur: 'FACAD' }

  it('du 47200 au 401 du fournisseur (« Saisie de mouvements »), et la restitution à enregistrer', () => {
    const m = marche()
    const suivi = suiviRetenueMarche(m, sources, '2028-03-16')
    const { traitement, restitution } = ecritureLiberationRetenue({ ...contexte, marche: m, suivi, montantCentimes: 500_000 })
    expect(traitement.famille).toBe('Saisie de mouvements')
    expect(traitement.mouvements.map((x) => [x.compte, x.sens, x.montantCentimes])).toEqual([
      ['TILL.47200.FACAD.0', 'debit', 500_000],
      ['TILL.40100.FACAD.0', 'credit', 500_000],
    ])
    expect(traitement.mouvements[1].liens).toEqual({ fournisseurId: 'f-facade', travauxId: '00042' })
    expect(restitution).toEqual({ id: 't-lib:restitution', coproprieteId: COPRO, marcheId: 'm1', le: '2028-03-16', montantCentimes: 500_000, traitementId: 't-lib' })
    expect(suiviRetenueMarche(m, { ...sources, restitutions: [restitution] }, '2028-03-17').etat).toBe('restituee')
  })

  it('refusée sous opposition dans le délai, au-delà du reste retenu, ou pour un marché sans retenue', () => {
    const opposee = marche({ opposition: { notifieeLe: '2028-03-01', motif: 'Réserves non levées' } })
    expect(() =>
      ecritureLiberationRetenue({ ...contexte, marche: opposee, suivi: suiviRetenueMarche(opposee, sources, '2028-03-16'), montantCentimes: 500_000 }),
    ).toThrow(/opposition/)
    const m = marche()
    const suivi = suiviRetenueMarche(m, sources, '2028-03-16')
    expect(() => ecritureLiberationRetenue({ ...contexte, marche: m, suivi, montantCentimes: 500_001 })).toThrow(/reste retenu/)
    const caution = marche({ garantie: 'caution', cautionCentimes: 500_000 })
    expect(() => ecritureLiberationRetenue({ ...contexte, marche: caution, suivi: suiviRetenueMarche(caution, {}, '2028-03-16'), montantCentimes: 1 })).toThrow(
      /retenue stipulée/,
    )
  })
})

describe('échéance de libération pour le suivi « à faire »', () => {
  const sources = { factures: FACTURES, consignations: [CONSIGNATION] }

  it('au format ElementAFaire : famille travaux, à l’expiration du délai, clé et fiche au syndicat (D1), délai lu', () => {
    const [element] = echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi: suiviRetenueMarche(marche(), sources, '2027-11-04') }])
    expect(element).toMatchObject({
      id: 'travaux:copro-tilleuls:m1:liberation_garantie',
      famille: 'travaux',
      nature: 'liberation_garantie',
      date: '2028-03-15',
      mandatId: 'mandat-1',
      objetId: 'copro-tilleuls:00042',
      assigneId: null,
      aConfirmer: true,
    })
    expect(element.libelle).toContain('opposition motivée par lettre recommandée au plus tard ce jour')
    expect(element.libelle).toContain('loi n° 71-584, art. 2')
    expect(element.libelle).toContain('16/03/2028 si le délai part du lendemain de la réception')
  })

  it('retenue : reste à libérer, même le délai passé ; sous opposition : suivie jusqu’à la mainlevée ; rien restituée, ou sans réception', () => {
    expect(echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi: suiviRetenueMarche(marche(), sources, '2028-06-01') }])).toHaveLength(1)
    const opposee = marche({ opposition: { notifieeLe: '2028-03-01', motif: 'Réserves non levées' } })
    const [sousOpposition] = echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi: suiviRetenueMarche(opposee, sources, '2028-06-01') }])
    expect(sousOpposition.libelle).toContain('sous opposition depuis le 01/03/2028')
    const restitution = { id: 'r1', coproprieteId: COPRO, marcheId: 'm1', le: '2028-03-20', montantCentimes: 500_000 }
    const vides = [
      suiviRetenueMarche(marche(), { ...sources, restitutions: [restitution] }, '2028-06-01'),
      suiviRetenueMarche(marche({ dateReception: null }), sources, '2028-06-01'),
      suiviRetenueMarche(marche(), {}, '2027-11-04'),
    ]
    expect(echeancesLiberationGarantie(vides.map((suivi) => ({ mandatId: 'mandat-1', suivi })))).toEqual([])
  })

  it('caution : jusqu’à l’expiration seulement, libellé de la caution', () => {
    const caution = marche({ garantie: 'caution', cautionCentimes: 500_000 })
    const [element] = echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi: suiviRetenueMarche(caution, {}, '2028-03-15') }])
    expect(element.libelle).toContain('caution de')
    expect(echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi: suiviRetenueMarche(caution, {}, '2028-03-16') }])).toEqual([])
  })
})

describe('pied de l’opération : Fact. · Garantie · Réglé · Dû (tranche 32)', () => {
  const honoraires: FactureDeLOperation = { id: 'h1', coproprieteId: COPRO, travauxId: '00042', marcheId: null, date: '2027-01-15', totalTtcCentimes: 400_000 }
  const REGLEMENTS = [
    reglement('r1', 'f1', 'Enregistré', 2_850_000),
    reglement('r2', 'f2', 'Rapproché', 3_800_000),
    reglement('r3', 'h1', 'Enregistré', 400_000),
    reglement('r4', 'f3', 'Demandé', 2_850_000),
  ]

  it('par marché et au total : dû net de la garantie restante ; réglé depuis les règlements de l’opération', () => {
    const pied = garantieDeLOperation(
      operation,
      { marches: [marche()], factures: [...FACTURES.map((f) => deLOperation(f)), honoraires], consignations: [CONSIGNATION], reglements: REGLEMENTS },
      '2027-11-04',
    )
    expect(pied).toMatchObject({ coproprieteId: COPRO, travauxId: '00042', factureCentimes: 10_400_000, garantieCentimes: 500_000, regleCentimes: 7_050_000, duCentimes: 2_850_000, anomalies: [] })
    expect(pied.marches.map((s) => [s.marcheId, s.factureCentimes, s.regleCentimes, s.duCentimes])).toEqual([['m1', 10_000_000, 6_650_000, 2_850_000]])
  })

  it('D1 : factures et règlements d’un autre syndicat ignorés ; marché d’une autre opération refusé ; retenue hors marché signalée', () => {
    const etrangere: FactureDeLOperation = { ...honoraires, id: 'h9', coproprieteId: 'copro-autre' }
    const horsMarche: FactureDeLOperation = { ...honoraires, id: 'h2', totalTtcCentimes: 200_000, retenueGarantieCentimes: 10_000 }
    const pied = garantieDeLOperation(
      operation,
      {
        marches: [marche()],
        factures: [...FACTURES.map((f) => deLOperation(f)), etrangere, horsMarche],
        consignations: [CONSIGNATION],
        reglements: [reglement('r9', 'h9', 'Enregistré', 400_000, 'copro-autre')],
      },
      '2027-11-04',
    )
    expect(pied).toMatchObject({ factureCentimes: 10_200_000, garantieCentimes: 510_000, regleCentimes: 0, duCentimes: 9_690_000 })
    expect(pied.anomalies.map((a) => [a.code, a.objetId])).toEqual([['retenue_hors_marche', 'h2']])
    expect(() => garantieDeLOperation(operation, { marches: [marche({ travauxId: '00043' })] }, '2027-11-04')).toThrow(/autre opération/)
    expect(() => garantieDeLOperation(operation, { marches: [marche({ coproprieteId: 'copro-autre' })] }, '2027-11-04')).toThrow(/autre opération/)
  })
})

describe('part déductible à communiquer aux bailleurs', () => {
  const charges: ChargesCoproprietaireOperation[] = [
    { compteId: 'cp-1', chargesCentimes: 6_000_000, bailleur: true, usage: 'habitation' },
    { compteId: 'cp-2', chargesCentimes: 3_000_000, bailleur: false },
    { compteId: 'cp-3', chargesCentimes: 1_000_000, bailleur: true, usage: 'professionnel' },
  ]
  const entretien = marche({ deductionFiscaleCentimes: 4_000_000, qualificationFiscale: 'reparation_entretien' })
  const amelioration = marche({ id: 'm-isolation', deductionFiscaleCentimes: 1_000_000, qualificationFiscale: 'amelioration', tauxRetenuePct: 3 })

  it('au prorata des charges de l’opération, pour les bailleurs seulement, avec la part non déductible et la mention', () => {
    const { lignes, anomalies } = partsDeductiblesBailleurs([entretien], charges)
    expect(anomalies).toEqual([])
    expect(lignes).toEqual([
      { compteId: 'cp-1', chargesCentimes: 6_000_000, partDeductibleCentimes: 2_400_000, partNonDeductibleCentimes: 3_600_000, aVerifier: [], mention: MENTION_PART_DEDUCTIBLE },
      { compteId: 'cp-3', chargesCentimes: 1_000_000, partDeductibleCentimes: 400_000, partNonDeductibleCentimes: 600_000, aVerifier: [], mention: MENTION_PART_DEDUCTIBLE },
    ])
    expect(MENTION_PART_DEDUCTIBLE).toContain("à apprécier par le copropriétaire selon son régime d'imposition")
  })

  it('amélioration : écartée pour un lot professionnel (b bis), signalée sans usage renseigné (b)', () => {
    const { lignes } = partsDeductiblesBailleurs([entretien, amelioration], [...charges.slice(0, 2), { ...charges[2] }, { compteId: 'cp-4', chargesCentimes: 0, bailleur: true }])
    expect(lignes.map((l) => [l.compteId, l.partDeductibleCentimes])).toEqual([
      ['cp-1', 3_000_000],
      ['cp-3', 400_000],
      ['cp-4', 0],
    ])
    expect(lignes[1].aVerifier[0]).toContain('b bis')
    const sansUsage = partsDeductiblesBailleurs([amelioration], [{ compteId: 'cp-5', chargesCentimes: 1_000_000, bailleur: true }]).lignes[0]
    expect(sansUsage.partDeductibleCentimes).toBe(1_000_000)
    expect(sansUsage.aVerifier[0]).toContain("usage du lot non renseigné ; le b vise les locaux d'habitation")
  })

  it('construction, reconstruction ou agrandissement : déduction écartée et signalée ; au-delà des charges ou plusieurs opérations : refusé', () => {
    const construction = marche({ id: 'm-extension', deductionFiscaleCentimes: 500_000, qualificationFiscale: 'construction_reconstruction_agrandissement' })
    const { lignes, anomalies } = partsDeductiblesBailleurs([construction], charges)
    expect(lignes).toEqual([])
    expect(anomalies.map((a) => [a.code, a.objetId])).toEqual([['deduction_sur_construction', 'm-extension']])
    expect(() => partsDeductiblesBailleurs([entretien], [{ compteId: 'cp-1', chargesCentimes: 100, bailleur: true }])).toThrow(/au-delà des charges/)
    expect(() => partsDeductiblesBailleurs([entretien, marche({ id: 'm-autre', travauxId: '00043' })], charges)).toThrow(/une seule opération/)
  })

  it('la part d’un bailleur ne dépasse jamais ses charges, et aucun centime déductible n’est perdu (répartition unique)', () => {
    const a = marche({ id: 'a', montantTtcCentimes: 1, deductionFiscaleCentimes: 1, qualificationFiscale: 'reparation_entretien' })
    const b = marche({ id: 'b', montantTtcCentimes: 1, deductionFiscaleCentimes: 1, qualificationFiscale: 'reparation_entretien' })
    const { lignes } = partsDeductiblesBailleurs(
      [a, b],
      [
        { compteId: 'x', chargesCentimes: 1, bailleur: true },
        { compteId: 'y', chargesCentimes: 1, bailleur: true },
      ],
    )
    expect(lignes.map((l) => [l.partDeductibleCentimes, l.partNonDeductibleCentimes])).toEqual([
      [1, 0],
      [1, 0],
    ])
  })
})

describe('en-tête : sources, textes lus, questions ouvertes', () => {
  const { texte } = enTeteDuModule('travaux-retenue-garantie')

  it('porte les trois marqueurs et les sources Gestéam (tranches 32 et 36)', () => {
    for (const marqueur of ['🟢 lu', '🔵 Déduit', '🔴 Non établi']) expect(texte).toContain(marqueur)
    expect(texte).toContain('« Garantie (taux, montant, restituée), Déduction fiscale € »')
    expect(texte).toContain('« Travaux (opération) ; Avancement %, Retenue de garantie € »')
  })

  it('cite les textes lus : loi n° 71-584, art. 1er et 2 ; arrêté, art. 7 et 10 ; CGI art. 31', () => {
    expect(texte).toContain('« A l\'expiration du délai d\'une année à compter de la date de réception, faite avec ou sans réserve, des travaux »')
    expect(texte).toContain('amputés d\'une retenue égale au plus à 5 p. 100 de leur montant')
    expect(texte).toContain('472 « Compte en attente d\'imputation créditeur »')
    expect(texte).toContain('« Le compte 47 "Compte d\'attente" doit être soldé à la fin de l\'exercice ou à défaut justifié ligne à ligne »')
    expect(texte).toContain('« a) Les dépenses de réparation et d\'entretien effectivement supportées par le propriétaire »')
    expect(texte).toContain('Non trouvé dans l\'art. 31 : la retenue de garantie')
  })

  it('pose les questions ouvertes mot pour mot', () => {
    expect(texte).toContain('« Où Gestéam porte-t-il la retenue : 472xx, 47150 "Compte d\'attente_", subdivision du 401 (arrêté, art. 8) ? »')
    expect(texte).toContain('Un texte l\'impose-t-il au syndic ? »')
    expect(texte).toContain('« Une facture soldée hors retenue est-elle "Réglée" ou "Rgt. partiel" ? »')
    expect(texte).toContain('« "Restituée", sur la ligne de marché Gestéam, est-elle une case, une date ou un montant ? »')
    expect(texte).toContain('« Quelle famille de traitement porte le reclassement 47200 → 401 à la libération ? »')
  })
})

describe('relecture 1 — caution « pour un montant égal » à la retenue stipulée (art. 1er, al. 4)', () => {
  it('la caution suppose une retenue stipulée : taux exigé, entre 0 et 5 %', () => {
    expect(marche({ garantie: 'caution', cautionCentimes: 500_000 })).toMatchObject({ tauxRetenuePct: 5, cautionCentimes: 500_000 })
    expect(() => marche({ garantie: 'caution', tauxRetenuePct: null, cautionCentimes: 500_000 })).toThrow(/taux stipulé/)
    expect(() => marche({ garantie: 'caution', tauxRetenuePct: 6, cautionCentimes: 500_000 })).toThrow(/5 % au plus/)
  })

  it('caution inférieure à la retenue stipulée : avertissement, la retenue stipulée peut être pratiquée', () => {
    const faible = marche({ garantie: 'caution', cautionCentimes: 1 })
    const suivi = suiviRetenueMarche(faible, { factures: [facture('f1', '2027-01-10', 3_000_000, 30, 150_000)], consignations: [consignation('c1', '2027-03-25', 150_000)] }, '2027-11-04')
    expect(gravites(suivi.anomalies)).toEqual([['caution_insuffisante', 'avertissement']])
    expect(suivi.anomalies[0]).toMatchObject({ fondement: 'Loi n° 71-584 du 16/07/1971, art. 1er, al. 4' })
    expect(suivi.anomalies[0].message).toContain('pour un montant égal')
    expect(enTeteFactureDuMarche(faible, { totalTtcCentimes: 3_000_000, avancementPct: 30 }).retenueGarantie?.montantCentimes).toBe(150_000)
  })

  it('caution au moins égale à la retenue stipulée : la retenue « n’est pas pratiquée » (bloquant)', () => {
    const suffisante = marche({ garantie: 'caution', cautionCentimes: 500_000 })
    const suivi = suiviRetenueMarche(suffisante, { factures: [facture('f1', '2027-01-10', 3_000_000, 30, 150_000)] }, '2027-11-04')
    expect(gravites(suivi.anomalies)).toContainEqual(['retenue_malgre_caution', 'bloquant'])
    expect(gravites(suivi.anomalies)).not.toContainEqual(['caution_insuffisante', 'avertissement'])
    expect(() => enTeteFactureDuMarche(suffisante, { totalTtcCentimes: 3_000_000, avancementPct: 30, retenueCentimes: 1 })).toThrow(/pour un montant égal/)
  })
})

describe('relecture 1 — opposition : mainlevée (art. 2 : « même en l’absence de mainlevée »)', () => {
  const levee = { ...OPPOSITION, mainlevee: { le: '2028-06-15', origine: 'amiable' as const } }

  it('saisie : datée, au plus tôt le jour de l’opposition, origine connue', () => {
    expect(marche({ opposition: levee }).opposition).toEqual(levee)
    expect(() => marche({ opposition: { ...OPPOSITION, mainlevee: { le: '2028-02-01', origine: 'amiable' } } })).toThrow(/mainlevée/)
    expect(() => marche({ opposition: { ...OPPOSITION, mainlevee: { le: '2028-06-15', origine: 'orale' as never } } })).toThrow(/mainlevée/)
  })

  it('l’opposition retient la garantie jusqu’à la mainlevée, puis la retenue est à libérer et la libération admise', () => {
    const m = marche({ opposition: levee })
    const sources = { factures: RETENUE_500, consignations: [consignation('c1', '2027-03-25', 500_000)] }
    expect(suiviRetenueMarche(m, sources, '2028-06-14').etat).toBe('opposition')
    const apres = suiviRetenueMarche(m, sources, '2028-06-15')
    expect(apres.etat).toBe('a_liberer')
    const contexte = { id: 't-lib', segmentSyndicat: 'TILL', auxiliaireFournisseur: 'FACAD', marche: m, suivi: apres, montantCentimes: 500_000 }
    expect(() => ecritureLiberationRetenue({ ...contexte, date: '2028-06-10' })).toThrow(/opposition/)
    expect(ecritureLiberationRetenue({ ...contexte, date: '2028-06-15' }).restitution.montantCentimes).toBe(500_000)
    const [element] = echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi: apres }])
    expect(element.libelle).toContain('à libérer')
  })

  it('une restitution postérieure à la mainlevée n’est pas « malgré l’opposition »', () => {
    const m = marche({ opposition: levee })
    const suivi = suiviRetenueMarche(m, { factures: RETENUE_500, consignations: [consignation('c1', '2027-03-25', 500_000)], restitutions: [restitution('r1', '2028-07-01', 500_000)] }, '2028-07-02')
    expect(suivi.anomalies).toEqual([])
    expect(suivi.etat).toBe('restituee')
  })

  it('sous opposition sans mainlevée, la retenue reste au suivi « à faire » jusqu’à la mainlevée', () => {
    const m = marche({ opposition: OPPOSITION })
    const suivi = suiviRetenueMarche(m, { factures: RETENUE_500, consignations: [consignation('c1', '2027-03-25', 500_000)] }, '2031-01-01')
    expect(suivi.etat).toBe('opposition')
    const [element] = echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi }])
    expect(element).toMatchObject({ id: 'travaux:copro-tilleuls:m1:liberation_garantie', date: '2028-03-15', aConfirmer: true })
    expect(element.libelle).toContain('sous opposition depuis le 01/03/2028')
    expect(element.libelle).toContain('mainlevée')
  })
})

describe('relecture 1 — opposition notifiée avant la réception : saisie admise, signalée (🔵, question 🔴)', () => {
  it('sans réception datée, ou notifiée avant la réception : avertissement à confirmer, pas une exception', () => {
    const sansReception = suiviRetenueMarche(marche({ dateReception: null, opposition: OPPOSITION }), { factures: RETENUE_500, consignations: [consignation('c1', '2027-03-25', 500_000)] }, '2027-11-04')
    expect(gravites(sansReception.anomalies)).toEqual([
      ['reception_non_datee', 'information'],
      ['opposition_avant_reception', 'avertissement'],
    ])
    const signalee = sansReception.anomalies[1]
    expect(signalee).toMatchObject({ aConfirmer: true, fondement: 'Loi n° 71-584 du 16/07/1971, art. 2' })
    expect(signalee.message).not.toContain("le délai d'un an court de la réception (art. 2)")
    expect(signalee.message).toContain('ne fixe aucun point de départ')
    const avant = marche({ opposition: { ...OPPOSITION, notifieeLe: '2027-03-01' } })
    const suivi = suiviRetenueMarche(avant, { factures: RETENUE_500, consignations: [consignation('c1', '2027-03-25', 500_000)] }, '2027-11-04')
    expect(suivi.etat).toBe('opposition')
    expect(gravites(suivi.anomalies)).toEqual([['opposition_avant_reception', 'avertissement']])
  })

  it('la règle est déduite et la question posée', () => {
    const { texte } = enTeteDuModule('travaux-retenue-garantie')
    expect(texte).toContain('« Une opposition notifiée avant la réception vaut-elle pour l\'art. 2 ? »')
    expect(texte).not.toContain('jamais avant la réception')
  })
})

describe('relecture 1 — états de la garantie : rien à libérer', () => {
  it('caution après l’expiration, sans opposition : libérée de plein droit (art. 2)', () => {
    const caution = marche({ garantie: 'caution', cautionCentimes: 500_000 })
    expect(suiviRetenueMarche(caution, {}, '2028-03-15').etat).toBe('en_delai')
    expect(suiviRetenueMarche(caution, {}, '2028-03-16').etat).toBe('liberee')
    expect(suiviRetenueMarche(caution, {}, '2035-01-01').etat).toBe('liberee')
  })

  it('retenue stipulée sans rien de retenu : ni en délai ni à libérer', () => {
    expect(suiviRetenueMarche(marche(), {}, '2028-06-01').etat).toBe('sans_retenue')
    expect(suiviRetenueMarche(marche(), {}, '2027-11-04').etat).toBe('sans_retenue')
  })
})

describe('relecture 1 — restitution antérieure à l’opposition : mainlevée anticipée, pas « malgré l’opposition »', () => {
  it('restitution avant la notification : information ; le jour même ou après : avertissement', () => {
    const m = marche({ opposition: OPPOSITION })
    const sources = { factures: RETENUE_500, consignations: [consignation('c1', '2027-03-25', 500_000)] }
    const avant = suiviRetenueMarche(m, { ...sources, restitutions: [restitution('r1', '2027-06-01', 20_000), restitution('r2', '2028-02-01', 20_000)] }, '2028-04-01')
    expect(gravites(avant.anomalies)).toEqual([
      ['restitution_anticipee', 'information'],
      ['restitution_anticipee', 'information'],
    ])
    const memeJour = suiviRetenueMarche(m, { ...sources, restitutions: [restitution('r3', '2028-03-01', 20_000)] }, '2028-04-01')
    expect(gravites(memeJour.anomalies)).toEqual([['restitution_malgre_opposition', 'avertissement']])
  })
})

describe('relecture 1 — arrondis en entiers : retenue au taux et avancement', () => {
  it('le demi-centime monte toujours, quel que soit le taux (calcul entier)', () => {
    expect(retenueAuTaux(1_234_500, 4.1)).toBe(50_615)
    expect(retenueAuTaux(100_500, 4.1)).toBe(4_121)
    expect(retenueAuTaux(1_500, 4.1)).toBe(62)
    expect(retenueAuTaux(1_500, 4.5)).toBe(68)
    expect(retenueGarantie({ montantTtcCentimes: 1_500, tauxPct: 4.1, dateReception: null }).retenueCentimes).toBe(62)
  })

  it('une retenue au demi-centime supérieur n’est pas un écart au taux du marché', () => {
    const m = marche({ montantTtcCentimes: 1_500, tauxRetenuePct: 4.1 })
    const suivi = suiviRetenueMarche(m, { factures: [facture('f62', '2027-01-10', 1_500, 100, 62)], consignations: [consignation('c1', '2027-03-25', 62)] }, '2027-11-04')
    expect(suivi.anomalies).toEqual([])
  })

  it('taux à plus de deux décimales : refusé', () => {
    expect(() => marche({ tauxRetenuePct: 4.125 })).toThrow(/deux décimales/)
    expect(() => retenueGarantie({ montantTtcCentimes: 1_500, tauxPct: 4.125, dateReception: null })).toThrow(/deux décimales/)
  })

  it('facturé égal à l’avancement décimal déclaré : pas au-delà ; avancement à plus de deux décimales : invalide', () => {
    const cas: [number, number, number][] = [
      [1_000_000, 333_000, 33.3],
      [1_000_000, 164_000, 16.4],
      [1_000_000, 82_000, 8.2],
      [1_000_000, 41_000, 4.1],
      [1_311_000, 166_497, 12.7],
    ]
    for (const [montantTtcCentimes, facturee, avancement] of cas) {
      const m = marche({ montantTtcCentimes, garantie: 'aucune', tauxRetenuePct: null })
      expect(suiviRetenueMarche(m, { factures: [facture('f', '2027-01-10', facturee, avancement, null)] }, '2027-11-04').anomalies).toEqual([])
    }
    const m = marche({ garantie: 'aucune', tauxRetenuePct: null })
    expect(gravites(suiviRetenueMarche(m, { factures: [facture('f', '2027-01-10', 100_000, 33.333, null)] }, '2027-11-04').anomalies)).toEqual([['avancement_invalide', 'bloquant']])
    expect(controlerEnTeteFactureTravaux(100_000, { avancementPct: 33.333 }).map((a) => a.code)).toEqual(['avancement_invalide'])
    expect(controlerEnTeteFactureTravaux(100_000, { avancementPct: 33.33 })).toEqual([])
  })
})

describe('relecture 1 — facture sans retenue sur un marché à retenue stipulée', () => {
  it('retenue nulle ou absente : avertissement (paiement non garanti) ; rien sous caution suffisante ni sans garantie', () => {
    const sources = (retenue: number | null) => ({ factures: [facture('f0', '2027-01-10', 1_000_000, 10, retenue)] })
    for (const retenue of [0, null]) {
      const suivi = suiviRetenueMarche(marche(), sources(retenue), '2027-11-04')
      expect(gravites(suivi.anomalies)).toEqual([['retenue_non_pratiquee', 'avertissement']])
      expect(suivi.anomalies[0].message).toContain('500,00')
    }
    expect(suiviRetenueMarche(marche({ garantie: 'caution', cautionCentimes: 500_000 }), sources(0), '2027-11-04').anomalies).toEqual([])
    expect(suiviRetenueMarche(marche({ garantie: 'aucune', tauxRetenuePct: null }), sources(0), '2027-11-04').anomalies).toEqual([])
  })
})

describe('relecture 1 — retenue invalide : signalée, hors des totaux', () => {
  const factures = [
    facture('a', '2027-01-01', 1_000_000, 10, 50_000),
    facture('b', '2027-02-01', 1_000_000, 20, 10.5),
    facture('c', '2027-03-01', 1_000_000, 30, -40_000),
  ]

  it('retenu, reste retenu et dû en centimes entiers, sans la retenue invalide ; la consignation se compare au retenu valide', () => {
    const suivi = suiviRetenueMarche(marche(), { factures, consignations: [consignation('c1', '2027-03-25', 20_000)] }, '2027-11-04')
    expect(suivi).toMatchObject({ retenuCentimes: 50_000, resteRetenuCentimes: 50_000, duCentimes: 2_950_000 })
    expect(gravites(suivi.anomalies)).toEqual([
      ['retenue_invalide', 'bloquant'],
      ['retenue_invalide', 'bloquant'],
      ['consignation_insuffisante', 'avertissement'],
    ])
  })

  it('pied de l’opération : garantie en centimes entiers ; retenue invalide hors marché signalée et écartée', () => {
    const horsMarche = { id: 'h1', coproprieteId: COPRO, travauxId: '00042', marcheId: null, date: '2027-01-15', totalTtcCentimes: 400_000, retenueGarantieCentimes: 0.5 }
    const pied = garantieDeLOperation(operation, { marches: [marche()], factures: [...factures.map((f) => ({ ...f, travauxId: '00042' })), horsMarche], consignations: [consignation('c1', '2027-03-25', 50_000)] }, '2027-11-04')
    expect(pied.garantieCentimes).toBe(50_000)
    expect(pied.anomalies.filter((a) => a.objetId === 'h1').map((a) => [a.code, a.gravite])).toEqual([['retenue_invalide', 'bloquant']])
  })
})

describe('relecture 1 — parts déductibles : une seule répartition, aucun centime perdu', () => {
  const entretien = (id: string, montant: number) => marche({ id, montantTtcCentimes: montant, deductionFiscaleCentimes: montant, qualificationFiscale: 'reparation_entretien' })

  it('tout déductible : chaque bailleur a toutes ses charges en part déductible, la somme égale la déduction', () => {
    const { lignes } = partsDeductiblesBailleurs(
      [entretien('a', 500_000), entretien('b', 500_000)],
      [
        { compteId: 'c1', chargesCentimes: 333_334, bailleur: true },
        { compteId: 'c2', chargesCentimes: 333_333, bailleur: true },
        { compteId: 'c3', chargesCentimes: 333_333, bailleur: true },
      ],
    )
    expect(lignes.map((l) => [l.compteId, l.partDeductibleCentimes, l.partNonDeductibleCentimes])).toEqual([
      ['c1', 333_334, 0],
      ['c2', 333_333, 0],
      ['c3', 333_333, 0],
    ])
  })

  it('le centime restant ne s’accumule pas sur le même compte, marché après marché', () => {
    const marches = ['a', 'b', 'c', 'd'].map((id) => entretien(id, 100_000))
    const charges = ['x', 'y', 'z'].map((compteId) => ({ compteId, chargesCentimes: 1_000_000, bailleur: true }))
    expect(partsDeductiblesBailleurs(marches, charges).lignes.map((l) => l.partDeductibleCentimes)).toEqual([133_334, 133_333, 133_333])
  })

  it('deux marchés d’un centime, deux bailleurs d’un centime de charges : un centime déductible chacun', () => {
    const { lignes } = partsDeductiblesBailleurs(
      [entretien('a', 1), entretien('b', 1)],
      [
        { compteId: 'x', chargesCentimes: 1, bailleur: true },
        { compteId: 'y', chargesCentimes: 1, bailleur: true },
      ],
    )
    expect(lignes.map((l) => [l.partDeductibleCentimes, l.partNonDeductibleCentimes])).toEqual([
      [1, 0],
      [1, 0],
    ])
  })
})

describe('relecture 1 — retour après rejet d’une facture dont le reste dû est net de la retenue (statuts-facture.ts, J9)', () => {
  const reglee: FactureAPayer = {
    id: 'f30',
    prestataireId: 'f-facade',
    mode: 'Virement',
    statutSaisie: 'Rgt. partiel',
    comptabilisee: true,
    statutReglement: 'Réglée',
    priorite: 5,
    echeance: '2027-01-10',
    resteDuCentimes: echeanceReglement({ dateFacture: '2026-12-01', joursEcheance: 30, totalTtcCentimes: 3_000_000, acomptesCentimes: 2_850_000, retenueGarantieCentimes: 150_000 }, '2027-02-01').resteDuCentimes,
  }
  const rejet = { reglementId: 'r-1', le: '2027-02-05', motif: 'AC04 — compte clos', montantCentimes: 2_850_000 }

  it('total net de la retenue : plus rien de réglé après le rejet, « Enregistrée » ; un rejet au-delà du virement refusé', () => {
    const base = baseRetourApresRejet({ totalTtcCentimes: 3_000_000, retenueGarantieCentimes: 150_000 })
    expect(base).toEqual({ totalTtcCentimes: 2_850_000 })
    expect(retourFactureApresRejet(reglee, rejet, base)).toMatchObject({ statutSaisie: 'Enregistrée', resteDuCentimes: 2_850_000, statutReglement: 'Bon à payer' })
    expect(() => retourFactureApresRejet(reglee, { ...rejet, montantCentimes: 3_000_000 }, base)).toThrow(/plus que le réglé/)
    expect(() => baseRetourApresRejet({ totalTtcCentimes: 3_000_000, retenueGarantieCentimes: 3_000_001 })).toThrow(/retenue/)
  })
})

describe('relecture 1 — commentaires : le dépassement d’un centime ne tient pas à la parité du TTC', () => {
  it('à 5 %, l’arrondi est borné au plafond pour un TTC pair comme impair (TTC modulo 20 ≥ 10)', () => {
    for (const ttc of [1_000_010, 1_000_011, 1_000_012, 1_000_019]) expect(retenueAuTaux(ttc, 5)).toBe(50_000)
    expect(retenueAuTaux(1_000_009, 5)).toBe(50_000)
  })

  it('aucun commentaire ne parle d’un « TTC impair »', () => {
    for (const fichier of ['facture-ventilee', 'travaux-operations', 'travaux-retenue-garantie']) {
      const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', `${fichier}.ts`), 'utf8')
      expect(source).not.toContain('TTC impair')
    }
  })
})

describe('relecture 2 — constat 1 : opposition notifiée sans réception datée, tenue pour notifiée dans le délai', () => {
  const opposition = { notifieeLe: '2027-01-20', motif: 'Malfaçons' }
  const sansReception = marche({ dateReception: null, opposition })
  const sources = { factures: RETENUE_500, consignations: [consignation('c1', '2027-03-25', 500_000)] }

  it('libération refusée tant que l’opposition n’a pas de mainlevée, admise à la mainlevée', () => {
    const suivi = suiviRetenueMarche(sansReception, sources, '2027-06-01')
    expect(() => ecritureLiberationRetenue({ ...CONTEXTE, date: '2027-06-01', marche: sansReception, suivi, montantCentimes: 500_000 })).toThrow(/opposition/)
    const levee = marche({ dateReception: null, opposition: { ...opposition, mainlevee: { le: '2027-05-15', origine: 'amiable' } } })
    const suiviLevee = suiviRetenueMarche(levee, sources, '2027-06-01')
    expect(ecritureLiberationRetenue({ ...CONTEXTE, date: '2027-06-01', marche: levee, suivi: suiviLevee, montantCentimes: 500_000 }).restitution.montantCentimes).toBe(500_000)
  })

  it('restitution sous l’opposition : « malgré l’opposition » (avertissement), que la réception soit datée ou non', () => {
    const restitutions = [restitution('r1', '2027-05-01', 100_000)]
    const sansDate = suiviRetenueMarche(sansReception, { ...sources, restitutions }, '2027-06-01')
    expect(gravites(sansDate.anomalies)).toContainEqual(['restitution_malgre_opposition', 'avertissement'])
    expect(codes(sansDate.anomalies)).not.toContain('restitution_anticipee')
    const datee = suiviRetenueMarche(marche({ opposition }), { ...sources, restitutions }, '2027-06-01')
    expect(gravites(datee.anomalies)).toContainEqual(['restitution_malgre_opposition', 'avertissement'])
    expect(codes(datee.anomalies)).not.toContain('restitution_anticipee')
  })

  it('restitution antérieure à la notification : mainlevée anticipée (information), comme avec une réception datée', () => {
    const suivi = suiviRetenueMarche(sansReception, { ...sources, restitutions: [restitution('r0', '2027-01-15', 100_000)] }, '2027-06-01')
    expect(gravites(suivi.anomalies)).toContainEqual(['restitution_anticipee', 'information'])
    expect(codes(suivi.anomalies)).not.toContain('restitution_malgre_opposition')
  })

  it('état : sous opposition dès la notification, réception datée ou non ; avant elle, avant réception', () => {
    expect(suiviRetenueMarche(sansReception, sources, '2027-06-01').etat).toBe('opposition')
    expect(suiviRetenueMarche(sansReception, sources, '2027-01-19').etat).toBe('avant_reception')
    expect(suiviRetenueMarche(marche({ opposition }), sources, '2027-06-01').etat).toBe('opposition')
  })

  it('l’en-tête dit la règle que le code applique, sans réception datée comme avant elle', () => {
    const { texte } = enTeteDuModule('travaux-retenue-garantie')
    expect(texte).toContain("sans réception datée, l'opposition est dans le délai")
  })
})

describe('relecture 2 — constat 2 : caution fournie après des retenues pratiquées (art. 1er, al. 4)', () => {
  const factures = [facture('f1', '2027-01-10', 3_000_000, 30, 150_000)]
  const consignations = [consignation('c1', '2027-03-25', 150_000)]
  const substituee = marche({ garantie: 'caution', cautionCentimes: 500_000, cautionFournieLe: '2027-06-01' })

  it('la retenue pratiquée avant la caution n’est pas requalifiée « malgré la caution »', () => {
    const suivi = suiviRetenueMarche(substituee, { factures, consignations }, '2028-06-01')
    expect(suivi.anomalies).toEqual([])
    expect(suivi).toMatchObject({ etat: 'a_liberer', retenuCentimes: 150_000, resteRetenuCentimes: 150_000 })
  })

  it('une retenue sur une facture datée du jour de la caution ou après : bloquant', () => {
    const apres = [...factures, facture('f2', '2027-06-01', 3_000_000, 60, 150_000)]
    const suivi = suiviRetenueMarche(substituee, { factures: apres, consignations: [consignation('c1', '2027-03-25', 300_000)] }, '2028-06-01')
    expect(suivi.anomalies.map((a) => [a.code, a.objetId, a.gravite])).toEqual([['retenue_malgre_caution', 'f2', 'bloquant']])
    expect(suivi.anomalies[0].message).toContain('fournie le 01/06/2027')
  })

  it('la retenue « à libérer » se libère : écriture 47200 → 401, puis rien ne reste retenu', () => {
    const suivi = suiviRetenueMarche(substituee, { factures, consignations }, '2028-06-01')
    const [element] = echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi }])
    expect(element.libelle).toContain(`retenue de ${eur(150_000)} à libérer`)
    const { traitement, restitution: rendue } = ecritureLiberationRetenue({ ...CONTEXTE, date: '2028-06-01', marche: substituee, suivi, montantCentimes: 150_000 })
    expect(traitement.mouvements.map((x) => [x.compte, x.sens, x.montantCentimes])).toEqual([
      ['TILL.47200.FACAD.0', 'debit', 150_000],
      ['TILL.40100.FACAD.0', 'credit', 150_000],
    ])
    const apres = suiviRetenueMarche(substituee, { factures, consignations, restitutions: [rendue] }, '2028-06-02')
    expect(apres).toMatchObject({ resteRetenuCentimes: 0, etat: 'liberee', anomalies: [] })
  })

  it('caution sans date de fourniture : réputée fournie dès le marché ; la retenue pratiquée malgré elle reste libérable', () => {
    const depuisLeMarche = marche({ garantie: 'caution', cautionCentimes: 500_000 })
    const suivi = suiviRetenueMarche(depuisLeMarche, { factures, consignations }, '2028-06-01')
    expect(gravites(suivi.anomalies)).toEqual([['retenue_malgre_caution', 'bloquant']])
    expect(ecritureLiberationRetenue({ ...CONTEXTE, date: '2028-06-01', marche: depuisLeMarche, suivi, montantCentimes: 150_000 }).restitution.montantCentimes).toBe(150_000)
  })

  it('date de la caution : valide, sous caution seulement', () => {
    expect(substituee.cautionFournieLe).toBe('2027-06-01')
    expect(marche({ garantie: 'caution', cautionCentimes: 500_000 }).cautionFournieLe).toBeNull()
    expect(() => marche({ cautionFournieLe: '2027-06-01' })).toThrow(/date de caution sans caution/)
    expect(() => marche({ garantie: 'caution', cautionCentimes: 500_000, cautionFournieLe: '2027-13-01' })).toThrow(/date invalide/)
  })

  it('en-tête d’une facture datée : retenue au taux du marché avant la caution, aucune à partir de sa date', () => {
    expect(enTeteFactureDuMarche(substituee, { totalTtcCentimes: 3_000_000, avancementPct: 30, date: '2027-01-10' }).retenueGarantie?.montantCentimes).toBe(150_000)
    expect(enTeteFactureDuMarche(substituee, { totalTtcCentimes: 3_000_000, avancementPct: 60, date: '2027-06-01' }).retenueGarantie).toBeNull()
    expect(enTeteFactureDuMarche(substituee, { totalTtcCentimes: 3_000_000, avancementPct: 60 }).retenueGarantie).toBeNull()
  })
})

describe('relecture 2 — constat 3 : restitutions et consignations invalides, signalées et hors des totaux', () => {
  const sources = { factures: RETENUE_500, consignations: [consignation('c1', '2027-03-25', 500_000)] }

  it('restitution négative : bloquante, ni restituée, ni datée, ni au dû', () => {
    const suivi = suiviRetenueMarche(marche(), { ...sources, restitutions: [restitution('r-neg', '2028-04-01', -100_000)] }, '2028-04-02')
    expect(suivi).toMatchObject({ restitueCentimes: 0, restitueLe: null, resteRetenuCentimes: 500_000, duCentimes: 9_500_000 })
    expect(suivi.anomalies.map((a) => [a.code, a.objetId, a.gravite])).toEqual([['restitution_invalide', 'r-neg', 'bloquant']])
  })

  it('une restitution négative ne masque plus un dépassement du retenu', () => {
    const restitutions = [restitution('r1', '2028-04-01', 600_000), restitution('r2', '2028-04-02', -100_000)]
    const suivi = suiviRetenueMarche(marche(), { ...sources, restitutions }, '2028-04-03')
    expect(suivi).toMatchObject({ restitueCentimes: 600_000, resteRetenuCentimes: 0 })
    expect(gravites(suivi.anomalies)).toEqual([
      ['restitution_invalide', 'bloquant'],
      ['restitution_au_dela_du_retenu', 'bloquant'],
    ])
  })

  it('restitution d’un demi-centime : centimes entiers partout', () => {
    const suivi = suiviRetenueMarche(marche(), { ...sources, restitutions: [restitution('r-demi', '2028-04-01', 0.5)] }, '2028-04-02')
    expect(suivi).toMatchObject({ restitueCentimes: 0, resteRetenuCentimes: 500_000 })
    expect(codes(suivi.anomalies)).toEqual(['restitution_invalide'])
    const [element] = echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi }])
    expect(element.libelle).toContain(`retenue de ${eur(500_000)} à libérer`)
  })

  it('restitution nulle : invalide (montant strictement positif)', () => {
    const suivi = suiviRetenueMarche(marche(), { ...sources, restitutions: [restitution('r-zero', '2028-04-01', 0)] }, '2028-04-02')
    expect(codes(suivi.anomalies)).toEqual(['restitution_invalide'])
  })

  it('consignation non entière ou négative : bloquante, hors du consigné', () => {
    const demi = suiviRetenueMarche(marche(), { factures: RETENUE_500, consignations: [consignation('c-demi', '2027-03-25', 500_000.5)] }, '2027-11-04')
    expect(demi.consigneCentimes).toBe(0)
    expect(demi.anomalies.map((a) => [a.code, a.objetId, a.gravite])).toEqual([
      ['consignation_invalide', 'c-demi', 'bloquant'],
      ['consignation_insuffisante', 'm1', 'avertissement'],
    ])
    const negative = suiviRetenueMarche(marche(), { factures: RETENUE_500, consignations: [consignation('c-neg', '2027-03-25', -1), consignation('c1', '2027-03-25', 500_000)] }, '2027-11-04')
    expect(negative.consigneCentimes).toBe(500_000)
    expect(gravites(negative.anomalies)).toEqual([['consignation_invalide', 'bloquant']])
  })

  it('pied de l’opération : garantie et dû en centimes entiers malgré une restitution invalide', () => {
    const pied = garantieDeLOperation(
      operation,
      {
        marches: [marche()],
        factures: RETENUE_500.map((f) => ({ ...f, travauxId: '00042' })),
        consignations: [consignation('c1', '2027-03-25', 500_000)],
        restitutions: [restitution('r-demi', '2028-04-01', 0.5), restitution('r-neg', '2028-04-01', -100_000)],
      },
      '2028-04-02',
    )
    expect(pied).toMatchObject({ garantieCentimes: 500_000, duCentimes: 9_500_000 })
    expect(codes(pied.anomalies)).toEqual(['restitution_invalide', 'restitution_invalide'])
  })
})

describe('relecture 3 — constat 1 : TTC des factures du marché contrôlé', () => {
  const valide = facture('a', '2027-01-10', 3_000_000, 30, 150_000)
  const consignations = [consignation('c1', '2027-01-20', 150_000)]

  it.each([
    ['demi-centime', 3_000_000.5],
    ['négatif', -3_000_000],
    ['NaN', Number.NaN],
    ['nul', 0],
  ])('TTC %s : facture invalide, bloquante, écartée du facturé, du dû et de la liste', (_cas, ttc) => {
    const suivi = suiviRetenueMarche(marche(), { factures: [valide, facture('b', '2027-01-10', ttc, null, 0)], consignations }, '2027-06-01')
    expect(suivi).toMatchObject({ factureIds: ['a'], factureCentimes: 3_000_000, retenuCentimes: 150_000, duCentimes: 2_850_000 })
    expect(parObjet(suivi.anomalies)).toEqual([['facture_invalide', 'b', 'bloquant']])
    expect(suivi.anomalies[0].message).toContain('TTC')
  })

  it('la retenue et l’avancement d’une facture au TTC invalide n’entrent ni au retenu ni au dernier avancement', () => {
    const suivi = suiviRetenueMarche(marche(), { factures: [valide, facture('b', '2027-02-10', Number.NaN, 90, 150_000)], consignations }, '2027-06-01')
    expect(suivi).toMatchObject({ retenuCentimes: 150_000, resteRetenuCentimes: 150_000, dernierAvancementPct: 30 })
    expect(codes(suivi.anomalies)).toEqual(['facture_invalide'])
  })

  it('pied de l’opération : facture hors marché au TTC invalide signalée une fois, hors du facturé et du dû', () => {
    const pied = garantieDeLOperation(
      operation,
      {
        marches: [marche()],
        factures: [deLOperation(valide), deLOperation(facture('h', '2027-02-01', 1_000_000.5, null, null), null)],
        consignations,
      },
      '2027-06-01',
    )
    expect(pied).toMatchObject({ factureCentimes: 3_000_000, garantieCentimes: 150_000, duCentimes: 2_850_000 })
    expect(parObjet(pied.anomalies)).toEqual([['facture_invalide', 'h', 'bloquant']])
  })

  it('pied de l’opération : facture du marché au TTC invalide signalée une fois (par le suivi du marché)', () => {
    const pied = garantieDeLOperation(
      operation,
      { marches: [marche()], factures: [deLOperation(valide), deLOperation(facture('b', '2027-02-01', -3_000_000, null, 0))], consignations },
      '2027-06-01',
    )
    expect(pied).toMatchObject({ factureCentimes: 3_000_000, duCentimes: 2_850_000 })
    expect(parObjet(pied.anomalies)).toEqual([['facture_invalide', 'b', 'bloquant']])
    expect(parObjet(pied.marches[0].anomalies)).toEqual([['facture_invalide', 'b', 'bloquant']])
  })

  it('facture hors marché invalide portant une retenue : seule l’anomalie de la facture, aucune garantie comptée', () => {
    const pied = garantieDeLOperation(
      operation,
      { marches: [marche()], factures: [deLOperation(facture('h', '2027-02-01', Number.NaN, null, 50_000), null)] },
      '2027-06-01',
    )
    expect(pied).toMatchObject({ factureCentimes: 0, garantieCentimes: 0, duCentimes: 0 })
    expect(parObjet(pied.anomalies)).toEqual([['facture_invalide', 'h', 'bloquant']])
  })
})

describe('relecture 3 — constat 2 : dates des factures, des restitutions et des consignations contrôlées', () => {
  const sousCaution = marche({ garantie: 'caution', cautionCentimes: 500_000, cautionFournieLe: '2027-06-01' })

  it('référence : facture du 10/01/2027, avant la caution, sa retenue n’est pas « malgré la caution »', () => {
    const suivi = suiviRetenueMarche(sousCaution, { factures: [facture('f1', '2027-01-10', 3_000_000, 30, 150_000)], consignations: [consignation('c1', '2027-01-20', 150_000)] }, '2027-08-01')
    expect(suivi.anomalies).toEqual([])
    expect(suivi.retenuCentimes).toBe(150_000)
  })

  it.each(['2027-1-10', '10/01/2027', '', '2027-02-30'])('date de facture « %s » : facture invalide, ni classée « malgré la caution » ni comptée', (date) => {
    const suivi = suiviRetenueMarche(sousCaution, { factures: [facture('f1', date, 3_000_000, 30, 150_000)] }, '2027-08-01')
    expect(parObjet(suivi.anomalies)).toEqual([['facture_invalide', 'f1', 'bloquant']])
    expect(suivi.anomalies[0].message).toContain(`date « ${date} »`)
    expect(suivi).toMatchObject({ factureIds: [], factureCentimes: 0, retenuCentimes: 0, dernierAvancementPct: null })
  })

  it('TTC et date invalides : une seule anomalie, les deux motifs', () => {
    const suivi = suiviRetenueMarche(marche(), { factures: [facture('f1', '2027-02-30', -1, null, 0)] }, '2027-08-01')
    expect(codes(suivi.anomalies)).toEqual(['facture_invalide'])
    expect(suivi.anomalies[0].message).toMatch(/date « 2027-02-30 ».*TTC de -1 centimes/)
  })

  const retenue500 = { factures: [facture('f1', '2027-01-10', 10_000_000, 100, 500_000)], consignations: [consignation('c1', '2027-01-20', 500_000)] }

  it.each(['2028-13-45', 'abc', ''])('restitution datée « %s » : bloquante, montant compté au restitué mais non datée, sans erreur brute', (le) => {
    const suivi = suiviRetenueMarche(marche(), { ...retenue500, restitutions: [restitution('r1', le, 100_000)] }, '2028-04-02')
    expect(suivi).toMatchObject({ restitueCentimes: 100_000, restitueLe: null, resteRetenuCentimes: 400_000, etat: 'a_liberer' })
    expect(parObjet(suivi.anomalies)).toEqual([['restitution_invalide', 'r1', 'bloquant']])
    expect(suivi.anomalies[0].message).toContain(`date « ${le} »`)
  })

  it('restitution mal datée sous opposition : ni « malgré l’opposition » ni « anticipée »', () => {
    const opposee = marche({ opposition: { notifieeLe: '2027-04-01', motif: 'Malfaçons' } })
    const suivi = suiviRetenueMarche(opposee, { ...retenue500, restitutions: [restitution('r1', '2027-1-05', 100_000)] }, '2027-06-01')
    expect(codes(suivi.anomalies)).toEqual(['restitution_invalide'])
    expect(suivi.restitueCentimes).toBe(100_000)
  })

  it('la dernière restitution datée est celle d’une restitution valide', () => {
    const restitutions = [restitution('r1', '2028-04-01', 100_000), restitution('r2', '2028-99-99', 100_000)]
    const suivi = suiviRetenueMarche(marche(), { ...retenue500, restitutions }, '2028-04-02')
    expect(suivi).toMatchObject({ restitueCentimes: 200_000, restitueLe: '2028-04-01', resteRetenuCentimes: 300_000 })
    expect(parObjet(suivi.anomalies)).toEqual([['restitution_invalide', 'r2', 'bloquant']])
  })

  it('consignation mal datée : bloquante, hors du consigné', () => {
    const suivi = suiviRetenueMarche(marche(), { factures: retenue500.factures, consignations: [consignation('c1', '20/01/2027', 500_000)] }, '2027-11-04')
    expect(suivi.consigneCentimes).toBe(0)
    expect(parObjet(suivi.anomalies)).toEqual([
      ['consignation_invalide', 'c1', 'bloquant'],
      ['consignation_insuffisante', 'm1', 'avertissement'],
    ])
  })

  it('pied de l’opération : facture hors marché mal datée signalée, hors du facturé', () => {
    const pied = garantieDeLOperation(operation, { marches: [marche()], factures: [deLOperation(facture('h', '2027-1-10', 1_000_000, null, null), null)] }, '2027-06-01')
    expect(pied).toMatchObject({ factureCentimes: 0, duCentimes: 0 })
    expect(parObjet(pied.anomalies)).toEqual([['facture_invalide', 'h', 'bloquant']])
  })
})

describe('relecture 3 — en-tête : contrôle des saisies dit tel que le code l’applique', () => {
  const { texte } = enTeteDuModule('travaux-retenue-garantie')

  it('factures, consignations et restitutions : montant et date contrôlés, sinon bloquantes et hors des totaux', () => {
    expect(texte).toContain('factures (TTC en centimes entiers strictement positifs, date AAAA-MM-JJ du calendrier)')
    expect(texte).toContain('consignations et restitutions (montant en centimes entiers strictement positifs, date AAAA-MM-JJ du calendrier)')
  })

  it('l’avoir de l’entreprise est une question ouverte, pas une facture négative', () => {
    expect(texte).toContain('« Un avoir de l\'entreprise sur un marché de travaux')
  })
})

describe('restes du contrôle (tour 1) — 1 : les règlements d’une facture écartée sortent du réglé', () => {
  const a = facture('a', '2027-01-10', 3_000_000, null, 150_000)
  const b = facture('b', '2027-02-01', 3_000_000.5, null, 0)

  it('facture du marché au TTC invalide, réglée : son règlement n’entre ni au réglé du marché ni à celui du pied', () => {
    const pied = garantieDeLOperation(operation, { marches: [marche()], factures: [deLOperation(a), deLOperation(b)], reglements: [reglement('rb', 'b', 'Enregistré', 3_000_000)] }, '2027-06-01')
    expect(pied.marches[0]).toMatchObject({ factureCentimes: 3_000_000, regleCentimes: 0, duCentimes: 2_850_000 })
    expect(pied).toMatchObject({ factureCentimes: 3_000_000, garantieCentimes: 150_000, regleCentimes: 0, duCentimes: 2_850_000 })
    expect(parObjet(pied.anomalies)).toEqual([
      ['facture_invalide', 'b', 'bloquant'],
      ['consignation_insuffisante', 'm1', 'avertissement'],
    ])
  })

  it('facture hors marché mal datée, réglée : son règlement ne réduit pas le dû du pied', () => {
    const h = facture('h', '2027-1-10', 1_000_000, null, null)
    const pied = garantieDeLOperation(operation, { marches: [marche()], factures: [deLOperation(a), deLOperation(h, null)], reglements: [reglement('rh', 'h', 'Enregistré', 1_000_000)] }, '2027-06-01')
    expect(pied).toMatchObject({ factureCentimes: 3_000_000, regleCentimes: 0, duCentimes: 2_850_000 })
    expect(codes(pied.anomalies)).not.toContain('regle_au_dela_du_du')
  })

  it('seuls les règlements des factures écartées sortent ; la facture corrigée, son règlement revient', () => {
    const reglements = [reglement('ra', 'a', 'Enregistré', 1_000_000), reglement('rb', 'b', 'Enregistré', 3_000_000)]
    const pied = garantieDeLOperation(operation, { marches: [marche()], factures: [deLOperation(a), deLOperation(b)], reglements }, '2027-06-01')
    expect(pied.marches[0]).toMatchObject({ regleCentimes: 1_000_000, duCentimes: 1_850_000 })
    expect(pied).toMatchObject({ regleCentimes: 1_000_000, duCentimes: 1_850_000 })
    const corrigee = garantieDeLOperation(operation, { marches: [marche()], factures: [deLOperation(a), deLOperation({ ...b, totalTtcCentimes: 3_000_000 })], reglements }, '2027-06-01')
    expect(corrigee.marches[0]).toMatchObject({ factureCentimes: 6_000_000, regleCentimes: 4_000_000, duCentimes: 1_850_000 })
    expect(corrigee).toMatchObject({ regleCentimes: 4_000_000, duCentimes: 1_850_000 })
  })

  it('l’en-tête le dit, et le réglé fourni à suiviRetenueMarche s’entend sans ces règlements', () => {
    const { texte } = enTeteDuModule('travaux-retenue-garantie')
    expect(texte).toContain(
      "les règlements d'une facture écartée sont retirés du réglé, du marché comme du pied de l'opération (le réglé fourni à suiviRetenueMarche s'entend sans eux)",
    )
  })
})

describe('restes du contrôle (tour 1) — 2 : pas de libération tant qu’une saisie écartée fausse le reste retenu', () => {
  const a = facture('a', '2027-01-10', 10_000_000, null, 500_000)
  const liberer = (m: MarcheTravaux, suivi: SuiviRetenueMarche, montantCentimes: number) =>
    ecritureLiberationRetenue({ ...CONTEXTE, id: 't1', date: '2028-04-02', marche: m, suivi, montantCentimes })

  it('restitution mal datée : bloquante, et la libération du retenu entier refusée (1 000,00 € déjà restitués selon la saisie)', () => {
    const m = marche()
    const suivi = suiviRetenueMarche(m, { factures: [a], restitutions: [restitution('r1', '2028-13-45', 100_000)] }, '2028-04-02')
    expect(gravites(suivi.anomalies)).toContainEqual(['restitution_invalide', 'bloquant'])
    expect(() => liberer(m, suivi, 500_000)).toThrow(/reste retenu 400000/)
  })

  it('restitution au montant invalide : bloquante, et la libération refusée tant qu’elle n’est pas corrigée', () => {
    const m = marche()
    const suivi = suiviRetenueMarche(m, { factures: [a], restitutions: [restitution('r1', '2028-03-20', 100_000.5)] }, '2028-04-02')
    expect(gravites(suivi.anomalies)).toContainEqual(['restitution_invalide', 'bloquant'])
    expect(suivi.resteRetenuFaussePar).toEqual(['r1'])
    expect(() => liberer(m, suivi, 500_000)).toThrow(/saisies écartées/)
    expect(() => liberer(m, suivi, 400_000)).toThrow(/\(r1\)/)
  })

  it('restitution corrigée : le reste retenu borne la libération', () => {
    const m = marche()
    const suivi = suiviRetenueMarche(m, { factures: [a], restitutions: [restitution('r1', '2028-03-20', 100_000)] }, '2028-04-02')
    expect(suivi).toMatchObject({ resteRetenuCentimes: 400_000, resteRetenuFaussePar: [] })
    expect(() => liberer(m, suivi, 500_000)).toThrow(/reste retenu 400000/)
    expect(liberer(m, suivi, 400_000).restitution.montantCentimes).toBe(400_000)
  })

  it.each([
    ['restitution au montant invalide', { factures: [a], restitutions: [restitution('r-neg', '2028-03-20', -100_000)] }, 'r-neg'],
    ['retenue invalide', { factures: [a, facture('b', '2027-02-01', 1_000_000, null, 10.5)] }, 'b'],
    ['facture invalide portant une retenue', { factures: [a, facture('c', '2027-02-30', 1_000_000, null, 50_000)] }, 'c'],
  ])('%s : le reste retenu est faussé, la libération refusée', (_cas, sources, id) => {
    const m = marche()
    const suivi = suiviRetenueMarche(m, sources, '2028-04-02')
    expect(suivi.resteRetenuFaussePar).toEqual([id])
    expect(() => liberer(m, suivi, 1)).toThrow(/saisies écartées/)
  })

  it('saisie écartée sans effet sur le reste retenu (facture invalide sans retenue, consignation invalide) : libération admise', () => {
    const m = marche()
    const sources = { factures: [a, facture('b', '2027-1-10', 1_000_000, null, null)], consignations: [consignation('c1', '20/01/2027', 500_000)] }
    const suivi = suiviRetenueMarche(m, sources, '2028-04-02')
    expect(codes(suivi.anomalies)).toEqual(expect.arrayContaining(['facture_invalide', 'consignation_invalide']))
    expect(suivi.resteRetenuFaussePar).toEqual([])
    expect(liberer(m, suivi, 500_000).restitution.montantCentimes).toBe(500_000)
  })

  it('échéance « à faire » : la libération est dite suspendue jusqu’à la correction de la saisie', () => {
    const suivi = suiviRetenueMarche(marche(), { factures: [a], restitutions: [restitution('r1', '2028-03-20', -100_000)] }, '2028-04-02')
    const [element] = echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi }])
    expect(element.libelle).toContain(`retenue de ${eur(500_000)} à libérer`)
    expect(element.libelle).toContain("Libération suspendue jusqu'à la correction des saisies écartées qui faussent le reste retenu (r1).")
    const sansSaisieEcartee = suiviRetenueMarche(marche(), { factures: [a] }, '2028-04-02')
    expect(echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi: sansSaisieEcartee }])[0].libelle).not.toContain('Libération suspendue')
  })

  it('l’en-tête dit la règle et ce qui ne bloque pas la libération', () => {
    const { texte } = enTeteDuModule('travaux-retenue-garantie')
    expect(texte).toContain(
      'ou tant que le suivi porte une saisie écartée qui fausse le reste retenu (resteRetenuFaussePar : facture invalide portant une retenue, retenue invalide, restitution au montant invalide)',
    )
    expect(texte).toContain(
      'une consignation invalide, une restitution dont seule la date est invalide (comptée), une retenue pratiquée malgré une caution, sans retenue stipulée ou au-delà de 5 % (comptée, au 47200) ne la bloquent pas',
    )
  })
})

describe('restes du contrôle (tour 2) — une restitution écartée pour sa seule date garde son montant au restitué', () => {
  const m20 = marche({ montantTtcCentimes: 20_000_000 })
  const a = facture('a', '2027-01-10', 10_000_000, null, 500_000)
  const d = facture('d', '2027-02-01', 1_000_000, null, 50_000)
  const RA = reglement('ra', 'a', 'Enregistré', 9_500_000)
  const RL = reglement('rl', 'a', 'Enregistré', 100_000)
  const pied = (factures: FactureDuMarche[], reglements: ReglementFournisseur[], restitutions: RestitutionRetenue[]) =>
    garantieDeLOperation(operation, { marches: [m20], factures: factures.map((f) => deLOperation(f)), reglements, restitutions }, '2028-04-02')
  const liberer = (m: MarcheTravaux, suivi: SuiviRetenueMarche, montantCentimes: number) =>
    ecritureLiberationRetenue({ ...CONTEXTE, id: 't1', date: '2028-04-02', marche: m, suivi, montantCentimes })

  it('R1 — pied avec la facture valide d non réglée : même reste, même garantie, même dû que la restitution bien datée', () => {
    const bienDatee = pied([a, d], [RA, RL], [restitution('r1', '2028-03-20', 100_000)])
    expect(bienDatee.marches[0]).toMatchObject({ resteRetenuCentimes: 450_000, duCentimes: 950_000 })
    expect(bienDatee).toMatchObject({ garantieCentimes: 450_000, duCentimes: 950_000 })
    const malDatee = pied([a, d], [RA, RL], [restitution('r1', '2028-13-45', 100_000)])
    expect(malDatee.marches[0]).toMatchObject({ restitueCentimes: 100_000, restitueLe: null, resteRetenuCentimes: 450_000, regleCentimes: 9_600_000, duCentimes: 950_000 })
    expect(malDatee).toMatchObject({ factureCentimes: 11_000_000, garantieCentimes: 450_000, regleCentimes: 9_600_000, duCentimes: 950_000 })
    expect(parObjet(malDatee.anomalies)).toContainEqual(['restitution_invalide', 'r1', 'bloquant'])
  })

  it('R1 — sans le règlement rl : la restitution mal datée ne baisse pas non plus le dû', () => {
    const bienDatee = pied([a, d], [RA], [restitution('r1', '2028-03-20', 100_000)])
    const malDatee = pied([a, d], [RA], [restitution('r1', '2028-13-45', 100_000)])
    expect(bienDatee).toMatchObject({ garantieCentimes: 450_000, duCentimes: 1_050_000 })
    expect(malDatee).toMatchObject({ garantieCentimes: 450_000, duCentimes: 1_050_000 })
    expect(malDatee.marches[0].duCentimes).toBe(bienDatee.marches[0].duCentimes)
  })

  it('R2 — facture a seule : dû nul, sans « regle_au_dela_du_du » ni sur le marché ni sur l’opération', () => {
    const p = pied([a], [RA, RL], [restitution('r1', '2028-13-45', 100_000)])
    expect(p.marches[0]).toMatchObject({ resteRetenuCentimes: 400_000, duCentimes: 0 })
    expect(p).toMatchObject({ garantieCentimes: 400_000, duCentimes: 0 })
    expect(parObjet(p.anomalies)).toEqual([
      ['consignation_insuffisante', 'm1', 'avertissement'],
      ['restitution_invalide', 'r1', 'bloquant'],
    ])
  })

  it('l’anomalie reste bloquante et dit que seul le montant est compté', () => {
    const suivi = suiviRetenueMarche(m20, { factures: [a], restitutions: [restitution('r1', '2028-13-45', 100_000)] }, '2028-04-02')
    const [anomalie] = suivi.anomalies.filter((x) => x.code === 'restitution_invalide')
    expect(anomalie).toMatchObject({ objetId: 'r1', gravite: 'bloquant' })
    expect(anomalie.message).toContain('date « 2028-13-45 » invalide')
    expect(anomalie.message).toContain('montant compté au restitué')
    expect(anomalie.message).not.toContain('écartée des totaux')
  })

  it('hors des classements par date : ni anticipée, ni malgré l’opposition, ni dernière restitution', () => {
    const opposee = marche({ montantTtcCentimes: 20_000_000, opposition: { notifieeLe: '2028-01-10', motif: 'Malfaçons' } })
    const sources = { factures: [a], consignations: [consignation('c1', '2027-01-20', 500_000)], restitutions: [restitution('r1', '2027-1-05', 100_000)] }
    const suivi = suiviRetenueMarche(opposee, sources, '2028-04-02')
    expect(codes(suivi.anomalies)).toEqual(['restitution_invalide'])
    expect(suivi).toMatchObject({ restitueCentimes: 100_000, restitueLe: null, resteRetenuCentimes: 400_000, etat: 'opposition' })
  })

  it('comptée dans le contrôle du restitué au-delà du retenu', () => {
    const restitutions = [restitution('r1', '2028-03-20', 450_000), restitution('r2', '2028-13-45', 100_000)]
    const suivi = suiviRetenueMarche(m20, { factures: [a], consignations: [consignation('c1', '2027-01-20', 500_000)], restitutions }, '2028-04-02')
    expect(suivi).toMatchObject({ restitueCentimes: 550_000, restitueLe: '2028-03-20', resteRetenuCentimes: 0, etat: 'restituee' })
    expect(parObjet(suivi.anomalies)).toEqual([
      ['restitution_invalide', 'r2', 'bloquant'],
      ['restitution_au_dela_du_retenu', 'm1', 'bloquant'],
    ])
  })

  it('le reste retenu n’est plus faussé : libération bornée au reste, sans suspension à l’échéance', () => {
    const suivi = suiviRetenueMarche(m20, { factures: [a], restitutions: [restitution('r1', '2028-13-45', 100_000)] }, '2028-04-02')
    expect(suivi.resteRetenuFaussePar).toEqual([])
    expect(() => liberer(m20, suivi, 500_000)).toThrow(/reste retenu 400000/)
    expect(liberer(m20, suivi, 400_000).restitution.montantCentimes).toBe(400_000)
    const [element] = echeancesLiberationGarantie([{ mandatId: 'mandat-1', suivi }])
    expect(element.libelle).toContain(`retenue de ${eur(400_000)} à libérer`)
    expect(element.libelle).not.toContain('Libération suspendue')
  })

  it('restitution au montant invalide : toujours écartée ; « regle_au_dela_du_du » nomme la saisie qui fausse le reste retenu', () => {
    const p = pied([a], [RA, RL], [restitution('r1', '2028-03-20', 100_000.5)])
    expect(p.marches[0]).toMatchObject({ restitueCentimes: 0, resteRetenuCentimes: 500_000, resteRetenuFaussePar: ['r1'] })
    expect(p.anomalies.find((x) => x.code === 'restitution_invalide')?.message).toContain('écartée des totaux')
    const reglesAuDela = p.anomalies.filter((x) => x.code === 'regle_au_dela_du_du')
    expect(reglesAuDela.map((x) => x.objetId)).toEqual(['m1', '00042'])
    for (const x of reglesAuDela) expect(x.message).toContain('reste retenu faussé par des saisies écartées (r1)')
    const surpaye = pied([a], [RA, RL, reglement('rx', 'a', 'Enregistré', 100_000)], [restitution('r1', '2028-03-20', 100_000)])
    const reglesAuDelaSansSaisieEcartee = surpaye.anomalies.filter((x) => x.code === 'regle_au_dela_du_du')
    expect(reglesAuDelaSansSaisieEcartee).toHaveLength(2)
    for (const x of reglesAuDelaSansSaisieEcartee) expect(x.message).not.toContain('faussé')
  })

  it('l’en-tête dit le sort de la restitution mal datée', () => {
    const { texte } = enTeteDuModule('travaux-retenue-garantie')
    expect(texte).toContain(
      "sauf la restitution dont seule la date est invalide : son montant reste compté au restitué (reste retenu, garantie, dû), seule sa date est écartée (dernière restitution, restitution anticipée ou malgré l'opposition)",
    )
  })
})
