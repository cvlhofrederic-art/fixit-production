import type { Metadata } from 'next'
import Link from 'next/link'
import { FR_CITIES } from '@/lib/data/fr-seo-pages-data'
import { PHONE_FR } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Plomberie Copropriété Marseille — Colonnes Montantes, Urgence Immeuble | VITFIX',
  description: 'Plomberie de copropriété à Marseille : maintenance colonnes montantes, réparation fuites parties communes, chaudière collective, urgence 24h. Contrat syndic.',
  alternates: { canonical: 'https://vitfix.io/fr/copropriete/plomberie/' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      name: 'VITFIX — Plomberie Copropriété Marseille',
      description: 'Plomberie et maintenance pour copropriétés à Marseille : colonnes montantes, fuites parties communes, urgence 24h.',
      url: 'https://vitfix.io/fr/copropriete/plomberie/',
      telephone: PHONE_FR,
      areaServed: { '@type': 'AdministrativeArea', name: 'Bouches-du-Rhône' },
      openingHoursSpecification: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '00:00',
        closes: '23:59',
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
        { '@type': 'ListItem', position: 2, name: 'Copropriété', item: 'https://vitfix.io/fr/copropriete/' },
        { '@type': 'ListItem', position: 3, name: 'Plomberie copropriété', item: 'https://vitfix.io/fr/copropriete/plomberie/' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Qui est responsable d\'une fuite sur colonne montante en copropriété ?',
          acceptedAnswer: { '@type': 'Answer', text: 'Les colonnes montantes (eau froide, chaude, évacuation) font partie des parties communes et relèvent de la responsabilité du syndicat de copropriété. La réparation est votée en AG ou décidée par le syndic en urgence selon les statuts et le montant des travaux. VITFIX vous remet un rapport d\'intervention détaillé utile pour la gestion de sinistre et la déclaration assurance.' },
        },
        {
          '@type': 'Question',
          name: 'Intervenez-vous en urgence plomberie pour les immeubles à Marseille ?',
          acceptedAnswer: { '@type': 'Answer', text: 'Oui, nous avons une astreinte urgence 24h/7j pour les copropriétés. Fuite sur colonne montante, cave inondée, canalisation bouchée bloquant plusieurs appartements — nos plombiers interviennent en priorité sous 30 à 60 minutes à Marseille et dans le 13. Prévenez-nous par WhatsApp ou téléphone pour un traitement en priorité.' },
        },
      ],
    },
  ],
}

const PRESTATIONS = [
  { icon: '🏗️', title: 'Colonnes montantes', desc: 'Inspection, maintenance et réparation des colonnes d\'eau froide, chaude et d\'évacuation. Diagnostic complet avec rapport.' },
  { icon: '🔍', title: 'Détection de fuite', desc: 'Localisation non destructive des fuites cachées dans les parties communes. Rapport détaillé pour l\'assurance.' },
  { icon: '🚨', title: 'Urgence immeuble 24h/7j', desc: 'Fuite active, cave inondée, colonne bouchée — intervention prioritaire pour les copropriétés sous contrat.' },
  { icon: '🔧', title: 'Débouchage canalisations', desc: 'Débouchage des canalisations collectives par haute pression. Inspection caméra si nécessaire.' },
  { icon: '🌡️', title: 'Chaufferie collective', desc: 'Maintenance et réparation de la chaufferie et du circuit de chauffage collectif. Contrat de maintenance annuel.' },
  { icon: '📋', title: 'Contrat de maintenance', desc: 'Visite annuelle ou semestrielle des installations de plomberie collectives. Rapport d\'état, préconisations travaux.' },
]

export default function FrCoproPlomberiePage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="relative overflow-hidden pt-16 pb-14 md:pt-20" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/fr/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <Link href="/fr/copropriete/" className="hover:text-yellow transition">Copropriété</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Plomberie copropriété</span>
          </nav>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>🔧</span>
            <span className="text-dark">Syndics · Copropriétés — Urgence 24h/7j</span>
          </div>
          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Plomberie copropriété<br />
            <span className="text-yellow">à Marseille — Urgence 24h/7j</span>
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Maintenance des colonnes montantes, réparation fuites parties communes, débouchage collectif et urgence 24h pour vos copropriétés à Marseille et dans le 13. Rapport d&apos;intervention, facturation syndic.
          </p>
          <div className="flex flex-wrap gap-3 mb-8">
            <a
              href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${encodeURIComponent('URGENCE COPROPRIÉTÉ — J\'ai une fuite/problème plomberie dans les parties communes de mon immeuble à Marseille. Pouvez-vous intervenir rapidement ?')}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Urgence plomberie immeuble
            </a>
            <a href={`tel:${PHONE_FR}`} className="inline-flex items-center gap-2 border-[1.5px] border-dark text-dark rounded-full font-medium px-7 py-3 text-[0.95rem] bg-transparent hover:bg-dark hover:text-white transition-all">Appeler maintenant</a>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Urgence 24h/7j</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Rapport d&apos;intervention</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Contrat maintenance</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Facturation syndic</span>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">Nos prestations plomberie copropriété</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {PRESTATIONS.map(p => (
              <div key={p.title} className="p-5 bg-white rounded-2xl border border-border/50">
                <span className="text-3xl block mb-3">{p.icon}</span>
                <h3 className="font-display font-bold mb-2 text-sm">{p.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-xl font-bold mb-6">Plomberie copropriété dans le 13</h2>
          <div className="flex flex-wrap gap-2">
            {FR_CITIES.map(city => (
              <Link key={city.slug} href={`/fr/urgence/plombier-urgence-${city.slug}/`}
                className="px-4 py-2 rounded-full border border-border/50 text-sm hover:border-yellow hover:bg-yellow/5 transition-all">
                Plomberie urgence {city.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-xl font-bold mb-6">Autres services copropriété</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/fr/copropriete/nettoyage-encombrants/" className="flex items-center gap-3 p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group">
              <span className="text-3xl">🗑️</span>
              <div>
                <span className="font-display font-bold group-hover:text-yellow transition-colors block">Nettoyage & Encombrants</span>
                <span className="text-sm text-text-muted">Parties communes, dépôts sauvages, débarras</span>
              </div>
            </Link>
            <Link href="/fr/copropriete/espaces-verts/" className="flex items-center gap-3 p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group">
              <span className="text-3xl">🌿</span>
              <div>
                <span className="font-display font-bold group-hover:text-yellow transition-colors block">Espaces Verts & Élagage</span>
                <span className="text-sm text-text-muted">Jardins, élagage, débroussaillage PACA</span>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
