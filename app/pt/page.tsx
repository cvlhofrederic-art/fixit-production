// Home page Vitfix Portugal — server component qui injecte le fil d'Ariane JSON-LD
// et rend le HomePage client avec la liste des 22 villes couvertes.
//
// Phase 1 SEO PT (point 1.6) : plus de second HomeAndConstructionBusiness avec une
// adresse fictive « Porto 4000-001 ». L'entité unique (#business, adresse réelle du
// siège, 22 concelhos servis) est injectée par app/layout.tsx sur toutes les pages PT.

import type { Metadata } from 'next'
import HomePage from '../page'
import { CITIES } from '@/lib/data/seo-pages-data'
import { grafo, noFilAriane, noWebPage } from '@/lib/seo/pt-schemas'

export const metadata: Metadata = {
  // Titre sans marque : le template de app/pt/layout.tsx l'ajoute (« … | VITFIX »), phase 1 SEO PT, point 1.4.
  title: 'Profissionais de construção verificados em Portugal',
  description:
    'Profissionais verificados em 22 concelhos do Porto, Braga e Aveiro: canalizador, eletricista, pintor, faz-tudo. Orçamento grátis pelo site ou WhatsApp.',
  // L'objet alternates de la page remplace celui de app/pt/layout.tsx (Next ne fusionne pas ses clés) : la
  // canonical seule effaçait les hreflang. x-default sur /fr/ (locale par défaut du middleware, 200) et non
  // sur /, qui redirige en 302 (phase 1 SEO PT, point 1.5).
  alternates: {
    canonical: 'https://vitfix.io/pt/',
    languages: {
      'fr-FR': 'https://vitfix.io/fr/',
      'pt-PT': 'https://vitfix.io/pt/',
      en: 'https://vitfix.io/en/',
      nl: 'https://vitfix.io/nl/',
      es: 'https://vitfix.io/es/',
      'x-default': 'https://vitfix.io/fr/',
    },
  },
}

const HOME_URL = 'https://vitfix.io/pt/'

const ptHomeSchema = grafo(
  noWebPage({ url: HOME_URL, nome: 'Profissionais de construção em Portugal' }),
  noFilAriane([{ name: 'Início', url: HOME_URL }]),
)

// Les 22 villes couvertes (source unique : lib/data/seo-pages-data.ts), passées au composant client
// pour ne pas embarquer le fichier de données dans le bundle navigateur.
const cidadesPt = CITIES.map(c => ({ name: c.name, slug: c.slug, population: c.population }))

export default function PtHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ptHomeSchema) }}
      />
      <HomePage cidadesPt={cidadesPt} />
    </>
  )
}
