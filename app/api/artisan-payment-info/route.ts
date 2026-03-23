import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// GET — Récupérer les infos paiement de l'artisan
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: artisan, error } = await supabaseAdmin
    .from('profiles_artisan')
    .select('paiement_modes, paiement_mention_devis, paiement_mention_facture')
    .eq('user_id', user.id)
    .single()

  if (error || !artisan) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  }

  return NextResponse.json({
    paiement_modes: artisan.paiement_modes || getDefaultModes(),
    paiement_mention_devis: artisan.paiement_mention_devis ?? true,
    paiement_mention_facture: artisan.paiement_mention_facture ?? true,
  })
}

// POST — Sauvegarder les infos paiement
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const allowed = await checkRateLimit(`artisan_payment_${user.id}`, 10, 60_000)
  if (!allowed) return rateLimitResponse()

  const { data: artisan, error: fetchError } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (fetchError || !artisan) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  }

  const body = await request.json()
  const { paiement_modes, paiement_mention_devis, paiement_mention_facture } = body

  // Validation basique
  if (!Array.isArray(paiement_modes)) {
    return NextResponse.json({ error: 'paiement_modes doit être un tableau' }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('profiles_artisan')
    .update({
      paiement_modes,
      paiement_mention_devis: paiement_mention_devis ?? true,
      paiement_mention_facture: paiement_mention_facture ?? true,
    })
    .eq('id', artisan.id)

  if (updateError) {
    logger.error('savePaymentInfo error:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

function getDefaultModes() {
  return [
    { type: 'virement', iban: '', bic: '', titulaire: '', actif: false },
    { type: 'stripe', lien: '', actif: false },
    { type: 'cheque', ordre: '', actif: false },
    { type: 'especes', actif: false },
    { type: 'autre', description: '', actif: false },
  ]
}
