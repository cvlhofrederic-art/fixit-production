import { supabaseAdmin } from '@/lib/supabase-server'

// ── Types ────────────────────────────────────────────────────────────────────
export type ToolResult = {
  success: boolean
  detail: string
  data?: unknown
}

type ToolExecutor = (params: Record<string, unknown>, artisanId: string) => Promise<ToolResult>

type ToolDef = {
  description: string
  params: string
  requiresConfirmation: boolean
  execute: ToolExecutor
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

// ── Validation helpers ───────────────────────────────────────────────────────
const DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function validateDate(v: unknown): string | null {
  const s = String(v || '')
  return DATE_RE.test(s) ? s : null
}
function validateTime(v: unknown): string | null {
  const s = String(v || '')
  return TIME_RE.test(s) ? s : null
}

// ── Tool Registry ────────────────────────────────────────────────────────────

export const TOOLS: Record<string, ToolDef> = {

  // ───────────── DISPONIBILITÉS ─────────────

  list_availability: {
    description: 'Afficher les disponibilités actuelles (jours, horaires)',
    params: '(aucun)',
    requiresConfirmation: false,
    execute: async (_p, artisanId) => {
      const { data } = await supabaseAdmin
        .from('availability').select('*').eq('artisan_id', artisanId).order('day_of_week')
      if (!data || data.length === 0) return { success: true, detail: 'Aucune disponibilité configurée.', data: [] }
      const lines = data.map(a =>
        `${DAY_NAMES[a.day_of_week]}: ${a.is_available ? `${a.start_time?.substring(0, 5)}-${a.end_time?.substring(0, 5)}` : 'FERMÉ'}`
      )
      return { success: true, detail: lines.join('\n'), data }
    },
  },

  set_day_availability: {
    description: 'Activer ou désactiver un jour (ou tous les jours). day_of_week: 0=Dimanche..6=Samedi ou "all"',
    params: '{ day_of_week: number|"all", is_available: boolean }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      const days: number[] = p.day_of_week === 'all' ? [0, 1, 2, 3, 4, 5, 6] : [Number(p.day_of_week)]
      const isAvail = Boolean(p.is_available)
      const results: string[] = []

      for (const day of days) {
        if (day < 0 || day > 6) continue
        const { data: existing } = await supabaseAdmin
          .from('availability').select('*').eq('artisan_id', artisanId).eq('day_of_week', day).single()

        if (existing) {
          await supabaseAdmin.from('availability').update({ is_available: isAvail }).eq('id', existing.id)
        } else if (isAvail) {
          await supabaseAdmin.from('availability').insert({
            artisan_id: artisanId, day_of_week: day, start_time: '08:00', end_time: '17:00', is_available: true,
          })
        }
        results.push(DAY_NAMES[day])
      }
      return {
        success: true,
        detail: `${results.length} jour(s) ${isAvail ? 'activé(s)' : 'désactivé(s)'} : ${results.join(', ')}`,
      }
    },
  },

  update_availability_hours: {
    description: 'Modifier les horaires d\'un jour. day_of_week: 0-6 ou "all"',
    params: '{ day_of_week: number|"all", start_time?: "HH:MM", end_time?: "HH:MM" }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      const days: number[] = p.day_of_week === 'all' ? [0, 1, 2, 3, 4, 5, 6] : [Number(p.day_of_week)]
      const updates: Record<string, string> = {}
      if (p.start_time) {
        const t = validateTime(p.start_time)
        if (!t) return { success: false, detail: `Heure de début invalide : "${p.start_time}". Format attendu : HH:MM` }
        updates.start_time = t
      }
      if (p.end_time) {
        const t = validateTime(p.end_time)
        if (!t) return { success: false, detail: `Heure de fin invalide : "${p.end_time}". Format attendu : HH:MM` }
        updates.end_time = t
      }
      if (Object.keys(updates).length === 0) return { success: false, detail: 'Aucun horaire fourni.' }

      const results: string[] = []
      for (const day of days) {
        if (day < 0 || day > 6) continue
        const { data: existing } = await supabaseAdmin
          .from('availability').select('id, is_available').eq('artisan_id', artisanId).eq('day_of_week', day).single()

        if (existing) {
          await supabaseAdmin.from('availability').update(updates).eq('id', existing.id)
          results.push(DAY_NAMES[day])
        } else {
          // Create the day with given hours
          await supabaseAdmin.from('availability').insert({
            artisan_id: artisanId, day_of_week: day, is_available: true,
            start_time: String(p.start_time || '08:00'), end_time: String(p.end_time || '17:00'),
          })
          results.push(DAY_NAMES[day])
        }
      }
      const timeDesc = [p.start_time && `début ${p.start_time}`, p.end_time && `fin ${p.end_time}`].filter(Boolean).join(', ')
      return { success: true, detail: `Horaires mis à jour (${timeDesc}) pour : ${results.join(', ')}` }
    },
  },

  // ───────────── SERVICES / MOTIFS ─────────────

  list_services: {
    description: 'Afficher tous les services/motifs de l\'artisan',
    params: '(aucun)',
    requiresConfirmation: false,
    execute: async (_p, artisanId) => {
      const { data } = await supabaseAdmin
        .from('services').select('*').eq('artisan_id', artisanId).order('name')
      if (!data || data.length === 0) return { success: true, detail: 'Aucun service configuré.', data: [] }
      const lines = data.map(s =>
        `${s.active ? '✅' : '❌'} ${s.name} — ${s.price_ttc ? s.price_ttc + '€' : 'prix libre'} — ${s.duration_minutes || 60}min`
      )
      return { success: true, detail: lines.join('\n'), data }
    },
  },

  toggle_service_active: {
    description: 'Activer ou désactiver un service. service_id: UUID ou "all"',
    params: '{ service_id: string|"all", active: boolean }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      const active = Boolean(p.active)
      if (p.service_id === 'all') {
        const { data } = await supabaseAdmin
          .from('services').update({ active }).eq('artisan_id', artisanId).select('id')
        const count = data?.length || 0
        return { success: true, detail: `${count} service(s) ${active ? 'activé(s)' : 'désactivé(s)'}` }
      }
      const { error } = await supabaseAdmin
        .from('services').update({ active }).eq('id', String(p.service_id)).eq('artisan_id', artisanId)
      if (error) return { success: false, detail: `Erreur : ${error.message}` }
      return { success: true, detail: `Service ${active ? 'activé' : 'désactivé'}` }
    },
  },

  create_service: {
    description: 'Créer un nouveau service/motif',
    params: '{ name: string, duration_minutes?: number, price_ht?: number, price_ttc?: number, description?: string }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      const { data, error } = await supabaseAdmin.from('services').insert({
        artisan_id: artisanId,
        name: String(p.name),
        duration_minutes: Number(p.duration_minutes) || 60,
        price_ht: Number(p.price_ht) || 0,
        price_ttc: Number(p.price_ttc) || 0,
        description: p.description ? String(p.description) : '',
        active: true,
      }).select().single()
      if (error) return { success: false, detail: `Erreur création : ${error.message}` }
      return { success: true, detail: `Service "${data.name}" créé`, data }
    },
  },

  update_service: {
    description: 'Modifier un service existant (nom, prix, durée)',
    params: '{ service_id: string, name?: string, price_ht?: number, price_ttc?: number, duration_minutes?: number, description?: string }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      if (!p.service_id) return { success: false, detail: 'service_id requis.' }
      const updates: Record<string, unknown> = {}
      if (p.name !== undefined) updates.name = String(p.name)
      if (p.price_ht !== undefined) updates.price_ht = Number(p.price_ht)
      if (p.price_ttc !== undefined) updates.price_ttc = Number(p.price_ttc)
      if (p.duration_minutes !== undefined) updates.duration_minutes = Number(p.duration_minutes)
      if (p.description !== undefined) updates.description = String(p.description)
      if (Object.keys(updates).length === 0) return { success: false, detail: 'Aucun champ à modifier.' }

      const { data, error } = await supabaseAdmin
        .from('services').update(updates).eq('id', String(p.service_id)).eq('artisan_id', artisanId).select('name').single()
      if (error) return { success: false, detail: `Erreur : ${error.message}` }
      return { success: true, detail: `Service "${data?.name}" mis à jour (${Object.keys(updates).join(', ')})` }
    },
  },

  delete_service: {
    description: 'Supprimer un service/motif (irréversible)',
    params: '{ service_id: string }',
    requiresConfirmation: true,
    execute: async (p, artisanId) => {
      const { error } = await supabaseAdmin
        .from('services').delete().eq('id', String(p.service_id)).eq('artisan_id', artisanId)
      if (error) return { success: false, detail: `Erreur suppression : ${error.message}` }
      return { success: true, detail: 'Service supprimé' }
    },
  },

  // ───────────── LIAISON SERVICES ↔ JOURS ─────────────

  link_services_to_days: {
    description: 'Lier des services à des jours de disponibilité. day_of_week: 0-6 ou "all". service_ids: liste d\'UUIDs ou "all". mode: "add"|"remove"|"set"',
    params: '{ day_of_week: number|"all", service_ids: string[]|"all", mode: "add"|"remove"|"set" }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      // 1. Read current dayServices from bio marker
      const { data: artisan } = await supabaseAdmin
        .from('profiles_artisan').select('bio').eq('id', artisanId).single()

      let dayServices: Record<string, string[]> = {}
      if (artisan?.bio) {
        const match = artisan.bio.match(/<!--DS:(.*?)-->/)
        if (match) {
          try {
            const parsed = JSON.parse(match[1])
            if (parsed && typeof parsed === 'object') dayServices = parsed
          } catch (e) {
            console.error('link_services_to_days: corrupted DS marker, starting fresh:', e)
            // Don't lose existing marker — keep dayServices empty and let the new operation create it
          }
        }
      }

      // 2. Resolve "all" for service_ids
      let serviceIds: string[]
      if (p.service_ids === 'all') {
        const { data: allSvc } = await supabaseAdmin
          .from('services').select('id').eq('artisan_id', artisanId).eq('active', true)
        serviceIds = (allSvc || []).map(s => s.id)
      } else {
        serviceIds = Array.isArray(p.service_ids) ? p.service_ids.map(String) : [String(p.service_ids)]
      }

      // 3. Resolve "all" for days
      let days: number[]
      if (p.day_of_week === 'all') {
        const { data: avail } = await supabaseAdmin
          .from('availability').select('day_of_week').eq('artisan_id', artisanId).eq('is_available', true)
        days = (avail || []).map(a => a.day_of_week)
      } else {
        days = [Number(p.day_of_week)]
      }

      // 4. Apply mode
      const mode = String(p.mode || 'set')
      for (const day of days) {
        const key = String(day)
        const current = dayServices[key] || []
        if (mode === 'set') {
          dayServices[key] = [...serviceIds]
        } else if (mode === 'add') {
          dayServices[key] = [...new Set([...current, ...serviceIds])]
        } else if (mode === 'remove') {
          dayServices[key] = current.filter(id => !serviceIds.includes(id))
        }
      }

      // 5. Save back to bio marker
      const cleanBio = (artisan?.bio || '').replace(/\s*<!--DS:[\s\S]*?-->/, '').trim()
      const hasConfig = Object.values(dayServices).some(arr => arr.length > 0)
      const marker = hasConfig ? ` <!--DS:${JSON.stringify(dayServices)}-->` : ''
      await supabaseAdmin.from('profiles_artisan').update({ bio: `${cleanBio}${marker}` }).eq('id', artisanId)

      return {
        success: true,
        detail: `${serviceIds.length} service(s) ${mode === 'remove' ? 'retiré(s) de' : 'lié(s) à'} ${days.map(d => DAY_NAMES[d]).join(', ')}`,
        data: dayServices,
      }
    },
  },

  // ───────────── RÉSERVATIONS ─────────────

  list_bookings: {
    description: 'Lister les RDV. status: "pending"|"confirmed"|"cancelled"|"completed"|"all". period: "upcoming"|"past"|"today"|"this_week"',
    params: '{ status?: string, period?: string, limit?: number }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      const today = new Date().toISOString().split('T')[0]
      let query = supabaseAdmin
        .from('bookings').select('*, services(name)').eq('artisan_id', artisanId)

      const status = String(p.status || 'all')
      if (status !== 'all') query = query.eq('status', status)

      const period = String(p.period || 'upcoming')
      if (period === 'upcoming') query = query.gte('booking_date', today).order('booking_date')
      else if (period === 'past') query = query.lt('booking_date', today).order('booking_date', { ascending: false })
      else if (period === 'today') query = query.eq('booking_date', today)
      else query = query.order('booking_date', { ascending: false })

      const limit = Math.min(Number(p.limit) || 10, 20)
      query = query.limit(limit)

      const { data } = await query
      if (!data || data.length === 0) return { success: true, detail: 'Aucun RDV trouvé.', data: [] }

      const lines = data.map(b => {
        const clientMatch = (b.notes || '').match(/Client:\s*([^|.]+)/)
        const client = clientMatch ? clientMatch[1].trim() : 'Client inconnu'
        return `${b.booking_date} à ${(b.booking_time || '').substring(0, 5)} — ${b.services?.name || 'Intervention'} — ${client} (${b.status})`
      })
      return { success: true, detail: lines.join('\n'), data }
    },
  },

  confirm_booking: {
    description: 'Confirmer un RDV en attente',
    params: '{ booking_id: string }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      const { error } = await supabaseAdmin
        .from('bookings')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', String(p.booking_id)).eq('artisan_id', artisanId)
      if (error) return { success: false, detail: `Erreur : ${error.message}` }
      return { success: true, detail: 'RDV confirmé' }
    },
  },

  cancel_booking: {
    description: 'Annuler un RDV (irréversible)',
    params: '{ booking_id: string }',
    requiresConfirmation: true,
    execute: async (p, artisanId) => {
      const { error } = await supabaseAdmin
        .from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', String(p.booking_id)).eq('artisan_id', artisanId)
      if (error) return { success: false, detail: `Erreur : ${error.message}` }
      return { success: true, detail: 'RDV annulé' }
    },
  },

  reschedule_booking: {
    description: 'Déplacer un RDV à une autre date/heure',
    params: '{ booking_id: string, new_date?: "YYYY-MM-DD", new_time?: "HH:MM" }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      if (!p.booking_id) return { success: false, detail: 'booking_id requis.' }
      const updates: Record<string, string> = {}
      if (p.new_date) {
        const d = validateDate(p.new_date)
        if (!d) return { success: false, detail: `Date invalide : "${p.new_date}". Format attendu : YYYY-MM-DD` }
        updates.booking_date = d
      }
      if (p.new_time) {
        const t = validateTime(p.new_time)
        if (!t) return { success: false, detail: `Heure invalide : "${p.new_time}". Format attendu : HH:MM` }
        updates.booking_time = t
      }
      if (Object.keys(updates).length === 0) return { success: false, detail: 'Aucune nouvelle date/heure fournie.' }

      const { error } = await supabaseAdmin
        .from('bookings').update(updates).eq('id', String(p.booking_id)).eq('artisan_id', artisanId)
      if (error) return { success: false, detail: `Erreur : ${error.message}` }
      const desc = [updates.booking_date && `le ${updates.booking_date}`, updates.booking_time && `à ${updates.booking_time}`].filter(Boolean).join(' ')
      return { success: true, detail: `RDV déplacé ${desc}` }
    },
  },

  create_rdv: {
    description: 'Créer un nouveau RDV',
    params: '{ client_name: string, date: "YYYY-MM-DD", time: "HH:MM", service_id?: string, address?: string, notes?: string, duration_minutes?: number }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      // Validate date and time
      const date = validateDate(p.date)
      if (!date) return { success: false, detail: `Date invalide : "${p.date}". Format attendu : YYYY-MM-DD` }
      const time = validateTime(p.time)
      if (!time) return { success: false, detail: `Heure invalide : "${p.time}". Format attendu : HH:MM` }
      if (!p.client_name) return { success: false, detail: 'Nom du client requis.' }

      // Validate service_id belongs to artisan (if provided)
      let serviceId: string | null = null
      let priceTTC = 0
      let priceHT = 0
      let duration = Number(p.duration_minutes) || 60
      if (p.service_id) {
        const { data: svc } = await supabaseAdmin
          .from('services').select('id, price_ht, price_ttc, duration_minutes')
          .eq('id', String(p.service_id)).eq('artisan_id', artisanId).single()
        if (svc) {
          serviceId = svc.id
          priceTTC = svc.price_ttc || 0
          priceHT = svc.price_ht || 0
          duration = svc.duration_minutes || duration
        }
      }

      const notes = `Client: ${p.client_name}${p.notes ? ` | ${p.notes}` : ''}`
      const { data, error } = await supabaseAdmin.from('bookings').insert({
        artisan_id: artisanId,
        service_id: serviceId,
        booking_date: date,
        booking_time: time,
        duration_minutes: duration,
        address: p.address ? String(p.address) : 'A definir',
        notes,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        price_ht: priceHT,
        price_ttc: priceTTC,
      }).select().single()
      if (error) return { success: false, detail: `Erreur création RDV : ${error.message}` }
      return { success: true, detail: `RDV créé le ${date} à ${time} avec ${p.client_name}`, data }
    },
  },

  // ───────────── PROFIL ─────────────

  update_profile: {
    description: 'Modifier le profil artisan (bio, company_name, zone_radius_km)',
    params: '{ company_name?: string, bio?: string, zone_radius_km?: number }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      const updates: Record<string, unknown> = {}
      if (p.company_name !== undefined) updates.company_name = String(p.company_name)
      if (p.zone_radius_km !== undefined) updates.zone_radius_km = Number(p.zone_radius_km)
      if (p.bio !== undefined) {
        // Preserve the DS marker if exists
        const { data: current, error: fetchErr } = await supabaseAdmin
          .from('profiles_artisan').select('bio').eq('id', artisanId).single()
        if (fetchErr) return { success: false, detail: `Profil introuvable : ${fetchErr.message}` }
        const dsMatch = current?.bio?.match(/\s*<!--DS:[\s\S]*?-->/)
        const dsMarker = dsMatch ? dsMatch[0] : ''
        updates.bio = String(p.bio) + dsMarker
      }
      if (Object.keys(updates).length === 0) return { success: false, detail: 'Aucun champ à modifier.' }

      const { error } = await supabaseAdmin
        .from('profiles_artisan').update(updates).eq('id', artisanId)
      if (error) return { success: false, detail: `Erreur : ${error.message}` }
      const fields = Object.keys(updates).join(', ')
      return { success: true, detail: `Profil mis à jour (${fields})` }
    },
  },

  // ───────────── CLIENTS ─────────────

  list_clients: {
    description: 'Lister tous les clients de l\'artisan (nom, téléphone, email, nombre de RDV, CA total)',
    params: '{ search?: string }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('client_id, booking_date, status, notes, price_ttc')
        .eq('artisan_id', artisanId)
        .not('client_id', 'is', null)
        .order('booking_date', { ascending: false })

      if (!bookings || bookings.length === 0)
        return { success: true, detail: 'Aucun client trouve.', data: [] }

      const byClient = new Map<string, any[]>()
      for (const b of bookings) {
        if (!b.client_id) continue
        if (!byClient.has(b.client_id)) byClient.set(b.client_id, [])
        byClient.get(b.client_id)!.push(b)
      }

      const clients: any[] = []
      for (const [cId, cBookings] of byClient.entries()) {
        try {
          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(cId)
          if (!user) continue
          const meta = user.user_metadata || {}
          clients.push({
            id: cId,
            name: meta.full_name || meta.name || user.email?.split('@')[0] || 'Client',
            email: user.email || '',
            phone: meta.phone || '',
            bookings_count: cBookings.length,
            last_booking: cBookings[0]?.booking_date || '',
            total_ca: Math.round(cBookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.price_ttc || 0), 0) * 100) / 100,
          })
        } catch { /* skip */ }
      }

      if (p.search) {
        const search = String(p.search).toLowerCase()
        const filtered = clients.filter(c =>
          c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search) || (c.phone || '').includes(search)
        )
        if (filtered.length === 0) return { success: true, detail: `Aucun client trouve pour "${p.search}".`, data: [] }
        const lines = filtered.map(c => `${c.name} | ${c.phone || '-'} | ${c.email || '-'} | ${c.bookings_count} RDV | CA: ${c.total_ca}E`)
        return { success: true, detail: lines.join('\n'), data: filtered }
      }

      const lines = clients.map(c => `${c.name} | ${c.phone || '-'} | ${c.email || '-'} | ${c.bookings_count} RDV | CA: ${c.total_ca}E`)
      return { success: true, detail: `${clients.length} client(s) :\n${lines.join('\n')}`, data: clients }
    },
  },

  get_client_details: {
    description: 'Obtenir les details d\'un client (infos, historique RDV, CA total). Chercher par nom.',
    params: '{ client_name: string }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      if (!p.client_name) return { success: false, detail: 'Nom du client requis.' }
      const search = String(p.client_name).toLowerCase()

      const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('client_id, booking_date, booking_time, status, notes, price_ttc, services(name)')
        .eq('artisan_id', artisanId)
        .not('client_id', 'is', null)
        .order('booking_date', { ascending: false })

      if (!bookings || bookings.length === 0) return { success: true, detail: 'Aucun client trouve.' }

      const clientIds = [...new Set(bookings.map(b => b.client_id).filter(Boolean))]
      let matchedClient: any = null
      let matchedBookings: any[] = []

      for (const cId of clientIds) {
        try {
          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(cId)
          if (!user) continue
          const meta = user.user_metadata || {}
          const name = meta.full_name || meta.name || user.email?.split('@')[0] || ''
          if (name.toLowerCase().includes(search) || (user.email || '').toLowerCase().includes(search)) {
            matchedClient = { id: cId, name, email: user.email || '', phone: meta.phone || '', address: meta.address || '' }
            matchedBookings = bookings.filter(b => b.client_id === cId)
            break
          }
        } catch { /* skip */ }
      }

      if (!matchedClient) return { success: true, detail: `Aucun client "${p.client_name}" trouve.` }

      const totalCA = Math.round(matchedBookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.price_ttc || 0), 0) * 100) / 100
      const rdvLines = matchedBookings.slice(0, 10).map(b =>
        `  ${b.booking_date} ${(b.booking_time || '').substring(0, 5)} — ${(b as any).services?.name || 'Intervention'} — ${b.status} — ${b.price_ttc || 0}E`
      )

      const detail = [
        `Nom : ${matchedClient.name}`,
        `Email : ${matchedClient.email || '-'}`,
        `Tel : ${matchedClient.phone || '-'}`,
        `Adresse : ${matchedClient.address || '-'}`,
        `Total RDV : ${matchedBookings.length} | CA total : ${totalCA}E`,
        `\nDerniers RDV :`,
        ...rdvLines,
      ].join('\n')

      return { success: true, detail, data: { client: matchedClient, bookings: matchedBookings, total_ca: totalCA } }
    },
  },

  // ───────────── MESSAGES ─────────────

  list_booking_messages: {
    description: 'Lister les messages d\'un RDV (conversation client-artisan)',
    params: '{ booking_id: string }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      if (!p.booking_id) return { success: false, detail: 'booking_id requis.' }

      const { data: booking } = await supabaseAdmin
        .from('bookings').select('id, artisan_id')
        .eq('id', String(p.booking_id)).eq('artisan_id', artisanId).single()
      if (!booking) return { success: false, detail: 'RDV introuvable ou non autorise.' }

      const { data: messages } = await supabaseAdmin
        .from('booking_messages').select('*')
        .eq('booking_id', String(p.booking_id))
        .order('created_at', { ascending: true }).limit(50)

      if (!messages || messages.length === 0)
        return { success: true, detail: 'Aucun message pour ce RDV.', data: [] }

      const lines = messages.map(m =>
        `[${m.sender_role === 'artisan' ? 'Vous' : m.sender_name || 'Client'}] ${(m.content || '').substring(0, 150)}`
      )
      return { success: true, detail: `${messages.length} message(s) :\n${lines.join('\n')}`, data: messages }
    },
  },

  send_booking_message: {
    description: 'Envoyer un message dans la conversation d\'un RDV',
    params: '{ booking_id: string, content: string }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      if (!p.booking_id || !p.content) return { success: false, detail: 'booking_id et content requis.' }

      const { data: booking } = await supabaseAdmin
        .from('bookings').select('id, artisan_id')
        .eq('id', String(p.booking_id)).eq('artisan_id', artisanId).single()
      if (!booking) return { success: false, detail: 'RDV introuvable.' }

      const { data: artisan } = await supabaseAdmin
        .from('profiles_artisan').select('user_id, company_name').eq('id', artisanId).single()

      const { error } = await supabaseAdmin.from('booking_messages').insert({
        booking_id: String(p.booking_id),
        sender_id: artisan?.user_id || artisanId,
        sender_role: 'artisan',
        sender_name: artisan?.company_name || 'Artisan',
        content: String(p.content).trim().substring(0, 2000),
        type: 'text',
      })

      if (error) return { success: false, detail: `Erreur envoi : ${error.message}` }
      return { success: true, detail: `Message envoye : "${String(p.content).substring(0, 80)}..."` }
    },
  },

  // ───────────── DÉTAIL RDV ─────────────

  get_booking_detail: {
    description: 'Obtenir les details complets d\'un RDV (date, heure, service, client, adresse, statut, prix, messages)',
    params: '{ booking_id: string }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      if (!p.booking_id) return { success: false, detail: 'booking_id requis.' }

      const { data: booking } = await supabaseAdmin
        .from('bookings').select('*, services(name, price_ttc)')
        .eq('id', String(p.booking_id)).eq('artisan_id', artisanId).single()
      if (!booking) return { success: false, detail: 'RDV introuvable.' }

      const { count } = await supabaseAdmin
        .from('booking_messages').select('id', { count: 'exact', head: true })
        .eq('booking_id', String(p.booking_id))

      const clientMatch = (booking.notes || '').match(/Client:\s*([^|.]+)/)
      const clientName = clientMatch ? clientMatch[1].trim() : 'Client inconnu'

      const detail = [
        `Date : ${booking.booking_date} a ${(booking.booking_time || '').substring(0, 5)}`,
        `Client : ${clientName}`,
        `Service : ${booking.services?.name || 'Intervention'}`,
        `Adresse : ${booking.address || 'Non definie'}`,
        `Prix TTC : ${booking.price_ttc || 0}E`,
        `Statut : ${booking.status}`,
        `Messages : ${count || 0}`,
        booking.notes ? `Notes : ${booking.notes}` : '',
      ].filter(Boolean).join('\n')

      return { success: true, detail, data: { ...booking, client_name: clientName, messages_count: count || 0 } }
    },
  },

  // ───────────── COMPTABILITÉ ─────────────

  get_revenue_summary: {
    description: 'Obtenir le resume du chiffre d\'affaires (CA HT, TTC, TVA, nombre de RDV termines) pour une periode donnee',
    params: '{ period?: "month"|"quarter"|"year", year?: number, month?: number, quarter?: number }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      const year = Number(p.year) || new Date().getFullYear()
      const period = String(p.period || 'month')

      let query = supabaseAdmin
        .from('bookings')
        .select('booking_date, price_ht, price_ttc, status')
        .eq('artisan_id', artisanId)
        .eq('status', 'completed')

      if (period === 'month') {
        const month = p.month !== undefined ? Number(p.month) : new Date().getMonth()
        const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
        const endMonth = month === 11 ? 0 : month + 1
        const endYear = month === 11 ? year + 1 : year
        const endDate = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`
        query = query.gte('booking_date', startDate).lt('booking_date', endDate)
      } else if (period === 'quarter') {
        const quarter = p.quarter !== undefined ? Number(p.quarter) : Math.floor(new Date().getMonth() / 3)
        const startMonth = quarter * 3
        const endMonth = startMonth + 3
        const startDate = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`
        const endDate = endMonth >= 12 ? `${year + 1}-01-01` : `${year}-${String(endMonth + 1).padStart(2, '0')}-01`
        query = query.gte('booking_date', startDate).lt('booking_date', endDate)
      } else {
        query = query.gte('booking_date', `${year}-01-01`).lt('booking_date', `${year + 1}-01-01`)
      }

      const { data } = await query
      if (!data || data.length === 0)
        return { success: true, detail: 'Aucun RDV termine pour cette periode.', data: { ca_ttc: 0, ca_ht: 0, tva: 0, count: 0 } }

      const caTTC = data.reduce((s, b) => s + (b.price_ttc || 0), 0)
      const caHT = data.reduce((s, b) => s + (b.price_ht || (b.price_ttc || 0) / 1.2), 0)
      const tva = caTTC - caHT
      const summary = {
        ca_ttc: Math.round(caTTC * 100) / 100,
        ca_ht: Math.round(caHT * 100) / 100,
        tva: Math.round(tva * 100) / 100,
        count: data.length,
      }

      const periodLabel = period === 'month' ? 'ce mois' : period === 'quarter' ? 'ce trimestre' : `annee ${year}`
      const detail = [
        `CA TTC (${periodLabel}) : ${summary.ca_ttc.toFixed(2)}E`,
        `CA HT : ${summary.ca_ht.toFixed(2)}E`,
        `TVA collectee : ${summary.tva.toFixed(2)}E`,
        `${summary.count} intervention(s) terminee(s)`,
        `\nNote : les depenses sont stockees localement. Ouvrez la page Comptabilite pour les consulter.`,
      ].join('\n')

      return { success: true, detail, data: summary }
    },
  },

  get_quarterly_data: {
    description: 'Obtenir les donnees trimestrielles pour la declaration URSSAF (CA HT par trimestre, cotisations sociales)',
    params: '{ year?: number }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      const year = Number(p.year) || new Date().getFullYear()

      const { data } = await supabaseAdmin
        .from('bookings')
        .select('booking_date, price_ht, price_ttc, status')
        .eq('artisan_id', artisanId)
        .eq('status', 'completed')
        .gte('booking_date', `${year}-01-01`)
        .lt('booking_date', `${year + 1}-01-01`)

      const quarterData = [0, 1, 2, 3].map(q => {
        const qBookings = (data || []).filter(b => {
          const d = new Date(b.booking_date)
          return Math.floor(d.getMonth() / 3) === q
        })
        return qBookings.reduce((s, b) => s + (b.price_ht || (b.price_ttc || 0) / 1.2), 0)
      })

      const annualHT = quarterData.reduce((s, v) => s + v, 0)
      const tauxCotisation = 0.212
      const cotisations = annualHT * tauxCotisation
      const quarterLabels = ['T1 (Jan-Mars)', 'T2 (Avr-Juin)', 'T3 (Juil-Sept)', 'T4 (Oct-Dec)']

      const lines = quarterLabels.map((label, i) =>
        `${label} : ${quarterData[i].toFixed(2)}E HT => cotisation : ${(quarterData[i] * tauxCotisation).toFixed(2)}E`
      )

      const detail = [
        `Declaration URSSAF ${year}`,
        ...lines,
        `\nTotal annuel HT : ${annualHT.toFixed(2)}E`,
        `Cotisations sociales (21.2%) : ${cotisations.toFixed(2)}E`,
        annualHT < 77700 ? 'Sous le plafond micro-entreprise (77 700E)' : 'Au-dessus du plafond micro-entreprise !',
      ].join('\n')

      return { success: true, detail, data: { quarterData, annualHT, cotisations, year } }
    },
  },

  // ───────────── INFOS ENTREPRISE ─────────────

  get_company_info: {
    description: 'Obtenir les informations legales de l\'entreprise (SIRET, forme juridique, NAF, adresse)',
    params: '(aucun)',
    requiresConfirmation: false,
    execute: async (_p, artisanId) => {
      const { data: artisan } = await supabaseAdmin
        .from('profiles_artisan')
        .select('company_name, siret, siren, legal_form, naf_code, naf_label, company_address, company_city, company_postal_code, phone, email')
        .eq('id', artisanId).single()

      if (!artisan) return { success: false, detail: 'Profil artisan introuvable.' }
      if (!artisan.siret) return { success: true, detail: 'Aucun SIRET enregistre. Allez dans Parametres pour le renseigner.' }

      const detail = [
        `Entreprise : ${artisan.company_name || '-'}`,
        `SIRET : ${artisan.siret}`,
        artisan.siren ? `SIREN : ${artisan.siren}` : '',
        artisan.legal_form ? `Forme juridique : ${artisan.legal_form}` : '',
        artisan.naf_code ? `Code NAF : ${artisan.naf_code} — ${artisan.naf_label || ''}` : '',
        artisan.company_address ? `Adresse : ${artisan.company_address}` : '',
        artisan.company_city ? `Ville : ${artisan.company_postal_code || ''} ${artisan.company_city}` : '',
        artisan.phone ? `Tel : ${artisan.phone}` : '',
        artisan.email ? `Email : ${artisan.email}` : '',
      ].filter(Boolean).join('\n')

      return { success: true, detail, data: artisan }
    },
  },

  // ───────────── PARAMÈTRES AVANCÉS ─────────────

  update_settings: {
    description: 'Modifier les parametres avances (message de reponse auto, duree blocage auto)',
    params: '{ auto_reply_message?: string, auto_block_duration_minutes?: number }',
    requiresConfirmation: false,
    execute: async (p, artisanId) => {
      const updates: Record<string, unknown> = {}
      if (p.auto_reply_message !== undefined) updates.auto_reply_message = String(p.auto_reply_message)
      if (p.auto_block_duration_minutes !== undefined) updates.auto_block_duration_minutes = Number(p.auto_block_duration_minutes)
      if (Object.keys(updates).length === 0) return { success: false, detail: 'Aucun parametre a modifier.' }

      const { error } = await supabaseAdmin.from('profiles_artisan').update(updates).eq('id', artisanId)
      if (error) return { success: false, detail: `Erreur : ${error.message}` }
      const fields = Object.keys(updates).join(', ')
      return { success: true, detail: `Parametres mis a jour : ${fields}` }
    },
  },

  // ───────────── NAVIGATION ─────────────

  navigate_to: {
    description: 'Naviguer vers une page du dashboard. Pages : home, calendar, motifs, horaires, messages, clients, devis, factures, comptabilite, stats, revenus, materiaux, settings, portfolio, wallet, rapports',
    params: '{ page: string }',
    requiresConfirmation: false,
    execute: async (p) => {
      const validPages = ['home', 'calendar', 'motifs', 'horaires', 'messages', 'clients', 'devis', 'factures', 'comptabilite', 'stats', 'revenus', 'materiaux', 'settings', 'portfolio', 'wallet', 'rapports', 'help']
      const page = String(p.page || 'home')
      if (!validPages.includes(page))
        return { success: false, detail: `Page "${page}" inconnue. Pages valides : ${validPages.join(', ')}` }
      return { success: true, detail: `Navigation vers ${page}`, data: { type: 'navigate', page } }
    },
  },

  // ───────────── CLIENT-SIDE ACTIONS ─────────────

  create_devis: {
    description: 'Ouvrir le formulaire de devis pré-rempli (action côté client)',
    params: '{ clientName, clientEmail, clientPhone, clientAddress, clientSiret, service, amount, description }',
    requiresConfirmation: false,
    execute: async (p) => {
      // Not executed server-side, returned as client_action
      return { success: true, detail: 'Ouverture du formulaire devis', data: { type: 'open_devis_form', ...p } }
    },
  },

  create_facture: {
    description: 'Ouvrir le formulaire de facture pré-rempli (action côté client)',
    params: '{ clientName, clientEmail, clientPhone, clientAddress, clientSiret, service, amount, description }',
    requiresConfirmation: false,
    execute: async (p) => {
      return { success: true, detail: 'Ouverture du formulaire facture', data: { type: 'open_facture_form', ...p } }
    },
  },
}

// ── Build tool descriptions for system prompt ──────────────────────────────
export function buildToolDescriptions(): string {
  return Object.entries(TOOLS).map(([name, t]) =>
    `- **${name}** : ${t.description}${t.requiresConfirmation ? ' ⚠️ CONFIRMATION REQUISE' : ''}\n  Paramètres : ${t.params}`
  ).join('\n')
}
