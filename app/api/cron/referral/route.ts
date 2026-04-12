// ══════════════════════════════════════════════════════════════════════════════
// GET /api/cron/referral — Cron J+7 : distribution récompenses + rappels
// Exécuté chaque nuit à 02h00 via Vercel Cron
// Auth par CRON_SECRET header
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { distributeReferralReward } from '@/lib/referral'
import { sendReferralRewardConfirmed, sendReferralReminderFilleul } from '@/lib/email-referral'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 secondes max

export async function GET(request: NextRequest) {
  // Vérification CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    distributed: 0,
    blocked: 0,
    reviewed: 0,
    canceled: 0,
    errors: 0,
    reminders_sent: 0,
  }

  try {
    // ══════════════════════════════════════════════════════════════════════
    // 8.1 — Distribution des récompenses (J+7 passé)
    // ══════════════════════════════════════════════════════════════════════

    const { data: readyReferrals } = await supabaseAdmin
      .from('referrals')
      .select('id, parrain_id, filleul_id, code')
      .eq('statut', 'paiement_valide')
      .lte('date_fin_periode_verification', new Date().toISOString())
      .eq('en_revue_manuelle', false)
      .lt('risk_score', 5)

    if (readyReferrals?.length) {
      for (const ref of readyReferrals) {
        const result = await distributeReferralReward(ref.id)

        switch (result) {
          case 'distributed':
            results.distributed++
            // Envoyer email 7.3 : récompense confirmée
            await sendRewardEmail(ref.parrain_id, ref.filleul_id, ref.code)
            break
          case 'blocked':
            results.blocked++
            break
          case 'review':
            results.reviewed++
            break
          case 'canceled':
            results.canceled++
            break
          default:
            results.errors++
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // 8.2 — Rappels filleuls inactifs (inscrits depuis 7j, sans abonnement)
    // ══════════════════════════════════════════════════════════════════════

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()

    const { data: inactiveReferrals } = await supabaseAdmin
      .from('referrals')
      .select('id, parrain_id, filleul_id, code, rappel_envoye')
      .eq('statut', 'inscrit')
      .lte('date_inscription', sevenDaysAgo)
      .gte('date_inscription', eightDaysAgo)
      .eq('rappel_envoye', false)

    if (inactiveReferrals?.length) {
      for (const ref of inactiveReferrals) {
        if (!ref.filleul_id || !ref.parrain_id) continue

        await sendReminderEmail(ref.parrain_id, ref.filleul_id, ref.code)

        // Marquer le rappel comme envoyé
        await supabaseAdmin.from('referrals').update({
          rappel_envoye: true,
          updated_at: new Date().toISOString(),
        }).eq('id', ref.id)

        // Logger dans referral_risk_log
        await supabaseAdmin.from('referral_risk_log').insert({
          referral_id: ref.id,
          artisan_id: ref.parrain_id,
          type_evenement: 'rappel_envoye',
        })

        results.reminders_sent++
      }
    }

    logger.info('[cron/referral] Results:', results)
    return NextResponse.json({ success: true, ...results })
  } catch (err) {
    logger.error('[cron/referral] Error:', err)
    return NextResponse.json({ error: 'Cron failed', details: String(err) }, { status: 500 })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendRewardEmail(parrainId: string, filleulId: string, code: string) {
  try {
    const { data: parrain } = await supabaseAdmin
      .from('profiles_artisan')
      .select('email, company_name, first_name, total_parrainages_reussis, referral_code')
      .eq('id', parrainId)
      .single()

    const { data: filleul } = await supabaseAdmin
      .from('profiles_artisan')
      .select('company_name, first_name')
      .eq('id', filleulId)
      .single()

    if (!parrain?.email) return

    await sendReferralRewardConfirmed({
      parrainEmail: parrain.email,
      parrainName: parrain.first_name || parrain.company_name || 'Artisan',
      filleulName: filleul?.first_name || filleul?.company_name || 'Un artisan',
      totalParrainages: parrain.total_parrainages_reussis || 1,
      referralCode: parrain.referral_code || code,
    })
  } catch (err) {
    logger.error('[cron/referral] Reward email error:', err)
  }
}

async function sendReminderEmail(parrainId: string, filleulId: string, code: string) {
  try {
    const { data: parrain } = await supabaseAdmin
      .from('profiles_artisan')
      .select('email, company_name, first_name, referral_code')
      .eq('id', parrainId)
      .single()

    const { data: filleul } = await supabaseAdmin
      .from('profiles_artisan')
      .select('company_name, first_name')
      .eq('id', filleulId)
      .single()

    if (!parrain?.email) return

    await sendReferralReminderFilleul({
      parrainEmail: parrain.email,
      parrainName: parrain.first_name || parrain.company_name || 'Artisan',
      filleulName: filleul?.first_name || filleul?.company_name || 'Un artisan',
      referralCode: parrain.referral_code || code,
    })
  } catch (err) {
    logger.error('[cron/referral] Reminder email error:', err)
  }
}
