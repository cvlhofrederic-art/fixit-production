// app/api/aj-signalement/gestionnaires/[id]/bloquer/route.ts
//
// POST (P2-R6, PR 2 lot 6) — « Bloquer la connexion » (super admin) : relance le bannissement du compte VitFix relié à
// une fiche DÉSACTIVÉE, quand il a échoué au départ (207 connexion_non_bloquee). Idempotente : déjà bloquée, le compte est
// rebanni sans nouvelle date ni nouvelle ligne de journal ; le rôle n'est jamais retiré. Sans corps (ou un objet vide).
// Fiche active : 409 fiche_active (faire d'abord le départ) ; sans compte relié : 409 a_reverifier ; bannissement refusé :
// 207 { error: 'connexion_non_bloquee' }. Limites : 20 par minute et par IP, 20 par heure et par compte. Sans la migration
// 20261112 : 503 base_absente (« migration à appliquer »), aucun appel à l'authentification.

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { controlerAccesQr, estUuid, reponseErreur, reponseErreurSqlQr, reponseInvalide } from '@/lib/aj-signalement/serveur'
import { lireFicheQr } from '@/lib/aj-signalement/serveur-gestion'
import { lireCorpsVideQr } from '@/lib/aj-signalement/serveur-acces'
import { bloquerConnexionQr, lireCompteFicheQr } from '@/lib/aj-signalement/serveur-compte'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_bloquer_${ip}`, 20, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_bloquer_${controle.user.id}`, 20, 3_600_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const corps = await lireCorpsVideQr(request)
    if (!corps.ok) return reponseInvalide(corps.details)

    const lue = await lireFicheQr(id)
    if (!lue.ok) return reponseErreurSqlQr(lue.erreur, 'blocage : fiche', { gestionnaire: id })
    if (!lue.valeur) return reponseErreur('introuvable', 404)
    if (lue.valeur.actif === true) return reponseErreur('fiche_active', 409)

    const compte = await lireCompteFicheQr(id, 'blocage : compte de la fiche')
    if (compte.etat === 'migration_absente') return reponseErreur('base_absente', 503)
    if (compte.etat === 'erreur') return reponseErreur('serveur', 500)
    if (!compte.userId) return reponseErreur('a_reverifier', 409)

    const bloquee = await bloquerConnexionQr({
      gestionnaireId: id, cabinetId: lue.valeur.cabinet_id, userId: compte.userId, connexionBloqueeLe: compte.connexionBloqueeLe,
      acteurId: controle.user.id,
    })
    return bloquee ? NextResponse.json({ connexionBloquee: true }) : NextResponse.json({ error: 'connexion_non_bloquee' }, { status: 207 })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} blocage de la connexion d’un gestionnaire`, { message: e instanceof Error ? e.name : 'inconnue' })
    return reponseErreur('serveur', 500)
  }
}
