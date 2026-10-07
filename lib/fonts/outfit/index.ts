import localFont from 'next/font/local'
import './fallback.css'

/**
 * Outfit auto-hébergée (next/font/local) à la place de next/font/google.
 *
 * Google Fonts répond par intermittence avec des URL `fonts.gstatic.com/l/font?kit=…&skey=…&v=v15`
 * au lieu de `/s/outfit/v15/….woff2`. Turbopack découpe alors sa requête interne sur les `&` et la
 * build échoue (« next/font/google queries have exactly one entry ») : issue amont
 * vercel/next.js#99114, sans correctif au 2026-10-07 (ni 16.4.0 ni 16.5.0-canary.2).
 *
 * Rendu inchangé : fichiers identiques octet pour octet à ceux que next/font/google téléchargeait
 * (Outfit v15, sous-ensembles latin et latin-ext), mêmes graisses 300 à 600, mêmes unicode-range,
 * même préchargement (latin seul) et même police de repli (fallback.css).
 *
 * Turbopack nomme la famille d'après la constante : `Outfit` donne 'Outfit', nom écrit en dur dans
 * app/globals.css et dans des styles en ligne.
 */

// Sous-ensemble latin-ext : n'existe que pour ses règles @font-face (famille 'Outfit' imposée),
// téléchargé seulement si la page contient un caractère de sa plage. Déclaré avant latin comme dans
// le CSS de Google : sur les points de code communs (ı, Œ, œ, †, U+0304, U+0308, U+0329), la dernière
// règle déclarée l'emporte, donc le fichier latin.
const _OutfitLatinExt = localFont({
  src: [
    { path: './outfit-latin-ext.woff2', weight: '300', style: 'normal' },
    { path: './outfit-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: './outfit-latin-ext.woff2', weight: '500', style: 'normal' },
    { path: './outfit-latin-ext.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [
    { prop: 'font-family', value: "'Outfit'" },
    {
      prop: 'unicode-range',
      value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
    },
  ],
  preload: false,
  adjustFontFallback: false,
})

// Ne pas renommer : le nom de la constante donne le nom de famille 'Outfit' de la règle @font-face et
// de la valeur de --font-outfit ; une déclaration font-family ne fixerait que la règle @font-face.
const Outfit = localFont({
  src: [
    { path: './outfit-latin.woff2', weight: '300', style: 'normal' },
    { path: './outfit-latin.woff2', weight: '400', style: 'normal' },
    { path: './outfit-latin.woff2', weight: '500', style: 'normal' },
    { path: './outfit-latin.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [
    {
      prop: 'unicode-range',
      value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
  adjustFontFallback: false,
  fallback: ["'Outfit Fallback'"],
  variable: '--font-outfit',
})

export { Outfit as outfit }
