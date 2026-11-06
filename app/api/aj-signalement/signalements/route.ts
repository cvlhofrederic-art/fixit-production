// app/api/aj-signalement/signalements/route.ts
//
// POST — dépôt public d'un signalement après scan du QR code d'une copropriété (AJ Signalement).
// Sans session : la copropriété est désignée par son jeton (32 hexadécimaux, tiré par la base) ; le corps
// est validé par signalementQrSchema (coordonnées obligatoires : prénom, nom, téléphone, e-mail, étage,
// numéro de lot). Le signalement est enregistré dans signalements_qr puis envoyé par e-mail aux
// destinataires de la copropriété (sinon ADMIN_EMAIL) ; l'état de l'envoi est conservé sur la ligne.
// Limites : 5 dépôts par minute et par adresse IP, 30 par 10 minutes et par copropriété (QR code public).
// Codes : 400 invalide · 404 introuvable (jeton inconnu ou désactivé) · 429 · 503 base_absente (migration
// 20261104 non appliquée) · 500 serveur. Aucun lien avec les tables du logiciel Syndic.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { signalementQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { numeroSignalementQr } from '@/lib/aj-signalement/types'
import {
  TABLE_SIGNALEMENTS_QR, destinatairesSignalement, lireCoproprieteParJeton, reponseErreur, reponseErreurBase,
  signalementDepuisLigne,
} from '@/lib/aj-signalement/serveur'
import { envoyerEmailSignalementQr } from '@/lib/aj-signalement/email'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_signalement_post_${ip}`, 5, 60_000))) return rateLimitResponse()

    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(signalementQrSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'invalide', details: validation.error }, { status: 400 })
    const saisie = validation.data

    const lecture = await lireCoproprieteParJeton(saisie.jeton)
    if (!lecture.ok) return reponseErreur(lecture.code, lecture.code === 'base_absente' ? 503 : 500)
    const copropriete = lecture.copropriete
    if (!copropriete) return reponseErreur('introuvable', 404)
    if (!(await checkRateLimit(`qr_signalement_copro_${copropriete.id}`, 30, 600_000))) return rateLimitResponse()

    const ligne = {
      copropriete_id: copropriete.id,
      prenom: saisie.prenom,
      nom: saisie.nom,
      telephone: saisie.telephone,
      // En minuscules : c'est l'adresse de réponse de l'e-mail et une clé de recherche possible.
      email: saisie.email.trim().toLowerCase(),
      batiment: saisie.batiment,
      etage: saisie.etage,
      num_lot: saisie.numLot,
      est_partie_commune: saisie.estPartieCommune,
      zone_signalee: saisie.estPartieCommune ? saisie.zoneSignalee : '',
      type_intervention: saisie.typeIntervention,
      description: saisie.description,
      priorite: saisie.priorite,
      statut: 'en_attente',
      langue: saisie.langue,
    }
    const { data, error } = await supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).insert(ligne).select('id, created_at, updated_at').single()
    if (error || !data) {
      logger.error(`${CONTEXTE} insertion refusée`, { code: error?.code, message: error?.message, copropriete: copropriete.id })
      return reponseErreurBase(error)
    }
    const signalement = signalementDepuisLigne(
      { ...ligne, id: data.id, email_envoye_le: null, email_erreur: null, created_at: data.created_at, updated_at: data.updated_at ?? data.created_at },
      copropriete.nom ?? '',
    )

    // E-mail aux destinataires : l'échec n'annule pas le dépôt (le tableau de bord le montre, email_erreur le garde).
    const destinataires = destinatairesSignalement(copropriete)
    let emailEnvoyeLe: string | null = null
    let emailErreur: string | null = null
    if (destinataires.length === 0) {
      emailErreur = 'aucun destinataire configuré'
      logger.error(`${CONTEXTE} aucun destinataire : ni e-mails de la copropriété, ni ADMIN_EMAIL`, { copropriete: copropriete.id })
    } else {
      const envoi = await envoyerEmailSignalementQr({
        destinataires, signalement, copropriete: { nom: copropriete.nom ?? '', adresse: copropriete.adresse ?? '' },
        origine: process.env.NEXT_PUBLIC_APP_URL || undefined,
      })
      if (envoi.success) {
        emailEnvoyeLe = new Date().toISOString()
      } else {
        emailErreur = (envoi.error || 'envoi impossible').slice(0, 500)
        logger.error(`${CONTEXTE} e-mail non envoyé`, { erreur: envoi.error, signalement: data.id })
      }
    }
    const { error: erreurMaj } = await supabaseAdmin
      .from(TABLE_SIGNALEMENTS_QR)
      .update({ email_envoye_le: emailEnvoyeLe, email_erreur: emailErreur })
      .eq('id', data.id)
    if (erreurMaj) logger.warn(`${CONTEXTE} état de l’e-mail non enregistré`, { code: erreurMaj.code, message: erreurMaj.message })

    return NextResponse.json({
      signalement: { id: data.id, numero: numeroSignalementQr(data.id), creeLe: data.created_at, emailEnvoye: emailEnvoyeLe !== null },
    })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} dépôt`, { message: e instanceof Error ? e.message : String(e) }, e)
    return reponseErreur('serveur', 500)
  }
}
