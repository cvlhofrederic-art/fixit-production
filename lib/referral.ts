// ══════════════════════════════════════════════════════════════════════════════
// lib/referral.ts — Programme de Parrainage : fonctions principales
// 4 fonctions : generateReferralCode, computeRiskScore,
//               checkAutoParrainage, distributeReferralReward
// ══════════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe'
import { getUserSubscription } from '@/lib/subscription'

// ── Constantes ──────────────────────────────────────────────────────────────

// Alphabet sans 0/O/1/I/L pour éviter la confusion visuelle
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const MAX_CODE_RETRIES = 10

// Seuils anti-fraude
export const RISK_THRESHOLD_REVIEW = 5  // >= 5 → revue manuelle
export const RISK_THRESHOLD_BLOCK = 8   // >= 8 → blocage automatique

// Facteurs de risque et leurs poids
export const RISK_FACTORS = {
  meme_ip_inscription:                    3,
  meme_plage_ip:                          2,
  inscription_moins_10min_apres_clic:     2,
  paiement_moins_5min_apres_inscription:  3,
  meme_moyen_paiement_que_parrain:        5,
  meme_stripe_customer_que_parrain:       5,
  email_domaine_similaire:                1,
  parrain_depasse_5_parrainages_7j:       2,
  filleul_annule_dans_7j:                 4,
} as const

export type RiskFactor = keyof typeof RISK_FACTORS

// Montant du crédit récompense (1 mois Pro = 49€ = 4900 centimes)
const REWARD_CREDIT_CENTS = 4900

// ══════════════════════════════════════════════════════════════════════════════
// 3.1 — generateReferralCode()
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Génère un code parrainage unique de 8 caractères alphanumériques.
 * Vérifie l'unicité dans profiles_artisan.referral_code, régénère si collision.
 */
export async function generateReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    let code = ''
    // crypto.getRandomValues pour une vraie randomness côté serveur
    const bytes = new Uint8Array(CODE_LENGTH)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
    }

    // Vérifier unicité
    const { data } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()

    if (!data) return code
  }

  throw new Error('[referral] Impossible de générer un code unique après plusieurs tentatives')
}

// ══════════════════════════════════════════════════════════════════════════════
// 3.2 — computeRiskScore(referralId)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Calcule le score de risque d'un parrainage en évaluant chaque facteur suspect.
 * Met à jour referrals.risk_score + risk_flags, et logue dans referral_risk_log.
 *
 * Score >= 5 → revue manuelle automatique
 * Score >= 8 → blocage automatique
 *
 * @returns Le score total calculé
 */
