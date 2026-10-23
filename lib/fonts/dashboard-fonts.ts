import './polices-tableaux-de-bord.css'

// Fonts partagées par les dashboards privés (syndic + coproprietaire).
// Chargées uniquement sur ces routes — pas dans app/layout.tsx global —
// pour ne pas alourdir les pages publiques SEO (perf 2026).
//
// Playfair Display utilisé pour KPI numbers, modal titles, doc empty states
// dans #syndic-dashboard et inline dans #copro-dashboard (page.tsx).
//
// Polices auto-hébergées : Playfair Display dans polices-tableaux-de-bord.css, Outfit et
// Montserrat dans app/polices.css (layout racine). Fichiers dans public/fonts/web.

export const dashboardFontsClassName = 'police-outfit police-montserrat police-playfair'
