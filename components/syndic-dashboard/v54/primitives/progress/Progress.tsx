import clsx from 'clsx'
import styles from './Progress.module.css'

export type ProgressKind = 'sage' | 'rust' | 'amber'

export interface ProgressProps {
  /** Pourcentage rempli (0-100). */
  pct: number
  /** Teinte de la barre (défaut : gold). */
  kind?: ProgressKind
  className?: string
}

/**
 * Barre de progression v54 — port byte-exact du `Progress` du bundle V5.7
 * (track cream + barre dégradée, kinds sage/rust/amber, gold par défaut).
 * + a11y : role=progressbar avec aria-valuenow/min/max (le bundle n'en avait pas).
 */
export default function Progress({ pct, kind, className }: ProgressProps) {
  const value = Math.min(100, Math.max(0, pct))
  return (
    <div
      className={clsx(styles.progress, kind && styles[kind], className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${value}%` }} />
    </div>
  )
}
