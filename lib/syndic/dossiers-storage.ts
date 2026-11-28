// Dossiers Storage autorisés pour un objet d'un cabinet syndic (buckets syndic-documents,
// syndic-pdf-templates), passés en préfixe à assertStoragePath (lib/security/storage-path.ts).
//
// Format des chemins : {cabinetId}/… depuis le 25/05/2026 (fb2aae64) ; du 21 au 25/05/2026, les dépôts
// étaient écrits sous {user.id}/… de l'uploadeur (0f159cac, 95c16b4a), mémorisé dans uploaded_by
// (syndic_documents) ou created_by (syndic_pdf_templates).
//
// uploaded_by / created_by et storage_path sont des colonnes que le cabinet peut écrire lui-même avec son
// JWT (policies *_insert_own / *_update_own : cabinet_id = auth.uid(), sans contrainte sur les autres
// colonnes). Prendre la colonne telle quelle comme préfixe reviendrait à laisser le cabinet choisir le
// dossier : il y mettrait l'identifiant d'un autre cabinet et obtiendrait une URL signée sur un objet qui
// n'est pas le sien. Le dossier de l'uploadeur n'est donc accepté que s'il désigne le cabinet lui-même ou
// un compte rattaché au cabinet dans syndic_team_members.
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

// Même durée que le cache de resolveCabinetId (lib/auth-helpers.ts) : fenêtre courte après le retrait
// d'un membre.
const DUREE_CACHE_MS = 60 * 1000
const cacheMembres = new Map<string, { membre: boolean; expireA: number }>()

/** Vide le cache (tests). */
export function viderCacheDossiersStorage(): void {
  cacheMembres.clear()
}

async function estMembreDuCabinet(sb: SupabaseClient, cabinetId: string, userId: string): Promise<boolean> {
  const cle = `${cabinetId}/${userId}`
  const enCache = cacheMembres.get(cle)
  if (enCache && enCache.expireA > Date.now()) return enCache.membre

  // Membre actif ou non : un membre désactivé reste l'auteur légitime de ses anciens dépôts, et le
  // cabinet, qui écrit lui-même ces lignes, ne gagnerait rien à ce que is_active soit exigé.
  const { data, error } = await sb
    .from('syndic_team_members')
    .select('id')
    .eq('cabinet_id', cabinetId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (error) {
    // Refus fermé : sans preuve d'appartenance, seul le dossier du cabinet reste autorisé.
    logger.warn('[dossiers-storage] lecture syndic_team_members', { message: error.message })
    return false
  }
  const membre = data !== null
  cacheMembres.set(cle, { membre, expireA: Date.now() + DUREE_CACHE_MS })
  return membre
}

/**
 * Préfixes autorisés pour un chemin relu en base : toujours le dossier du cabinet, plus celui de
 * l'uploadeur (uploaded_by / created_by) quand il désigne le cabinet ou l'un de ses membres.
 */
export async function prefixesStorageCabinet(
  sb: SupabaseClient,
  cabinetId: string,
  uploadeur: string | null | undefined,
): Promise<string[]> {
  if (typeof uploadeur !== 'string' || uploadeur.length === 0 || uploadeur === cabinetId) return [cabinetId]
  return (await estMembreDuCabinet(sb, cabinetId, uploadeur)) ? [cabinetId, uploadeur] : [cabinetId]
}
