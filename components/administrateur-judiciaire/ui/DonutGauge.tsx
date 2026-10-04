import type { ReactNode } from 'react'

/** Couleur de l'anneau selon la variante (or par défaut, y compris pour une variante inconnue). */
const COULEURS_ANNEAU: Readonly<Record<string, string>> = {
  gold: 'var(--gold-500)',
  sage: 'var(--sage-500)',
  rust: 'var(--rust-500)',
  amber: 'var(--amber-500)',
  navy: 'var(--navy-600)',
}

export interface DonutGaugeProps {
  /** Pourcentage (0 par défaut), arrondi à l'affichage. */
  pct?: number
  /** « gold » par défaut ; « sage », « rust », « amber » ou « navy ». */
  kind?: string
  label?: ReactNode
  /** Diamètre en px (140 par défaut). */
  size?: number
  /** Épaisseur de l'anneau en px (14 par défaut). */
  stroke?: number
}

/** Jauge circulaire (anneau SVG tourné de -90°, pourcentage au centre). */
export function DonutGauge({ pct = 0, kind = 'gold', label, size = 140, stroke = 14 }: DonutGaugeProps) {
  const rayon = (size - stroke) / 2
  const circonference = 2 * Math.PI * rayon
  const decalage = circonference - (pct / 100) * circonference
  const couleur = COULEURS_ANNEAU[kind] || 'var(--gold-500)'
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        style={{
          transform: 'rotate(-90deg)',
        }}
      >
        <circle cx={size / 2} cy={size / 2} r={rayon} fill="none" stroke="var(--cream)" strokeWidth={stroke} />
        <circle
          className="donut__ring"
          cx={size / 2}
          cy={size / 2}
          r={rayon}
          fill="none"
          stroke={couleur}
          strokeWidth={stroke}
          strokeDasharray={circonference}
          strokeDashoffset={decalage}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Cormorant Garamond,serif',
            fontSize: 30,
            lineHeight: 1,
          }}
        >
          {Math.round(pct)}
          <span
            style={{
              fontSize: 16,
              color: 'var(--navy-300)',
            }}
          >
            %
          </span>
        </div>
        {label && (
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--navy-300)',
              marginTop: 2,
              textAlign: 'center',
            }}
          >
            {label}
          </div>
        )}
      </div>
    </div>
  )
}
