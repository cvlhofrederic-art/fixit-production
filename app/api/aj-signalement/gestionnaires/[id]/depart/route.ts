// app/api/aj-signalement/gestionnaires/[id]/depart/route.ts
//
// POST (P1-R14) — départ d'un gestionnaire (super admin) : une succession pour CHACUNE de ses copropriétés (un
// successeur actif du même cabinet, ou « sans gestionnaire » : versGestionnaireId null), par
// signalements_qr_desactiver_gestionnaire (successeurs posés avant le retrait ; fiche désactivée ; liens non ouverts
// caducs ; son adresse retirée de TOUTES les adresses saisies, RG-06 bis-2 ; journal sans valeur). Une succession
// manquante, en trop ou vers une fiche d'un autre cabinet → 409 a_reverifier.
// PR 2, lot 6 (SPEC § 2.6) : la fiche désactivée coupe déjà tout accès (403 acces_retire à la requête suivante) ; puis,
// si un compte VitFix est relié à la fiche (migration 20261112), il est banni et la date de blocage journalisée (rôle
// gardé) : 200 { …, connexionBloquee: true }. Bannissement impossible : 207 { …, error: 'connexion_non_bloquee' } (le
// départ est acquis ; « Bloquer la connexion », POST …/bloquer, le relance). Fiche sans compte, ou migration 20261112
// absente : la réponse de la PR 1, sans aucun appel à l'authentification.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { departGestionnaireQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { controlerAccesQr, estUuid, reponseErreur, reponseErreurSqlQr, reponseInvalide } from '@/lib/aj-signalement/serveur'
import { lireFicheQr } from '@/lib/aj-signalement/serveur-gestion'
import { bloquerConnexionQr, lireCompteFicheQr } from '@/lib/aj-signalement/serveur-compte'

const entier = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_depart_${ip}`, 20, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_depart_${controle.user.id}`, 20, 3_600_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(departGestionnaireQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)

    const fiche = await lireFicheQr(id)
    if (!fiche.ok) return reponseErreurSqlQr(fiche.erreur, 'lecture du gestionnaire', { gestionnaire: id })
    if (!fiche.valeur) return reponseErreur('introuvable', 404)

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_desactiver_gestionnaire', {
      p_id: id, p_successions: validation.data.successions, p_acteur: controle.user.id,
    })
    if (error) return reponseErreurSqlQr(error, 'départ d’un gestionnaire', { gestionnaire: id })
    const r = (data ?? {}) as Record<string, unknown>
    const bilan = {
      deplacees: entier(r.deplacees), laisseesSansGestionnaire: entier(r.laisseesSansGestionnaire), adressesRetirees: entier(r.adressesRetirees),
    }

    // PR 2 : le compte relié est banni APRÈS la désactivation (qui suffit à couper l'accès).
    const compte = await lireCompteFicheQr(id, 'départ : compte de la fiche')
    if (compte.etat === 'migration_absente' || (compte.etat === 'lu' && !compte.userId)) return NextResponse.json(bilan)
    const bloquee = compte.etat === 'lu' && compte.userId !== null && await bloquerConnexionQr({
      gestionnaireId: id, cabinetId: fiche.valeur.cabinet_id, userId: compte.userId, connexionBloqueeLe: compte.connexionBloqueeLe,
      acteurId: controle.user.id,
    })
    return bloquee
      ? NextResponse.json({ ...bilan, connexionBloquee: true })
      : NextResponse.json({ ...bilan, error: 'connexion_non_bloquee' }, { status: 207 })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] départ d’un gestionnaire', { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
