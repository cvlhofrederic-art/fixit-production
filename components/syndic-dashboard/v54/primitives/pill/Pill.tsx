import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Pill.module.css'

/** Variantes de couleur du Pill (port V5.7). `dark` = fond navy-900 / texte gold-400. */
export type PillKind = 'sage' | 'amber' | 'rust' | 'gold' | 'dark'

export interface PillProps {
  /** Variante de couleur. Omis = défaut cream / navy-500. */
  kind?: PillKind
  /** Masque le point indicateur (5×5) à gauche du texte. */
  noDot?: boolean
  children: ReactNode
  className?: string
}

/**
 * Badge/étiquette v54 — port pixel-perfect du `.pill` du bundle V5.7.
 *
 * Le point (::before 5×5, currentColor opacity 0.7) hérite de la couleur du
 * texte du kind. `noDot` le retire. Dimensions et tints exacts du bundle
 * (font 11px/600, padding 3px 9px, radius pill, tints en -50).
 */
export default function Pill({ kind, noDot, children, className }: PillProps) {
  return (
    <span className={clsx(styles.pill, kind && styles[kind], noDot && styles.noDot, className)}>
      {children}
    </span>
  )
}
