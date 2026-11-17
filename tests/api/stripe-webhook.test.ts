import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Webhook Stripe : les deux formes d'événement.
// La forme d'un événement suit la version d'API du point de terminaison configurée dans Stripe
// (Workbench › Webhooks), pas celle du SDK. Avant 2025-03-31.basil : `current_period_end`
// (abonnement) et `subscription` (facture) au premier niveau. Depuis basil :
// `items.data[].current_period_end` et `parent.subscription_details.subscription`.
// La route doit accepter les deux, et ne jamais répondre 500 sur une date absente
// (RangeError « Invalid time value », que Stripe réessaie pendant des jours).

const h = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieve: vi.fn(),
  upsertSubscription: vi.fn(),
  marquerTraite: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('stripe', () => {
  // function et non flèche : getStripe() l'appelle avec new
  const StripeFactice = function () {
    return {
      webhooks: { constructEvent: h.constructEvent },
      subscriptions: { retrieve: h.retrieve },
      paymentMethods: { list: vi.fn() },
    }
  }
  return { default: StripeFactice }
})

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: h.marquerTraite,
    })),
  },
}))

vi.mock('@/lib/subscription', () => ({
  upsertSubscription: h.upsertSubscription,
  getUserSubscription: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/referral', () => ({
  computeRiskScore: vi.fn().mockResolvedValue(0),
  RISK_THRESHOLD_BLOCK: 80,
  RISK_THRESHOLD_REVIEW: 50,
}))

vi.mock('@/lib/logger', () => ({
  logger: { withTenant: () => ({ info: vi.fn(), warn: h.warn, error: vi.fn() }) },
}))

const FIN_DE_PERIODE = 1797465600 // 2026-12-17T00:00:00Z, en secondes comme chez Stripe
const FIN_DE_PERIODE_ISO = '2026-12-17T00:00:00.000Z'
const METADONNEES = { userId: 'utilisateur-test-1', planId: 'artisan_pro' }

async function recevoir(type: string, objet: Record<string, unknown>) {
  h.constructEvent.mockReturnValue({ id: `evt_${type}`, object: 'event', type, data: { object: objet } })
  const { POST } = await import('@/app/api/stripe/webhook/route')
  const requete = new Request('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    body: '{}',
    headers: { 'stripe-signature': 't=1,v1=signature-factice' },
  })
  return POST(requete as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_factice')
  h.marquerTraite.mockResolvedValue({ error: null })
  h.upsertSubscription.mockResolvedValue(undefined)
  h.retrieve.mockResolvedValue({ id: 'sub_test', object: 'subscription', metadata: METADONNEES })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/stripe/webhook — customer.subscription.updated', () => {
  it('lit la fin de période sur les articles (forme basil et après)', async () => {
    const reponse = await recevoir('customer.subscription.updated', {
      id: 'sub_test',
      object: 'subscription',
      status: 'active',
      cancel_at_period_end: true,
      metadata: METADONNEES,
      items: {
        object: 'list',
        data: [{
          id: 'si_test',
          object: 'subscription_item',
          current_period_start: FIN_DE_PERIODE - 30 * 86400,
          current_period_end: FIN_DE_PERIODE,
        }],
      },
    })

    expect(reponse.status).toBe(200)
    expect(h.upsertSubscription).toHaveBeenCalledWith('utilisateur-test-1', {
      plan_id: 'artisan_pro',
      status: 'active',
      stripe_subscription_id: 'sub_test',
      current_period_end: FIN_DE_PERIODE_ISO,
      cancel_at_period_end: true,
    })
    expect(h.marquerTraite).toHaveBeenCalledWith(
      expect.objectContaining({ event_id: 'evt_customer.subscription.updated' }),
    )
    expect(h.warn).not.toHaveBeenCalled()
  })

  it('lit encore la fin de période au premier niveau (forme avant basil)', async () => {
    const reponse = await recevoir('customer.subscription.updated', {
      id: 'sub_test',
      object: 'subscription',
      status: 'past_due',
      cancel_at_period_end: false,
      current_period_end: FIN_DE_PERIODE,
      metadata: METADONNEES,
      items: { object: 'list', data: [{ id: 'si_test', object: 'subscription_item' }] },
    })

    expect(reponse.status).toBe(200)
    expect(h.upsertSubscription).toHaveBeenCalledWith('utilisateur-test-1', {
      plan_id: 'artisan_pro',
      status: 'past_due',
      stripe_subscription_id: 'sub_test',
      current_period_end: FIN_DE_PERIODE_ISO,
      cancel_at_period_end: false,
    })
  })

  it("enregistre le reste sans toucher à la date quand l'événement n'en porte aucune lisible", async () => {
    const reponse = await recevoir('customer.subscription.updated', {
      id: 'sub_test',
      object: 'subscription',
      status: 'canceled',
      cancel_at_period_end: false,
      metadata: METADONNEES,
      items: { object: 'list', data: [] },
    })

    expect(reponse.status).toBe(200)
    expect(h.upsertSubscription).toHaveBeenCalledTimes(1)
    const [, ligne] = h.upsertSubscription.mock.calls[0]
    expect(ligne).not.toHaveProperty('current_period_end')
    expect(ligne).toEqual({
      plan_id: 'artisan_pro',
      status: 'canceled',
      stripe_subscription_id: 'sub_test',
      cancel_at_period_end: false,
    })
    expect(h.warn).toHaveBeenCalledTimes(1)
    expect(h.marquerTraite).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/stripe/webhook — invoice.payment_failed', () => {
  it("retrouve l'abonnement sous parent.subscription_details (forme basil et après)", async () => {
    const reponse = await recevoir('invoice.payment_failed', {
      id: 'in_test',
      object: 'invoice',
      parent: {
        type: 'subscription_details',
        quote_details: null,
        subscription_details: { subscription: 'sub_test', metadata: METADONNEES },
      },
    })

    expect(reponse.status).toBe(200)
    expect(h.retrieve).toHaveBeenCalledWith('sub_test')
    expect(h.upsertSubscription).toHaveBeenCalledWith('utilisateur-test-1', {
      plan_id: 'artisan_pro',
      status: 'past_due',
    })
  })

  it("retrouve encore l'abonnement au premier niveau (forme avant basil)", async () => {
    const reponse = await recevoir('invoice.payment_failed', {
      id: 'in_test',
      object: 'invoice',
      subscription: 'sub_test',
    })

    expect(reponse.status).toBe(200)
    expect(h.retrieve).toHaveBeenCalledWith('sub_test')
    expect(h.upsertSubscription).toHaveBeenCalledWith('utilisateur-test-1', {
      plan_id: 'artisan_pro',
      status: 'past_due',
    })
  })

  it('ignore une facture hors abonnement', async () => {
    const reponse = await recevoir('invoice.payment_failed', {
      id: 'in_test',
      object: 'invoice',
      parent: null,
    })

    expect(reponse.status).toBe(200)
    expect(h.retrieve).not.toHaveBeenCalled()
    expect(h.upsertSubscription).not.toHaveBeenCalled()
    expect(h.marquerTraite).toHaveBeenCalledTimes(1)
  })
})
