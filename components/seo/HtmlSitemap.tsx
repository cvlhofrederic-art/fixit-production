import Link from 'next/link'

// Composant partagé pour les pages plan-du-site (FR) / mapa-do-site (PT).
// Centralise la logique d'affichage hiérarchique services × villes.
// Les deux pages locale-spécifiques en sont des wrappers fournissant
// uniquement la data et les labels traduits.

export interface SitemapServiceCombo {
  service: { slug: string; name: string }
  combos: { slug: string; city: { name: string } }[]
}

export interface SitemapBlogArticle {
  slug: string
  title: string
}

export interface SitemapCity {
  slug: string
  name: string
}

export interface SitemapMainLink {
  href: string
  label: string
}

export interface HtmlSitemapProps {
  readonly locale: 'fr' | 'pt'
  readonly title: string
  readonly intro: string
  readonly breadcrumbHomeLabel: string
  readonly breadcrumbCurrentLabel: string
  readonly mainPagesTitle: string
  readonly mainPages: SitemapMainLink[]
  readonly servicesByCityTitle: string
  readonly servicesByCityCountSuffix: string // " villes" ou " cidades"
  readonly servicesByCity: SitemapServiceCombo[]
  readonly servicesByCityComboPrefix: string // "à" ou "em"
  readonly servicesByCityRoot: string // "/fr/services" ou "/pt/servicos"
  readonly servicesByCityNearMeRoot: string // "/fr/pres-de-chez-moi" ou "/pt/perto-de-mim"
  readonly defaultOpenServiceSlug: string
  readonly citiesTitle: string
  readonly cities: SitemapCity[]
  readonly cityRoot: string // "/fr/ville" ou "/pt/cidade"
  readonly blogTitle: string
  readonly blogArticles: SitemapBlogArticle[]
  readonly blogRoot: string // "/fr/blog" ou "/pt/blog"
  readonly xmlSitemapNote: string
  readonly homeHref: string
}

export default function HtmlSitemap(props: HtmlSitemapProps) {
  const totalCombos = props.servicesByCity.reduce((sum, g) => sum + g.combos.length, 0)

  return (
    <div className="min-h-screen bg-warm-gray py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
          <Link href={props.homeHref} className="hover:text-yellow transition">{props.breadcrumbHomeLabel}</Link>
          <span className="mx-2">/</span>
          <span className="text-dark font-medium">{props.breadcrumbCurrentLabel}</span>
        </nav>

        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-dark mb-3">
          {props.title}
        </h1>
        <p className="text-text-muted mb-10 max-w-2xl">{props.intro}</p>

        {/* Pages principales */}
        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="font-display text-xl font-bold text-dark mb-5">{props.mainPagesTitle}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {props.mainPages.map(p => (
              <li key={p.href}>
                <Link href={p.href} className="text-dark/80 hover:text-yellow hover:underline">{p.label}</Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Services × villes */}
        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="font-display text-xl font-bold text-dark mb-2">{props.servicesByCityTitle}</h2>
          <p className="text-text-muted text-sm mb-6">
            {totalCombos} {props.servicesByCityCountSuffix.replace(/^ /, '× ')}.
          </p>
          <div className="space-y-6">
            {props.servicesByCity.map(({ service, combos }) => (
              <details
                key={service.slug}
                className="group rounded-xl border border-border/40 overflow-hidden"
                open={service.slug === props.defaultOpenServiceSlug}
              >
                <summary className="flex items-center justify-between gap-4 px-5 py-3 cursor-pointer list-none bg-warm-gray/40 font-semibold text-dark hover:bg-warm-gray transition select-none">
                  <span className="flex items-center gap-3">
                    <Link href={`${props.servicesByCityNearMeRoot}/${service.slug}/`} className="hover:text-yellow hover:underline">
                      {service.name}
                    </Link>
                    <span className="text-xs text-text-muted">({combos.length}{props.servicesByCityCountSuffix})</span>
                  </span>
                  <span className="text-yellow text-sm group-open:rotate-45 transition-transform">+</span>
                </summary>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-5 text-sm">
                  {combos.map(c => (
                    <li key={c.slug}>
                      <Link href={`${props.servicesByCityRoot}/${c.slug}/`} className="text-dark/80 hover:text-yellow hover:underline">
                        {service.name} {props.servicesByCityComboPrefix} {c.city.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>

        {/* Villes */}
        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="font-display text-xl font-bold text-dark mb-5">{props.citiesTitle}</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
            {props.cities.map(city => (
              <li key={city.slug}>
                <Link href={`${props.cityRoot}/${city.slug}/`} className="text-dark/80 hover:text-yellow hover:underline">
                  {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Blog */}
        {props.blogArticles.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
            <h2 className="font-display text-xl font-bold text-dark mb-5">{props.blogTitle}</h2>
            <ul className="space-y-2 text-sm">
              {props.blogArticles.map(a => (
                <li key={a.slug}>
                  <Link href={`${props.blogRoot}/${a.slug}/`} className="text-dark/80 hover:text-yellow hover:underline">
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-xs text-text-muted mt-10">
          {props.xmlSitemapNote} <a href="/sitemap.xml" className="hover:text-dark underline">/sitemap.xml</a>
        </p>
      </div>
    </div>
  )
}
