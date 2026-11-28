import type { Metadata } from 'next'
import { dashboardFontsClassName } from '@/lib/fonts/dashboard-fonts'

// Page publique « AJ Signalement », ouverte par le QR code d'une copropriété (/fr/signalement/<jeton>/) :
// jamais indexée (le jeton est l'adresse du formulaire), polices du tableau de bord comme le portail copropriétaire.
export const metadata: Metadata = {
  title: 'AJ Signalement — Signaler un problème',
  robots: { index: false, follow: false, noarchive: true },
}

export default function LayoutSignalementQr({ children }: { children: React.ReactNode }) {
  return <div className={dashboardFontsClassName}>{children}</div>
}
