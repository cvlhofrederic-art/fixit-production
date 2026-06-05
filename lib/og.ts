// Images Open Graph dynamiques — helper pour les métadonnées des pages.
// Construit l'URL absolue de l'image générée par app/api/og/route.tsx, avec le
// titre / sous-titre / langue propres à chaque page (méthode pro, cf. audit SEO-08).
// Le trailing slash sur /api/og/ évite le 308 de redirection (trailingSlash activé).

type OgOpts = {
  title?: string
  subtitle?: string
  eyebrow?: string
  locale: string
}

export function ogImageUrl(opts: OgOpts): string {
  const p = new URLSearchParams()
  if (opts.title) p.set('title', opts.title)
  if (opts.subtitle) p.set('subtitle', opts.subtitle)
  if (opts.eyebrow) p.set('eyebrow', opts.eyebrow)
  p.set('locale', opts.locale)
  return `https://vitfix.io/api/og/?${p.toString()}`
}

export function ogImageMeta(opts: OgOpts) {
  return [{ url: ogImageUrl(opts), width: 1200, height: 630 }]
}
