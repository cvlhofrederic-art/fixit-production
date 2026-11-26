// ═══════════════════════════════════════════════════════════════════════════════
// PÉRIMÈTRE D'UN COMPTE SUR LES DONNÉES BTP (24/11/2026)
//
// Avant : /api/btp filtrait tout par `owner_id = user.id`. Un salarié invité porte son propre identifiant, qui n'est
// celui d'aucune ligne de la société : il recevait des listes vides, sans erreur. Et c'était cette même borne qui
// l'empêchait de modifier ou de supprimer les lignes du gérant — une protection par effet de bord, pas par règle.
//
// Ouvrir la lecture au périmètre de la société sans rien d'autre aurait donc ouvert la suppression du même coup.
// Ce module sépare les deux : le compte lit les lignes de SA société, mais n'écrit que si son rôle d'équipe l'y
// autorise, et ne voit d'une table que ce que son niveau de permission lui laisse voir.
//
//   titulaire (gérant, artisan, super_admin, conciergerie, gestionnaire) → tout, comme avant, sans changement
//   sous-compte, permission FULL sur le module                          → tout, et il peut écrire
//   sous-compte, permission READ                                        → vue restreinte, aucune écriture
//                                       (sauf les rapports : la liste entière en lecture, LISTES_ENTIERES_EN_LECTURE)
//   sous-compte, permission NONE ou module inconnu                      → rien
//
// « Vue restreinte » veut dire deux choses, pas une : moins de LIGNES (ses chantiers affectés, pas ceux de toute la
// société) et moins de COLONNES (ni budget, ni marge, ni montant facturé ; ni salaire ni coût horaire d'un collègue).
// La projection de colonnes est indispensable : les lectures de la route sont en `select('*')`.
//
// Les permissions viennent de app_metadata.pro_team_role (posé par le serveur, non modifiable par l'utilisateur) et
// des dérogations que le gérant a posées dans pro_role_permissions. Jamais de localStorage : hooks/usePermissions
// accorde FULL quand ses clés manquent, ce qui est acceptable pour dessiner un menu et ne l'est pas pour garder
// une donnée.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getUserRole, isProGerant, resolveCompanyId, societeDunAutreCompte } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import {
  getEffectivePermissions, isValidProTeamRole,
  type AccessLevel, type ProTeamRole,
} from '@/lib/permissions'

/** Ce qu'un compte peut voir d'une liste : tout, une vue restreinte, ou rien. */
export type Visibilite = 'tout' | 'restreinte' | 'aucune'

export interface PerimetreBtp {
  /** Compte dont les lignes sont lues et sous lequel les écritures sont enregistrées : la société. */
  societeId: string
  /** Titulaire du compte (gérant, artisan, super_admin, conciergerie, gestionnaire) : aucune restriction. */
  titulaire: boolean
  /** Rôle d'équipe du sous-compte ; null pour un titulaire ou un rôle d'équipe inconnu. */
  roleEquipe: ProTeamRole | null
  /** Permissions effectives du sous-compte (défauts du rôle + dérogations du gérant) ; vide pour un titulaire. */
  permissions: Record<string, AccessLevel>
  /** Adresse e-mail du compte, pour retrouver sa fiche employé (membres_btp) ; '' si absente. */
  email: string
}

/**
 * Module de permission dont relève chaque liste lue par /api/btp.
 * `null` : table de référence commune à tous les comptes, sans donnée de société (ref_taux).
 */
export const MODULE_PAR_LISTE: Record<string, string | null> = {
  chantiers: 'chantiers',
  membres: 'equipes',
  equipes: 'equipes',
  pointages: 'pointage',
  depenses: 'compta_btp',
  situations: 'situations',
  retenues: 'garanties',
  dc4: 'sous_traitance',
  dce_analyses: 'dpgf',
  dpgf: 'dpgf',
  ref_taux: null,
  charges_fixes: 'comptabilite',
  rapports: 'rapports',
  rentabilite: 'rentabilite',
  settings: 'settings',
}

/** Module de permission dont relève chaque table écrite par /api/btp (BTP_TABLES_ECRIVABLES). */
export const MODULE_PAR_TABLE: Record<string, string> = {
  chantiers_btp: 'chantiers',
  membres_btp: 'equipes',
  equipes_btp: 'equipes',
  pointages_btp: 'pointage',
  depenses_btp: 'compta_btp',
  settings_btp: 'settings',
  situations_btp: 'situations',
  retenues_btp: 'garanties',
  dc4_btp: 'sous_traitance',
  dce_analyses_btp: 'dpgf',
  dpgf_btp: 'dpgf',
  charges_fixes: 'comptabilite',
  rapports_btp: 'rapports',
}

