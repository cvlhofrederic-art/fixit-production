import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase-server', () => {
  const mockFromSpecialties = {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'spec-uuid-1', slug: 'ferronnerie' },
          { id: 'spec-uuid-2', slug: 'facadier' },
        ],
        error: null,
      }),
    }),
  }

  const mockFromProfileSpecialties = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }

  return {
    supabaseAdmin: {
      from: vi.fn((table: string) => {
        if (table === 'specialties') return mockFromSpecialties
        if (table === 'profile_specialties') return mockFromProfileSpecialties
        return {}
      }),
    },
  }
})

describe('POST /api/profile/specialties', () => {
  it('saves specialties and returns success', async () => {
    const { POST } = await import('@/app/api/profile/specialties/route')
    const req = new Request('http://localhost/api/profile/specialties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        slugs: ['ferronnerie', 'facadier'],
        verified_source: 'kbis',
      }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.saved).toBe(2)
  })

  it('returns 400 when user_id is missing', async () => {
    const { POST } = await import('@/app/api/profile/specialties/route')
    const req = new Request('http://localhost/api/profile/specialties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs: ['ferronnerie'] }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when slugs is empty array', async () => {
    const { POST } = await import('@/app/api/profile/specialties/route')
    const req = new Request('http://localhost/api/profile/specialties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: '550e8400-e29b-41d4-a716-446655440000', slugs: [] }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when no matching specialties found', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as any)

    const { POST } = await import('@/app/api/profile/specialties/route')
    const req = new Request('http://localhost/api/profile/specialties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: '550e8400-e29b-41d4-a716-446655440000', slugs: ['nonexistent-slug'] }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})
