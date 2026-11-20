import { describe, expect, it } from 'vitest'
import { creerOrdreVirement, emettreOrdre, type LigneVirement } from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import {
  LIBELLE_ACOMPTE_SUR_COMMANDE,
  LIBELLE_BENEFICIAIRE_REMUNERATION,
  MOTIFS_ANNULATION_REGLEMENT,
  annulerReglement,
  changerStatutReglementFournisseur,
  controlerAcompteSurCommande,
  controlerIbanApresRejet,
  controlerPaiementRemuneration,
  creerReglementFournisseur,
  enregistrerOrdreEmis,
  fraisRetourVirement,
  imputerAcompteSurFacture,
  mettreDansOrdre,
  mouvementsReglement,
  rapprocherReglements,
  rejeterVirement,
  traitementReglements,
  type BeneficiaireReglement,
  type ReglementFournisseur,
  type SaisieReglementFournisseur,
} from '@/lib/administrateur-judiciaire/domain/reglements-fournisseurs'
import {
  LIBELLE_ACTION_ANNULER_REGLEMENT,
  LIBELLES_MOTIF_ANNULATION_REGLEMENT,
  LIBELLES_SOURCE_VERIFICATION_IBAN,
  categorieRejet,
  changerStatutReglement,
  ibanAVerifier,
  ibanVerifieApresRejet,
  retourFactureApresAnnulation,
  retourFactureApresRejet,
  selectionnerFacturesAPayer,
  verifierIbanApresRejet,
  type FactureAPayer,
} from '@/lib/administrateur-judiciaire/domain/statuts-facture'
import type { PiecesEntreprise } from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'
import { enTeteDuModule } from './en-tete-module'

/**
 * Décisions du 20/11/2026 (partie C des questions ouvertes du code) sur les paiements : F83 (retour diminué de frais),
 * F84 (annulation d'un règlement), F87 (rémunération du cabinet), F88 (acompte sur commande), F92 (IBAN après un rejet
 * pour coordonnées). Données fictives.
 */

const SEGMENT = 'TILL'
const IBAN_FOURNISSEUR = 'FR76 3000 6000 0112 3456 7890 189'
const IBAN_AUTRE = 'FR14 2004 1010 0505 0001 3M02 606'
const FOURNISSEUR: BeneficiaireReglement = { type: 'fournisseur', prestataireId: 'p-plomberie', auxiliaire401: 'F0012' }

const saisie = (surcharge: Partial<SaisieReglementFournisseur> = {}): SaisieReglementFournisseur => ({
  id: 'r-1',
  coproprieteId: 'copro-tilleuls',
  mandatId: 'm-1',
  banqueId: 'b-courant',
  contrepartie512: 'TILL.51200.00001.0',
  beneficiaire: FOURNISSEUR,
  factureId: 'f-1',
  echeance: '2026-10-31',
  libelle: 'Facture F-118 plomberie (fictive)',
  montantCentimes: 120_000,
  mode: 'Virement',
  iban: IBAN_FOURNISSEUR,
  ...surcharge,
})

const creer = (surcharge: Partial<SaisieReglementFournisseur> = {}) => creerReglementFournisseur(saisie(surcharge), { segmentSyndicat: SEGMENT })

const ligne = (r: ReglementFournisseur): LigneVirement => ({
  reglementId: r.id,
  beneficiaire: 'Plomberie du Centre (fictif)',
  iban: r.iban ?? '',
  bic: null,
  montantCentimes: r.montantCentimes,
  libelle: r.libelle,
})

/** Virement d'un règlement : ordre émis le 29/10/2026, écrit dans le traitement t-regl-1. */
function virementEcrit(r: ReglementFournisseur) {
  const ordre = creerOrdreVirement({
    id: 'o-1',
    numero: 'OV-1',
    date: '2026-10-28',
    coproprieteId: 'copro-tilleuls',
    banqueId: 'b-courant',
    traitementId: 't-regl-1',
    lignes: [ligne(r)],
  })
  const emis = emettreOrdre(ordre, '2026-10-29')
  const enregistres = enregistrerOrdreEmis(mettreDansOrdre([r], ordre), emis)
  const ecrits = traitementReglements(enregistres, { id: 't-regl-1', date: '2026-10-29', ordre: emis })
  return { emis, ecriture: ecrits.traitement, reglement: ecrits.reglements[0] }
}

/** Chèque payé hors ordre, écrit dans le traitement t-cheques. */
function chequeEcrit(surcharge: Partial<SaisieReglementFournisseur> = {}) {
  const cheque = changerStatutReglementFournisseur(creer({ mode: 'Chèque', iban: null, ...surcharge }), 'Enregistré', { numeroPiece: '0001234' })
  const ecrits = traitementReglements([cheque], { id: 't-cheques', date: '2026-10-29' })
  return { ecriture: ecrits.traitement, reglement: ecrits.reglements[0] }
}

const facture = (surcharge: Partial<FactureAPayer> = {}): FactureAPayer => ({
  id: 'f-1',
  prestataireId: 'p-plomberie',
  mode: 'Virement',
  statutSaisie: 'Réglée',
  comptabilisee: true,
  statutReglement: 'Réglée',
  priorite: 5,
  echeance: '2026-10-31',
  resteDuCentimes: 0,
  ...surcharge,
})