/**
 * Colonnes laissées passer en vue restreinte. Tout ce qui n'y figure pas est retiré de la réponse, y compris les
 * colonnes système autres que l'identifiant : un salarié n'a pas à connaître l'identifiant du propriétaire.
 * Sur le modèle de `chantierPourTelephone` (lib/btp/pointage-regles.ts), qui ne laisse passer qu'un chantier réduit.
 * Une liste absente d'ici n'a pas de vue restreinte : en READ, elle est traitée comme 'aucune', sauf si elle figure
 * dans LISTES_ENTIERES_EN_LECTURE (les rapports) : elle est alors montrée en entier.
 */
export const COLONNES_VUE_RESTREINTE: Record<string, readonly string[]> = {
  // Ce qu'il faut pour aller sur le chantier et pour la météo : où, quand, quel statut. Ni client, ni budget, ni
  // marge, ni montant facturé, ni acompte, ni pénalité de retard, ni sous-tâches.
  chantiers: [
    'id', 'titre', 'adresse', 'ville', 'code_postal', 'latitude', 'longitude', 'geo_rayon_m',
    'statut', 'date_debut', 'date_fin', 'description', 'membres_ids', 'created_at',
  ],
}

// Pourquoi `membres` et `equipes` n'ont PAS de vue restreinte : les écrans remplacent une colonne absente par une
// valeur par défaut — `cout_horaire || 25`, `chargesPct || 45`, `type_contrat || 'cdi'` (lib/hooks/use-btp-data.ts)
// — et EquipesBTPV2 affiche ces chiffres dans un tableau « Coût/h · Coût réel/h · Contrat ». Projeter la paie y
// fabriquerait des montants faux donnés pour ceux d'un collègue, ce qui est pire que de ne rien montrer. En lecture
// seule ces deux listes valent donc « aucune » ; il faut FULL pour les voir.

/** Niveau du compte sur un module : un titulaire a tout, un module inconnu ne donne rien. */
export function niveauSur(perimetre: PerimetreBtp, module: string | null | undefined): AccessLevel {
  if (perimetre.titulaire) return 'FULL'
  if (module === null) return 'READ'
  if (module === undefined) return 'NONE'
  return perimetre.permissions[module] ?? 'NONE'
}

/**
 * Listes qu'un niveau READ montre en entier, sans écriture. Les rapports de chantier ne portent ni montant ni salaire :
 * « lecture » y veut dire les voir, comme le gérant l'entend quand il l'accorde à un employé (décision du 26/11/2026 :
 * « décider qui voit quoi et qui peut toucher à quoi avec des degrés de pouvoir »). Avant, READ n'y donnait rien.
 */
const LISTES_ENTIERES_EN_LECTURE: ReadonlySet<string> = new Set(['rapports'])

/**
 * Ce que le compte voit de cette liste. Une liste sans vue restreinte définie ne se montre qu'en FULL, sauf celles de
 * LISTES_ENTIERES_EN_LECTURE, montrées en entier en READ.
 */
export function visibiliteListe(perimetre: PerimetreBtp, cle: string): Visibilite {
  if (perimetre.titulaire) return 'tout'
  if (!(cle in MODULE_PAR_LISTE)) return 'aucune'
  const niveau = niveauSur(perimetre, MODULE_PAR_LISTE[cle])
  if (niveau === 'FULL') return 'tout'
  if (niveau === 'NONE') return 'aucune'
  if (LISTES_ENTIERES_EN_LECTURE.has(cle)) return 'tout'
  return cle in COLONNES_VUE_RESTREINTE || MODULE_PAR_LISTE[cle] === null ? 'restreinte' : 'aucune'
}

/** Le compte peut-il écrire dans cette table ? Seul FULL écrit ; une table hors de la table de correspondance, non. */
export function peutEcrireTable(perimetre: PerimetreBtp, table: string): boolean {
  if (perimetre.titulaire) return true
  if (!(table in MODULE_PAR_TABLE)) return false
  return niveauSur(perimetre, MODULE_PAR_TABLE[table]) === 'FULL'
}

/** Ne garde de chaque ligne que les colonnes autorisées ; une liste sans projection définie passe telle quelle. */
export function projeter(cle: string, lignes: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const colonnes = COLONNES_VUE_RESTREINTE[cle]
  if (!colonnes) return lignes as Record<string, unknown>[]
  const gardees = new Set(colonnes)
  return lignes.map(ligne => Object.fromEntries(Object.entries(ligne).filter(([nom]) => gardees.has(nom))))
}

/**
 * Périmètre du compte connecté. Un titulaire garde exactement le comportement d'avant (sa propre société, tout
 * visible, tout écrivable). Pour un sous-compte, la société est résolue côté serveur et les permissions sont lues
 * en base ; une lecture des dérogations en échec ne donne jamais plus de droits que les défauts du rôle.
 */
