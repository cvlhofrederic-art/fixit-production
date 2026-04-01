import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase-server', () => {
  const specRow = { id: 'spec-uuid-1', label_fr: 'Ferronnerie / Métallerie' }
  const pivotRows = [
    { user_id: 'user-uuid-1', verified_source: 'kbis' },
    { user_id: 'user-uuid-2', verified_source: 'self_declared' },
  ]
  const artisanRows = [
    { id: 'art-1', user_id: 'user-uuid-1', company_name: 'Ferro Pro', first_name: 'Jean', last_name: 'Dupont', email: 'j@ferro.fr', phone: '0600000001', company_city: 'Marseille', naf_code: '4399C', naf_label: 'Ferronnerie', verified: true, kyc_status: 'approved', categories: ['ferronnerie'] },
    { id: 'art-2', user_id: 'user-uuid-2', company_name: 'Métal Sud', first_name: 'Marie', last_name: 'Martin', email: 'm@metal.fr', phone: '0600000002', company_city: 'Aix-en-Provence', naf_code: '4399C', naf_label: 'Ferronnerie', verified: false, kyc_status: 'approved', categories: ['ferronnerie'] },
  ]

  const mockSingle = vi.fn().mockResolvedValue({ data: specRow, error: null })
  const mockLimit = vi.fn().mockResolvedValue({ data: artisanRows, error: null })
  const mockIlike = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockEqKyc = vi.fn().mockReturnValue({ limit: mockLimit, ilike: mockIlike })
  const mockInUsers = vi.fn().mockReturnValue({ eq: mockEqKyc })
  const mockSelectArtisan = vi.fn().mockReturnValue({ in: mockInUsers })

  const mockPivotLimit = vi.fn().mockResolvedValue({ data: pivotRows, error: null })
  const mockPivotEq = vi.fn().mockReturnValue({ data: pivotRows, error: null, then: undefined })
  // pivot query: .select(...).eq('specialty_id', id) OR .select(...).eq(...).eq(...)
  const mockPivotSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      data: pivotRows,
      error: null,
      // also support .eq chaining
      eq: vi.fn().mockResolvedValue({ data: pivotRows, error: null }),
    }),
  })

  return {
    supabaseAdmin: {
      from: vi.fn((table: string) => {
        if (table === 'specialties') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) }) }
        if (table === 'profile_specialties') return { select: mockPivotSelect }
        if (table === 'profiles_artisan') return { select: mockSelectArtisan }
        return {}
      }),
    },
  }
})

describe('GET /api/companies/search', () => {
  it('returns results for a valid specialty slug', async () => {
    const { GET } = await import('@/app/api/companies/search/route')
    const req = new Request('http://localhost/api/companies/search?specialty=ferronnerie')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.specialty).toBe('Ferronnerie / Métallerie')
    expect(Array.isArray(json.results)).toBe(true)
  })

  it('returns 400 when specialty param is missing', async () => {
    const { GET } = await import('@/app/api/companies/search/route')
    const req = new Request('http://localhost/api/companies/search')
    const res = await GET(req as any)
    expect(res.status).toBe(400)
  })

  it('includes verified_source in each result', async () => {
    const { GET } = await import('@/app/api/companies/search/route')
    const req = new Request('http://localhost/api/companies/search?specialty=ferronnerie')
    const res = await GET(req as any)
    const json = await res.json()
    if (json.results.length > 0) {
      expect(json.results[0]).toHaveProperty('verified_source')
      expect(json.results[0]).toHaveProperty('profile_type', 'artisan')
    }
  })
})
