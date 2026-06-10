'use client'

import { useState, type CSSProperties, type FocusEvent } from 'react'

/**
 * Input contrôlé qui tolère la saisie en cours d'une virgule décimale FR.
 * Partagé par les formulaires devis/facture artisan (V2) et BTP (V3) — audit
 * 2026-06-10. Présentationnel pur (aucune logique métier) → mutualisation sans
 * impact RÈGLE #1 (artisan vs BTP).
 *
 * Problème résolu : un input contrôlé `value={fmt(parse(typed))}` reformate à
 * chaque frappe et supprime la virgule trailing au moment où l'utilisateur la
 * tape ("90," → parse=90 → fmt="90" → virgule perdue) → « je n'arrive plus à
 * écrire la virgule ». Solution : tant que l'input a le focus, on garde la
 * saisie BRUTE dans un état local (raw) ; on parse en parallèle pour la
 * réactivité (totaux, TVA…) sans réécrire le champ. Au blur, le buffer est
 * libéré et le champ reprend le rendu formaté.
 *
 * Compat clavier FR : type="text" + inputMode="decimal" (numpad mobile + virgule).
 * select() au focus : sélectionne le contenu pour taper par-dessus sans effacer
 * (comportement harmonisé sur les deux formulaires — autorisé par Frédéric).
 */
export function DecimalInput(props: {
  value: number
  onChangeNumber: (n: number) => void
  format: (n: number) => string
  parse: (s: string) => number
  placeholder?: string
  style?: CSSProperties
  title?: string
  disabled?: boolean
  className?: string
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void
}) {
  const { value, onChangeNumber, format, parse, onFocus, onBlur, ...rest } = props
  const [raw, setRaw] = useState<string | null>(null)
  return (
    <input
      type="text"
      inputMode="decimal"
      {...rest}
      value={raw ?? format(value)}
      onFocus={(e) => { setRaw(format(value)); e.target.select(); onFocus?.(e) }}
      onChange={(e) => {
        setRaw(e.target.value)
        onChangeNumber(parse(e.target.value))
      }}
      onBlur={(e) => { setRaw(null); onBlur?.(e) }}
    />
  )
}
