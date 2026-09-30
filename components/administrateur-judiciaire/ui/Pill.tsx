import type { ReactNode } from 'react'

export interface PillProps {
  /** Variante de couleur : « sage », « amber », « rust », « gold », « navy »… */
  kind?: string
  /** Masque la pastille de couleur (classe no-dot). */
  noDot?: boolean
  children?: ReactNode
}

/** Étiquette de statut. */
export function Pill({ kind, children, noDot }: PillProps) {
  return <span className={`pill ${kind || ''} ${noDot ? 'no-dot' : ''}`}>{children}</span>
}
