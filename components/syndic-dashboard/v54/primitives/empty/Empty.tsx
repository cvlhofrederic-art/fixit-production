import type { ReactNode } from 'react'
import clsx from 'clsx'
import Icon from '../icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import { EMPTY_ILLUSTRATIONS, type EmptyIllustration } from '@/lib/syndic/empty-illustrations'
import styles from './Empty.module.css'

/** Couleur du badge-circle (mode fallback sans illustration). */
export type EmptyBadgeKind = 'sage' | 'gold' | 'rust'

export interface EmptyProps {
  /** Icône du badge-circle (fallback). Défaut `check`. */
  icon?: IconName
  /** Couleur du badge-circle (fallback). */
  kind?: EmptyBadgeKind
  title?: ReactNode
  desc?: ReactNode
  /** CTA optionnel (bouton…). */
  action?: ReactNode
  /** Illustration SVG du bundle (prioritaire sur le badge-circle). */
  illustration?: EmptyIllustration
  className?: string
}

/**
 * État vide v54 — port byte-exact du `Empty` du bundle V5.7.
 * Deux modes : illustration SVG (`illustration`, port bundle) OU badge-circle
 * + icône en fallback. Titre serif + description + action optionnelle.
 */
export default function Empty({ icon, kind, title, desc, action, illustration, className }: EmptyProps) {
  const svg = illustration ? EMPTY_ILLUSTRATIONS[illustration] : undefined
  return (
    <div className={clsx(styles.empty, className)}>
      {svg ? (
        // Safe: `svg` vient de EMPTY_ILLUSTRATIONS (const statique), clé typée
        // EmptyIllustration (compile-time) → aucun input utilisateur n'atteint __html.
        // title/desc/action ci-dessous sont du JSX normal (pas de dangerouslySet).
        <div className={styles.illus} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className={clsx(styles.badgeCircle, kind && styles[kind])}>
          <Icon name={icon || 'check'} />
        </div>
      )}
      {title && <h4>{title}</h4>}
      {desc && <p>{desc}</p>}
      {action}
    </div>
  )
}
