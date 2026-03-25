'use client'

import { LanguageProvider } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/config'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'

interface ProvidersProps {
  children: ReactNode
  locale: Locale
}

export default function Providers({ children, locale }: ProvidersProps) {
  return (
    <LanguageProvider initialLocale={locale}>
      {children}
      <Toaster position="top-right" richColors closeButton duration={5000} />
    </LanguageProvider>
  )
}
