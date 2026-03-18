'use client'

import Link, { type LinkProps } from 'next/link'
import { useLocale } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/config'
import type { ReactNode, AnchorHTMLAttributes } from 'react'

type LocaleLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
  LinkProps & {
    children: ReactNode
    locale?: Locale
  }

/**
 * Locale-aware Link component.
 * Automatically prepends the current locale to internal paths.
 *   <LocaleLink href="/recherche"> → /fr/recherche (or /pt/recherche)
 * External URLs and hash links are passed through unchanged.
 */
export default function LocaleLink({ href, locale: explicitLocale, children, ...props }: LocaleLinkProps) {
  const currentLocale = useLocale()
  const locale = explicitLocale || currentLocale

  let localizedHref: string = typeof href === 'string' ? href : href.pathname || '/'

  // Only add locale prefix to internal absolute paths
  if (typeof localizedHref === 'string' && localizedHref.startsWith('/')) {
    // Don't prefix API routes or _next paths
    if (!localizedHref.startsWith('/api/') && !localizedHref.startsWith('/_next/')) {
      // Don't double-prefix
      if (!localizedHref.startsWith('/fr/') && !localizedHref.startsWith('/pt/') && !localizedHref.startsWith('/en/') && !localizedHref.startsWith('/nl/') && !localizedHref.startsWith('/es/') && localizedHref !== '/fr' && localizedHref !== '/pt' && localizedHref !== '/en' && localizedHref !== '/nl' && localizedHref !== '/es') {
        localizedHref = `/${locale}${localizedHref}`
      }
    }
  }

  return (
    <Link href={localizedHref} {...props}>
      {children}
    </Link>
  )
}
