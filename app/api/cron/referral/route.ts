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
    reminders_failed: 0,
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
    // Une lecture en panne n'est pas une liste vide : elle est journalisée et comptée.
    if (readyError) {
      results.errors++
      logger.error('[cron/referral] parrainages à récompenser illisibles', { error: readyError.message })
    }

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

    const { data: inactiveReferrals, error: inactiveError } = await supabaseAdmin
      .from('referrals')
      .select('id, parrain_id, filleul_id, code, rappel_envoye')
      .eq('statut', 'inscrit')
      .lte('date_inscription', sevenDaysAgo)
      .gte('date_inscription', eightDaysAgo)
      .eq('rappel_envoye', false)
    if (inactiveError) {
      results.errors++
      logger.error('[cron/referral] parrainages à relancer illisibles', { error: inactiveError.message })
    }

    if (inactiveReferrals?.length) {
      for (const ref of inactiveReferrals) {
        if (!ref.filleul_id || !ref.parrain_id) continue

        // Un rappel n'est marqué envoyé, journalisé et compté que s'il est parti. Avant, il l'était même sans e-mail
        // sorti : le cas de chaque rappel tant que la lecture des fiches échouait (first_name absente en production).
        const envoye = await sendReminderEmail(ref.parrain_id, ref.filleul_id, ref.code)
        if (!envoye) {
          results.reminders_failed++
          continue
        }

        // Marquer le rappel comme envoyé
        const { error: marqueError } = await supabaseAdmin.from('referrals').update({
          rappel_envoye: true,
          updated_at: new Date().toISOString(),
        }).eq('id', ref.id)
        if (marqueError) {
          logger.error('[cron/referral] rappel envoyé mais non marqué', { referralId: ref.id, error: marqueError.message })
        }

        // Logger dans referral_risk_log
        const { error: journalError } = await supabaseAdmin.from('referral_risk_log').insert({
          referral_id: ref.id,
          artisan_id: ref.parrain_id,
          type_evenement: 'rappel_envoye',
        })
        if (journalError) {
          logger.error('[cron/referral] rappel envoyé mais non journalisé', { referralId: ref.id, error: journalError.message })
        }

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
// Noms dans les e-mails : celui de l'entreprise (company_name). profiles_artisan n'a pas de prénom (first_name) en
// production (relevé du 17/11/2026) : lue avec les autres colonnes, elle faisait échouer toute la lecture de la fiche
// (42703), et aucun e-mail de parrainage ne partait.

async function sendRewardEmail(parrainId: string, filleulId: string, code: string): Promise<void> {
  try {
    const { data: parrain, error: parrainError } = await supabaseAdmin
      .from('profiles_artisan')
      .select('email, company_name, total_parrainages_reussis, referral_code')
      .eq('id', parrainId)
      .single()
    if (parrainError) {
      logger.error('[cron/referral] fiche du parrain illisible', { parrainId, error: parrainError.message })
      return
    }
    if (!parrain?.email) return

    const envoi = await sendReferralRewardConfirmed({
      parrainEmail: parrain.email,
      parrainName: parrain.company_name || 'Artisan',
      filleulName: await nomDuFilleul(filleulId),
      totalParrainages: parrain.total_parrainages_reussis || 1,
      referralCode: parrain.referral_code || code,
    })
    if (!envoi.success) logger.warn('[cron/referral] e-mail de récompense non envoyé', { parrainId, error: envoi.error })
  } catch (err) {
    logger.error('[cron/referral] Reward email error:', err)
  }
}

/** Rappel au parrain d'un filleul inactif : true seulement si l'e-mail est parti. */
async function sendReminderEmail(parrainId: string, filleulId: string, code: string): Promise<boolean> {
  try {
    const { data: parrain, error: parrainError } = await supabaseAdmin
      .from('profiles_artisan')
      .select('email, company_name, referral_code')
      .eq('id', parrainId)
      .single()
    if (parrainError) {
      logger.error('[cron/referral] fiche du parrain illisible', { parrainId, error: parrainError.message })
      return false
    }
    if (!parrain?.email) return false

    const envoi = await sendReferralReminderFilleul({
      parrainEmail: parrain.email,
      parrainName: parrain.company_name || 'Artisan',
      filleulName: await nomDuFilleul(filleulId),
      referralCode: parrain.referral_code || code,
    })
    if (!envoi.success) logger.warn('[cron/referral] e-mail de rappel non envoyé', { parrainId, error: envoi.error })
    return envoi.success
  } catch (err) {
    logger.error('[cron/referral] Reminder email error:', err)
    return false
  }
}

/** Nom du filleul dans les e-mails : celui de son entreprise, un libellé générique s'il manque ou si sa fiche est illisible. */
async function nomDuFilleul(filleulId: string): Promise<string> {
  const { data: filleul, error } = await supabaseAdmin
    .from('profiles_artisan')
    .select('company_name')
    .eq('id', filleulId)
    .single()
  if (error) logger.warn('[cron/referral] fiche du filleul illisible', { filleulId, error: error.message })
  return filleul?.company_name || 'Un artisan'
}
