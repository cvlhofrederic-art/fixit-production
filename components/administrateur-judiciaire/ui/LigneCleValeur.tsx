import type { ReactNode } from 'react'

export interface LigneCleValeurProps {
  /** Libellé. */
  k: ReactNode
  /** Valeur (texte, Pill…). */
  v: ReactNode
}

/** Ligne libellé / valeur séparée par un filet (fiches 360°). */
export function LigneCleValeur({ k, v }: LigneCleValeurProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid var(--line)',
        fontSize: 13,
      }}
    >
      <span
        style={{
          color: 'var(--navy-500)',
        }}
      >
        {k}
      </span>
      <span
        style={{
          fontWeight: 600,
          textAlign: 'right',
        }}
      >
        {v}
      </span>
    </div>
  )
}

/** Doublon exact de LigneCleValeur dans la maquette (fiche 360° d'une personne) : même DOM, mêmes styles. */
export const LigneCleValeurPersonne = LigneCleValeur
