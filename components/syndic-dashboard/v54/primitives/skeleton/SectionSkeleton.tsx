import type { CSSProperties } from 'react'
import Skeleton from './Skeleton'

export interface V54SectionSkeletonProps {
  /** Nombre de lignes de contenu sous le header (défaut 4). */
  rows?: number
  className?: string
  style?: CSSProperties
}

/**
 * Fallback Suspense générique des sections v54.
 *
 * Composite prêt-à-l'emploi pour les frontières Suspense des ~88 routes
 * (dynamic import `loading: () => <V54SectionSkeleton />`) : évite de
 * ré-assembler des atomes Skeleton à la main sur chaque page.
 *
 * Structure = une card (`.vfx-skeleton-card`) contenant un header (atome 40 %)
 * puis N lignes pleine largeur. Les sections au layout spécifique (Dashboard
 * KPIGrid…) pourront fournir leur propre skeleton ; ce générique couvre le reste.
 */
export default function V54SectionSkeleton({ rows = 4, className, style }: V54SectionSkeletonProps) {
  return (
    <Skeleton variant="card" className={className} style={style} data-testid="section-skeleton">
      <div style={{ display: 'grid', gap: 12 }}>
        <Skeleton width="40%" height={16} />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} width="100%" height={12} />
        ))}
      </div>
    </Skeleton>
  )
}
