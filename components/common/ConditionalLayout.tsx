'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/common/Header'
import Footer from '@/components/common/Footer'
import SiteProtection from '@/components/common/SiteProtection'
import WhatsAppFloatingButton from '@/components/common/WhatsAppFloatingButton'

/**
 * Routes qui rendent leur propre shell (header/footer custom ou aucun) et
 * n'ont donc PAS besoin du Header/Footer publics.
 *
 * Toute route dont le pathname (locale strippée) commence par l'une de ces
 * entrées court-circuite l'injection du Header/Footer marketing.
 */
const DASHBOARD_PATH_PREFIXES = [
  // Dashboards Pro (artisan + BTP)
  '/pro/dashboard',
  '/pro/register',
  '/pro/mobile',
  '/pro/tarifs',
  // Dashboard client
  '/client/dashboard',
  // Dashboards Syndic
  '/syndic/dashboard',
  '/syndic/login',
  '/syndic/register',
  /**
   * Sandbox de validation visuelle du redesign syndic v54 (Phase 1).
   * Gated `notFound()` en production via app/syndic/dev/layout.tsx —
   * inclus ici pour que le rendu dev affiche le namespace `#syndic-dashboard-v54`
   * isolé, sans pollution par la nav marketing publique.
   */
  '/syndic/dev',
  /**
   * Route LIVE en production du dashboard v54 (/syndic/v54, flag SYNDIC_V54_LIVE).
   * Même traitement que les autres dashboards : son propre shell, donc PAS de
   * Header/Footer marketing public (sinon le footer « PARA PARTICULARES / LEGAL »
   * et le header public se superposent au dashboard).
   */
  '/syndic/v54',
  // Copropriétaire (dormant)
  '/coproprietaire/',
  // Admin
  '/admin/',
] as const

function isDashboardRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return DASHBOARD_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Pages auth et booking : ont leur propre header dédié, pas besoin du
 * Header/Footer publics.
 */
const AUTH_BOOKING_PATH_PREFIXES = [
  '/auth/',
  '/artisan/',
  '/reserver',
  '/confirmation',
  // SEO-specific landing (Porto emergency) — header custom
  '/en/emergency-home-repair-porto',
] as const

function isAuthOrBookingRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return AUTH_BOOKING_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Pages SEO où le bouton WhatsApp flottant doit apparaître (uniquement).
 * Tous les autres endroits (recherche, contact, CGU, etc.) sont exclus.
 */
const SEO_PATH_PREFIXES = [
  // FR
  '/ville/',
  '/services/',
  '/specialites',
  '/urgence',
  '/pres-de-chez-moi/',
  '/copropriete',
  '/simulateur-devis',
  // PT
  '/servicos/',
  '/perto-de-mim',
  '/especialidades',
  '/urgencia',
  '/condominio',
  '/como-funciona',
  '/torne-se-parceiro',
  '/simulador-orcamento',
] as const

function isSeoPage(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return SEO_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname === p.replace(/\/$/, ''),
  )
}

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const rawPathname = usePathname()
  // Strip locale prefix (/fr/ or /pt/ etc) for route matching
  // Fix: replace locale prefix with just / (not /$2 which produced // )
  const pathname = rawPathname?.replace(/^\/(fr|pt|en|nl|es)(\/|$)/, '/') || rawPathname

  const isHomepage = pathname === '/'

  if (isDashboardRoute(pathname) || isHomepage || isAuthOrBookingRoute(pathname)) {
    return <>{children}</>
  }

  const showWhatsApp = isSeoPage(pathname)

  return (
    <>
      <SiteProtection />
      <Header />
      {/* pt-[68px] = hauteur exacte du header (h-[68px]) */}
      <div className="pt-[68px]">{children}</div>
      <Footer />
      {showWhatsApp && <WhatsAppFloatingButton />}
    </>
  )
}
