/**
 * Consentement cookies : lecture et enregistrement du choix du visiteur, partagés par le bandeau
 * (components/common/CookieConsent.tsx), la mesure d'audience (components/common/ConsentAnalytics.tsx) et le
 * suivi d'événements (lib/analytics.ts).
 *
 * Quand le stockage du site est bloqué (Sentry T, G, S : SecurityError à la lecture de localStorage), le choix est
 * gardé en mémoire pour la visite en cours : le bandeau se ferme, la mesure d'audience s'active après
 * « Tout accepter », et le bandeau ne revient qu'au prochain chargement complet de page. Sans cela, le choix
 * n'était jamais mémorisé et la mesure d'audience ne se chargeait jamais, même après acceptation.
 */
import { safeGet, safeRemove, safeSet } from '@/lib/safe-storage'

export const COOKIE_CONSENT_KEY = 'vitfix_cookie_consent'

export type ConsentState = {
  performance: boolean
  personalization: boolean
  advertising: boolean
  date: string
}

const DOUZE_MOIS_MS = 365 * 24 * 60 * 60 * 1000

let consentementEnMemoire: ConsentState | null = null

/** Normalise une valeur lue (ancien format `{ accepted }` compris) ; 'expire' au-delà de 12 mois (RGPD). */
function normaliser(parsed: unknown): ConsentState | 'expire' | null {
  if (typeof parsed !== 'object' || parsed === null) return null
  const valeur = parsed as Record<string, unknown>
  if ('accepted' in valeur && !('performance' in valeur)) {
    const accepte = valeur.accepted === true
    return {
      performance: accepte,
      personalization: accepte,
      advertising: accepte,
      date: typeof valeur.date === 'string' ? valeur.date : new Date().toISOString(),
    }
  }
  const consent = valeur as unknown as ConsentState
  if (consent.date) {
    const dateConsentement = new Date(consent.date).getTime()
    if (Date.now() - dateConsentement > DOUZE_MOIS_MS) return 'expire'
  }
  return consent
}

/** Choix mémorisé, ou null si aucun choix (ou choix expiré). Ne lève jamais. */
export function getCookieConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null
  const stored = safeGet(COOKIE_CONSENT_KEY)
  if (stored) {
    try {
      const consent = normaliser(JSON.parse(stored))
      if (consent === 'expire') {
        safeRemove(COOKIE_CONSENT_KEY)
        consentementEnMemoire = null
        return null
      }
      if (consent) return consent
    } catch {
      // Valeur illisible : on retombe sur le choix en mémoire, s'il existe.
    }
  }
  return consentementEnMemoire
}

export function isAnalyticsAllowed(): boolean {
  return getCookieConsent()?.performance === true
}

/**
 * Mémorise le choix : toujours en mémoire pour la visite en cours, et dans le stockage quand il est disponible.
 * Renvoie false si seul la mémoire l'a gardé (stockage bloqué ou plein).
 */
export function memoriserConsentement(consent: ConsentState): boolean {
  consentementEnMemoire = consent
  return safeSet(COOKIE_CONSENT_KEY, JSON.stringify(consent))
}

/** Tests : oublie le choix gardé en mémoire. */
export function reinitialiserConsentementEnMemoire(): void {
  consentementEnMemoire = null
}
