'use client'

import { LanguageProvider } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/config'
import type { ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
  locale: Locale
}

/**
 * Client-side providers wrapper.
 * Wraps children with LanguageProvider (and other future providers).
 */
export default function Providers({ children, locale }: ProvidersProps) {
  return (
    <LanguageProvider initialLocale={locale}>
      {children}
    </LanguageProvider>
  )
}
