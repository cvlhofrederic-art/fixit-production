import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './PageHead.module.css'

export interface PageHeadProps {
  title: ReactNode
  /** Texte d'introduction sous le titre. */
  lede?: ReactNode
  /** Boutons/actions alignés à droite. */
  actions?: ReactNode
  /** Kicker au-dessus du titre (gold, uppercase). */
  eyebrow?: ReactNode
  className?: string
}

/**
 * En-tête de page v54 — port byte-exact du `PageHead` du bundle V5.7.
 * eyebrow (kicker) + h1 serif + lede + slot actions à droite.
 */
export default function PageHead({ title, lede, actions, eyebrow, className }: PageHeadProps) {
  return (
    <div className={clsx(styles.pageHead, className)}>
      <div>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h1>{title}</h1>
        {lede && <div className={styles.lede}>{lede}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
