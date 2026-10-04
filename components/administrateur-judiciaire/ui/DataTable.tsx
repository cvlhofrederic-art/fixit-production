import type { CSSProperties, Key, ReactNode } from 'react'

/** Colonne : en-tête h, cellule rendue par render(ligne) ou, à défaut, valeur brute ligne[k]. */
export interface ColonneTableau<T> {
  h: ReactNode
  k?: keyof T
  render?: (ligne: T) => ReactNode
  /** Style de l'en-tête (th). */
  style?: CSSProperties
  /** Style des cellules (td). */
  tdStyle?: CSSProperties
}

export interface DataTableProps<T> {
  columns: readonly ColonneTableau<T>[]
  rows: readonly T[]
  /** Si fourni : lignes cliquables et colonne finale avec un bouton « Détails ». */
  onRow?: ((ligne: T) => void) | null
  /** Propriété servant de clé React (index de ligne sinon). */
  rowKey?: keyof T
}

/** Tableau de données (tbl-wrap > table.tbl). */
export function DataTable<T>({ columns, rows, onRow, rowKey }: DataTableProps<T>) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map((colonne, index) => (
              <th style={colonne.style} key={index}>
                {colonne.h}
              </th>
            ))}
            {onRow && (
              <th
                style={{
                  width: 48,
                }}
              />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((ligne, index) => (
            <tr
              onClick={onRow ? () => onRow(ligne) : undefined}
              style={
                onRow
                  ? {
                      cursor: 'pointer',
                    }
                  : undefined
              }
              key={rowKey ? (ligne[rowKey] as Key) : index}
            >
              {columns.map((colonne, indexColonne) => (
                <td style={colonne.tdStyle} key={indexColonne}>
                  {colonne.render ? colonne.render(ligne) : (ligne[colonne.k as keyof T] as ReactNode)}
                </td>
              ))}
              {onRow && (
                <td
                  style={{
                    textAlign: 'right',
                  }}
                >
                  <button
                    className="btn ghost sm"
                    onClick={(evenement) => {
                      evenement.stopPropagation()
                      onRow(ligne)
                    }}
                  >
                    Détails
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
