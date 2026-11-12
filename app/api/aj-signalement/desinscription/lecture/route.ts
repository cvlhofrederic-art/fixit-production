// app/api/aj-signalement/desinscription/lecture/route.ts
//
// POST (D-P1, PUBLIQUE, cahier PR 3 § 4.1, § 7.5, § 8.1) — lecture d'un lien de désinscription, SANS AUCUN EFFET (un
// antivirus ou une messagerie qui ouvre le lien ne désinscrit personne). La page vitfix.io/<identifiant>/desinscription/
// envoie { jeton, identifiant } (jeton lu dans le fragment puis effacé de l'adresse) et affiche l'état :
//   - valide  : copropriété, cabinet, état de l'opposition ; jeton de PAGE : adresse masquée et « levable » (le lien qui
//               a servi, dans les 24 h) ; jeton un clic : ni l'un ni l'autre (il ne permet que de s'opposer) ;
//   - expire  : plus d'un an, ou clé précédente → repli par la saisie de l'adresse (D-P4) ;
//   - ancien  : signature bonne, diffusion purgée (3 ans) → contact et politique du cabinet du chemin ;
//   - inconnu : signature fausse, clé absente, autre cabinet, migration absente → contact du cabinet du chemin s'il en a un.
// Aucune date, jamais (un message transféré ne doit pas dire quand la personne s'est opposée). 20 par minute et par IP.
// Jamais en cache.

import { type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { lienDesinscriptionQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import {
  corpsLectureDesinscriptionQr, erreurDesinscriptionQr, invalideDesinscriptionQr, limiteDesinscriptionQr,
  lireCabinetDesinscriptionQr, lireLienDesinscriptionQr, reponseDesinscriptionQr,
} from '@/lib/aj-signalement/serveur-desinscription'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_desinscription_lecture_${ip}`, 20, 60_000))) return limiteDesinscriptionQr()
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(lienDesinscriptionQrSchema, body)
    if (!validation.success) return invalideDesinscriptionQr(validation.error)
    const { jeton, identifiant } = validation.data

    const lien = await lireLienDesinscriptionQr(jeton, identifiant, ['page', 'un_clic'])
    if (lien.etat === 'erreur') return erreurDesinscriptionQr('serveur', 500)
    // Le cabinet du chemin n'est lu que pour les pages qui le montrent (ancien, non valable).
    const cabinet = lien.etat === 'ancien' || lien.etat === 'inconnu' ? await lireCabinetDesinscriptionQr(identifiant) : null
    return reponseDesinscriptionQr(corpsLectureDesinscriptionQr(lien, cabinet))
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] lecture d’un lien de désinscription', { message: e instanceof Error ? e.name : 'inconnue' })
    return erreurDesinscriptionQr('serveur', 500)
  }
}
