import type { ReactNode } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'

export interface AlertProps {
  /** Variante de couleur (classe ajoutée à « alert »), ex. « warn », « info », « rust ». */
  kind?: string
  /** « alert » par défaut. */
  icon?: string
  title?: ReactNode
  children?: ReactNode
}

/** Bandeau d'alerte : pictogramme, titre en gras et texte facultatif. */
export function Alert({ kind, icon, title, children }: AlertProps) {
  return (
    <div className={`alert ${kind || ''}`}>
      <Icon name={icon || 'alert'} />
      <div>
        <b>{title}</b>
        {children && <p>{children}</p>}
      </div>
    </div>
  )
}
