import type { Metadata } from 'next'
import { dashboardFontsClassName } from '@/lib/fonts/dashboard-fonts'

// Pages internes du chemin public d'un cabinet client (vitfix.io/<identifiant>/signalement/<jeton>/ et
// /<identifiant>/confirmation-adresse/, servies par réécriture, next.config.ts) : jamais indexées (X-Robots-Tag posé en
// plus par le middleware et next.config.ts) ; polices des tableaux de bord, comme la page publique du QR code.
export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
}

export default function LayoutCheminCabinetQr({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={dashboardFontsClassName}>{children}</div>
}
