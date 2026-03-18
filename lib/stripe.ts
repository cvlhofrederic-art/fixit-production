import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true })
  }
  return _stripe
}

/** @deprecated Use getStripe() instead — kept for backward compatibility */
export const stripe = {
  get checkout() { return getStripe().checkout },
  get billingPortal() { return getStripe().billingPortal },
  get subscriptions() { return getStripe().subscriptions },
  get webhooks() { return getStripe().webhooks },
  get customers() { return getStripe().customers },
} as unknown as Stripe

export const PLANS = {
  artisan_starter: {
    name: 'Artisan Starter',
    priceMonthly: 0,
    features: ['5 interventions/mois', 'Messagerie', 'Profil basique'],
  },
  artisan_pro: {
    name: 'Artisan Pro',
    priceMonthly: 4900,
    stripePriceId: process.env.STRIPE_PRICE_ARTISAN_PRO || '',
    features: ['Interventions illimitées', 'Messagerie prioritaire', 'Fixy IA', 'Comptabilité', 'Visibilité boost'],
  },
  syndic_essential: {
    name: 'Syndic Essentiel',
    priceMonthly: 9900,
    stripePriceId: process.env.STRIPE_PRICE_SYNDIC_ESSENTIAL || '',
    features: ['50 lots', 'Signalements', 'Email agent', '3 artisans'],
  },
  syndic_premium: {
    name: 'Syndic Premium',
    priceMonthly: 19900,
    stripePriceId: process.env.STRIPE_PRICE_SYNDIC_PREMIUM || '',
    features: ['Lots illimités', 'Max IA', 'Artisans illimités', 'Planning', 'Rapports avancés'],
  },
} as const

export type PlanId = keyof typeof PLANS
