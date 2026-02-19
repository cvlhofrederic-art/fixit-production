import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const step = url.searchParams.get('step') || 'info'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' } }
  )

  // Étape : mettre à jour les infos assurance + données complètes Lepore
  if (step === 'update-insurance') {
    const { data: artisan } = await supabase
      .from('profiles_artisan')
      .select('user_id')
      .eq('siret', '95395158900019')
      .single()

    if (!artisan?.user_id) {
      return NextResponse.json({ error: 'Artisan Lepore not found' })
    }

    // Récupérer les metadata actuelles pour les fusionner
    const { data: { user: currentUser } } = await supabase.auth.admin.getUserById(artisan.user_id)
    const currentMeta = currentUser?.user_metadata || {}

    const { data, error } = await supabase.auth.admin.updateUserById(artisan.user_id, {
      user_metadata: {
        ...currentMeta,
        // Infos entreprise vérifiées
        full_name: 'Lepore Sebastien',
        role: 'artisan',
        phone: '06 51 46 66 98',
        siret: '95395158900019',
        siren: '953951589',
        naf_code: '81.21Z',
        legal_form: 'Entrepreneur individuel',
        company_address: 'BATIMENT B RES L AURORE 13600 LA CIOTAT',
        company_city: 'LA CIOTAT',
        company_postal_code: '13600',
        company_verified: true,
        // Infos assurance
        insurance_number: '113332889',
        insurance_name: 'BPCE IARD',
      }
    })

    return NextResponse.json({
      step: 'update-insurance',
      result: error ? { error: error.message } : {
        success: true,
        user_id: data?.user?.id,
        metadata: data?.user?.user_metadata
      },
    })
  }

  // Info: afficher les metadata actuelles
  if (step === 'info') {
    const { data: artisan } = await supabase
      .from('profiles_artisan')
      .select('user_id, company_name, siret')
      .eq('siret', '95395158900019')
      .single()

    if (!artisan?.user_id) {
      return NextResponse.json({ error: 'Artisan not found' })
    }

    const { data: { user } } = await supabase.auth.admin.getUserById(artisan.user_id)

    return NextResponse.json({
      artisan: { company_name: artisan.company_name, siret: artisan.siret },
      metadata: user?.user_metadata,
    })
  }

  return NextResponse.json({ error: 'Use ?step=update-insurance or ?step=info' })
}
