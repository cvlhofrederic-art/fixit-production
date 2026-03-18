import type { Metadata } from 'next'
import Link from 'next/link'
import { FR_CITIES } from '@/lib/data/fr-seo-pages-data'
import { PHONE_FR } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Services Copropriété Marseille — Nettoyage, Espaces Verts, Plomberie | VITFIX',
  description: 'Services pour copropriétés à Marseille : nettoyage parties communes, enlèvement encombrants, entretien espaces verts, plomberie immeuble. Devis gratuit, facturation syndic.',
  alternates: {
    canonical: 'https://vitfix.io/fr/copropriete/',
  },
}

const SERVICES_COPRO = [
  {
    icon: '🗑️',
    name: 'Nettoyage & Encombrants',
    slug: 'nettoyage-encombrants',
    description: 'Entretien des parties communes, évacuation d\'encombrants et dépôts sauvages, débarras de caves.',
    coproSpecific: ['Contrat entretien parties communes', 'Bordereau syndic', 'Intervention sur devis AG'],
    href: '/fr/copropriete/nettoyage-encombrants/',
  },
  {
    icon: '🌿',
    name: 'Espaces Verts & Élagage',
    slug: 'espaces-verts',
    description: 'Entretien des jardins et espaces communs, taille des haies, élagage d\'arbres dangereux, débroussaillage anti-incendie.',
    coproSpecific: ['Contrat annuel ou mensuel', 'Obligation légale PACA débroussaillage', 'Rapport d\'intervention'],
    href: '/fr/copropriete/espaces-verts/',
  },
  {
    icon: '🔧',
    name: 'Plomberie Immeuble',
    slug: 'plombier',
    description: 'Maintenance des colonnes montantes, réparation fuites parties communes, entretien chaudière collective.',
    coproSpecific: ['Contrat maintenance préventive', 'Urgence 24h/7j immeuble', 'Rapport d\'intervention assurantiel'],
    href: '/fr/copropriete/plomberie/',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      name: 'VITFIX — Services Copropriété Marseille',
      description: 'Services spécialisés pour copropriétés et syndics à Marseille et dans les Bouches-du-Rhône.',
      url: 'https://vitfix.io/fr/copropriete/',
      telephone: PHONE_FR,
      areaServed: { '@type': 'AdministrativeArea', name: 'Bouches-du-Rhône' },
      serviceType: ['Nettoyage copropriété', 'Espaces verts copropriété', 'Plomberie copropriété'],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'VITFIX', item: 'https://vitfix.io/fr/' },
        { '@type': 'ListItem', position: 2, name: 'Copropriété', item: 'https://vitfix.io/fr/copropriete/' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Comment fonctionne la facturation pour une copropriété ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Nous émettons des devis et factures au nom de la copropriété ou du syndic, avec TVA déductible. Nos interventions sont tracées avec des bons d\'intervention signés. Pour les travaux votés en AG, nous pouvons vous accompagner dans la constitution du dossier.',
          },
        },
        {
          '@type': 'Question',
          name: 'Proposez-vous des contrats d\'entretien annuels pour les copropriétés ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Oui, nous proposons des contrats d\'entretien sur mesure pour les parties communes, espaces verts et installations de plomberie. Ces contrats donnent priorité aux demandes d\'urgence et incluent des rapports d\'intervention réguliers pour la comptabilité de la copropriété.',
          },
        },
      ],
    },
  ],
}

