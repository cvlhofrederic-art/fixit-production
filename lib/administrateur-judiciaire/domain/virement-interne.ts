import { NATURES_COMPTE_BANCAIRE, validerIban, type NatureCompteBancaire } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { refDecret1967, refLoi1965 } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { citerFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import {
  controlerAffectationFondsTravaux,
  type DecaissementFondsTravaux,
  type ResultatAffectation,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import { creerOrdreVirement, genererPain001, verifierEmission, type StatutOrdre } from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import { creerTraitement, type FamilleTraitement, type LigneMouvement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'
import {
  TYPE_VIREMENT_INTERNE,
  controlerRangsDuLot,
  verifierRang,
  type OrdreDuLot,
} from '@/lib/administrateur-judiciaire/domain/types-ordres-banque'

/**
 * Virement de banque à banque entre comptes du syndicat (point 39 du bilan 2). Fonctions pures, montants en CENTIMES
 * ENTIERS, dates ISO, sans écran ni table.
 *
 * Gestéam —
 * - tranche 43 § 12 : 🟢 un virement de banque à banque (par exemple du compte courant vers le compte du fonds de travaux,
 *   ou entre un compte séparé et un compte de regroupement) est un traitement distinct, « Règlement de banque à banque » ;
 *   ses ordres sont des lignes du lot, avec leur rang ;
 * - tranche 29 : 🟢 « Règlement de banque à banque » figure parmi les traitements du journal ; les comptes de trésorerie
 *   d'un mandat sont des sous-comptes 512 <mandat>.512xx.00000.0 (Banque, regroupement, avance travaux, fonds travaux,
 *   placements, CDC travaux, comptes de l'ancien syndic ou de l'ancien AJ) ;
 * - décision D-BANQUE (27/10/2026) : la tenue des comptes est un réglage du cabinet ; le compte du fonds de travaux est
 *   toujours distinct ; chaque compte a une nature (comptes-bancaires.ts).
 *
 * 🟢 Lu sur le texte (Légifrance, versions en vigueur au 30/10/2026) :
 * - L. 1965 art. 18, II, al. 3 : compte séparé au nom du syndicat, sans convention de fusion ni compensation avec tout
 *   autre compte ; al. 4 : compte séparé rémunéré du fonds de travaux, dans le même établissement, sans fusion ni
 *   compensation, et « Les virements en provenance du compte mentionné au troisième alinéa du présent II sont
 *   autorisés » (seule occurrence du mot « virement » dans la loi) ; dernier al. : le syndic ne peut avancer de fonds au
 *   syndicat, à l'exception du syndic provisoire et de l'administrateur provisoire désigné en application des art. 29-1
 *   et 29-11 ;
 * - L. 1965 art. 14-2-1, I, al. 7 : l'assemblée affecte les sommes du fonds aux dépenses des 1° à 4°, à la majorité de la
 *   dépense ; III : les sommes sont attachées aux lots et jamais remboursées au vendeur ;
 * - L. 1965 art. 29-14, 2° : le juge peut autoriser l'administrateur provisoire à utiliser le fonds pour le redressement
 *   ou la gestion courante ; art. 29-1, I, al. 2 : l'administrateur provisoire reçoit tout ou partie des pouvoirs de
 *   l'assemblée selon l'ordonnance ;
 * - D. 1967 art. 35-1 : l'assemblée décide, s'il y a lieu, du placement des fonds recueillis ;
 * - arrêté du 14 mars 2005, art. 7 et 8 : classe 5 = 50 Fonds placés, 512 Banques, 514, 53 Caisse ; ni 5115 ni 58
 *   « Virements internes » ; seuls ces comptes et leurs subdivisions sont utilisables ; art. 10 : le compte 105 « Fonds de
 *   travaux » est crédité des cotisations et débité par le 705 « Affectation du fonds de travaux ».
 * 🔵 Déduit :
 * - un virement interne relie deux comptes ACTIFS, distincts, du MÊME syndicat (D1), sans tiers ; une avance de fonds du
 *   gestionnaire au syndicat (interdite au syndic par l'art. 18, II, dernier al., sauf au syndic provisoire et à
 *   l'administrateur provisoire désigné en application des art. 29-1 et 29-11) viendrait d'un tiers : ce n'est jamais un
 *   virement interne ; refusée ici, ce module n'en enregistre aucune (voir 🔴 pour les régimes des art. 46 et 47) ;
 * - rang : chaque virement porte son rang dans le lot (colonne « Or. ») et la taille de son lot (nombreOrdresDuLot,
 *   donnée VitFix : la fiche Gestéam ne montre que « Traitement n° + rang »), saisis ensemble (rang ≤ taille) ou
 *   attribués par creerLotVirementsInternes ; le lot est fermé comme un ordre de virement l'est par ses lignes, et
 *   contrôlé AVANT l'envoi à la banque : emettreLotVirementsInternes émet le lot entier, en une fois (comme emettreOrdre
 *   pour un ordre de virement), s'il compte exactement les rangs 1 à cette taille, chacun une fois (controlerRangsDuLot),
 *   sous un traitement libre (absent du journal, réservé par aucun autre virement déjà émis) ; l'écriture refait ces
 *   contrôles ; un lot émis s'écrit donc toujours, en une fois, jamais en partie ni deux fois ; avant l'émission, un lot
 *   refusé se recompose (recomposerLotVirementsInternes : virement abandonné retiré, rangs refaits, traitement neuf) ;
 *   émis, il ne change plus ;
 * - le « compte mentionné au troisième alinéa » est le compte séparé principal ; l'alimentation du fonds depuis un autre
 *   compte du syndicat n'est interdite par aucun texte (l'argent entre au fonds, il n'en sort pas) : admise ;
 * - sortie du fonds vers un autre compte : elle se rattache à un emploi du fonds, contrôlé par
 *   controlerAffectationFondsTravaux (fonds-travaux.ts, J4) : décision d'affectation de l'assemblée, ou ordonnance du
 *   juge (art. 29-14, 2°) ; en administration provisoire, l'ordonnance qui confie les pouvoirs de l'assemblée (art. 29-1)
 *   se cite comme décision, pour les seules dépenses du I, 1° à 4° (decisionAg) : l'assemblée ne pouvant affecter le
 *   fonds qu'à ces dépenses, le redressement ou le maintien de la gestion courante exigent l'ordonnance de l'art. 29-14,
 *   2° (autorisationJuge) ;
 * - d'un compte du fonds à un autre compte du fonds (changement de banque, dépôt à la Caisse des dépôts) : l'argent reste
 *   au fonds ; admis sans décision ;
 * - vers un compte de placement : c'est un placement des fonds (D. 1967 art. 35-1), décision de l'assemblée exigée (ou
 *   ordonnance qui en confie le pouvoir) ; depuis le fonds de travaux, refusé (voir 🔴) ;
 * - un compte repris de l'ancien gestionnaire se solde vers le compte du mandat puis se clôture (comptes-bancaires.ts) :
 *   jamais alimenté ; s'il tenait le fonds de travaux (tenaitFondsTravaux), ses sommes restent des cotisations au fonds
 *   (art. 18, II, al. 4 ; art. 14-2-1, I, al. 7) : vers un compte du fonds, c'est un changement de compte ; ailleurs, une
 *   sortie du fonds, sous contrôle d'affectation ;
 * - sans compensation (art. 18, II, al. 3 et 4) : chaque virement s'écrit pour son montant brut, dans son sens, jamais
 *   par solde net, même dans un lot qui en compte de sens contraires ;
 * - écriture au paiement, comme un règlement : après l'émission, débit du 512 de destination, crédit du 512 de source,
 *   sans compte de transit ; le compte 105 n'est pas touché : l'affectation (105 → 705) est une écriture distincte, non
 *   passée ici ;
 * - même IBAN pour deux comptes : un seul compte bancaire ; avec le fonds de travaux, il serait confondu (art. 18, II,
 *   al. 4).
 * 🔴 Non établi (à trancher par Frédéric ou Hugo) :
 * - Frédéric : par quel compte passe le transit d'un virement interne, directement de 512 à 512 (choix de VitFix, comme
 *   Gestéam qui tient « Rgt fonds travaux » en 512xx) ou par le 47 (471, 472) ? Le compte du fonds de travaux, rémunéré,
 *   va-t-il en 50 « Fonds placés » ou dans une subdivision du 512 ?
 * - Frédéric : après une affectation votée, la facture de travaux se règle-t-elle directement depuis le compte du fonds,
 *   ou le cabinet vire-t-il d'abord vers le compte courant ? Le texte n'autorise expressément que le sens courant → fonds ;
 *   VitFix admet la sortie du fonds sous contrôle d'affectation ;
 * - Frédéric : le syndic peut-il prélever sur le fonds, sans assemblée, pour des travaux d'urgence (art. 14-2-1, I, 3°) ?
 *   VitFix : non (J4), D. 1967 art. 37 ne visant qu'une provision limitée au tiers du devis ;
 * - Hugo : la décision d'affectation (decisionAg : assemblée, ou ordonnance de l'art. 29-1 qui en confie le pouvoir) et
 *   l'ordonnance de l'art. 29-14, 2° (autorisationJuge) sont des textes libres, que VitFix ne lit pas : quelle forme en
 *   exiger (juridiction, date, n° de l'ordonnance) ?
 * - Hugo : le syndic désigné en justice (D. 1967 art. 46) est-il un « syndic provisoire » au sens de l'art. 18, II,
 *   dernier al. ? L'administrateur provisoire de l'art. 47, qui n'est pas désigné en application des art. 29-1 ou 29-11,
 *   peut-il avancer des fonds au syndicat ? Sans réponse, ce module n'enregistre aucune avance ;
 * - Frédéric : un compte repris qui tenait le fonds de travaux se distingue-t-il dans Gestéam (tranche 29 : un seul
 *   libellé « Banque ancien AJ / ancien syndic ») ? VitFix le marque à la saisie du compte (tenaitFondsTravaux) ;
 * - Hugo : quels textes fondent le compte centralisateur du cabinet ou le dépôt à la Caisse des dépôts pour un
 *   administrateur provisoire (C. com., livre VIII, non lu) ? VitFix admet un sous-compte centralisateur et un compte à la
 *   Caisse des dépôts comme comptes du syndicat (D-BANQUE) ; quand le fonds est déposé à la Caisse des dépôts, y a-t-il
 *   un compte distinct pour lui ?
 * - Hugo ou Frédéric : un virement du fonds vers un compte de placement est-il un emploi (décision d'affectation), un
 *   placement (art. 35-1) ou interdit, le compte du fonds étant déjà rémunéré ? Refusé ici ;
 * - Frédéric : Gestéam rattache-t-il le virement de banque à banque à un ordre de type « Ordre de virement », le syndicat
 *   pour tiers ? Le bilan a retenu un type VitFix à part, sans tiers ;
 * - Frédéric : Gestéam laisse-t-il « Enregistré » un ordre d'un lot dont les autres sont « Émis » (statut affiché par
 *   ordre) ? Non observé ; VitFix émet le lot entier. Un virement d'un lot émis que la banque n'exécute pas (rejet, ordre
 *   hors fichier abandonné) : aucune annulation après émission ici (comme reglements-fournisseurs.ts) ; le lot s'écrit
 *   entier et la correction attend la contre-passation (ci-dessous) ; faut-il plutôt retirer ce virement du lot avant
 *   l'écriture ?
 * - aucune famille d'annulation observée pour « Règlement de banque à banque » (comme « Annulation de règlements » pour
 *   un règlement de factures) : annulerTraitement (traitements.ts) refuse la contre-passation ; laquelle retenir ?
 * - que recouvre la famille « Ajustement bancaire fonds travaux » du référentiel (non observée) ? Non utilisée ici.
 */

/** Famille Gestéam du traitement d'un virement interne (référentiel FAMILLE_TRAITEMENT, bloc Règlements). */
export const FAMILLE_VIREMENT_INTERNE: FamilleTraitement = 'Règlement de banque à banque'

const FONDEMENT_FONDS_SEPARE = citerFondement(refLoi1965('18, II, al. 4'))
const FONDEMENT_AVANCE = citerFondement(refLoi1965('18, II, dernier al.'))
const FONDEMENT_AFFECTATION = citerFondement(refLoi1965('14-2-1, I, al. 7'))
const FONDEMENT_29_14 = citerFondement(refLoi1965('29-14, 2°'))
const FONDEMENT_PLACEMENT = citerFondement(refDecret1967('35-1'))
const FONDEMENT_POUVOIRS_AP = citerFondement(refLoi1965('29-1, I'))
const COMPTE_512 = /^([^.]{4})\.512[0-9A-Z]{2}\.[0-9A-Z]{5}\.[0-9A-Z]$/

/** Compte bancaire du syndicat, tel que le virement le lit (D-BANQUE : nature ; plan comptable : son 512). */
export interface CompteVirementInterne {
  banqueId: string
  coproprieteId: string
  nature: NatureCompteBancaire
  /** Null pour un compte sans IBAN propre (Caisse des dépôts, sous-compte centralisateur) : pas de fichier. */
  iban: string | null
  bic: string | null
  /** Sous-compte 512 du syndicat : <syndicat>.512xx.<auxiliaire>.<repère>. */
  compte512: string
  actif: boolean
  /**
   * Compte repris de l'ancien gestionnaire qui tenait le fonds de travaux : ses sommes restent au fonds (art. 18, II,
   * al. 4). Réservé à la nature « repris_ancien_gestionnaire » ; absent : faux.
   */
  tenaitFondsTravaux?: boolean
}

/** Ce que le sens au regard du fonds de travaux lit d'un compte. */
export type CompteFonds = Pick<CompteVirementInterne, 'nature' | 'tenaitFondsTravaux'>

/** Emploi du fonds de travaux auquel se rattache un virement qui en sort (fonds-travaux.ts, montant = le virement). */
export type EmploiFondsTravaux = Omit<DecaissementFondsTravaux, 'montantCentimes'>

export interface SaisieVirementInterne {
  id: string
  numero: string
  date: string
  coproprieteId: string
  /** D1 : la mission qui ordonne le virement. */
  mandatId: string
  /** Traitement « Règlement de banque à banque » sous lequel le virement s'écrit, une fois émis. */
  traitementId: string
  /** Rang du virement dans son lot (colonne « Or. », fiche « Traitement n° + rang »), à partir de 1. */
  rang: number
  /** Nombre de virements du lot, saisi avec le rang (rang ≤ taille) : le traitement exige exactement les rangs 1 à ce nombre. */
  nombreOrdresDuLot: number
  source: CompteVirementInterne
  destination: CompteVirementInterne
  montantCentimes: number
  libelle: string
  /** Exigé pour une sortie du fonds de travaux, refusé sinon. */
  emploiFondsTravaux?: EmploiFondsTravaux | null
  /** Exigée vers un compte de placement (D. 1967 art. 35-1), refusée sinon : décision d'assemblée ou ordonnance. */
  decisionPlacement?: string | null
}

/** Effet du virement sur le fonds de travaux, selon la nature des deux comptes. */
export type MouvementFondsTravaux = 'aucun' | 'alimentation' | 'sortie' | 'changement_de_compte'

export interface VirementInterne {
  id: string
  numero: string
  date: string
  coproprieteId: string
  mandatId: string
  traitementId: string
  rang: number
  nombreOrdresDuLot: number
  source: CompteVirementInterne
  destination: CompteVirementInterne
  montantCentimes: number
  libelle: string
  type: typeof TYPE_VIREMENT_INTERNE
  famille: FamilleTraitement
  mouvementFondsTravaux: MouvementFondsTravaux
  emploiFondsTravaux: EmploiFondsTravaux | null
  /** Contrôle d'affectation d'une sortie du fonds (admis) ; null sinon. */
  affectation: ResultatAffectation | null
  decisionPlacement: string | null
  statut: StatutOrdre
  dateEmission: string | null
  impute: boolean
}

const ibanNormalise = (iban: string): string => iban.replaceAll(/\s+/g, '').toUpperCase()

function texteRequis(valeur: string | null | undefined, message: string): void {
  if (!valeur?.trim()) throw new Error(message)
}

/** Compte qui tient le fonds de travaux : le compte séparé du fonds, ou le compte repris qui le tenait. */
const estCompteDuFonds = (c: CompteFonds): boolean =>
  c.nature === 'fonds_travaux' || (c.nature === 'repris_ancien_gestionnaire' && c.tenaitFondsTravaux === true)

/** Sens du virement au regard du fonds de travaux : y entre, en sort, passe d'un compte du fonds à un autre, ou rien. */
export function mouvementFondsTravaux(source: CompteFonds, destination: CompteFonds): MouvementFondsTravaux {
  const depuisFonds = estCompteDuFonds(source)
  const versFonds = estCompteDuFonds(destination)
  if (depuisFonds && versFonds) return 'changement_de_compte'
  if (depuisFonds) return 'sortie'
  if (versFonds) return 'alimentation'
  return 'aucun'
}

// ─── Création ───────────────────────────────────────────────────────────────────────────────

const MESSAGE_SANS_TRAITEMENT = 'Virement interne sans traitement de rattachement (« Règlement de banque à banque »).'

/** Place du virement dans son lot : rang entier ≥ 1, taille du lot entière ≥ 1, rang compris dans le lot. */
function verifierPlaceDansLot(rang: number, nombreOrdresDuLot: number): void {
  verifierRang(rang)
  if (!Number.isInteger(nombreOrdresDuLot) || nombreOrdresDuLot < 1)
    throw new Error(`Taille du lot invalide (${nombreOrdresDuLot}) : nombre entier de virements, à partir de 1, attendu avec le rang.`)
  if (rang > nombreOrdresDuLot) throw new Error(`Rang ${rang} hors du lot de ${nombreOrdresDuLot} virements : rangs 1 à ${nombreOrdresDuLot} attendus.`)
}

function verifierEnTete(saisie: SaisieVirementInterne): void {
  texteRequis(saisie.id, 'Virement interne sans identifiant.')
  texteRequis(saisie.numero, 'Virement interne sans numéro.')
  texteRequis(saisie.coproprieteId, 'Virement interne sans syndicat (D1).')
  texteRequis(saisie.mandatId, 'Virement interne sans mandat (D1 : la mission qui ordonne le virement).')
  texteRequis(saisie.traitementId, MESSAGE_SANS_TRAITEMENT)
  texteRequis(saisie.libelle, 'Libellé du virement attendu.')
  verifierPlaceDansLot(saisie.rang, saisie.nombreOrdresDuLot)
  if (!Number.isInteger(saisie.montantCentimes) || saisie.montantCentimes <= 0)
    throw new Error(`Montant invalide (${saisie.montantCentimes}) : centimes entiers strictement positifs attendus.`)
  if (!estDateIsoValide(saisie.date)) throw new Error(`Date invalide (${saisie.date}) : AAAA-MM-JJ attendu.`)
}

function verifierCompte(c: CompteVirementInterne, role: 'source' | 'destination', coproprieteId: string, segmentSyndicat: string): void {
  texteRequis(c.banqueId, `Compte ${role} sans identifiant.`)
  const nom = `Compte ${role} ${c.banqueId}`
  if (!Object.hasOwn(NATURES_COMPTE_BANCAIRE, c.nature)) throw new Error(`${nom} : nature inconnue « ${c.nature} ».`)
  if (c.tenaitFondsTravaux && c.nature !== 'repris_ancien_gestionnaire')
    throw new Error(`${nom} : seul un compte repris de l'ancien gestionnaire porte la mention « tenait le fonds de travaux ».`)
  if (c.coproprieteId !== coproprieteId)
    throw new Error(
      `${nom} : compte d'un autre syndicat ; un virement interne relie deux comptes du même syndicat (D1). Une avance de fonds au syndicat n'est pas un virement interne ; le syndic ne peut en faire, sauf le syndic provisoire et l'administrateur provisoire désigné en application des art. 29-1 et 29-11 (${FONDEMENT_AVANCE}).`,
    )
  if (!c.actif) throw new Error(`${nom} : compte inactif.`)
  if (c.iban !== null && !validerIban(c.iban)) throw new Error(`${nom} : IBAN invalide (format ou clé).`)
  const lu = COMPTE_512.exec(c.compte512)
  if (!lu) throw new Error(`${nom} : compte « ${c.compte512} », 512 au format <syndicat>.512xx.<auxiliaire>.<repère> attendu.`)
  if (lu[1] !== segmentSyndicat)
    throw new Error(`${nom} : compte « ${c.compte512} » d'un autre syndicat (segment « ${segmentSyndicat} » attendu, D1).`)
}

function verifierPaire(source: CompteVirementInterne, destination: CompteVirementInterne): void {
  if (source.banqueId === destination.banqueId) throw new Error(`Source et destination : même compte (${source.banqueId}).`)
  if (source.compte512 === destination.compte512) throw new Error(`Source et destination : même compte 512 (${source.compte512}).`)
  const memeIban = source.iban !== null && destination.iban !== null && ibanNormalise(source.iban) === ibanNormalise(destination.iban)
  const avecFonds = estCompteDuFonds(source) || estCompteDuFonds(destination)
  if (memeIban && avecFonds)
    throw new Error(
      `Fonds de travaux : même IBAN qu'un autre compte du syndicat ; le fonds est déposé sur un compte séparé, sans fusion ni compensation (${FONDEMENT_FONDS_SEPARE}).`,
    )
  if (memeIban) throw new Error('Source et destination : même IBAN, donc un seul compte bancaire.')
  if (destination.nature === 'repris_ancien_gestionnaire')
    throw new Error(`Compte ${destination.banqueId} repris de l'ancien gestionnaire : il se solde vers le compte du mandat puis se clôture, jamais alimenté.`)
}

/** Sortie du fonds de travaux : jamais vers un placement (🔴) ; sinon un emploi admis par le contrôle d'affectation. */
function controlerSortieDuFonds(saisie: SaisieVirementInterne): { affectation: ResultatAffectation; emploi: EmploiFondsTravaux } {
  if (saisie.destination.nature === 'placement')
    throw new Error(
      `Fonds de travaux vers un compte de placement : refusé ; le fonds est déposé sur son compte séparé rémunéré (${FONDEMENT_FONDS_SEPARE}) et aucun texte lu n'en prévoit le placement ailleurs ; à trancher.`,
    )
  const emploi = saisie.emploiFondsTravaux
  if (!emploi)
    throw new Error(
      `Sortie du fonds de travaux : rattacher l'emploi du fonds, avec la décision d'affectation de l'assemblée (${FONDEMENT_AFFECTATION}) ou l'ordonnance du juge (${FONDEMENT_29_14}).`,
    )
  const affectation = controlerAffectationFondsTravaux({ ...emploi, montantCentimes: saisie.montantCentimes })
  if (!affectation.autorise) throw new Error(`Sortie du fonds de travaux refusée : ${affectation.motif} (${affectation.fondement})`)
  return { affectation, emploi: { ...emploi } }
}

function controlerFondsTravaux(
  saisie: SaisieVirementInterne,
  mouvement: MouvementFondsTravaux,
): { affectation: ResultatAffectation | null; emploi: EmploiFondsTravaux | null } {
  if (mouvement === 'sortie') return controlerSortieDuFonds(saisie)
  if (saisie.emploiFondsTravaux)
    throw new Error(`Emploi du fonds de travaux rattaché à un virement qui ne sort pas du fonds (${mouvement}) : vérifier le sens du virement.`)
  return { affectation: null, emploi: null }
}

function controlerPlacement(saisie: SaisieVirementInterne): string | null {
  const brut = saisie.decisionPlacement?.trim()
  const decision = brut ? brut : null
  if (saisie.destination.nature !== 'placement') {
    if (decision) throw new Error('Décision de placement sans compte de placement en destination : vérifier le compte.')
    return null
  }
  if (!decision)
    throw new Error(
      `Virement vers un compte de placement : rattacher la décision de l'assemblée qui place les fonds (${FONDEMENT_PLACEMENT}), ou l'ordonnance qui en confie le pouvoir à l'administrateur provisoire (${FONDEMENT_POUVOIRS_AP}).`,
    )
  return decision
}

/**
 * Crée un virement interne « Enregistré », non émis, non imputé, sans tiers, à son rang dans un lot de taille donnée.
 * Refuse une saisie invalide (identifiants, libellé, rang ou taille du lot qui n'est pas un entier ≥ 1, rang au-delà de
 * la taille du lot, montant qui n'est pas un nombre entier de centimes > 0, date non ISO), un compte d'un autre
 * syndicat, inactif, de nature inconnue, d'IBAN invalide ou hors 512 du
 * syndicat, deux fois le même compte (identifiant, 512 ou IBAN), un compte repris en destination, la mention « tenait le
 * fonds de travaux » sur un compte non repris, une sortie du fonds de travaux (compte du fonds ou compte repris qui le
 * tenait) sans emploi admis ou vers un placement, un placement sans décision, un emploi ou une décision de placement sans
 * objet.
 */
export function creerVirementInterne(saisie: SaisieVirementInterne, { segmentSyndicat }: { segmentSyndicat: string }): VirementInterne {
  verifierEnTete(saisie)
  verifierCompte(saisie.source, 'source', saisie.coproprieteId, segmentSyndicat)
  verifierCompte(saisie.destination, 'destination', saisie.coproprieteId, segmentSyndicat)
  verifierPaire(saisie.source, saisie.destination)
  const mouvement = mouvementFondsTravaux(saisie.source, saisie.destination)
  const { affectation, emploi } = controlerFondsTravaux(saisie, mouvement)
  const decisionPlacement = controlerPlacement(saisie)
  return {
    id: saisie.id,
    numero: saisie.numero.trim(),
    date: saisie.date,
    coproprieteId: saisie.coproprieteId,
    mandatId: saisie.mandatId,
    traitementId: saisie.traitementId,
    rang: saisie.rang,
    nombreOrdresDuLot: saisie.nombreOrdresDuLot,
    source: { ...saisie.source },
    destination: { ...saisie.destination },
    montantCentimes: saisie.montantCentimes,
    libelle: saisie.libelle.trim(),
    type: TYPE_VIREMENT_INTERNE,
    famille: FAMILLE_VIREMENT_INTERNE,
    mouvementFondsTravaux: mouvement,
    emploiFondsTravaux: emploi,
    affectation,
    decisionPlacement,
    statut: 'Enregistré',
    dateEmission: null,
    impute: false,
  }
}

/** Saisie d'un virement d'un lot créé d'un coup : sa place (traitement, rang, taille du lot) est attribuée. */
export type SaisieVirementDuLot = Omit<SaisieVirementInterne, 'traitementId' | 'rang' | 'nombreOrdresDuLot'>

/** Composition d'un lot : au moins un virement, un traitement, un seul syndicat (D1), chaque virement une fois. */
function verifierCompositionDuLot(elements: readonly { id: string; coproprieteId: string }[], traitementId: string): void {
  if (elements.length === 0) throw new Error('Lot de virements internes : aucun virement.')
  texteRequis(traitementId, MESSAGE_SANS_TRAITEMENT)
  if (new Set(elements.map((e) => e.coproprieteId)).size > 1) throw new Error('Lot refusé : virements de plusieurs syndicats (D1).')
  const vus = new Set<string>()
  for (const e of elements) {
    if (vus.has(e.id)) throw new Error(`Virement ${e.id} en double dans le lot.`)
    vus.add(e.id)
  }
}

/**
 * Crée d'un coup les virements d'un lot, sous un même traitement : rang = position dans la saisie (1 à n), taille du lot
 * = n ; chaque virement est contrôlé par creerVirementInterne. Refuse un lot vide, un traitement absent, un virement en
 * double et des virements de plusieurs syndicats (D1).
 */
export function creerLotVirementsInternes(
  saisies: SaisieVirementDuLot[],
  { traitementId, segmentSyndicat }: { traitementId: string; segmentSyndicat: string },
): VirementInterne[] {
  verifierCompositionDuLot(saisies, traitementId)
  return saisies.map((s, i) => creerVirementInterne({ ...s, traitementId, rang: i + 1, nombreOrdresDuLot: saisies.length }, { segmentSyndicat }))
}

/**
 * Recompose un lot avant son émission : rang = position dans la liste passée (1 à n), taille du lot = n, sous le
 * traitement donné ; le reste de chaque virement est inchangé. Retire un virement abandonné (ne pas le passer), refait
 * des rangs saisis deux fois ou change de traitement (identifiant déjà au journal ou réservé par un autre lot émis).
 * Refuse un lot vide, un traitement absent, un virement en double, des virements de plusieurs syndicats (D1) et un
 * virement déjà émis : un lot envoyé à la banque ne se recompose plus.
 */
export function recomposerLotVirementsInternes(virements: VirementInterne[], { traitementId }: { traitementId: string }): VirementInterne[] {
  verifierCompositionDuLot(virements, traitementId)
  const dejaEmis = virements.find((v) => v.statut === 'Émis')
  if (dejaEmis)
    throw new Error(
      `Virement ${dejaEmis.numero} déjà émis le ${dejaEmis.dateEmission} (traitement ${dejaEmis.traitementId}) : un lot envoyé à la banque ne se recompose plus.`,
    )
  return virements.map((v, i): VirementInterne => ({ ...v, traitementId, rang: i + 1, nombreOrdresDuLot: virements.length }))
}

// ─── Émission, écriture et imputation ───────────────────────────────────────────────────────

/** Traitements déjà passés au journal, quelle que soit leur famille. */
type Journal = readonly Pick<Traitement, 'id'>[]

/** Ce que l'émission lit des virements internes déjà enregistrés : un virement émis réserve son traitement. */
export type VirementConnu = Pick<VirementInterne, 'id' | 'numero' | 'traitementId' | 'statut'>

/** Écriture d'un virement : débit du 512 de destination, crédit du 512 de source, montant brut (aucune compensation). */
export function mouvementsVirementInterne(v: VirementInterne): LigneMouvement[] {
  return [
    { compte: v.destination.compte512, sens: 'debit', montantCentimes: v.montantCentimes },
    { compte: v.source.compte512, sens: 'credit', montantCentimes: v.montantCentimes },
  ]
}

function verifierAEcrire(v: VirementInterne, id: string): void {
  if (v.statut !== 'Émis') throw new Error(`Virement ${v.numero} pas émis : aucune écriture avant l'ordre donné à la banque.`)
  if (v.impute) throw new Error(`Virement ${v.numero} déjà imputé : son écriture est dans le traitement ${v.traitementId}.`)
  if (v.traitementId !== id) throw new Error(`Virement ${v.numero} : traitement ${v.traitementId}, pas ${id}.`)
}

/**
 * Lot complet : tous les virements déclarent la même taille de lot, en nombre égal aux virements passés, aux rangs 1 à
 * cette taille, chacun une fois (controlerRangsDuLot).
 */
function verifierLotComplet(virements: VirementInterne[], id: string): void {
  const tailles = new Set(virements.map((v) => v.nombreOrdresDuLot))
  if (tailles.size > 1)
    throw new Error(`Traitement ${id} refusé : virements qui déclarent des lots de tailles différentes (${[...tailles].join(', ')}) ; vérifier la saisie.`)
  const [taille] = tailles
  if (virements.length !== taille)
    throw new Error(
      `Traitement ${id} refusé : le lot compte ${taille} virement(s), ${virements.length} passé(s) ; passer tous les virements du lot, en une fois.`,
    )
  const anomalies = controlerRangsDuLot(ordresDuLotVirementsInternes(virements))
  if (anomalies.length > 0)
    throw new Error(`Traitement ${id} refusé : ${anomalies.map((a) => a.message).join(' ')} Passer tous les virements du lot.`)
}

/**
 * Contrôles communs à l'émission et à l'écriture d'un lot : composition (verifierCompositionDuLot), traitement absent du
 * journal, contrôle propre à chaque virement (verifierUn), lot complet (verifierLotComplet).
 */
function verifierLotEntier(virements: VirementInterne[], id: string, journal: Journal, verifierUn: (v: VirementInterne) => void): void {
  verifierCompositionDuLot(virements, id)
  if (journal.some((t) => t.id === id))
    throw new Error(`Traitement ${id} déjà passé au journal : un lot s'écrit une seule fois, sous un identifiant de traitement neuf.`)
  for (const v of virements) verifierUn(v)
  verifierLotComplet(virements, id)
}

/** Traitement libre : réservé par aucun virement émis d'un autre lot ; un virement du lot déjà émis ne l'est pas deux fois. */
function verifierTraitementLibre(virements: VirementInterne[], id: string, connus: readonly VirementConnu[]): void {
  const duLot = new Set(virements.map((v) => v.id))
  for (const c of connus.filter((connu) => connu.statut === 'Émis')) {
    if (duLot.has(c.id)) throw new Error(`Virement ${c.numero} déjà émis (traitement ${c.traitementId}) : un virement s'émet une seule fois.`)
    if (c.traitementId === id)
      throw new Error(
        `Traitement ${id} déjà réservé par le virement ${c.numero}, émis dans un autre lot : recomposer ce lot sous un traitement neuf (recomposerLotVirementsInternes).`,
      )
  }
}

/**
 * Émission d'un lot de virements internes (l'ordre donné à la banque : fichiers et ordres hors fichier) : le lot entier,
 * en une fois, à une date ISO ; renvoie les virements émis. Le lot est contrôlé AVANT l'envoi comme il le sera à
 * l'écriture (traitementVirementsInternes), et son traitement doit être libre : un lot émis s'écrit donc toujours.
 * journal : les traitements déjà passés ; virementsConnus : les virements internes déjà enregistrés (le lot lui-même
 * peut y figurer, non émis). Refuse un lot vide, un virement en double, déjà émis, d'un autre traitement ou d'un autre
 * syndicat (D1), une date non ISO, des tailles de lot différentes, un nombre de virements autre que la taille du lot, des
 * rangs qui ne sont pas exactement 1 à cette taille, un traitement déjà au journal ou réservé par un virement émis d'un
 * autre lot. Un lot refusé se corrige avant l'émission par recomposerLotVirementsInternes ; un virement seul est un lot
 * de un.
 */
export function emettreLotVirementsInternes(
  virements: VirementInterne[],
  { dateEmission, journal, virementsConnus }: { dateEmission: string; journal: Journal; virementsConnus: readonly VirementConnu[] },
): VirementInterne[] {
  const id = virements[0]?.traitementId ?? ''
  verifierLotEntier(virements, id, journal, (v) => {
    verifierEmission(v, dateEmission)
    if (v.traitementId !== id)
      throw new Error(`Lot refusé : virements de plusieurs traitements (${id}, ${v.traitementId}) ; un lot est un seul traitement.`)
  })
  verifierTraitementLibre(virements, id, virementsConnus)
  return virements.map((v): VirementInterne => ({ ...v, statut: 'Émis', dateEmission }))
}

/**
 * Écriture et imputation, en une fois, d'un lot de virements internes émis d'un même syndicat : un traitement
 * « Règlement de banque à banque » dont chaque virement porte sa propre paire débit / crédit, pour son montant brut ; les
 * virements sont rendus imputés. Refait les contrôles de l'émission sur les virements passés (relus, ils peuvent n'être
 * pas passés par emettreLotVirementsInternes) : refuse un lot vide, un identifiant de traitement déjà au journal, un
 * virement en double, non émis, déjà imputé, rattaché à un autre traitement, des virements de plusieurs syndicats (D1),
 * des tailles de lot différentes, un nombre de virements autre que la taille du lot, et des rangs qui ne sont pas
 * exactement 1 à cette taille (controlerRangsDuLot). Un lot ne s'écrit donc ni en partie ni en deux fois.
 */
export function traitementVirementsInternes(
  virements: VirementInterne[],
  { id, date, journal }: { id: string; date: string; journal: Journal },
): { traitement: Traitement; virements: VirementInterne[] } {
  verifierLotEntier(virements, id, journal, (v) => verifierAEcrire(v, id))
  const traitement = creerTraitement({ id, famille: FAMILLE_VIREMENT_INTERNE, date, mouvements: virements.flatMap(mouvementsVirementInterne) })
  return { traitement, virements: virements.map((v): VirementInterne => ({ ...v, impute: true })) }
}

// ─── Lot et fichier ─────────────────────────────────────────────────────────────────────────

/**
 * Ordres du lot (types-ordres-banque.ts) : rang = celui de chaque virement (jamais sa position dans la liste passée),
 * compte = la source, sans tiers, une pièce ; statut et état imputé sont ceux du virement.
 */
export function ordresDuLotVirementsInternes(virements: VirementInterne[]): OrdreDuLot[] {
  return virements.map((v) => ({
    id: v.id,
    sourceId: v.id,
    numero: v.numero,
    traitementId: v.traitementId,
    rang: v.rang,
    type: TYPE_VIREMENT_INTERNE,
    date: v.date,
    coproprieteId: v.coproprieteId,
    banqueId: v.source.banqueId,
    tiers: null,
    libelle: v.libelle,
    numeroPiece: v.numero,
    nombrePieces: 1,
    montantCentimes: v.montantCentimes,
    statut: v.statut,
    dateEmission: v.dateEmission,
    impute: v.impute,
  }))
}

/**
 * Fichier pain.001.001.03 d'un virement interne (genererPain001) : débiteur = le syndicat sur le compte source,
 * créancier = le syndicat sur le compte de destination, identifiant de bout en bout = n° du virement. Refuse un compte
 * source sans IBAN ou sans BIC, une destination sans IBAN (Caisse des dépôts, sous-compte centralisateur : virement à
 * ordonner hors fichier).
 */
export function fichierVirementInterne(
  v: VirementInterne,
  { nomSyndicat, messageId, dateCreation, dateExecution }: { nomSyndicat: string; messageId: string; dateCreation: string; dateExecution: string },
): string {
  texteRequis(nomSyndicat, 'Nom du syndicat attendu (débiteur et créancier du virement).')
  const { source, destination } = v
  if (source.iban === null || source.bic === null)
    throw new Error(`Compte source ${source.banqueId} sans IBAN ou BIC : virement à ordonner hors fichier.`)
  if (destination.iban === null) throw new Error(`Compte destination ${destination.banqueId} sans IBAN : virement à ordonner hors fichier.`)
  const ordre = creerOrdreVirement({
    id: v.id,
    numero: v.numero,
    date: v.date,
    coproprieteId: v.coproprieteId,
    banqueId: source.banqueId,
    traitementId: v.traitementId,
    lignes: [
      { reglementId: v.numero, beneficiaire: nomSyndicat, iban: destination.iban, bic: destination.bic, montantCentimes: v.montantCentimes, libelle: v.libelle },
    ],
  })
  return genererPain001(ordre, { nom: nomSyndicat, iban: source.iban, bic: source.bic }, { messageId, dateCreation, dateExecution })
}
