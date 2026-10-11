// tests/api/cron-booking-reminder.test.ts
//
// GET /api/cron/booking-reminder — rappel J-1 par e-mail au client du booking. Les bookings créés pour
// une mission syndic (notes « [Mission Syndic] … », lib/syndic/livraison-mission.ts) ont pour « client »
// le donneur d'ordre (le compte du syndic) : aucun e-mail réel ne doit en partir, démo comprise.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  bookings: [] as Array<Record<string, unknown>>,
  sendEmail: vi.fn(async () => ({ success: true })),
  getUserById: vi.fn(async (id: string) => ({ data: { user: { id, email: `${id}@exemple.fr`, user_metadata: { full_name: 'Client' } } } })),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendEmail: h.sendEmail,
  templateBookingReminder: vi.fn(() => ({ subject: 'Rappel', html: '<p>Rappel</p>' })),
}))
vi.mock('@/lib/supabase-server', () => {
  const requete: Record<string, unknown> = {}
  for (const m of ['select', 'eq']) requete[m] = () => requete
  requete.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: h.bookings, error: null }).then(ok)
  return { supabaseAdmin: { from: () => requete, auth: { admin: { getUserById: h.getUserById } } } }
})

const { GET } = await import('@/app/api/cron/booking-reminder/route')
const appeler = () => GET(new NextRequest('https://vitfix.io/api/cron/booking-reminder', { headers: { authorization: 'Bearer secret-cron' } }))

const booking = (id: string, notes: string | null) => ({
  id, client_id: `client-${id}`, artisan_id: 'profil-1', booking_date: '2026-10-13', booking_time: '09:00:00',
  address: 'Le Prado', notes, services: { name: 'Plomberie' }, profiles_artisan: { company_name: 'Plomberie Fred', user_id: null },
})

describe('GET /api/cron/booking-reminder — missions syndic exclues', () => {
  const secretAvant = process.env.CRON_SECRET
  beforeEach(() => {
    process.env.CRON_SECRET = 'secret-cron'
    h.sendEmail.mockClear()
    h.getUserById.mockClear()
  })
  afterEach(() => { process.env.CRON_SECRET = secretAvant })

  it('booking « [Mission Syndic] » : ignoré (aucun e-mail, client jamais lu) ; booking client : rappel envoyé', async () => {
    h.bookings = [
      booking('mission', '[Mission Syndic] Plomberie\nFuite colonne EF\nAssignée par : Frédéric'),
      booking('client', 'Porte d’entrée à droite'),
      booking('sans-notes', null),
    ]
    const res = await appeler()
    expect(res.status).toBe(200)
    expect((await res.json()).results).toEqual({ sent: 2, errors: 0, skipped: 1 })
    expect(h.sendEmail).toHaveBeenCalledTimes(2)
    expect(h.getUserById).not.toHaveBeenCalledWith('client-mission')
    expect(h.sendEmail).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'client-mission@exemple.fr' }))
  })

  it('401 sans le secret du cron', async () => {
    const res = await GET(new NextRequest('https://vitfix.io/api/cron/booking-reminder'))
    expect(res.status).toBe(401)
  })
})
