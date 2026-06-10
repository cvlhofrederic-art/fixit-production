'use client'

import {
  createContext, useCallback, useContext, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import clsx from 'clsx'
import Icon from '../icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import styles from './Toast.module.css'

export type ToastKind = 'success' | 'info' | 'warning' | 'error'

export interface ToastInput {
  kind?: ToastKind
  title?: ReactNode
  desc?: ReactNode
  /** Override de la durée auto-dismiss en ms. 0 = persistant (défaut error). */
  duration?: number
}

interface ToastItem extends ToastInput {
  id: number
  kind: ToastKind
  duration: number
}

export interface ToastApi {
  /** Empile un toast, retourne son id. */
  push: (toast: ToastInput) => number
  /** Retire un toast par id. */
  dismiss: (id: number) => void
}

/** Durées auto-dismiss par kind (byte-exact bundle V5.7). error = 0 = persistant. */
const DURATION: Record<ToastKind, number> = { success: 4000, info: 5000, warning: 6000, error: 0 }
const ICON: Record<ToastKind, IconName> = { success: 'check', info: 'info', warning: 'alert', error: 'alert' }
/** Cap byte-exact bundle : 3 toasts visibles (slice(-2) + nouveau), FIFO drop du plus vieux. */
const MAX_VISIBLE = 3

const NOOP: ToastApi = { push: () => -1, dismiss: () => {} }
const ToastContext = createContext<ToastApi | null>(null)

/** Hook d'accès au Toast. Hors `ToastProvider` → no-op safe (port du fallback bundle). */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP
}

/**
 * Système de toasts v54 — port du `ToastProvider`/`useToast` du bundle V5.7
 * (Context + useState, viewport inline fixe bas-droite, 4 kinds, cap 3 FIFO,
 * auto-dismiss par kind) + durcissements validés avec le design author :
 *   - `useMemo` sur la value du Context (le bundle re-crée l'objet à chaque
 *     render → cascades de re-render chez les consommateurs) ;
 *   - pause du timer auto-dismiss au survol ET au focus-within (un toast court
 *     ne doit pas disparaître pendant qu'on le lit / qu'on Tab vers le close).
 * Inline (pas de portal) : le viewport vit dans `#syndic-dashboard-v54`, donc
 * l'`inert` d'un Modal ouvert le neutralise naturellement (cf. issue #253,
 * option 1 « toasts en pause pendant modal », résolue par design).
 * Visuel byte-exact ; classes en CSS Module (les `.vfx-toast*` du bundle étaient
 * un préfixe anti-collision global, inutile sous CSS Modules).
 */
export interface ToastProviderProps {
  children: ReactNode
  /** Libellé accessible du bouton fermer (défaut bundle : « Fechar notificação »). */
  closeLabel?: string
  /** Libellé accessible de la région des toasts (défaut bundle : « Notificações »). */
  regionLabel?: string
}

export function ToastProvider({ children, closeLabel = 'Fechar notificação', regionLabel = 'Notificações' }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const clearTimer = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t != null) {
      clearTimeout(t)
      timers.current.delete(id)
    }
  }, [])

  const dismiss = useCallback((id: number) => {
    clearTimer(id)
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [clearTimer])

  // (re)démarre le timer auto-dismiss (durée pleine — version simple validée design).
  const startTimer = useCallback((id: number, duration: number) => {
    if (duration <= 0) return // error = persistant, pas de timer
    clearTimer(id)
    timers.current.set(id, setTimeout(() => dismiss(id), duration))
  }, [clearTimer, dismiss])

  const push = useCallback((toast: ToastInput) => {
    const id = ++idRef.current
    const kind = toast.kind ?? 'info'
    const duration = toast.duration != null ? toast.duration : DURATION[kind]
    setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { ...toast, id, kind, duration }])
    startTimer(id, duration)
    return id
  }, [startTimer])

  // Mémoïsé : la value ne se re-crée que si push/dismiss changent (ils sont stables).
  const value = useMemo<ToastApi>(() => ({ push, dismiss }), [push, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.viewport} role="region" aria-label={regionLabel}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(styles.toast, styles[t.kind])}
            role={t.kind === 'error' ? 'alert' : 'status'}
            aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
            onMouseEnter={() => clearTimer(t.id)}
            onMouseLeave={() => startTimer(t.id, t.duration)}
            onFocus={() => clearTimer(t.id)}
            onBlur={() => startTimer(t.id, t.duration)}
          >
            <Icon name={ICON[t.kind]} />
            <div className={styles.body}>
              {t.title != null && <div className={styles.title}>{t.title}</div>}
              {t.desc != null && <div className={styles.desc}>{t.desc}</div>}
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={() => dismiss(t.id)}
              aria-label={closeLabel}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
