import { describe, it, expect } from 'vitest'

// P1 Léa Documents — module-load smoke tests (auth + RLS testés en E2E ultérieur)
describe('app/api/syndic/lea-documents', () => {
  it('exporte le handler POST (upload)', async () => {
    const mod = await import('@/app/api/syndic/lea-documents/upload/route')
    expect(typeof mod.POST).toBe('function')
  })

  it('exporte le handler GET (liste)', async () => {
    const mod = await import('@/app/api/syndic/lea-documents/route')
    expect(typeof mod.GET).toBe('function')
  })

  it('exporte les handlers GET et DELETE (détails par id)', async () => {
    const mod = await import('@/app/api/syndic/lea-documents/[id]/route')
    expect(typeof mod.GET).toBe('function')
    expect(typeof mod.DELETE).toBe('function')
  })

  it('exporte le handler POST (process — P2 OCR/extraction)', async () => {
    const mod = await import('@/app/api/syndic/lea-documents/process/route')
    expect(typeof mod.POST).toBe('function')
  })
})
