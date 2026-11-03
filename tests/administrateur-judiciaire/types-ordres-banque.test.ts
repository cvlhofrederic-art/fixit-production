import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  creerOrdreVirement,
  creerRemiseCheques,
  emettreOrdre,
  type LigneCheque,
  type LigneVirement,
  type OrdreVirement,
} from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import {
  TYPES_ORDRE_BANQUE,
  TYPE_VIREMENT_INTERNE,
  controlerRangsDuLot,
  creerOrdreConstate,
  emettreOrdreConstate,
  etatImputeOrdreVirement,
  imputerOrdre,
  ordresDuLot,
  type OrdreDuLot,
  type SaisieOrdreConstate,
} from '@/lib/administrateur-judiciaire/domain/types-ordres-banque'
import { MODE_REGLEMENT } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Types d'ordre de banque, rang, tiers et état imputé (point 39 du bilan 2). Gestéam, tranche 43 § 12 : dix types
 * d'ordre ; un ordre est une ligne d'un lot (le traitement qui l'a produit), avec son rang, son tiers et son état imputé ;
 * tranche 29 § Banque 4 : l'ordre regroupe des encaissements (remise) ou des règlements (virement). Données fictives.
 */

const IBAN_A = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_B = 'FR14 2004 1010 0505 0001 3M02 606'

const base = { id: 'o-1', numero: 'VIR-0011', date: '2026-10-27', coproprieteId: 'copro-tilleuls', banqueId: 'b-courant', traitementId: 't-reg-7' }

const ligne = (surcharge: Partial<LigneVirement> = {}): LigneVirement => ({
  reglementId: 'r-1',
  beneficiaire: 'Plomberie (fictive)',
  iban: IBAN_A,
  bic: null,
  montantCentimes: 52_800,
  libelle: 'Facture F-118',
  ...surcharge,
})

/** Lot de trois ordres : le 2e regroupe deux règlements (paiement-fournisseurs.ts, « 1 virement par fournisseur »). */
const lotVirements = (): OrdreVirement =>
  creerOrdreVirement({
    ...base,
    lignes: [
      ligne(),
      ligne({ reglementId: 'V-2', reglementIds: ['r-2', 'r-3'], beneficiaire: 'Ascenseurs (fictifs)', iban: IBAN_B, montantCentimes: 30_000, libelle: 'Factures F-7 et F-8' }),
      ligne({ reglementId: 'r-4', montantCentimes: 1_200, libelle: 'Facture F-120' }),
    ],
  })

const cheque = (surcharge: Partial<LigneCheque> = {}): LigneCheque => ({
  encaissementId: 'enc-1',
  tireur: 'Copropriétaire A',
  numeroCheque: '0001234',
  montantCentimes: 45_000,
  ...surcharge,
})

const reglement = (id: string, surcharge: { impute?: boolean; traitementId?: string | null; ordreId?: string | null } = {}) => ({
  id,
  ordreId: 'o-1',
  impute: false,
  traitementId: 't-reg-7',
  ...surcharge,
})
const reglementsDuLot = (surcharge: { impute?: boolean } = {}) => ['r-1', 'r-2', 'r-3', 'r-4'].map((id) => reglement(id, surcharge))

const constat = (surcharge: Partial<SaisieOrdreConstate> = {}): SaisieOrdreConstate => ({
  id: 'oc-1',
  numero: 'VR-0003',
  traitementId: 't-enc-3',
  rang: 1,
  type: 'Virement reçu',
  date: '2026-10-28',
  coproprieteId: 'copro-tilleuls',
  banqueId: 'b-courant',
  tiers: { libelle: 'Copropriétaire B', iban: IBAN_B },
  libelle: 'Provisions T4',
  montantCentimes: 61_000,
  ...surcharge,
})

describe('catalogue des types d’ordre (Gestéam, tranche 43 § 12)', () => {
  it('🟢 dix types, dans l’ordre du sélecteur Gestéam ; le virement interne n’en fait pas partie', () => {
    expect(Object.keys(TYPES_ORDRE_BANQUE)).toEqual([
      'Chèque émis',
      'Ordre de virement',
      'Prélèvement',
      'TIP émis',
      'Remise de chèques',
      'Virement reçu',
      'Prélèvement émis',
      'TIP encaissé',
      "Remise d'espèces",
      'Virement CAF',
    ])
    expect(Object.keys(TYPES_ORDRE_BANQUE)).not.toContain(TYPE_VIREMENT_INTERNE)
  })

  it('🔵 sens déduit du miroir des modes de règlement : quatre sorties (Chèque à TIP), puis les entrées (Chèque à Espèces, et la CAF)', () => {
    const definitions = Object.values(TYPES_ORDRE_BANQUE)
    expect(definitions.map((d) => d.sens)).toEqual(['sortie', 'sortie', 'sortie', 'sortie', 'entree', 'entree', 'entree', 'entree', 'entree', 'entree'])
    const modes = MODE_REGLEMENT.filter((m) => m !== 'Pas de règlement')
    expect(definitions.slice(0, 4).map((d) => d.mode)).toEqual(modes.slice(0, 4))
    expect(definitions.slice(4, 9).map((d) => d.mode)).toEqual(modes)
  })

  it('prise en charge : virement et remise par ordres-banque.ts, espèces refusées, CAF à confirmer, les six autres constatés', () => {
    const par = (prise: string) => Object.entries(TYPES_ORDRE_BANQUE).filter(([, d]) => d.priseEnCharge === prise).map(([t]) => t)
    expect(par('ordres-banque')).toEqual(['Ordre de virement', 'Remise de chèques'])
    expect(par('refuse')).toEqual(["Remise d'espèces"])
    expect(par('a_confirmer')).toEqual(['Virement CAF'])
    expect(par('constat')).toHaveLength(6)
  })

  it('seules les remises (chèques, espèces) n’ont pas de tiers : le bordereau regroupe plusieurs tireurs', () => {
    expect(Object.entries(TYPES_ORDRE_BANQUE).filter(([, d]) => !d.tiers).map(([t]) => t)).toEqual(['Remise de chèques', "Remise d'espèces"])
  })
})

describe('ordres d’un lot : rang, tiers, pièces', () => {
  it('ordre de virement : un ordre par ligne, rang 1 à n, tiers = bénéficiaire et IBAN, pièces = règlements de la ligne', () => {
    const ordres = ordresDuLot(lotVirements(), { reglements: reglementsDuLot() })
    expect(ordres.map((o) => o.rang)).toEqual([1, 2, 3])
    expect(ordres.map((o) => o.nombrePieces)).toEqual([1, 2, 1])
    expect(ordres[1]).toMatchObject({
      sourceId: 'o-1',
      numero: 'VIR-0011-2',
      traitementId: 't-reg-7',
      type: 'Ordre de virement',
      tiers: { libelle: 'Ascenseurs (fictifs)', iban: IBAN_B },
      numeroPiece: 'V-2',
      libelle: 'Factures F-7 et F-8',
      montantCentimes: 30_000,
      statut: 'Enregistré',
      impute: false,
    })
    expect(new Set(ordres.map((o) => o.id)).size).toBe(3)
    expect(controlerRangsDuLot(ordres)).toEqual([])
  })

  it('le statut et la date d’émission sont ceux du lot', () => {
    const ordres = ordresDuLot(emettreOrdre(lotVirements(), '2026-10-28'), { reglements: reglementsDuLot() })
    expect(ordres.every((o) => o.statut === 'Émis' && o.dateEmission === '2026-10-28')).toBe(true)
  })

  it('un ordre du lot ne s’émet pas seul : ni par emettreOrdre (typage), ni par emettreOrdreConstate', () => {
    const lot = lotVirements()
    const [ligne1] = ordresDuLot(lot, { reglements: reglementsDuLot() })
    // @ts-expect-error : emettreOrdre n'émet qu'un lot (remise de chèques, ordre de virement), jamais l'une de ses vues.
    const emettreLaVue = () => emettreOrdre(ligne1, '2026-10-28')
    expect(typeof emettreLaVue).toBe('function')
    expect(() => emettreOrdreConstate(ligne1, '2026-10-28')).toThrow(/Ordre de virement VIR-0011-1 : ordre d'un lot.*emettreOrdre/)
    const remise = creerRemiseCheques({ ...base, numero: 'REM-0042', traitementId: 't-enc-7', lignes: [cheque()] })
    const [bordereau] = ordresDuLot(remise, { impute: false })
    expect(() => emettreOrdreConstate(bordereau, '2026-10-28')).toThrow(/Remise de chèques REM-0042 : ordre d'un lot.*emettreOrdre/)
    expect(() => emettreOrdreConstate({ ...ligne1, type: TYPE_VIREMENT_INTERNE }, '2026-10-28')).toThrow(/emettreLotVirementsInternes/)
    expect(() => emettreOrdreConstate({ ...ligne1, type: "Remise d'espèces" }, '2026-10-28')).toThrow(/53/)
    expect(lot.statut).toBe('Enregistré')
  })

  it('remise de chèques : un seul ordre, rang 1, sans tiers, pièces = chèques du bordereau', () => {
    const remise = creerRemiseCheques({ ...base, numero: 'REM-0042', traitementId: 't-enc-7', lignes: [cheque(), cheque({ encaissementId: 'enc-2', numeroCheque: '0009876', montantCentimes: 12_050 })] })
    expect(ordresDuLot(remise, { impute: true })).toEqual([
      expect.objectContaining({ rang: 1, type: 'Remise de chèques', tiers: null, numeroPiece: 'REM-0042', nombrePieces: 2, montantCentimes: 57_050, traitementId: 't-enc-7', impute: true }),
    ])
  })
})

describe('état imputé des ordres d’un lot (ordresDuLot)', () => {
  it('ordre de virement : déduit de ses règlements, imputé une fois l’ordre émis et tous ses règlements écrits', () => {
    const emis = emettreOrdre(lotVirements(), '2026-10-28')
    expect(ordresDuLot(emis, { reglements: reglementsDuLot({ impute: true }) }).map((o) => o.impute)).toEqual([true, true, true])
    expect(ordresDuLot(emis, { reglements: reglementsDuLot() }).map((o) => o.impute)).toEqual([false, false, false])
  })

  it('ordre de virement « Enregistré » aux règlements imputés : refusé, comme par etatImputeOrdreVirement', () => {
    expect(() => ordresDuLot(lotVirements(), { reglements: reglementsDuLot({ impute: true }) })).toThrow(
      /Ordre VIR-0011 pas émis : aucun de ses règlements ne peut être imputé/,
    )
  })

  it('ordre de virement : un état imputé fourni à la main est refusé (il se déduit des règlements)', () => {
    expect(() => ordresDuLot(lotVirements(), { impute: true } as never)).toThrow(/se déduit de ses règlements/)
    expect(() => ordresDuLot(emettreOrdre(lotVirements(), '2026-10-28'), { impute: false } as never)).toThrow(/se déduit de ses règlements/)
  })

  it('remise de chèques : état imputé fourni (celui de ses encaissements), jamais des règlements', () => {
    const remise = creerRemiseCheques({ ...base, numero: 'REM-0042', traitementId: 't-enc-7', lignes: [cheque()] })
    expect(ordresDuLot(remise, { impute: false })[0].impute).toBe(false)
    expect(() => ordresDuLot(remise, { reglements: [] } as never)).toThrow(/état imputé attendu/)
  })
})

describe('état imputé d’un ordre de virement : déduit de ses règlements', () => {
  it('aucun règlement imputé : non imputé', () => {
    expect(etatImputeOrdreVirement(lotVirements(), reglementsDuLot())).toBe(false)
  })

  it('tous imputés sous le traitement de l’ordre émis : imputé', () => {
    expect(etatImputeOrdreVirement(emettreOrdre(lotVirements(), '2026-10-28'), reglementsDuLot({ impute: true }))).toBe(true)
  })

  it('imputation partielle : refusée, l’ordre s’écrit en une fois (traitementReglements)', () => {
    const reglements = reglementsDuLot()
    reglements[0] = reglement('r-1', { impute: true })
    expect(() => etatImputeOrdreVirement(emettreOrdre(lotVirements(), '2026-10-28'), reglements)).toThrow(/partielle/)
  })

  it('règlement imputé sous un autre traitement, ou imputé alors que l’ordre n’est pas émis : refusé', () => {
    expect(() => etatImputeOrdreVirement(emettreOrdre(lotVirements(), '2026-10-28'), reglementsDuLot({ impute: true }).map((r) => ({ ...r, traitementId: 't-autre' })))).toThrow(/t-autre/)
    expect(() => etatImputeOrdreVirement(lotVirements(), reglementsDuLot({ impute: true }))).toThrow(/pas émis/)
  })

  it('tous les règlements de l’ordre, et eux seuls', () => {
    expect(() => etatImputeOrdreVirement(lotVirements(), reglementsDuLot().slice(1))).toThrow(/r-1 .*non fourni/)
    expect(() => etatImputeOrdreVirement(lotVirements(), [...reglementsDuLot(), reglement('r-9')])).toThrow(/r-9 hors/)
    expect(() => etatImputeOrdreVirement(lotVirements(), [...reglementsDuLot().slice(1), reglement('r-1', { ordreId: 'o-2' })])).toThrow(/r-1 hors/)
    expect(() => etatImputeOrdreVirement(lotVirements(), [...reglementsDuLot(), reglement('r-1')])).toThrow(/double/)
  })
})

describe('contrôle des rangs d’un lot (règle de gestion)', () => {
  const ordres = (): OrdreDuLot[] => ordresDuLot(lotVirements(), { reglements: reglementsDuLot() })

  it('rang en double, rang manquant, rang invalide', () => {
    const lot = ordres()
    lot[2] = { ...lot[2], rang: 2 }
    expect(controlerRangsDuLot(lot).map((a) => a.code)).toEqual(['rang_double', 'rang_manquant'])
    expect(controlerRangsDuLot([{ ...lot[0], rang: 0 }]).map((a) => a.code)).toEqual(['rang_invalide', 'rang_manquant'])
  })

  it('un lot = un traitement et un syndicat (D1) ; anomalies sans fondement légal', () => {
    const lot = ordres()
    lot[1] = { ...lot[1], traitementId: 't-autre', coproprieteId: 'copro-autre' }
    const anomalies = controlerRangsDuLot(lot)
    expect(anomalies.map((a) => a.code)).toEqual(['traitements_differents', 'syndicats_differents'])
    expect(anomalies.every((a) => a.fondement === null)).toBe(true)
  })

  it('lot vide : rien à signaler', () => {
    expect(controlerRangsDuLot([])).toEqual([])
  })
})

describe('ordres constatés (les six autres types)', () => {
  it('virement reçu : enregistré, non émis, non imputé, une pièce par défaut', () => {
    expect(creerOrdreConstate(constat())).toEqual({
      id: 'oc-1',
      numero: 'VR-0003',
      sourceId: 'oc-1',
      traitementId: 't-enc-3',
      rang: 1,
      type: 'Virement reçu',
      date: '2026-10-28',
      coproprieteId: 'copro-tilleuls',
      banqueId: 'b-courant',
      tiers: { libelle: 'Copropriétaire B', iban: IBAN_B },
      libelle: 'Provisions T4',
      numeroPiece: null,
      nombrePieces: 1,
      montantCentimes: 61_000,
      statut: 'Enregistré',
      dateEmission: null,
      impute: false,
    })
  })

  it('chèque émis : tiers obligatoire ; émission unique par emettreOrdre', () => {
    expect(() => creerOrdreConstate(constat({ type: 'Chèque émis', tiers: null }))).toThrow(/tiers/)
    expect(() => creerOrdreConstate(constat({ type: 'Chèque émis', tiers: { libelle: '  ', iban: null } }))).toThrow(/tiers/)
    const ordre = creerOrdreConstate(constat({ type: 'Chèque émis', tiers: { libelle: 'Jardins (fictifs)', iban: null }, numeroPiece: '0004567' }))
    const emis = emettreOrdreConstate(ordre, '2026-10-29')
    expect(emis).toMatchObject({ statut: 'Émis', dateEmission: '2026-10-29', numeroPiece: '0004567' })
    expect(() => emettreOrdreConstate(emis, '2026-10-30')).toThrow(/déjà émis/)
  })

  it('chèque émis : n° de chèque exigé (référence du paiement, comme un règlement par chèque hors ordre)', () => {
    const chequeEmis = (numeroPiece?: string | null) =>
      creerOrdreConstate(constat({ type: 'Chèque émis', tiers: { libelle: 'Jardins (fictifs)', iban: null }, numeroPiece }))
    expect(() => chequeEmis(undefined)).toThrow(/Chèque émis : n° de chèque exigé \(référence du paiement\)/)
    expect(() => chequeEmis(null)).toThrow(/n° de chèque exigé/)
    expect(() => chequeEmis('  ')).toThrow(/n° de chèque exigé/)
    expect(chequeEmis(' 0004567 ').numeroPiece).toBe('0004567')
    expect(creerOrdreConstate(constat()).numeroPiece).toBeNull()
  })

  it('🔴 remise d’espèces refusée (compte 53 non tenu) ; virement CAF à confirmer', () => {
    expect(() => creerOrdreConstate(constat({ type: "Remise d'espèces", tiers: null }))).toThrow(/53/)
    expect(() => creerOrdreConstate(constat({ type: 'Virement CAF' }))).toThrow(/confirmer/)
  })

  it('virement et remise : créés par ordres-banque.ts, vus par ordresDuLot', () => {
    expect(() => creerOrdreConstate(constat({ type: 'Ordre de virement' }))).toThrow(/creerOrdreVirement/)
    expect(() => creerOrdreConstate(constat({ type: 'Remise de chèques', tiers: null }))).toThrow(/creerRemiseCheques/)
  })

  it('saisie invalide : type inconnu, rang, pièces, montant, date, syndicat, compte, traitement, IBAN du tiers', () => {
    expect(() => creerOrdreConstate(constat({ type: 'Lettre de change' as never }))).toThrow(/inconnu/)
    expect(() => creerOrdreConstate(constat({ rang: 0 }))).toThrow(/Rang/)
    expect(() => creerOrdreConstate(constat({ rang: 1.5 }))).toThrow(/Rang/)
    expect(() => creerOrdreConstate(constat({ nombrePieces: 0 }))).toThrow(/pièces/)
    expect(() => creerOrdreConstate(constat({ montantCentimes: 10.5 }))).toThrow(/Montant/)
    expect(() => creerOrdreConstate(constat({ montantCentimes: 0 }))).toThrow(/Montant/)
    expect(() => creerOrdreConstate(constat({ date: '28/10/2026' }))).toThrow(/Date/)
    expect(() => creerOrdreConstate(constat({ coproprieteId: ' ' }))).toThrow(/D1/)
    expect(() => creerOrdreConstate(constat({ banqueId: '' }))).toThrow(/compte/)
    expect(() => creerOrdreConstate(constat({ traitementId: '' }))).toThrow(/traitement/)
    expect(() => creerOrdreConstate(constat({ numero: '' }))).toThrow(/numéro/)
    expect(() => creerOrdreConstate(constat({ libelle: ' ' }))).toThrow(/Libellé/)
    expect(() => creerOrdreConstate(constat({ tiers: { libelle: 'B', iban: 'FR76 3000 6000 0112 3456 7890 188' } }))).toThrow(/IBAN/)
  })
})

describe('imputation d’un ordre constaté', () => {
  it('imputé par le traitement de l’ordre, une seule fois', () => {
    const ordre = creerOrdreConstate(constat())
    const impute = imputerOrdre(ordre, { id: 't-enc-3' })
    expect(impute.impute).toBe(true)
    expect(ordre.impute).toBe(false)
    expect(() => imputerOrdre(impute, { id: 't-enc-3' })).toThrow(/déjà imputé/)
    expect(() => imputerOrdre(ordre, { id: 't-autre' })).toThrow(/t-autre/)
  })

  it('ordre de virement et virement interne : l’état imputé se déduit de l’écriture de leur traitement', () => {
    const [premier] = ordresDuLot(lotVirements(), { reglements: reglementsDuLot() })
    expect(() => imputerOrdre(premier, { id: 't-reg-7' })).toThrow(/etatImputeOrdreVirement/)
    expect(() => imputerOrdre({ ...premier, type: TYPE_VIREMENT_INTERNE }, { id: 't-reg-7' })).toThrow(/traitementVirementsInternes/)
  })
})

describe('en-tête : sources et marqueurs', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'types-ordres-banque.ts'), 'utf8')
  const entete = source.slice(0, source.indexOf('*/')).replace(/\s*\n\s*\*\s*/g, ' ')

  it('cite la tranche 43 § 12 et la tranche 29, et porte les trois marqueurs', () => {
    expect(entete).toContain('tranche 43 § 12')
    expect(entete).toContain('tranche 29')
    for (const marqueur of ['🟢', '🔵', '🔴']) expect(entete).toContain(marqueur)
  })

  it('🔴 pose les questions des types non établis', () => {
    const nonEtabli = entete.slice(entete.indexOf('🔴'))
    for (const type of ['Prélèvement émis', 'TIP encaissé', 'Virement CAF', "Remise d'espèces"]) expect(nonEtabli).toContain(type)
  })

  it('🔴 pose la question du n° d’un chèque émis avant l’émission (série de chèques Gestéam, tranche 29)', () => {
    const nonEtabli = entete.slice(entete.indexOf('🔴'))
    expect(nonEtabli).toContain('N° prochain / N° dernier')
    expect(nonEtabli).toContain("VitFix l'exige à la saisie du constat")
  })
})
