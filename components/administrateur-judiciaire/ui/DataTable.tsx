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
  /** Étiquette de la valeur sur la fiche du téléphone (data-label), quand h n'est pas un simple texte. */
  etiquette?: string
  /** Sur la fiche du téléphone, la valeur passe sous son étiquette, sur toute la largeur de la fiche (classe vfx-fiche-pleine). */
  pleineLargeur?: boolean
}

export interface DataTableProps<T> {
  columns: readonly ColonneTableau<T>[]
  rows: readonly T[]
  /** Si fourni : lignes cliquables et colonne finale avec un bouton « Détails ». */
  onRow?: ((ligne: T) => void) | null
  /** Propriété servant de clé React (index de ligne sinon). */
  rowKey?: keyof T
  /**
   * Nom du tableau. Sur téléphone (sous 769 px), le tableau devient une fiche par ligne (classe vfx-fiches,
   * aj-correctifs.css), l'étiquette de chaque valeur dans data-label (l'en-tête, ou colonne.etiquette). Les rôles ARIA de
   * tableau sont posés, car des lignes en bloc leur font perdre leur structure. Sans ce nom, le tableau reste comme avant.
   */
  fiches?: string
}

/** Tableau de données (tbl-wrap > table.tbl). */
export function DataTable<T>({ columns, rows, onRow, rowKey, fiches }: DataTableProps<T>) {
  const role = (nom: string) => (fiches ? nom : undefined)
  const etiquette = (colonne: ColonneTableau<T>) =>
    fiches ? (colonne.etiquette ?? (typeof colonne.h === 'string' ? colonne.h : undefined)) : undefined
  return (
    <div className="tbl-wrap">
      <table className={fiches ? 'tbl vfx-fiches' : 'tbl'} aria-label={fiches} role={role('table')}>
        <thead role={role('rowgroup')}>
          <tr role={role('row')}>
            {columns.map((colonne, index) => (
              <th style={colonne.style} key={index} role={role('columnheader')}>
                {colonne.h}
              </th>
            ))}
            {onRow && (
              <th
                role={role('columnheader')}
                style={{
                  width: 48,
                }}
              />
            )}
          </tr>
        </thead>
        <tbody role={role('rowgroup')}>
          {rows.map((ligne, index) => (
            <tr
              role={role('row')}
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
                <td
                  style={colonne.tdStyle}
                  key={indexColonne}
                  role={role('cell')}
                  data-label={etiquette(colonne)}
                  className={fiches && colonne.pleineLargeur ? 'vfx-fiche-pleine' : undefined}
                >
                  {colonne.render ? colonne.render(ligne) : (ligne[colonne.k as keyof T] as ReactNode)}
                </td>
              ))}
              {onRow && (
                <td
                  role={role('cell')}
                  data-label={fiches ? 'Détails' : undefined}
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
