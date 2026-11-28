'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useSessionNavigateur } from '@/lib/auth/panneau-admin'
import { lienEspaceQr } from '@/lib/vitfixsignal/acces-espace'

interface LienVitfixSignalProps {
  /** Classe de l'élément de navigation du tableau de bord hôte (le lien en reprend l'apparence). */
  className?: string
  style?: CSSProperties
  /** Contenu du lien (icône + libellé) ; par défaut « Vitfix Signal ». */
  children?: ReactNode
}

/**
 * Lien vers l'espace indépendant « Vitfix Signal » (/fr/vitfixsignal/), rendu SEULEMENT pour un compte qui y a accès
 * (aujourd'hui le super admin, pas sa « vue en tant que », refusée par l'espace : lienEspaceQr, app_metadata seulement) ; rien tant
 * que la session n'est pas lue, rien pour les autres comptes. Aucune donnée chargée : l'espace et ses routes
 * revérifient l'accès.
 */
export default function LienVitfixSignal({ className, style, children }: Readonly<LienVitfixSignalProps>) {
  const session = useSessionNavigateur()
  const href = lienEspaceQr(session?.user?.app_metadata)
  if (!href) return null
  return (
    <a href={href} className={className} style={style} data-testid="lien-vitfixsignal">
      {children ?? 'Vitfix Signal'}
    </a>
  )
}
