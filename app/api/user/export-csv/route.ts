// ══════════════════════════════════════════════════════════════════════════════
// GET /api/user/export-csv?type=clients|bookings|revenue
// ══════════════════════════════════════════════════════════════════════════════
// Exports artisan data as CSV file.
// Supports: clients list, bookings/invoices, monthly revenue summary.
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const bom = '\uFEFF' // UTF-8 BOM for Excel compatibility
  const headerLine = headers.map(escapeCsv).join(',')
  const dataLines = rows.map(row =>
    headers.map(h => escapeCsv(row[h])).join(',')
  )
  return bom + [headerLine, ...dataLines].join('\n')
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  // Rate limit: 5 exports per minute
  const allowed = await checkRateLimit(`export_csv_${user.id}`, 5, 60_000)
  if (!allowed) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (!type || !['clients', 'bookings', 'revenue'].includes(type)) {
    return NextResponse.json({ error: 'Type requis: clients, bookings, ou revenue' }, { status: 400 })
  }

  try {
    // Get artisan profile
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!artisan) {
      return NextResponse.json({ error: 'Profil artisan introuvable' }, { status: 404 })
    }

    let csv = ''
    let filename = ''

    if (type === 'clients') {
      // ── Export clients from bookings (join client via auth.users) ──
      const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('client_id, notes, created_at, status, services(name)')
        .eq('artisan_id', artisan.id)
        .order('created_at', { ascending: false })

      // Resolve client info from auth.users via client_id
      const clientIds = [...new Set((bookings || []).map(b => b.client_id).filter(Boolean))]
      const clientMap = new Map<string, { name: string; email: string; phone: string }>()
      for (const cid of clientIds) {
        if (!cid) continue
        try {
          const { data: { user: clientUser } } = await supabaseAdmin.auth.admin.getUserById(cid)
          if (clientUser) {
            clientMap.set(cid, {
              name: clientUser.user_metadata?.full_name || '',
              email: clientUser.email || '',
              phone: clientUser.user_metadata?.phone || '',
            })
          }
        } catch {}
      }

      // Deduplicate by client_id
      const clientRows = new Map<string, Record<string, unknown>>()
      for (const b of bookings || []) {
        const cid = b.client_id || 'unknown'
        const client = clientMap.get(cid) || { name: '', email: '', phone: '' }
        const key = cid
        if (!clientRows.has(key)) {
          clientRows.set(key, {
            nom: client.name,
            email: client.email,
            telephone: client.phone,
            service: ((b.services as unknown as Record<string, unknown>)?.name as string) || '',
            premiere_reservation: b.created_at ? new Date(b.created_at as string).toLocaleDateString('fr-FR') : '',
            nb_reservations: 1,
          })
        } else {
          const existing = clientRows.get(key)!
          existing.nb_reservations = (existing.nb_reservations as number) + 1
        }
      }

      const headers = ['nom', 'email', 'telephone', 'service', 'premiere_reservation', 'nb_reservations']
      csv = toCsv(headers, Array.from(clientRows.values()))
      filename = `clients_${new Date().toISOString().slice(0, 10)}.csv`
    }

    if (type === 'bookings') {
      // ── Export all bookings with correct column names ──
      const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('id, client_id, booking_date, booking_time, status, notes, price_ttc, created_at, services(name)')
        .eq('artisan_id', artisan.id)
        .order('booking_date', { ascending: false })

      // Resolve client names
      const clientIds = [...new Set((bookings || []).map(b => b.client_id).filter(Boolean))]
      const clientMap = new Map<string, { name: string; email: string; phone: string }>()
      for (const cid of clientIds) {
        if (!cid) continue
        try {
          const { data: { user: clientUser } } = await supabaseAdmin.auth.admin.getUserById(cid)
          if (clientUser) {
            clientMap.set(cid, {
              name: clientUser.user_metadata?.full_name || '',
              email: clientUser.email || '',
              phone: clientUser.user_metadata?.phone || '',
            })
          }
        } catch {}
      }

      const rows = (bookings || []).map(b => {
        const client = clientMap.get(b.client_id || '') || { name: '', email: '', phone: '' }
        return {
          date: b.booking_date || '',
          creneau: b.booking_time ? (b.booking_time as string).substring(0, 5) : '',
          client: client.name,
          email: client.email,
          telephone: client.phone,
          service: ((b.services as unknown as Record<string, unknown>)?.name as string) || '',
          statut: b.status || '',
          prix_ttc: b.price_ttc != null ? String(b.price_ttc) : '',
          notes: ((b.notes || '') as string).replace(/\n/g, ' '),
          cree_le: b.created_at ? new Date(b.created_at as string).toLocaleDateString('fr-FR') : '',
        }
      })

      const headers = ['date', 'creneau', 'client', 'email', 'telephone', 'service', 'statut', 'prix_ttc', 'notes', 'cree_le']
      csv = toCsv(headers, rows)
      filename = `reservations_${new Date().toISOString().slice(0, 10)}.csv`
    }

    if (type === 'revenue') {
      // ── Export monthly revenue summary with correct column names ──
      const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('booking_date, price_ttc, status')
        .eq('artisan_id', artisan.id)
        .in('status', ['confirmed', 'completed'])
        .order('booking_date', { ascending: true })

      // Group by month
      const monthMap = new Map<string, { total: number; count: number }>()
      for (const b of bookings || []) {
        if (!b.booking_date || !b.price_ttc) continue
        const month = (b.booking_date as string).slice(0, 7) // YYYY-MM
        const existing = monthMap.get(month) || { total: 0, count: 0 }
        existing.total += Number(b.price_ttc) || 0
        existing.count += 1
        monthMap.set(month, existing)
      }

      const rows = Array.from(monthMap.entries()).map(([month, data]) => ({
        mois: month,
        nb_reservations: data.count,
        revenu_total: data.total.toFixed(2),
        revenu_moyen: data.count > 0 ? (data.total / data.count).toFixed(2) : '0.00',
      }))

      const headers = ['mois', 'nb_reservations', 'revenu_total', 'revenu_moyen']
      csv = toCsv(headers, rows)
      filename = `revenus_${new Date().toISOString().slice(0, 10)}.csv`
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    logger.error('[export-csv] Error:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
