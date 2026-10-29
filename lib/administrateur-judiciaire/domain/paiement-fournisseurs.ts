import { ajouterJours, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { LigneVirement } from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import {
  changerStatutReglement,
  montantARegler,
  selectionnerFacturesAPayer,
  type FactureAPayer,
  type SelectionOrdre,
} from '@/lib/administrateur-judiciaire/domain/statuts-facture'
import { MODE_REGLEMENT, type ModeReglement } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Préparation des paiements fournisseurs (cartographie Gestéam, tranches 36, 37, 38 et 43 § 3 et § 25). Fonctions pures,
 * montants en CENTIMES ENTIERS, dates ISO, sans écran : prolonge statuts-facture.ts et alimente ordres-banque.ts.
 *
 * Gestéam —
 * - fiche entreprise, onglet Informations, bloc Règlement : mode ; « Délai n j. à date Facture » ; Priorité (n + libellé,
 *   0 sur une fiche sans priorité) ; « 1 virement par » Facture / Mandat ; « 1 chèque par » Facture / Mandat ; Groupement
 *   (« Mono agence »). Ces réglages se recopient sur les factures de l'entreprise (tranche 37) ;
 * - facture : Journal (journal de banque payeur), Réglée par (tranche 36) ;
 * - Raccourci « 210 Factures en attente de BAP » (tranche 38) : la facture attend un bon à payer avant le lot de
 *   règlements.
 * VitFix :
 * - les réglages de l'entreprise, « 1 virement par » compris, sont recopiés sur la facture : un changement ultérieur sur
 *   la fiche ne touche pas les factures déjà saisies ;
 * - ⚪ priorité par défaut : 5 « À échéance AVEC contrôle de solde », seule priorité de paiement observée ; le 0 affiché
 *   par Gestéam sur une fiche sans priorité n'a pas de règle connue (une facture qui le porte n'est jamais retenue) ;
 * - le compte payeur est porté par la facture ; un ordre de virement ne prend que les factures de son compte (D-BANQUE :
 *   compte courant, compte séparé, fonds de travaux) ;
 * - ⚪ qui délivre le bon à payer n'a pas été observé dans Gestéam : VitFix le confie aux collaborateurs habilités que
 *   désigne l'appelant (par exemple le responsable et le comptable du mandat), avec une double validation au-delà d'un
 *   seuil fixé par le cabinet. Règle de GESTION, sans fondement légal. Chaque validation porte le montant validé : une
 *   validation d'un autre montant (cycle précédent, avant un acompte) ne compte pas. Le même circuit vaut pour un
 *   acompte. Avec une politique, la sélection écarte toute facture dont le bon à payer n'est pas complet pour le montant à
 *   régler ;
 * - un virement par facture, ou un par mandat : toutes les factures du fournisseur sur le mandat, au même IBAN, en une
 *   ligne qui garde la liste de ses règlements. Contraintes du virement SEPA : identifiant de bout en bout ≤ 35 caractères,
 *   libellé de 1 à 140 caractères, sans caractère hors du jeu latin de base (les références qui ne tiennent pas sont
 *   comptées « +n »).
 * ⚪ « Groupement » et « 1 chèque par » sont repris comme données, sans règle : les chèques fournisseurs ne passent pas
 * par les ordres de banque de VitFix.
 */

export const UNITES_PAIEMENT = ['facture', 'mandat'] as const
export type UnitePaiement = (typeof UNITES_PAIEMENT)[number]

/** ⚪ Priorité par défaut : 5 « À échéance AVEC contrôle de solde » (statuts-facture.PRIORITES_REGLEMENT). */
export const PRIORITE_PAR_DEFAUT = 5

export interface ReglagesReglementEntreprise {
  mode: ModeReglement
  /** Échéance de la facture : date de facture + ce délai, en jours. */
  delaiJours: number
  /** Code de priorité de règlement (statuts-facture.PRIORITES_REGLEMENT). */
  priorite: number
  unVirementPar: UnitePaiement
  unChequePar: UnitePaiement
}

const estEntierPositifOuNul = (n: number) => Number.isInteger(n) && n >= 0

