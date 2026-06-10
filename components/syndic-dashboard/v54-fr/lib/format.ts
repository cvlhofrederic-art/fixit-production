// Helpers fr-FR du dashboard syndic judiciaire — port byte-exact du mockup v8
// (« Helpers (fr-FR) »). TODAY est épinglée comme dans le mockup : le rendu
// SSR/client est déterministe (zéro mismatch d'hydratation), les échéances mock
// restent cohérentes. Le branchement temps réel viendra avec les vraies données.

import type { KeyboardEvent } from 'react'

// Minuit LOCAL (forme constructeur, pas littéral ISO) : un littéral date-only
// est parsé minuit UTC, que Intl re-projette ensuite dans le fuseau d'exécution
// → libellés différents entre SSR (UTC sur Workers) et client (Europe/Paris…),
// donc mismatch d'hydratation. Minuit local est identique des deux côtés.
export const TODAY = new Date(2026, 5, 4)

export const fmtEUR = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export const fmtEUR2 = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

export const fmtDateLong = (d: Date = TODAY): string =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(d)

export const fmtDateTimeLong = (d: Date = TODAY): string =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(d)

/** Parse « JJ/MM/AAAA » → Date (null si invalide). */
export const parseFRDate = (s: string | null | undefined): Date | null => {
  if (!s) return null
  const p = String(s).split('/').map(Number)
  return p[0] && p[1] && p[2] ? new Date(p[2], p[1] - 1, p[0]) : null
}

/** Jours restants jusqu'à une date « JJ/MM/AAAA » (négatif = dépassée, null = non datée). */
export const daysUntil = (s: string | null | undefined): number | null => {
  const d = parseFRDate(s)
  if (!d) return null
  return Math.ceil((d.getTime() - TODAY.getTime()) / 86400000)
}

/** Pourcentage borné 0-100 de a sur b. */
export const pctv = (a: number, b: number): number => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0)

/** Handler clavier Enter/Espace pour éléments cliquables non-boutons (a11y). */
export const onKeyActivate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}
