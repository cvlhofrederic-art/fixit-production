// app/api/aj-signalement/desinscription/route.ts
//
// POST (D-P2, PUBLIQUE, cahier PR 3 § 4.1, § 7.5, § 8.1) — « Ne plus recevoir les informations sur cet immeuble », au clic
// sur la page (jamais à l'ouverture). Lien valable (jeton de page, ou jeton un clic ouvert dans un navigateur, D-P5b) →
// signalements_qr_diffusion_opposer(…, 'page') : effet immédiat, idempotent ; les lignes en attente de cette adresse dans
// cette copropriété sont annulées dans la même transaction. Réponse { oppose: true, levable } : « Recevoir à nouveau »
// n'est proposé qu'au jeton de PAGE, et seulement si la base le permet (le lien qui a servi, dans les 24 h). Aucune
// connexion, aucune justification, aucun e-mail de confirmation. Lien expiré → 410 lien_expire (la page passe au repli
// par l'adresse) ; signature fausse, autre cabinet, diffusion purgée → 404 lien_invalide. 5 par minute et par IP, puis
// 10 par heure et par lien (clé : identifiant du destinataire, jamais une adresse). Jamais en cache.

import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { lienDesinscriptionQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import {
  erreurDesinscriptionQr, erreurSqlDesinscriptionQr, invalideDesinscriptionQr, limiteDesinscriptionQr,
  lireLienDesinscriptionQr, relireLigneLienQr, reponseDesinscriptionQr,
} from '@/lib/aj-signalement/serveur-desinscription'

const UNE_HEURE_MS = 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_desinscription_opposer_ip_${ip}`, 5, 60_000))) return limiteDesinscriptionQr()
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(lienDesinscriptionQrSchema, body)
    if (!validation.success) return invalideDesinscriptionQr(validation.error)
    const { jeton, identifiant } = validation.data

    const lien = await lireLienDesinscriptionQr(jeton, identifiant, ['page', 'un_clic'])
    if (lien.etat === 'erreur') return erreurDesinscriptionQr('serveur', 500)
    if (lien.etat === 'inconnu' || lien.etat === 'ancien') return erreurDesinscriptionQr('lien_invalide', 404)
    if (lien.etat === 'expire') return erreurDesinscriptionQr('lien_expire', 410)
    if (!(await checkRateLimit(`qr_desinscription_opposer_${lien.destinataireId}`, 10, UNE_HEURE_MS))) return limiteDesinscriptionQr()

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_diffusion_opposer', {
      p_destinataire: lien.destinataireId, p_origine: 'page',
    })
    if (error) return erreurSqlDesinscriptionQr(error, 'opposition par la page de désinscription')
    // Destinataire disparu entre la lecture et l'opposition (purge) : même réponse qu'un lien purgé.
    if (data !== true) return erreurDesinscriptionQr('lien_invalide', 404)

    // « Recevoir à nouveau » : jeton de page seulement, et seulement si la base le permet (relu après l'opposition : une
    // opposition déjà faite par un autre moyen, plainte ou demande au cabinet, ne se lève jamais par ce lien).
    let levable = false
    if (lien.usage === 'page') {
      const relecture = await relireLigneLienQr(lien.destinataireId)
      levable = relecture.statut === 'lue' && relecture.ligne?.oppose === true && relecture.ligne.levable
    }
    return reponseDesinscriptionQr({ oppose: true, levable })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] opposition par la page de désinscription', { message: e instanceof Error ? e.name : 'inconnue' })
    return erreurDesinscriptionQr('serveur', 500)
  }
}
