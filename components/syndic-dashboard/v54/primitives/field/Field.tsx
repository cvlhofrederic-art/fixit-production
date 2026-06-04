import { Children, cloneElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Field.module.css'

export interface FieldProps {
  /** Libellé rendu dans un `<label>` lié à l'enfant. */
  label: ReactNode
  /** Identifiant : devient l'`id` ET le `name` de l'enfant + cible du `htmlFor`. */
  name: string
  /** Enfant unique : l'input / select / textarea natif. */
  children: ReactElement
  /** Champ requis (astérisque + aria-required). */
  required?: boolean
  /** Texte d'aide sous le champ (lié via aria-describedby). */
  hint?: ReactNode
  /** Message d'erreur (état has-err + role alert + aria-invalid). */
  error?: ReactNode
  /** Occupe toute la largeur dans un FormRow (grid-column 1 / -1). */
  full?: boolean
  /** Suffixe visuel dans le champ (unité : €, %, dias…). */
  suffix?: ReactNode
  className?: string
}

/**
 * Champ de formulaire v54 — port byte-exact du composant `Field` du bundle V5.7.
 *
 * Clone l'enfant unique pour y injecter `id={name}`, `name` et les attributs aria
 * (describedby / invalid / required). Le `<label htmlFor={name}>` cible cet `id`
 * → cliquer le label met le focus sur le champ (le bug V5.2 venait d'un `htmlFor`
 * posé sur le wrapper `<div>`). Suffixe rendu dans `.input-suffix`.
 */
export default function Field({
  label,
  name,
  children,
  required,
  hint,
  error,
  full,
  suffix,
  className,
}: FieldProps) {
  const hintId = hint ? `${name}-hint` : undefined
  const errId = error ? `${name}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined

  const child = Children.only(children)
  const enhanced = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        id: name,
        name,
        'aria-describedby': describedBy,
        'aria-invalid': error ? 'true' : undefined,
        'aria-required': required ? 'true' : undefined,
      })
    : child

  return (
    <div className={clsx(styles.field, full && styles.full, error && styles.hasErr, className)}>
      <label htmlFor={name}>
        {label}
        {required && (
          <span className={styles.req} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {suffix ? (
        <div className={styles.inputSuffix}>
          {enhanced}
          <span aria-hidden="true">{suffix}</span>
        </div>
      ) : (
        enhanced
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className={styles.err} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
