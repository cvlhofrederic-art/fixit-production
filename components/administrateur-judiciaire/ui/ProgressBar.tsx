export interface ProgressBarProps {
  /** Pourcentage de remplissage, non borné (au-delà de 100, la barre déborde comme dans la maquette). */
  pct: number
  /** Variante de couleur (classe ajoutée à « progress »). */
  kind?: string
}

/** Barre de progression horizontale. */
export function ProgressBar({ pct, kind }: ProgressBarProps) {
  return (
    <div className={`progress ${kind || ''}`}>
      <div
        style={{
          width: `${pct}%`,
        }}
      />
    </div>
  )
}
