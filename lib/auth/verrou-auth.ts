/**
 * Verrou d'authentification Supabase dans le navigateur (option `auth.lock` de lib/supabase.ts).
 *
 * auth-js protège la session par un verrou exclusif `navigator.locks` partagé entre tous les onglets de
 * l'origine (nom `lock:sb-<ref>-auth-token`). Chaque getSession(), getUser() et requête PostgREST l'attend.
 * Au-delà de 10 s (lockAcquireTimeout, que createBrowserClient ne permet pas de régler), navigator.locks.request
 * rejette avec l'AbortError natif « signal is aborted without reason » : Sentry VITFIX-PRODUCTION-C et X,
 * 234 événements du 25/07 au 24/10/2026. Pire : quand c'est l'initialisation du client qui échoue ainsi, sa
 * promesse d'initialisation reste rejetée et tout appel d'auth échoue jusqu'au rechargement de la page
 * (squelette infini de /fr/client/dashboard le 08/10/2026).
 *
 * Ce verrou de remplacement :
 * - sans navigator.locks (ancien navigateur, ou API refusée quand le stockage du site est bloqué : SecurityError
 *   « The request was denied », Sentry F) → processLock, le verrou en mémoire du seul onglet ;
 * - avec navigator.locks → navigatorLock d'auth-js ; si l'ACQUISITION est abandonnée (AbortError après le délai,
 *   erreur de délai d'auth-js) ou refusée (SecurityError), l'opération s'exécute quand même sous le verrou du seul
 *   onglet au lieu de laisser le client mort, et le repli est signalé (console + Sentry, une fois par page). Risque
 *   résiduel : deux onglets rafraîchissent le même jeton en même temps, ce que Supabase tolère (intervalle de
 *   réutilisation du refresh token). Une opération déjà démarrée sous le verrou n'est jamais relancée.
 */
import * as Sentry from '@sentry/nextjs'
import { navigatorLock, processLock } from '@supabase/supabase-js'

export type FonctionVerrou = <R>(name: string, acquireTimeout: number, fn: () => Promise<R>) => Promise<R>

/** AbortError natif du navigateur, erreur de délai d'auth-js (`isAcquireTimeout`) ou SecurityError (API refusée). */
export function estAbandonDeVerrou(erreur: unknown): boolean {
  if (typeof erreur !== 'object' || erreur === null) return false
  const e = erreur as { name?: unknown; isAcquireTimeout?: unknown }
  return e.isAcquireTimeout === true || e.name === 'AbortError' || e.name === 'SecurityError'
}

function navigatorLocksDisponible(): boolean {
  try {
    return typeof globalThis.navigator?.locks?.request === 'function'
  } catch {
    // La simple lecture de navigator.locks peut lever quand le stockage du site est bloqué.
    return false
  }
}

export interface OptionsVerrouAuth {
  /** Signalement du repli (par défaut : console.warn à chaque fois, Sentry une fois par page). */
  signaler?: (name: string, erreur: unknown) => void
}

let repliDejaSignale = false

function decrireErreur(erreur: unknown): string {
  if (erreur instanceof Error) return `${erreur.name}: ${erreur.message}`
  if (typeof erreur === 'object' && erreur !== null && 'name' in erreur) {
    return `${String((erreur as { name: unknown }).name)}: ${String((erreur as { message?: unknown }).message ?? '')}`
  }
  return String(erreur)
}

function signalerRepliParDefaut(name: string, erreur: unknown): void {
  console.warn(`[auth] verrou ${name} abandonné, opération poursuivie sous le verrou de l'onglet :`, erreur)
  if (repliDejaSignale) return
  repliDejaSignale = true
  Sentry.captureMessage('Verrou d’auth Supabase abandonné, repli sur le verrou de l’onglet', {
    level: 'warning',
    tags: { feature: 'auth-verrou' },
    extra: { verrou: name, erreur: decrireErreur(erreur) },
  })
}

/** Tests : permet de signaler de nouveau le repli à Sentry. */
export function reinitialiserSignalementRepli(): void {
  repliDejaSignale = false
}

export function creerVerrouAuth(options: OptionsVerrouAuth = {}): FonctionVerrou {
  const signaler = options.signaler ?? signalerRepliParDefaut
  return async function verrouAuth<R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
    if (!navigatorLocksDisponible()) return processLock(name, acquireTimeout, fn)
    let demarree = false
    const fnSuivie = async (): Promise<R> => {
      demarree = true
      return fn()
    }
    try {
      return await navigatorLock(name, acquireTimeout, fnSuivie)
    } catch (erreur) {
      if (demarree || !estAbandonDeVerrou(erreur)) throw erreur
      signaler(name, erreur)
      return processLock(name, acquireTimeout, fn)
    }
  }
}
