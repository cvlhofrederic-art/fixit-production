import type { ReactNode } from 'react'
import clsx from 'clsx'
import Icon from '../icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import styles from './Panel.module.css'

export interface PanelProps {
  title?: ReactNode
  sub?: ReactNode
  icon?: IconName
  /** Contenu aligné à droite du header (actions, badge…). */
  right?: ReactNode
  children?: ReactNode
  /** Retire le padding du corps (pour tableaux pleine largeur, listes…). */
  flush?: boolean
  className?: string
}

/**
 * Carte de section v54 — port byte-exact du `Panel` du bundle V5.7.
 * Header optionnel (icône + titre + sous-titre + slot droit), corps avec
 * padding (ou `flush` pour coller les bords).
 */
export default function Panel({ title, sub, icon, right, children, flush, className }: PanelProps) {
  return (
    <div className={clsx(styles.panel, className)} style={{ marginBottom: 16 }}>
      {(title || right) && (
        <div className={styles.panelHead}>
          {icon && (
            <div className={styles.hIco}>
              <Icon name={icon} />
            </div>
          )}
          <div>
            {title && <h3>{title}</h3>}
            {sub && <div className={styles.sub}>{sub}</div>}
          </div>
          {right && <div className={styles.right}>{right}</div>}
        </div>
      )}
      <div className={clsx(styles.panelBody, flush && styles.flush)}>{children}</div>
    </div>
  )
}
