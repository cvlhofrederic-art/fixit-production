// app/api/aj-signalement/desinscription/reprendre/route.ts
//
// POST (D-P3, PUBLIQUE, cahier PR 3 § 4.1, § 7.5, § 8.1 ; décision H5 de Hugo) — « Recevoir à nouveau ces informations ».
// Jeton de PAGE seulement (un jeton un clic, qui circule en clair dans les journaux et chez le service d'e-mail, ne
// permet jamais de réinscrire : 404 sans aucune lecture), lien NON expiré ; puis signalements_qr_diffusion_lever, qui ne
// lève que l'opposition ACTIVE faite avec CE lien (page ou un clic du même message) dans les 24 h, sans écriture sinon
// (une opposition plainte, demande au cabinet ou repli par l'adresse ne se lève jamais par un lien) → 409 non_levable.
// 5 par minute et par IP, puis 10 par heure et par lien. Jamais en cache.

import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { lienDesinscriptionQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import {
  erreurDesinscriptionQr, erreurSqlDesinscriptionQr, invalideDesinscriptionQr, limiteDesinscriptionQr,
  lireLienDesinscriptionQr, reponseDesinscriptionQr,
} from '@/lib/aj-signalement/serveur-desinscription'

const UNE_HEURE_MS = 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_desinscription_reprendre_ip_${ip}`, 5, 60_000))) return limiteDesinscriptionQr()
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(lienDesinscriptionQrSchema, body)
    if (!validation.success) return invalideDesinscriptionQr(validation.error)
    const { jeton, identifiant } = validation.data

    // Signature de PAGE seulement : un jeton un clic donne « inconnu », sans lire la base.
    const lien = await lireLienDesinscriptionQr(jeton, identifiant, ['page'])
    if (lien.etat === 'erreur') return erreurDesinscriptionQr('serveur', 500)
    if (lien.etat === 'inconnu' || lien.etat === 'ancien') return erreurDesinscriptionQr('lien_invalide', 404)
    if (lien.etat === 'expire') return erreurDesinscriptionQr('lien_expire', 410)
    if (!(await checkRateLimit(`qr_desinscription_reprendre_${lien.destinataireId}`, 10, UNE_HEURE_MS))) return limiteDesinscriptionQr()

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_diffusion_lever', { p_destinataire: lien.destinataireId })
    if (error) return erreurSqlDesinscriptionQr(error, 'levée d’une opposition (Recevoir à nouveau)')
    if (data !== true) return erreurDesinscriptionQr('non_levable', 409)
    return reponseDesinscriptionQr({ oppose: false })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] levée d’une opposition (Recevoir à nouveau)', { message: e instanceof Error ? e.name : 'inconnue' })
    return erreurDesinscriptionQr('serveur', 500)
  }
}
