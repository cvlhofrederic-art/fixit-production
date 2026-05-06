import { vi } from 'vitest'
import type { ReactNode } from 'react'

/**
 * Tiny helpers used by tests/components/*.test.tsx.
 *
 * These wrap vi.mock() with the configurations we apply in 90% of cases
 * so we don't repeat boilerplate. Always call them BEFORE the dynamic
 * import of the component under test.
 */

export function mockI18n(locale: 'fr' | 'pt' | 'en' = 'fr') {
  vi.mock('@/lib/i18n/context', () => ({
    useLocale: () => locale,
    useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
    LanguageProvider: ({ children }: { children: ReactNode }) => children,
  }))
}

export function mockNextNavigation() {
  vi.mock('next/navigation', () => ({
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      refresh: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
  }))
}

export function mockSonner() {
  vi.mock('sonner', () => ({
    toast: Object.assign(vi.fn(), {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  }))
}
