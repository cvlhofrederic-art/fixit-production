'use client'

import type { ReactNode } from 'react'
import { SectionErrorBoundary } from '@/components/common/SectionErrorBoundary'

/**
 * Filet d'erreur posé pour la société BTP seulement, sur les écrans de la page partagée avec l'artisan
 * (app/(commun)/pro/dashboard/page.tsx) : ses écrans propres, que les autres rôles peuvent aussi ouvrir par leur
 * adresse, comme ceux qu'elle partage avec l'artisan. Une panne de l'écran reste dans sa zone au lieu de remplacer tout
 * le tableau de bord. Pour les autres rôles, l'écran est rendu tel quel, sans filet (comportement inchangé, règle n° 1
 * artisan / BTP). Aucun élément ajouté hors panne.
 */
export function FiletSocieteBtp({ actif, titre, locale, children }: {
  actif: boolean
  titre: string
  locale: 'fr' | 'pt'
  children: ReactNode
}) {
  if (!actif) return <>{children}</>
  return <SectionErrorBoundary fallbackTitle={titre} locale={locale}>{children}</SectionErrorBoundary>
}
