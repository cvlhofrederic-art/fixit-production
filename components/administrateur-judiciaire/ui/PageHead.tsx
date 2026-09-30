import type { ReactNode } from 'react'

export interface PageHeadProps {
  title?: ReactNode
  lede?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
}

/** En-tête d'écran : surtitre, titre h1, chapeau et zone d'actions. */
export function PageHead({ title, lede, actions, eyebrow }: PageHeadProps) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {lede && <div className="lede">{lede}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}
