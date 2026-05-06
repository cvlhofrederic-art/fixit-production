import { Outfit, Montserrat, Playfair_Display } from "next/font/google";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

// Playfair Display est utilisé exclusivement dans #syndic-dashboard (KPI numbers,
// modal titles, doc empty states — voir app/globals.css lignes 1380+). Chargé ici
// au lieu de app/layout.tsx pour ne pas alourdir les pages publiques (perf SEO 2026).
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

export default function SyndicDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${outfit.variable} ${montserrat.variable} ${playfair.variable}`}>
      {children}
    </div>
  )
}
