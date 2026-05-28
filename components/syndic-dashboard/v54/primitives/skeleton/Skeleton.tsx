import type { CSSProperties } from 'react'
import clsx from 'clsx'
import styles from './Skeleton.module.css'

export type SkeletonVariant = 'text' | 'card' | 'circle'

export interface SkeletonProps {
  /** Forme : text (ligne), card (rectangle), circle (avatar). Défaut text. */
  variant?: SkeletonVariant
  /** Largeur CSS (ex '60%', 120, '8rem'). */
  width?: number | string
  /** Hauteur CSS. Pour circle, mettre width == height. */
  height?: number | string
  className?: string
  style?: CSSProperties
}

/**
 * Placeholder de chargement v54 — port du shimmer `.vfx-skeleton` du bundle
 * V5.7 (gradient cream→#ece4d2→cream balayé, 1.6s ease-in-out).
 *
 * 3 variantes : text (ligne 1em), card (rectangle radius-lg), circle (avatar).
 * Le dimensionnement est piloté par width/height (CSS), comme le bundle.
 */
export default function Skeleton({ variant = 'text', width, height, className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={clsx(styles.skeleton, styles[variant], className)}
      style={{ width, height, ...style }}
    />
  )
}
