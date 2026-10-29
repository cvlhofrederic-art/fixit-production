import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ecritureFactureVentilee } from '@/lib/administrateur-judiciaire/domain/facture-ventilee'
import { numeroCompteCoproprietaire, type Position } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { creerOrdreVirement, emettreOrdre, type LigneVirement, type OrdreVirement } from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import { regrouperVirements, type UnitePaiement } from '@/lib/administrateur-judiciaire/domain/paiement-fournisseurs'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import {
  STATUTS_REGLEMENT_FOURNISSEUR,
  changerStatutReglementFournisseur,
  controlerBeneficiaireIndivisaire,
  controlerPaiementPlusieursMandats,
  creerReglementFournisseur,
  enregistrerOrdreEmis,
  mettreDansOrdre,
  mouvementsReglement,
  rapprocherReglements,
  reglementsDeLigne,
  traitementReglements,
  type BeneficiaireReglement,
  type ContextePaiement,
  type ReglementFournisseur,
  type SaisieReglementFournisseur,
} from '@/lib/administrateur-judiciaire/domain/reglements-fournisseurs'
import { annulerTraitement, mouvementsARepartir } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Règlements fournisseurs : objet et cycle (point 38 du bilan 2). Gestéam, tranche 36 § Règlements (fiche : traitement,
 * journal, mode, n° de pièce, ordre de banque, bénéficiaire Fournisseur / Mandant / Indivisaire / Client, grille Mandat ·
 * Origine · Montant) et tranche 43 § 10 (détail : une ligne par facture réglée, rattachée au traitement « Règlement de
 * factures », à la facture, au contrat, à la demande, aux travaux et à la tranche ; Demandé → À régler → Enregistré →
 * Rapproché, ou Annulé ; Imputé / Non imputé). Données fictives.
 */

const SEGMENT = 'TILL'
const IBAN_FOURNISSEUR = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_AUTRE = 'FR14 2004 1010 0505 0001 3M02 606'

const FOURNISSEUR: BeneficiaireReglement = { type: 'fournisseur', prestataireId: 'p-plomberie', auxiliaire401: 'F0012' }
const COPROPRIETAIRE: BeneficiaireReglement = { type: 'coproprietaire', compteCoproprietaireId: 'cpt-12', serie450: '00012' }
const INDIVISAIRE: BeneficiaireReglement = { type: 'indivisaire', compteCoproprietaireId: 'cpt-14', serie450: '00014', identiteId: 'id-7' }

const saisie = (surcharge: Partial<SaisieReglementFournisseur> = {}): SaisieReglementFournisseur => ({
  id: 'r-1',
  coproprieteId: 'copro-tilleuls',
  mandatId: 'm-1',
  banqueId: 'b-courant',
  contrepartie512: 'TILL.51200.00001.0',
  beneficiaire: FOURNISSEUR,
  factureId: 'f-1',
  echeance: '2026-10-31',
  libelle: 'Facture F-118 plomberie',
  montantCentimes: 120_000,
  mode: 'Virement',
  iban: IBAN_FOURNISSEUR,
  ...surcharge,
})

const creer = (surcharge: Partial<SaisieReglementFournisseur> = {}) => creerReglementFournisseur(saisie(surcharge), { segmentSyndicat: SEGMENT })

/** Règlement payé hors ordre (prélèvement constaté) : seul un règlement payé s'écrit. */
const paye = (surcharge: Partial<SaisieReglementFournisseur> = {}) =>
  changerStatutReglementFournisseur(creer({ mode: 'Prélèvement', iban: null, ...surcharge }), 'Enregistré')

const AU_29 = { date: '2026-10-29' }

const versRegroupement = (r: ReglementFournisseur, unVirementPar: UnitePaiement) => ({
  reglementId: r.id,
  factureId: r.factureId ?? r.id,
  prestataireId: r.beneficiaire.type === 'fournisseur' ? r.beneficiaire.prestataireId : r.id,
  mandatId: r.mandatId,
  beneficiaire: 'Plomberie du Centre (fictif)',
  iban: r.iban ?? '',
  bic: r.bic,
  montantCentimes: r.montantCentimes,
  reference: r.libelle,
  unVirementPar,
})

const ordreDe = (reglements: ReglementFournisseur[], unVirementPar: UnitePaiement = 'facture', lignes?: LigneVirement[]): OrdreVirement =>
  creerOrdreVirement({
    id: 'o-1',
    numero: 'OV-1',
    date: '2026-10-28',
    coproprieteId: 'copro-tilleuls',
    banqueId: 'b-courant',
    traitementId: 't-regl-1',
    lignes: lignes ?? regrouperVirements(reglements.map((r) => versRegroupement(r, unVirementPar))).map((g) => g.ligne),
  })

