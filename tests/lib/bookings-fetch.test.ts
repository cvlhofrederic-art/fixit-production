import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchAllBookings, BOOKINGS_PAGE_SIZE, BOOKINGS_MAX_PAGES } from '@/lib/bookings-fetch'

// Fix CA tronqué (audit 2026-06-10, chip task_3c0e194a) : le dashboard chargeait
// les bookings avec .limit(20) et calculait CA + compteurs depuis ce tableau →
// chiffres faux pour tout artisan >20 réservations. fetchAllBookings charge TOUT
// l'historique par pages de 1000 (borne PostgREST max-rows) avec un garde-fou.

type Row = { id: number }
const page = (start: number, count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: start + i }))

// Client Supabase mocké chaînable : .from().select().eq().order().range()
function mockClient(pages: Array<{ data: Row[] | null; error: { message: string } | null }>) {
  const rangeCalls: Array<[number, number]> = []
  let call = 0
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn((from: number, to: number) => {
      rangeCalls.push([from, to])
      const res = pages[Math.min(call, pages.length - 1)]
      call++
      return Promise.resolve(res)
    }),
  }
  const client = { from: vi.fn(() => builder) }
  return { client, rangeCalls }
}

afterEach(() => vi.restoreAllMocks())

describe('fetchAllBookings', () => {
  it('1 page partielle → tout chargé, truncated=false, 1 seul appel', async () => {
    const { client, rangeCalls } = mockClient([{ data: page(0, 23), error: null }])
    const out = await fetchAllBookings(client as never, 'art-1')
    expect(out.data).toHaveLength(23)
    expect(out.truncated).toBe(false)
    expect(rangeCalls).toEqual([[0, BOOKINGS_PAGE_SIZE - 1]])
  })

  it('2 pages (pleine + reste) → concat dans l\'ordre, ranges corrects', async () => {
    const { client, rangeCalls } = mockClient([
      { data: page(0, BOOKINGS_PAGE_SIZE), error: null },
      { data: page(BOOKINGS_PAGE_SIZE, 250), error: null },
    ])
    const out = await fetchAllBookings(client as never, 'art-1')
    expect(out.data).toHaveLength(BOOKINGS_PAGE_SIZE + 250)
    expect(out.data[0].id).toBe(0)
    expect(out.data[BOOKINGS_PAGE_SIZE].id).toBe(BOOKINGS_PAGE_SIZE)
    expect(out.truncated).toBe(false)
    expect(rangeCalls).toEqual([
      [0, BOOKINGS_PAGE_SIZE - 1],
      [BOOKINGS_PAGE_SIZE, 2 * BOOKINGS_PAGE_SIZE - 1],
    ])
  })

  it('erreur en page 2 → retourne la page 1 déjà chargée + console.warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client } = mockClient([
      { data: page(0, BOOKINGS_PAGE_SIZE), error: null },
      { data: null, error: { message: 'boom' } },
    ])
    const out = await fetchAllBookings(client as never, 'art-1')
    expect(out.data).toHaveLength(BOOKINGS_PAGE_SIZE)
    expect(out.truncated).toBe(true)
    expect(warn).toHaveBeenCalled()
  })

  it('MAX_PAGES pages pleines → stop au garde-fou, truncated=true', async () => {
    const fullPages = Array.from({ length: BOOKINGS_MAX_PAGES + 2 }, (_, p) => ({
      data: page(p * BOOKINGS_PAGE_SIZE, BOOKINGS_PAGE_SIZE),
      error: null,
    }))
    const { client, rangeCalls } = mockClient(fullPages)
    const out = await fetchAllBookings(client as never, 'art-1')
    expect(out.data).toHaveLength(BOOKINGS_MAX_PAGES * BOOKINGS_PAGE_SIZE)
    expect(out.truncated).toBe(true)
    expect(rangeCalls).toHaveLength(BOOKINGS_MAX_PAGES)
  })
})
