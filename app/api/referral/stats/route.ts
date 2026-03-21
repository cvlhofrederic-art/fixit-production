import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { SITE_URL } from '@/lib/constants'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: artisan } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, referral_code, credit_mois_gratuits, total_parrainages_reussis')
    .eq('user_id', user.id)
    .single()

  if (!artisan) return NextResponse.json({ error: 'Artisan not found' }, { status: 404 })

  // Stats des referrals
  const { data: referrals } = await supabaseAdmin
    .from('referrals')
    .select('statut')
    .eq('parrain_id', artisan.id)
    .not('statut', 'in', '("bloque","fraude_suspectee")')

  const total = referrals?.length || 0
  const inscrits = referrals?.filter(r => r.statut === 'inscrit').length || 0
  const enVerification = referrals?.filter(r => ['paiement_valide', 'periode_verification'].includes(r.statut)).length || 0
  const valides = referrals?.filter(r => r.statut === 'recompense_distribuee').length || 0

  return NextResponse.json({
    referral_code: artisan.referral_code,
    referral_link: artisan.referral_code ? `${SITE_URL}/rejoindre?ref=${artisan.referral_code}` : null,
    credit_mois_gratuits: artisan.credit_mois_gratuits || 0,
    total_parrainages_reussis: artisan.total_parrainages_reussis || 0,
    stats: { total, inscrits, enVerification, valides },
  })
}