const solde = (mouvements: readonly { compte: string; sens: string; montantCentimes: number }[], compte: string): number =>
  mouvements.filter((m) => m.compte === compte).reduce((s, m) => s + (m.sens === 'debit' ? m.montantCentimes : -m.montantCentimes), 0)

describe('F83 — virement rejeté revenu diminué de frais : écriture contraire entière, frais au 662', () => {
  const { emis, ecriture, reglement } = virementEcrit(creer())
  const rejete = rejeterVirement([reglement], emis, { id: 't-annul-1', date: '2026-11-03', motif: 'AC04 — compte clos' }, ecriture)

  it('l’écriture contraire garde le montant entier (J9) ; les frais s’écrivent à part, datés du retour : débit 662, crédit 512', () => {
    expect(solde(rejete.traitement.mouvements, 'TILL.51200.00001.0')).toBe(120_000)
    const { traitement, reglements, alertes } = fraisRetourVirement(rejete.reglements, { traitementId: 't-frais-1', montantRevenuCentimes: 118_500 })
    expect(traitement).toMatchObject({ id: 't-frais-1', famille: 'Saisie de mouvements', date: '2026-11-03' })
    expect(traitement?.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      ['TILL.66200.00000.0', 'debit', 1_500],
      ['TILL.51200.00001.0', 'credit', 1_500],
    ])
    // la banque n'a rendu que 1 185 € : le 512 porte ce qui est revenu, le 401 la dette entière
    const tout = [...ecriture.mouvements, ...rejete.traitement.mouvements, ...(traitement?.mouvements ?? [])]
    expect(solde(tout, 'TILL.51200.00001.0')).toBe(-1_500)
    expect(solde(tout, mouvementsReglement(reglement)[0].compte)).toBe(0)
    expect(reglements[0].rejet).toMatchObject({ montantRevenuCentimes: 118_500, fraisTraitementId: 't-frais-1' })
    expect(alertes).toEqual([])
  })

  it('512 du compte qui a reçu le retour ; aucun frais : rien à écrire ; alerte si les frais dépassent le montant du cabinet', () => {
    const autre512 = fraisRetourVirement(rejete.reglements, { traitementId: 't-frais-2', montantRevenuCentimes: 118_500, compte512Retour: 'TILL.51210.00002.0' })
    expect(autre512.traitement?.mouvements[1]).toMatchObject({ compte: 'TILL.51210.00002.0', sens: 'credit' })
    const entier = fraisRetourVirement(rejete.reglements, { traitementId: 't-frais-3', montantRevenuCentimes: 120_000 })
    expect(entier.traitement).toBeNull()
    expect(entier.reglements[0].rejet).toMatchObject({ montantRevenuCentimes: 120_000, fraisTraitementId: null })
    const [alerte] = fraisRetourVirement(rejete.reglements, { traitementId: 't-frais-4', montantRevenuCentimes: 118_500, seuilAlerteFraisCentimes: 1_000 }).alertes
    expect(alerte).toMatchObject({ code: 'frais_retour_au_dela_du_seuil' })
    expect(alerte.message).toContain('Décision du 20/11/2026 (partie C, F83)')
  })

  it('la facture redevient due pour son montant entier ; contrôles de saisie', () => {
    const revenue = retourFactureApresRejet(
      facture(),
      { reglementId: 'r-1', le: '2026-11-03', motif: 'AC04 — compte clos', montantCentimes: 120_000 },
      { totalTtcCentimes: 120_000 },
    )
    expect(revenue).toMatchObject({ statutReglement: 'Bon à payer', resteDuCentimes: 120_000 })
    expect(() => fraisRetourVirement([reglement], { traitementId: 't-f', montantRevenuCentimes: 100 })).toThrow(/rejeté/)
    expect(() => fraisRetourVirement(rejete.reglements, { traitementId: 't-f', montantRevenuCentimes: 120_001 })).toThrow(/plus que/)
    expect(() => fraisRetourVirement(rejete.reglements, { traitementId: 't-f', montantRevenuCentimes: 10.5 })).toThrow(/centimes/)
    expect(() => fraisRetourVirement(rejete.reglements, { traitementId: ' ', montantRevenuCentimes: 100 })).toThrow(/identifiant/)
    expect(() => fraisRetourVirement(rejete.reglements, { traitementId: 't-f', montantRevenuCentimes: 100, compte512Retour: 'AUTR.51200.00001.0' })).toThrow(/autre syndicat/)
    const deja = fraisRetourVirement(rejete.reglements, { traitementId: 't-frais-1', montantRevenuCentimes: 118_500 }).reglements
    expect(() => fraisRetourVirement(deja, { traitementId: 't-frais-9', montantRevenuCentimes: 118_500 })).toThrow(/déjà/)
  })
})

