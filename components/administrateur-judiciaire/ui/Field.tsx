import { Children, cloneElement, type ReactElement, type ReactNode } from 'react'

/** Ligne de formulaire (grille de champs). */
export function FieldRow({ children }: { children?: ReactNode }) {
  return <div className="field-row">{children}</div>
}

/** Props injectées par Field dans son contrôle unique (input, select, textarea…). */
export interface ProprietesControleChamp {
  id?: string
  name?: string
  'aria-required'?: 'true'
  'aria-invalid'?: 'true'
}

export interface FieldProps {
  label?: ReactNode
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  name?: string
  /** Occupe toute la largeur de la ligne (classe field-full). */
  full?: boolean
  /** Unité affichée à droite du contrôle (div.input-suffix). */
  suffix?: ReactNode
  /** Un seul élément (Children.only). */
  children: ReactElement<ProprietesControleChamp>
}

/**
 * Champ libellé. id = name, sinon id de l'enfant, sinon « f- » + libellé normalisé (minuscules, tout caractère
 * hors [a-z0-9] → « - » : les lettres accentuées deviennent des tirets). Deux champs de même libellé sans name
 * obtiennent donc le même id, comme dans la maquette.
 */
export function Field({ label, required, hint, error, name, full, suffix, children }: FieldProps) {
  const enfant = Children.only(children)
  const id =
    name ||
    enfant.props.id ||
    'f-' +
      String(label || 'field')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
  const controle = cloneElement(enfant, {
    id,
    name: name || id,
    'aria-required': required ? 'true' : undefined,
    'aria-invalid': error ? 'true' : undefined,
  })
  return (
    <div className={`field ${full ? 'field-full' : ''} ${error ? 'has-err' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && (
          <span className="field-req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {suffix ? (
        <div className="input-suffix">
          {controle}
          <span aria-hidden="true">{suffix}</span>
        </div>
      ) : (
        controle
      )}
      {hint && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-err" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
