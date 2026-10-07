import { Montserrat, Playfair_Display } from 'next/font/google'
import { outfit } from './outfit'

// Fonts partagées par les dashboards privés (syndic + coproprietaire).
// Chargées uniquement sur ces routes — pas dans app/layout.tsx global —
// pour ne pas alourdir les pages publiques SEO (perf 2026).
//
// Playfair Display utilisé pour KPI numbers, modal titles, doc empty states
// dans #syndic-dashboard et inline dans #copro-dashboard (page.tsx).
// Outfit vient de lib/fonts/outfit (auto-hébergée, partagée avec app/layout.tsx).

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
