// ── Qui est le copropriétaire connecté ? ──────────────────────────────────────
//
// Les routes /api/coproprietaire/* servent les données du syndic (service role) : avant
// toute requête, on retrouve la fiche syndic_coproprios du compte, qui fixe le cabinet,
// l'immeuble et le lot. Tout ce qui est servi ensuite est filtré sur ce cabinet et cet
// immeuble (lib/coproprietaire/filtrage.ts).
//
// Règles de rattachement :
//   - rôle coproprio (app_metadata, non forgeable) → fiche(s) dont email_proprietaire est l'e-mail
//     du compte ; rôle locataire → email_locataire seulement (un rôle locataire, auto-attribuable à
//     l'inscription, ne devient jamais propriétaire) ; casse ignorée ; e-mail du compte confirmé ;
//     accès activé par le syndic (acces_portail, ou acces_portail_locataire pour le locataire) ;
//   - super_admin (liste ADMIN_EMAIL quand elle est définie), ou super_admin qui consulte le
//     portail en « vue copropriétaire » (rôle d'emprunt, _original_role) → SON cabinet (son id),
//     fiche désignée par l'option `coproprioId` ou `email`, sinon première fiche du cabinet dont
//     l'accès est activé : la démo joue un copropriétaire de son propre cabinet, jamais d'un autre ;
//   - tout autre rôle (syndic, artisan, client…) → refus : chacun a son espace.
//
// Module serveur (client Supabase service role injecté) sans dépendance React.

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getUserRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import type { RoleOccupant } from '@/lib/coproprietaire/types'

/**
 * Ligne de syndic_coproprios (004_syndic_coproprios.sql ; acces_portail_locataire : migration
 * 20261017, absente tant qu'elle n'est pas appliquée). Lue avec select('*') pour tolérer les écarts
 * de schéma ; `notes` (interne au cabinet) n'est jamais recopiée dans une vue.
 */
export interface FicheCoproprio {
  id: string
  cabinet_id: string
  immeuble: string | null
  batiment: string | null
  etage: number | string | null
  numero_porte: string | null
  nom_proprietaire: string | null
  prenom_proprietaire: string | null
  email_proprietaire: string | null
  tel_proprietaire: string | null
  nom_locataire: string | null
  prenom_locataire: string | null
  email_locataire: string | null
  tel_locataire: string | null
  est_occupe: boolean | null
  tantieme: number | string | null
  solde: number | string | null
  acces_portail: boolean | null
  acces_portail_locataire?: boolean | null
}

export type CodeAcces = 'non_authentifie' | 'role_interdit' | 'email_non_confirme' | 'fiche_introuvable' | 'acces_non_active' | 'erreur'

export interface AccesCopro {
  cabinetId: string
  /** Fiche affichée. */
  fiche: FicheCoproprio
  /** Fiches du compte dont l'accès est activé (plusieurs lots possibles), fiche affichée comprise. */
  fiches: FicheCoproprio[]
  role: RoleOccupant
  /** E-mail qui rattache les signalements (demandeur_email), en minuscules. */
  email: string
  /** Super admin qui consulte une fiche de son cabinet : accès non soumis à acces_portail. */
  superAdmin: boolean
}

export type ResultatAcces = { ok: true; acces: AccesCopro } | { ok: false; code: CodeAcces }

export interface OptionsAcces {
  /** Fiche demandée (id syndic_coproprios) : lot choisi par un compte à plusieurs lots, ou fiche visée par le super admin. */
  coproprioId?: string | null
  /** Super admin seulement : e-mail de la fiche à afficher (celui du profil de démo du portail). */
  email?: string | null
}

/** Nombre maximal de fiches lues pour un même compte (plusieurs lots). */
const MAX_FICHES = 50

/** Échappe les jokers de LIKE (% _ \) : la recherche ilike reste une égalité insensible à la casse. */
export function echapperMotifLike(valeur: string): string {
  return valeur.replace(/[\\%_]/g, c => `\\${c}`)
}

/** E-mail en minuscules, sans espaces ; chaîne vide si absent. */
export function emailNormalise(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase()
}

