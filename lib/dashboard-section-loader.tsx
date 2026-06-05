'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { SectionErrorBoundary } from '@/components/common/SectionErrorBoundary'

interface CreateDynamicSectionOptions {
  // Hex color (with #) for the loading spinner border. Defaults to the
  // navy/gold dashboard palette. Override for dashboards using other accents
  // (e.g. client/particulier uses the legacy yellow #FFC107).
  spinnerColor?: string
}

// Shared loader for lazy dashboard sections.
//
// Returns a component that:
//   1. Lazily imports the section via next/dynamic with ssr:false
//   2. Renders a centered spinner while loading
//   3. Wraps the section in SectionErrorBoundary so a single section crash
//      (chunk loading failure on edge, runtime exception, ...) shows an
//      in-place fallback with retry instead of destroying the dashboard
//      shell via app/error.tsx
//
// Boundary locale is read from useLocale() at render time so the fallback
// strings stay aligned with the active language (fr/pt/en).
//
// Used by app/syndic/dashboard, app/client/dashboard, app/coproprietaire/dashboard.
// The artisan/BTP dashboard at app/pro/dashboard uses inline <SectionErrorBoundary>
// wrappings at each render site (different pattern, not a helper).
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDynamicSection(loader: () => Promise<any>, options: CreateDynamicSectionOptions = {}): ComponentType<Record<string, unknown>> {
  const spinnerColor = options.spinnerColor ?? '#C9A84C'
  const DynamicComponent = dynamic(loader, {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: spinnerColor, borderTopColor: 'transparent' }}
        />
      </div>
    ),
  })
  const WrappedSection = (props: Record<string, unknown>) => {
    const locale = useLocale()
    const boundaryLocale: 'fr' | 'pt' | 'en' =
      locale === 'pt' || locale === 'en' ? locale : 'fr'
    const fallbackTitle =
      locale === 'pt'
        ? 'Erro nesta secção'
        : locale === 'en'
          ? 'Error in this section'
          : 'Erreur dans cette section'
    return (
      <SectionErrorBoundary locale={boundaryLocale} fallbackTitle={fallbackTitle}>
        <DynamicComponent {...props} />
      </SectionErrorBoundary>
    )
  }
  WrappedSection.displayName = 'DynamicSection'
  return WrappedSection
}
