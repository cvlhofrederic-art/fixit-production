import { describe, it, expect } from 'vitest'
import type Stripe from 'stripe'
import { finDePeriodeAbonnement, idAbonnementDeFacture } from '@/lib/stripe-evenements'

// Champs d'événements Stripe déplacés par la version d'API 2025-03-31.basil :
// on lit la nouvelle place d'abord, puis l'ancienne (voir lib/stripe-evenements.ts).

const abonnement = (champs: Record<string, unknown>) => champs as unknown as Stripe.Subscription
const facture = (champs: Record<string, unknown>) => champs as unknown as Stripe.Invoice

const FIN_DE_PERIODE = 1797465600 // 2026-12-17T00:00:00Z
const FIN_DE_PERIODE_ISO = '2026-12-17T00:00:00.000Z'
const AUTRE_FIN = 1800144000 // 2027-01-17T00:00:00Z

describe('finDePeriodeAbonnement', () => {
  it('lit items.data[].current_period_end (basil et après)', () => {
    const sub = abonnement({ items: { data: [{ id: 'si_1', current_period_end: FIN_DE_PERIODE }] } })
    expect(finDePeriodeAbonnement(sub)).toBe(FIN_DE_PERIODE_ISO)
  })

  it('lit current_period_end au premier niveau (avant basil)', () => {
    const sub = abonnement({ current_period_end: FIN_DE_PERIODE, items: { data: [{ id: 'si_1' }] } })
    expect(finDePeriodeAbonnement(sub)).toBe(FIN_DE_PERIODE_ISO)
  })

  it('préfère la date des articles quand les deux formes coexistent', () => {
    const sub = abonnement({
      current_period_end: AUTRE_FIN,
      items: { data: [{ id: 'si_1', current_period_end: FIN_DE_PERIODE }] },
    })
    expect(finDePeriodeAbonnement(sub)).toBe(FIN_DE_PERIODE_ISO)
  })

  it('prend le premier article qui porte une date lisible', () => {
    const sub = abonnement({
      items: { data: [{ id: 'si_1' }, { id: 'si_2', current_period_end: FIN_DE_PERIODE }] },
    })
    expect(finDePeriodeAbonnement(sub)).toBe(FIN_DE_PERIODE_ISO)
  })

  it('rend null sans article ni champ au premier niveau', () => {
    expect(finDePeriodeAbonnement(abonnement({}))).toBeNull()
    expect(finDePeriodeAbonnement(abonnement({ items: { data: [] } }))).toBeNull()
    expect(finDePeriodeAbonnement(abonnement({ items: null }))).toBeNull()
  })

  // 1e15 secondes sort de la plage des dates JavaScript : new Date() serait invalide
  // et toISOString() lèverait « RangeError: Invalid time value ».
  it.each([undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, '1797465600', 1e15])(
    'rend null pour une valeur illisible (%s), sans lever',
    (valeur) => {
      const sub = abonnement({ current_period_end: valeur, items: { data: [{ current_period_end: valeur }] } })
      expect(finDePeriodeAbonnement(sub)).toBeNull()
    },
  )
})

describe('idAbonnementDeFacture', () => {
  it('lit parent.subscription_details.subscription (basil et après)', () => {
    const inv = facture({
      parent: { type: 'subscription_details', quote_details: null, subscription_details: { subscription: 'sub_1' } },
    })
    expect(idAbonnementDeFacture(inv)).toBe('sub_1')
  })

  it('accepte un abonnement développé (objet avec id) sous parent', () => {
    const inv = facture({
      parent: { type: 'subscription_details', subscription_details: { subscription: { id: 'sub_1', object: 'subscription' } } },
    })
    expect(idAbonnementDeFacture(inv)).toBe('sub_1')
  })

  it('lit subscription au premier niveau (avant basil), identifiant ou objet développé', () => {
    expect(idAbonnementDeFacture(facture({ subscription: 'sub_1' }))).toBe('sub_1')
    expect(idAbonnementDeFacture(facture({ subscription: { id: 'sub_1', object: 'subscription' } }))).toBe('sub_1')
  })

  it('préfère parent quand les deux formes coexistent', () => {
    const inv = facture({ subscription: 'sub_ancien', parent: { subscription_details: { subscription: 'sub_1' } } })
    expect(idAbonnementDeFacture(inv)).toBe('sub_1')
  })

  it('rend null pour une facture hors abonnement', () => {
    expect(idAbonnementDeFacture(facture({}))).toBeNull()
    expect(idAbonnementDeFacture(facture({ parent: null, subscription: null }))).toBeNull()
    expect(idAbonnementDeFacture(facture({
      parent: { type: 'quote_details', quote_details: { quote: 'qt_1' }, subscription_details: null },
    }))).toBeNull()
    expect(idAbonnementDeFacture(facture({ subscription: '' }))).toBeNull()
    expect(idAbonnementDeFacture(facture({ subscription: { object: 'subscription' } }))).toBeNull()
  })
})
