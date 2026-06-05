/**
 * next/font/local setup for the syndic v54 namespace.
 *
 * 3 variable fonts (Manrope sans, Cormorant Garamond serif, JetBrains Mono),
 * self-hosted in public/fonts/syndic-v54/ (extracted from the V5.7 mockup
 * bundle via scripts/extract-v57-fonts.mjs).
 *
 * Each font exposes a CSS custom property (variable: '--font-*') consumed by
 * components/syndic-dashboard/v54/tokens/fonts.css. That indirection keeps
 * the v54 namespace strictly self-contained — no global font side effects.
 */
import localFont from 'next/font/local'

export const v54Manrope = localFont({
  src: '../../../../public/fonts/syndic-v54/manrope.woff2',
  weight: '200 800',
  style: 'normal',
  variable: '--font-manrope',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
})

export const v54Cormorant = localFont({
  src: [
    {
      path: '../../../../public/fonts/syndic-v54/cormorant-garamond.woff2',
      weight: '300 700',
      style: 'normal',
    },
    {
      path: '../../../../public/fonts/syndic-v54/cormorant-garamond-italic.woff2',
      weight: '300 700',
      style: 'italic',
    },
  ],
  variable: '--font-cormorant',
  display: 'swap',
  preload: true,
  fallback: ['Times New Roman', 'Georgia', 'serif'],
})

export const v54JetBrainsMono = localFont({
  src: '../../../../public/fonts/syndic-v54/jetbrains-mono.woff2',
  weight: '100 800',
  style: 'normal',
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: false,
  fallback: ['Courier New', 'ui-monospace', 'SFMono-Regular', 'monospace'],
})

/** Concatenated className for the three variable bindings — apply on the
 *  `<div id="syndic-dashboard-v54">` root so the CSS variables defined in
 *  fonts.css (--v54-font-*) can resolve. */
export const v54FontVariables = `${v54Manrope.variable} ${v54Cormorant.variable} ${v54JetBrainsMono.variable}`
