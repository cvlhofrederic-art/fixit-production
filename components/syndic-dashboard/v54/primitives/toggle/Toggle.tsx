import type { ChangeEventHandler } from 'react'
import clsx from 'clsx'
import styles from './Toggle.module.css'

export interface ToggleProps {
  /** État activé. */
  on: boolean
  /** Callback de bascule (reçoit le change event du checkbox natif). */
  onToggle: ChangeEventHandler<HTMLInputElement>
  /** Désactive le toggle (apparence atténuée + non-interactif). */
  disabled?: boolean
  /** Label accessible du contrôle. */
  'aria-label'?: string
  className?: string
}

/**
 * Interrupteur v54 — port du `.toggle` du bundle V5.7 (track 38×22, thumb 18×18,
 * navy-100 → sage-500 à l'état on, translateX 16px).
 *
 * Le bundle est un `<div onClick>` (mockup, pas d'a11y). On l'upgrade en
 * `<label>` + `<input type="checkbox">` natif caché : clavier (espace), focus
 * visible, lecteurs d'écran. Le visuel (track/thumb) reste byte-exact du bundle.
 */
export default function Toggle({ on, onToggle, disabled, className, 'aria-label': ariaLabel }: ToggleProps) {
  return (
    <label className={clsx(styles.toggle, on && styles.on, disabled && styles.disabled, className)}>
      <input
        type="checkbox"
        className={styles.input}
        checked={on}
        disabled={disabled}
        onChange={onToggle}
        aria-label={ariaLabel}
      />
    </label>
  )
}
