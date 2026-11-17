import type { Metadata } from 'next'
import '@/app/polices.css'
import '@/app/globals.css'
import { dashboardFontsClassName } from '@/lib/fonts/dashboard-fonts'

// Mise en page racine des pages publiques servies SANS la coquille de VitFix (AJ Signalement, PR 3, lot 6 ; cahier
// § 7.5, décision F3) : aujourd'hui la seule page de désinscription des messages de diffusion d'un cabinet client
// (vitfix.io/<identifiant>/desinscription/, réécrite vers /cabinet/<identifiant>/desinscription/). Exigence, et non
// option : ni en-tête ni pied publics, ni bandeau de consentement, ni mesure d'audience (GA4, balise Cloudflare), ni
// données structurées VitFix. VitFix n'est pas l'auteur des messages (droit § 4.1), et aucun script tiers ne doit pouvoir
// lire le jeton du fragment avant que la page l'efface. Polices et styles du site seulement (fichiers du site, aucune
// ressource tierce). Langue : « fr » ici, puis celle de la diffusion, posée par la page dès qu'elle la connaît.
// Le passage d'une mise en page racine à l'autre recharge la page entière : sans effet ici (arrivée depuis un e-mail).

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
}

export default function LayoutSansCoquille({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`police-dm-sans font-sans antialiased bg-[#F7F4EE] ${dashboardFontsClassName}`}>{children}</body>
    </html>
  )
}
