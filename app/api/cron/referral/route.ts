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
  // Guard explicite : sans CRON_SECRET défini côté Worker, un appel
  // « Authorization: Bearer undefined » passerait la comparaison brute.
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

    const { data: readyReferrals, error: readyError } = await supabaseAdmin
      .from('referrals')
      .select('id, parrain_id, filleul_id, code')
      .eq('statut', 'paiement_valide')
      .lte('date_fin_periode_verification', new Date().toISOString())
      .eq('en_revue_manuelle', false)
      .lt('risk_score', 5)

    if (readyError) {
      logger.error('[cron/referral] Ready referrals query failed:', { error: readyError.message })
    }

    if (readyReferrals?.length) {
      for (const ref of readyReferrals) {
        const result = await distributeReferralReward(ref.id)

        switch (result) {
          case 'distributed':
            results.distributed++
            // Envoyer email 7.3 : récompense confirmée
            // filleul_id non-null garanti quand result === 'distributed'
            if (ref.filleul_id) await sendRewardEmail(ref.parrain_id, ref.filleul_id, ref.code)
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

    // TSQ-09 : borné à 200 lignes + I/O batchées (UPDATE .in + INSERT en array)
    const { data: inactiveReferrals, error: inactiveError } = await supabaseAdmin
      .from('referrals')
      .select('id, parrain_id, filleul_id, code, rappel_envoye')
      .eq('statut', 'inscrit')
      .lte('date_inscription', sevenDaysAgo)
      .gte('date_inscription', eightDaysAgo)
      .eq('rappel_envoye', false)
      .limit(200)

    if (inactiveError) {
      logger.error('[cron/referral] Inactive referrals query failed:', { error: inactiveError.message })
    }

    if (inactiveReferrals?.length) {
      // Envoi séquentiel ; on ne marque QUE les referrals dont l'email est parti
      // (pas de doublons en cas d'échec partiel : les autres seront retentés)
      const sentRefs: Array<{ id: string; parrain_id: string }> = []
      for (const ref of inactiveReferrals) {
        if (!ref.filleul_id || !ref.parrain_id) continue

        const sent = await sendReminderEmail(ref.parrain_id, ref.filleul_id, ref.code)
        if (sent) sentRefs.push({ id: ref.id, parrain_id: ref.parrain_id })
      }

      if (sentRefs.length) {
        // Marquer les rappels envoyés en un seul UPDATE
        const { error: updateError } = await supabaseAdmin.from('referrals').update({
          rappel_envoye: true,
          updated_at: new Date().toISOString(),
        }).in('id', sentRefs.map(r => r.id))

        if (updateError) {
          logger.error('[cron/referral] Batch rappel_envoye update failed:', { error: updateError.message, ids: sentRefs.map(r => r.id) })
        }

        // Logger dans referral_risk_log en un seul INSERT
        const { error: insertError } = await supabaseAdmin.from('referral_risk_log').insert(
          sentRefs.map(r => ({
            referral_id: r.id,
            artisan_id: r.parrain_id,
            type_evenement: 'rappel_envoye',
          }))
        )

        if (insertError) {
          logger.error('[cron/referral] Batch risk_log insert failed:', { error: insertError.message })
        }

        results.reminders_sent = sentRefs.length
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

// NB : profiles_artisan n'a PAS de colonne first_name (cf. lib/database-types.ts) —
// l'ancien select la demandait, la requête échouait, et aucun email ne partait.
async function sendRewardEmail(parrainId: string, filleulId: string, code: string) {
  try {
    const { data: parrain } = await supabaseAdmin
      .from('profiles_artisan')
      .select('email, company_name, total_parrainages_reussis, referral_code')
      .eq('id', parrainId)
      .single()

    const { data: filleul } = await supabaseAdmin
      .from('profiles_artisan')
      .select('company_name')
      .eq('id', filleulId)
      .single()

    if (!parrain?.email) return

    await sendReferralRewardConfirmed({
      parrainEmail: parrain.email,
      parrainName: parrain.company_name || 'Artisan',
      filleulName: filleul?.company_name || 'Un artisan',
      totalParrainages: parrain.total_parrainages_reussis || 1,
      referralCode: parrain.referral_code || code,
    })
  } catch (err) {
    logger.error('[cron/referral] Reward email error:', err)
  }
}

/** @returns true si l'email est effectivement parti (sinon le rappel sera retenté) */
async function sendReminderEmail(parrainId: string, filleulId: string, code: string): Promise<boolean> {
  try {
    const { data: parrain } = await supabaseAdmin
      .from('profiles_artisan')
      .select('email, company_name, referral_code')
      .eq('id', parrainId)
      .single()

    const { data: filleul } = await supabaseAdmin
      .from('profiles_artisan')
      .select('company_name')
      .eq('id', filleulId)
      .single()

    if (!parrain?.email) return false

    const result = await sendReferralReminderFilleul({
      parrainEmail: parrain.email,
      parrainName: parrain.company_name || 'Artisan',
      filleulName: filleul?.company_name || 'Un artisan',
      referralCode: parrain.referral_code || code,
    })
    return result.success
  } catch (err) {
    logger.error('[cron/referral] Reminder email error:', err)
    return false
  }
}
