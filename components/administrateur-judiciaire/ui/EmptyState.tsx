import type { ReactNode } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import { ILLUSTRATIONS, type NomIllustration } from '@/components/administrateur-judiciaire/ui/illustrations'

export interface EmptyStateProps {
  /** Pictogramme de la pastille (« check » par défaut), ignoré si une illustration est fournie. */
  icon?: string
  /** Variante de couleur de la pastille (badge-circle). */
  kind?: string
  title?: ReactNode
  desc?: ReactNode
  action?: ReactNode
  illustration?: NomIllustration
}

/** État vide : illustration SVG (classe empty--illus) ou pastille à pictogramme, titre, texte et action. */
export function EmptyState({ icon, kind, title, desc, action, illustration }: EmptyStateProps) {
  const svg = illustration && ILLUSTRATIONS[illustration]
  return (
    <div className={`empty ${svg ? 'empty--illus' : ''}`}>
      {svg ? (
        <div
          className="empty-illus"
          aria-hidden="true"
          dangerouslySetInnerHTML={{
            // Contenu sans entrée utilisateur : `svg` vient de la constante ILLUSTRATIONS (clé typée NomIllustration).
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
            __html: svg,
          }}
        />
      ) : (
        <div className={`badge-circle ${kind || ''}`}>
          <Icon name={icon || 'check'} />
        </div>
      )}
      {title && <h4>{title}</h4>}
      {desc && <p>{desc}</p>}
      {action}
    </div>
  )
}
