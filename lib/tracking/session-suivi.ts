// Session de suivi GPS : objet {token}.json du bucket privé « tracking », écrit par /api/tracking/update
// et relu par la page publique /tracking/[token] (GET sans session).
//
// Le jeton (lib/security/tracking-token.ts) n'est lié à aucun compte en base : pour qu'un compte
// authentifié ne puisse pas écraser ni supprimer la session d'un autre artisan, /api/tracking/update
// enregistre le compte qui l'alimente (artisan_user_id) et chaque écriture ou suppression suivante
// vérifie que c'est le même. Ce champ ne sort jamais du serveur (retiré de la réponse publique).
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const BUCKET_SUIVI = 'tracking'

/** Nom du champ, dans l'objet JSON, du compte qui alimente la session. */
export const CHAMP_PROPRIETAIRE_SUIVI = 'artisan_user_id'

/**
 * Compte qui alimente une session déjà écrite ; null si la session n'existe pas, est illisible ou a été
 * écrite avant que ce champ n'existe (elle est alors reprise par le premier compte qui la met à jour).
 */
export async function proprietaireSessionSuivi(chemin: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_SUIVI).download(chemin)
  if (error || !data) {
    // Objet absent : session nouvelle. Tout autre échec est journalisé (sans le chemin).
    if (error && !/not found/i.test(error.message)) {
      logger.warn('[tracking] lecture de la session de suivi', { message: error.message })
    }
    return null
  }
  try {
    const session = JSON.parse(await data.text()) as Record<string, unknown>
    const proprietaire = session[CHAMP_PROPRIETAIRE_SUIVI]
    return typeof proprietaire === 'string' && proprietaire.length > 0 ? proprietaire : null
  } catch (e) {
    logger.warn('[tracking] session de suivi illisible', { message: e instanceof Error ? e.message : String(e) })
    return null
  }
}
