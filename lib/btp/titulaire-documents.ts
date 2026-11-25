// ═══════════════════════════════════════════════════════════════════════════════
// TITULAIRE DES DOCUMENTS D'UNE SOCIÉTÉ BTP (25/11/2026)
//
// Les devis et les factures sont rangés sous le compte qui les a créés : `devis.artisan_user_id` en base, la clé
// `fixit_documents_<fiche>` dans le navigateur, le compteur de `doc_sequences`. Un salarié invité porte son propre
// identifiant, qui n'est celui d'aucun document de la société : il ouvrait une liste vide, sans message, et aurait
// ouvert sa propre série de numéros à côté de celle du gérant.
//
// Ce module répond à une seule question : pour ce compte, QUI détient les documents qu'il a le droit de voir ?
//   - `societeId` : le compte sous lequel les documents de la société sont rangés (celui du gérant) ;
//   - `ficheId` et `fiche` : la ligne `profiles_artisan` de la société, qui porte l'en-tête légal du document, le
//     gabarit du PDF et le nom affiché dans l'application.
//
// Il ne décide rien des droits par lui-même : tout vient de `lirePerimetreBtp` (lib/btp/perimetre-compte.ts), où un
// titulaire — gérant, artisan, super_admin, conciergerie, gestionnaire — ressort inchangé avec sa propre société.
// Le côté artisan est donc intact par construction (règle #1) : pour lui, `societeId` vaut son propre identifiant,
// exactement ce que le code faisait avant ce lot.
//
// L'IDENTITÉ N'EST PAS UN DROIT SUR LES DOCUMENTS
// Un ouvrier ou un chef de chantier n'a aucun droit sur les devis et les factures, mais il a besoin du nom et du
// logo de son entreprise pour son tableau de bord — il y pointe ses heures tous les jours. Lui refuser l'identité
// lui fermerait toute l'application. Sa fiche est donc réduite à l'en-tête d'écran (`ficheEnTeteSeulement`) : ni
// SIRET ou NIPC, ni adresse, ni assurance, ni médiateur, ni RCS. L'identité légale complète ne part qu'aux rôles
// qui voient les documents, parce qu'eux seuls en impriment un.
//
// DEUX REFUS, et pourquoi ils valent mieux qu'un repli
//   - `societe_non_resolue` : le compte porte un rattachement (`app_metadata.company_id`, posé par le serveur à
//     l'acceptation de l'invitation) mais `resolveCompanyId` est retombé sur le compte lui-même, faute de ligne
//     d'équipe active lisible — un rattachement désactivé, ou une panne de lecture. Sans ce refus, l'écran
//     s'ouvrirait vide et muet, le défaut même que ce lot supprime.
//   - `fiche_societe_absente` / `fiche_societe_multiple` : `profiles_artisan.user_id` n'est pas unique
//     (migration 052, et app/api/user-storage/route.ts boucle d'ailleurs sur plusieurs fiches). Prendre « la
//     première » donnerait une clé de cache, un en-tête et un gabarit arbitraires — donc, un jour, une liste vide
//     et un document à l'en-tête d'une autre fiche.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { lirePerimetreBtp, niveauSur, type PerimetreBtp } from '@/lib/btp/perimetre-compte'
import { logger } from '@/lib/logger'
import type { AccessLevel } from '@/lib/permissions'
import { messageRefusFr, type CodeRefusDocuments } from '@/lib/documents/messages-refus'

/** Les deux familles de documents, telles que les tables et les modules de permission les nomment. */
export type FamilleDocument = 'devis' | 'factures'

export const FAMILLES_DOCUMENT: readonly FamilleDocument[] = ['devis', 'factures'] as const

/**
 * Module de permission dont relève chaque famille de documents.
 *
 * Table dédiée, et non une entrée ajoutée à MODULE_PAR_TABLE : celle-ci est documentée comme « chaque table écrite
 * par /api/btp » et son contenu est parcouru par les bancs de cette route (BTP_TABLES_ECRIVABLES). Y glisser `devis`
 * ferait une promesse que /api/btp ne tient pas.
 */
const MODULE_PAR_FAMILLE: Record<FamilleDocument, string> = { devis: 'devis', factures: 'factures' }

/** Famille de documents dont relève un type de série, pour la numérotation (acompte et avoir sont des factures). */
const FAMILLE_PAR_TYPE_SERIE: Record<string, FamilleDocument | undefined> = {
  devis: 'devis',
  facture: 'factures',
  acompte: 'factures',
  avoir: 'factures',
}

