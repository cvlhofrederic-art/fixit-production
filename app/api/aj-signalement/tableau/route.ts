// app/api/aj-signalement/tableau/route.ts
//
// GET — tableau de bord « AJ Signalement » : les copropriétés dotées d'un QR code, avec leurs compteurs et leurs champs
// de gestion (cabinet, gestionnaires, « à tous »…), et les signalements reçus les plus récents (coordonnées complètes
// des déclarants). Enveloppe { tableau: { coproprietes, signalements } } conservée (lue par chargerTableauQr) ; champs
// seulement ajoutés (P1-R1, 11/11/2026).
//   Super admin :
//     ?cabinet=<id>       : les copropriétés de ce cabinet client ;
//     ?gestionnaire=<id>  : la page de suivi de ce gestionnaire, vue par le super admin (sa portée : attributions ∪
//                           « à tous » de son cabinet), 100 signalements au plus ; fiche inconnue → 404.
//     ?bureau=<id>        : bureaux (migration 20261119) — les copropriétés de ce bureau et leurs signalements ; bureau
//                           inconnu → 404 ; migration absente → 503 base_absente. Le bureau n'est qu'un filtre (choix 5).
//     Chaque copropriété porte son bureau quand elle en a un (vue du super admin seulement).
//   Gestionnaire connecté (PR 2) : SA portée seulement (copropriétés de son cabinet attribuées ou « à tous », 500
//     signalements les plus récents), réponse minimisée (lib/aj-signalement/minimisation.ts) ; ?cabinet=, ?gestionnaire=
//     et ?bureau= lui sont refusés (403 interdit). Sa réponse ne change pas avec les bureaux (aucune clé nouvelle).
// Espace AJ Signalement (cookies de session ; jeton Bearer accepté). 401 sans session · 403 pour tout autre compte
// (« vue en tant que » comprise) ou accès retiré (acces_retire) · 400 paramètre inconnu · 503 base_absente.

import { type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { tableauQrQuerySchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import {
  TABLE_COPROPRIETES_QR, controlerAccesQr, lireParValeursQr, lireTableauGestionnaireQr, lireTableauQr, parametresQr, reponseErreur,
  reponseInvalide, reponseLectureGestionnaireQr, reponsePriveeQr,
} from '@/lib/aj-signalement/serveur'
import { supabaseAdmin } from '@/lib/supabase-server'
import { avecBureauxCoproprietesQr, lireBureauQr, reponseErreurBureauxQr } from '@/lib/aj-signalement/serveur-bureaux'

const STATUTS_LECTURE = { base_absente: 503, introuvable: 404, serveur: 500 } as const

/**
 * Filtre ?bureau= (super admin) : le cabinet du bureau et ses copropriétés ; null : bureau inconnu (404) ; réponse : la
 * base a refusé (structure absente → 503 base_absente, autre → 500).
 */
async function coproprietesDuBureau(bureauId: string): Promise<{ cabinet: string; ids: string[] } | null | Response> {
  const bureau = await lireBureauQr(bureauId)
  if (!bureau.ok) return reponseErreurBureauxQr(bureau.erreur, 'filtre du tableau par bureau', { bureau: bureauId })
  if (!bureau.valeur) return null
  const copros = await lireParValeursQr<{ id: string }>([bureauId], (lot) =>
    supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('id').in('bureau_id', lot).order('id', { ascending: true }))
  if (!copros.ok) return reponseErreurBureauxQr(copros.erreur, 'filtre du tableau par bureau', { bureau: bureauId })
  return { cabinet: bureau.valeur.cabinet_id, ids: copros.valeur.map((c) => c.id) }
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_tableau_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin', 'gestionnaire'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_tableau_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const validation = validateBody(tableauQrQuerySchema, parametresQr(request))
    if (!validation.success) return reponseInvalide(validation.error)

    if (controle.profil.type === 'gestionnaire') {
      // Vues d'un cabinet, d'un collègue ou d'un bureau : réservées au super admin, même vers son propre cabinet.
      if (validation.data.cabinet || validation.data.gestionnaire || validation.data.bureau) return reponseErreur('interdit', 403)
      const vue = await lireTableauGestionnaireQr(controle.profil)
      if (!vue.ok) return reponseLectureGestionnaireQr(vue.erreur, 'tableau d’un gestionnaire', { gestionnaire: controle.profil.gestionnaireId })
      return reponsePriveeQr({ tableau: vue.tableau })
    }

    const { cabinet, gestionnaire, bureau } = validation.data
    let restriction: { cabinet: string; ids: string[] } | undefined
    if (bureau) {
      const duBureau = await coproprietesDuBureau(bureau)
      if (duBureau instanceof Response) return duBureau
      if (!duBureau) return reponseErreur('introuvable', 404)
      restriction = duBureau
    }
    // ?cabinet= d'un autre cabinet que celui du bureau : la restriction aux copropriétés du bureau ne laisse rien.
    const cabinetLu = cabinet ?? restriction?.cabinet
    const lecture = await lireTableauQr({
      ...(cabinetLu ? { cabinet: cabinetLu } : {}),
      ...(gestionnaire ? { gestionnaire } : {}),
      ...(restriction ? { coproprietes: restriction.ids } : {}),
    })
    if (!lecture.ok) return reponseErreur(lecture.code, STATUTS_LECTURE[lecture.code])
    // Vue du super admin : chaque copropriété porte son bureau quand elle en a un (migration 20261119).
    const coproprietes = await avecBureauxCoproprietesQr(lecture.tableau.coproprietes)
    return reponsePriveeQr({ tableau: { ...lecture.tableau, coproprietes } })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] tableau', { message: e instanceof Error ? e.message : String(e) }, e)
    return reponseErreur('serveur', 500)
  }
}