describe('F84 — « Annuler le règlement » : motif obligatoire, écriture contraire, « Annulé » définitif, facture revenue', () => {
  it('chèque perdu : écriture contraire datée de l’annulation, sous renvoi à l’écriture d’origine ; règlement « Annulé »', () => {
    const { ecriture, reglement } = chequeEcrit()
    const { traitement, reglement: annule } = annulerReglement(reglement, { id: 't-annul-c', date: '2026-11-05', motif: 'cheque_perdu', precision: null }, ecriture)
    expect(traitement).toMatchObject({ id: 't-annul-c', famille: 'Annulation de règlements', date: '2026-11-05', annule: 't-cheques' })
    expect(solde([...ecriture.mouvements, ...traitement.mouvements], 'TILL.51200.00001.0')).toBe(0)
    expect(annule).toMatchObject({
      statut: 'Annulé',
      impute: true,
      traitementId: 't-cheques',
      annulation: { le: '2026-11-05', motif: 'cheque_perdu', precision: null, traitementId: 't-annul-c', ecritureOrigineId: 't-cheques' },
    })
    // définitif : ni nouvelle annulation, ni changement de statut
    expect(() => annulerReglement(annule, { id: 't-annul-d', date: '2026-11-06', motif: 'opposition', precision: null }, ecriture)).toThrow(/déjà annulé/)
    expect(() => changerStatutReglementFournisseur(annule, 'Demandé')).toThrow(/Transition refusée/)
  })

  it('motifs de la liste seulement, compatibles avec le mode ; un virement rejeté passe par J9', () => {
    expect(MOTIFS_ANNULATION_REGLEMENT).toEqual(['cheque_perdu', 'opposition', 'cheque_jamais_encaisse', 'prelevement_conteste', 'erreur_ecriture'])
    const { ecriture, reglement } = chequeEcrit()
    expect(() => annulerReglement(reglement, { id: 't-x', date: '2026-11-05', motif: 'autre' as never, precision: null }, ecriture)).toThrow(/Motif/)
    expect(() => annulerReglement(reglement, { id: 't-x', date: '2026-11-05', motif: 'prelevement_conteste', precision: null }, ecriture)).toThrow(/Chèque/)
    expect(() => annulerReglement(reglement, { id: 't-x', date: '05/11/2026', motif: 'cheque_perdu', precision: null }, ecriture)).toThrow(/AAAA-MM-JJ/)
    expect(() => annulerReglement(reglement, { id: 't-cheques', date: '2026-11-05', motif: 'cheque_perdu', precision: null }, ecriture)).toThrow(/propre identifiant/)
    const v = virementEcrit(creer())
    expect(() => annulerReglement(v.reglement, { id: 't-x', date: '2026-11-05', motif: 'opposition', precision: null }, v.ecriture)).toThrow(/rejeterVirement/)
    // erreur d'écriture : admise pour tout mode, virement compris
    const erreur = annulerReglement(v.reglement, { id: 't-x', date: '2026-11-05', motif: 'erreur_ecriture', precision: ' Double saisie ' }, v.ecriture)
    expect(erreur.reglement.annulation).toMatchObject({ motif: 'erreur_ecriture', precision: 'Double saisie' })
    // prélèvement contesté
    const prelevement = changerStatutReglementFournisseur(creer({ mode: 'Prélèvement', iban: null }), 'Enregistré')
    const p = traitementReglements([prelevement], { id: 't-prel', date: '2026-10-29' })
    expect(annulerReglement(p.reglements[0], { id: 't-y', date: '2026-11-05', motif: 'prelevement_conteste', precision: null }, p.traitement).reglement.statut).toBe('Annulé')
    // non écrit : rien à contre-passer
    expect(() => annulerReglement(prelevement, { id: 't-z', date: '2026-11-05', motif: 'prelevement_conteste', precision: null }, p.traitement)).toThrow(/écrire d'abord/)
  })

  it('la facture revient à son état d’avant le paiement, avec le motif, et se paie ensuite par un nouveau règlement', () => {
    const annulation = { reglementId: 'r-1', le: '2026-11-05', motif: 'cheque_perdu' as const, montantCentimes: 120_000 }
    const revenue = retourFactureApresAnnulation(facture(), annulation, { totalTtcCentimes: 120_000 })
    expect(revenue).toMatchObject({ statutReglement: 'Bon à payer', statutSaisie: 'Enregistrée', resteDuCentimes: 120_000, annulations: [annulation] })
    const acompte = retourFactureApresAnnulation(facture({ statutReglement: 'En attente', statutSaisie: 'Rgt. partiel', resteDuCentimes: 80_000 }), { ...annulation, montantCentimes: 40_000 }, { totalTtcCentimes: 120_000 })
    expect(acompte).toMatchObject({ statutReglement: 'Acompte à régler', acompteCentimes: 40_000, resteDuCentimes: 120_000 })
    expect(() => retourFactureApresAnnulation(revenue, annulation, { totalTtcCentimes: 120_000 })).toThrow(/déjà annulé/)
    expect(() => retourFactureApresAnnulation(facture(), { ...annulation, motif: 'autre' as never }, { totalTtcCentimes: 120_000 })).toThrow(/Motif/)
    expect(() => retourFactureApresAnnulation(facture({ statutReglement: 'Bon à payer' }), annulation, { totalTtcCentimes: 120_000 })).toThrow(/nouveau cycle/)
  })

  it('rapprochement : un chèque annulé après son pointage reste « Annulé »', () => {
    const { ecriture, reglement } = chequeEcrit()
    const { reglement: annule } = annulerReglement(reglement, { id: 't-annul-c', date: '2026-11-05', motif: 'opposition', precision: null }, ecriture)
    expect(rapprocherReglements([annule], []).reglements[0].statut).toBe('Annulé')
    expect(rapprocherReglements([annule], [], { aLaDate: '2026-11-01' }).reglements[0].statut).toBe('Enregistré')
  })

  it('en-têtes : la question de l’annulation hors virement rejeté est remplacée par la décision', () => {
    const { texte } = enTeteDuModule('reglements-fournisseurs')
    const questions = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(questions).not.toContain('chèque émis puis perdu')
    expect(questions).not.toContain("contre-passation du traitement d'un règlement")
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F84)')
    expect(texte).toContain('arrêté du 14 mars 2005, art. 5')
    expect(enTeteDuModule('statuts-facture').texte).toContain('Décision du 20/11/2026 (partie C, F84)')
  })
})