/** Famille d'un type de série, ou null pour un type inconnu — qui ne doit alors donner aucun droit. */
export function familleDuTypeSerie(type: string): FamilleDocument | null {
  return FAMILLE_PAR_TYPE_SERIE[type] ?? null
}

/** Niveau du compte sur une famille de documents. Un titulaire a FULL, comme sur tout le reste. */
export function niveauDocuments(perimetre: PerimetreBtp, famille: FamilleDocument): AccessLevel {
  return niveauSur(perimetre, MODULE_PAR_FAMILLE[famille])
}

/**
 * Le compte peut-il VOIR les documents de cette famille ?
 *
 * READ suffit. Un document n'est pas projetable colonne par colonne comme une liste de chantiers : son contenu réel
 * vit dans `raw_data`, et une version amputée qui repasserait par /api/devis/sync écraserait le document d'origine
 * par une coquille à 0 €. Donc, pour les documents : on montre tout, ou rien — et c'est l'écriture qui distingue
 * READ de FULL.
 */
export function peutLireDocuments(perimetre: PerimetreBtp, famille: FamilleDocument): boolean {
  return niveauDocuments(perimetre, famille) !== 'NONE'
}

/** Le compte peut-il CRÉER ou MODIFIER un document de cette famille ? Seul FULL écrit. */
export function peutEcrireDocuments(perimetre: PerimetreBtp, famille: FamilleDocument): boolean {
  return niveauDocuments(perimetre, famille) === 'FULL'
}

/** Familles que ce compte peut voir ; vide s'il n'a droit à aucune (OUVRIER, CHEF_CHANTIER). */
export function famillesLisibles(perimetre: PerimetreBtp): FamilleDocument[] {
  return FAMILLES_DOCUMENT.filter(famille => peutLireDocuments(perimetre, famille))
}

/**
 * Colonnes de `profiles_artisan` qu'un sous-compte ne reçoit jamais : contrôle d'identité du gérant et pièces
 * justificatives (Kbis, certidão, pièce d'identité), identifiants chiffrés, références de paiement.
 *
 * Défense en profondeur, et rien de plus : la policy `profiles_artisan_public_read` (migration 041) rend toutes les
 * colonnes d'une fiche `active = true` à n'importe quel visiteur, donc ce filtre ne scelle rien — il évite seulement
 * qu'une route authentifiée serve ces champs de sa propre initiative.
 *
 * L'en-tête portugais prend le NIPC dans `siret`, comme le formulaire BTP le valide (9 ou 14 chiffres) : aucun champ
 * retiré ici n'entre dans un devis.
 */
const COLONNES_SECRETES = [
  /^kyc_/,
  /_encrypted$/,
  /^id_document/,
  /^stripe/,
  /^kbis/,
  /^certidao/,
  /^insurance_url$/,
  /^insurance_scan_data$/,
]

/** La fiche de la société, débarrassée de ce qu'un sous-compte n'a pas à recevoir. */
export function ficheSansSecrets(fiche: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fiche).filter(([nom]) => !COLONNES_SECRETES.some(motif => motif.test(nom))),
  )
}

/**
 * Ce qu'un compte sans droit sur les documents reçoit de la fiche : de quoi afficher son entreprise dans
 * l'application, et rien de l'identité légale qu'il n'imprimera jamais.
 */
const CHAMPS_EN_TETE = ['id', 'user_id', 'company_name', 'logo_url', 'language', 'legal_form'] as const

/** La fiche réduite à l'en-tête d'écran. */
export function ficheEnTeteSeulement(fiche: Record<string, unknown>): Record<string, unknown> {
  const gardes = new Set<string>(CHAMPS_EN_TETE)
  return Object.fromEntries(Object.entries(fiche).filter(([nom]) => gardes.has(nom)))
}

/**
 * Le compte annonce un rattachement que le serveur n'a pas pu résoudre.
 *
 * `app_metadata.company_id` est posé par le serveur à l'acceptation de l'invitation, mais aucune autorisation ne le
 * lit : la société vient de `pro_team_members` (resolveCompanyId), qui retombe sur le compte lui-même quand il n'y
 * trouve aucune ligne active.
 *
 * Servir le compte lui-même à la place de la société donnerait un écran vide et muet. Mieux vaut refuser.
 */
export function societeNonResolue(user: User, perimetre: PerimetreBtp): boolean {
  const rattachement = user.app_metadata?.company_id
  const annonce = typeof rattachement === 'string' && rattachement.trim() !== '' ? rattachement : null
  return annonce !== null && annonce !== user.id && perimetre.societeId === user.id
}

