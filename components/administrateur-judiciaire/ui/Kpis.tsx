import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'

/** Badge de tendance affiché en haut à droite de la carte (classe trend <kind>, « ok » par défaut). */
export interface TendanceKpi {
  kind?: string
  label?: ReactNode
}

export interface KpiProps {
  /** « chart » par défaut ; remplacé par une pastille si dot est fourni. */
  icon?: string
  num?: ReactNode
  /** Unité monétaire (span.cur). */
  cur?: ReactNode
  lbl?: ReactNode
  sub?: ReactNode
  /** « sage », « amber », « rust », « gold »… (classes de couleur de la carte et du nombre). */
  accent?: string
  trend?: TendanceKpi | null
  /** Complément affiché en petit après le nombre (span.small). */
  suffix?: ReactNode
  numChildren?: ReactNode
  subChildren?: ReactNode
  numStyle?: CSSProperties
  /** Variante de pastille (span.kpi-dot--<dot>) à la place du pictogramme. */
  dot?: string
  /** Libellé au-dessus du nombre (et non en dessous). */
  lblFirst?: boolean
}

/** Carte d'indicateur clé. */
export function Kpi({
  icon,
  num,
  cur,
  lbl,
  sub,
  accent,
  trend,
  suffix,
  numChildren,
  subChildren,
  numStyle,
  dot,
  lblFirst,
}: KpiProps) {
  return (
    <div
      className={`kpi ${accent === 'sage' || accent === 'amber' || accent === 'rust' ? accent : ''} ${accent ? 'accent-' + accent : ''}`}
    >
      <div className="head-row">
        {dot ? (
          <span className={`kpi-dot kpi-dot--${dot}`} aria-hidden="true" />
        ) : (
          <div className="ico">
            <Icon name={icon || 'chart'} />
          </div>
        )}
        {trend && <span className={`trend ${trend.kind || 'ok'}`}>{trend.label}</span>}
      </div>
      {lblFirst && <div className="lbl">{lbl}</div>}
      <div
        className={`num ${accent === 'sage' ? 'sage' : accent === 'rust' ? 'rust' : accent === 'amber' ? 'amber' : ''}`}
        style={{
          ...(lblFirst
            ? {
                marginTop: 6,
              }
            : {}),
          ...numStyle,
        }}
      >
        {num}
        {cur && <span className="cur">{cur}</span>}
        {suffix && <span className="small">{suffix}</span>}
        {numChildren}
      </div>
      {!lblFirst && <div className="lbl">{lbl}</div>}
      {(sub || subChildren) && (
        <div className="sub">
          {sub}
          {subChildren}
        </div>
      )}
    </div>
  )
}

/** Grille d'indicateurs (clé React = index). */
export function Kpis({ items }: { items: readonly KpiProps[] }) {
  return (
    <div className="kpi-grid">
      {items.map((item, index) => (
        <Kpi {...item} key={index} />
      ))}
    </div>
  )
}
