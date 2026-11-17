import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!(await checkRateLimit(`ref_history_${user.id}`, 15, 60_000))) return rateLimitResponse()

    // Fiche du compte connecté. Une panne de la lecture n'est pas une absence de fiche : elle est journalisée et répond
    // 500. maybeSingle : un compte sans fiche (un sous-compte, par exemple) n'est pas une erreur et reçoit toujours 404.
    const { data: artisan, error: artisanError } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (artisanError) {
      logger.error('[referral/history/GET] fiche du compte illisible', { error: artisanError.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    if (!artisan) return NextResponse.json({ error: 'Artisan not found' }, { status: 404 })

    // Charger les referrals avec les infos filleul. Une panne n'est pas un historique vide : elle est journalisée.
    const { data: referrals, error: referralsError } = await supabaseAdmin
      .from('referrals')
      .select('id, statut, date_inscription, date_recompense, date_fin_periode_verification, filleul_id, mois_offerts_parrain')
      .eq('parrain_id', artisan.id)
      .not('statut', 'eq', 'en_attente')
      .order('created_at', { ascending: false })
      .limit(50)

    if (referralsError) {
      logger.error('[referral/history/GET] parrainages illisibles', { error: referralsError.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    if (!referrals?.length) {
      return NextResponse.json({ history: [] })
    }

    // Charger les noms des filleuls. Colonnes réelles de profiles_artisan (relevé de production du 31/10/2026) : la fiche
    // n'a pas de prénom (first_name), et une colonne absente faisait échouer toute la lecture ; chaque filleul
    // s'affichait alors « Artisan ».
    const filleulIds = referrals.map(r => r.filleul_id).filter(Boolean) as string[]
    const { data: filleuls, error: filleulsError } = filleulIds.length
      ? await supabaseAdmin
          .from('profiles_artisan')
          .select('id, company_name')
          .in('id', filleulIds)
      : { data: [], error: null }
    // L'historique reste affiché, avec un nom générique ; l'échec de la lecture est journalisé.
    if (filleulsError) {
      logger.error('[referral/history/GET] noms des filleuls illisibles', { error: filleulsError.message })
    }

    const filleulMap = new Map((filleuls || []).map(f => [f.id, f]))

    const history = referrals.map(r => {
      const filleul = r.filleul_id ? filleulMap.get(r.filleul_id) : null
      return {
        id: r.id,
        filleul_name: filleul?.company_name || 'Artisan',
        date_inscription: r.date_inscription,
        date_recompense: r.date_recompense,
        statut: mapStatutForDisplay(r.statut, r.date_fin_periode_verification),
        mois_offerts: r.mois_offerts_parrain,
      }
    })

    return NextResponse.json({ history })
  } catch (err) {
    console.error('[referral/history/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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
