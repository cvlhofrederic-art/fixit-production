import { describe, it, expect, vi } from 'vitest'

// Mock stripe module — must use function() not arrow for constructor
vi.mock('stripe', () => {
  const mockStripe = function() {
    return {
      checkout: { sessions: { create: vi.fn() } },
      billingPortal: { sessions: { create: vi.fn() } },
      subscriptions: { retrieve: vi.fn() },
      webhooks: { constructEvent: vi.fn() },
    }
  }
  return { default: mockStripe }
})

describe('Stripe Plans Configuration', () => {
  it('should define 4 plans', async () => {
    const { PLANS } = await import('@/lib/stripe')
    expect(Object.keys(PLANS)).toHaveLength(4)
  })

  it('should have a free starter plan', async () => {
    const { PLANS } = await import('@/lib/stripe')
    expect(PLANS.artisan_starter.priceMonthly).toBe(0)
    expect(PLANS.artisan_starter.features.length).toBeGreaterThan(0)
  })

  it('should have paid plans with prices', async () => {
    const { PLANS } = await import('@/lib/stripe')
    expect(PLANS.artisan_pro.priceMonthly).toBeGreaterThan(0)
    expect(PLANS.syndic_essential.priceMonthly).toBeGreaterThan(0)
    expect(PLANS.syndic_premium.priceMonthly).toBeGreaterThan(0)
  })

  it('should have premium more expensive than essential', async () => {
    const { PLANS } = await import('@/lib/stripe')
    expect(PLANS.syndic_premium.priceMonthly).toBeGreaterThan(PLANS.syndic_essential.priceMonthly)
  })

  it('all plans should have features', async () => {
    const { PLANS } = await import('@/lib/stripe')
    Object.values(PLANS).forEach(plan => {
      expect(Array.isArray(plan.features)).toBe(true)
      expect(plan.features.length).toBeGreaterThan(0)
    })
  })
})
