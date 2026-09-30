import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'
import type { ActionFixy } from '@/lib/administrateur-judiciaire/domain/fixy/agents'

export interface FixyActionsProps {
  actions: readonly ActionFixy[]
  /** Identifiants des actions déjà exécutées (bouton désactivé, libellé « Fait · … »). */
  faites: readonly string[]
  onAction: (action: ActionFixy) => void
  /** Identifiant de l'action en cours d'exécution (bouton désactivé). */
  enCours: string | null
}

/**
 * Boutons d'actions proposées par Fixy : doré (coche) pour une action qui écrit dans la base, simple (flèche)
 * pour une navigation ; l'infobulle annonce l'effet.
 */
export function FixyActions({ actions, faites, onAction, enCours }: FixyActionsProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginTop: 10,
      }}
    >
      {actions.map((action) => {
        const faite = faites.includes(action.id)
        return (
          <button
            className={`btn ${action.ecrit ? 'gold' : ''}`}
            title={action.effet}
            disabled={faite || enCours === action.id}
            onClick={() => onAction(action)}
            key={action.id}
          >
            <Icon name={action.ecrit ? 'check' : 'arrow'} />
            {faite ? `Fait · ${action.label}` : action.label}
          </button>
        )
      })}
      {actions.some((action) => action.ecrit) && (
        <span
          style={{
            fontSize: 11.5,
            color: 'var(--navy-300)',
            alignSelf: 'center',
          }}
        >
          Doré = écrit dans la base, un clic vaut confirmation.
        </span>
      )}
    </div>
  )
}