describe('F87 — rémunération du cabinet : bénéficiaire « administrateur provisoire (rémunération) », base citée, cumul plafonné', () => {
  const ORDONNANCE = { nature: 'ordonnance' as const, objet: 'acompte' as const, juridiction: 'Tribunal judiciaire (fictif)', date: '2026-09-15', numero: 'RG 26/00042' }
  const AP = (base: Extract<BeneficiaireReglement, { type: 'administrateur_provisoire' }>['base'] = ORDONNANCE): BeneficiaireReglement => ({
    type: 'administrateur_provisoire',
    cabinetId: 'cab-1',
    auxiliaire401: 'C0001',
    base,
  })

  it('même circuit que les factures : débit du 401 du cabinet, famille « Règlement de factures »', () => {
    const r = creer({ beneficiaire: AP(), factureId: 'fh-1', montantCentimes: 180_000 })
    expect(mouvementsReglement(r)[0]).toMatchObject({ compte: 'TILL.40100.C0001.0', sens: 'debit', liens: { fournisseurId: 'cab-1' } })
    const cheque = changerStatutReglementFournisseur(creer({ beneficiaire: AP(), factureId: 'fh-1', mode: 'Chèque', iban: null }), 'Enregistré', { numeroPiece: '42' })
    expect(traitementReglements([cheque], { id: 't-h', date: '2026-10-29' }).traitement.famille).toBe('Règlement de factures')
  })

  it('chaque paiement cite sa base : droit fixe, ordonnance (juridiction, date, n°) ou contrat', () => {
    expect(creer({ beneficiaire: AP({ nature: 'droit_fixe' }), factureId: 'fh-1' }).beneficiaire).toMatchObject({ base: { nature: 'droit_fixe' } })
    expect(creer({ beneficiaire: AP({ nature: 'contrat', reference: 'Contrat de syndic du 01/07/2026' }), factureId: 'fh-1' }).beneficiaire.type).toBe('administrateur_provisoire')
    expect(() => creer({ beneficiaire: AP({ ...ORDONNANCE, numero: ' ' }), factureId: 'fh-1' })).toThrow(/juridiction, date, n°/)
    expect(() => creer({ beneficiaire: AP({ ...ORDONNANCE, date: '15/09/2026' }), factureId: 'fh-1' })).toThrow(/juridiction, date, n°/)
    expect(() => creer({ beneficiaire: AP({ nature: 'contrat', reference: '' }), factureId: 'fh-1' })).toThrow(/contrat/)
    expect(() => creer({ beneficiaire: AP(), factureId: null })).toThrow(/facture/)
  })

  it('le cumul payé sur une même base ne dépasse jamais le montant fixé : bloquant au-delà', () => {
    const premier = creer({ id: 'h-1', beneficiaire: AP(), factureId: 'fh-1', montantCentimes: 120_000 })
    const second = creer({ id: 'h-2', beneficiaire: AP(), factureId: 'fh-2', montantCentimes: 60_000 })
    expect(controlerPaiementRemuneration(second, { montantFixeCentimes: 180_000, reglements: [premier] })).toEqual([])
    const [refus] = controlerPaiementRemuneration(second, { montantFixeCentimes: 150_000, reglements: [premier] })
    expect(refus).toMatchObject({ code: 'remuneration_au_dela_du_montant_fixe', fondement: 'D. 1967 art. 61-1-5' })
    expect(refus.message).toContain('Décision du 20/11/2026 (partie C, F87)')
    // un règlement annulé, ou d'une autre base, ne compte pas
    expect(controlerPaiementRemuneration(second, { montantFixeCentimes: 150_000, reglements: [{ ...premier, statut: 'Annulé' }] })).toEqual([])
    const autreBase = creer({ id: 'h-3', beneficiaire: AP({ ...ORDONNANCE, numero: 'RG 26/00099' }), factureId: 'fh-3', montantCentimes: 120_000 })
    expect(controlerPaiementRemuneration(second, { montantFixeCentimes: 150_000, reglements: [autreBase] })).toEqual([])
    expect(controlerPaiementRemuneration(creer(), { montantFixeCentimes: 0, reglements: [] })).toEqual([])
    expect(() => controlerPaiementRemuneration(second, { montantFixeCentimes: -1, reglements: [] })).toThrow(/centimes/)
  })

  it('en-tête : la question des honoraires du cabinet est remplacée par la décision', () => {
    const { texte } = enTeteDuModule('reglements-fournisseurs')
    expect(texte.slice(texte.indexOf('🔴 Non établi'))).not.toContain('honoraires du cabinet réglés par le même circuit')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F87)')
    expect(texte).toContain('D. 1967 art. 61-1-5')
  })
})

