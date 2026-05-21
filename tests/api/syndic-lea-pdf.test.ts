import { describe, it, expect } from 'vitest'

describe('app/api/syndic/lea-pdf-* — module load smoke tests', () => {
  it('exporte GET et POST sur /lea-pdf-templates', async () => {
    const mod = await import('@/app/api/syndic/lea-pdf-templates/route')
    expect(typeof mod.GET).toBe('function')
    expect(typeof mod.POST).toBe('function')
  })

  it('exporte DELETE sur /lea-pdf-templates/[id]', async () => {
    const mod = await import('@/app/api/syndic/lea-pdf-templates/[id]/route')
    expect(typeof mod.DELETE).toBe('function')
  })

  it('exporte POST sur /lea-pdf-generate', async () => {
    const mod = await import('@/app/api/syndic/lea-pdf-generate/route')
    expect(typeof mod.POST).toBe('function')
  })
})
