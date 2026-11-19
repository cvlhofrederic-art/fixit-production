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
 * Entrées du domaine que la base ne stocke pas :
 * - données de l'immeuble (destination, réception des travaux, lots principaux) : passées comme non renseignées (null) ;
 *   obligationFondsTravaux répond alors « à établir » (obligatoire : null), avec son motif ;
 * - « la copropriété est dotée d'un fonds de travaux » (controlerComptesMandat) : le domaine n'a pas de valeur inconnue ;
 *   seule une obligation établie (obligatoire : true) lance le contrôle « fonds de travaux manquant » ;
 * - solde de chaque compte : les écritures 512 ne sont rattachées à aucun compte. Le contrôle « compte repris à solder »
 *   ne peut donc pas être lancé ; le panneau le dit pour chaque compte repris actif.
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
  /** Compte qui tient le fonds de travaux (estCompteDuFondsTravaux, J71). */
  tientLeFonds: boolean
}

export interface VueComptesBancaires {
  comptes: CompteAffiche[]
  /** Lignes de la base sans nature connue : non affichées, hors des contrôles, comptées. */
  illisibles: number
  resolu: ModeResolu
  anomalies: AnomalieComptes[]
  informations: InformationComptes[]
  obligationFonds: ObligationFondsTravaux
  /** Comptes repris actifs : leur solde n'est pas connu ici. */
  reprisActifs: number
  /** Pratique du cabinet pour un administrateur provisoire (J37), proposée, jamais imposée ; null sinon. */
  pratiqueAdministrateurProvisoire: ModeTenueComptes | null
}

export interface EntreeVueComptes {
  comptes: readonly Banque[]
  reglagesCabinet: ReglagesComptesCabinet
  /** Choix du mandat (Mandat.modeComptesBancaires) ; null ou absent : comme le cabinet. */
  choixMandat: ModeTenueComptes | null | undefined
  /** Fondement du mandat (régime : administrateur provisoire ou non). */
  fondement: string
  /** Jour courant (AAAA-MM-JJ). */
  aujourdhui: string
}

/** Données de l'immeuble lues par obligationFondsTravaux : aucune n'est stockée dans la base locale. */
const IMMEUBLE_NON_RENSEIGNE: SaisieObligationFondsTravaux = {
  destinationHabitation: null,
  dateReception: null,
  nbLotsPrincipaux: null,
}

/** Solde passé au contrôle : aucun solde par compte n'est connu (voir l'en-tête). */
const SOLDE_NON_RATTACHE = 0

const estNatureConnue = (nature: unknown): nature is NatureCompteBancaire =>
  typeof nature === 'string' && Object.hasOwn(NATURES_COMPTE_BANCAIRE, nature)

function compteAffiche(ligne: Banque & { nature: NatureCompteBancaire }): CompteAffiche {
  const tenaitFondsTravaux = ligne.tenaitFondsTravaux === true
  const reserveAuFondsTravaux = ligne.reserveAuFondsTravaux === true
  return {
    id: ligne.id,
    nature: ligne.nature,
    libelle: ligne.libelle ?? '',
    iban: ligne.iban ?? null,
    bic: ligne.bic ?? null,
    etablissement: ligne.etablissement ?? null,
    actif: ligne.actif !== false,
    tenaitFondsTravaux,
    reserveAuFondsTravaux,
    tientLeFonds: estCompteDuFondsTravaux({ nature: ligne.nature, tenaitFondsTravaux, reserveAuFondsTravaux }),
  }
}

const estAdministrateurProvisoire = (fondement: string): boolean => {
  const regime = regimeDepuisFondement(fondement)
  return regime === 'ap47' || regime === 'ap291'
}

/** Vue du panneau. Lève l'erreur du domaine si le choix du mandat enregistré est un mode inconnu. */
export function vueComptesBancaires(entree: EntreeVueComptes): VueComptesBancaires {
  const lisibles = entree.comptes.filter((ligne): ligne is Banque & { nature: NatureCompteBancaire } => estNatureConnue(ligne.nature))
  const comptes = lisibles.map(compteAffiche)
  const resolu = resoudreModeComptes(entree.reglagesCabinet, entree.choixMandat ?? null)
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
    resolu,
    anomalies: controlerComptesMandat({ mode: resolu.mode, fondsTravaux: obligationFonds.obligatoire === true, comptes: controles }),
    informations: informationsComptesMandat(controles),
    obligationFonds,
    reprisActifs: comptes.filter((compte) => compte.actif && compte.nature === 'repris_ancien_gestionnaire').length,
    pratiqueAdministrateurProvisoire: estAdministrateurProvisoire(entree.fondement) ? MODE_COMPTES_ADMINISTRATEUR_PROVISOIRE : null,
  }
}

/** IBAN lu par groupes de quatre caractères. */
export const ibanGroupe = (iban: string): string => iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
