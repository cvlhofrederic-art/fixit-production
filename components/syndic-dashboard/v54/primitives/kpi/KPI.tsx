import type { CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'
import Icon from '../icon/Icon'
import type { IconName } from '@/lib/syndic/icon-names'
import styles from './KPI.module.css'

export type KPIAccent = 'sage' | 'amber' | 'rust' | 'gold'
export type KPITrendKind = 'ok' | 'flat' | 'warn' | 'bad'

export interface KPITrend {
  /** ok=vert / flat=neutre / warn=ambre / bad=rouille. Défaut ok. */
  kind?: KPITrendKind
  label: ReactNode
}

export interface KPIProps {
  icon?: IconName
  /** Le grand nombre (serif). */
  num?: ReactNode
  /** Devise (gold, italique, 22px) accolée au nombre. */
  cur?: ReactNode
  /** Libellé sous (ou au-dessus si lblFirst) le nombre. */
  lbl?: ReactNode
  /** Sous-texte discret. */
  sub?: ReactNode
  /** Accent : liseré haut + couleur de l'icône (sage/amber/rust) et du nombre. */
  accent?: KPIAccent
  /** Badge de tendance en haut à droite. */
  trend?: KPITrend
  /** Suffixe (16px, navy-300) accolé au nombre (ex %, m²). */
  suffix?: ReactNode
  /** Contenu custom dans le slot nombre. */
  numChildren?: ReactNode
  /** Contenu custom dans le slot sous-texte. */
  subChildren?: ReactNode
  /** Visuel central (donut, mini-graph…) — passe la carte en layout colonne. */
  centerVisual?: ReactNode
  /** Style inline additionnel sur le nombre. */
  numStyle?: CSSProperties
  /** Affiche une pastille colorée au lieu de l'icône. */
  dot?: 'sage' | 'amber' | 'rust' | 'gold'
  /** Place le libellé avant le nombre. */
  lblFirst?: boolean
  className?: string
}

const ACCENT_BORDER: Record<KPIAccent, string> = {
  gold: styles.accentGold,
  sage: styles.accentSage,
  amber: styles.accentAmber,
  rust: styles.accentRust,
}
const ICO_ACCENT: Partial<Record<KPIAccent, string>> = {
  sage: styles.icoSage,
  amber: styles.icoAmber,
  rust: styles.icoRust,
}
const NUM_ACCENT: Partial<Record<KPIAccent, string>> = {
  sage: styles.numSage,
  amber: styles.numAmber,
  rust: styles.numRust,
}
const DOT_VARIANT: Record<string, string> = {
  sage: styles.kpiDotSage,
  amber: styles.kpiDotAmber,
  rust: styles.kpiDotRust,
  gold: styles.kpiDotGold,
}
const TREND_KIND: Record<KPITrendKind, string> = {
  ok: styles.ok,
  flat: styles.flat,
  warn: styles.warn,
  bad: styles.bad,
}

/**
 * Indicateur clé v54 — port byte-exact du `KPI` du bundle V5.7.
 * Icône (ou pastille `dot`) + tendance, nombre serif (avec devise/suffixe),
 * libellé, sous-texte. `accent` colore liseré + icône + nombre. `centerVisual`
 * insère un visuel central et passe la carte en layout colonne.
 */
export default function KPI({
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
  centerVisual,
  numStyle,
  dot,
  lblFirst,
  className,
}: KPIProps) {
  return (
    <div
      className={clsx(
        styles.kpi,
        accent && ACCENT_BORDER[accent],
        centerVisual && styles.kpiWithVisual,
        className,
      )}
    >
      <div className={styles.headRow}>
        {dot ? (
          <span className={clsx(styles.kpiDot, DOT_VARIANT[dot])} aria-hidden="true" />
        ) : (
          <div className={clsx(styles.ico, accent && ICO_ACCENT[accent])}>
            <Icon name={icon || 'chart'} />
          </div>
        )}
        {trend && <span className={clsx(styles.trend, TREND_KIND[trend.kind || 'ok'])}>{trend.label}</span>}
      </div>
      {centerVisual && <div className={styles.kpiVisual}>{centerVisual}</div>}
      {lblFirst && <div className={styles.lbl}>{lbl}</div>}
      <div
        className={clsx(styles.num, accent && NUM_ACCENT[accent])}
        style={{ ...(lblFirst ? { marginTop: 6 } : {}), ...numStyle }}
      >
        {num}
        {cur && <span className={styles.cur}>{cur}</span>}
        {suffix && <span className={styles.small}>{suffix}</span>}
        {numChildren}
      </div>
      {!lblFirst && <div className={styles.lbl}>{lbl}</div>}
      {(sub || subChildren) && (
        <div className={styles.sub}>
          {sub}
          {subChildren}
        </div>
      )}
    </div>
  )
}
