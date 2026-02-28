import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── POST /api/syndic/assign-mission ──────────────────────────────────────────
// Assigner une mission à un artisan : crée booking sur son agenda + notification
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`assign_mission_${ip}`, 20, 60_000)) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user.user_metadata?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = user.user_metadata?.cabinet_id || user.id
  const body = await request.json()
  const {
    artisan_email,
    artisan_user_id: directUserId,
    artisan_name,
    description,
    type_travaux,
    date_intervention,
    immeuble,
    priorite = 'normale',
    notes = '',
  } = body

  if ((!artisan_email && !directUserId) || !description || !date_intervention) {
    return NextResponse.json({ error: 'artisan_email ou artisan_user_id, description et date_intervention requis' }, { status: 400 })
  }

  // 1. Trouver le compte artisan — par user_id direct OU par email
  let artisanUserId: string | null = null

  if (directUserId) {
    // Vérifier que le user_id existe
    const { data: { user: directUser } } = await supabaseAdmin.auth.admin.getUserById(directUserId)
    if (directUser) artisanUserId = directUser.id
  }

  if (!artisanUserId && artisan_email) {
    // Fallback par email
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
    const artisanUser = users.find(u => u.email?.toLowerCase() === artisan_email.toLowerCase())
    artisanUserId = artisanUser?.id || null
  }

  // 2. Trouver le profil artisan (pour artisan_id dans bookings)
  let artisanProfileId: string | null = null
  if (artisanUserId) {
    const { data: profile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', artisanUserId)
      .maybeSingle()
    artisanProfileId = profile?.id || null
  }

  // 3. Créer le booking dans la table bookings (apparaît sur l'agenda artisan)
  let bookingId: string | null = null
  if (artisanUserId) {
    const dateObj = new Date(date_intervention)
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        artisan_id: artisanProfileId,
        artisan_user_id: artisanUserId,
        syndic_cabinet_id: cabinetId,
        syndic_user_id: user.id,
        client_name: immeuble || 'Cabinet Syndic',
        client_email: user.email,
        service_type: type_travaux || 'Intervention',
        description: description,
        notes: notes || `Mission assignée par ${user.user_metadata?.full_name || 'le syndic'}`,
        intervention_date: dateObj.toISOString().split('T')[0],
        intervention_time: '09:00',
        statut: 'confirme',
        source: 'syndic',
        immeuble: immeuble || '',
        priorite,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (!bookingError && booking) {
      bookingId = booking.id
    }
  }

  // 4. Notification pour l'artisan (fire and forget)
  if (artisanUserId) {
    supabaseAdmin.from('syndic_notifications').insert({
      syndic_id: cabinetId,
      artisan_id: artisanUserId,
      type: 'mission_assignee',
      title: `📅 Nouvelle mission — ${type_travaux || 'Intervention'}`,
      message: `${immeuble ? immeuble + ' — ' : ''}${description} — Le ${new Date(date_intervention).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      read: false,
      created_at: new Date().toISOString(),
    })
  }

  // 5. Message dans le canal de communication (fire and forget)
  if (artisanUserId) {
    const dateFormatted = new Date(date_intervention).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    supabaseAdmin.from('syndic_messages').insert({
      cabinet_id: cabinetId,
      artisan_user_id: artisanUserId,
      sender_id: user.id,
      sender_role: 'syndic',
      sender_name: user.user_metadata?.full_name || 'Syndic',
      content: `📅 **Mission assignée** : ${description}${immeuble ? ` — ${immeuble}` : ''}\n🗓️ Date : ${dateFormatted}\n⚡ Priorité : ${priorite}${notes ? `\n📝 Notes : ${notes}` : ''}`,
      message_type: 'text',
      created_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({
    success: true,
    booking_id: bookingId,
    artisan_found: !!artisanUserId,
    message: artisanUserId
      ? `Mission assignée à ${artisan_name || artisan_email} — notification envoyée sur son agenda`
      : `Mission créée — artisan non trouvé dans Vitfix (email: ${artisan_email})`,
  })
}
