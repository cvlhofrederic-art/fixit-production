import type { Metadata } from 'next'
import { dashboardFontsClassName } from '@/lib/fonts/dashboard-fonts'

// Espace « Vitfix Signal » du super admin (/fr/vitfixsignal/, servi par réécriture, next.config.ts) : outil privé,
// jamais indexé (X-Robots-Tag en plus, posé par next.config.ts et le middleware) ; polices des tableaux de bord, comme
// le portail copropriétaire et la page publique du QR code.
export const metadata: Metadata = {
  title: 'Vitfix Signal',
  robots: { index: false, follow: false, noarchive: true },
}

export default function LayoutEspaceVitfixSignal({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={dashboardFontsClassName} lang="fr">{children}</div>
}
