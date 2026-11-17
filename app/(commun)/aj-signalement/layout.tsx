import type { Metadata } from 'next'
import { dashboardFontsClassName } from '@/lib/fonts/dashboard-fonts'

// Espace « AJ Signalement » du super admin (/fr/aj-signalement/, servi par réécriture, next.config.ts) : outil privé,
// jamais indexé (X-Robots-Tag en plus, posé par next.config.ts et le middleware) ; polices des tableaux de bord, comme
// le portail copropriétaire et la page publique du QR code.
export const metadata: Metadata = {
  title: 'AJ Signalement',
  robots: { index: false, follow: false, noarchive: true },
}

export default function LayoutEspaceAjSignalement({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={dashboardFontsClassName} lang="fr">{children}</div>
}
