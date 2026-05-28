import clsx from 'clsx'
import styles from './SegmentedControl.module.css'

export interface SegmentedOption<T extends string | number> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string | number> {
  /** `name` partagé du groupe de radios natifs. */
  name: string
  /** Valeur sélectionnée. */
  value: T
  /** Callback de sélection. */
  onChange: (value: T) => void
  /** Options (value + label). */
  options: ReadonlyArray<SegmentedOption<T>>
  /** Label accessible du groupe (role="radiogroup"). */
  ariaLabel: string
  className?: string
}

/**
 * Contrôle segmenté v54 — port byte-exact du `.plan-slot-radio` du bundle V5.7
 * (groupe de radios stylisés, ex durée 30 min / 1 h / 2 h du modal réglages).
 *
 * Conserve le radio natif visible (accent-color gold-500) dans chaque label :
 * navigation clavier (flèches), focus-within, groupement par `name` → a11y native
 * (pas de `<div onClick>`). État actif : navy-900 / gold-400.
 */
export default function SegmentedControl<T extends string | number>({
  name,
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={clsx(styles.radios, className)} role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => (
        <label
          key={String(opt.value)}
          className={clsx(styles.radio, value === opt.value && styles.active)}
        >
          <input
            type="radio"
            name={name}
            value={String(opt.value)}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  )
}