export function creerReglagesReglementEntreprise(saisie: Partial<ReglagesReglementEntreprise>): ReglagesReglementEntreprise {
  const reglages: ReglagesReglementEntreprise = {
    mode: saisie.mode ?? 'Virement',
    delaiJours: saisie.delaiJours ?? 0,
    priorite: saisie.priorite ?? PRIORITE_PAR_DEFAUT,
    unVirementPar: saisie.unVirementPar ?? 'facture',
    unChequePar: saisie.unChequePar ?? 'facture',
  }
  if (!(MODE_REGLEMENT as readonly string[]).includes(reglages.mode)) throw new Error(`Mode de règlement inconnu : « ${reglages.mode} ».`)
  if (!estEntierPositifOuNul(reglages.delaiJours))
    throw new Error(`Délai de règlement invalide (${reglages.delaiJours}) : nombre entier de jours positif ou nul attendu.`)
  if (!estEntierPositifOuNul(reglages.priorite))
    throw new Error(`Priorité de règlement invalide (${reglages.priorite}) : code entier positif ou nul attendu.`)
  if (!(UNITES_PAIEMENT as readonly string[]).includes(reglages.unVirementPar))
    throw new Error(`« 1 virement par » inconnu : « ${reglages.unVirementPar} » (facture ou mandat).`)
  if (!(UNITES_PAIEMENT as readonly string[]).includes(reglages.unChequePar))
    throw new Error(`« 1 chèque par » inconnu : « ${reglages.unChequePar} » (facture ou mandat).`)
  return reglages
}

/** Valeurs que la saisie d'une facture reprend de son entreprise. */
export function reglementParDefautFacture(
  reglages: ReglagesReglementEntreprise,
  dateFacture: string,
): { mode: ModeReglement; joursEcheance: number; echeance: string; priorite: number; unVirementPar: UnitePaiement } {
  if (!estDateIsoValide(dateFacture)) throw new Error(`Date de facture invalide (${dateFacture}) : AAAA-MM-JJ attendu.`)
  return {
    mode: reglages.mode,
    joursEcheance: reglages.delaiJours,
    echeance: ajouterJours(dateFacture, reglages.delaiJours),
    priorite: reglages.priorite,
    unVirementPar: reglages.unVirementPar,
  }
}

// ─── Bon à payer ────────────────────────────────────────────────────────────────────────────

export interface ValidationBap {
  /** Collaborateur qui valide. */
  par: string
  le: string
  /** Montant validé : le reste dû pour un bon à payer, l'acompte pour un acompte. */
  montantCentimes: number
}

export interface FacturePayable extends FactureAPayer {
  mandatId: string
  /** Compte bancaire du syndicat qui paie (journal de banque payeur de Gestéam) ; null : non choisi. */
  comptePayeurId: string | null
  validationsBap?: ValidationBap[]
}

export interface PolitiqueBap {
  /** Collaborateurs habilités à délivrer le bon à payer de ces factures. */
  habilites: readonly string[]
  /** Au-delà de ce montant validé, deux validations de deux habilités distincts ; null : une seule toujours. */
  doubleValidationAuDelaCentimes: number | null
}

const verifierPolitique = (politique: PolitiqueBap): void => {
  const seuil = politique.doubleValidationAuDelaCentimes
  if (seuil !== null && !estEntierPositifOuNul(seuil))
    throw new Error(`Seuil de double validation invalide (${seuil}) : centimes entiers positifs ou nuls, ou null, attendus.`)
}

const validationsRequises = (montantCentimes: number, politique: PolitiqueBap): number => {
  const seuil = politique.doubleValidationAuDelaCentimes
  return seuil !== null && montantCentimes > seuil ? 2 : 1
}

/** Validations du cycle en cours : celles qui portent sur le montant à valider. */
const validationsDuMontant = (facture: FacturePayable, montantCentimes: number): ValidationBap[] =>
  (facture.validationsBap ?? []).filter((v) => v.montantCentimes === montantCentimes)

/**
 * Ajoute une validation au bon à payer d'une facture « En attente » : vers « Bon à payer » (montant validé : le reste
 * dû) ou vers « Acompte à régler » (montant validé : l'acompte, borné par le reste dû). La facture doit être enregistrée
 * et comptabilisée dès la première validation. Quand le nombre de validations requis pour ce montant est atteint, la
 * facture change de statut (statuts-facture.changerStatutReglement). Renvoie une copie.
 */
