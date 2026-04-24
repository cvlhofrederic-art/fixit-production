import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { validateBody, syndicMissionReportSchema } from '@/lib/validation'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { sanitizeSvg } from '@/lib/sanitize'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── Reçoit le rapport d'intervention artisan après ProofOfWork ───────────────
// Stocke dans syndic_emails_analysed + syndic_notifications + Supabase Storage

export async function POST(request: NextRequest) {
  // ── Auth : seuls les artisans assignés ou les membres du syndic ──
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`mission_report_${ip}`, 10, 60_000))) return rateLimitResponse()

  try {
    const _body = await request.json()
    const validation = validateBody(syndicMissionReportSchema, _body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const {
      syndic_id,
      artisan_id,
      artisan_nom,
      mission_id,
      immeuble,
      type_travaux,
      description,
      photos_before,  // array base64 strings
      photos_after,   // array base64 strings
      signature_svg: rawSignatureSvg,  // SVG string (sanitised below)
      gps_lat,
      gps_lng,
      started_at,
      completed_at,
      booking_id,
    } = validation.data

    // XSS : SVG rendu via dangerouslySetInnerHTML côté syndic — sanitisation obligatoire
    const signature_svg = rawSignatureSvg ? sanitizeSvg(rawSignatureSvg) : undefined

    // ── Ownership check : l'appelant doit être l'artisan ou un membre du syndic ──
    const isOwnerArtisan = user.id === artisan_id
    const isSyndic = isSyndicRole(user)
    if (!isOwnerArtisan && !isSyndic) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
    if (isSyndic) {
      const cabinetId = await resolveCabinetId(user, supabaseAdmin)
      if (cabinetId !== syndic_id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    }

    const now = new Date().toISOString()
    const reportId = `rapport_${Date.now()}`
    const photosCount = (photos_before?.length || 0) + (photos_after?.length || 0)

    // 1. Stocker les photos dans Supabase Storage (bucket mission-reports)
    const photoUrls: string[] = []
    const allPhotos = [
      ...(photos_before || []).map((p: string, i: number) => ({ data: p, label: `avant_${i + 1}` })),
      ...(photos_after || []).map((p: string, i: number) => ({ data: p, label: `apres_${i + 1}` })),
    ]

    for (const photo of allPhotos.slice(0, 10)) { // max 10 photos
      try {
        const base64Data = photo.data.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const fileName = `${syndic_id}/${reportId}/${photo.label}.jpg`

        const { data: uploadData } = await supabaseAdmin.storage
          .from('mission-reports')
          .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: true,
          })

        if (uploadData) {
          // Signed URL (7 jours) au lieu de public URL
          const { data: signedData } = await supabaseAdmin.storage
            .from('mission-reports')
            .createSignedUrl(fileName, 60 * 60 * 24 * 7)
          photoUrls.push(signedData?.signedUrl || supabaseAdmin.storage.from('mission-reports').getPublicUrl(fileName).data.publicUrl)
        }
      } catch (photoErr) {
        logger.warn('Photo upload error:', photoErr)
      }
    }

    // 2. Créer le rapport dans syndic_emails_analysed (type rapport)
    const resumeRapport = `Rapport ${type_travaux || 'intervention'} — ${immeuble || 'immeuble non précisé'} · ${photosCount} photos · ${artisan_nom || artisan_id}`

    const { error: reportError } = await supabaseAdmin
      .from('syndic_emails_analysed')
      .insert({
        syndic_id,
        gmail_message_id: `mission_report_${reportId}`,
        gmail_thread_id: mission_id || null,
        from_email: `artisan_${artisan_id}@vitfix.internal`,
        from_name: artisan_nom || 'Artisan Vitfix',
        subject: `Rapport d'intervention — ${type_travaux || 'Travaux'} · ${immeuble || ''}`,
        body_preview: `${description || ''}\n\n📍 GPS: ${gps_lat || '?'}, ${gps_lng || '?'}\n🕐 Début: ${started_at || '?'} · Fin: ${completed_at || now}\n📸 ${photosCount} photos · ${signature_svg ? '✅ Signé' : '⏳ Sans signature'}`,
        received_at: now,
        urgence: 'basse',
        type_demande: 'rapport',
        resume_ia: resumeRapport,
        immeuble_detecte: immeuble || null,
        locataire_detecte: null,
        actions_suggerees: JSON.stringify(['Archiver dans GED', 'Valider intervention', 'Facturer']),
        reponse_suggeree: null,
        statut: 'nouveau',
        note_interne: JSON.stringify({
          photos_urls: photoUrls,
          signature_svg: signature_svg || null,
          gps: { lat: gps_lat, lng: gps_lng },
          started_at,
          completed_at,
          booking_id,
          mission_id,
          artisan_id,
        }),
      })

    if (reportError) {
      logger.warn('Report insert error (table may not exist):', reportError.message)
    }

    // 3. Notifier le syndic via syndic_notifications
    const { error: notifError } = await supabaseAdmin
      .from('syndic_notifications')
      .insert({
        syndic_id,
        type: 'rapport_intervention',
        title: `📋 Rapport reçu — ${type_travaux || 'Intervention'}`,
        body: `${artisan_nom || 'Artisan'} a terminé l'intervention sur ${immeuble || 'votre immeuble'}. ${photosCount} photos disponibles.`,
        read: false,
        data_json: {
          artisan_id,
          artisan_nom,
          mission_id,
          immeuble,
          photos_count: photosCount,
          photos_urls: photoUrls,
          has_signature: !!signature_svg,
          report_id: reportId,
          completed_at: completed_at || now,
        },
        created_at: now,
      })

    if (notifError) {
      logger.warn('Syndic notif insert error (table may not exist):', notifError.message)
    }

    // 4. Mettre à jour le booking si bookingId fourni
    if (booking_id) {
      await supabaseAdmin
        .from('bookings')
        .update({
          status: 'completed',
          completed_at: completed_at || now,
        })
        .eq('id', booking_id)
    }

    return NextResponse.json({
      success: true,
      report_id: reportId,
      photos_uploaded: photoUrls.length,
    })

  } catch (err: unknown) {
    logger.error('mission-report error:', err)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
