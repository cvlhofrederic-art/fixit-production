import { FR_SERVICES, FR_CITIES, getAllFrPageCombos } from '@/lib/data/fr-seo-pages-data'
import { FR_BLOG_ARTICLES } from '@/lib/data/fr-blog-data'
import HtmlSitemap, { buildSitemapMetadata, buildSitemapBreadcrumbSchema } from '@/components/seo/HtmlSitemap'

export const metadata = buildSitemapMetadata({
  locale: 'fr',
  url: 'https://vitfix.io/fr/plan-du-site/',
  altUrl: 'https://vitfix.io/pt/mapa-do-site/',
  title: 'Plan du site VITFIX : Toutes nos pages services et villes',
  description: 'Plan du site complet VITFIX : services artisans, villes desservies en PACA, articles de blog, ressources. Navigation rapide vers toutes nos pages.',
  ogTitle: 'Plan du site VITFIX',
  ogDescription: 'Toutes nos pages services et villes en PACA.',
})

const breadcrumbSchema = buildSitemapBreadcrumbSchema(
  'https://vitfix.io/fr/plan-du-site/',
  'Plan du site',
  'https://vitfix.io/fr/',
)

export default function PlanDuSitePage() {
  const combos = getAllFrPageCombos()
  const servicesByCity = FR_SERVICES
    .map(service => ({
      service: { slug: service.slug, name: service.name },
      combos: combos
        .filter(c => c.service.slug === service.slug)
        .map(c => ({ slug: c.slug, city: { name: c.city.name } })),
    }))
    .filter(g => g.combos.length > 0)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <HtmlSitemap
        locale="fr"
        title="Plan du site"
        intro="Toutes les pages VITFIX en France : services artisans, villes desservies, ressources et articles."
        breadcrumbHomeLabel="VITFIX"
        breadcrumbCurrentLabel="Plan du site"
        homeHref="/fr/"
        mainPagesTitle="Pages principales"
        mainPages={[
          { href: '/fr/', label: 'Accueil' },
          { href: '/fr/recherche', label: "Recherche d'artisans" },
          { href: '/fr/services/', label: 'Tous les services' },
          { href: '/fr/urgence/', label: 'Urgence 24/7' },
          { href: '/fr/comment-ca-marche/', label: 'Comment ça marche' },
          { href: '/fr/artisans-verifies/', label: 'Artisans vérifiés' },
          { href: '/fr/devenir-partenaire/', label: 'Devenir partenaire' },
          { href: '/fr/a-propos/', label: 'À propos' },
          { href: '/fr/blog/', label: 'Blog' },
          { href: '/fr/copropriete/', label: 'Syndics & copropriétés' },
          { href: '/fr/simulateur-devis/', label: 'Simulateur de devis' },
          { href: '/fr/specialites/', label: 'Spécialités' },
          { href: '/fr/mentions-legales', label: 'Mentions légales' },
          { href: '/fr/cgu', label: 'CGU' },
        ]}
        servicesByCityTitle="Services par ville en PACA"
        servicesByCityCountSuffix=" villes"
        servicesByCityComboPrefix="à"
        servicesByCityRoot="/fr/services"
        servicesByCityNearMeRoot="/fr/pres-de-chez-moi"
        servicesByCity={servicesByCity}
        defaultOpenServiceSlug="plombier"
        citiesTitle="Villes desservies en PACA"
        cities={FR_CITIES.map(c => ({ slug: c.slug, name: c.name }))}
        cityRoot="/fr/ville"
        blogTitle="Articles du blog"
        blogArticles={FR_BLOG_ARTICLES.map(a => ({ slug: a.slug, title: a.title }))}
        blogRoot="/fr/blog"
        xmlSitemapNote="Vous cherchez le sitemap XML ?"
      />
    </>
  )
}
