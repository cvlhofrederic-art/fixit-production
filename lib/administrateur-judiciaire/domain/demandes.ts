import { dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { creerRattachement, type FicheLiee, type Rattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import type { FactureAPayer, StatutSaisieFacture } from '@/lib/administrateur-judiciaire/domain/statuts-facture'
import { normaliserTexte } from '@/lib/administrateur-judiciaire/domain/texte'
import {
  controlerAvantOrdreService,
  controlerAvantReglement,
  type AnomalieEntreprise,
  type PiecesEntreprise,
} from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'
import {
  DOSSIER,
  STADE_INTERVENTION,
  STATUT_DEMANDE,
  type PhaseContentieux,
  type StadeIntervention,
  type StatutDemande,
} from '@/lib/data/referentiels-gesteam-judiciaire'
import type { StatutOrdreMission } from '@/lib/syndic/messagerie-pro'

/**
 * Demandes d'intervention et ordres de service : modèle et cycle jusqu'à la facture (point 43 du bilan 2, partie domaine).
 * Fonctions pures, montants en CENTIMES ENTIERS, dates ISO, sans écran ni table : le branchement à l'écran Ordres de
 * service (ordres-prestataire.ts, SuiviPrestataire) et une éventuelle table Dexie attendent l'accord de Frédéric. La
 * facture de la demande (rapprochement, imputation, prévu comparé au facturé) est dans facture-demande.ts.
 *
 * Gestéam — 🟢 lu :
 * - tranche 14 et tranche 43 § 15 : la demande d'intervention et l'ordre de service sont UN SEUL objet, distingué par la
 *   Nature, qui est un modèle de document de sortie. Nature (22 entrées) : familles Interventions et Devis, puis 3
 *   « Demande devis », 10 « OS » (dont 4 variantes par gestionnaire ou agence, non relevées), 2 « Accord devis » et
 *   « Huissier - exécution forcée ». Le modèle d'OS peut exiger une pièce en retour (attestation, PV de réception).
 *   L'OS est souvent saisi après l'intervention (pratique de Hugo, tranche 14) : aucun ordre strict n'est imposé.
 * - tranche 34 : en-tête (Nature, statut, Demandé le, N° <mandat>.<plan>.<n°>, Entreprise, Dossier, Objet) ; onglet
 *   Suivi : Prix € TTC (montant, dont remise, TVA taux et base, « Associer un devis »), Ventilation (clé, analytique),
 *   Règlement (bouton « Contrôle déclaratif », Acompte €, Acompte échéance, bouton « Non facturé »), Intervention (Prévu
 *   le), frise Demandée → Acceptation → Réalisation → Facturation. Le bouton « Contrôle déclaratif » n'a pas été cliqué :
 *   la tranche en DÉDUIT (🔵) un « contrôle des attestations de l'entreprise avant paiement ».
 * - tranche 17 § 4 et tranche 40 : deux axes distincts, STATUT_DEMANDE (la demande administrative) et
 *   STADE_INTERVENTION (l'intervention sur le terrain), référentiels déjà dans VitFix et utilisés ici.
 * - tranche 17 § 3, tranche 34 (« Classement : Dossier (liste) ») et tranche 40 : le Dossier d'une demande est un type
 *   du référentiel DOSSIER (15), jamais une fiche porteuse (copropriété, identité, entreprise).
 * - tranche 43 § 15 : la demande suit SA facture (codification : À enregistrer · À traiter · Comptabilisée ; Facturé /
 *   Non facturé) ; l'exécution forcée par huissier suit le même circuit que les OS (envoi, suivi, facture).
 *
 * Le droit — relevé du 29/10/2026 (Légifrance) :
 * - le cycle lui-même (étapes, n° d'OS, « Non facturé », acompte, pièce exigée) n'est encadré par AUCUN TEXTE : c'est une
 *   convention de gestion, paramétrable ;
 * - fondement de la demande : le syndic, donc l'administrateur provisoire qui en a les pouvoirs (L. 1965 art. 29-1), administre,
 *   conserve et entretient l'immeuble, et fait procéder d'urgence aux travaux de sauvegarde (L. 1965 art. 18 I) ;
 * - aucun texte n'impose d'exiger une attestation ou un PV de réception avant la clôture d'une demande : la pièce exigée
 *   est une RÈGLE DE GESTION du cabinet, bloquante ici à la clôture (🔴 à faire valider par Frédéric) ;
 * - nature « Huissier - exécution forcée » : le syndic met en oeuvre les voies d'exécution sans autorisation d'AG, sauf la
 *   saisie en vue de la vente d'un lot (D. 1967 art. 55) ; la demande est rattachée au dossier contentieux qu'elle exécute ;
 * - contrôle déclaratif : vigilance (C. trav. art. L. 8222-1, R. 8222-1, D. 8222-5) et décennale (C. ass. art. L. 243-2),
 *   déjà codées par vigilance-entreprises.ts (point 37), réutilisé sans modification par controleDeclaratifDemande ;
 * - NON CODÉ ICI (paramètres propres à chaque copropriété, articulation non établie) : seuils de consultation du conseil
 *   syndical et de mise en concurrence fixés par l'AG (L. 1965 art. 21 al. 2 ; D. 1967 art. 19-2), plafond d'une
 *   délégation (L. 1965 art. 25 a, 21-1 à 21-3), provision d'urgence au tiers du devis (D. 1967 art. 37), avis du conseil
 *   syndical avant une décision de l'administrateur provisoire (D. 1967 art. 62-7), honoraires sur travaux (L. 1965 art.
 *   18-1 A III), carnet d'entretien (L. 1965 art. 18 I ; décret 2001-477).
 *
 * 🔵 Déduit (règles de ce module) :
 * - étape de chaque stade et avancement de la frise : voir AVANCEMENT_PAR_STADE ; « Refusée » arrête la frise à
 *   l'acceptation ; le statut « Accepté » vaut acceptation ;
 * - une demande de devis s'arrête à l'acceptation : ni réalisation ni facture (elle ne se facture pas) ;
 * - prix et devis associé : le HT ne dépasse jamais le TTC (taux de TVA positif ou nul) ;
 * - Facturation faite = intervention réalisée ou validée ET (facture rattachée comptabilisée, ou demande marquée sans
 *   facture) ; une facture d'acompte comptabilisée avant la réalisation ne termine pas la frise ;
 * - statut de la facture rapprochée tiré de statuts-facture.ts : comptabilisée → « Comptabilisée » ; Pré-saisie ou En
 *   saisie → « À enregistrer » ; sinon « À traiter ». Plusieurs factures (acompte, solde) : la moins avancée ; une facture
 *   rattachée dont le statut manque compte comme « À enregistrer » (jamais comptabilisée par défaut) ;
 * - « Non facturé » (sansFacture) : la demande ne doit pas donner de facture (garantie, prestation au contrat…) ;
 * - correspondance du statut de l'ordre de mission VitFix avec le stade (stadeDepuisStatutOrdre) ;
 * - phase « Exécution en cours » SUGGÉRÉE au contentieux quand sa mission d'exécution forcée est acceptée, programmée,
 *   réalisée ou validée, ni refusée ni terminée (contentieux.ts n'est pas modifié) ;
 * - un refus (statut « Refusé » ou stade « Refusée ») suppose une demande ni réalisée ni facturée, dans les deux sens :
 *   il est refusé sur une intervention réalisée ou qui porte une facture (la contester, ou détacher ses factures d'abord) ;
 *   une demande refusée ne reçoit ni réalisation (stade Réalisée, Contestée, Validée, ou date de réalisation) ni facture
 *   (lever le refus d'abord : un autre statut, ou un nouveau stade qui remplace « Refusée ») — un ordre VitFix « termine »
 *   sur une demande refusée au cabinet est donc refusé tant que le refus n'est pas levé ; une demande refusée ne se clôt
 *   sans contrôle que si elle n'a ni réalisation ni facture, et un objet refusé mais réalisé ou facturé (repris d'ailleurs)
 *   ne se clôt pas (« refus_contradictoire », bloquant) ;
 * - la date de fin n'est jamais antérieure à la date de la demande ni à celle de la réalisation ;
 * - comptes de l'arrêté du 14/03/2005 (art. 10, classe 4) : le 408 « Factures non parvenues » (travaux réalisés dont la
 *   facture n'est pas reçue) correspond aux interventions réalisées dont une facture est ATTENDUE (demandesNonFacturees,
 *   à la clôture de l'exercice) ; une demande marquée « Non facturé » (sansFacture : aucune facture attendue) ne donne
 *   aucune écriture au 408 — sauf si le bouton signifie « en attente de facture » (question 🔴 à Hugo ci-dessous) ;
 *   l'acompte versé correspond au 409 « Fournisseurs débiteurs » (avances et acomptes versés sur commande). Rien de
 *   comptable n'est écrit ici : à reprendre au point 29 ;
 * - contrôle déclaratif, MOMENT : le bouton est rangé au bloc Règlement (tranche 34, sens 🔵 « avant paiement ») ; les
 *   apports VitFix de la tranche 43 § 24 prévoient le contrôle avant l'envoi d'un ordre de service ET avant le règlement.
 *   Les deux sont offerts, le moment est OBLIGATOIRE : avant l'OS, controlerAvantOrdreService (vigilance au-delà du seuil
 *   et décennale bloquantes : pièces dues à la conclusion du contrat, C. trav. art. L. 8222-1, D. 8222-5) ; avant le règlement,
 *   controlerAvantReglement (alertes seulement : VitFix ne bloque jamais un paiement, point 37) ;
 * - contrôle déclaratif, MONTANT : le montant HT de l'opération donné par l'appelant (cumul des commandes de même objet,
 *   comme dans vigilance-entreprises.ts) ; à défaut, le HT du devis associé, qui fait le prévu ; à défaut, la base HT du
 *   prix, mais seulement si aucun devis associé n'en diffère (sinon : erreur, le montant est à donner) ; pièces de
 *   l'entreprise de la demande seulement.
 *
 * 🔴 Non établi — questions :
 * - Hugo : « Proposition en cours » et « Proposition résident » relèvent-elles de l'étape Demandée (avant l'acceptation) ?
 *   Une intervention « Contestée » bloque-t-elle la facturation et la clôture (bloquant ici) ?
 * - Hugo : le bouton « Non facturé » de l'onglet Suivi marque-t-il la demande comme ne devant pas être facturée, ou
 *   liste-t-il les demandes en attente de facture ?
 * - Hugo : le bouton « Contrôle déclaratif » du bloc Règlement de l'onglet Suivi contrôle-t-il l'entreprise avant l'envoi
 *   de l'ordre de service, ou avant le paiement ? (les deux moments sont offerts ici, au choix de l'appelant)
 * - Hugo : « Associer un devis » recopie-t-il le montant du devis dans le Prix € TTC (et sa base HT) ? (non supposé ici :
 *   le devis associé garde son propre montant)
 * - Hugo : « À traiter » (Codification/facture) désigne-t-il une facture enregistrée non comptabilisée, ou une pièce de la
 *   corbeille de numérisation non encore associée ?
 * - Hugo : « Terminé » exige-t-il une facture comptabilisée (alerte ici) ou seulement rattachée ? le stade « Validée »
 *   (alerte ici) ou « Réalisée » suffit-il ?
 * - Hugo : les natures « Accord devis » et « Huissier - exécution forcée » sont-elles de la famille Interventions
 *   (classées ainsi ici) ?
 * - Hugo : les statuts « Accepté » / « Refusé » suivent-ils la réponse au devis, et les stades « Acceptée » / « Refusée »
 *   la réponse à l'OS ?
 * - Hugo : une demande peut-elle porter plusieurs factures (acompte puis solde) ? (admis ici)
 * - Hugo : la facture du commissaire de justice d'une exécution forcée entre-t-elle au décompte du débiteur
 *   (decompte-contentieux.ts ; L. 1965 art. 10-1 a), et sous quel poste ? (rien n'y est reporté ici)
 * - Frédéric : la pièce exigée en retour doit-elle bloquer la clôture de la demande ?
 * - Frédéric : quand l'ordonnance confie à l'administrateur provisoire les pouvoirs de l'AG, fixe-t-il lui-même les deux
 *   seuils de L. 1965 art. 21 al. 2, et recueille-t-il l'avis du conseil syndical (D. 1967 art. 62-7) pour chaque
 *   acceptation de devis, ou seulement au-delà du seuil ?
 * - Frédéric : faut-il une table Dexie `demandes` unique (un seul objet, distingué par la Nature) à la place des tables
 *   Devis et Intervention, jamais alimentées ?
 */

export const ETAPES_DEMANDE = ['Demandée', 'Acceptation', 'Réalisation', 'Facturation'] as const
export type EtapeDemande = (typeof ETAPES_DEMANDE)[number]

/** Familles de la liste Nature : Devis, Interventions. */
export const TYPES_DEMANDE = ['devis', 'intervention'] as const
export type TypeDemande = (typeof TYPES_DEMANDE)[number]

/** Pièce que le modèle d'OS exige en retour. */
export const PIECES_EXIGEES = ['attestation', 'pv_reception'] as const
export type PieceExigee = (typeof PIECES_EXIGEES)[number]

const LIBELLE_PIECE: Readonly<Record<PieceExigee, string>> = { attestation: 'attestation', pv_reception: 'PV de réception' }

/** Statut de la facture rapprochée (critère Codification/facture) ; sans facture : « Non facturé ». */
export const STATUTS_FACTURE_DEMANDE = ['À enregistrer', 'À traiter', 'Comptabilisée'] as const
export type StatutFactureDemande = (typeof STATUTS_FACTURE_DEMANDE)[number]
export const NON_FACTURE = 'Non facturé' as const
export type CodificationFacture = StatutFactureDemande | typeof NON_FACTURE

/** Modèle de document de sortie (Nature) : un paramétrage du cabinet. */
export interface ModeleDemande {
  nature: string
  type: TypeDemande
  pieceExigee: PieceExigee | null
  executionForcee: boolean
}

const modele = (nature: string, type: TypeDemande, pieceExigee: PieceExigee | null = null, executionForcee = false): ModeleDemande => ({
  nature,
  type,
  pieceExigee,
  executionForcee,
})

/**
 * Natures génériques observées (tranches 14 et 43 § 15), sans les variantes par gestionnaire ou agence (données
 * personnelles). Classement des « Accord devis » et de « Huissier - exécution forcée » en intervention : 🔵. Valeurs propres
 * au module, à migrer vers referentiels-gesteam-judiciaire.ts (point 29) après ce point.
 */
export const MODELES_DEMANDE_OBSERVES: readonly ModeleDemande[] = [
  modele('Demande devis Copro', 'devis'),
  modele('Demande devis Copro BIS', 'devis'),
  modele('Demande devis Gérance', 'devis'),
  modele('OS Copro', 'intervention'),
  modele('OS Copro utilisateur', 'intervention'),
  modele('OS Copro avec Attestation', 'intervention', 'attestation'),
  modele('OS Copro avec PV de réception', 'intervention', 'pv_reception'),
  modele('OS Changement de code', 'intervention'),
  modele('OS GT', 'intervention'),
  modele('OS Gérance', 'intervention'),
  modele('Accord devis Copro', 'intervention'),
  modele('Accord devis Gérance', 'intervention'),
  modele('Huissier - exécution forcée', 'intervention', null, true),
]

/** Modèle d'une nature (sans tenir compte de la casse ni des accents), parmi ceux du cabinet ; null si inconnue. */
export function modeleDeNature(nature: string, modeles: readonly ModeleDemande[] = MODELES_DEMANDE_OBSERVES): ModeleDemande | null {
  const cherchee = normaliserTexte(nature)
  return modeles.find((m) => normaliserTexte(m.nature) === cherchee) ?? null
}

export interface PrixDemande {
  /** Prix € TTC — Montant. */
  montantTtcCentimes: number
  /** « dont remise » : part du montant consentie en remise. */
  remiseCentimes: number
  tauxTvaPct: number | null
  /** Base HT de la TVA. */
  baseHtCentimes: number | null
}

/** Devis associé (« Associer un devis ») : son montant TTC devient le prévu de la demande. */
export interface DevisAssocie {
  devisId: string
  montantTtcCentimes: number
  /** Montant HT du devis, s'il est connu : il fait le montant de l'opération du contrôle déclaratif. */
  montantHtCentimes?: number | null
}

export interface VentilationDemande {
  cleRepartition: string | null
  analytique: string | null
  comptePlan: string | null
}

export interface AcompteDemande {
  montantCentimes: number
  echeance: string | null
}

export interface PieceRecue {
  nature: PieceExigee
  recueLe: string
  documentId: string | null
}

export interface Demande {
  id: string
  /** Nature : le modèle de document de sortie. */
  nature: string
  type: TypeDemande
  executionForcee: boolean
  pieceExigee: PieceExigee | null
  coproprieteId: string
  mandatId: string | null
  /** Entreprise ; null tant qu'elle n'est pas choisie. */
  prestataireId: string | null
  demandeLe: string
  /** N° d'ordre de service. */
  numero: string | null
  objet: string
  statut: StatutDemande
  stade: StadeIntervention | null
  /**
   * Dossier (Travaux, Contentieux, Sinistre, Equipement…), rattachement de fiches-liees dont le type est pris dans le
   * référentiel DOSSIER (contrôlé par controlerDemande), jamais une fiche porteuse.
   */
  dossier: Rattachement | null
  prix: PrixDemande | null
  devisAssocie: DevisAssocie | null
  ventilation: VentilationDemande | null
  acompte: AcompteDemande | null
  prevuLe: string | null
  realiseeLe: string | null
  termineeLe: string | null
  piecesRecues: PieceRecue[]
  /** Factures rattachées : le rattachement est porté par la demande (LigneFacture n'est pas modifiée). */
  factureIds: string[]
  /** « Non facturé » : aucune facture attendue (🔴 sens du bouton à confirmer). */
  sansFacture: boolean
}

export interface SaisieDemande {
  id: string
  coproprieteId: string
  mandatId?: string | null
  prestataireId?: string | null
  demandeLe: string
  numero?: string | null
  objet: string
  dossier?: Rattachement | null
  prix?: PrixDemande | null
  devisAssocie?: DevisAssocie | null
  ventilation?: VentilationDemande | null
  acompte?: AcompteDemande | null
  prevuLe?: string | null
}

export type GraviteAnomalieDemande = 'bloquant' | 'alerte'

export type CodeAnomalieDemande =
  | 'identifiant_manquant'
  | 'date_invalide'
  | 'prix_invalide'
  | 'devis_associe_invalide'
  | 'acompte_invalide'
  | 'dossier_invalide'
  | 'execution_forcee_sans_contentieux'
  | 'acompte_superieur_prevu'
  | 'acompte_sans_echeance'
  | 'piece_exigee_absente'
  | 'refus_contradictoire'
  | 'intervention_non_realisee'
  | 'intervention_contestee'
  | 'intervention_non_validee'
  | 'facture_absente'
  | 'facture_non_comptabilisee'

export interface AnomalieDemande {
  code: CodeAnomalieDemande
  gravite: GraviteAnomalieDemande
  message: string
}

const anomalie = (code: CodeAnomalieDemande, gravite: GraviteAnomalieDemande, message: string): AnomalieDemande => ({ code, gravite, message })

const texteOuNull = (valeur: string | null | undefined): string | null => {
  const texte = (valeur ?? '').trim()
  return texte === '' ? null : texte
}

const estCentimes = (montant: number): boolean => Number.isInteger(montant) && montant >= 0

const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)

/** Lève une erreur listant les anomalies bloquantes. */
function verifierSansBloquant(anomalies: AnomalieDemande[], prefixe: string): void {
  const bloquantes = anomalies.filter((a) => a.gravite === 'bloquant')
  if (bloquantes.length > 0) throw new Error(`${prefixe} : ${bloquantes.map((a) => a.message).join(' ')}`)
}

function verifierDate(libelle: string, valeur: string | null | undefined): void {
  if (valeur != null && !estDateIsoValide(valeur)) throw new Error(`${libelle} invalide (${valeur}) : AAAA-MM-JJ attendu.`)
}

function verifierModifiable(d: Demande): void {
  if (d.statut === 'Terminé') throw new Error(`Demande ${d.id} terminée : plus aucun changement.`)
}

/** Prévu de la demande : le devis associé, à défaut le prix TTC ; null si aucun. */
export const prevuDemande = (d: Demande): number | null => d.devisAssocie?.montantTtcCentimes ?? d.prix?.montantTtcCentimes ?? null

function datesDeLaDemande(d: Demande): [string, string | null][] {
  return [
    ['Date de la demande', d.demandeLe],
    ["Date d'intervention prévue", d.prevuLe],
    ['Date de réalisation', d.realiseeLe],
    ['Date de fin', d.termineeLe],
    ["Échéance de l'acompte", d.acompte?.echeance ?? null],
    ...d.piecesRecues.map((p): [string, string | null] => [`Réception de la pièce « ${LIBELLE_PIECE[p.nature]} »`, p.recueLe]),
  ]
}

const anomaliesDates = (d: Demande): AnomalieDemande[] =>
  datesDeLaDemande(d)
    .filter(([, valeur]) => valeur !== null && !estDateIsoValide(valeur))
    .map(([libelle, valeur]) => anomalie('date_invalide', 'bloquant', `${libelle} invalide (${valeur}) : AAAA-MM-JJ attendu.`))

/** HT inconnu, ou en centimes entiers et au plus égal au TTC (taux de TVA positif ou nul). */
const htAuPlusTtc = (htCentimes: number | null | undefined, ttcCentimes: number): boolean =>
  htCentimes == null || (estCentimes(htCentimes) && htCentimes <= ttcCentimes)

const prixValide = (p: PrixDemande): boolean =>
  estCentimes(p.montantTtcCentimes) &&
  estCentimes(p.remiseCentimes) &&
  p.remiseCentimes <= p.montantTtcCentimes &&
  htAuPlusTtc(p.baseHtCentimes, p.montantTtcCentimes) &&
  (p.tauxTvaPct === null || (Number.isFinite(p.tauxTvaPct) && p.tauxTvaPct >= 0))

const devisValide = (devis: DevisAssocie): boolean =>
  devis.devisId.trim() !== '' && estCentimes(devis.montantTtcCentimes) && htAuPlusTtc(devis.montantHtCentimes, devis.montantTtcCentimes)

function anomaliesMontants(d: Demande): AnomalieDemande[] {
  const anomalies: AnomalieDemande[] = []
  if (d.prix && !prixValide(d.prix))
    anomalies.push(
      anomalie('prix_invalide', 'bloquant', 'Prix invalide : centimes entiers positifs attendus, remise et base HT au plus égales au montant TTC.'),
    )
  if (d.devisAssocie && !devisValide(d.devisAssocie))
    anomalies.push(
      anomalie('devis_associe_invalide', 'bloquant', 'Devis associé invalide : identifiant et montants en centimes entiers attendus, HT au plus égal au TTC.'),
    )
  return anomalies
}

function anomaliesDossier(d: Demande): AnomalieDemande[] {
  const { dossier } = d
  if (dossier && !(DOSSIER as readonly string[]).includes(dossier.type))
    return [
      anomalie(
        'dossier_invalide',
        'bloquant',
        `Dossier « ${dossier.type} » : un type du référentiel DOSSIER est attendu (Travaux, Contentieux, Sinistre…), jamais une fiche porteuse.`,
      ),
    ]
  if (d.executionForcee && dossier?.type !== 'Contentieux')
    return [anomalie('execution_forcee_sans_contentieux', 'bloquant', "Exécution forcée : rattacher la demande au dossier contentieux qu'elle exécute.")]
  return []
}

function anomaliesAcompte(d: Demande): AnomalieDemande[] {
  const { acompte } = d
  if (!acompte) return []
  if (!Number.isInteger(acompte.montantCentimes) || acompte.montantCentimes <= 0)
    return [anomalie('acompte_invalide', 'bloquant', 'Acompte invalide : montant en centimes entiers strictement positif attendu.')]
  const anomalies: AnomalieDemande[] = []
  const prevu = prevuDemande(d)
  if (prevu !== null && acompte.montantCentimes > prevu)
    anomalies.push(
      anomalie('acompte_superieur_prevu', 'alerte', `Acompte de ${euros(acompte.montantCentimes)} supérieur au prévu de la demande (${euros(prevu)}).`),
    )
  if (acompte.echeance === null) anomalies.push(anomalie('acompte_sans_echeance', 'alerte', "Acompte sans échéance : la saisir pour suivre son règlement."))
  return anomalies
}

/** Contrôles de saisie d'une demande : bloquants (refus) et alertes. */
export function controlerDemande(d: Demande): AnomalieDemande[] {
  const anomalies: AnomalieDemande[] = []
  if (!d.id.trim() || !d.coproprieteId.trim())
    anomalies.push(anomalie('identifiant_manquant', 'bloquant', 'Identifiant de la demande ou de la copropriété manquant.'))
  anomalies.push(...anomaliesDates(d), ...anomaliesMontants(d), ...anomaliesAcompte(d), ...anomaliesDossier(d))
  return anomalies
}

/** Nouvelle demande « En cours », sans stade ; type, pièce exigée et exécution forcée repris du modèle. */
export function creerDemande(saisie: SaisieDemande, modeleDemande: ModeleDemande): Demande {
  if (!(TYPES_DEMANDE as readonly string[]).includes(modeleDemande.type)) throw new Error(`Type de demande inconnu : « ${modeleDemande.type} ».`)
  const demande: Demande = {
    id: saisie.id.trim(),
    nature: modeleDemande.nature,
    type: modeleDemande.type,
    executionForcee: modeleDemande.executionForcee,
    pieceExigee: modeleDemande.pieceExigee,
    coproprieteId: saisie.coproprieteId.trim(),
    mandatId: texteOuNull(saisie.mandatId),
    prestataireId: texteOuNull(saisie.prestataireId),
    demandeLe: saisie.demandeLe,
    numero: texteOuNull(saisie.numero),
    objet: saisie.objet.trim(),
    statut: 'En cours',
    stade: null,
    dossier: saisie.dossier ?? null,
    prix: saisie.prix ?? null,
    devisAssocie: saisie.devisAssocie ?? null,
    ventilation: saisie.ventilation ?? null,
    acompte: saisie.acompte ?? null,
    prevuLe: saisie.prevuLe ?? null,
    realiseeLe: null,
    termineeLe: null,
    piecesRecues: [],
    factureIds: [],
    sansFacture: false,
  }
  verifierSansBloquant(controlerDemande(demande), 'Demande refusée')
  return demande
}

/** Étape de la frise à laquelle appartient le stade, et nombre d'étapes faites (🔵). */
interface AvancementStade {
  etape: EtapeDemande
  faites: number
}

const AVANCEMENT_SANS_STADE: AvancementStade = { etape: 'Demandée', faites: 1 }

const AVANCEMENT_PAR_STADE: Readonly<Record<StadeIntervention, AvancementStade>> = {
  'Proposition en cours': { etape: 'Demandée', faites: 1 },
  'Proposition résident': { etape: 'Demandée', faites: 1 },
  Acceptée: { etape: 'Acceptation', faites: 2 },
  Refusée: { etape: 'Acceptation', faites: 1 },
  Programmée: { etape: 'Réalisation', faites: 2 },
  Réalisée: { etape: 'Réalisation', faites: 3 },
  Contestée: { etape: 'Réalisation', faites: 2 },
  Validée: { etape: 'Réalisation', faites: 3 },
}

const avancement = (stade: StadeIntervention | null): AvancementStade => (stade === null ? AVANCEMENT_SANS_STADE : AVANCEMENT_PAR_STADE[stade])

/** Étape de la frise d'un stade d'intervention (sans stade : Demandée). */
export const etapeDuStade = (stade: StadeIntervention | null): EtapeDemande => avancement(stade).etape

/** Stades d'une intervention faite, prête à être facturée. */
const STADES_REALISES: ReadonlySet<StadeIntervention> = new Set(['Réalisée', 'Validée'])
/** Stades qui supposent la réalisation connue. */
const STADES_APRES_REALISATION: ReadonlySet<StadeIntervention> = new Set(['Contestée', 'Validée'])

const estRealisee = (d: Demande): boolean => d.stade !== null && STADES_REALISES.has(d.stade)

export const estRefusee = (d: Demande): boolean => d.stade === 'Refusée' || d.statut === 'Refusé'

/** Demande réalisée (date de réalisation connue) ou qui porte une facture. */
const realiseeOuFacturee = (d: Demande): boolean => d.realiseeLe !== null || d.factureIds.length > 0

/**
 * Un refus (statut « Refusé » ou stade « Refusée ») suppose une demande ni réalisée ni facturée, dans les deux sens (🔵) :
 * pas de refus posé sur une demande réalisée ou facturée, pas de réalisation enregistrée sur une demande refusée.
 */
function verifierRefusCoherent(avant: Demande, apres: Demande): void {
  if (!estRefusee(apres) || !realiseeOuFacturee(apres)) return
  if (estRefusee(avant))
    throw new Error(
      `Demande ${avant.id} refusée : aucune réalisation ne peut y être enregistrée ; lever le refus d'abord (statut « En cours » ou « Accepté », stade autre que « Refusée »).`,
    )
  throw new Error(`Demande ${avant.id} déjà réalisée ou facturée : un refus n'est plus possible (contester l'intervention, ou détacher ses factures d'abord).`)
}

export interface OptionsStade {
  /** Date du changement. */
  date: string
  prevuLe?: string
  realiseeLe?: string
}

function realisationApres(d: Demande, stade: StadeIntervention, { date, realiseeLe }: OptionsStade): string | null {
  const connue = realiseeLe ?? d.realiseeLe
  if (stade === 'Réalisée') return connue ?? date
  if (STADES_APRES_REALISATION.has(stade) && connue === null) throw new Error(`Demande ${d.id} : stade « ${stade} » sans date de réalisation.`)
  return connue
}

/**
 * Change le stade d'intervention (copie). Programmée exige une date prévue ; Réalisée pose la date de réalisation si elle
 * manque ; Validée et Contestée l'exigent. Aucun ordre strict : l'OS est souvent saisi après l'intervention. Le nouveau
 * stade remplace un stade « Refusée » (réponse revue) ; au statut « Refusé », aucune réalisation : lever le refus d'abord.
 */
export function changerStade(d: Demande, stade: StadeIntervention, options: OptionsStade): Demande {
  if (!(STADE_INTERVENTION as readonly string[]).includes(stade)) throw new Error(`Stade inconnu : « ${stade} ».`)
  if (!estDateIsoValide(options.date)) throw new Error(`Date du changement de stade invalide (${options.date}) : AAAA-MM-JJ attendu.`)
  verifierDate("Date d'intervention prévue", options.prevuLe)
  verifierDate('Date de réalisation', options.realiseeLe)
  verifierModifiable(d)
  if (d.type === 'devis' && etapeDuStade(stade) === 'Réalisation')
    throw new Error(`Demande de devis ${d.id} : le stade « ${stade} » relève d'une intervention ; créer l'ordre de service.`)
  const prevuLe = options.prevuLe ?? d.prevuLe
  if (stade === 'Programmée' && prevuLe === null) throw new Error(`Demande ${d.id} : intervention programmée sans date prévue.`)
  const suite: Demande = { ...d, stade, prevuLe, realiseeLe: realisationApres(d, stade, options) }
  verifierRefusCoherent(d, suite)
  return suite
}

/**
 * Change le statut administratif (copie). « Terminé » passe par terminerDemande (contrôles de clôture) ; « Refusé » est
 * refusé sur une demande déjà réalisée ou facturée ; un autre statut lève le refus.
 */
export function changerStatut(d: Demande, statut: StatutDemande): Demande {
  if (!(STATUT_DEMANDE as readonly string[]).includes(statut)) throw new Error(`Statut inconnu : « ${statut} ».`)
  if (statut === 'Terminé') throw new Error('Pour terminer une demande, passer par terminerDemande (contrôles de clôture).')
  verifierModifiable(d)
  const suite: Demande = { ...d, statut }
  verifierRefusCoherent(d, suite)
  return suite
}

const STATUTS_SAISIE_A_ENREGISTRER: ReadonlySet<StatutSaisieFacture> = new Set(['Pré-saisie', 'En saisie'])

/** Statut de la facture rapprochée, tiré de ses axes saisie et comptable (🔵). */
export function statutFactureDemande(f: Pick<FactureAPayer, 'statutSaisie' | 'comptabilisee'>): StatutFactureDemande {
  if (f.comptabilisee) return 'Comptabilisée'
  return STATUTS_SAISIE_A_ENREGISTRER.has(f.statutSaisie) ? 'À enregistrer' : 'À traiter'
}

export interface FactureDeDemande {
  id: string
  statut: StatutFactureDemande
}

const RANG_FACTURE: Readonly<Record<StatutFactureDemande, number>> = { 'À enregistrer': 0, 'À traiter': 1, Comptabilisée: 2 }

/** Codification/facture : « Non facturé » sans facture rattachée ; sinon le statut de la facture rattachée la moins avancée. */
export function codificationFacture(d: Demande, factures: readonly FactureDeDemande[]): CodificationFacture {
  if (d.factureIds.length === 0) return NON_FACTURE
  const statuts = new Map(factures.map((f) => [f.id, f.statut]))
  const parFacture = d.factureIds.map((id): StatutFactureDemande => statuts.get(id) ?? 'À enregistrer')
  return parFacture.reduce(
    (moinsAvance, statut) => (RANG_FACTURE[statut] < RANG_FACTURE[moinsAvance] ? statut : moinsAvance),
    parFacture[0],
  )
}

export type EtatEtape = 'done' | 'current' | 'pending' | 'refusee' | 'sans_objet'

export interface EtapeFrise {
  nom: EtapeDemande
  etat: EtatEtape
}

const frise = (etats: readonly EtatEtape[]): EtapeFrise[] => ETAPES_DEMANDE.map((nom, i) => ({ nom, etat: etats[i] }))

function etatSelonRang(rang: number, faites: number): EtatEtape {
  if (rang < faites) return 'done'
  return rang === faites ? 'current' : 'pending'
}

/** Frise Demandée → Acceptation → Réalisation → Facturation de la demande (règles 🔵 de l'en-tête). */
export function etapesDemande(d: Demande, factures: readonly FactureDeDemande[]): EtapeFrise[] {
  if (estRefusee(d)) return frise(['done', 'refusee', 'sans_objet', 'sans_objet'])
  const faites = Math.max(avancement(d.stade).faites, d.statut === 'Accepté' ? 2 : 0)
  if (d.type === 'devis') return frise(['done', etatSelonRang(1, faites), 'sans_objet', 'sans_objet'])
  const facturee = estRealisee(d) && (d.sansFacture || codificationFacture(d, factures) === 'Comptabilisée')
  const total = facturee ? ETAPES_DEMANDE.length : faites
  return frise(ETAPES_DEMANDE.map((_, rang) => etatSelonRang(rang, total)))
}

/** Pourquoi la demande ne peut pas recevoir de facture ; null si elle le peut. */
export function motifRefusFacture(d: Demande): string | null {
  if (d.statut === 'Terminé') return 'la demande est terminée'
  if (d.type === 'devis') return 'une demande de devis ne se facture pas'
  if (estRefusee(d)) return 'la demande est refusée'
  if (d.sansFacture) return 'la demande est marquée sans facture (« Non facturé »)'
  return null
}

/** Rattache une facture à la demande (idempotent). */
export function rattacherFacture(d: Demande, factureId: string): Demande {
  const id = factureId.trim()
  if (!id) throw new Error('Facture à rattacher : identifiant attendu.')
  const motif = motifRefusFacture(d)
  if (motif) throw new Error(`Facture ${id} non rattachable à la demande ${d.id} : ${motif}.`)
  return d.factureIds.includes(id) ? d : { ...d, factureIds: [...d.factureIds, id] }
}

/** Détache une facture de la demande (idempotent) ; jamais d'une demande terminée. */
export function detacherFacture(d: Demande, factureId: string): Demande {
  verifierModifiable(d)
  const id = factureId.trim()
  return d.factureIds.includes(id) ? { ...d, factureIds: d.factureIds.filter((f) => f !== id) } : d
}

/** Marque (ou démarque) la demande « Non facturé » : aucune facture attendue. */
export function marquerSansFacture(d: Demande, sansFacture: boolean): Demande {
  verifierModifiable(d)
  if (sansFacture && d.factureIds.length > 0) throw new Error(`Demande ${d.id} déjà facturée : la détacher de ses factures d'abord.`)
  return { ...d, sansFacture }
}

/** Enregistre une pièce reçue en retour (attestation, PV de réception). */
export function enregistrerPieceRecue(d: Demande, piece: PieceRecue): Demande {
  if (!(PIECES_EXIGEES as readonly string[]).includes(piece.nature)) throw new Error(`Pièce inconnue : « ${piece.nature} ».`)
  if (!estDateIsoValide(piece.recueLe)) throw new Error(`Date de réception invalide (${piece.recueLe}) : AAAA-MM-JJ attendu.`)
  verifierModifiable(d)
  return { ...d, piecesRecues: [...d.piecesRecues, { nature: piece.nature, recueLe: piece.recueLe, documentId: texteOuNull(piece.documentId) }] }
}

/** Interventions réalisées ou validées, sans facture, et dont une facture est attendue (repère T43 § 15). */
export const demandesNonFacturees = (demandes: readonly Demande[]): Demande[] =>
  demandes.filter((d) => motifRefusFacture(d) === null && d.factureIds.length === 0 && estRealisee(d))

function anomaliesRealisation(d: Demande): AnomalieDemande[] {
  if (d.stade === 'Contestée') return [anomalie('intervention_contestee', 'bloquant', 'Intervention contestée : régler la contestation avant la clôture.')]
  if (d.stade === 'Réalisée')
    return [anomalie('intervention_non_validee', 'alerte', "Intervention réalisée mais non validée : vérifier l'intervention avant la clôture.")]
  if (d.stade === 'Validée') return []
  return [anomalie('intervention_non_realisee', 'bloquant', "Intervention non réalisée : la clôture attend la réalisation.")]
}

function anomaliesFacturation(d: Demande, factures: readonly FactureDeDemande[]): AnomalieDemande[] {
  if (d.sansFacture) return []
  const codification = codificationFacture(d, factures)
  if (codification === NON_FACTURE)
    return [anomalie('facture_absente', 'bloquant', 'Aucune facture rattachée : la rattacher, ou marquer la demande « Non facturé ».')]
  if (codification === 'Comptabilisée') return []
  return [anomalie('facture_non_comptabilisee', 'alerte', `Facture rattachée encore « ${codification} » : pas encore comptabilisée.`)]
}

/** Demande refusée sans réalisation ni facture : rien à contrôler à la clôture. */
const refuseeSansSuite = (d: Demande): boolean => estRefusee(d) && !realiseeOuFacturee(d)

/**
 * Contrôles avant la clôture. Une demande de devis, ou une demande refusée sans réalisation ni facture, se clôt sans
 * contrôle. Pour une intervention : refus contradictoire (refusée mais réalisée ou facturée, état que les fonctions de ce
 * module ne produisent pas : objet repris d'ailleurs, bloquant), pièce exigée par le modèle (règle de gestion du cabinet,
 * bloquante), réalisation (contestée ou non réalisée : bloquant ; réalisée non validée : alerte), facture (absente :
 * bloquant, sauf « Non facturé » ; non comptabilisée : alerte).
 */
export function controlerCloture(d: Demande, factures: readonly FactureDeDemande[]): AnomalieDemande[] {
  if (d.type === 'devis' || refuseeSansSuite(d)) return []
  const anomalies: AnomalieDemande[] = []
  if (estRefusee(d))
    anomalies.push(
      anomalie('refus_contradictoire', 'bloquant', 'Demande refusée mais réalisée ou facturée : lever le refus, ou détacher ses factures, avant la clôture.'),
    )
  if (d.pieceExigee !== null && !d.piecesRecues.some((p) => p.nature === d.pieceExigee))
    anomalies.push(
      anomalie(
        'piece_exigee_absente',
        'bloquant',
        `Pièce exigée en retour absente (${LIBELLE_PIECE[d.pieceExigee]}) : règle de gestion du cabinet, à recevoir avant la clôture.`,
      ),
    )
  return [...anomalies, ...anomaliesRealisation(d), ...anomaliesFacturation(d, factures)]
}

/** La date de fin n'est antérieure ni à la date de la demande ni à celle de la réalisation (🔵). */
function verifierDateDeFin(d: Demande, date: string): void {
  const bornes: [string, string | null][] = [
    ['de la demande', d.demandeLe],
    ['de réalisation', d.realiseeLe],
  ]
  for (const [libelle, borne] of bornes)
    if (borne !== null && date < borne)
      throw new Error(`Demande ${d.id} : date de fin (${dateIsoVersFr(date)}) antérieure à la date ${libelle} (${dateIsoVersFr(borne)}).`)
}

/** Termine la demande (statut « Terminé ») ; refusé s'il reste une anomalie bloquante de clôture. */
export function terminerDemande(d: Demande, factures: readonly FactureDeDemande[], date: string): Demande {
  if (!estDateIsoValide(date)) throw new Error(`Date de fin invalide (${date}) : AAAA-MM-JJ attendu.`)
  verifierModifiable(d)
  verifierDateDeFin(d, date)
  verifierSansBloquant(controlerCloture(d, factures), `Demande ${d.id} non terminée`)
  return { ...d, statut: 'Terminé', termineeLe: date }
}

/** Fiche liée de la demande (onglet Demandes des fiches, point 47) : copropriété, entreprise, mandat et dossier. */
export function ficheLieeDepuisDemande(d: Demande): FicheLiee {
  const rattachements: Rattachement[] = [creerRattachement('Copropriété', d.coproprieteId)]
  if (d.prestataireId) rattachements.push(creerRattachement('Entreprise', d.prestataireId))
  if (d.mandatId) rattachements.push(creerRattachement('Mandat de syndic', d.mandatId))
  const { dossier } = d
  if (dossier && !rattachements.some((r) => r.type === dossier.type && r.id === dossier.id)) rattachements.push(dossier)
  return { id: d.id, date: d.demandeLe, statut: d.statut, rattachements }
}

/** Moment du contrôle déclaratif : avant l'envoi de l'ordre de service, ou avant le règlement (🔵, 🔴 à Hugo). */
export const MOMENTS_CONTROLE_DECLARATIF = ['ordre_de_service', 'reglement'] as const
export type MomentControleDeclaratif = (typeof MOMENTS_CONTROLE_DECLARATIF)[number]

export interface OptionsControleDeclaratif {
  /**
   * Avant l'envoi de l'ordre de service (vigilance et décennale bloquantes) ou avant le règlement (alertes seulement) :
   * obligatoire, le bouton Gestéam étant rangé au bloc Règlement sans que son moment soit établi.
   */
  moment: MomentControleDeclaratif
  /** Date du contrôle : celle de l'envoi de l'ordre de service, ou celle du règlement. */
  date: string
  /** Travaux soumis à l'assurance décennale obligatoire ; null : à qualifier. */
  decennaleObligatoire: boolean | null
  /**
   * Montant HT de l'opération entière (commandes successives de même objet avec la même entreprise additionnées par
   * l'appelant) ; à défaut, le HT du devis associé, puis la base HT du prix si aucun devis associé n'en diffère.
   */
  montantHtOperationCentimes?: number
  /** Activité commandée (contrôle avant l'ordre de service seulement). */
  activite?: string | null
  dateOuvertureChantier?: string | null
}

/**
 * Montant HT de la demande : le HT du devis associé, qui fait le prévu ; à défaut, la base HT du prix, sauf si un devis
 * associé d'un autre montant TTC existe (la base du prix ne vaut pas pour lui : erreur, le montant est à donner).
 */
function montantHtDeLaDemande(d: Demande): number | null {
  const devis = d.devisAssocie
  if (devis?.montantHtCentimes != null) return devis.montantHtCentimes
  if (devis && devis.montantTtcCentimes !== d.prix?.montantTtcCentimes)
    throw new Error(
      `Demande ${d.id} : devis associé de ${euros(devis.montantTtcCentimes)} TTC, différent du prix ; donner son montant HT (ou celui de l'opération), la base HT du prix ne vaut pas pour lui.`,
    )
  return d.prix?.baseHtCentimes ?? null
}

/**
 * Contrôle déclaratif de l'entreprise (bouton « Contrôle déclaratif » du bloc Règlement de l'onglet Suivi), au moment
 * choisi : controlerAvantOrdreService ou controlerAvantReglement de vigilance-entreprises.ts (point 37), réutilisés tels
 * quels, sur le montant HT de l'opération. Une demande de devis ne conclut aucun marché : rien à contrôler.
 */
export function controleDeclaratifDemande(d: Demande, pieces: PiecesEntreprise, options: OptionsControleDeclaratif): AnomalieEntreprise[] {
  if (!(MOMENTS_CONTROLE_DECLARATIF as readonly string[]).includes(options.moment))
    throw new Error(`Moment du contrôle inconnu : « ${options.moment} » (ordre_de_service ou reglement attendu).`)
  if (d.type === 'devis') throw new Error(`Demande de devis ${d.id} : aucun marché conclu, le contrôle déclaratif porte sur l'ordre de service.`)
  if (d.prestataireId === null) throw new Error(`Demande ${d.id} sans entreprise : contrôle déclaratif impossible.`)
  if (pieces.prestataireId !== d.prestataireId)
    throw new Error(`Demande ${d.id} : pièces d'une autre entreprise (${pieces.prestataireId}) que celle de la demande (${d.prestataireId}).`)
  const montantHtCentimes = options.montantHtOperationCentimes ?? montantHtDeLaDemande(d)
  if (montantHtCentimes === null)
    throw new Error(`Demande ${d.id} : montant HT de l'opération inconnu (base HT du prix à saisir) ; le seuil de vigilance ne peut pas être apprécié.`)
  const { date, decennaleObligatoire } = options
  const dateOuvertureChantier = options.dateOuvertureChantier ?? null
  if (options.moment === 'reglement') return controlerAvantReglement(pieces, { date, montantHtCentimes, decennaleObligatoire, dateOuvertureChantier })
  return controlerAvantOrdreService(pieces, { date, montantHtCentimes, decennaleObligatoire, activite: options.activite ?? null, dateOuvertureChantier })
}

/** Statut de l'ordre de mission VitFix → stade d'intervention (🔵) ; la validation reste au cabinet. */
const STADE_PAR_STATUT_ORDRE: Readonly<Record<StatutOrdreMission, StadeIntervention | null>> = {
  en_attente: null,
  accepte: 'Acceptée',
  en_cours: 'Programmée',
  termine: 'Réalisée',
  refuse: 'Refusée',
}

export const stadeDepuisStatutOrdre = (statut: StatutOrdreMission): StadeIntervention | null => STADE_PAR_STATUT_ORDRE[statut]

/** Stades d'une mission d'exécution engagée : acceptée, programmée, puis réalisée ou validée (STADES_REALISES). */
const STADES_EXECUTION_EN_COURS: ReadonlySet<StadeIntervention> = new Set<StadeIntervention>(['Acceptée', 'Programmée', ...STADES_REALISES])

/**
 * Phase suggérée au contentieux : « Exécution en cours » quand une demande d'exécution forcée qui lui est rattachée est
 * acceptée, programmée, réalisée ou validée, ni refusée ni terminée (🔵). Simple suggestion : contentieux.ts n'est pas
 * modifié.
 */
export function phaseSuggereeParExecution(demandes: readonly Demande[], contentieuxId: string): PhaseContentieux | null {
  const enCours = demandes.some(
    (d) =>
      d.executionForcee &&
      d.dossier?.type === 'Contentieux' &&
      d.dossier.id === contentieuxId &&
      d.statut !== 'Terminé' &&
      !estRefusee(d) &&
      d.stade !== null &&
      STADES_EXECUTION_EN_COURS.has(d.stade),
  )
  return enCours ? 'Exécution en cours' : null
}