export async function computeRiskScore(referralId: string): Promise<number> {
  // Charger le referral avec les données du parrain et du filleul
  const { data: ref, error } = await supabaseAdmin
    .from('referrals')
    .select('*')
    .eq('id', referralId)
    .single()

  if (error || !ref) {
    console.error('[referral] computeRiskScore — referral introuvable:', referralId)
    return 0
  }

  // Charger le parrain
  const { data: parrain } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, user_id, email')
    .eq('id', ref.parrain_id)
    .single()

  // Charger le filleul (peut être null si pas encore inscrit)
  let filleul: { id: string; user_id: string; email: string } | null = null
  if (ref.filleul_id) {
    const { data } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, user_id, email')
      .eq('id', ref.filleul_id)
      .single()
    filleul = data
  }

  let score = 0
  const flags: RiskFactor[] = []

  // ── Facteur : même IP exacte inscription ──
  if (ref.ip_clic && ref.ip_inscription && ref.ip_clic === ref.ip_inscription) {
    // Même IP entre le clic du parrain et l'inscription du filleul
    if (ref.meme_ip_que_parrain) {
      score += RISK_FACTORS.meme_ip_inscription
      flags.push('meme_ip_inscription')
    }
  }

  // ── Facteur : même plage IP /24 ──
  if (ref.ip_clic && ref.ip_inscription) {
    const clicPrefix = ref.ip_clic.split('.').slice(0, 3).join('.')
    const inscPrefix = ref.ip_inscription.split('.').slice(0, 3).join('.')
    if (clicPrefix === inscPrefix && ref.ip_clic !== ref.ip_inscription) {
      score += RISK_FACTORS.meme_plage_ip
      flags.push('meme_plage_ip')
    }
  }

  // ── Facteur : inscription < 10 min après clic ──
  if (ref.date_clic && ref.date_inscription) {
    const deltaMs = new Date(ref.date_inscription).getTime() - new Date(ref.date_clic).getTime()
    if (deltaMs > 0 && deltaMs < 10 * 60 * 1000) {
      score += RISK_FACTORS.inscription_moins_10min_apres_clic
      flags.push('inscription_moins_10min_apres_clic')
    }
  }

  // ── Facteur : paiement < 5 min après inscription ──
  if (ref.date_inscription && ref.date_premier_paiement) {
    const deltaMs = new Date(ref.date_premier_paiement).getTime() - new Date(ref.date_inscription).getTime()
    if (deltaMs > 0 && deltaMs < 5 * 60 * 1000) {
      score += RISK_FACTORS.paiement_moins_5min_apres_inscription
      flags.push('paiement_moins_5min_apres_inscription')
    }
  }

  // ── Facteur : même moyen de paiement Stripe ──
  if (ref.meme_moyen_paiement_que_parrain) {
    score += RISK_FACTORS.meme_moyen_paiement_que_parrain
    flags.push('meme_moyen_paiement_que_parrain')
  }

  // ── Facteur : même Stripe customer ──
  if (ref.stripe_customer_id_filleul && parrain?.user_id) {
    const parrainSub = await getUserSubscription(parrain.user_id)
    if (parrainSub?.stripe_customer_id && parrainSub.stripe_customer_id === ref.stripe_customer_id_filleul) {
      score += RISK_FACTORS.meme_stripe_customer_que_parrain
      flags.push('meme_stripe_customer_que_parrain')
    }
  }

  // ── Facteur : domaine email similaire ──
  if (parrain?.email && filleul?.email) {
    const parrainDomain = parrain.email.split('@')[1]?.toLowerCase()
    const filleulDomain = filleul.email.split('@')[1]?.toLowerCase()
    // Ignorer les domaines publics courants (gmail, hotmail, yahoo, outlook)
    const publicDomains = ['gmail.com', 'hotmail.com', 'hotmail.fr', 'yahoo.com', 'yahoo.fr', 'outlook.com', 'outlook.fr', 'live.fr', 'live.com', 'orange.fr', 'free.fr', 'sfr.fr']
    if (parrainDomain && filleulDomain && parrainDomain === filleulDomain && !publicDomains.includes(parrainDomain)) {
      score += RISK_FACTORS.email_domaine_similaire
      flags.push('email_domaine_similaire')
    }
  }

  // ── Facteur : parrain a dépassé 5 parrainages en 7 jours ──
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabaseAdmin
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('parrain_id', ref.parrain_id)
    .gte('created_at', sevenDaysAgo)

  if (recentCount && recentCount > 5) {
    score += RISK_FACTORS.parrain_depasse_5_parrainages_7j
    flags.push('parrain_depasse_5_parrainages_7j')
  }

  // ── Facteur : filleul a annulé dans les 7 jours ──
  if (filleul?.user_id && ref.date_premier_paiement) {
    const filleulSub = await getUserSubscription(filleul.user_id)
    if (filleulSub && filleulSub.status === 'canceled') {
      const daysSincePayment = (Date.now() - new Date(ref.date_premier_paiement).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSincePayment <= 7) {
        score += RISK_FACTORS.filleul_annule_dans_7j
        flags.push('filleul_annule_dans_7j')
      }
    }
  }

  // ── Mise à jour du referral ──
  const updates: Record<string, unknown> = {
    risk_score: score,
    risk_flags: flags,
    updated_at: new Date().toISOString(),
  }

  if (score >= RISK_THRESHOLD_REVIEW) {
    updates.en_revue_manuelle = true
  }
  if (score >= RISK_THRESHOLD_BLOCK) {
    updates.statut = 'bloque'
  }

  await supabaseAdmin
    .from('referrals')
    .update(updates)
    .eq('id', referralId)

  // ── Logger dans referral_risk_log ──
  if (flags.length > 0) {
    await supabaseAdmin.from('referral_risk_log').insert({
      referral_id: referralId,
      artisan_id: ref.filleul_id || ref.parrain_id,
      type_evenement: 'calcul_risque',
      detail: JSON.stringify({ score, flags, timestamp: new Date().toISOString() }),
      ip: ref.ip_inscription || ref.ip_clic,
    })
  }

  return score
}

