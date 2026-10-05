'use client'

import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'

/** Vue d'un agent : la conversation (« Assistant ») ou son tableau de bord (« Tableau »). */
export type OngletAgent = 'assistant' | 'tableau'

export interface OngletsAgentProps {
  onglet: OngletAgent
  onChange: (onglet: OngletAgent) => void
}

/** Taille et alignement des icônes des puces, comme dans la maquette. */
const STYLE_ICONE = {
  width: 13,
  height: 13,
  verticalAlign: '-2px',
  marginRight: 5,
}

/**
 * Puces « Assistant » / « Tableau » en tête d'un écran d'agent (Tempo, Fixy) : même balisage que l'écran Tempo de la
 * maquette.
 */
export function OngletsAgent({ onglet, onChange }: OngletsAgentProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: 18,
      }}
    >
      <button className={`chip ${onglet === 'assistant' ? 'active' : ''}`} onClick={() => onChange('assistant')}>
        <Icon name="bot" style={STYLE_ICONE} />
        Assistant
      </button>
      <button className={`chip ${onglet === 'tableau' ? 'active' : ''}`} onClick={() => onChange('tableau')}>
        <Icon name="grid" style={STYLE_ICONE} />
        Tableau
      </button>
    </div>
  )
}
