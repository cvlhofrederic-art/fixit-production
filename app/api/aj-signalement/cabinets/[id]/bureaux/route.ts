// app/api/aj-signalement/cabinets/[id]/bureaux/route.ts
//
// Bureaux d'un cabinet client (migration 20261119 ; accord du 17/11/2026 sur les cinq choix de la note des bureaux),
// SUPER ADMIN seul (choix 3 ; rôle ET liste d'e-mails, jamais la « vue en tant que » ; un gestionnaire reçoit 403) :
// GET  — bureaux du cabinet, ouverts et fermés, triés par nom, avec leurs gestionnaires ACTIFS et copropriétés ACTIVES
//        rattachés (ceux qui empêchent la fermeture). Jamais en cache.
// POST — création { nom } (rogné, 1 à 80 caractères, sans caractère de contrôle ; aucune adresse de contact en V1, choix
//        4 : clé inconnue → 400), par signalements_qr_enregistrer_bureau, en une transaction avec son journal
//        (cabinet.modifie, champs {bureaux}, détails { bureau: cree, bureauId } : jamais le nom) ; p_acteur = la session,
//        jamais le corps. Nom déjà porté dans le cabinet (casse et espaces, bureaux fermés compris) → 409 nom_pris ;
//        100 bureaux → 409 plafond_bureaux. 201 { bureau }.
// Cabinet inconnu ou id hors format → 404 ; migration absente → 503 base_absente (journalisé une fois). Aucun détail
// interne au navigateur.

import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { bureauQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { controlerAccesQr, estUuid, lireCabinetQr, reponseErreur, reponseErreurSqlQr, reponseInvalide, reponsePriveeQr } from '@/lib/aj-signalement/serveur'
import { lireBureauxCompletsQr, reponseErreurBureauxQr } from '@/lib/aj-signalement/serveur-bureaux'

const CONTEXTE = '[AJ SIGNALEMENT]'

type Contexte = { params: Promise<{ id: string }> }

/** Le cabinet existe-t-il ? 404 sinon ; erreur de la base → sa réponse. */
async function cabinetExistant(id: string): Promise<Response | null> {
  if (!estUuid(id)) return reponseErreur('introuvable', 404)
  const existant = await lireCabinetQr({ id })
  if (!existant.ok) return reponseErreurSqlQr(existant.erreur, 'lecture du cabinet', { cabinet: id })
  return existant.cabinet ? null : reponseErreur('introuvable', 404)
}

export async function GET(request: NextRequest, { params }: Contexte) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_bureaux_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_bureaux_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const { id } = await params
    const absent = await cabinetExistant(id)
    if (absent) return absent
    const lecture = await lireBureauxCompletsQr({ cabinet: id })
    if (!lecture.ok) return reponseErreurBureauxQr(lecture.erreur, 'lecture des bureaux', { cabinet: id })
    return reponsePriveeQr({ bureaux: lecture.valeur })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} liste des bureaux`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}

export async function POST(request: NextRequest, { params }: Contexte) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_bureau_post_${ip}`, 20, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    // Un cabinet d'une vingtaine de bureaux se saisit en une fois : 60 créations par heure et par compte.
    if (!(await checkRateLimit(`qr_bureau_post_${controle.user.id}`, 60, 3_600_000))) return rateLimitResponse()

    const { id } = await params
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(bureauQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const absent = await cabinetExistant(id)
    if (absent) return absent

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_enregistrer_bureau', {
      p_cabinet: id, p_bureau: null, p_nom: validation.data.nom, p_acteur: controle.user.id,
    })
    if (error) return reponseErreurBureauxQr(error, 'création d’un bureau', { cabinet: id })
    const bureauId = (data as { id?: unknown } | null)?.id
    if (typeof bureauId !== 'string') return reponseErreur('a_reverifier', 409)
    const relu = await lireBureauxCompletsQr({ ids: [bureauId] })
    if (!relu.ok) return reponseErreurBureauxQr(relu.erreur, 'relecture du bureau', { cabinet: id, bureau: bureauId })
    const bureau = relu.valeur[0]
    if (!bureau) return reponseErreur('a_reverifier', 409)
    return reponsePriveeQr({ bureau }, 201)
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} création d’un bureau`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
