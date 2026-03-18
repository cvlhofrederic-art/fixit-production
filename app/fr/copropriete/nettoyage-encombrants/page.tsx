import type { Metadata } from 'next'
import Link from 'next/link'
import { FR_CITIES } from '@/lib/data/fr-seo-pages-data'
import { PHONE_FR } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Nettoyage Copropriété Marseille — Encombrants, Parties Communes | VITFIX',
  description: 'Nettoyage de copropriété à Marseille : parties communes, enlèvement encombrants, dépôts sauvages. Contrat syndic, facturation copropriété. Devis gratuit.',
  alternates: { canonical: 'https://vitfix.io/fr/copropriete/nettoyage-encombrants/' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      name: 'VITFIX — Nettoyage Copropriété Marseille',
      description: 'Nettoyage de parties communes, enlèvement d\'encombrants et gestion des dépôts sauvages pour copropriétés à Marseille.',
      url: 'https://vitfix.io/fr/copropriete/nettoyage-encombrants/',
      telephone: PHONE_FR,
      areaServed: { '@type': 'City', name: 'Marseille' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
        { '@type': 'ListItem', position: 2, name: 'Copropriété', item: 'https://vitfix.io/fr/copropriete/' },
        { '@type': 'ListItem', position: 3, name: 'Nettoyage & Encombrants', item: 'https://vitfix.io/fr/copropriete/nettoyage-encombrants/' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Quel est le tarif de nettoyage de parties communes à Marseille ?',
          acceptedAnswer: { '@type': 'Answer', text: 'Le tarif dépend de la surface et de la fréquence. Pour un immeuble de 10 à 20 appartements, comptez 150 à 400 € par passage selon les surfaces. Nos contrats annuels offrent des tarifs préférentiels. Devis gratuit sur visite ou sur plan.' },
        },
        {
          '@type': 'Question',
          name: 'Qui est responsable des encombrants en copropriété ?',
          acceptedAnswer: { '@type': 'Answer', text: 'En copropriété, l\'enlèvement des encombrants abandonnés dans les parties communes est généralement à la charge du syndicat de copropriété. Le syndic mandate un prestataire pour l\'évacuation. Les coûts sont imputés soit au budget général, soit au copropriétaire fautif si identifié. VITFIX vous fourni un devis et une facture conformes pour la comptabilité de la copropriété.' },
        },
      ],
    },
  ],
}

const PRESTATIONS = [
  { icon: '🧹', title: 'Nettoyage parties communes', desc: 'Halls d\'entrée, escaliers, couloirs, parkings, locaux poubelles. Nettoyage hebdomadaire ou mensuel selon vos besoins.' },
  { icon: '🗑️', title: 'Enlèvement encombrants', desc: 'Évacuation rapide des encombrants abandonnés en parties communes, caves, parkings. Bordereau de dépôt en déchetterie.' },
  { icon: '🚫', title: 'Traitement dépôts sauvages', desc: 'Nettoyage et évacuation des dépôts sauvages. Rapport photo pour constat et, si nécessaire, dossier pour identification du contrevenant.' },
  { icon: '📦', title: 'Débarras cave/local vélos', desc: 'Tri, évacuation et nettoyage des caves et locaux communs envahis. Service à la carte ou dans le cadre d\'un contrat.' },
  { icon: '🏗️', title: 'Nettoyage après travaux', desc: 'Remise en état des parties communes après travaux de rénovation, plomberie, électricité. Délai court, finitions soignées.' },
  { icon: '🔄', title: 'Contrat entretien régulier', desc: 'Contrat mensuel ou trimestriel pour un immeuble toujours propre. Rapport d\'intervention, facture mensuelle, interlocuteur dédié.' },
]

export default function FrCoproNettoyagePage() {
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
            <span className="text-dark font-medium">Nettoyage & Encombrants</span>
          </nav>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>🗑️</span>
            <span className="text-dark">Syndics · Gestionnaires · Copropriétés</span>
          </div>
          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Nettoyage & Encombrants<br />
            <span className="text-yellow">pour copropriétés à Marseille</span>
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            Nettoyage des parties communes, enlèvement d&apos;encombrants et traitement des dépôts sauvages à Marseille et dans le 13. Facturation syndic, bons d&apos;intervention, contrats sur mesure.
          </p>
          <div className="flex flex-wrap gap-3 mb-8">
            <a
              href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${encodeURIComponent('Bonjour VITFIX, je suis syndic/gestionnaire et souhaite un devis pour le nettoyage et l\'enlèvement d\'encombrants de ma copropriété à Marseille.')}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Devis gratuit syndic — WhatsApp
            </a>
            <a href={`tel:${PHONE_FR}`} className="inline-flex items-center gap-2 border-[1.5px] border-dark text-dark rounded-full font-medium px-7 py-3 text-[0.95rem] bg-transparent hover:bg-dark hover:text-white transition-all">
              Appeler
            </a>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Facturation syndic</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Contrats annuels</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Bordeaux déchetterie agréée</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Intervention sous 48h</span>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">Nos prestations nettoyage copropriété</h2>
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

      {/* Zones */}
      <section className="py-14 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-xl font-bold mb-6">Nettoyage copropriété dans le 13</h2>
          <div className="flex flex-wrap gap-2">
            {FR_CITIES.map(city => (
              <Link key={city.slug} href={`/fr/services/nettoyage-encombrants-${city.slug}/`}
                className="px-4 py-2 rounded-full border border-border/50 text-sm hover:border-yellow hover:bg-yellow/5 transition-all">
                Nettoyage copropriété {city.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Cross-links */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-xl font-bold mb-6">Autres services copropriété</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/fr/copropriete/espaces-verts/" className="flex items-center gap-3 p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group">
              <span className="text-3xl">🌿</span>
              <div>
                <span className="font-display font-bold group-hover:text-yellow transition-colors block">Espaces Verts copropriété</span>
                <span className="text-sm text-text-muted">Entretien jardins, élagage, débroussaillage</span>
              </div>
            </Link>
            <Link href="/fr/copropriete/plomberie/" className="flex items-center gap-3 p-5 bg-white rounded-2xl border border-border/50 hover:border-yellow hover:shadow-md transition-all group">
              <span className="text-3xl">🔧</span>
              <div>
                <span className="font-display font-bold group-hover:text-yellow transition-colors block">Plomberie copropriété</span>
                <span className="text-sm text-text-muted">Colonnes montantes, fuites parties communes</span>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
