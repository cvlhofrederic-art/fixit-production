import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase-server before imports
vi.mock('@/lib/supabase-server', () => {
  const mockOrder = vi.fn().mockResolvedValue({
    data: [
      { id: 'uuid-1', slug: 'ferronnerie', label_fr: 'Ferronnerie / Métallerie', label_pt: 'Serralharia / Metalurgia', code_ape: '4399C', applies_to: 'both', sort_order: 3 },
      { id: 'uuid-2', slug: 'facadier',    label_fr: 'Façadier / Ravalement',    label_pt: 'Fachadas / Reboco',        code_ape: '4391A', applies_to: 'both', sort_order: 2 },
    ],
    error: null,
  })
  const mockIn = vi.fn().mockReturnValue({ order: mockOrder })
  const mockSelect = vi.fn().mockReturnValue({ order: mockOrder, in: mockIn })
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })

  return { supabaseAdmin: { from: mockFrom } }
})

describe('GET /api/specialties', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns all specialties with status 200', async () => {
    const { GET } = await import('@/app/api/specialties/route')
    const req = new Request('http://localhost/api/specialties')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.specialties)).toBe(true)
    expect(json.specialties).toHaveLength(2)
    expect(json.specialties[0].slug).toBe('ferronnerie')
  })

  it('includes Cache-Control header', async () => {
    const { GET } = await import('@/app/api/specialties/route')
    const req = new Request('http://localhost/api/specialties')
    const res = await GET(req as any)
    expect(res.headers.get('Cache-Control')).toContain('s-maxage')
  })

  it('accepts applies_to filter without error', async () => {
    const { GET } = await import('@/app/api/specialties/route')
    const req = new Request('http://localhost/api/specialties?applies_to=artisan')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
  })
})
