import type { Metadata } from 'next'
import SimulateurDevisClient from './SimulateurDevisClient'

export const metadata: Metadata = {
  title: 'Simulateur de devis gratuit — Chiffrez vos travaux en PACA | VITFIX',
  description: 'Chiffrez vos travaux en 2 min : plomberie, électricité, peinture, serrurerie, toiture, jardin... Estimation gratuite et instantanée. Artisans certifiés Marseille, Aubagne, La Ciotat, Aix-en-Provence.',
  keywords: [
    'simulateur devis travaux PACA',
    'devis gratuit travaux Marseille',
    'chiffrer travaux Marseille',
    'estimation rénovation Provence',
    'tarif artisan Marseille 2026',
    'devis plombier électricien Marseille',
    'simulateur devis artisan en ligne',
    'estimation travaux gratuite PACA',
  ],
  openGraph: {
    title: 'Simulateur devis gratuit — Chiffrez vos travaux en PACA 2026',
    description: 'Estimation instantanée et gratuite. Artisans certifiés disponibles à Marseille, Aubagne, La Ciotat, Aix-en-Provence et dans tout le 13.',
    siteName: 'VITFIX',
    locale: 'fr_FR',
    type: 'website',
  },
  alternates: {
    canonical: 'https://vitfix.io/fr/simulateur-devis',
  },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Comment chiffrer gratuitement mes travaux à Marseille ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Utilisez notre simulateur en ligne : décrivez vos travaux en langage naturel, indiquez votre ville et obtenez une estimation de prix instantanée basée sur les tarifs PACA 2026. Puis prenez rendez-vous directement avec un artisan certifié.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quel est le tarif moyen d\'un plombier à Marseille en 2026 ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Le tarif d\'un plombier à Marseille est en moyenne de 80 à 350 € pour une intervention (main d\'œuvre), selon la nature et la durée de la prestation. En urgence, comptez un supplément de 30 à 50 %.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quel est le coût d\'une rénovation salle de bain à Marseille ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'La rénovation d\'une salle de bain à Marseille coûte entre 3 000 et 12 000 € selon la surface et le niveau de gamme. Comptez 350 à 700 €/m² pour une rénovation complète (plomberie, carrelage, peinture).',
      },
    },
    {
      '@type': 'Question',
      name: 'Comment trouver un artisan certifié pas cher à Aubagne ou La Ciotat ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Via VITFIX, vous accédez à des artisans vérifiés avec leurs tarifs affichés à Aubagne, La Ciotat, Cassis et toute la région PACA. Utilisez le simulateur pour estimer votre budget puis prenez rendez-vous directement en ligne.',
      },
    },
    {
      '@type': 'Question',
      name: 'Y a-t-il des aides pour financer mes travaux de rénovation en PACA ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Oui : MaPrimeRénov\', l\'Éco-PTZ, le Chèque Énergie Durable et le dispositif Provence Éco-Rénov (Bouches-du-Rhône) peuvent couvrir 25 à 50 % de vos travaux d\'isolation ou de chauffage. Nos artisans certifiés RGE peuvent vous y donner accès.',
      },
    },
  ],
}

export default function SimulateurDevisPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <SimulateurDevisClient />
    </>
  )
}
