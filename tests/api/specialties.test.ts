import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase-server before imports
vi.mock('@/lib/supabase-server', () => {
  const result = {
    data: [
      { id: 'uuid-1', slug: 'ferronnerie', label_fr: 'Ferronnerie / Métallerie', label_pt: 'Serralharia / Metalurgia', code_ape: '4399C', applies_to: 'both', sort_order: 3 },
      { id: 'uuid-2', slug: 'facadier',    label_fr: 'Façadier / Ravalement',    label_pt: 'Fachadas / Reboco',        code_ape: '4391A', applies_to: 'both', sort_order: 2 },
    ],
    error: null,
  }
  // Fluent builder that is also thenable — supports .order().in() chaining AND await
  // Uses explicit mockReturnValue(builder) to avoid vi.clearAllMocks() breaking the chain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  builder.order = vi.fn().mockReturnValue(builder)
  builder.in = vi.fn().mockReturnValue(builder)

  return { supabaseAdmin: { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(builder) }) } }
})

describe('GET /api/specialties', () => {
  beforeEach(() => { /* mock state preserved via factory — no reset needed */ })

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