/**
 * Propriétaire à viser pour MODIFIER un document, ou le refus à rendre tel quel.
 *
 * Les routes de mutation (statut, annulation, conservation légale) cherchaient leur ligne par
 * `numero + artisan_user_id = user.id` : pour un salarié invité, dont les documents sont ceux de la société, elles
 * répondaient « introuvable » — un 404 sur chaque bouton d'un écran par ailleurs rempli. Elles visent maintenant la
 * société, après contrôle du rôle.
 *
 * Pour un artisan, un gérant ou un super_admin, le propriétaire rendu est son propre identifiant : aucune requête ne
 * change (règle #1).
 */
export async function proprietairePourEcriture(
  user: User,
  admin: SupabaseClient,
  famille: FamilleDocument,
): Promise<{ ok: true; proprietaire: string } | { ok: false; status: 403 | 409; message: string }> {
  const perimetre = await lirePerimetreBtp(user, admin)
  if (societeNonResolue(user, perimetre)) {
    return { ok: false, status: 409, message: messageRefusFr('societe_non_resolue') }
  }
  if (!peutEcrireDocuments(perimetre, famille)) {
    return { ok: false, status: 403, message: "Votre rôle dans l'entreprise ne permet pas de modifier ce document." }
  }
  return { ok: true, proprietaire: perimetre.societeId }
}

export interface TitulaireDocuments {
  ok: true
  perimetre: PerimetreBtp
  /** Compte sous lequel les documents de la société sont rangés : `devis.artisan_user_id`. */
  societeId: string
  /** Fiche de la société : clé du gabarit, en-tête légal, nom affiché. */
  ficheId: string
  /** La fiche, secrets retirés — réduite à l'en-tête d'écran pour un compte sans droit sur les documents. */
  fiche: Record<string, unknown>
  /** Familles de documents que ce compte peut voir ; vide pour un ouvrier ou un chef de chantier. */
  lisibles: FamilleDocument[]
}

export interface RefusTitulaire {
  ok: false
  status: 409 | 500
  code: CodeRefusDocuments
  message: string
}

function refus(code: CodeRefusDocuments, status: RefusTitulaire['status'] = 409): RefusTitulaire {
  return { ok: false, status, code, message: messageRefusFr(code) }
}

/**
 * Titulaire des documents pour ce compte, ou le refus à rendre tel quel.
 *
 * Pour un titulaire (artisan compris) le résultat décrit sa propre société et sa propre fiche : la fonction sert
 * alors de lecture commune, sans rien changer à ses droits.
 */
export async function resoudreTitulaireDocuments(
  user: User,
  admin: SupabaseClient,
): Promise<TitulaireDocuments | RefusTitulaire> {
  const perimetre = await lirePerimetreBtp(user, admin)

  // Rattachement annoncé par le jeton mais société non résolue : ne jamais servir le compte lui-même à sa place.
  if (societeNonResolue(user, perimetre)) {
    logger.warn('[documents] rattachement annoncé mais société non résolue', {
      compte: user.id.slice(0, 8),
      roleEquipe: perimetre.roleEquipe,
    })
    return refus('societe_non_resolue')
  }

  const { data, error } = await admin
    .from('profiles_artisan')
    .select('*')
    .eq('user_id', perimetre.societeId)

  if (error) {
    logger.error('[documents] fiche de la société illisible', { error: error.message })
    return refus('lecture_impossible', 500)
  }

  const fiches = (data ?? []) as Record<string, unknown>[]
  if (fiches.length === 0) return refus('fiche_societe_absente')
  if (fiches.length > 1) {
    logger.warn('[documents] plusieurs fiches pour une même société', {
      societe: perimetre.societeId.slice(0, 8),
      nombre: fiches.length,
    })
    return refus('fiche_societe_multiple')
  }

  const fiche = fiches[0]
  const ficheId = typeof fiche.id === 'string' ? fiche.id : ''
  if (!ficheId) return refus('fiche_societe_absente')

  const lisibles = famillesLisibles(perimetre)
  return {
    ok: true,
    perimetre,
    societeId: perimetre.societeId,
    ficheId,
    // Sans droit sur les documents, le compte ne reçoit que de quoi afficher son entreprise.
    fiche: lisibles.length === 0 ? ficheEnTeteSeulement(fiche) : ficheSansSecrets(fiche),
    lisibles,
  }
}
