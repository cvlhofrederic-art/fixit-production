import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { bookingMessageSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'

const MESSAGE_LIMIT = 200
const VALID_MSG_TYPES = ['text', 'photo', 'voice', 'devis_sent', 'devis_signed'] as const
type MsgType = (typeof VALID_MSG_TYPES)[number]

// ── Shared auth helper ────────────────────────────────────────────────────────
// Verifies booking ownership in 1-2 queries max.
// When sender is the artisan, returns the artisan profile so it can be reused downstream.
async function verifyBookingAccess(bookingId: string, userId: string) {
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('client_id, artisan_id')
    .eq('id', bookingId)
    .single()

  if (!booking) return { booking: null, isClient: false, isArtisan: false, artisanUserId: '' }

  const isClient = booking.client_id === userId
  let isArtisan = false
  let artisanUserId = ''

  if (!isClient) {
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, user_id')
      .eq('user_id', userId)
      .eq('id', booking.artisan_id)
      .single()
    isArtisan = !!artisanProfile
    if (artisanProfile) artisanUserId = artisanProfile.user_id
  }

  return { booking, isClient, isArtisan, artisanUserId }
}

function getMsgPreview(type: MsgType, content: string): string {
  if (type === 'photo') return '📷 Photo'
  if (type === 'voice') return '🎤 Vocal'
  return content.substring(0, 100)
}

// GET: Fetch messages for a booking
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`bmsg_get_${ip}`, 60, 60_000))) return rateLimitResponse()

  const bookingId = new URL(request.url).searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })

  const { booking, isClient, isArtisan } = await verifyBookingAccess(bookingId, user.id)
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!isClient && !isArtisan) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

  const { data: messages, error } = await supabaseAdmin
    .from('booking_messages')
    .select('id, booking_id, sender_id, sender_role, sender_name, content, type, metadata, attachment_url, read_at, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
    .limit(MESSAGE_LIMIT)

  if (error) {
    logger.error('[booking-messages] GET fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  // Mark messages from the other party as read — fire-and-forget, not critical
  const otherRole = isClient ? 'artisan' : 'client'
  supabaseAdmin
    .from('booking_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .in('sender_role', [otherRole, 'system'])
    .is('read_at', null)
    .then(({ error: updateErr }) => {
      if (updateErr) logger.error('[booking-messages] mark-read error:', updateErr)
    })

  const myRole = isClient ? 'client' : 'artisan'
  return NextResponse.json({ data: messages, role: myRole })
}

// POST: Send a message
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const ip = getClientIP(request)
    if (!(await checkRateLimit(`bmsg_post_${ip}`, 30, 60_000))) return rateLimitResponse()

    const body = await request.json()
    const validation = validateBody(bookingMessageSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }

    const { booking_id, content, type: msgType, attachment_url, metadata } = body

    if (!booking_id) return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })

    const finalType: MsgType = VALID_MSG_TYPES.includes(msgType) ? msgType : 'text'

    if (finalType === 'text' && !content?.trim()) {
      return NextResponse.json({ error: 'content is required for text messages' }, { status: 400 })
    }
    if ((finalType === 'photo' || finalType === 'voice') && !attachment_url) {
      return NextResponse.json({ error: 'attachment_url is required for photo/voice messages' }, { status: 400 })
    }
    if (finalType === 'devis_sent' && (!metadata?.docNumber || !metadata?.totalStr)) {
      return NextResponse.json({ error: 'metadata.docNumber and metadata.totalStr required for devis_sent' }, { status: 400 })
    }

    const { booking, isClient, isArtisan, artisanUserId } = await verifyBookingAccess(booking_id, user.id)
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (!isClient && !isArtisan) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })

    const senderRole = isClient ? 'client' : 'artisan'
    const senderName = user.user_metadata?.full_name || user.user_metadata?.company_name || user.email?.split('@')[0] || ''
    const trimmedContent = content ? String(content).trim().substring(0, 2000) : ''

    const insertPayload: Record<string, unknown> = {
      booking_id,
      sender_id: user.id,
      sender_role: senderRole,
      sender_name: senderName,
      content: trimmedContent,
      type: finalType,
    }
    if (attachment_url) insertPayload.attachment_url = attachment_url
    if (metadata && typeof metadata === 'object') insertPayload.metadata = metadata

    const { data, error } = await supabaseAdmin
      .from('booking_messages')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      logger.error('[booking-messages] POST insert error:', error)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Side effects are non-blocking — failures must not affect the HTTP response
    if (isClient) {
      mirrorClientMessage({
        bookingId: booking_id,
        artisanProfileId: booking.artisan_id,
        clientId: user.id,
        clientName: senderName,
        content: trimmedContent,
        finalType,
        metadata,
      }).catch(err => logger.error('[booking-messages] mirror client→artisan error:', err))
    }

    if (isArtisan && artisanUserId) {
      mirrorArtisanMessage({
        artisanUserId,
        clientId: booking.client_id,
        bookingId: booking_id,
        content: trimmedContent,
        finalType,
        metadata,
      }).catch(err => logger.error('[booking-messages] mirror artisan→conversation error:', err))
    }

    return NextResponse.json({ data })
  } catch (e: unknown) {
    logger.error('[booking-messages] POST server error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ── Side-effect helpers ───────────────────────────────────────────────────────
// Called non-blocking with .catch() — failures are logged but do not affect responses.

async function mirrorClientMessage({
  bookingId, artisanProfileId, clientId, clientName, content, finalType, metadata,
}: {
  bookingId: string
  artisanProfileId: string
  clientId: string
  clientName: string
  content: string
  finalType: MsgType
  metadata: unknown
}) {
  const { data: artisanProfile } = await supabaseAdmin
    .from('profiles_artisan')
    .select('user_id')
    .eq('id', artisanProfileId)
    .single()

  if (!artisanProfile?.user_id) return

  const artisanUserId = artisanProfile.user_id

  // Build notification text based on message type
  let notifTitle = '💬 Nouveau message'
  let notifBody = `${clientName} : "${content.substring(0, 100)}"`
  if (finalType === 'photo') {
    notifTitle = '📷 Photo reçue'
    notifBody = `${clientName} vous a envoyé une photo`
  } else if (finalType === 'voice') {
    notifTitle = '🎤 Message vocal'
    notifBody = `${clientName} vous a envoyé un message vocal`
  } else if (finalType === 'devis_signed') {
    const docNr = (metadata as Record<string, unknown>)?.docNumber
    notifTitle = '✅ Devis signé'
    notifBody = `${clientName} a signé le devis${docNr ? ' N°' + docNr : ''}`
  }

  await supabaseAdmin
    .from('artisan_notifications')
    .insert({
      artisan_id: artisanUserId,
      type: finalType === 'devis_signed' ? 'devis_signed' : 'booking_message',
      title: notifTitle,
      body: notifBody,
      read: false,
      data_json: { booking_id: bookingId, type: finalType, metadata },
      created_at: new Date().toISOString(),
    })

  // Mirror to conversations (find or create)
  const msgPreview = getMsgPreview(finalType, content)
  const now = new Date().toISOString()

  let { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id, unread_count')
    .eq('artisan_id', artisanUserId)
    .eq('contact_id', clientId)
    .single()

  if (!conv) {
    const { data: newConv } = await supabaseAdmin
      .from('conversations')
      .insert({
        artisan_id: artisanUserId,
        contact_id: clientId,
        contact_type: 'particulier',
        contact_name: clientName,
        contact_avatar: '',
        last_message_at: now,
        last_message_preview: msgPreview,
        unread_count: 1,
      })
      .select('id, unread_count')
      .single()
    conv = newConv
  } else {
    await supabaseAdmin
      .from('conversations')
      .update({
        last_message_at: now,
        last_message_preview: msgPreview,
        unread_count: (conv.unread_count || 0) + 1,
      })
      .eq('id', conv.id)
  }

  if (conv) {
    const docNr = (metadata as Record<string, unknown>)?.docNumber
    await supabaseAdmin
      .from('conversation_messages')
      .insert({
        conversation_id: conv.id,
        sender_id: clientId,
        type: finalType === 'devis_signed' ? 'text' : finalType,
        content: finalType === 'devis_signed' ? `✅ Devis signé${docNr ? ' N°' + docNr : ''}` : content,
        metadata: {
          booking_id: bookingId,
          source: 'booking_message',
          original_type: finalType,
          ...(typeof metadata === 'object' && metadata ? (metadata as object) : {}),
        },
        read: false,
      })
  }
}

async function mirrorArtisanMessage({
  artisanUserId, clientId, bookingId, content, finalType, metadata,
}: {
  artisanUserId: string
  clientId: string
  bookingId: string
  content: string
  finalType: MsgType
  metadata: unknown
}) {
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('artisan_id', artisanUserId)
    .eq('contact_id', clientId)
    .single()

  if (!conv) return

  const sharedMetadata = {
    booking_id: bookingId,
    source: 'booking_message',
    original_type: finalType,
    ...(typeof metadata === 'object' && metadata ? (metadata as object) : {}),
  }

  // Parallel: insert message + update conversation preview
  await Promise.all([
    supabaseAdmin.from('conversation_messages').insert({
      conversation_id: conv.id,
      sender_id: artisanUserId,
      type: finalType || 'text',
      content: content || '',
      metadata: sharedMetadata,
      read: true,
    }),
    supabaseAdmin
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: getMsgPreview(finalType, content),
      })
      .eq('id', conv.id),
  ])
}
