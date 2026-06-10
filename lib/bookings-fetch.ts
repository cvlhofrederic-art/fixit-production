// ── Chargement COMPLET des bookings d'un artisan ─────────────────────────────
// Fix CA tronqué (audit 2026-06-10) : le dashboard chargeait les bookings avec
// .limit(20) et useBookings calculait totalRevenue / pendingBookings /
// completedBookings depuis ce tableau → CA et compteurs FAUX pour tout artisan
// avec plus de 20 réservations, inbox de demandes et agenda incomplets.
//
// Ici on charge TOUT l'historique par pages de 1000 : un fetch sans .limit()
// serait de toute façon coupé silencieusement à la borne PostgREST max-rows
// (1000 par défaut sur Supabase). Garde-fou MAX_PAGES pour borner le payload
// (au-delà, `truncated: true` — à brancher sur une agrégation serveur le jour
// où un compte dépasse 5000 réservations).
//
// Le dashboard client (app/client/dashboard) charge déjà tous ses bookings
// sans limite ; la RLS bookings_participant_read autorise l'artisan à lire
// l'intégralité de ses propres bookings (migration 041).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Booking } from '@/lib/types'

export const BOOKINGS_PAGE_SIZE = 1000
export const BOOKINGS_MAX_PAGES = 5

export interface FetchAllBookingsResult {
  data: Booking[]
  /** true si l'historique dépasse le garde-fou ou si une page a échoué en cours de route */
  truncated: boolean
}

export async function fetchAllBookings(
  client: SupabaseClient,
  artisanId: string,
): Promise<FetchAllBookingsResult> {
  const all: Booking[] = []
  for (let pageIdx = 0; pageIdx < BOOKINGS_MAX_PAGES; pageIdx++) {
    const from = pageIdx * BOOKINGS_PAGE_SIZE
    const { data, error } = await client
      .from('bookings')
      .select('*, services(name)')
      .eq('artisan_id', artisanId)
      .order('booking_date', { ascending: false })
      .range(from, from + BOOKINGS_PAGE_SIZE - 1)
    if (error) {
      // Parité avec l'ancien comportement (data || []) mais sans silence : on
      // retourne ce qui est déjà chargé et on trace.
      console.warn('[bookings-fetch] page fetch failed:', { page: pageIdx, error: error.message })
      return { data: all, truncated: true }
    }
    all.push(...((data as Booking[]) || []))
    if (!data || data.length < BOOKINGS_PAGE_SIZE) {
      return { data: all, truncated: false }
    }
  }
  return { data: all, truncated: true }
}
