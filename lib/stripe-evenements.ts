import type Stripe from 'stripe'

// ══════════════════════════════════════════════════════════════════════════════
// Lecture des champs d'événements webhook Stripe déplacés par la version d'API
// 2025-03-31.basil.
//
// La forme d'un événement suit la version d'API du point de terminaison configurée
// dans Stripe (Workbench › Webhooks), pas celle du SDK : un point de terminaison
// antérieur à basil envoie l'ancienne forme, un point de terminaison récent la
// nouvelle. On lit la nouvelle place d'abord, puis l'ancienne.
// - Abonnement : `current_period_end` au premier niveau → `items.data[].current_period_end`
//   https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end
// - Facture : `subscription` → `parent.subscription_details.subscription`
//   https://docs.stripe.com/changelog/basil/2025-03-31/adds-new-parent-field-to-invoicing-objects
// ══════════════════════════════════════════════════════════════════════════════

/** Champs retirés par basil, encore présents dans les événements d'un point de terminaison plus ancien. */
type AbonnementAvantBasil = { current_period_end?: unknown }
type FactureAvantBasil = { subscription?: unknown }

/** Horodatage Unix (secondes) en ISO 8601, ou null s'il ne donne pas une date valide. */
function horodatageEnIso(valeur: unknown): string | null {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur <= 0) return null
  const date = new Date(valeur * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Identifiant d'une référence Stripe : chaîne, ou objet développé (expand) qui porte un `id`. */
function idDeReference(reference: unknown): string | null {
  if (typeof reference === 'string') return reference.length > 0 ? reference : null
  if (typeof reference === 'object' && reference !== null && 'id' in reference) {
    const { id } = reference as { id: unknown }
    return typeof id === 'string' && id.length > 0 ? id : null
  }
  return null
}

/**
 * Fin de la période en cours d'un abonnement (ISO 8601), ou null si l'événement n'en porte
 * aucune lisible. Les abonnements Vitfix n'ont qu'un article (checkout à une ligne) : le
 * premier article qui porte une date fait foi.
 */
export function finDePeriodeAbonnement(sub: Stripe.Subscription): string | null {
  for (const article of sub.items?.data ?? []) {
    const iso = horodatageEnIso(article?.current_period_end)
    if (iso) return iso
  }
  return horodatageEnIso((sub as Stripe.Subscription & AbonnementAvantBasil).current_period_end)
}

/** Identifiant de l'abonnement d'une facture, ou null pour une facture hors abonnement. */
export function idAbonnementDeFacture(invoice: Stripe.Invoice): string | null {
  return (
    idDeReference(invoice.parent?.subscription_details?.subscription) ??
    idDeReference((invoice as Stripe.Invoice & FactureAvantBasil).subscription)
  )
}
