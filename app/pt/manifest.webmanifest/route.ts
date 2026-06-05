// Web App Manifest dédié au marché PT.
// Différent du `public/manifest.json` (FR par défaut) car :
// - `lang: 'pt-PT'` : code régional pour cibler explicitement Portugal (vs Brésil)
// - `scope: '/pt/'` : la PWA installée depuis une page PT reste dans le contexte PT
// - `start_url: '/pt/'` : ouverture de la PWA → home PT (pas FR)
// - `name` / `description` en portugais européen (canalizador, telemóvel, etc.)
//
// Référencé dans `app/pt/layout.tsx` via `metadata.manifest = '/pt/manifest.webmanifest'`.
// Source : developers.google.com/web/manifest + MDN Web App Manifest scope.

export const runtime = 'nodejs'

const PT_MANIFEST = {
  name: 'VITFIX — Profissionais BTP em Portugal',
  short_name: 'VITFIX',
  description:
    'Encontre profissionais verificados em Marco de Canaveses, Penafiel, Amarante, Porto e região do Tâmega e Sousa. Canalizador, eletricista, pintor.',
  start_url: '/pt/',
  scope: '/pt/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#FFD600',
  orientation: 'portrait-primary',
  icons: [
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable',
    },
    {
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
  categories: ['business', 'lifestyle', 'utilities'],
  lang: 'pt-PT',
  dir: 'ltr',
}

export async function GET() {
  return new Response(JSON.stringify(PT_MANIFEST), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
