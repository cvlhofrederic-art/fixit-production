import type { ReactNode } from 'react'
import clsx from 'clsx'
import Icon from '../icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import styles from './Alert.module.css'

/** Variantes Alert du bundle V5.7. Défaut (omis) = amber. */
export type AlertKind = 'rust' | 'sage' | 'gold'

export interface AlertProps {
  /** Variante de couleur. Omis = amber (défaut). */
  kind?: AlertKind
  /** Icône (défaut `alert`). */
  icon?: IconName
  title?: ReactNode
  /**
   * Contenu — rendu dans un `<p>`. INLINE-SAFE uniquement : pas de `<div>`/`<p>`
   * enfant (provoquerait un validateDOMNesting). Pour du bloc, utiliser
   * `<span style={{ display: 'block' }}>`.
   */
  children?: ReactNode
  className?: string
}

/**
 * Encart d'alerte v54 — port byte-exact du `Alert` du bundle V5.7.
 * 4 kinds : amber (défaut) / rust / sage / gold. Icône + titre `<b>` + corps `<p>`.
 */
export default function Alert({ kind, icon, title, children, className }: AlertProps) {
  return (
    <div className={clsx(styles.alert, kind && styles[kind], className)}>
      <Icon name={icon || 'alert'} />
      <div>
        <b>{title}</b>
        {children && <p>{children}</p>}
      </div>
    </div>
  )
}