describe('F88 — acompte sur commande : sans facture, référence de l’OS ou du marché, débit du 409, imputé sur la facture', () => {
  const ACOMPTE = { reference: 'OS 125.20261001.6', montantPrevuCentimes: 30_000 }
  const acompteSaisi = (surcharge: Partial<SaisieReglementFournisseur> = {}) => creer({ factureId: null, acompteSurCommande: ACOMPTE, montantCentimes: 30_000, ...surcharge })

  it('règlement sans facture, avec la référence obligatoire et le montant prévu ; débit du 409 du fournisseur', () => {
    const r = acompteSaisi()
    expect(r.acompteSurCommande).toEqual({ ...ACOMPTE, imputation: null })
    expect(mouvementsReglement(r).map((m) => [m.compte, m.sens])).toEqual([
      ['TILL.40900.F0012.0', 'debit'],
      ['TILL.51200.00001.0', 'credit'],
    ])
    expect(() => acompteSaisi({ factureId: 'f-1' })).toThrow(/sans facture/)
    expect(() => acompteSaisi({ acompteSurCommande: { ...ACOMPTE, reference: ' ' } })).toThrow(/référence/)
    expect(() => acompteSaisi({ acompteSurCommande: { ...ACOMPTE, montantPrevuCentimes: 0 } })).toThrow(/montant prévu/)
    expect(() => creer({ factureId: null })).toThrow(/facture réglée est obligatoire/)
    expect(() => creer({ beneficiaire: { type: 'coproprietaire', compteCoproprietaireId: 'cpt-1', serie450: '00001' }, factureId: null, acompteSurCommande: ACOMPTE })).toThrow(/fournisseur/)
  })

  it('alerte si l’acompte dépasse celui prévu ; vigilance contrôlée comme avant l’OS', () => {
    const PIECES: PiecesEntreprise = {
      prestataireId: 'p-plomberie',
      etablieEnFrance: true,
      attestationUrssafLe: '2026-09-01',
      attestationUrssafVerifiee: true,
      immatriculation: { nature: 'kbis', le: '2026-09-01' },
      listeSalariesEtrangersLe: '2026-09-01',
    }
    const operation = { date: '2026-10-20', montantHtCentimes: 600_000, decennaleObligatoire: false }
    const r = acompteSaisi({ montantCentimes: 20_000 })
    const deja = acompteSaisi({ id: 'r-0', montantCentimes: 15_000 })
    const anomalies = controlerAcompteSurCommande(r, { autres: [deja], pieces: PIECES, operation })
    expect(anomalies.map((a) => [a.code, a.gravite])).toEqual([['acompte_au_dela_du_prevu', 'alerte']])
    expect(anomalies[0].message).toContain('Décision du 20/11/2026 (partie C, F88)')
    expect(controlerAcompteSurCommande(r, { autres: [], pieces: PIECES, operation })).toEqual([])
    const sansAttestation = controlerAcompteSurCommande(r, { autres: [], pieces: { ...PIECES, attestationUrssafLe: null }, operation })
    expect(sansAttestation.map((a) => [a.code, a.gravite])).toEqual([['vigilance_urssaf_absente', 'bloquant']])
    expect(() => controlerAcompteSurCommande(creer(), { autres: [], pieces: PIECES, operation })).toThrow(/acompte sur commande/)
  })

  it('à l’arrivée de la facture, l’acompte s’impute dessus : débit 401, crédit 409, le 409 se solde', () => {
    const paye = changerStatutReglementFournisseur(acompteSaisi({ mode: 'Chèque', iban: null }), 'Enregistré', { numeroPiece: '77' })
    const ecrit = traitementReglements([paye], { id: 't-acompte', date: '2026-10-20' })
    const impute = imputerAcompteSurFacture(ecrit.reglements[0], { id: 'f-9', prestataireId: 'p-plomberie', resteDuCentimes: 100_000 }, { id: 't-imput', date: '2026-11-10' })
    expect(impute.traitement.mouvements.map((m) => [m.compte, m.sens, m.montantCentimes])).toEqual([
      ['TILL.40100.F0012.0', 'debit', 30_000],
      ['TILL.40900.F0012.0', 'credit', 30_000],
    ])
    expect(solde([...ecrit.traitement.mouvements, ...impute.traitement.mouvements], 'TILL.40900.F0012.0')).toBe(0)
    expect(impute.resteDuCentimes).toBe(70_000)
    expect(impute.acompte.acompteSurCommande?.imputation).toEqual({ factureId: 'f-9', le: '2026-11-10', traitementId: 't-imput' })
    expect(() => imputerAcompteSurFacture(impute.acompte, { id: 'f-10', prestataireId: 'p-plomberie', resteDuCentimes: 100_000 }, { id: 't-imput-2', date: '2026-11-10' })).toThrow(/déjà imputé/)
    expect(() => imputerAcompteSurFacture(ecrit.reglements[0], { id: 'f-9', prestataireId: 'p-autre', resteDuCentimes: 100_000 }, { id: 't-i', date: '2026-11-10' })).toThrow(/autre fournisseur/)
    expect(() => imputerAcompteSurFacture(ecrit.reglements[0], { id: 'f-9', prestataireId: 'p-plomberie', resteDuCentimes: 20_000 }, { id: 't-i', date: '2026-11-10' })).toThrow(/reste dû/)
    expect(() => imputerAcompteSurFacture(paye, { id: 'f-9', prestataireId: 'p-plomberie', resteDuCentimes: 100_000 }, { id: 't-i', date: '2026-11-10' })).toThrow(/écrire d'abord/)
  })

  it('en-tête : la question de l’acompte sans facture est remplacée par la décision ; la provision de l’art. 37 reste à part', () => {
    const { texte } = enTeteDuModule('reglements-fournisseurs')
    expect(texte.slice(texte.indexOf('🔴 Non établi'))).not.toContain('acompte versé sur commande sans facture')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F88)')
    expect(texte).toContain('D. 1967 art. 37')
  })
})

