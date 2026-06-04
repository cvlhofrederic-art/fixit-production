import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Skeleton.module.css'

/** Conteneurs de squelette du bundle V5.7 (`.vfx-skeleton-{card,row,kpi}`). */
export type SkeletonVariant = 'card' | 'row' | 'kpi'

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * Conteneur de chargement. Omis → barre shimmer atomique (`.vfx-skeleton`).
   * card = carte blanche bordée · row = ligne de liste · kpi = bloc indicateur.
   */
  variant?: SkeletonVariant
  /** Largeur CSS de la barre atomique (ignorée par les conteneurs). */
  width?: number | string
  /** Hauteur CSS de la barre atomique. */
  height?: number | string
  /** Rayon de la barre atomique (défaut r-sm ; ex '50%' pour un avatar). */
  radius?: number | string
  /** Barres internes des conteneurs card/row/kpi. */
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Placeholder de chargement v54 — port exact du bundle V5.7.
 *
 * Sans `variant` : barre shimmer atomique `.vfx-skeleton`
 * (gradient cream→#ece4d2→cream balayé, animation 1.6s ease-in-out),
 * dimensionnée par width/height/radius.
 *
 * `variant` card/row/kpi : conteneurs qui arrangent des barres atomiques.
 * En `kpi`, les barres descendantes passent en display:block (règle bundle).
 *
 * Toujours `aria-hidden` (décoratif).
 */
export default function Skeleton({
  variant,
  width,
  height,
  radius,
  children,
  className,
  style,
  ...rest
}: SkeletonProps) {
  if (variant) {
    return (
      <div aria-hidden="true" className={clsx(styles[variant], className)} style={style} {...rest}>
        {children}
      </div>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={clsx(styles.skeleton, className)}
      style={{ width, height, borderRadius: radius, ...style }}
      {...rest}
    />
  )
}
