'use client'

// ── Dashboard Skeleton / Loading Shell ────────────────────────────
// Displayed while lazy-loaded dashboard sections are being fetched.
// Used as the `loading` fallback for next/dynamic imports.

const DashboardSkeleton = () => (
  <div className="animate-pulse space-y-4 p-6" role="status" aria-label="Chargement">
    <div className="h-8 bg-gray-200 rounded w-1/3" />
    <div className="h-4 bg-gray-200 rounded w-2/3" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-32 bg-gray-200 rounded-xl" />
      ))}
    </div>
    <div className="h-64 bg-gray-200 rounded-xl mt-4" />
    <span className="sr-only">Chargement en cours...</span>
  </div>
)

export default DashboardSkeleton
