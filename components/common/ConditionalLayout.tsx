'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/common/Header'
import Footer from '@/components/common/Footer'
import SiteProtection from '@/components/common/SiteProtection'
import WhatsAppFloatingButton from '@/components/common/WhatsAppFloatingButton'

// Pages SEO où le bouton WhatsApp flottant doit apparaître (uniquement)
// Tous les autres endroits (recherche, contact, CGU, etc.) sont exclus
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
]

function isSeoPage(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return SEO_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname === p.replace(/\/$/, ''))
}

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const rawPathname = usePathname()
  // Strip locale prefix (/fr/ or /pt/) for route matching
  // Fix: replace /fr/ or /pt/ prefix with just / (not /$2 which produced // )
  const pathname = rawPathname?.replace(/^\/(fr|pt|en|nl|es)(\/|$)/, '/') || rawPathname
  const isDashboard = pathname?.startsWith('/pro/dashboard') || pathname?.startsWith('/pro/register') || pathname?.startsWith('/pro/mobile') || pathname?.startsWith('/pro/tarifs') || pathname?.startsWith('/client/dashboard') || pathname?.startsWith('/syndic/dashboard') || pathname?.startsWith('/syndic/login') || pathname?.startsWith('/syndic/register') || pathname?.startsWith('/coproprietaire/') || pathname?.startsWith('/admin/')
  const isHomepage = pathname === '/'
  // Pages auth et booking : ont leur propre header, pas besoin du global
  const isAuthOrBooking = pathname?.startsWith('/auth/') || pathname?.startsWith('/artisan/') || pathname?.startsWith('/reserver') || pathname?.startsWith('/confirmation') || pathname?.startsWith('/en/emergency-home-repair-porto')

  if (isDashboard || isHomepage || isAuthOrBooking) {
    return <>{children}</>
  }

  const showWhatsApp = isSeoPage(pathname)

  return (
    <>
      <SiteProtection />
      <Header />
      {/* pt-[68px] = hauteur exacte du header (h-[68px]) */}
      <div className="pt-[68px]">
        {children}
      </div>
      <Footer />
      {showWhatsApp && <WhatsAppFloatingButton />}
    </>
  )
}