describe('F92 — rejet pour coordonnées : facture « Bon à payer » bloquée pour tout nouvel ordre tant que l’IBAN n’est pas changé ou confirmé', () => {
  const REJET = { reglementId: 'r-1', le: '2026-11-03', motif: 'AC04 — compte clos', montantCentimes: 120_000 }
  const revenue = retourFactureApresRejet(facture(), REJET, { totalTtcCentimes: 120_000 })
  const CONFIRMATION = {
    nature: 'confirmation' as const,
    iban: IBAN_FOURNISSEUR,
    saisiPar: 'col-gestion',
    confirmePar: 'col-direction',
    source: 'courrier_entreprise' as const,
    pieceId: 'doc-courrier-1',
    le: '2026-11-04',
  }

  it('le motif est classé : coordonnées (compte clos, IBAN faux, titulaire inconnu) ou autre ; un classement saisi l’emporte', () => {
    expect(categorieRejet({ motif: 'AC04 — compte clos' })).toBe('coordonnees')
    expect(categorieRejet({ motif: 'IBAN erroné' })).toBe('coordonnees')
    expect(categorieRejet({ motif: 'Titulaire inconnu' })).toBe('coordonnees')
    expect(categorieRejet({ motif: 'Provision insuffisante' })).toBe('autre')
    expect(categorieRejet({ motif: 'Provision insuffisante', categorie: 'coordonnees' })).toBe('coordonnees')
    // codes de motif SEPA des retours portant sur les coordonnées, seuls ou suivis du texte de la banque
    for (const code of ['AC01', 'AC04', 'AC06', 'BE01', 'RC01']) expect(categorieRejet({ motif: `${code} — retour` })).toBe('coordonnees')
    expect(categorieRejet({ motif: 'AM04' })).toBe('autre')
    expect(categorieRejet({ motif: 'XAC014' })).toBe('autre')
  })

  it('revenue « Bon à payer », elle n’entre dans aucun ordre tant que l’IBAN n’est pas confirmé', () => {
    expect(revenue.statutReglement).toBe('Bon à payer')
    expect(ibanAVerifier(revenue)).toMatchObject({ reglementId: 'r-1' })
    const selection = selectionnerFacturesAPayer([revenue], { date: '2026-11-05', soldeDisponibleCentimes: 1_000_000 })
    expect(selection.ecartees).toEqual([{ factureId: 'f-1', motif: 'iban_a_confirmer' }])
    expect(() => changerStatutReglement(revenue, 'En règlement')).toThrow(/IBAN à changer ou confirmer/)
    // un autre motif de rejet suit J9 sans changement
    const autre = retourFactureApresRejet(facture(), { ...REJET, motif: 'Provision insuffisante' }, { totalTtcCentimes: 120_000 })
    expect(ibanAVerifier(autre)).toBeNull()
    expect(selectionnerFacturesAPayer([autre], { date: '2026-11-05', soldeDisponibleCentimes: 1_000_000 }).retenues).toHaveLength(1)
  })

  it('confirmation à quatre yeux, avec sa source, tracée ; ensuite la facture repart', () => {
    const confirmee = verifierIbanApresRejet(revenue, CONFIRMATION)
    // la vérification est rattachée au rejet qu'elle suit (relecture : un nouveau rejet le même jour bloque de nouveau)
    expect(confirmee.verificationsIban).toEqual([{ ...CONFIRMATION, rejetReglementId: 'r-1' }])
    expect(ibanAVerifier(confirmee)).toBeNull()
    expect(selectionnerFacturesAPayer([confirmee], { date: '2026-11-05', soldeDisponibleCentimes: 1_000_000 }).retenues).toHaveLength(1)
    expect(() => verifierIbanApresRejet(revenue, { ...CONFIRMATION, confirmePar: 'col-gestion' })).toThrow(/autre personne/)
    expect(() => verifierIbanApresRejet(revenue, { ...CONFIRMATION, source: 'telephone' as never })).toThrow(/source/)
    expect(() => verifierIbanApresRejet(revenue, { ...CONFIRMATION, iban: 'FR76 3000 6000 0112 3456 7890 188' })).toThrow(/IBAN/)
    expect(() => verifierIbanApresRejet(revenue, { ...CONFIRMATION, le: '2026-11-02' })).toThrow(/avant le rejet/)
    expect(() => verifierIbanApresRejet(facture(), CONFIRMATION)).toThrow(/aucun rejet pour coordonnées/)
  })

  it('le nouveau règlement part vers l’IBAN changé ou confirmé, sinon il est refusé', () => {
    const r = creer({ id: 'r-2' })
    expect(controlerIbanApresRejet(r, revenue).map((a) => a.code)).toEqual(['iban_a_confirmer_apres_rejet'])
    const change = verifierIbanApresRejet(revenue, { ...CONFIRMATION, nature: 'changement', iban: IBAN_AUTRE })
    expect(controlerIbanApresRejet(r, change).map((a) => a.code)).toEqual(['iban_different_de_l_iban_verifie'])
    expect(controlerIbanApresRejet(creer({ id: 'r-3', iban: IBAN_AUTRE }), change)).toEqual([])
    expect(controlerIbanApresRejet(r, facture())).toEqual([])
    const [refus] = controlerIbanApresRejet(r, revenue)
    expect(refus.message).toContain('Décision du 20/11/2026 (partie C, F92)')
  })

  it('en-têtes : la question de l’IBAN après rejet est remplacée par la décision', () => {
    expect(enTeteDuModule('statuts-facture').texte).not.toContain('faut-il un nouveau bon à payer, ou un contrôle de l\'IBAN avant de la reprendre')
    expect(enTeteDuModule('statuts-facture').texte).toContain('Décision du 20/11/2026 (partie C, F92)')
    expect(enTeteDuModule('reglements-fournisseurs').texte).toContain('Décision du 20/11/2026 (partie C, F92)')
  })

  it('un règlement qui ne part pas par virement n’a pas d’IBAN à contrôler ; la facture doit être celle du règlement', () => {
    expect(controlerIbanApresRejet(creer({ id: 'r-4', mode: 'Chèque', iban: null }), revenue)).toEqual([])
    expect(() => controlerIbanApresRejet(creer({ id: 'r-5', factureId: 'f-2' }), revenue)).toThrow(/facture f-1/)
  })
})

