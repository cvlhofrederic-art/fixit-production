'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useLienPanneauAdmin } from '@/lib/auth/panneau-admin'

interface LienPanneauAdminProps {
  /** Classe de l'élément de navigation du tableau de bord hôte (le lien en reprend l'apparence). */
  className?: string
  style?: CSSProperties
  /** Contenu du lien (icône + libellé) ; par défaut « Panneau admin ». */
  children?: ReactNode
}

/**
 * Lien discret vers le panneau d'administration, rendu SEULEMENT pour un super_admin ou une session
 * « vue en tant que » ouverte par un super_admin (cf. lienPanneauAdmin) ; rien pour les autres comptes.
 * Lien simple (pas de bouton) : la sortie du mode « vue en tant que » est faite par /admin/exit.
 */
export default function LienPanneauAdmin({ className, style, children }: Readonly<LienPanneauAdminProps>) {
  const href = useLienPanneauAdmin()
  if (!href) return null
  return (
    <a href={href} className={className} style={style} data-testid="lien-panneau-admin">
      {children ?? 'Panneau admin'}
    </a>
  )
}
