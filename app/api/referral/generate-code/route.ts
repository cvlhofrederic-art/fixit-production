import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { generateReferralCode } from '@/lib/referral'
import { SITE_URL } from '@/lib/constants'

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: artisan } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, referral_code')
    .eq('user_id', user.id)
    .single()

  if (!artisan) return NextResponse.json({ error: 'Artisan not found' }, { status: 404 })

  // Si code existe déjà, le retourner
  if (artisan.referral_code) {
    return NextResponse.json({
      code: artisan.referral_code,
      link: `${SITE_URL}/rejoindre?ref=${artisan.referral_code}`,
    })
  }

  // Générer un nouveau code
  const code = await generateReferralCode()
  await supabaseAdmin.from('profiles_artisan').update({
    referral_code: code,
  }).eq('id', artisan.id)

  return NextResponse.json({
    code,
    link: `${SITE_URL}/rejoindre?ref=${code}`,
  })
}
