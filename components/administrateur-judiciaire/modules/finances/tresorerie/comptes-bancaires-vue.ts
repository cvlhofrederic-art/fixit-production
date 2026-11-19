import type { Banque } from '@/lib/administrateur-judiciaire/db/schema'
import {
  MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE,
  NATURES_COMPTE_BANCAIRE,
  controlerComptesMandat,
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
 * - solde de chaque compte : les écritures 512 ne sont rattachées à aucun compte. La vue passe un solde neutre de 0 (lu
 *   comme « soldé ») : le contrôle « compte repris à solder » est donc neutralisé, et un seul bandeau le signale dès
 *   qu'un compte repris est actif.
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
  /** Comptes repris actifs : leur solde n'est pas connu ici. */
  reprisActifs: number
  /** Pratique du cabinet pour un administrateur provisoire (J37), proposée, jamais imposée ; null sinon. */
  pratiqueAdministrateurProvisoire: ModeTenueComptes | null
}

export interface EntreeVueComptes {
  comptes: readonly Banque[]
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

/** Solde neutre passé au contrôle (lu comme « soldé ») : aucun solde par compte n'est connu (voir l'en-tête). */
const SOLDE_NON_RATTACHE = 0

const estNatureConnue = (nature: unknown): nature is NatureCompteBancaire =>
  typeof nature === 'string' && Object.hasOwn(NATURES_COMPTE_BANCAIRE, nature)

function compteAffiche(ligne: Banque & { nature: NatureCompteBancaire }): CompteAffiche {
  const tenaitFondsTravaux = ligne.tenaitFondsTravaux === true
  const reserveAuFondsTravaux = ligne.reserveAuFondsTravaux === true
  const actif = ligne.actif !== false
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
  }
}

const estAdministrateurProvisoire = (fondement: string): boolean => {
  const regime = regimeDepuisFondement(fondement)
  return regime === 'ap47' || regime === 'ap291'
}

/** Mode résolu par le domaine, ou son refus (choix du mandat enregistré inconnu) ; rien tant que le réglage n'est pas lu. */
function resoudreMode(
  reglages: ReglagesComptesCabinet | null,
  choixMandat: ModeTenueComptes | null | undefined,
): { resolu: ModeResolu | null; erreurMode: string | null } {
  if (reglages === null) return { resolu: null, erreurMode: null }
  try {
    return { resolu: resoudreModeComptes(reglages, choixMandat ?? null), erreurMode: null }
  } catch (erreur) {
    return { resolu: null, erreurMode: erreur instanceof Error ? erreur.message : String(erreur) }
  }
}

/**
 * Vue du panneau. Les comptes sont toujours rendus ; le mode appliqué et les contrôles, seulement quand le mode se
 * résout (sinon controle est null, et erreurMode porte le refus du domaine s'il y en a un).
 */
export function vueComptesBancaires(entree: EntreeVueComptes): VueComptesBancaires {
  const lisibles = entree.comptes.filter((ligne): ligne is Banque & { nature: NatureCompteBancaire } => estNatureConnue(ligne.nature))
  const comptes = lisibles.map(compteAffiche)
  const { resolu, erreurMode } = resoudreMode(entree.reglagesCabinet, entree.choixMandat)
  const obligationFonds = obligationFondsTravaux(IMMEUBLE_NON_RENSEIGNE, entree.aujourdhui)
  const controles: CompteBancaireMandat[] = comptes.map((compte) => ({
    nature: compte.nature,
    iban: compte.iban,
    actif: compte.actif,
    soldeCentimes: SOLDE_NON_RATTACHE,
  }))
  return {
    comptes,
    illisibles: entree.comptes.length - lisibles.length,
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
    reprisActifs: comptes.filter((compte) => compte.actif && compte.nature === 'repris_ancien_gestionnaire').length,
    pratiqueAdministrateurProvisoire: estAdministrateurProvisoire(entree.fondement) ? MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE : null,
  }
}

/** IBAN lu par groupes de quatre caractères. */
export const ibanGroupe = (iban: string): string => iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
