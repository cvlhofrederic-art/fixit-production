import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './FormRow.module.css'

export interface FormRowProps {
  children: ReactNode
  className?: string
}

/**
 * Rangée de formulaire v54 — port du composant `FormRow` du bundle V5.7
 * (classe CSS `.field-row` : grille 2 colonnes 1fr/1fr, gap 14px).
 *
 * Place des `Field` côte à côte. Un `Field full` occupe toute la largeur
 * (grid-column 1 / -1).
 */
export default function FormRow({ children, className }: FormRowProps) {
  return <div className={clsx(styles.fieldRow, className)}>{children}</div>
}