describe('objet ReglementFournisseur', () => {
  it('cycle observé dans Gestéam : Demandé → À régler → Enregistré → Rapproché, ou Annulé', () => {
    expect(STATUTS_REGLEMENT_FOURNISSEUR).toEqual(['Demandé', 'À régler', 'Enregistré', 'Rapproché', 'Annulé'])
  })

  it('naît « Demandé », non imputé, hors de tout ordre, traitement et arrêté ; liens absents à null', () => {
    expect(creer()).toEqual({
      ...saisie(),
      bic: null,
      numeroPiece: null,
      contratId: null,
      demandeId: null,
      travauxId: null,
      tranche: null,
      traitementId: null,
      ordreId: null,
      statut: 'Demandé',
      impute: false,
      rapprochement: null,
    })
  })

  it('garde ses rattachements : contrat, demande, travaux et tranche', () => {
    expect(creer({ contratId: 'ctr-4', demandeId: 'dem-9', travauxId: 'TX001', tranche: '2' })).toMatchObject({
      contratId: 'ctr-4',
      demandeId: 'dem-9',
      travauxId: 'TX001',
      tranche: '2',
    })
  })

  it('montant en centimes entiers strictement positifs, échéance AAAA-MM-JJ, libellé', () => {
    for (const montantCentimes of [0, -100, 10.5, Number.NaN]) expect(() => creer({ montantCentimes })).toThrow(/Montant invalide/)
    expect(() => creer({ echeance: '31/10/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => creer({ libelle: '  ' })).toThrow(/Libellé/)
  })

  it('syndicat, mandat et compte payeur obligatoires (D1, D-BANQUE)', () => {
    expect(() => creer({ coproprieteId: ' ' })).toThrow(/syndicat/)
    expect(() => creer({ mandatId: '' })).toThrow(/mandat/)
    expect(() => creer({ banqueId: '' })).toThrow(/compte payeur/)
  })

  it('mode : connu, autre que « Pas de règlement » ; un virement exige un IBAN valide, un chèque non', () => {
    expect(() => creer({ mode: 'Carte' as never })).toThrow(/Mode de règlement inconnu/)
    expect(() => creer({ mode: 'Pas de règlement' })).toThrow(/Pas de règlement/)
    expect(() => creer({ iban: null })).toThrow(/IBAN/)
    expect(() => creer({ iban: 'FR76 3000 6000 0112 3456 7890 188' })).toThrow(/IBAN/)
    expect(creer({ mode: 'Chèque', iban: null })).toMatchObject({ mode: 'Chèque', iban: null })
  })

  it('🔴 espèces refusées : le paiement sortirait du compte 53 « Caisse », que le domaine ne tient pas, jamais d’un 512', () => {
    expect(() => creer({ mode: 'Espèces', iban: null })).toThrow(/Espèces.*53/)
  })

  it('bénéficiaire fournisseur : facture obligatoire, auxiliaire 401 sur 5 caractères', () => {
    expect(() => creer({ factureId: null })).toThrow(/facture/)
    expect(() => creer({ beneficiaire: { ...FOURNISSEUR, auxiliaire401: 'F12' } })).toThrow(/5 caractères/)
    expect(() => creer({ beneficiaire: { ...FOURNISSEUR, prestataireId: ' ' } })).toThrow(/fournisseur/)
  })

  it('bénéficiaire copropriétaire ou indivisaire : ni facture ni contrat ; l’indivisaire est une identité', () => {
    expect(creer({ beneficiaire: COPROPRIETAIRE, factureId: null })).toMatchObject({ beneficiaire: COPROPRIETAIRE, factureId: null })
    expect(() => creer({ beneficiaire: COPROPRIETAIRE })).toThrow(/facture/)
    expect(() => creer({ beneficiaire: COPROPRIETAIRE, factureId: null, contratId: 'ctr-4' })).toThrow(/contrat/)
    expect(() => creer({ beneficiaire: { ...INDIVISAIRE, identiteId: '' }, factureId: null })).toThrow(/identité/)
    expect(() => creer({ beneficiaire: { ...COPROPRIETAIRE, serie450: '12' }, factureId: null })).toThrow(/5 caractères/)
    expect(() => creer({ beneficiaire: { type: 'mandant' } as never })).toThrow(/Type de bénéficiaire inconnu/)
  })

  it('travaux : n° d’opération sur 5 caractères ; une tranche exige ses travaux', () => {
    expect(() => creer({ travauxId: 'TX1' })).toThrow(/5 caractères/)
    expect(() => creer({ tranche: '2' })).toThrow(/Tranche/)
  })

  it('contrepartie : un compte 512 du syndicat (D1)', () => {
    expect(() => creer({ contrepartie512: 'TILL.40100.00001.0' })).toThrow(/512/)
    expect(() => creer({ contrepartie512: 'ROSE.51200.00001.0' })).toThrow(/syndicat/)
    expect(() => creer({ contrepartie512: '51200' })).toThrow(/512/)
  })
})

describe('lignes de virement et règlements', () => {
  it('ligne simple : son identifiant ; ligne groupée : ses règlements, jamais l’identifiant synthétique', () => {
    const r1 = creer()
    const r2 = creer({ id: 'r-2', factureId: 'f-2', montantCentimes: 30_000 })
    const [simple] = ordreDe([r1]).lignes
    expect(reglementsDeLigne({ ...simple, reglementIds: undefined })).toEqual(['r-1'])
    const [groupee] = ordreDe([r1, r2], 'mandat').lignes
    expect(groupee.reglementId).toBe('r-1+1')
    expect(reglementsDeLigne(groupee)).toEqual(['r-1', 'r-2'])
    expect(() => reglementsDeLigne({ ...groupee, reglementIds: [] })).toThrow(/aucun règlement/)
  })
})

describe('entrée dans un ordre de virement et émission', () => {
  const r1 = creer()
  const r2 = creer({ id: 'r-2', factureId: 'f-2', montantCentimes: 30_000 })

  it('les règlements passent « À régler » : ordre, traitement de l’ordre, n° de pièce = identifiant du virement', () => {
    const ordre = ordreDe([r1, r2], 'mandat')
    expect(mettreDansOrdre([r1, r2], ordre)).toEqual([
      { ...r1, statut: 'À régler', ordreId: 'o-1', traitementId: 't-regl-1', numeroPiece: 'r-1+1' },
      { ...r2, statut: 'À régler', ordreId: 'o-1', traitementId: 't-regl-1', numeroPiece: 'r-1+1' },
    ])
  })

  it('refuse un ordre déjà émis', () => {
    expect(() => mettreDansOrdre([r1], emettreOrdre(ordreDe([r1]), '2026-10-29'))).toThrow(/déjà émis/)
  })

  it('les règlements doivent être exactement ceux de l’ordre', () => {
    expect(() => mettreDansOrdre([r1, r2], ordreDe([r1]))).toThrow(/r-2.*absent de l'ordre/)
    expect(() => mettreDansOrdre([r1], ordreDe([r1, r2], 'mandat'))).toThrow(/r-2.*non fourni/)
    expect(() => mettreDansOrdre([r1, r1], ordreDe([r1]))).toThrow(/double/)
  })

  it('même syndicat et même compte payeur que l’ordre', () => {
    const autreSyndicat = { ...r1, coproprieteId: 'copro-roses' }
    const autreCompte = { ...r1, banqueId: 'b-fonds-travaux' }
    expect(() => mettreDansOrdre([autreSyndicat], ordreDe([r1]))).toThrow(/syndicat/)
    expect(() => mettreDansOrdre([autreCompte], ordreDe([r1]))).toThrow(/compte/)
  })

  it('chaque ligne : montant égal à la somme de ses règlements, même IBAN, un seul mandat (D-BANQUE)', () => {
    const [ligne] = ordreDe([r1]).lignes
    expect(() => mettreDansOrdre([r1], ordreDe([r1], 'facture', [{ ...ligne, montantCentimes: 120_001 }]))).toThrow(/montant/)
    expect(() => mettreDansOrdre([r1], ordreDe([r1], 'facture', [{ ...ligne, iban: IBAN_AUTRE }]))).toThrow(/IBAN/)
    const autreMandat = { ...r2, mandatId: 'm-2' }
    const melee: LigneVirement = { ...ligne, reglementId: 'r-1+1', reglementIds: ['r-1', 'r-2'], montantCentimes: 150_000 }
    expect(() => mettreDansOrdre([r1, autreMandat], ordreDe([r1], 'facture', [melee]))).toThrow(/plusieurs mandats/)
    const autreBeneficiaire = { ...r2, beneficiaire: { ...FOURNISSEUR, prestataireId: 'p-ascenseurs' } }
    expect(() => mettreDansOrdre([r1, autreBeneficiaire], ordreDe([r1], 'facture', [melee]))).toThrow(/bénéficiaires/)
  })

  it('un ordre ne mêle jamais règlements de factures et remboursements de soldes : un seul traitement, d’une seule famille', () => {
    const solde = creer({ id: 'r-3', beneficiaire: COPROPRIETAIRE, factureId: null, montantCentimes: 4_500 })
    expect(() => mettreDansOrdre([r1, solde], ordreDe([r1, solde]))).toThrow(/mêler/)
  })

  it('deux virements distincts n’ont jamais le même n° de pièce : un ordre à deux lignes de même identifiant est refusé dès sa création', () => {
    const [l1] = ordreDe([r1]).lignes
    const [l2] = ordreDe([r2]).lignes
    const lignes = [
      { ...l1, reglementId: 'X', reglementIds: ['r-1'] },
      { ...l2, reglementId: 'X', reglementIds: ['r-2'] },
    ]
    expect(() => mettreDansOrdre([r1, r2], ordreDe([r1, r2], 'facture', lignes))).toThrow(/X.*double/)
  })

  it('un ordre recomposé sans creerOrdreVirement (relu du stockage) dont deux lignes ont le même identifiant est refusé aussi à l’entrée et à l’émission', () => {
    const ordre = ordreDe([r1, r2])
    const lignesX = ordre.lignes.map((l) => ({ ...l, reglementId: 'X', reglementIds: reglementsDeLigne(l) }))
    expect(() => mettreDansOrdre([r1, r2], { ...ordre, lignes: lignesX })).toThrow(/« X » en double/)
    const aRegler = mettreDansOrdre([r1, r2], ordre)
    expect(() => enregistrerOrdreEmis(aRegler, { ...emettreOrdre(ordre, '2026-10-29'), lignes: lignesX })).toThrow(/« X » en double/)
  })

  it('seul un virement « Demandé » entre dans un ordre', () => {
    const dansOrdre = mettreDansOrdre([r1], ordreDe([r1]))
    expect(() => mettreDansOrdre(dansOrdre, ordreDe([r1]))).toThrow(/Demandé/)
    const cheque = creer({ mode: 'Chèque', iban: IBAN_FOURNISSEUR })
    expect(() => mettreDansOrdre([cheque], ordreDe([r1]))).toThrow(/virement/)
  })

  it('ordre émis : tous ses règlements passent « Enregistré » ; ordre non émis refusé', () => {
    const ordre = ordreDe([r1, r2], 'mandat')
    const aRegler = mettreDansOrdre([r1, r2], ordre)
    expect(() => enregistrerOrdreEmis(aRegler, ordre)).toThrow(/pas émis/)
    const enregistres = enregistrerOrdreEmis(aRegler, emettreOrdre(ordre, '2026-10-29'))
    expect(enregistres.map((r) => r.statut)).toEqual(['Enregistré', 'Enregistré'])
    expect(enregistres[0]).toMatchObject({ ordreId: 'o-1', numeroPiece: 'r-1+1', impute: false })
  })

  it('un règlement sorti de l’ordre que l’ordre émis paie encore est signalé (ordre à refaire avant émission)', () => {
    const ordre = ordreDe([r1])
    const [aRegler] = mettreDansOrdre([r1], ordre)
    const sorti = changerStatutReglementFournisseur(aRegler, 'Annulé', { ordre: 'Enregistré' })
    expect(() => enregistrerOrdreEmis([sorti], emettreOrdre(ordre, '2026-10-29'))).toThrow(/n'est plus à régler/)
  })
})

describe('changements de statut à la main', () => {
  const r1 = creer()
  const [aRegler] = mettreDansOrdre([r1], ordreDe([r1]))

  it('« Rapproché » n’est jamais posé ni retiré à la main : il est propagé depuis l’arrêté', () => {
    const enregistre = enregistrerOrdreEmis([aRegler], emettreOrdre(ordreDe([r1]), '2026-10-29'))[0]
    expect(() => changerStatutReglementFournisseur(enregistre, 'Rapproché')).toThrow(/arrêté/)
    expect(() => changerStatutReglementFournisseur({ ...enregistre, statut: 'Rapproché' }, 'Enregistré')).toThrow(/arrêté/)
  })

  it('« À régler » seulement par l’ordre ; un virement à régler n’est « Enregistré » que par l’émission de son ordre', () => {
    expect(() => changerStatutReglementFournisseur(r1, 'À régler')).toThrow(/mettreDansOrdre/)
    expect(() => changerStatutReglementFournisseur(aRegler, 'Enregistré', { ordre: 'Émis' })).toThrow(/enregistrerOrdreEmis/)
  })

  it('hors ordre : un chèque est « Enregistré » avec son numéro ; un prélèvement subi aussi ; un virement non', () => {
    const cheque = creer({ mode: 'Chèque', iban: null })
    expect(() => changerStatutReglementFournisseur(cheque, 'Enregistré')).toThrow(/n° de chèque/)
    expect(changerStatutReglementFournisseur(cheque, 'Enregistré', { numeroPiece: ' 0001234 ' })).toMatchObject({
      statut: 'Enregistré',
      numeroPiece: '0001234',
    })
    expect(changerStatutReglementFournisseur(creer({ mode: 'Prélèvement', iban: null }), 'Enregistré').statut).toBe('Enregistré')
    expect(() => changerStatutReglementFournisseur(r1, 'Enregistré')).toThrow(/ordre de virement/)
  })

  it('« Demandé » → « Annulé » : abandon sans écriture', () => {
    expect(changerStatutReglementFournisseur(r1, 'Annulé').statut).toBe('Annulé')
  })

  it('sortie d’un ordre non émis : retour « Demandé » sans ordre, traitement ni n° de pièce, ou « Annulé »', () => {
    expect(changerStatutReglementFournisseur(aRegler, 'Demandé', { ordre: 'Enregistré' })).toEqual(r1)
    expect(changerStatutReglementFournisseur(aRegler, 'Annulé', { ordre: 'Enregistré' })).toEqual({ ...r1, statut: 'Annulé' })
    expect(() => changerStatutReglementFournisseur(aRegler, 'Demandé')).toThrow(/statut de son ordre/)
    expect(() => changerStatutReglementFournisseur(aRegler, 'Annulé', { ordre: 'Émis' })).toThrow(/déjà émis/)
  })

  it('🔴 après enregistrement, aucune annulation à la main (contre-passation à trancher) ; rien après « Annulé »', () => {
    const enregistre = changerStatutReglementFournisseur(creer({ mode: 'Prélèvement', iban: null }), 'Enregistré')
    expect(() => changerStatutReglementFournisseur(enregistre, 'Annulé')).toThrow(/Transition refusée/)
    expect(() => changerStatutReglementFournisseur(changerStatutReglementFournisseur(r1, 'Annulé'), 'Demandé')).toThrow(/Transition refusée/)
  })
})

describe('écriture du règlement et imputation', () => {
  const ligneCharge = {
    comptePlan: '61400',
    analytique: null,
    cleRepartition: 'GEN',
    rubrique: null,
    codeFiscal: null,
    montantTtcCentimes: 120_000,
    recupLocatairePct: 0,
    lotId: null,
    rattachement: null,
  }

  it('fournisseur : débit du 401 que la saisie de la facture a crédité, crédit de la contrepartie 512 ; jamais la charge', () => {
    const facture = ecritureFactureVentilee({
      id: 't-fact',
      date: '2026-10-02',
      segmentSyndicat: SEGMENT,
      auxiliaireFournisseur: 'F0012',
      fournisseurId: 'p-plomberie',
      totalTtcCentimes: 120_000,
      lignes: [ligneCharge],
    })
    const credit401 = facture.mouvements.find((m) => m.sens === 'credit')
    const r = creer({ contratId: 'ctr-4', travauxId: 'TX001' })
    expect(mouvementsReglement(r)).toEqual([
      { compte: credit401?.compte, sens: 'debit', montantCentimes: 120_000, liens: { fournisseurId: 'p-plomberie', contratId: 'ctr-4', travauxId: 'TX001' } },
      { compte: 'TILL.51200.00001.0', sens: 'credit', montantCentimes: 120_000 },
    ])
    const { traitement: reglement } = traitementReglements([paye({ contratId: 'ctr-4', travauxId: 'TX001' })], { id: 't-regl-1', ...AU_29 })
    expect(mouvementsARepartir([facture, reglement], { du: '2026-10-01', au: '2026-10-31' }).map((m) => m.montantCentimes)).toEqual([120_000])
  })

  it('copropriétaire : débit de son compte 450 ; famille « Règlement de soldes de compte »', () => {
    const r = creer({ beneficiaire: COPROPRIETAIRE, factureId: null, montantCentimes: 4_500 })
    const compte450 = numeroCompteCoproprietaire({ id: 'cpt-12', coproprieteId: 'copro-tilleuls', serie: '00012', libelle: 'Lot 12' }, SEGMENT)
    expect(mouvementsReglement(r)[0]).toEqual({ compte: compte450, sens: 'debit', montantCentimes: 4_500, liens: { compteCoproprietaireId: 'cpt-12' } })
    const solde = paye({ beneficiaire: COPROPRIETAIRE, factureId: null, montantCentimes: 4_500 })
    expect(traitementReglements([solde], { id: 't-solde', ...AU_29 }).traitement.famille).toBe('Règlement de soldes de compte')
  })

  it('traitement « Règlement de factures » : une paire par règlement, équilibré', () => {
    const { traitement } = traitementReglements([paye(), paye({ id: 'r-2', factureId: 'f-2', montantCentimes: 30_000 })], { id: 't-regl-1', ...AU_29 })
    expect(traitement.famille).toBe('Règlement de factures')
    expect(traitement.mouvements).toHaveLength(4)
  })

  it('traitement refusé : liste vide, factures et soldes mêlés, plusieurs syndicats, règlement annulé ou déjà imputé', () => {
    const date = { id: 't', ...AU_29 }
    const solde = paye({ id: 'r-9', beneficiaire: COPROPRIETAIRE, factureId: null })
    expect(() => traitementReglements([], date)).toThrow(/aucun règlement/)
    expect(() => traitementReglements([paye(), solde], date)).toThrow(/mêler/)
    expect(() => traitementReglements([paye(), { ...paye({ id: 'r-2' }), coproprieteId: 'copro-roses' }], date)).toThrow(/syndicat/)
    expect(() => traitementReglements([changerStatutReglementFournisseur(creer(), 'Annulé')], date)).toThrow(/payé/)
    expect(() => traitementReglements([{ ...paye(), impute: true }], date)).toThrow(/déjà imputé/)
  })

  it('un même règlement deux fois dans l’appel : refusé, jamais deux paires pour un paiement', () => {
    const r = paye()
    expect(() => traitementReglements([r, r], { id: 't', ...AU_29 })).toThrow(/r-1 en double/)
  })

  it('aucune écriture avant le paiement : ni demandé, ni à régler, ni sorti de l’ordre ; un ordre abandonné ne laisse rien à contre-passer', () => {
    const r1 = creer()
    const ordre = ordreDe([r1])
    const [aRegler] = mettreDansOrdre([r1], ordre)
    expect(() => traitementReglements([r1], { id: 't-regl-1', ...AU_29 })).toThrow(/payé/)
    expect(() => traitementReglements([aRegler], { id: 't-regl-1', ...AU_29 })).toThrow(/payé/)
    const sorti = changerStatutReglementFournisseur(aRegler, 'Demandé', { ordre: 'Enregistré' })
    expect(() => traitementReglements([sorti], { id: 't-regl-2', ...AU_29 })).toThrow(/payé/)
    expect(changerStatutReglementFournisseur(aRegler, 'Annulé', { ordre: 'Enregistré' })).toMatchObject({ statut: 'Annulé', impute: false, traitementId: null })
  })

  it('règlement payé par un ordre : écrit et imputé dans le traitement de son ordre, et dans aucun autre', () => {
    const r1 = creer()
    const ordre = ordreDe([r1])
    const emis = emettreOrdre(ordre, '2026-10-29')
    const [enregistre] = enregistrerOrdreEmis(mettreDansOrdre([r1], ordre), emis)
    expect(() => traitementReglements([enregistre], { id: 't-autre', ...AU_29, ordre: emis })).toThrow(/rattaché au traitement t-regl-1/)
    const { traitement, reglements } = traitementReglements([enregistre], { id: 't-regl-1', ...AU_29, ordre: emis })
    expect(reglements).toEqual([{ ...enregistre, impute: true }])
    expect(traitement.mouvements).toEqual(mouvementsReglement(enregistre).map((m) => ({ ...m, traitementId: 't-regl-1' })))
  })

  describe('un ordre s’écrit en un seul traitement, avec l’ordre émis, et ce traitement n’écrit que lui', () => {
    const rA = creer()
    const rB = creer({ id: 'r-2', factureId: 'f-2', montantCentimes: 30_000 })
    const ordre = ordreDe([rA, rB])
    const emis = emettreOrdre(ordre, '2026-10-29')
    const enregistres = enregistrerOrdreEmis(mettreDansOrdre([rA, rB], ordre), emis)
    const ecrire = (reglements: ReglementFournisseur[], ordrePasse?: OrdreVirement) =>
      traitementReglements(reglements, { id: 't-regl-1', ...AU_29, ...(ordrePasse ? { ordre: ordrePasse } : {}) })

    it('règlements d’un ordre sans leur ordre : refusé (rien ne prouverait qu’ils s’écrivent ensemble)', () => {
      expect(() => ecrire(enregistres)).toThrow(/payé par l'ordre o-1 : passer cet ordre/)
    })

    it('écriture partielle d’un ordre : refusée, jamais deux traitements de même identifiant pour un ordre', () => {
      expect(() => ecrire([enregistres[0]], emis)).toThrow(/r-2.*non fourni/)
      expect(() => ecrire([enregistres[1]], emis)).toThrow(/r-1.*non fourni/)
    })

    it('un règlement hors de l’ordre (chèque) n’entre pas dans le traitement de l’ordre', () => {
      const cheque = changerStatutReglementFournisseur(creer({ id: 'c-1', factureId: 'f-9', mode: 'Chèque', iban: null }), 'Enregistré', { numeroPiece: '0001' })
      expect(() => ecrire([...enregistres, cheque], emis)).toThrow(/c-1 hors de l'ordre OV-1/)
      expect(() => ecrire([cheque], emis)).toThrow(/c-1 hors de l'ordre OV-1/)
    })

    it('l’ordre passé doit être émis et porter l’identifiant du traitement écrit', () => {
      expect(() => ecrire(enregistres, ordre)).toThrow(/OV-1 pas émis/)
      expect(() => ecrire(enregistres, { ...emis, traitementId: 't-autre' })).toThrow(/traitement t-autre, pas t-regl-1/)
    })

    it('tous les règlements de l’ordre, avec l’ordre émis : un traitement, une paire chacun, tous imputés', () => {
      const { traitement, reglements } = ecrire(enregistres, emis)
      expect(traitement).toMatchObject({ id: 't-regl-1', famille: 'Règlement de factures' })
      expect(traitement.mouvements).toHaveLength(4)
      expect(reglements.map((r) => [r.id, r.impute, r.traitementId])).toEqual([
        ['r-1', true, 't-regl-1'],
        ['r-2', true, 't-regl-1'],
      ])
    })
  })

  it('un règlement imputé n’entre dans aucun autre traitement : une seule écriture par paiement', () => {
    const { reglements } = traitementReglements([paye()], { id: 't-1', ...AU_29 })
    expect(() => traitementReglements(reglements, { id: 't-2', ...AU_29 })).toThrow(/déjà imputé.*t-1/)
  })

  it('deux paiements identiques (même fournisseur, même montant, même 512) : chacun sa paire, jamais l’imputation de l’un par l’écriture de l’autre', () => {
    const cheque = (id: string, factureId: string, numeroPiece: string) =>
      changerStatutReglementFournisseur(creer({ id, factureId, mode: 'Chèque', iban: null, montantCentimes: 1_000 }), 'Enregistré', { numeroPiece })
    const c1 = cheque('c-1', 'f-1', '0001')
    const c2 = cheque('c-2', 'f-2', '0002')
    const premier = traitementReglements([c1], { id: 't-1', ...AU_29 })
    expect(premier.reglements).toEqual([{ ...c1, impute: true, traitementId: 't-1' }])
    expect(premier.traitement.mouvements).toHaveLength(2)
    expect(() => traitementReglements([premier.reglements[0], c2], { id: 't-3', ...AU_29 })).toThrow(/c-1 déjà imputé.*t-1/)
    const second = traitementReglements([c2], { id: 't-3', ...AU_29 })
    expect(second.reglements).toEqual([{ ...c2, impute: true, traitementId: 't-3' }])
    expect(second.traitement.mouvements).toEqual(mouvementsReglement(c2).map((m) => ({ ...m, traitementId: 't-3' })))
    const rA = creer()
    const rB = creer({ id: 'r-2', factureId: 'f-2' })
    const ordre = ordreDe([rA, rB])
    const emis = emettreOrdre(ordre, '2026-10-29')
    const enregistres = enregistrerOrdreEmis(mettreDansOrdre([rA, rB], ordre), emis)
    const { traitement, reglements } = traitementReglements(enregistres, { id: 't-regl-1', ...AU_29, ordre: emis })
    expect(traitement.mouvements).toHaveLength(4)
    expect(reglements.map((r) => [r.id, r.impute])).toEqual([
      ['r-1', true],
      ['r-2', true],
    ])
  })

  it('hors ordre (chèque) : le traitement est rattaché au règlement', () => {
    const cheque = changerStatutReglementFournisseur(creer({ mode: 'Chèque', iban: null }), 'Enregistré', { numeroPiece: '0001234' })
    const { reglements } = traitementReglements([cheque], { id: 't-cheques', ...AU_29 })
    expect(reglements[0]).toMatchObject({ impute: true, traitementId: 't-cheques' })
  })

  it('🔴 contre-passation du traitement d’un règlement : non prise en charge, le règlement reste imputé sur le traitement annulé ; la question est posée dans l’en-tête', () => {
    const cheque = changerStatutReglementFournisseur(creer({ mode: 'Chèque', iban: null }), 'Enregistré', { numeroPiece: '0001234' })
    const { traitement, reglements } = traitementReglements([cheque], { id: 't-cheques', ...AU_29 })
    expect(annulerTraitement(traitement, { id: 't-annul', date: '2026-10-30' })).toMatchObject({ famille: 'Annulation de règlements', annule: 't-cheques' })
    const [ecrit] = reglements
    expect(ecrit).toMatchObject({ statut: 'Enregistré', impute: true, traitementId: 't-cheques' })
    expect(() => traitementReglements([ecrit], { id: 't-reprise', ...AU_29 })).toThrow(/déjà imputé/)
    expect(() => changerStatutReglementFournisseur(ecrit, 'Annulé')).toThrow(/Transition refusée/)
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'reglements-fournisseurs.ts'), 'utf8')
    const nonEtabli = source.slice(source.indexOf('🔴 Non établi'), source.indexOf('*/')).replace(/\s*\n\s*\*\s*/g, ' ')
    expect(nonEtabli).toMatch(/contre-passation du traitement d'un règlement \(annulerTraitement[^;]*non prise en charge/)
    expect(nonEtabli).toMatch(/Question : [^;]*« Non imputé »[^;]*« Annulé »[^;]*facture/)
  })
})

describe('paiement sur plusieurs mandats : seulement depuis le compte du cabinet (D-BANQUE)', () => {
  const cabinet = () => 'centralisateur_cabinet' as const
  const sousCompte = () => 'sous_compte_centralisateur' as const
  const m1 = creer({ banqueId: 'b-cab-1' })
  const saisieRoses = saisie({ id: 'r-2', factureId: 'f-2', coproprieteId: 'copro-roses', mandatId: 'm-2', banqueId: 'b-cab-2', contrepartie512: 'ROSE.51200.00001.0' })
  const m2Cree = () => creerReglementFournisseur(saisieRoses, { segmentSyndicat: 'ROSE' })

  it('chaque part reste sur son syndicat, son mandat et sa propre contrepartie 512', () => {
    expect(() => creerReglementFournisseur(saisieRoses, { segmentSyndicat: SEGMENT })).toThrow(/syndicat/)
    expect(m2Cree().contrepartie512).toBe('ROSE.51200.00001.0')
  })

  it('un seul mandat et un seul compte : rien à signaler', () => {
    expect(controlerPaiementPlusieursMandats([creer(), creer({ id: 'r-2' })], { modeDuMandat: () => 'compte_separe_syndicat', natureDuCompte: () => 'courant' })).toEqual([])
  })

  it('plusieurs mandats, tous en compte centralisateur du cabinet, sur leurs sous-comptes : admis', () => {
    expect(controlerPaiementPlusieursMandats([m1, m2Cree()], { modeDuMandat: cabinet, natureDuCompte: sousCompte })).toEqual([])
  })

  it('un mandat hors du mode « centralisateur du cabinet », ou un compte qui n’est pas un sous-compte : bloquant', () => {
    const anomalies = controlerPaiementPlusieursMandats([m1, m2Cree()], {
      modeDuMandat: (mandatId) => (mandatId === 'm-2' ? 'compte_separe_syndicat' : 'centralisateur_cabinet'),
      natureDuCompte: (banqueId) => (banqueId === 'b-cab-1' ? 'courant' : 'sous_compte_centralisateur'),
    })
    expect(anomalies.map((a) => a.code)).toEqual(['plusieurs_mandats_hors_compte_cabinet', 'plusieurs_mandats_hors_compte_cabinet'])
    expect(anomalies[0].message).toMatch(/^Mandat m-2 /)
    expect(anomalies[1].message).toMatch(/^Compte b-cab-1 /)
  })

  it('jamais le compte du fonds de travaux regroupé avec un autre compte, même au sein d’un seul mandat ; groupé sur ce seul compte : admis', () => {
    const contexte: ContextePaiement = {
      modeDuMandat: cabinet,
      natureDuCompte: (banqueId) => (banqueId === 'b-fonds' ? 'fonds_travaux' : 'sous_compte_centralisateur'),
    }
    const courant = creer()
    const fonds = creer({ id: 'r-2', factureId: 'f-2', banqueId: 'b-fonds' })
    const anomalies = controlerPaiementPlusieursMandats([courant, fonds], contexte)
    expect(anomalies).toEqual([expect.objectContaining({ code: 'fonds_travaux_regroupe', fondement: 'L. 1965 art. 18, II, al. 4' })])
    expect(anomalies[0].message).toMatch(/jamais regroupé avec un autre compte, mandat ou syndicat/)
    const fonds2 = creer({ id: 'r-3', factureId: 'f-3', banqueId: 'b-fonds' })
    expect(controlerPaiementPlusieursMandats([fonds, fonds2], contexte)).toEqual([])
  })

  it('un paiement va à un seul bénéficiaire, sur un seul IBAN, par un seul mode', () => {
    const contexte = { modeDuMandat: cabinet, natureDuCompte: sousCompte }
    const autreFournisseur = creer({ id: 'r-2', beneficiaire: { ...FOURNISSEUR, prestataireId: 'p-ascenseurs' } })
    const autreIban = creer({ id: 'r-3', iban: IBAN_AUTRE })
    const cheque = creer({ id: 'r-4', mode: 'Chèque' })
    expect(controlerPaiementPlusieursMandats([creer(), autreFournisseur], contexte).map((a) => a.code)).toEqual(['beneficiaires_differents'])
    expect(controlerPaiementPlusieursMandats([creer(), autreIban], contexte).map((a) => a.code)).toEqual(['beneficiaires_differents'])
    expect(controlerPaiementPlusieursMandats([creer(), cheque], contexte).map((a) => a.code)).toEqual(['modes_differents'])
  })
})

describe('bénéficiaire indivisaire', () => {
  const position = (surcharge: Partial<Position> = {}): Position => ({
    id: 'pos-1',
    identiteId: 'id-7',
    lotId: 'lot-14',
    compteId: 'cpt-14',
    qualite: 'Indivisaire',
    part: { numerateur: 1, denominateur: 2 },
    statut: 'En place',
    dateEntree: '2020-01-15',
    dateSortie: null,
    ...surcharge,
  })
  const r = creer({ beneficiaire: INDIVISAIRE, factureId: null })

  it('admis si l’identité est indivisaire en place, à la date, sur le compte débité', () => {
    expect(controlerBeneficiaireIndivisaire(r, [position()], '2026-10-29')).toEqual([])
  })

  it('signalé si la position est sortie, sur un autre compte ou d’une autre qualité', () => {
    for (const surcharge of [{ dateSortie: '2026-06-30' }, { compteId: 'cpt-99' }, { qualite: 'Copropriétaire' as const }, { identiteId: 'id-8' }])
      expect(controlerBeneficiaireIndivisaire(r, [position(surcharge)], '2026-10-29').map((a) => a.code)).toEqual(['indivisaire_sans_position'])
  })

  it('sans objet pour un autre bénéficiaire ; date contrôlée', () => {
    expect(controlerBeneficiaireIndivisaire(creer(), [], '2026-10-29')).toEqual([])
    expect(() => controlerBeneficiaireIndivisaire(r, [position()], '29/10/2026')).toThrow(/AAAA-MM-JJ/)
  })
})

describe('statut « Rapproché » propagé depuis l’arrêté', () => {
  const r1 = creer()
  const r2 = creer({ id: 'r-2', factureId: 'f-2', montantCentimes: 30_000 })
  const ordre = emettreOrdre(ordreDe([r1, r2], 'mandat'), '2026-10-29')
  const enregistres = enregistrerOrdreEmis(mettreDansOrdre([r1, r2], ordreDe([r1, r2], 'mandat')), ordre)
  const [ligne] = ordre.lignes
  const arrete = (rapproche: false | 'auto', banqueId = 'b-courant'): ArreteRapprochement => ({
    id: 'a-1',
    banqueId,
    dateArrete: '2026-11-10',
    soldeBanqueCentimes: 0,
    soldeComptaCentimes: 0,
    statut: 'En cours',
    elements: [
      {
        id: 'rel-1',
        cote: 'banque',
        montantCentimes: -ligne.montantCentimes,
        rapproche,
        date: '2026-10-30',
        rapprocheLe: rapproche ? '2026-11-02' : null,
        pieces: reglementsDeLigne(ligne).map((id) => ({ type: 'reglement' as const, id })),
      },
    ],
  })

  it('la ligne du relevé du virement groupé rapproche ses deux règlements ; le dépointage les ramène à « Enregistré »', () => {
    const rapproches = rapprocherReglements(enregistres, [arrete('auto')])
    expect(rapproches.anomalies).toEqual([])
    expect(rapproches.reglements.map((r) => [r.statut, r.rapprochement?.elementId])).toEqual([
      ['Rapproché', 'rel-1'],
      ['Rapproché', 'rel-1'],
    ])
    expect(rapprocherReglements(rapproches.reglements, [arrete(false)]).reglements).toEqual(enregistres)
  })

  it('arrêté d’un autre compte que le compte payeur : anomalie, rien n’est propagé', () => {
    const { reglements, anomalies } = rapprocherReglements(enregistres, [arrete('auto', 'b-autre')])
    expect(anomalies.map((a) => a.code)).toEqual(['autre_compte', 'autre_compte'])
    expect(reglements.map((r) => r.statut)).toEqual(['Enregistré', 'Enregistré'])
  })

  it('à une date antérieure au pointage, les règlements restent « Enregistré »', () => {
    expect(rapprocherReglements(enregistres, [arrete('auto')], { aLaDate: '2026-11-01' }).reglements.map((r) => r.statut)).toEqual([
      'Enregistré',
      'Enregistré',
    ])
  })
})