export async function lirePerimetreBtp(user: User, admin: SupabaseClient): Promise<PerimetreBtp> {
  const email = typeof user.email === 'string' ? user.email : ''
  const role = getUserRole(user)

  // Tout ce qui n'est pas un sous-compte de société BTP garde son propre périmètre, comme avant ce lot.
  // Un gérant INVITÉ (pro_team_role = 'GERANT' avec la société d'un autre compte) n'en fait pas partie : il est
  // résolu comme un sous-compte, et les permissions par défaut de son rôle lui donnent FULL partout.
  if (role !== 'pro_societe' || (isProGerant(user) && !societeDunAutreCompte(user))) {
    return { societeId: user.id, titulaire: true, roleEquipe: null, permissions: {}, email }
  }

  const societeId = (await resolveCompanyId(user, admin)) ?? user.id
  // Compte rattaché à une autre société mais sans ligne d'équipe active (retiré, désactivé, ou lecture en panne) :
  // resolveCompanyId retombe sur son propre identifiant. Sans cette garde, un gérant ou une secrétaire gardait FULL
  // sur cette « société » vide à son nom, et ses écritures y partaient sans erreur.
  if (societeDunAutreCompte(user) && societeId === user.id) {
    logger.warn('[btp] compte rattaché à une société sans ligne d’équipe active : aucun droit')
    return { societeId, titulaire: false, roleEquipe: null, permissions: {}, email }
  }
  const roleBrut = user.app_metadata?.pro_team_role
  const roleEquipe = typeof roleBrut === 'string' && isValidProTeamRole(roleBrut) ? roleBrut : null

  // Rôle d'équipe inconnu : aucun droit plutôt qu'un repli permissif (un rôle ajouté en base sans être codé ici ne
  // doit pas ouvrir la société à son porteur).
  if (!roleEquipe) {
    logger.warn('[btp] sous-compte au rôle d’équipe inconnu', { role: typeof roleBrut === 'string' ? roleBrut : typeof roleBrut })
    return { societeId, titulaire: false, roleEquipe: null, permissions: {}, email }
  }

  const derogations = await lireDerogations(user.id, societeId, admin)
  // Plus de ligne d'équipe active dans cette société : compte désactivé ou retiré pendant les 60 s où resolveCompanyId
  // garde sa société en mémoire. Aucun droit : les défauts du rôle s'appliquaient sans les restrictions du gérant, et le
  // compte désactivé pouvait encore écrire les modes de paiement, des demandes de prix ou des messages de la société.
  if (derogations === null) {
    logger.warn('[btp] sous-compte sans ligne d’équipe active dans sa société : aucun droit')
    return { societeId, titulaire: false, roleEquipe: null, permissions: {}, email }
  }
  const permissions = getEffectivePermissions(roleEquipe, derogations)
  return { societeId, titulaire: false, roleEquipe, permissions, email }
}

/**
 * Dérogations posées par le gérant sur ce compte (pro_role_permissions) ; liste vide si la lecture échoue, null si le
 * compte n'a plus de ligne d'équipe active dans cette société. Bornées à la société du membre : une ligne dont
 * company_id diffère n'a pas été posée par le serveur (jusqu'à la migration 20261125b, toute session pouvait en insérer
 * sous son propre uid, et un salarié se donnait ainsi FULL).
 */
async function lireDerogations(
  userId: string,
  societeId: string,
  admin: SupabaseClient,
): Promise<{ module_id: string; access_level: AccessLevel }[] | null> {
  try {
    const { data: membre, error: erreurMembre } = await admin
      .from('pro_team_members').select('id').eq('user_id', userId).eq('company_id', societeId).eq('is_active', true)
      .maybeSingle()
    if (erreurMembre) throw new Error(erreurMembre.message)
    const membreId = (membre as { id?: string } | null)?.id
    if (!membreId) return null

    const { data, error } = await admin
      .from('pro_role_permissions').select('module_id, access_level').eq('member_id', membreId).eq('company_id', societeId)
    if (error) throw new Error(error.message)
    return ((data ?? []) as { module_id: string; access_level: string }[])
      .filter(ligne => ligne.access_level === 'FULL' || ligne.access_level === 'READ' || ligne.access_level === 'NONE')
      .map(ligne => ({ module_id: ligne.module_id, access_level: ligne.access_level as AccessLevel }))
  } catch (erreur) {
    // Les défauts du rôle s'appliquent seuls : une panne ne donne jamais plus que ce que le rôle prévoit.
    logger.warn('[btp] dérogations de permissions illisibles', { error: erreur instanceof Error ? erreur.message : String(erreur) })
    return []
  }
}
