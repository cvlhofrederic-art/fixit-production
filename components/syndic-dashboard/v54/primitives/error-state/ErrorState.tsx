import type { ReactNode } from 'react'
import { Empty } from '../empty'
import { Button } from '../button'
import Icon from '../icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'

export interface ErrorStateProps {
  /** Icône du badge rust. Défaut `alert`. */
  icon?: IconName
  title?: ReactNode
  desc?: ReactNode
  /** CTA personnalisé (prioritaire sur `onRetry`). */
  action?: ReactNode
  /** Affiche un bouton « Tentar novamente » qui appelle ce callback. */
  onRetry?: () => void
}

/**
 * ErrorState v54 — port byte-exact du `ErrorState` du bundle V5.7.
 * Réutilise la structure du primitive `Empty` (badge-circle + titre + desc),
 * en variante `rust` : badge rust + titre rust + bouton « Tentar novamente ».
 */
export default function ErrorState({ icon = 'alert', title, desc, action, onRetry }: Readonly<ErrorStateProps>) {
  return (
    <Empty
      kind="rust"
      icon={icon}
      title={<span style={{ color: 'var(--v54-rust-700)' }}>{title}</span>}
      desc={desc}
      action={action ?? (onRetry ? <Button onClick={onRetry}><Icon name="refresh" />Tentar novamente</Button> : undefined)}
    />
  )
}
