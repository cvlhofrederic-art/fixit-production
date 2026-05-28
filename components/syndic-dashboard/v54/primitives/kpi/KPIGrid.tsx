import clsx from 'clsx'
import KPI, { type KPIProps } from './KPI'
import styles from './KPI.module.css'

export interface KPIGridProps {
  items: KPIProps[]
  className?: string
}

/**
 * Grille de KPI v54 — port byte-exact du `KPIGrid` du bundle V5.7.
 * `repeat(auto-fit, minmax(180px, 1fr))` : autant de colonnes que la largeur
 * le permet (≥180px), responsive sans media query.
 */
export default function KPIGrid({ items, className }: KPIGridProps) {
  return (
    <div className={clsx(styles.kpiGrid, className)}>
      {items.map((it, i) => (
        <KPI key={i} {...it} />
      ))}
    </div>
  )
}
