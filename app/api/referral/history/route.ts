import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: artisan } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artisan) return NextResponse.json({ error: 'Artisan not found' }, { status: 404 })

  // Charger les referrals avec les infos filleul
  const { data: referrals } = await supabaseAdmin
    .from('referrals')
    .select('id, statut, date_inscription, date_recompense, date_fin_periode_verification, filleul_id, mois_offerts_parrain')
    .eq('parrain_id', artisan.id)
    .not('statut', 'eq', 'en_attente')
    .order('created_at', { ascending: false })
    .limit(50)

  if (!referrals?.length) {
    return NextResponse.json({ history: [] })
  }

  // Charger les noms des filleuls
  const filleulIds = referrals.map(r => r.filleul_id).filter(Boolean) as string[]
  const { data: filleuls } = filleulIds.length
    ? await supabaseAdmin
        .from('profiles_artisan')
        .select('id, first_name, company_name')
        .in('id', filleulIds)
    : { data: [] }

  const filleulMap = new Map((filleuls || []).map(f => [f.id, f]))

  const history = referrals.map(r => {
    const filleul = r.filleul_id ? filleulMap.get(r.filleul_id) : null
    return {
      id: r.id,
      filleul_name: filleul?.first_name || filleul?.company_name || 'Artisan',
      date_inscription: r.date_inscription,
      date_recompense: r.date_recompense,
      statut: mapStatutForDisplay(r.statut, r.date_fin_periode_verification),
      mois_offerts: r.mois_offerts_parrain,
    }
  })

  return NextResponse.json({ history })
}

// Statuts simplifiés pour l'artisan (jamais d'infos fraude)
function mapStatutForDisplay(statut: string, dateFinVerification: string | null): { label: string; color: string; detail?: string } {
  switch (statut) {
    case 'inscrit':
      return { label: 'En attente d\'abonnement', color: 'yellow' }
    case 'paiement_valide':
    case 'periode_verification': {
      const daysLeft = dateFinVerification
        ? Math.max(0, Math.ceil((new Date(dateFinVerification).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 7
      return { label: 'En cours de vérification', color: 'blue', detail: `Récompense confirmée dans ${daysLeft}j` }
    }
    case 'recompense_distribuee':
    case 'converti':
      return { label: 'Validé ✅', color: 'green' }
    // fraude_suspectee, bloque → toujours affiché comme "Inactif"
    default:
      return { label: 'Inactif', color: 'gray' }
  }
}
