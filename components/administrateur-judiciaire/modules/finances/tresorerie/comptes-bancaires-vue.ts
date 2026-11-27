import type { Banque, Ecriture } from '@/lib/administrateur-judiciaire/db/schema'
import { lignesAvantOuverture, soldeCompteBancaireCentimes } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import {
  MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE,
  NATURES_COMPTE_BANCAIRE,
  controlerComptesMandat,
  creerReglagesComptesCabinet,
  estCompteDuFondsTravaux,
  informationsComptesMandat,
  resoudreModeComptes,
  type AnomalieComptes,
  type CompteBancaireMandat,
  type InformationComptes,
  type ModeResolu,
  type ModeTenueComptes,
  type NatureCompteBancaire,
  type ReglagesComptesCabinet,
} from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import { regimeDepuisFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import {
  obligationFondsTravaux,
  type ObligationFondsTravaux,
  type SaisieObligationFondsTravaux,
} from '@/lib/administrateur-judiciaire/domain/fonds-travaux'
import { soldeOuvertureEnregistre, type SoldeOuverture } from '@/lib/administrateur-judiciaire/domain/solde-ouverture-compte'

/**
 * Vue du panneau « Comptes bancaires du mandat » : ce que rend le domaine (domain/comptes-bancaires.ts,
 * domain/fonds-travaux.ts) sur les comptes lus dans la base locale. Aucune règle propre à l'écran.
 * Entrées du domaine que la base ne stocke pas (point ouvert, soumis à Frédéric) :
 * - données de l'immeuble lues par obligationFondsTravaux : passées comme non renseignées (null), car la date de
 *   réception des travaux (ou l'année de construction) n'est stockée nulle part, et la fiche de copropriété (lots
 *   d'habitation et de commerce, 0 par défaut) n'est pas lue en attendant sa réponse. Le domaine répond alors
 *   « à établir » (obligatoire : null), avec son motif ;
 * - « la copropriété est dotée d'un fonds de travaux » (controlerComptesMandat) : le domaine n'a pas de valeur inconnue.
 *   La vue lui passe une valeur neutre, « non dotée » tant que l'obligation n'est pas établie : le contrôle « fonds de
 *   travaux manquant » est donc neutralisé ;
 * - solde de chaque compte : le solde affiché est celui de son sous-compte 512 (db/sous-comptes-banque.ts,
 *   soldeCompteBancaireCentimes). Décision du 26/11/2026 (PR 799, point 2, choix A) : avec le solde d'ouverture saisi
 *   sur le compte, c'est ce solde plus les lignes de relevé importées à partir de sa date (les lignes datées avant,
 *   tenues pour déjà comprises, sont comptées à part et signalées) ; sans lui, la somme des lignes importées, qui n'est
 *   pas le solde réel d'un compte ouvert avant le premier relevé importé ; null sans solde d'ouverture ni ligne ;
 * - contrôle « compte repris à solder » : toujours neutralisé (la vue passe au contrôle un solde neutre de 0, lu comme
 *   « soldé »). Il pourrait désormais être lancé pour un compte repris dont le solde d'ouverture est saisi ; ce n'est pas
 *   fait ici, la décision ne le prévoit pas (point à soumettre). Tant qu'il ne tourne pas, tout compte repris actif est
 *   signalé, pour que « Comptes conformes au mode appliqué » ne couvre jamais un compte repris non soldé sans le dire
 *   (relecture du 27/11/2026) : un bandeau pour ceux dont le solde reste inconnu (sans solde d'ouverture), un autre pour
 *   ceux dont le solde d'ouverture est saisi, que le rappel ne lit pas encore.
 */

/** Compte lisible (nature connue), prêt à afficher. */
export interface CompteAffiche {
  id: string
  nature: NatureCompteBancaire
  libelle: string
  iban: string | null
  bic: string | null
  etablissement: string | null
  actif: boolean
  tenaitFondsTravaux: boolean
  reserveAuFondsTravaux: boolean
  /** Compte actif qui tient le fonds de travaux (estCompteDuFondsTravaux, J71) ; un compte clôturé ne le tient plus. */
  tientLeFonds: boolean
  /** Solde du compte, en centimes (voir l'en-tête) ; null : ni solde d'ouverture ni ligne de relevé importée. */
  soldeCentimes: number | null
  /** Solde d'ouverture saisi sur le compte (solde au début de son jour) ; null : aucun. */
  soldeOuverture: SoldeOuverture | null
  /** Lignes de relevé du compte datées avant son solde d'ouverture : hors de son solde, à signaler. */
  lignesAvantOuverture: number
}

/** Mode appliqué au mandat et contrôles qui en dépendent (controlerComptesMandat). */
export interface ControleComptes {
  resolu: ModeResolu
  anomalies: AnomalieComptes[]
}

export interface VueComptesBancaires {
  comptes: CompteAffiche[]
  /** Lignes de la base sans nature connue : non affichées, hors des contrôles, comptées. */
  illisibles: number
  /**
   * Mode appliqué et contrôles ; null quand le mode ne se résout pas : réglage du cabinet non lu, ou choix du mandat
   * illisible (erreurMode). Les comptes et les informations qui ne dépendent pas du mode restent calculés.
   */
  controle: ControleComptes | null
  /** Erreur du domaine quand le choix du mandat enregistré est un mode inconnu ; null sinon. */
  erreurMode: string | null
  informations: InformationComptes[]
  obligationFonds: ObligationFondsTravaux
  /** Comptes repris actifs sans solde d'ouverture : leur solde n'est pas connu ici. */
  reprisSansSoldeConnu: number
  /** Comptes repris actifs au solde d'ouverture saisi : solde connu, mais le contrôle « à solder » ne le lit pas encore. */
  reprisAvecSoldeOuverture: number
  /** Pratique du cabinet pour un administrateur provisoire (J37), proposée, jamais imposée ; null sinon. */
  pratiqueAdministrateurProvisoire: ModeTenueComptes | null
}

/** Écriture lue pour le solde d'un compte (celles du journal de banque de la copropriété suffisent). */
export type EcritureSolde = Pick<Ecriture, 'compte' | 'montant' | 'sens' | 'date'>

export interface EntreeVueComptes {
  comptes: readonly Banque[]
  /** Écritures du journal de banque de la copropriété : soldes des sous-comptes 512. */
  ecritures: readonly EcritureSolde[]
  /** Réglage du cabinet lu dans la base ; null tant qu'il n'est pas lu (lecture en cours ou impossible). */
  reglagesCabinet: ReglagesComptesCabinet | null
  /** Choix du mandat (Mandat.modeComptesBancaires) ; null ou absent : comme le cabinet. */
  choixMandat: ModeTenueComptes | null | undefined
  /** Fondement du mandat (régime : administrateur provisoire ou non). */
  fondement: string
  /** Jour courant (AAAA-MM-JJ). */
  aujourdhui: string
}

/** Données de l'immeuble lues par obligationFondsTravaux : non renseignées (voir l'en-tête). */
const IMMEUBLE_NON_RENSEIGNE: SaisieObligationFondsTravaux = {
  destinationHabitation: null,
  dateReception: null,
  nbLotsPrincipaux: null,
}

/** Solde neutre passé au contrôle (lu comme « soldé ») : le contrôle « compte repris à solder » reste neutralisé (voir l'en-tête). */
const SOLDE_NEUTRE_CONTROLE = 0

const estNatureConnue = (nature: unknown): nature is NatureCompteBancaire =>
  typeof nature === 'string' && Object.hasOwn(NATURES_COMPTE_BANCAIRE, nature)

function compteAffiche(ligne: Banque & { nature: NatureCompteBancaire }, ecritures: readonly EcritureSolde[]): CompteAffiche {
  const tenaitFondsTravaux = ligne.tenaitFondsTravaux === true
  const reserveAuFondsTravaux = ligne.reserveAuFondsTravaux === true
  const actif = ligne.actif !== false
  const soldeOuverture = soldeOuvertureEnregistre(ligne)
  return {
    id: ligne.id,
    nature: ligne.nature,
    libelle: ligne.libelle ?? '',
    iban: ligne.iban ?? null,
    bic: ligne.bic ?? null,
    etablissement: ligne.etablissement ?? null,
    actif,
    tenaitFondsTravaux,
    reserveAuFondsTravaux,
    // Comme le domaine (controlerComptesMandat ne lit que les comptes actifs).
    tientLeFonds: actif && estCompteDuFondsTravaux({ nature: ligne.nature, tenaitFondsTravaux, reserveAuFondsTravaux }),
    soldeCentimes: soldeCompteBancaireCentimes(ecritures, ligne.id, soldeOuverture),
    soldeOuverture,
    lignesAvantOuverture: lignesAvantOuverture(ecritures, ligne.id, soldeOuverture),
  }
}

/** Comptes lisibles (nature connue), actifs et clôturés, dans l'ordre reçu, avec le solde de leur sous-compte 512. */
export const comptesLisibles = (comptes: readonly Banque[], ecritures: readonly EcritureSolde[]): CompteAffiche[] =>
  comptes
    .filter((ligne): ligne is Banque & { nature: NatureCompteBancaire } => estNatureConnue(ligne.nature))
    .map((ligne) => compteAffiche(ligne, ecritures))

const estAdministrateurProvisoire = (fondement: string): boolean => {
  const regime = regimeDepuisFondement(fondement)
  return regime === 'ap47' || regime === 'ap291'
}

/**
 * Mode résolu par le domaine, ou son refus (choix du mandat enregistré inconnu). Réglage du cabinet non lu : aucun mode
 * résolu, mais le choix du mandat est quand même contrôlé par le domaine, dont le refus ne dépend pas du cabinet (comme
 * db/comptes-bancaires.ts, avec le réglage par défaut du domaine ; seule l'erreur est gardée).
 */
function resoudreMode(
  reglages: ReglagesComptesCabinet | null,
  choixMandat: ModeTenueComptes | null | undefined,
): { resolu: ModeResolu | null; erreurMode: string | null } {
  try {
    if (reglages !== null) return { resolu: resoudreModeComptes(reglages, choixMandat ?? null), erreurMode: null }
    if (choixMandat != null) resoudreModeComptes(creerReglagesComptesCabinet({}), choixMandat)
    return { resolu: null, erreurMode: null }
  } catch (erreur) {
    return { resolu: null, erreurMode: erreur instanceof Error ? erreur.message : String(erreur) }
  }
}

/**
 * Vue du panneau. Les comptes sont toujours rendus ; le mode appliqué et les contrôles, seulement quand le mode se
 * résout (sinon controle est null, et erreurMode porte le refus du domaine s'il y en a un).
 */
export function vueComptesBancaires(entree: EntreeVueComptes): VueComptesBancaires {
  const comptes = comptesLisibles(entree.comptes, entree.ecritures)
  const { resolu, erreurMode } = resoudreMode(entree.reglagesCabinet, entree.choixMandat)
  const obligationFonds = obligationFondsTravaux(IMMEUBLE_NON_RENSEIGNE, entree.aujourdhui)
  const reprisActifs = comptes.filter((compte) => compte.actif && compte.nature === 'repris_ancien_gestionnaire')
  const reprisSansSoldeConnu = reprisActifs.filter((compte) => compte.soldeOuverture === null).length
  const controles: CompteBancaireMandat[] = comptes.map((compte) => ({
    nature: compte.nature,
    iban: compte.iban,
    actif: compte.actif,
    soldeCentimes: SOLDE_NEUTRE_CONTROLE,
  }))
  return {
    comptes,
    illisibles: entree.comptes.length - comptes.length,
    controle: resolu
      ? {
          resolu,
          // « Dotée d'un fonds » : valeur neutre (non dotée) tant que l'obligation n'est pas établie (voir l'en-tête).
          anomalies: controlerComptesMandat({ mode: resolu.mode, fondsTravaux: obligationFonds.obligatoire === true, comptes: controles }),
        }
      : null,
    erreurMode,
    informations: informationsComptesMandat(controles),
    obligationFonds,
    reprisSansSoldeConnu,
    reprisAvecSoldeOuverture: reprisActifs.length - reprisSansSoldeConnu,
    pratiqueAdministrateurProvisoire: estAdministrateurProvisoire(entree.fondement) ? MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE : null,
  }
}

/** IBAN lu par groupes de quatre caractères. */
export const ibanGroupe = (iban: string): string => iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
