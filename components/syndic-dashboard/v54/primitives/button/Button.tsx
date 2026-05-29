import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Button.module.css'

export type ButtonVariant = 'default' | 'gold' | 'primary' | 'danger' | 'ghost'
export type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Variante visuelle — port des classes `.btn.*` du bundle V5.7. */
  variant?: ButtonVariant
  /** Taille — `sm` = compact (port `.btn.sm`). */
  size?: ButtonSize
  children?: ReactNode
}

/**
 * Bouton v54 — port byte-exact des classes `.btn` / `.btn.gold` / `.btn.primary`
 * / `.btn.danger` / `.btn.ghost` / `.btn.sm` du bundle V5.7
 * (`.claude/v57-decoded.html` L808-829). Centralise le style bouton — dont
 * `.btn svg { 14px }`, le dimensionnement contextuel des icônes (l'`Icon` v54
 * n'a pas de taille propre) — pour éliminer la duplication inline par module.
 * `type="button"` forcé : aucun de ces boutons ne soumet de formulaire.
 */
export default function Button({ variant = 'default', size = 'md', className, children, ...rest }: Readonly<ButtonProps>) {
  return (
    <button
      type="button"
      className={clsx(styles.btn, variant !== 'default' && styles[variant], size === 'sm' && styles.sm, className)}
      {...rest}
    >
      {children}
    </button>
  )
}