export function delivrerBap<F extends FacturePayable>(
  facture: F,
  validation: { par: string; le: string },
  politique: PolitiqueBap,
  { vers = 'Bon à payer' }: { vers?: 'Bon à payer' | 'Acompte à régler' } = {},
): { facture: F; complet: boolean; validationsRequises: number } {
  verifierPolitique(politique)
  if (!estDateIsoValide(validation.le)) throw new Error(`Date de validation invalide (${validation.le}) : AAAA-MM-JJ attendu.`)
  if (!Number.isInteger(facture.resteDuCentimes) || facture.resteDuCentimes < 0)
    throw new Error(`Reste dû invalide pour la facture ${facture.id} (${facture.resteDuCentimes}) : centimes entiers attendus.`)
  if (facture.statutReglement !== 'En attente')
    throw new Error(`Bon à payer : la facture ${facture.id} n'est pas en attente (${facture.statutReglement}).`)
  if (!politique.habilites.includes(validation.par))
    throw new Error(`Bon à payer : ${validation.par} n'est pas habilité à valider la facture ${facture.id}.`)
  // Mêmes conditions que le changement de statut (enregistrée, comptabilisée), dès la première validation.
  changerStatutReglement(facture, vers)
  const montantCentimes = vers === 'Acompte à régler' ? Math.min(facture.acompteCentimes ?? 0, facture.resteDuCentimes) : facture.resteDuCentimes
  if (montantCentimes <= 0) throw new Error(`Bon à payer : rien à valider sur la facture ${facture.id} (montant nul).`)
  const enCours = validationsDuMontant(facture, montantCentimes)
  if (enCours.some((v) => v.par === validation.par))
    throw new Error(`Bon à payer : ${validation.par} a déjà validé la facture ${facture.id} ; une autre personne doit valider.`)
  const requises = validationsRequises(montantCentimes, politique)
  const validationsBap = [...enCours, { par: validation.par, le: validation.le, montantCentimes }]
  const avecValidation = { ...facture, validationsBap }
  if (validationsBap.length < requises) return { facture: avecValidation, complet: false, validationsRequises: requises }
  return { facture: changerStatutReglement(avecValidation, vers), complet: true, validationsRequises: requises }
}

/**
 * Retire le bon à payer : la facture revient « En attente », sans validation ; pour une facture déjà « En attente »,
 * efface seulement ses validations partielles. Renvoie une copie.
 */
export function retirerBap<F extends FacturePayable>(facture: F): F {
  if (facture.statutReglement === 'En attente') return { ...facture, validationsBap: [] }
  return { ...changerStatutReglement(facture, 'En attente'), validationsBap: [] }
}

// ─── Compte payeur et sélection ─────────────────────────────────────────────────────────────

/**
 * Factures à régler par un ordre de virement sur le compte `banqueId` : celles d'un autre compte, ou sans compte payeur,
 * sont écartées ; avec une politique, celles dont le bon à payer n'est pas complet pour le montant à régler aussi ; les
 * autres passent par selectionnerFacturesAPayer (bon à payer, échéance, solde du compte…).
 */
export function selectionnerPourCompte<F extends FacturePayable>(
  factures: F[],
  {
    banqueId,
    date,
    soldeDisponibleCentimes,
    politique,
  }: { banqueId: string; date: string; soldeDisponibleCentimes: number; politique?: PolitiqueBap },
): SelectionOrdre<F> {
  if (!banqueId.trim()) throw new Error("Compte bancaire de l'ordre attendu.")
  if (new Set(factures.map((f) => f.id)).size !== factures.length) throw new Error('Facture en double dans la sélection.')
  if (politique) verifierPolitique(politique)
  const ecartees: SelectionOrdre<F>['ecartees'] = []
  const candidates: F[] = []
  for (const f of factures) {
    if (f.comptePayeurId === null || !f.comptePayeurId.trim()) ecartees.push({ factureId: f.id, motif: 'compte_payeur_absent' })
    else if (f.comptePayeurId !== banqueId) ecartees.push({ factureId: f.id, motif: 'autre_compte_payeur' })
    else if (
      politique &&
      (f.statutReglement === 'Bon à payer' || f.statutReglement === 'Acompte à régler') &&
      validationsDuMontant(f, montantARegler(f)).length < validationsRequises(montantARegler(f), politique)
    )
      ecartees.push({ factureId: f.id, motif: 'bon_a_payer_incomplet' })
    else candidates.push(f)
  }
  const selection = selectionnerFacturesAPayer(candidates, { date, soldeDisponibleCentimes })
  return { ...selection, ecartees: [...ecartees, ...selection.ecartees] }
}

