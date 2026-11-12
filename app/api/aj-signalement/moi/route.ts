// app/api/aj-signalement/moi/route.ts
//
// GET (P2-R4, PR 2) — profil de la session dans AJ Signalement, lu par l'espace au chargement :
//   - super admin → { profil: 'super_admin' } ;
//   - gestionnaire connecté → { profil: 'gestionnaire', nom, cabinet: { identifiant, nom, domaines } } : SON cabinet
//     (celui de sa fiche, relue à chaque appel), et ses domaines e-mail (adresses qu'il peut ajouter aux destinataires).
// Jamais d'identifiant (ni de compte, ni de fiche, ni de cabinet). 401 sans session · 403 interdit (autre compte) ou
// acces_retire (fiche désactivée, bloquée, absente) · 503 base_absente (migration à appliquer). Jamais en cache.

import { type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  controlerAccesQr, lireCabinetQr, lireDomainesCabinetQr, reponseErreur, reponseLectureGestionnaireQr, reponsePriveeQr,
} from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_moi_${ip}`, 120, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin', 'gestionnaire'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_moi_${controle.user.id}`, 120, 60_000))) return rateLimitResponse()

    const profil = controle.profil
    if (profil.type === 'super_admin') return reponsePriveeQr({ profil: 'super_admin' })

    const [cabinet, domaines] = await Promise.all([lireCabinetQr({ id: profil.cabinetId }), lireDomainesCabinetQr(profil.cabinetId)])
    if (!cabinet.ok) return reponseLectureGestionnaireQr(cabinet.erreur, 'cabinet d’un gestionnaire', { gestionnaire: profil.gestionnaireId })
    if (!domaines.ok) return reponseLectureGestionnaireQr(domaines.erreur, 'domaines d’un gestionnaire', { gestionnaire: profil.gestionnaireId })
    if (!cabinet.cabinet) {
      // Impossible tant que la contrainte ON DELETE RESTRICT de la fiche tient : signalé, jamais détaillé au navigateur.
      logger.error(`${CONTEXTE} cabinet de la fiche introuvable`, { gestionnaire: profil.gestionnaireId })
      return reponseErreur('serveur', 500)
    }
    return reponsePriveeQr({
      profil: 'gestionnaire',
      nom: profil.nom,
      cabinet: {
        identifiant: cabinet.cabinet.identifiant ?? '',
        nom: cabinet.cabinet.nom ?? '',
        domaines: [...domaines.valeur].sort((a, b) => a.localeCompare(b)),
      },
    })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} profil de la session`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
