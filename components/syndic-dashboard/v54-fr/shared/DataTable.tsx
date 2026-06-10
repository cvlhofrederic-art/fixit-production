'use client'

// Tableau générique — port du DataTable du mockup v8. Réutilise les classes
// table du namespace PT (modules.module.css). L'interaction « détail » passe
// par le bouton Détails (accessible clavier) — pas de onClick sur <tr>
// (conformité jsx-a11y/S1082, conventions PT).

import type { CSSProperties, ReactNode } from 'react'
import { Button } from '@/components/syndic-dashboard/v54/primitives/button'
import m from '@/components/syndic-dashboard/v54/modules/modules.module.css'

export interface DataTableColumn<T> {
  h: ReactNode
  k?: keyof T & string
  style?: CSSProperties
  tdStyle?: CSSProperties
  render?: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  onRow?: (row: T) => void
  rowKey?: keyof T & string
  /** Libellé du bouton d'action de ligne (défaut « Détails »). */
  rowAction?: string
}

export default function DataTable<T>({ columns, rows, onRow, rowKey, rowAction = 'Détails' }: Readonly<DataTableProps<T>>) {
  return (
    <div className={m.tblWrap}>
      <table className={m.tbl}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={c.style}>{c.h}</th>
            ))}
            {onRow && <th style={{ width: 48 }} aria-label={rowAction} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={rowKey ? String(r[rowKey]) : ri}>
              {columns.map((c, ci) => (
                <td key={ci} style={c.tdStyle}>{c.render ? c.render(r) : c.k ? (r[c.k] as ReactNode) : null}</td>
              ))}
              {onRow && (
                <td style={{ textAlign: 'right' }}>
                  <Button variant="ghost" size="sm" onClick={() => onRow(r)}>{rowAction}</Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