export default function FrCoproprieteHubPage() {
  return (
    <div className="min-h-screen bg-warm-gray">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-16 pb-14 md:pt-20 md:pb-18" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.08) 0%, #fff 40%, #F5F3EF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
            <Link href="/fr/" className="hover:text-yellow transition">VITFIX</Link>
            <span className="mx-2">/</span>
            <span className="text-dark font-medium">Copropriété</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow/10 border border-yellow/25 text-sm font-semibold mb-5">
            <span>🏢</span>
            <span className="text-dark">Syndics · Gestionnaires · Copropriétés — Marseille & 13</span>
          </div>

          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-tight leading-[1.1] text-dark mb-4">
            Services pour copropriétés<br />
            <span className="text-yellow">à Marseille et dans le 13</span>
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mb-8 leading-relaxed">
            VITFIX est votre partenaire artisan pour toutes les interventions en copropriété : nettoyage des parties communes, entretien des espaces verts, plomberie immeuble. Facturation syndic, bons d&apos;intervention, contrats annuels.
          </p>
          <div className="flex flex-wrap gap-3 mb-10">
            <a
              href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=Bonjour%20VITFIX%2C%20je%20gère%20une%20copropriété%20à%20Marseille%20et%20souhaite%20un%20devis%20pour%20vos%20services.`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3 text-[0.95rem] hover:bg-[#20ba59] hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(37,211,102,0.3)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Demander un devis syndic
            </a>
            <a
              href={`tel:${PHONE_FR}`}
              className="inline-flex items-center gap-2 border-[1.5px] border-dark text-dark rounded-full font-medium px-7 py-3 text-[0.95rem] bg-transparent hover:bg-dark hover:text-white transition-all"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/></svg>
              Appeler
            </a>
          </div>
          {/* Trust copro */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Facturation syndic</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Bons d&apos;intervention</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Contrats annuels</span>
            <span className="flex items-center gap-1.5"><span className="text-yellow">✓</span> Urgence 24h/7j</span>
          </div>
        </div>
      </section>

      {/* ── SERVICES COPROPRIÉTÉ ── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-10 text-center">
            Nos services pour votre copropriété
          </h2>
          <div className="grid grid-cols-1 gap-6">
            {SERVICES_COPRO.map(service => (
              <div key={service.slug} className="bg-white rounded-2xl border border-border/50 overflow-hidden">
                <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-4xl">{service.icon}</span>
                      <h3 className="font-display font-bold text-xl">{service.name}</h3>
                    </div>
                    <p className="text-text-muted mb-4 leading-relaxed">{service.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {service.coproSpecific.map(item => (
                        <span key={item} className="px-3 py-1 rounded-full bg-yellow/10 border border-yellow/25 text-xs font-semibold text-dark">{item}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Link
                      href={service.href}
                      className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-6 py-3 text-sm hover:bg-yellow-light hover:-translate-y-0.5 transition-all whitespace-nowrap"
                    >
                      Voir ce service
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                    <a
                      href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=${encodeURIComponent(`Bonjour VITFIX, je suis syndic/gestionnaire et souhaite un devis pour ${service.name} en copropriété à Marseille.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-medium rounded-full px-6 py-3 text-sm hover:bg-[#20ba59] transition-all whitespace-nowrap"
                    >
                      Devis WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AVANTAGES COPROPRIÉTÉ ── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-10 text-center">
            Pourquoi choisir VITFIX pour votre copropriété ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '📋', title: 'Facturation professionnelle', desc: 'Devis et factures au format copropriété, TVA, bons d\'intervention signés. Comptabilité facilitée pour le syndic.' },
              { icon: '📅', title: 'Contrats d\'entretien', desc: 'Contrats mensuels ou annuels pour une maintenance régulière. Priorité sur les urgences, rapports périodiques.' },
              { icon: '⚡', title: 'Réactivité garantie', desc: 'Urgences traitées sous 24–48h. Un interlocuteur unique pour toutes vos demandes. Disponible 7j/7.' },
              { icon: '📍', title: 'Couverture totale du 13', desc: 'Marseille et toutes les communes du département 13 : Aubagne, Aix-en-Provence, La Ciotat, Martigues...' },
              { icon: '🏗️', title: 'Multi-corps de métier', desc: 'Un seul prestataire pour nettoyage, espaces verts ET plomberie. Moins d\'interlocuteurs, plus d\'efficacité.' },
              { icon: '✅', title: 'Artisans certifiés', desc: 'Tous nos artisans sont vérifiés, assurés RC pro. Attestations disponibles sur demande.' },
            ].map(avantage => (
              <div key={avantage.title} className="p-5 rounded-2xl border border-border/50">
                <span className="text-3xl block mb-3">{avantage.icon}</span>
                <h3 className="font-display font-bold mb-2">{avantage.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{avantage.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ZONES ── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-6 text-center">
            Copropriétés desservies dans le 13
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FR_CITIES.map(city => (
              <div key={city.slug} className="p-4 rounded-xl border border-border/50 text-center">
                <span className="font-semibold text-sm text-dark block">{city.name}</span>
                <span className="text-xs text-text-muted">{city.population.toLocaleString('fr-FR')} hab.</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight mb-8">
            Questions des syndics et gestionnaires
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'Comment se passe la facturation pour une copropriété ?',
                a: 'Nous émettons des devis et factures au nom de la copropriété ou du syndic, avec TVA récupérable. Nos interventions sont tracées avec des bons d\'intervention signés par votre représentant sur place. Pour les travaux votés en AG, nous pouvons vous accompagner dans la constitution du dossier (devis conforme, assurance, certificat RGE si applicable).',
              },
              {
                q: 'Intervenez-vous en urgence pour les immeubles ?',
                a: 'Oui, nous avons une astreinte urgence pour les copropriétés. Fuite sur colonne montante, arbre tombé sur parties communes, cave inondée — nos équipes interviennent en priorité sous 24h à 48h. Pour les urgences vraiment critiques (fuite d\'eau active, dégât des eaux en cours), contactez-nous par WhatsApp pour une intervention rapide.',
              },
              {
                q: 'Proposez-vous des contrats d\'entretien pluriannuels ?',
                a: 'Oui, nous proposons des contrats 1 an, 2 ans ou 3 ans pour les copropriétés qui souhaitent sécuriser un prestataire de confiance. Ces contrats incluent des tarifs préférentiels, la priorité sur les urgences, des rapports trimestriels d\'intervention et un interlocuteur dédié. Ils peuvent être soumis au vote de l\'AG et intégrés au budget de la copropriété.',
              },
              {
                q: 'Avez-vous les assurances nécessaires pour intervenir en copropriété ?',
                a: 'Oui, tous nos artisans disposent d\'une assurance Responsabilité Civile Professionnelle et, selon les métiers, d\'une garantie décennale. Nous fournissons les attestations d\'assurance sur demande. Pour les travaux en hauteur (élagage, toiture), nos équipes disposent des habilitations et équipements de protection individuelle requis.',
              },
            ].map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-border/50 bg-warm-gray overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-display font-bold text-dark hover:text-yellow transition select-none">
                  <span className="text-[0.95rem]">{faq.q}</span>
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow/15 flex items-center justify-center text-yellow text-sm font-bold group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[0.93rem] text-dark/80 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl p-8 md:p-12" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <span className="text-yellow font-bold text-sm uppercase tracking-wider block mb-2">🏢 Syndics & Gestionnaires</span>
                <h3 className="font-display text-xl md:text-2xl font-bold text-white mb-2">
                  Demandez un devis copropriété
                </h3>
                <p className="text-white/70 text-[0.93rem] max-w-lg">
                  Devis gratuit sous 24h, facturation syndic, contrats sur mesure. Couvrons tout le département 13.
                </p>
              </div>
              <div className="flex flex-col gap-3 flex-shrink-0">
                <a
                  href={`https://wa.me/${PHONE_FR.replace('+', '')}?text=Bonjour%20VITFIX%2C%20je%20suis%20syndic%2Fgestionnaire%20et%20souhaite%20un%20devis%20pour%20ma%20copropriété%20à%20Marseille.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-[#20ba59] transition-all whitespace-nowrap"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp Syndic
                </a>
                <a
                  href={`tel:${PHONE_FR}`}
                  className="inline-flex items-center justify-center gap-2 bg-yellow text-dark font-display font-bold rounded-full px-7 py-3.5 text-[0.95rem] hover:bg-yellow-light transition-all whitespace-nowrap"
                >
                  Appeler maintenant
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