// ══════════════════════════════════════════════════════════════════════════════
// 3.3 — checkAutoParrainage(parrainId, filleulId)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Détection de fraude dure : retourne true si auto-parrainage certain.
 * Vérifie : même artisan, même email, même moyen de paiement Stripe,
 * même customer Stripe.
 *
 * Si true → le parrainage doit être ignoré SILENCIEUSEMENT (pas d'erreur visible).
 */
export async function checkAutoParrainage(parrainId: string, filleulId: string): Promise<boolean> {
  // 1. Même artisan (ID identique)
  if (parrainId === filleulId) return true

  // Charger les deux profils
  const { data: parrain } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, user_id, email')
    .eq('id', parrainId)
    .single()

  const { data: filleul } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, user_id, email')
    .eq('id', filleulId)
    .single()

  if (!parrain || !filleul) return false

  // 2. Même email (insensible à la casse)
  if (parrain.email?.toLowerCase() === filleul.email?.toLowerCase()) return true

  // 3. Même user_id Supabase (double profil artisan)
  if (parrain.user_id === filleul.user_id) return true

  // 4. Comparaison Stripe (customer + payment method)
  const parrainSub = await getUserSubscription(parrain.user_id)
  const filleulSub = await getUserSubscription(filleul.user_id)

  if (parrainSub?.stripe_customer_id && filleulSub?.stripe_customer_id) {
    // 4a. Même customer Stripe
    if (parrainSub.stripe_customer_id === filleulSub.stripe_customer_id) return true

    // 4b. Même moyen de paiement (fingerprint via Stripe API)
    try {
      const stripe = getStripe()
      const [parrainPMs, filleulPMs] = await Promise.all([
        stripe.paymentMethods.list({ customer: parrainSub.stripe_customer_id, type: 'card', limit: 5 }),
        stripe.paymentMethods.list({ customer: filleulSub.stripe_customer_id, type: 'card', limit: 5 }),
      ])

      const parrainFingerprints = new Set(
        parrainPMs.data.map(pm => pm.card?.fingerprint).filter(Boolean)
      )

      for (const pm of filleulPMs.data) {
        if (pm.card?.fingerprint && parrainFingerprints.has(pm.card.fingerprint)) {
          return true
        }
      }
    } catch (err) {
      // Stripe error — ne pas bloquer, mais logger
      console.warn('[referral] checkAutoParrainage — erreur Stripe:', err)
    }
  }

  return false
}

// ══════════════════════════════════════════════════════════════════════════════
// 3.4 — distributeReferralReward(referralId)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Distribue la récompense double : 1 mois offert au parrain ET au filleul.
 * UNIQUEMENT appelé depuis le cron J+7, jamais depuis le webhook directement.
 *
 * Vérifications :
 * 1. Statut = 'paiement_valide' ou 'periode_verification'
 * 2. Filleul toujours abonné
 * 3. Score de risque final < seuils
 * 4. Crédite les deux parties via Stripe balance + credits_log
 *
 * @returns 'distributed' | 'blocked' | 'review' | 'canceled' | 'error'
 */
export async function distributeReferralReward(
  referralId: string
): Promise<'distributed' | 'blocked' | 'review' | 'canceled' | 'error'> {
  // Charger le referral
  const { data: ref, error } = await supabaseAdmin
    .from('referrals')
    .select('*')
    .eq('id', referralId)
    .single()

  if (error || !ref) {
    console.error('[referral] distributeReward — referral introuvable:', referralId)
    return 'error'
  }

  // 1. Vérifier le statut
  if (!['paiement_valide', 'periode_verification'].includes(ref.statut)) {
    console.warn('[referral] distributeReward — statut incorrect:', ref.statut)
    return 'error'
  }

  // 2. Vérifier que le filleul est toujours abonné
  if (!ref.filleul_id) return 'error'

  const { data: filleul } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, user_id')
    .eq('id', ref.filleul_id)
    .single()

  if (!filleul) return 'error'

  const filleulSub = await getUserSubscription(filleul.user_id)
  if (!filleulSub || filleulSub.status === 'canceled') {
    // Filleul a annulé → bloquer + logger
    await supabaseAdmin.from('referrals').update({
      statut: 'bloque',
      risk_score: (ref.risk_score || 0) + RISK_FACTORS.filleul_annule_dans_7j,
      updated_at: new Date().toISOString(),
    }).eq('id', referralId)

    await logRiskEvent(referralId, ref.filleul_id, 'filleul_annule_avant_distribution', ref.ip_inscription)
    return 'canceled'
  }

  // 3. Recalcul final du score
  const finalScore = await computeRiskScore(referralId)

  if (finalScore >= RISK_THRESHOLD_BLOCK) {
    await logRiskEvent(referralId, ref.parrain_id, 'fraude_bloquee', ref.ip_clic)
    return 'blocked'
  }

  if (finalScore >= RISK_THRESHOLD_REVIEW) {
    await logRiskEvent(referralId, ref.parrain_id, 'revue_manuelle_requise', ref.ip_clic)
    return 'review'
  }

  // 4. Distribuer les crédits aux deux parties
  const { data: parrain } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, user_id, credit_mois_gratuits, total_parrainages_reussis')
    .eq('id', ref.parrain_id)
    .single()

  if (!parrain) return 'error'

  // ── Crédit Stripe balance (si customer existant) ──
  const stripe = getStripe()

  // Créditer le parrain
  const parrainSub = await getUserSubscription(parrain.user_id)
  if (parrainSub?.stripe_customer_id) {
    try {
      await stripe.customers.createBalanceTransaction(parrainSub.stripe_customer_id, {
        amount: -REWARD_CREDIT_CENTS, // Négatif = crédit
        currency: 'eur',
        description: `Parrainage validé — 1 mois offert (ref: ${ref.code})`,
      })
    } catch (err) {
      console.error('[referral] Stripe credit parrain failed:', err)
    }
  }

  // Créditer le filleul
  if (filleulSub?.stripe_customer_id) {
    try {
      await stripe.customers.createBalanceTransaction(filleulSub.stripe_customer_id, {
        amount: -REWARD_CREDIT_CENTS,
        currency: 'eur',
        description: `Bonus filleul — 1 mois offert (parrain: ${ref.code})`,
      })
    } catch (err) {
      console.error('[referral] Stripe credit filleul failed:', err)
    }
  }

  // ── Mise à jour DB : profiles_artisan ──
  await supabaseAdmin.from('profiles_artisan').update({
    credit_mois_gratuits: (parrain.credit_mois_gratuits || 0) + ref.mois_offerts_parrain,
    total_parrainages_reussis: (parrain.total_parrainages_reussis || 0) + 1,
  }).eq('id', ref.parrain_id)

  // Crédits filleul côté DB
  const { data: filleulProfile } = await supabaseAdmin
    .from('profiles_artisan')
    .select('credit_mois_gratuits')
    .eq('id', ref.filleul_id)
    .single()

  if (filleulProfile) {
    await supabaseAdmin.from('profiles_artisan').update({
      credit_mois_gratuits: (filleulProfile.credit_mois_gratuits || 0) + ref.mois_offerts_filleul,
    }).eq('id', ref.filleul_id)
  }

  // ── credits_log : historique des deux crédits ──
  await supabaseAdmin.from('credits_log').insert([
    {
      artisan_id: ref.parrain_id,
      type: 'parrainage_parrain',
      mois_credits: ref.mois_offerts_parrain,
      referral_id: referralId,
      description: `Parrainage validé — filleul ${ref.filleul_id}`,
    },
    {
      artisan_id: ref.filleul_id,
      type: 'parrainage_filleul',
      mois_credits: ref.mois_offerts_filleul,
      referral_id: referralId,
      description: `Bonus filleul — parrain ${ref.parrain_id}`,
    },
  ])

  // ── Mise à jour referral : statut final ──
  await supabaseAdmin.from('referrals').update({
    statut: 'recompense_distribuee',
    date_recompense: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', referralId)

  // Logger le succès
  await logRiskEvent(referralId, ref.parrain_id, 'recompense_distribuee', null)

  return 'distributed'
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers internes
// ══════════════════════════════════════════════════════════════════════════════

/** Log un événement dans referral_risk_log */
async function logRiskEvent(
  referralId: string,
  artisanId: string | null,
  type: string,
  ip: string | null,
) {
  await supabaseAdmin.from('referral_risk_log').insert({
    referral_id: referralId,
    artisan_id: artisanId,
    type_evenement: type,
    ip,
  })
}

/**
 * Récupère un parrain à partir de son code de parrainage.
 * Retourne null si le code n'existe pas ou si l'artisan est flagged.
 */
export async function getParrainByCode(code: string): Promise<{
  id: string
  user_id: string
  company_name: string
  email: string
  referral_flagged: boolean
} | null> {
  const { data } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, user_id, company_name, email, referral_flagged')
    .eq('referral_code', code.toUpperCase().trim())
    .single()

  if (!data || data.referral_flagged) return null
  return data
}

/**
 * Récupère les stats de parrainage d'un artisan.
 */
export async function getReferralStats(artisanId: string) {
  const { data: referrals } = await supabaseAdmin
    .from('referrals')
    .select('statut, mois_offerts_parrain')
    .eq('parrain_id', artisanId)

  if (!referrals) return { total: 0, inscrits: 0, valides: 0, moisGagnes: 0, enAttente: 0 }

  const total = referrals.length
  const inscrits = referrals.filter(r => r.statut === 'inscrit').length
  const enAttente = referrals.filter(r => ['paiement_valide', 'periode_verification'].includes(r.statut)).length
  const valides = referrals.filter(r => r.statut === 'recompense_distribuee').length
  const moisGagnes = referrals
    .filter(r => r.statut === 'recompense_distribuee')
    .reduce((sum, r) => sum + (r.mois_offerts_parrain || 0), 0)

  return { total, inscrits, valides, moisGagnes, enAttente }
}
