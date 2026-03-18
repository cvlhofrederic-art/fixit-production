import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SimulateurDevisClient from '../SimulateurDevisClient'

const CITIES: Record<string, string> = {
  'marseille': 'Marseille',
  'aix-en-provence': 'Aix-en-Provence',
  'aubagne': 'Aubagne',
  'la-ciotat': 'La Ciotat',
  'cassis': 'Cassis',
  'martigues': 'Martigues',
  'allauch': 'Allauch',
  'salon-de-provence': 'Salon-de-Provence',
  'saint-cyr-sur-mer': 'Saint-Cyr-sur-Mer',
  'bandol': 'Bandol',
  'gemenos': 'Gémenos',
  'sanary-sur-mer': 'Sanary-sur-Mer',
  'six-fours-les-plages': 'Six-Fours-les-Plages',
  'ceyreste': 'Ceyreste',
  'la-seyne-sur-mer': 'La Seyne-sur-Mer',
  'hyeres': 'Hyères',
  'la-valette-du-var': 'La Valette-du-Var',
  'plan-de-cuques': 'Plan-de-Cuques',
  'gardanne': 'Gardanne',
  'marseille-1er': 'Marseille 1er',
  'marseille-2eme': 'Marseille 2ème',
  'marseille-3eme': 'Marseille 3ème',
  'marseille-4eme': 'Marseille 4ème',
  'marseille-5eme': 'Marseille 5ème',
  'marseille-6eme': 'Marseille 6ème',
  'marseille-7eme': 'Marseille 7ème',
  'marseille-8eme': 'Marseille 8ème',
  'marseille-9eme': 'Marseille 9ème',
  'marseille-10eme': 'Marseille 10ème',
  'marseille-11eme': 'Marseille 11ème',
  'marseille-12eme': 'Marseille 12ème',
  'marseille-13eme': 'Marseille 13ème',
  'marseille-14eme': 'Marseille 14ème',
  'marseille-15eme': 'Marseille 15ème',
  'marseille-16eme': 'Marseille 16ème',
}

export async function generateStaticParams() {
  return Object.keys(CITIES).map((city) => ({ city }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ city: string }> }
): Promise<Metadata> {
  const { city: citySlug } = await params
  const cityName = CITIES[citySlug]
  if (!cityName) return {}

  return {
    title: `Devis gratuit artisan à ${cityName} — Chiffrez vos travaux en 2 min | VITFIX`,
    description: `Estimez le coût de vos travaux à ${cityName} : plomberie, électricité, peinture, serrurerie, toiture... Tarifs PACA 2026 actualisés. Artisans certifiés disponibles, réservation directe.`,
    keywords: [
      `devis gratuit travaux ${cityName}`,
      `simulateur devis ${cityName}`,
      `chiffrer travaux ${cityName}`,
      `tarif artisan ${cityName}`,
      `estimation rénovation ${cityName}`,
      `plombier électricien ${cityName} prix`,
      `devis artisan ${cityName} en ligne`,
    ],
    openGraph: {
      title: `Devis gratuit artisan à ${cityName} — Estimation instantanée 2026`,
      description: `Chiffrez vos travaux à ${cityName} en 2 minutes. Tarifs affichés, artisans vérifiés, réservation directe.`,
      siteName: 'VITFIX',
      locale: 'fr_FR',
      type: 'website',
    },
    alternates: {
      canonical: `https://vitfix.io/fr/simulateur-devis/${citySlug}`,
    },
  }
}

function buildFaqSchema(cityName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Comment obtenir un devis gratuit pour des travaux à ${cityName} ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Utilisez le simulateur VITFIX : décrivez vos travaux, obtenez une estimation de prix basée sur les tarifs PACA 2026, puis prenez rendez-vous directement avec un artisan certifié à ${cityName}. Devis gratuit, sans engagement.`,
        },
      },
      {
        '@type': 'Question',
        name: `Quel est le tarif d'un plombier à ${cityName} ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `À ${cityName}, le tarif d'un plombier est généralement de 80 à 350 € pour une intervention. En urgence, un supplément de 30 à 50 % peut s'appliquer. Utilisez notre simulateur pour une estimation précise selon votre type de panne.`,
        },
      },
      {
        '@type': 'Question',
        name: `Comment trouver un artisan certifié à ${cityName} ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `VITFIX référence des artisans certifiés à ${cityName} avec leurs tarifs affichés. Décrivez votre besoin, consultez les profils, comparez les prix et réservez directement en ligne — sans intermédiaire.`,
        },
      },
      {
        '@type': 'Question',
        name: `Combien coûte une rénovation salle de bain à ${cityName} ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `À ${cityName}, la rénovation d'une salle de bain coûte entre 3 000 et 12 000 € selon la surface et le niveau de finition. Comptez 350 à 700 €/m² pour une rénovation complète. Obtenez une estimation précise via notre simulateur.`,
        },
      },
    ],
  }
}

export default async function SimulateurDevisVillePage(
  { params }: { params: Promise<{ city: string }> }
) {
  const { city: citySlug } = await params
  const cityName = CITIES[citySlug]
  if (!cityName) notFound()

  const faqSchema = buildFaqSchema(cityName)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <SimulateurDevisClient initialCity={cityName} citySlug={citySlug} />
    </>
  )
}
