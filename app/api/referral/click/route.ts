// ══════════════════════════════════════════════════════════════════════════════
// POST /api/referral/click — Log un clic sur un lien de parrainage
// Crée l'entrée referrals (en_attente) + log dans referral_risk_log
// Public, rate limité par IP
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getParrainByCode } from '@/lib/referral'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limit : 10 clics par IP par minute
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`referral_click_${ip}`, 10, 60_000)
  if (!allowed) return rateLimitResponse()

  try {
    const body = await request.json()
    const { code, source } = body as { code?: string; source?: string }

    if (!code || typeof code !== 'string' || code.length < 4 || code.length > 12) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 400 })
    }

    // Vérifier que le code existe et que le parrain n'est pas flagged
    const parrain = await getParrainByCode(code)
    if (!parrain) {
      return NextResponse.json({ error: 'Code inconnu' }, { status: 404 })
    }

    const userAgent = request.headers.get('user-agent') || ''
    const referer = request.headers.get('referer') || ''

    // Détecter la source de partage
    const sourcePartage = detectSource(source, referer)

    // Créer l'entrée referrals avec statut en_attente
    const { data: referral, error: insertError } = await supabaseAdmin
      .from('referrals')
      .insert({
        parrain_id: parrain.id,
        code: code.toUpperCase().trim(),
        statut: 'en_attente',
        date_clic: new Date().toISOString(),
        ip_clic: ip,
        source_partage: sourcePartage,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[referral/click] Insert error:', insertError)
      return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
    }

    // Logger dans referral_risk_log
    if (referral) {
      await supabaseAdmin.from('referral_risk_log').insert({
        referral_id: referral.id,
        artisan_id: parrain.id,
        type_evenement: 'clic',
        detail: JSON.stringify({ user_agent: userAgent.substring(0, 500), referer: referer.substring(0, 500) }),
        ip,
      })
    }

    return NextResponse.json({
      success: true,
      referral_id: referral?.id,
      parrain_name: parrain.company_name,
    })
  } catch (err) {
    console.error('[referral/click] Error:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

function detectSource(source?: string, referer?: string): string {
  if (source && ['whatsapp', 'sms', 'email', 'lien_copie'].includes(source)) {
    return source
  }
  if (referer) {
    if (referer.includes('whatsapp') || referer.includes('wa.me')) return 'whatsapp'
    if (referer.includes('mail') || referer.includes('outlook')) return 'email'
  }
  return 'autre'
}
