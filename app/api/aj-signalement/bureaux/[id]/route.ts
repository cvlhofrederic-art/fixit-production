// app/api/aj-signalement/bureaux/[id]/route.ts
//
// PATCH — modification d'un bureau d'un cabinet client (migration 20261119), SUPER ADMIN seul (choix 3), une seule action
// par appel :
//   { nom }             renommer (mêmes règles qu'à la création ; nom déjà porté dans le cabinet → 409 nom_pris), par
//                       signalements_qr_enregistrer_bureau ;
//   { fermer: true }    fermer : aucun nouveau rattachement, ce qui y est rattaché le reste ; un bureau auquel est encore
//                       rattaché un gestionnaire actif ou une copropriété active ne se ferme pas → 409 bureau_utilise
//                       (réponse proposée, à valider) ;
//   { fermer: false }   rouvrir ;
//   par signalements_qr_fermer_bureau pour les deux dernières. Chacune en une transaction avec son journal (cabinet.modifie,
//   champs {bureaux}, détails { bureau: renomme | ferme | rouvert, bureauId }) ; p_acteur = la session, jamais le corps.
//   Un bureau ne change jamais de cabinet (clé inconnue → 400). Déjà dans l'état demandé : 200, modifie faux.
// 200 { bureau, modifie } ; bureau inconnu ou id hors format → 404 ; supprimé entre-temps → 409 a_reverifier ; migration
// absente → 503 base_absente. Aucun détail interne au navigateur.

import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { modificationBureauQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { controlerAccesQr, estUuid, reponseErreur, reponseInvalide, reponsePriveeQr } from '@/lib/aj-signalement/serveur'
import { lireBureauQr, lireBureauxCompletsQr, reponseErreurBureauxQr } from '@/lib/aj-signalement/serveur-bureaux'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_bureau_patch_${ip}`, 30, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_bureau_patch_${controle.user.id}`, 30, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(modificationBureauQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const action = validation.data

    const existant = await lireBureauQr(id)
    if (!existant.ok) return reponseErreurBureauxQr(existant.erreur, 'lecture du bureau', { bureau: id })
    if (!existant.valeur) return reponseErreur('introuvable', 404)
    const ids = { bureau: id, cabinet: existant.valeur.cabinet_id }

    const { data, error } = 'nom' in action
      ? await supabaseAdmin.rpc('signalements_qr_enregistrer_bureau', {
        p_cabinet: existant.valeur.cabinet_id, p_bureau: id, p_nom: action.nom, p_acteur: controle.user.id,
      })
      : await supabaseAdmin.rpc('signalements_qr_fermer_bureau', { p_bureau: id, p_fermer: action.fermer, p_acteur: controle.user.id })
    if (error) return reponseErreurBureauxQr(error, 'nom' in action ? 'renommage d’un bureau' : 'fermeture ou réouverture d’un bureau', ids)

    const relu = await lireBureauxCompletsQr({ ids: [id] })
    if (!relu.ok) return reponseErreurBureauxQr(relu.erreur, 'relecture du bureau', ids)
    const bureau = relu.valeur[0]
    if (!bureau) return reponseErreur('a_reverifier', 409)
    return reponsePriveeQr({ bureau, modifie: (data as { modifie?: unknown } | null)?.modifie === true })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} modification d’un bureau`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
