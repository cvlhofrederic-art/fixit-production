// app/api/aj-signalement/coproprietes/[id]/diffusions/valeurs/route.ts
//
// GET (D-R1, cahier PR 3 § 4.1, § 3.6, § 7.2) — ce que le formulaire « Diffuser un message » propose pour une
// copropriété : bâtiments et étages RÉELLEMENT présents dans les signalements, regroupés (clé, libellé écrit dans
// l'e-mail ou à saisir, variantes), déclarants sans bâtiment, portée présélectionnée (« Un bâtiment » dès deux groupes),
// diffusion possible ou raison, compteur du mois (décision de Hugo : aucun plafond, le compteur est affiché), nombre de
// déclarants jamais annoncés (bouton « Annoncer la diffusion », H1 = option C). Aucune adresse dans la réponse (les
// variantes brutes qui portent un « @ » sont retirées). Super admin seul en PR 3 (partie gestionnaire H11 ensuite).
// Migration 20261113 absente → 503 base_absente. Jamais en cache.

import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { corpsVideQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { valeursPourEcranDiffusionQr } from '@/lib/aj-signalement/diffusion-formes'
import {
  controlerAccesQr, estUuid, parametresQr, reponseErreur, reponseErreurDiffusionQr, reponseInvalide, reponsePriveeQr,
} from '@/lib/aj-signalement/serveur'
import {
  PROFILS_DIFFUSION_QR, couplesDiffusionQr, lireContexteDiffusionQr, moisDiffusionQr, raisonInactiveDiffusionQr,
} from '@/lib/aj-signalement/serveur-diffusion'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_diffusion_valeurs_ip_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: PROFILS_DIFFUSION_QR })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_diffusion_valeurs_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const validation = validateBody(corpsVideQrSchema, parametresQr(request))
    if (!validation.success) return reponseInvalide(validation.error)

    const contexte = await lireContexteDiffusionQr(id)
    if (!contexte.ok) return reponseErreurDiffusionQr(contexte.erreur, 'valeurs de diffusion', { copropriete: id })
    if (!contexte.valeur) return reponseErreur('introuvable', 404)
    const { copropriete, cabinet } = contexte.valeur
    const langue = cabinet?.langue ?? 'fr'

    const [couples, mois, raison, annonce] = await Promise.all([
      couplesDiffusionQr(id),
      moisDiffusionQr(id),
      raisonInactiveDiffusionQr(id),
      supabaseAdmin.rpc('signalements_qr_diffusion_apercu', {
        p_copropriete: id, p_portee: 'copropriete', p_batiments: null, p_etages: null, p_signalement: null, p_annonce: true,
      }),
    ])
    if (!couples.ok) return reponseErreurDiffusionQr(couples.erreur, 'valeurs de diffusion', { copropriete: id })
    if (!mois.ok) return reponseErreurDiffusionQr(mois.erreur, 'compteur du mois', { copropriete: id })
    if (!raison.ok) return reponseErreurDiffusionQr(raison.erreur, 'diffusion possible', { copropriete: id })
    if (annonce.error) return reponseErreurDiffusionQr(annonce.error, 'déclarants à annoncer', { copropriete: id })
    const ligneAnnonce = (Array.isArray(annonce.data) ? annonce.data[0] : null) as { nb_destinataires?: unknown } | null

    const valeurs = valeursPourEcranDiffusionQr(couples.valeur, copropriete.batiments, langue, cabinet?.telephones ?? [])
    return reponsePriveeQr({
      possible: raison.valeur === null,
      raison: raison.valeur,
      langue,
      batiments: valeurs.batiments,
      sansBatiment: valeurs.sansBatiment,
      porteeParDefaut: valeurs.porteeParDefaut,
      ceMois: mois.valeur,
      nbNonAnnonces: typeof ligneAnnonce?.nb_destinataires === 'number' ? ligneAnnonce.nb_destinataires : 0,
    })
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] valeurs de diffusion', { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
