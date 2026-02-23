'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SiteProtection from '@/components/SiteProtection'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isDashboard = pathname?.startsWith('/pro/dashboard') || pathname?.startsWith('/client/dashboard') || pathname?.startsWith('/pro/mobile')

  if (isDashboard) {
    return <>{children}</>
  }

  return (
    <>
      <SiteProtection />
      <Header />
      {children}
      <Footer />
    </>
  )
}
