import type { SVGProps } from 'react'
import { ICON_PATHS } from './registry'
import type { IconName } from '@/lib/syndic/icon-names'

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Nom typé strict — voir lib/syndic/icon-names.ts (généré depuis registry.tsx). */
  name: IconName
}

/**
 * Icône SVG du design system syndic v54 — port pixel-perfect du composant
 * Icon du bundle V5.7.
 *
 * Contrat NON-NÉGOCIABLE (extrait du bundle, tout écart casse le rendu des
 * ~200 sites d'usage) :
 *   - viewBox 0 0 24 24
 *   - fill none
 *   - stroke currentColor (l'icône hérite de la couleur du texte parent)
 *   - strokeWidth 1.8 (défaut ; un consommateur peut override via props)
 *   - strokeLinecap / strokeLinejoin round
 *   - fallback paths.doc si name absent (défense runtime même si IconName
 *     empêche la faute au compile)
 *
 * DIMENSIONNEMENT : 100 % CSS externe (pas de prop `size`). Comme le bundle,
 * le <svg> est dimensionné par le parent via des sélecteurs contextuels
 * (ex `.nav-item svg { width:16px }`, `.btn svg { width:14px }`). Les props
 * SVG (style, className, width, height) sont spreadées et peuvent override.
 */
export default function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    >
      {ICON_PATHS[name] ?? ICON_PATHS.doc}
    </svg>
  )
}
