import { Outfit, Montserrat, Playfair_Display } from 'next/font/google'

// Fonts partagées par les dashboards privés (syndic + coproprietaire).
// Chargées uniquement sur ces routes — pas dans app/layout.tsx global —
// pour ne pas alourdir les pages publiques SEO (perf 2026).
//
// Playfair Display utilisé pour KPI numbers, modal titles, doc empty states
// dans #syndic-dashboard et inline dans #copro-dashboard (page.tsx).

export const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
})

export const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
})

export const dashboardFontsClassName = `${outfit.variable} ${montserrat.variable} ${playfair.variable}`
