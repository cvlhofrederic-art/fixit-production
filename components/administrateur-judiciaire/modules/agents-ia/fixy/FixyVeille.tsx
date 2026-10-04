import { FixyActions } from '@/components/administrateur-judiciaire/modules/agents-ia/fixy/FixyActions'
import { Pill } from '@/components/administrateur-judiciaire/ui/Pill'
import type { ActionFixy } from '@/lib/administrateur-judiciaire/domain/fixy/agents'
import type { RappelVeille } from '@/lib/administrateur-judiciaire/domain/fixy/veille'

export interface FixyVeilleProps {
  veille: readonly RappelVeille[]
  faites: readonly string[]
  onAction: (action: ActionFixy) => void
  enCours: string | null
  /** Nombre maximal de rappels affichés (lanceur du Shell) ; le reste est annoncé « sur la page Fixy ». */
  max?: number
}

/** Rappels de la veille de Fixy : agent (étiquette de la couleur de gravité), texte et action proposée. */
export function FixyVeille({ veille, faites, onAction, enCours, max }: FixyVeilleProps) {
  const affiches = max ? veille.slice(0, max) : veille
  return veille.length === 0 ? (
    <p
      style={{
        fontSize: 13,
        color: 'var(--navy-300)',
        margin: 0,
      }}
    >
      Rien à signaler : aucun courrier en attente, aucune échéance échue, aucun débiteur sans dossier.
    </p>
  ) : (
    <>
      {affiches.map((rappel) => (
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            padding: '10px 0',
            borderBottom: '1px solid var(--line)',
          }}
          key={rappel.id}
        >
          <Pill kind={rappel.gravite} noDot>
            {rappel.agent}
          </Pill>
          <div
            style={{
              flex: 1,
              fontSize: 13,
            }}
          >
            {rappel.texte}
            {rappel.action && (
              <div>
                <FixyActions actions={[rappel.action]} faites={faites} onAction={onAction} enCours={enCours} />
              </div>
            )}
          </div>
        </div>
      ))}
      {max && veille.length > max && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--navy-300)',
            margin: '8px 0 0',
          }}
        >
          {veille.length - max}
          {' autre'}
          {veille.length - max > 1 ? 's' : ''}
          {' rappel'}
          {veille.length - max > 1 ? 's' : ''}
          {' sur la page Fixy.'}
        </p>
      )}
    </>
  )
}
