// ══════════════════════════════════════════════════════════════════════════════
// POST /api/referral/signup — Lie un filleul à son parrain après inscription
// Appelé côté client après profiles_artisan.insert()
// Vérifie anti-auto-parrainage, calcule le risk score partiel
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getParrainByCode, checkAutoParrainage, computeRiskScore, generateReferralCode } from '@/lib/referral'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { sendReferralWelcomeFilleul, sendReferralNotifParrain } from '@/lib/email-referral'

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`referral_signup_${ip}`, 5, 60_000)
  if (!allowed) return rateLimitResponse()

  try {
    const body = await request.json()
    const { code, artisan_id, user_id } = body as {
      code?: string
      artisan_id?: string
      user_id?: string
    }

    // Validation basique
    if (!code || !artisan_id || !user_id) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    // 1. Vérifier le code
    const parrain = await getParrainByCode(code)
    if (!parrain) {
      // Code invalide ou parrain flagged → ignorer silencieusement
      return NextResponse.json({ success: true, referral: false })
    }

    // 2. Anti-auto-parrainage (blocage dur, silencieux)
    const isSelfReferral = await checkAutoParrainage(parrain.id, artisan_id)
    if (isSelfReferral) {
      // Logger silencieusement
      console.warn(`[referral/signup] Auto-parrainage détecté: parrain=${parrain.id}, filleul=${artisan_id}`)

      // Trouver le referral en_attente pour ce code et le bloquer
      const { data: pendingRef } = await supabaseAdmin
        .from('referrals')
        .select('id')
        .eq('code', code.toUpperCase().trim())
        .eq('parrain_id', parrain.id)
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pendingRef) {
        await supabaseAdmin.from('referrals').update({
          statut: 'bloque',
          filleul_id: artisan_id,
          risk_flags: ['auto_parrainage'],
          risk_score: 10,
          updated_at: new Date().toISOString(),
        }).eq('id', pendingRef.id)

        await supabaseAdmin.from('referral_risk_log').insert({
          referral_id: pendingRef.id,
          artisan_id,
          type_evenement: 'auto_parrainage_bloque',
          detail: `parrain_id=${parrain.id}, filleul_id=${artisan_id}`,
          ip,
        })
      }

      // Inscription continue normalement, pas d'erreur côté user
      return NextResponse.json({ success: true, referral: false })
    }

    // 3. Trouver le referral en_attente le plus récent pour ce code
    const { data: referral } = await supabaseAdmin
      .from('referrals')
      .select('id, ip_clic, date_clic')
      .eq('code', code.toUpperCase().trim())
      .eq('parrain_id', parrain.id)
      .eq('statut', 'en_attente')
      .is('filleul_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!referral) {
      // Pas de referral en attente → créer un nouveau
      const { data: newRef } = await supabaseAdmin
        .from('referrals')
        .insert({
          parrain_id: parrain.id,
          filleul_id: artisan_id,
          code: code.toUpperCase().trim(),
          statut: 'inscrit',
          date_inscription: new Date().toISOString(),
          ip_inscription: ip,
          meme_ip_que_parrain: false,
        })
        .select('id')
        .single()

      if (newRef) {
        await computeRiskScore(newRef.id)
        await logSignupEvent(newRef.id, artisan_id, ip)
      }

      // Lier le parrain au filleul dans profiles_artisan
      await linkFilleulToParrain(artisan_id, parrain.id)

      // Générer un code pour le nouveau filleul
      await generateCodeForArtisan(artisan_id)

      // Envoyer les emails de parrainage (non-bloquant)
      await sendReferralEmails(artisan_id, parrain)

      return NextResponse.json({ success: true, referral: true, parrain_name: parrain.company_name })
    }

    // 4. Mettre à jour le referral existant
    const memeIp = referral.ip_clic === ip

    await supabaseAdmin.from('referrals').update({
      filleul_id: artisan_id,
      statut: 'inscrit',
      date_inscription: new Date().toISOString(),
      ip_inscription: ip,
      meme_ip_que_parrain: memeIp,
      updated_at: new Date().toISOString(),
    }).eq('id', referral.id)

    // 5. Calcul de risque partiel
    await computeRiskScore(referral.id)

    // 6. Logger
    await logSignupEvent(referral.id, artisan_id, ip)

    // 7. Lier dans profiles_artisan
    await linkFilleulToParrain(artisan_id, parrain.id)

    // 8. Générer un referral_code pour le filleul
    await generateCodeForArtisan(artisan_id)

    // 9. Envoyer les emails de parrainage (non-bloquant)
    await sendReferralEmails(artisan_id, parrain)

    return NextResponse.json({ success: true, referral: true, parrain_name: parrain.company_name })
  } catch (err) {
    console.error('[referral/signup] Error:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function logSignupEvent(referralId: string, artisanId: string, ip: string) {
  await supabaseAdmin.from('referral_risk_log').insert({
    referral_id: referralId,
    artisan_id: artisanId,
    type_evenement: 'inscription',
    ip,
  })
}

async function linkFilleulToParrain(artisanId: string, parrainId: string) {
  await supabaseAdmin.from('profiles_artisan').update({
    referral_parrain_id: parrainId,
  }).eq('id', artisanId)
}

async function generateCodeForArtisan(artisanId: string) {
  // Vérifier si un code existe déjà
  const { data } = await supabaseAdmin
    .from('profiles_artisan')
    .select('referral_code')
    .eq('id', artisanId)
    .single()

  if (data?.referral_code) return // Déjà un code

  const code = await generateReferralCode()
  await supabaseAdmin.from('profiles_artisan').update({
    referral_code: code,
  }).eq('id', artisanId)
}

async function sendReferralEmails(
  filleulArtisanId: string,
  parrain: { id: string; company_name: string; email: string; referral_flagged: boolean }
) {
  try {
    // Charger le filleul
    const { data: filleul } = await supabaseAdmin
      .from('profiles_artisan')
      .select('email, company_name, first_name')
      .eq('id', filleulArtisanId)
      .single()

    if (!filleul?.email) return

    const filleulName = filleul.first_name || filleul.company_name || 'Un artisan'
    const parrainName = parrain.company_name || 'Un parrain'

    // Charger le referral_code du parrain pour le lien de partage
    const { data: parrainProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('referral_code')
      .eq('id', parrain.id)
      .single()

    // Email 7.1 : Bienvenue filleul
    await sendReferralWelcomeFilleul({
      filleulEmail: filleul.email,
      filleulName,
      parrainName,
    })

    // Email 7.2 : Notification parrain
    if (parrain.email) {
      await sendReferralNotifParrain({
        parrainEmail: parrain.email,
        parrainName,
        filleulName,
        referralCode: parrainProfile?.referral_code || '',
      })
    }
  } catch (err) {
    // Emails non-bloquants
    console.error('[referral/signup] Email send error:', err)
  }
}
