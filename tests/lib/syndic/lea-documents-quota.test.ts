import { describe, it, expect } from 'vitest'
import { getCabinetStorageUsage, wouldExceedQuota, DEFAULT_CABINET_QUOTA_BYTES } from '@/lib/syndic/lea-documents-quota'

function mockSupabase(docs: Array<{ size_bytes: number }>, gens: Array<{ size_bytes: number }>) {
  const chain = (data: unknown) => ({
    select: () => ({
      eq: () => Promise.resolve({ data, error: null }),
    }),
  })
  return {
    from: (table: string) => {
      if (table === 'syndic_documents') return chain(docs)
      if (table === 'syndic_pdf_generated') return chain(gens)
      return chain([])
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('lib/syndic/lea-documents-quota', () => {
  describe('getCabinetStorageUsage', () => {
    it('somme size_bytes de syndic_documents + syndic_pdf_generated', async () => {
      const supabase = mockSupabase(
        [{ size_bytes: 1_000_000 }, { size_bytes: 2_500_000 }],
        [{ size_bytes: 500_000 }],
      )
      const usage = await getCabinetStorageUsage(supabase, 'cabinet-1')
      expect(usage.bytes_used).toBe(4_000_000)
      expect(usage.bytes_quota).toBe(DEFAULT_CABINET_QUOTA_BYTES)
      expect(usage.exceeded).toBe(false)
      expect(usage.warning).toBe(false)
    })

    it('flag warning quand ratio >= 80% et < 100%', async () => {
      const supabase = mockSupabase([{ size_bytes: Math.floor(DEFAULT_CABINET_QUOTA_BYTES * 0.85) }], [])
      const usage = await getCabinetStorageUsage(supabase, 'cabinet-1')
      expect(usage.warning).toBe(true)
      expect(usage.exceeded).toBe(false)
    })

    it('flag exceeded quand ratio >= 100%', async () => {
      const supabase = mockSupabase([{ size_bytes: DEFAULT_CABINET_QUOTA_BYTES + 1 }], [])
      const usage = await getCabinetStorageUsage(supabase, 'cabinet-1')
      expect(usage.exceeded).toBe(true)
    })

    it('best-effort : retourne 0 si la query échoue', async () => {
      const supabase = {
        from: () => ({
          select: () => ({ eq: () => Promise.reject(new Error('db_down')) }),
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any
      const usage = await getCabinetStorageUsage(supabase, 'cabinet-1')
      expect(usage.bytes_used).toBe(0)
    })

    it('honore un quota custom', async () => {
      const supabase = mockSupabase([{ size_bytes: 100 }], [])
      const usage = await getCabinetStorageUsage(supabase, 'cabinet-1', 1000)
      expect(usage.bytes_quota).toBe(1000)
      expect(usage.ratio).toBe(0.1)
    })
  })

  describe('wouldExceedQuota', () => {
    it('false si used + incoming <= quota', () => {
      expect(wouldExceedQuota({ bytes_used: 100, bytes_quota: 1000, ratio: 0.1, warning: false, exceeded: false }, 500)).toBe(false)
    })

    it('true si used + incoming > quota', () => {
      expect(wouldExceedQuota({ bytes_used: 800, bytes_quota: 1000, ratio: 0.8, warning: true, exceeded: false }, 300)).toBe(true)
    })

    it('true pile sur la borne (depasse)', () => {
      expect(wouldExceedQuota({ bytes_used: 999, bytes_quota: 1000, ratio: 0.99, warning: true, exceeded: false }, 2)).toBe(true)
    })
  })
})