// Même liste que isSuperAdmin (lib/auth-helpers.ts) : défense en profondeur quand elle est définie.
const EMAILS_SUPER_ADMIN = [process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL_2]
  .filter((e): e is string => typeof e === 'string' && e.trim() !== '')
  .map(e => e.trim().toLowerCase())

/** Super admin, directement ou en « vue copropriétaire » (rôle d'emprunt posé par /api/admin/impersonate). */
export function estSuperAdmin(user: User): boolean {
  const marque = getUserRole(user) === 'super_admin' || user.app_metadata?._original_role === 'super_admin'
  if (!marque) return false
  return EMAILS_SUPER_ADMIN.length === 0 || EMAILS_SUPER_ADMIN.includes(emailNormalise(user.email))
}

/**
 * L'accès au portail est-il activé par le syndic pour cet occupant ? Locataire : colonne
 * acces_portail_locataire ; tant qu'elle n'existe pas (migration non appliquée), suit acces_portail.
 */
export function accesActive(fiche: FicheCoproprio, role: RoleOccupant): boolean {
  if (role === 'locataire') {
    const drapeau = fiche.acces_portail_locataire
    return drapeau === undefined || drapeau === null ? fiche.acces_portail === true : drapeau === true
  }
  return fiche.acces_portail === true
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ordre d'affichage des lots : immeuble, bâtiment, étage, porte. */
function trierFiches(fiches: FicheCoproprio[]): FicheCoproprio[] {
  const cle = (f: FicheCoproprio) =>
    [f.immeuble || '', f.batiment || '', String(f.etage ?? '').padStart(3, '0'), f.numero_porte || ''].join('\u0000')
  return [...fiches].sort((a, b) => cle(a).localeCompare(cle(b), 'fr'))
}

type ColonneEmail = 'email_proprietaire' | 'email_locataire'

/** Fiches dont la colonne d'e-mail vaut exactement `email` (ilike côté base, égalité stricte ici). */
async function fichesParEmail(
  admin: SupabaseClient,
  colonne: ColonneEmail,
  email: string,
  cabinetId?: string,
): Promise<FicheCoproprio[] | null> {
  let requete = admin.from('syndic_coproprios').select('*').ilike(colonne, echapperMotifLike(email)).limit(MAX_FICHES)
  if (cabinetId) requete = requete.eq('cabinet_id', cabinetId)
  const { data, error } = await requete
  if (error) {
    logger.error('[COPRO ACCES] lecture des fiches par e-mail', { colonne, code: error.code, message: error.message })
    return null
  }
  // PostgREST traite aussi « * » comme un joker dans un motif ilike : égalité vérifiée ici.
  return ((data || []) as FicheCoproprio[]).filter(f => f.cabinet_id && emailNormalise(f[colonne]) === email)
}

/** Fiche affichée parmi celles du compte : celle demandée si elle en fait partie, sinon la première. */
function choisirFiche(fiches: FicheCoproprio[], coproprioId: string | null | undefined): FicheCoproprio {
  const triees = trierFiches(fiches)
  return (coproprioId && triees.find(f => f.id === coproprioId)) || triees[0]
}

async function accesSuperAdmin(user: User, admin: SupabaseClient, options: OptionsAcces): Promise<ResultatAcces> {
  const cabinetId = user.id
  const coproprioId = options.coproprioId && UUID.test(options.coproprioId) ? options.coproprioId : null
  const email = emailNormalise(options.email)

  // Fiche désignée par son id : seulement si elle appartient à SON cabinet.
  if (coproprioId) {
    const { data, error } = await admin
      .from('syndic_coproprios').select('*').eq('id', coproprioId).eq('cabinet_id', cabinetId).maybeSingle()
    if (error) {
      logger.error('[COPRO ACCES] lecture de la fiche désignée', { code: error.code, message: error.message })
      return { ok: false, code: 'erreur' }
    }
    const fiche = data as FicheCoproprio | null
    if (!fiche) return { ok: false, code: 'fiche_introuvable' }
    return {
      ok: true,
      acces: { cabinetId, fiche, fiches: [fiche], role: 'proprietaire', email: emailNormalise(fiche.email_proprietaire), superAdmin: true },
    }
  }

  // Fiche désignée par e-mail (profil de démo du portail), dans SON cabinet : propriétaire, sinon locataire.
  if (email) {
    const proprietaire = await fichesParEmail(admin, 'email_proprietaire', email, cabinetId)
    if (proprietaire === null) return { ok: false, code: 'erreur' }
    if (proprietaire.length > 0) {
      return { ok: true, acces: { cabinetId, fiche: choisirFiche(proprietaire, null), fiches: proprietaire, role: 'proprietaire', email, superAdmin: true } }
    }
    const locataire = await fichesParEmail(admin, 'email_locataire', email, cabinetId)
    if (locataire === null) return { ok: false, code: 'erreur' }
    if (locataire.length > 0) {
      return { ok: true, acces: { cabinetId, fiche: choisirFiche(locataire, null), fiches: locataire, role: 'locataire', email, superAdmin: true } }
    }
    // E-mail inconnu du cabinet : on ne bascule jamais sur une autre personne.
    return { ok: false, code: 'fiche_introuvable' }
  }

  // Sans désignation : première fiche du cabinet dont l'accès est activé, à défaut la première fiche.
  const { data, error } = await admin
    .from('syndic_coproprios').select('*').eq('cabinet_id', cabinetId).limit(MAX_FICHES)
  if (error) {
    logger.error('[COPRO ACCES] lecture des fiches du cabinet', { code: error.code, message: error.message })
    return { ok: false, code: 'erreur' }
  }
  const fiches = trierFiches((data || []) as FicheCoproprio[])
  const fiche = fiches.find(f => f.acces_portail === true) ?? fiches[0]
  if (!fiche) return { ok: false, code: 'fiche_introuvable' }
  return {
    ok: true,
    acces: { cabinetId, fiche, fiches: [fiche], role: 'proprietaire', email: emailNormalise(fiche.email_proprietaire), superAdmin: true },
  }
}

/**
 * Fiche du copropriétaire (ou locataire) connecté. `null` pour l'utilisateur = non authentifié.
 * Ne lève jamais : les erreurs Supabase sont journalisées et rendues par le code `erreur`.
 */
export async function resoudreCoproprietaire(
  user: User | null,
  admin: SupabaseClient,
  options: OptionsAcces = {},
): Promise<ResultatAcces> {
  if (!user) return { ok: false, code: 'non_authentifie' }
  if (estSuperAdmin(user)) return accesSuperAdmin(user, admin, options)

  const roleCompte = getUserRole(user)
  if (roleCompte !== 'coproprio' && roleCompte !== 'locataire') return { ok: false, code: 'role_interdit' }
  const role: RoleOccupant = roleCompte === 'locataire' ? 'locataire' : 'proprietaire'

  const email = emailNormalise(user.email)
  if (!email) return { ok: false, code: 'fiche_introuvable' }
  if (!user.email_confirmed_at) return { ok: false, code: 'email_non_confirme' }

  const fiches = await fichesParEmail(admin, role === 'locataire' ? 'email_locataire' : 'email_proprietaire', email)
  if (fiches === null) return { ok: false, code: 'erreur' }
  if (fiches.length === 0) return { ok: false, code: 'fiche_introuvable' }

  const activees = fiches.filter(f => accesActive(f, role))
  if (activees.length === 0) return { ok: false, code: 'acces_non_active' }

  const fiche = choisirFiche(activees, options.coproprioId)
  return {
    ok: true,
    acces: { cabinetId: fiche.cabinet_id, fiche, fiches: activees, role, email, superAdmin: false },
  }
}

/** Réponse HTTP d'un refus d'accès : statut et code renvoyés au portail. */
export function statutHttpAcces(code: CodeAcces): number {
  switch (code) {
    case 'non_authentifie': return 401
    case 'role_interdit': return 403
    case 'email_non_confirme': return 403
    case 'acces_non_active': return 403
    case 'fiche_introuvable': return 404
    default: return 500
  }
}
