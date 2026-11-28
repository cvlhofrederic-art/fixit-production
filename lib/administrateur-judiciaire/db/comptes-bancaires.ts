'use client'

import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { arretesSurs } from '@/lib/administrateur-judiciaire/db/rapprochements'
import { repoBanques, repoCabinets, repoCoproprietes, repoMandats } from '@/lib/administrateur-judiciaire/db/repositories'
import type { OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import { ajDb, type Banque, type Cabinet, type Mandat } from '@/lib/administrateur-judiciaire/db/schema'
import {
  NATURES_COMPTE_BANCAIRE,
  creerReglagesComptesCabinet,
  enMilieuDePhrase,
  lireModeComptes,
  resoudreModeComptes,
  validerIban,
  verifierMarquesFondsTravaux,
  type ModeComptesLu,
  type ModeTenueComptes,
  type NatureCompteBancaire,
  type ReglagesComptesCabinet,
} from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
import {
  lireSaisieSoldeOuverture,
  memeSoldeOuverture,
  soldeOuvertureEnregistre,
  verifierChangementSoldeOuverture,
  type SaisieSoldeOuverture,
} from '@/lib/administrateur-judiciaire/domain/solde-ouverture-compte'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Comptes bancaires d'une copropriété et modes de tenue (D-BANQUE), écrits par l'écran « Banque et recouvrement » :
 * - comptes : table locale existante « banques » (création, modification, clôture = actif à false) ;
 * - réglage du cabinet : table « cabinets », une seule ligne (la base locale est celle d'un cabinet) ;
 * - choix du mandat : Mandat.modeComptesBancaires (null = comme le cabinet), puis l'état chargé du store est mis à jour.
 * Aucun changement de schéma ni de version : les marques du fonds de travaux (J71) sont des champs non indexés.
 * Solde d'ouverture d'un compte (décision du 26/11/2026, PR 799, point 2, choix A) : deux champs non indexés de plus
 * (soldeOuvertureCentimes, soldeOuvertureAu), sans version nouvelle non plus, et sans écriture au journal de banque
 * (domain/solde-ouverture-compte.ts, qui dit pourquoi). Son changement est contrôlé dans la transaction de l'écriture,
 * contre les arrêtés du compte relus dans cette transaction.
 * Volontairement hors du store (aucune action ajoutée à EtatDonneesStore : sa forme est figée par l'oracle de la base
 * locale), comme db/sinistres.ts. Les règles (natures, IBAN, marques, modes) sont celles du domaine
 * (domain/comptes-bancaires.ts), qui lève l'erreur affichée : rien n'est écrit quand il refuse.
 */

/** Saisie d'un compte bancaire. Les textes vides (ou faits d'espaces) sont enregistrés à null. */
export interface SaisieCompteBancaire {
  nature: NatureCompteBancaire
  libelle: string
  /** Vide : compte sans IBAN propre (Caisse des dépôts non renseignée, sous-compte du centralisateur). */
  iban: string | null
  bic: string | null
  etablissement: string | null
  /** Compte repris qui tenait le fonds de travaux (réservé à cette nature). */
  tenaitFondsTravaux?: boolean
  /** Placement réservé au fonds de travaux (J71, réservé à la nature « placement »). */
  reserveAuFondsTravaux?: boolean
  /**
   * Solde d'ouverture saisi (montant en euros et date). Montant et date vides, ou null : aucun (retiré d'un compte qui
   * en avait un). Champ absent : le solde d'ouverture du compte n'est pas touché.
   */
  soldeOuverture?: SaisieSoldeOuverture | null
}

export interface OptionsEnregistrementCompte extends OptionsEcriture {
  /** Compte existant à modifier ; absent ou null : création. */
  id?: string | null
  /** Jour courant (AAAA-MM-JJ), au-delà duquel un solde d'ouverture est refusé ; par défaut celui de l'application. */
  aujourdhui?: string
}

const texteOuNull = (texte: string | null | undefined): string | null => {
  const propre = (texte ?? '').trim()
  return propre === '' ? null : propre
}

/** IBAN enregistré sans espace, en majuscules (forme lue par le contrôle du domaine). */
const ibanCompact = (iban: string): string => iban.replace(/\s+/g, '').toUpperCase()

/** Comptes d'une copropriété, actifs et clôturés, dans l'ordre de création. */
export async function listerComptesBancaires(coproprieteId: string): Promise<Banque[]> {
  const comptes = await repoBanques.list({ coproprieteId })
  return comptes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

type ChampsCompte = Pick<Banque, 'nature' | 'libelle' | 'iban' | 'bic' | 'etablissement' | 'tenaitFondsTravaux' | 'reserveAuFondsTravaux'>

/** Champs écrits pour une saisie, contrôlée par le domaine (nature connue, IBAN valide, marques à leur nature). */
function champsCompte(saisie: SaisieCompteBancaire): ChampsCompte {
  if (!Object.hasOwn(NATURES_COMPTE_BANCAIRE, saisie.nature))
    throw new Error(`Nature de compte inconnue : « ${String(saisie.nature)} ».`)
  const brut = texteOuNull(saisie.iban)
  if (brut !== null && !validerIban(brut)) throw new Error(`IBAN invalide (format ou clé) : « ${brut} ».`)
  const marques = {
    nature: saisie.nature,
    tenaitFondsTravaux: saisie.tenaitFondsTravaux === true,
    reserveAuFondsTravaux: saisie.reserveAuFondsTravaux === true,
  }
  verifierMarquesFondsTravaux(marques, NATURES_COMPTE_BANCAIRE[saisie.nature].libelle)
  return {
    ...marques,
    libelle: (saisie.libelle ?? '').trim(),
    iban: brut === null ? null : ibanCompact(brut),
    bic: texteOuNull(saisie.bic),
    etablissement: texteOuNull(saisie.etablissement),
  }
}

/**
 * Crée ou modifie un compte de la copropriété. Une modification garde l'état du compte (actif ou clôturé) ; une marque
 * devenue sans objet (changement de nature) est remise à false. Refusé, sans écriture, pour une copropriété
 * introuvable, une nature inconnue, un IBAN invalide ou une marque du fonds portée par une autre nature.
 * Solde d'ouverture (saisie.soldeOuverture, s'il est fourni) : contrôlé par le domaine (montant et date ensemble, date
 * ni invalide ni après aujourd'hui). À la création, il n'est écrit que s'il est saisi. À la modification, son changement
 * est refusé, sans aucune écriture du compte, sur un compte clôturé, daté après un arrêté du compte (réponse du référent
 * métier du 28/11/2026, PR 848, point 4), sous un arrêté clôturé qui couvre sa date (déclôturer d'abord) ou tant qu'un
 * arrêté illisible pourrait en cacher un ; inchangé, il n'est pas réécrit.
 */
export async function enregistrerCompteBancaire(
  coproprieteId: string,
  saisie: SaisieCompteBancaire,
  options: OptionsEnregistrementCompte = {},
): Promise<Banque> {
  if (!(await repoCoproprietes.get(coproprieteId))) throw new Error(`Copropriété introuvable (id=${coproprieteId}).`)
  const champs = champsCompte(saisie)
  const ecriture = { actor: options.actor ?? null }
  const id = options.id
  if (saisie.soldeOuverture === undefined)
    return id ? repoBanques.update(id, champs, ecriture) : repoBanques.create({ ...champs, coproprieteId, actif: true }, ecriture)
  const ouverture = lireSaisieSoldeOuverture(saisie.soldeOuverture, options.aujourdhui ?? AUJOURDHUI_ISO)
  const champsOuverture = { soldeOuvertureCentimes: ouverture?.centimes ?? null, soldeOuvertureAu: ouverture?.au ?? null }
  if (!id) return repoBanques.create({ ...champs, ...(ouverture ? champsOuverture : {}), coproprieteId, actif: true }, ecriture)
  return ajDb.transaction('rw', [ajDb.banques, ajDb.rapprochements, ajDb.activityLog], async () => {
    // Compte disparu : l'erreur « introuvable » est celle du repository, à l'écriture.
    const existant = await repoBanques.get(id)
    const avant = existant ? soldeOuvertureEnregistre(existant) : null
    if (!existant || memeSoldeOuverture(avant, ouverture)) return repoBanques.update(id, champs, ecriture)
    const compteActif = existant.actif !== false
    // Compte clôturé : refusé par le domaine avant toute lecture des arrêtés.
    verifierChangementSoldeOuverture({ avant, apres: ouverture, compteActif, arretes: compteActif ? await arretesSurs(id) : [] })
    return repoBanques.update(id, { ...champs, ...champsOuverture }, ecriture)
  })
}

/** Clôture un compte : il reste en base, inactif, et ne compte plus dans les contrôles du mandat. */
export async function cloturerCompteBancaire(id: string, options: OptionsEcriture = {}): Promise<Banque> {
  return repoBanques.update(id, { actif: false }, { actor: options.actor ?? null })
}

/** Ligne du cabinet : la plus ancienne de la table (une seule est écrite par cet écran) ; null si la table est vide. */
async function ligneCabinet(): Promise<Cabinet | null> {
  const cabinets = await repoCabinets.list()
  cabinets.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return cabinets[0] ?? null
}

/** Réglage du cabinet : son mode enregistré, sinon le défaut du domaine (compte séparé au nom du syndicat). */
export async function lireReglagesComptesCabinet(): Promise<ReglagesComptesCabinet> {
  return creerReglagesComptesCabinet({ modeParDefaut: (await ligneCabinet())?.modeComptesBancaires })
}

/**
 * Mode de tenue appliqué à un mandat du syndicat (décision du 22/11/2026, ap-03) : choix du mandat, à défaut réglage du
 * cabinet ; sans mandat (identifiant vide ou null), le réglage du cabinet, comme l'écran des comptes bancaires. Lu sans
 * exception : réglage du cabinet illisible, mandat introuvable ou d'un autre syndicat, mode inconnu donnent l'erreur,
 * que l'avis porte (diffusion bloquée) ; jamais un mode par défaut à la place d'un réglage illisible.
 */
export async function lireModeComptesDuMandat(coproprieteId: string, mandatId: string | null): Promise<ModeComptesLu> {
  let reglages: ReglagesComptesCabinet
  try {
    reglages = await lireReglagesComptesCabinet()
  } catch (erreur) {
    return { resolu: null, erreur: `réglage du cabinet illisible (${enMilieuDePhrase(erreur instanceof Error ? erreur.message : String(erreur))})` }
  }
  if (!mandatId) return lireModeComptes(reglages, null)
  const mandat = await ajDb.mandats.get(mandatId)
  if (!mandat) return { resolu: null, erreur: `mandat « ${mandatId} » introuvable` }
  if (mandat.coproprieteId !== coproprieteId) return { resolu: null, erreur: `mandat « ${mandatId} » d'un autre syndicat` }
  return lireModeComptes(reglages, mandat.modeComptesBancaires)
}

/**
 * Enregistre le mode par défaut du cabinet (créé à la première écriture). Mode inconnu : refusé par le domaine. Lecture
 * et écriture dans une seule transaction : deux appels qui se chevauchent (deux changements rapides de la liste) passent
 * l'un après l'autre, sans créer une seconde ligne ; le dernier choix est gardé.
 */
export async function enregistrerModeComptesCabinet(mode: ModeTenueComptes, options: OptionsEcriture = {}): Promise<Cabinet> {
  // Mode refusé par le domaine : promesse rejetée (fonction asynchrone), jamais une erreur levée à l'appel.
  const { modeParDefaut } = creerReglagesComptesCabinet({ modeParDefaut: mode })
  const ecriture = { actor: options.actor ?? null }
  const enregistre = await ajDb.transaction('rw', ajDb.cabinets, ajDb.activityLog, async () => {
    const existant = await ligneCabinet()
    return existant
      ? repoCabinets.update(existant.id, { modeComptesBancaires: modeParDefaut }, ecriture)
      : repoCabinets.create({ modeComptesBancaires: modeParDefaut }, ecriture)
  })
  return enregistre
}

/**
 * Enregistre le choix du mandat (null : « Comme le cabinet »), puis met à jour le mandat chargé dans le store. Mode
 * inconnu : refusé par le domaine ; mandat disparu : erreur du repository.
 */
export async function enregistrerModeComptesMandat(
  mandatId: string,
  mode: ModeTenueComptes | null,
  options: OptionsEcriture = {},
): Promise<Mandat> {
  // Contrôle du mode par le domaine (le réglage du cabinet n'entre pas en jeu ici).
  if (mode !== null) resoudreModeComptes(creerReglagesComptesCabinet({}), mode)
  const enregistre = await repoMandats.update(mandatId, { modeComptesBancaires: mode }, { actor: options.actor ?? null })
  useDonneesStore.setState((etat) => ({
    mandats: etat.mandats.map((mandat) => (mandat.id === enregistre.id ? enregistre : mandat)),
  }))
  return enregistre
}
