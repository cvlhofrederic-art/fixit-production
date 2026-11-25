import type { ReactNode } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'

export interface PanelProps {
  title?: ReactNode
  sub?: ReactNode
  icon?: string
  /** Contenu aligné à droite de l'en-tête. */
  right?: ReactNode
  children?: ReactNode
  /** Corps sans marge intérieure (classe flush). */
  flush?: boolean
  /**
   * Sur téléphone, contenu de droite renvoyé sous le titre quand celui-ci manquerait de place (classe
   * vfx-entete-a-la-ligne, aj-correctifs.css). Réservé aux en-têtes que vise la décision du 22/11/2026.
   */
  controlesALaLigne?: boolean
}

/** Panneau à en-tête facultatif (affiché seulement si title ou right est fourni). */
export function Panel({ title, sub, icon, right, children, flush, controlesALaLigne }: PanelProps) {
  return (
    <div
      className="panel"
      style={{
        marginBottom: 16,
      }}
    >
      {(title || right) && (
        <div className={controlesALaLigne ? 'panel-head vfx-entete-a-la-ligne' : 'panel-head'}>
          {icon && (
            <div className="h-ico">
              <Icon name={icon} />
            </div>
          )}
          <div>
            {title && <h3>{title}</h3>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {right && <div className="right">{right}</div>}
        </div>
      )}
      <div className={`panel-body ${flush ? 'flush' : ''}`}>{children}</div>
    </div>
  )
}
