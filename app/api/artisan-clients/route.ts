import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// API pour récupérer tous les clients d'un artisan
// Sources : bookings (notes parsing + client_id) + auth.users metadata
export async function GET(request: NextRequest) {
  const artisanId = request.nextUrl.searchParams.get('artisan_id')

  if (!artisanId) {
    return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' } }
  )

  try {
    // 1. Récupérer tous les bookings de l'artisan avec notes (contient info client)
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, client_id, notes, address, booking_date, status, services(name)')
      .eq('artisan_id', artisanId)
      .order('booking_date', { ascending: false })

    if (bookingsError) {
      return NextResponse.json({ error: bookingsError.message }, { status: 500 })
    }

    // 2. Extraire les client_ids uniques
    const clientIds = [...new Set((bookings || []).filter(b => b.client_id).map(b => b.client_id!))]

    // 3. Récupérer les métadonnées des clients authentifiés
    const clientsMap = new Map<string, any>()

    // Fetch auth users metadata for each client_id
    for (const clientId of clientIds) {
      try {
        const { data: { user }, error } = await supabase.auth.admin.getUserById(clientId)
        if (user && !error) {
          const meta = user.user_metadata || {}
          clientsMap.set(clientId, {
            id: clientId,
            source: 'auth',
            name: meta.full_name || meta.name || '',
            email: user.email || '',
            phone: meta.phone || '',
            address: meta.address || '',
            city: meta.city || '',
            postalCode: meta.postal_code || '',
            siret: meta.siret || '',
          })
        }
      } catch {
        // Skip if user fetch fails
      }
    }

    // 4. Parser les infos clients depuis les notes des bookings (pour les clients non-authentifiés)
    const noteClientsMap = new Map<string, any>()

    for (const booking of (bookings || [])) {
      if (!booking.notes) continue

      // Parse "Client: NOM | Tel: PHONE | Email: EMAIL"
      const noteParts = booking.notes.split(' | ')
      let clientName = ''
      let clientPhone = ''
      let clientEmail = ''

      for (const part of noteParts) {
        const trimmed = part.trim()
        if (trimmed.startsWith('Client:')) {
          clientName = trimmed.replace('Client:', '').replace(/\.\s*$/, '').trim()
        } else if (trimmed.startsWith('Tel:')) {
          clientPhone = trimmed.replace('Tel:', '').trim()
        } else if (trimmed.startsWith('Email:')) {
          clientEmail = trimmed.replace('Email:', '').trim()
        }
      }

      // Also handle simpler format "Client: NOM. notes..."
      if (!clientName) {
        const simpleMatch = booking.notes.match(/Client:\s*([^.|]+)/)
        if (simpleMatch) clientName = simpleMatch[1].trim()
      }

      if (!clientName) continue

      // Si le client est déjà dans la map auth, enrichir ses données
      if (booking.client_id && clientsMap.has(booking.client_id)) {
        const existing = clientsMap.get(booking.client_id)!
        // Update with any missing info
        if (!existing.phone && clientPhone) existing.phone = clientPhone
        if (!existing.email && clientEmail) existing.email = clientEmail
        if (!existing.address && booking.address && booking.address !== 'A definir') {
          existing.address = booking.address
        }
        // Add booking history
        if (!existing.bookings) existing.bookings = []
        existing.bookings.push({
          id: booking.id,
          date: booking.booking_date,
          service: (booking as any).services?.name || '',
          status: booking.status,
        })
        continue
      }

      // Client non-authentifié — trouver par nom (normalisation)
      const nameKey = clientName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

      if (noteClientsMap.has(nameKey)) {
        const existing = noteClientsMap.get(nameKey)!
        // Enrichir
        if (!existing.phone && clientPhone) existing.phone = clientPhone
        if (!existing.email && clientEmail) existing.email = clientEmail
        if (booking.address && booking.address !== 'A definir' && !existing.address) {
          existing.address = booking.address
        }
        if (!existing.bookings) existing.bookings = []
        existing.bookings.push({
          id: booking.id,
          date: booking.booking_date,
          service: (booking as any).services?.name || '',
          status: booking.status,
        })
      } else {
        noteClientsMap.set(nameKey, {
          id: `note_${nameKey}`,
          source: 'booking_notes',
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
          address: (booking.address && booking.address !== 'A definir') ? booking.address : '',
          city: '',
          postalCode: '',
          siret: '',
          bookings: [{
            id: booking.id,
            date: booking.booking_date,
            service: (booking as any).services?.name || '',
            status: booking.status,
          }],
        })
      }
    }

    // 5. Fusionner les deux sources
    // Si un client note correspond à un client auth par nom, fusionner
    const authClients = Array.from(clientsMap.values())
    const noteClients = Array.from(noteClientsMap.values())

    // Try to match note clients with auth clients by name
    const mergedNoteClients = noteClients.filter(nc => {
      const ncNameLower = nc.name.toLowerCase().trim()
      const matchingAuth = authClients.find(ac =>
        ac.name.toLowerCase().trim() === ncNameLower
      )
      if (matchingAuth) {
        // Merge note data into auth client
        if (!matchingAuth.phone && nc.phone) matchingAuth.phone = nc.phone
        if (!matchingAuth.email && nc.email) matchingAuth.email = nc.email
        if (!matchingAuth.address && nc.address) matchingAuth.address = nc.address
        if (nc.bookings) {
          matchingAuth.bookings = [...(matchingAuth.bookings || []), ...nc.bookings]
        }
        return false // Remove from note clients (merged into auth)
      }
      return true // Keep as separate note client
    })

    const allClients = [...authClients, ...mergedNoteClients]
      .filter(c => c.name) // Only keep clients with a name
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

    return NextResponse.json({
      clients: allClients,
      total: allClients.length,
    })

  } catch (error: any) {
    console.error('Error fetching artisan clients:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
