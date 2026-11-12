// app/api/aj-signalement/coproprietes/[id]/diffusions/apercu/route.ts
//
// POST (D-R2, cahier PR 3 § 4.1, § 3.6, § 7.2) — aperçu d'une diffusion, AUCUNE écriture : nombre exact de destinataires
// (même fonction SQL que l'envoi), nombre exclu par opposition, libellé du périmètre tel qu'il sera écrit dans l'e-mail
// (calculé ici : clé → valeurs brutes exactes, libellé de la fiche ou d'une variante contrôlée, sinon saisi par l'auteur
// et contrôlé), diffusion possible ou raison, et l'instant de l'aperçu, que l'envoi repasse (les signalements déposés
// ensuite n'entrent pas dans le périmètre affiché). Clé inconnue → 409 perimetre_change ; signalement d'une autre
// copropriété → 404 ; libellé saisi refusé → 400 texte_refuse { champ, motif }. Aucune adresse dans la réponse.
// Super admin seul en PR 3. Migration 20261113 absente → 503 base_absente. Jamais en cache.

import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { apercuDiffusionQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { resoudrePerimetreDiffusionQr } from '@/lib/aj-signalement/diffusion-formes'
import type { CoupleValeursQr } from '@/lib/aj-signalement/diffusion-valeurs'
import {
  controlerAccesQr, estUuid, reponseErreur, reponseErreurDiffusionQr, reponseInvalide, reponsePriveeQr,
} from '@/lib/aj-signalement/serveur'
import {
  PROFILS_DIFFUSION_QR, couplesDiffusionQr, lireContexteDiffusionQr, signalementDeLaCoproprieteQr,
} from '@/lib/aj-signalement/serveur-diffusion'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_diffusion_apercu_ip_${ip}`, 120, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: PROFILS_DIFFUSION_QR })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_diffusion_apercu_${controle.user.id}`, 120, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(apercuDiffusionQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const a = validation.data

    const contexte = await lireContexteDiffusionQr(id)
    if (!contexte.ok) return reponseErreurDiffusionQr(contexte.erreur, 'aperçu de diffusion', { copropriete: id })
    if (!contexte.valeur) return reponseErreur('introuvable', 404)
    const { copropriete, cabinet } = contexte.valeur

    if (a.perimetre.portee === 'signalement') {
      const lien = await signalementDeLaCoproprieteQr(a.perimetre.signalementId, id)
      if (!lien.ok) return reponseErreurDiffusionQr(lien.erreur, 'aperçu de diffusion', { copropriete: id })
      if (!lien.valeur) return reponseErreur('introuvable', 404)
    }
    let couples: CoupleValeursQr[] = []
    if (a.perimetre.portee === 'batiment' || a.perimetre.portee === 'etage') {
      const lus = await couplesDiffusionQr(id)
      if (!lus.ok) return reponseErreurDiffusionQr(lus.erreur, 'aperçu de diffusion', { copropriete: id })
      couples = lus.valeur
    }
    const perimetre = resoudrePerimetreDiffusionQr({
      perimetre: a.perimetre, couples, batimentsFiche: copropriete.batiments, langue: cabinet?.langue ?? 'fr',
      telephonesAutorises: cabinet?.telephones ?? [], libelleBatimentSaisi: a.libelleBatimentSaisi, libelleEtageSaisi: a.libelleEtageSaisi,
    })
    if (!perimetre.ok) {
      if (perimetre.code === 'perimetre_change') return reponseErreur('perimetre_change', 409)
      return reponsePriveeQr({ error: 'texte_refuse', champ: perimetre.champ, motif: perimetre.motif, ...(perimetre.conseil ? { conseil: perimetre.conseil } : {}) }, 400)
    }

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_diffusion_apercu', {
      p_copropriete: id, p_portee: perimetre.sql.p_portee, p_batiments: perimetre.sql.p_batiments, p_etages: perimetre.sql.p_etages,
      p_signalement: perimetre.sql.p_signalement, p_annonce: a.annonce === true,
    })
    if (error) return reponseErreurDiffusionQr(error, 'aperçu de diffusion', { copropriete: id })
    const ligne = (Array.isArray(data) ? data[0] : null) as Record<string, unknown> | null
    if (!ligne) {
      logger.error('[AJ SIGNALEMENT] aperçu de diffusion : aucune ligne rendue', { copropriete: id })
      return reponseErreur('serveur', 500)
    }
    return reponsePriveeQr({
      nbDestinataires: Number(ligne.nb_destinataires ?? 0),
      nbExclusOpposition: Number(ligne.nb_exclus_opposition ?? 0),
      libellePerimetre: perimetre.libelle,
      libelleASaisir: perimetre.libelleASaisir,
      instant: typeof ligne.instant === 'string' ? ligne.instant : '',
      possible: ligne.possible === true,
      raison: typeof ligne.raison === 'string' ? ligne.raison : null,
    })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] aperçu de diffusion', { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
