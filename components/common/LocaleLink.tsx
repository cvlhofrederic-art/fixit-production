'use client'

import Link, { type LinkProps } from 'next/link'
import { useLocale } from '@/lib/i18n/context'
import { getLocaleFromPathname, type Locale } from '@/lib/i18n/config'
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

  // Lien vers une autre langue que celle de la page : simple <a>, chargement d'un nouveau document, comme tout
  // changement de section (validé le 30/10). Avec next/link, la navigation restait douce entre deux pages de
  // app/(commun) (même layout racine) et gardait la langue du premier document (LanguageProvider, <html lang>) ; entre
  // deux dossiers de langue, Next rechargeait de toute façon, après une requête RSC jetée. Le middleware pose le cookie
  // de langue sur ce document (poserCookieLangue, middleware.ts).
  const langueCible = getLocaleFromPathname(localizedHref)
  if (langueCible !== null && langueCible !== currentLocale) {
    // Props propres à next/link, sans attribut d'ancre équivalent.
    const {
      as: _as, replace: _replace, scroll: _scroll, shallow: _shallow, passHref: _passHref, prefetch: _prefetch,
      legacyBehavior: _legacyBehavior, onNavigate: _onNavigate, transitionTypes: _transitionTypes, ...ancre
    } = props
    return (
      <a href={avecBarreFinale(localizedHref)} {...ancre}>
        {children}
      </a>
    )
  }

  return (
    <Link href={localizedHref} {...props}>
      {children}
    </Link>
  )
}

/**
 * trailingSlash: true (next.config.ts) : même normalisation que next/link (next/dist/client/normalize-trailing-slash) :
 * barre finale avant ? et #, sauf sur un chemin de fichier (/pt/sitemap.xml), dont elle est retirée.
 */
function avecBarreFinale(href: string): string {
  const coupure = href.search(/[?#]/)
  const chemin = coupure === -1 ? href : href.slice(0, coupure)
  const suite = href.slice(chemin.length)
  if (/\.[^/]+\/?$/.test(chemin)) return `${chemin.replace(/\/$/, '') || '/'}${suite}`
  return chemin.endsWith('/') ? href : `${chemin}/${suite}`
}