describe('Décisions du 20/11/2026 (partie C) — libellés, compléments et en-tête de F83', () => {
  it('libellés décidés, portés par le domaine', () => {
    expect(LIBELLE_ACTION_ANNULER_REGLEMENT).toBe('Annuler le règlement')
    expect(LIBELLES_MOTIF_ANNULATION_REGLEMENT).toEqual({
      cheque_perdu: 'Chèque perdu',
      opposition: 'Opposition',
      cheque_jamais_encaisse: 'Chèque jamais encaissé',
      prelevement_conteste: 'Prélèvement contesté',
      erreur_ecriture: "Erreur d'écriture",
    })
    expect(LIBELLES_SOURCE_VERIFICATION_IBAN).toEqual({ courrier_entreprise: "Courrier de l'entreprise", rib: 'RIB' })
    expect(LIBELLE_BENEFICIAIRE_REMUNERATION).toBe('administrateur provisoire (rémunération)')
    expect(LIBELLE_ACOMPTE_SUR_COMMANDE).toBe('acompte sur commande')
  })

  it('F84 — motif selon le mode : opposition pour un chèque, un prélèvement ou un TIP ; prélèvement contesté jamais pour un chèque', () => {
    const prelevement = changerStatutReglementFournisseur(creer({ mode: 'Prélèvement', iban: null }), 'Enregistré')
    const p = traitementReglements([prelevement], { id: 't-prel', date: '2026-10-29' })
    expect(annulerReglement(p.reglements[0], { id: 't-y', date: '2026-11-05', motif: 'opposition', precision: null }, p.traitement).reglement.statut).toBe('Annulé')
    expect(() => annulerReglement(p.reglements[0], { id: 't-y', date: '2026-11-05', motif: 'cheque_perdu', precision: null }, p.traitement)).toThrow(/chèque/)
  })

  it('F84 — l’écriture contraire ne précède pas l’écriture d’origine ; un acompte imputé ne s’annule pas sans défaire l’imputation', () => {
    const { ecriture, reglement } = chequeEcrit()
    expect(() => annulerReglement(reglement, { id: 't-x', date: '2026-10-28', motif: 'cheque_perdu', precision: null }, ecriture)).toThrow(/antérieure/)
    const acompte = changerStatutReglementFournisseur(
      creer({ factureId: null, acompteSurCommande: { reference: 'OS 125.20261001.6', montantPrevuCentimes: 30_000 }, montantCentimes: 30_000, mode: 'Chèque', iban: null }),
      'Enregistré',
      { numeroPiece: '78' },
    )
    const ecrit = traitementReglements([acompte], { id: 't-acompte', date: '2026-10-20' })
    const { acompte: impute } = imputerAcompteSurFacture(ecrit.reglements[0], { id: 'f-9', prestataireId: 'p-plomberie', resteDuCentimes: 100_000 }, { id: 't-imput', date: '2026-11-10' })
    expect(() => annulerReglement(impute, { id: 't-x', date: '2026-11-12', motif: 'cheque_perdu', precision: null }, ecrit.traitement)).toThrow(/imputé sur la facture f-9/)
  })

  it('F87 — sous un autre régime, la base est le contrat : pas de texte cité', () => {
    const AP = (reference: string): BeneficiaireReglement => ({ type: 'administrateur_provisoire', cabinetId: 'cab-1', auxiliaire401: 'C0001', base: { nature: 'contrat', reference } })
    const premier = creer({ id: 'h-1', beneficiaire: AP('Contrat de syndic (fictif)'), factureId: 'fh-1', montantCentimes: 120_000 })
    const second = creer({ id: 'h-2', beneficiaire: AP('Contrat de syndic (fictif)'), factureId: 'fh-2', montantCentimes: 60_000 })
    const [refus] = controlerPaiementRemuneration(second, { montantFixeCentimes: 150_000, reglements: [premier, second] })
    expect(refus).toMatchObject({ code: 'remuneration_au_dela_du_montant_fixe', fondement: null })
  })

  it('F83 — en-tête : la question du retour amputé de frais est remplacée par la décision', () => {
    const { texte } = enTeteDuModule('reglements-fournisseurs')
    expect(texte.slice(texte.indexOf('🔴 Non établi'))).not.toContain('retour amputé de frais')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F83)')
    expect(texte).toContain('662 « Autres charges financières et agios »')
  })
})