// ─── Regroupement des virements ────────────────────────────────────────────────────────────

/** Virement SEPA : identifiant de bout en bout (EndToEndId) et libellé non structuré. */
const LONGUEUR_ID_VIREMENT = 35
const LONGUEUR_LIBELLE_VIREMENT = 140

export interface ReglementARegrouper {
  reglementId: string
  factureId: string
  prestataireId: string
  mandatId: string
  beneficiaire: string
  iban: string
  bic: string | null
  montantCentimes: number
  /** Référence de la facture, reprise dans le libellé du virement ; vide : l'identifiant de la facture. */
  reference: string
  /** « 1 virement par », recopié de l'entreprise sur la facture à la saisie. */
  unVirementPar: UnitePaiement
}

const ibanNormalise = (iban: string) => iban.replace(/\s+/g, '').toUpperCase()

const idVirement = (ids: string[]): string => {
  if (ids.length === 1) return ids[0].slice(0, LONGUEUR_ID_VIREMENT)
  const suffixe = `+${ids.length - 1}`
  return `${ids[0].slice(0, LONGUEUR_ID_VIREMENT - suffixe.length)}${suffixe}`
}

/** Références jointes, coupées à une frontière de référence ; celles qui ne tiennent pas sont comptées « +n ». */
const libelleVirement = (references: string[]): string => {
  let libelle = ''
  for (let i = 0; i < references.length; i++) {
    const candidat = libelle ? `${libelle}, ${references[i]}` : references[i]
    const reste = references.length - i - 1
    const suffixe = reste > 0 ? ` +${reste}` : ''
    if (candidat.length + suffixe.length > LONGUEUR_LIBELLE_VIREMENT) {
      const omises = references.length - i
      return libelle ? `${libelle} +${omises}` : references[0].slice(0, LONGUEUR_LIBELLE_VIREMENT)
    }
    libelle = candidat
  }
  return libelle
}

/**
 * Lignes de virement d'un ordre : une par règlement (« 1 virement par facture »), ou une par fournisseur, mandat et IBAN
 * (« 1 virement par mandat »), selon le réglage porté par chaque règlement. Ordre : celui de la première apparition ;
 * chaque ligne garde ses règlements (`reglementIds`).
 */
export function regrouperVirements(reglements: ReglementARegrouper[]): { ligne: LigneVirement; reglementIds: string[] }[] {
  const vus = new Set<string>()
  const groupes = new Map<string, ReglementARegrouper[]>()
  for (const r of reglements) {
    if (vus.has(r.reglementId)) throw new Error(`Règlement ${r.reglementId} en double.`)
    vus.add(r.reglementId)
    if (!Number.isInteger(r.montantCentimes) || r.montantCentimes <= 0)
      throw new Error(`Montant invalide pour le règlement ${r.reglementId} (${r.montantCentimes}) : centimes entiers strictement positifs attendus.`)
    if (!(UNITES_PAIEMENT as readonly string[]).includes(r.unVirementPar))
      throw new Error(`« 1 virement par » inconnu pour le règlement ${r.reglementId} : « ${r.unVirementPar} ».`)
    const cle = r.unVirementPar === 'mandat' ? `mandat|${r.prestataireId}|${r.mandatId}|${ibanNormalise(r.iban)}` : `facture|${r.reglementId}`
    groupes.set(cle, [...(groupes.get(cle) ?? []), r])
  }
  return [...groupes.values()].map((groupe) => {
    const reglementIds = groupe.map((r) => r.reglementId)
    return {
      reglementIds,
      ligne: {
        reglementId: idVirement(reglementIds),
        beneficiaire: groupe[0].beneficiaire,
        iban: groupe[0].iban,
        bic: groupe.find((r) => r.bic)?.bic ?? null,
        montantCentimes: groupe.reduce((s, r) => s + r.montantCentimes, 0),
        libelle: libelleVirement(groupe.map((r) => r.reference.trim() || r.factureId)),
        reglementIds,
      },
    }
  })
}
