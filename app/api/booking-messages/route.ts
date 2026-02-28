import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET: Fetch messages for a booking
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`bmsg_get_${ip}`, 60, 60_000)) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const bookingId = searchParams.get('booking_id')

  if (!bookingId) {
    return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })
  }

  // Verify user is client or artisan of this booking
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('client_id, artisan_id')
    .eq('id', bookingId)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Check if user is the client
  const isClient = booking.client_id === user.id

  // Check if user is the artisan
  let isArtisan = false
  if (!isClient) {
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
      .eq('id', booking.artisan_id)
      .single()
    isArtisan = !!artisanProfile
  }

  if (!isClient && !isArtisan) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  // Fetch messages
  const { data: messages, error } = await supabaseAdmin
    .from('booking_messages')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    console.error('Error fetching booking messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  // Mark unread messages from the other party as read
  const myRole = isClient ? 'client' : 'artisan'
  const otherRole = isClient ? 'artisan' : 'client'
  await supabaseAdmin
    .from('booking_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .in('sender_role', [otherRole, 'system'])
    .is('read_at', null)

  return NextResponse.json({ data: messages, role: myRole })
}

// POST: Send a message
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const ip = getClientIP(request)
    if (!checkRateLimit(`bmsg_post_${ip}`, 30, 60_000)) return rateLimitResponse()

    const body = await request.json()
    const { booking_id, content } = body

    if (!booking_id || !content?.trim()) {
      return NextResponse.json({ error: 'booking_id and content are required' }, { status: 400 })
    }

    // Verify user is client or artisan of this booking
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('client_id, artisan_id, notes')
      .eq('id', booking_id)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const isClient = booking.client_id === user.id
    let isArtisan = false
    let artisanUserId = ''

    if (!isClient) {
      const { data: artisanProfile } = await supabaseAdmin
        .from('profiles_artisan')
        .select('id, user_id, company_name')
        .eq('user_id', user.id)
        .eq('id', booking.artisan_id)
        .single()
      isArtisan = !!artisanProfile
      if (artisanProfile) artisanUserId = artisanProfile.user_id
    }

    if (!isClient && !isArtisan) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const senderRole = isClient ? 'client' : 'artisan'
    const senderName = user.user_metadata?.full_name || user.user_metadata?.company_name || user.email?.split('@')[0] || ''

    const { data, error } = await supabaseAdmin
      .from('booking_messages')
      .insert({
        booking_id,
        sender_id: user.id,
        sender_role: senderRole,
        sender_name: senderName,
        content: String(content).trim().substring(0, 2000),
        type: 'text',
      })
      .select()
      .single()

    if (error) {
      console.error('Error sending booking message:', error)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // If client sent the message, notify the artisan
    if (isClient) {
      try {
        const { data: artisanProfile } = await supabaseAdmin
          .from('profiles_artisan')
          .select('user_id')
          .eq('id', booking.artisan_id)
          .single()

        if (artisanProfile?.user_id) {
          const clientMatch = (booking.notes || '').match(/Client:\s*([^|]+)/)
          const clientName = clientMatch ? clientMatch[1].trim() : 'Un client'

          await supabaseAdmin
            .from('artisan_notifications')
            .insert({
              artisan_id: artisanProfile.user_id,
              type: 'booking_message',
              title: '💬 Nouveau message',
              body: `${clientName} : "${String(content).trim().substring(0, 100)}"`,
              read: false,
              data_json: { booking_id },
              created_at: new Date().toISOString(),
            })
        }
      } catch (notifErr) {
        console.error('Error sending message notification:', notifErr)
      }
    }

    return NextResponse.json({ data })
  } catch (e: unknown) {
    console.error('Server error sending booking message:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