describe('Décisions du 20/11/2026 (partie C) — relecture indépendante : F87 et F92', () => {
  const AP = (base: Extract<BeneficiaireReglement, { type: 'administrateur_provisoire' }>['base']): BeneficiaireReglement => ({
    type: 'administrateur_provisoire',
    cabinetId: 'cab-1',
    auxiliaire401: 'C0001',
    base,
  })
  const JURIDICTION = 'Tribunal judiciaire (fictif)'

  it('F87 — l’ordonnance de taxe arrête toute la rémunération : droit fixe et acomptes payés comptent dans son cumul (J67, R3)', () => {
    const droitFixe = creer({ id: 'h-df', beneficiaire: AP({ nature: 'droit_fixe' }), factureId: 'fh-df', montantCentimes: 180_000 })
    const acompte = creer({
      id: 'h-ac',
      beneficiaire: AP({ nature: 'ordonnance', objet: 'acompte', juridiction: JURIDICTION, date: '2026-09-15', numero: 'RG 26/00042' }),
      factureId: 'fh-ac',
      montantCentimes: 600_000,
    })
    const taxe = creer({
      id: 'h-tx',
      beneficiaire: AP({ nature: 'ordonnance', objet: 'taxe', juridiction: JURIDICTION, date: '2027-03-01', numero: 'RG 27/00007' }),
      factureId: 'fh-tx',
      montantCentimes: 1_500_000,
    })
    // rémunération arrêtée à 2 000 000 centimes TTC : 180 000 + 600 000 déjà payés + 1 500 000 la dépassent
    const [refus, ...autres] = controlerPaiementRemuneration(taxe, { montantFixeCentimes: 2_000_000, reglements: [droitFixe, acompte] })
    expect(autres).toEqual([])
    expect(refus).toMatchObject({ code: 'remuneration_au_dela_du_montant_fixe', fondement: 'D. 1967 art. 61-1-5' })
    expect(refus.message).toContain('2280000 centimes (dont 780000 déjà payés ou préparés)')
    expect(refus.message).toContain('droit fixe et acomptes compris')
    expect(controlerPaiementRemuneration(taxe, { montantFixeCentimes: 2_280_000, reglements: [droitFixe, acompte] })).toEqual([])
    // un acompte annulé, ou payé sur un autre mandat, ne compte pas
    expect(controlerPaiementRemuneration(taxe, { montantFixeCentimes: 2_000_000, reglements: [droitFixe, { ...acompte, statut: 'Annulé' }] })).toEqual([])
    expect(controlerPaiementRemuneration(taxe, { montantFixeCentimes: 2_000_000, reglements: [droitFixe, { ...acompte, mandatId: 'm-2' }] })).toEqual([])
    // l'acompte, lui, reste plafonné par sa seule ordonnance
    expect(controlerPaiementRemuneration(acompte, { montantFixeCentimes: 600_000, reglements: [droitFixe] })).toEqual([])
  })

  it('F92 — la vérification vaut pour le rejet qu’elle suit : un nouveau rejet pour coordonnées, même le jour de la vérification, bloque de nouveau', () => {
    const revenue = retourFactureApresRejet(
      facture(),
      { reglementId: 'r-1', le: '2026-11-03', motif: 'AC04 — compte clos', montantCentimes: 120_000 },
      { totalTtcCentimes: 120_000 },
    )
    const confirmation = {
      nature: 'confirmation' as const,
      iban: IBAN_FOURNISSEUR,
      saisiPar: 'col-gestion',
      confirmePar: 'col-direction',
      source: 'rib' as const,
      pieceId: 'doc-rib-1',
      le: '2026-11-04',
    }
    const confirmee = verifierIbanApresRejet(revenue, confirmation)
    // nouveau virement r-2, émis puis rejeté pour coordonnées le jour même de la confirmation
    const repayee: FactureAPayer = { ...confirmee, statutReglement: 'Réglée', statutSaisie: 'Réglée', resteDuCentimes: 0 }
    const rejeteeEncore = retourFactureApresRejet(
      repayee,
      { reglementId: 'r-2', le: '2026-11-04', motif: 'AC01 — numéro de compte incorrect', montantCentimes: 120_000 },
      { totalTtcCentimes: 120_000 },
    )
    expect(ibanAVerifier(rejeteeEncore)).toMatchObject({ reglementId: 'r-2' })
    expect(ibanVerifieApresRejet(rejeteeEncore)).toBeNull()
    expect(selectionnerFacturesAPayer([rejeteeEncore], { date: '2026-11-05', soldeDisponibleCentimes: 1_000_000 }).ecartees).toEqual([
      { factureId: 'f-1', motif: 'iban_a_confirmer' },
    ])
    expect(controlerIbanApresRejet(creer({ id: 'r-3' }), rejeteeEncore).map((a) => a.code)).toEqual(['iban_a_confirmer_apres_rejet'])
    // la nouvelle vérification se rattache au second rejet et libère la facture
    const changee = verifierIbanApresRejet(rejeteeEncore, { ...confirmation, nature: 'changement', iban: IBAN_AUTRE, le: '2026-11-05' })
    expect(ibanAVerifier(changee)).toBeNull()
    expect(ibanVerifieApresRejet(changee)).toMatchObject({ iban: IBAN_AUTRE, rejetReglementId: 'r-2' })
    // vérification reprise d'ailleurs, sans rejet rattaché : la date décide, comme avant
    expect(ibanAVerifier({ ...revenue, verificationsIban: [confirmation] })).toBeNull()
  })
})
