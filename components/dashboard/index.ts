// ── Dashboard Components ─────────────────────────────────────────
// Barrel exports for lazy-loaded dashboard sections.
// Import these with next/dynamic for code splitting.
//
// Usage:
//   import dynamic from 'next/dynamic'
//   import { DashboardSkeleton } from '@/components/dashboard'
//
//   const CalendarSection = dynamic(() => import('@/components/dashboard/CalendarSection'), {
//     loading: () => <DashboardSkeleton />,
//     ssr: false,
//   })
//
// As sections are extracted from the monolithic page.tsx,
// add their lazy-loaded exports here.

export { default as DashboardSkeleton } from './DashboardShell'
export { default as ComptabiliteSection } from './ComptabiliteSection'
export { default as ClientsSection } from './ClientsSection'
export { default as MateriauxSection } from './MateriauxSection'
export { default as RapportsSection } from './RapportsSection'
export { default as CanalProSection } from './CanalProSection'
