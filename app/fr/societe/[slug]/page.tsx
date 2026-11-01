// Route /fr/societe/<slug> : fiche d'une société (SARL, SAS, EURL, SASU, SA), même rendu que /fr/artisan/[id] (la page
// lit le slug ou l'UUID) ; slug inconnu : 404. Une seule URL indexable par fiche FR, celle de /fr/artisan/ : elle porte
// le titre, la description et le JSON-LD de la fiche, et son layout s'y déclare canonique.
import type { Metadata } from 'next'
import { metadonneesFicheSociete, rendreFicheSociete, type ParamsFicheSociete } from './fiche-societe'

export async function generateMetadata(props: ParamsFicheSociete): Promise<Metadata> {
  return metadonneesFicheSociete(props, 'fr/societe', (slug) => ({
    title: `Société`,
    robots: { index: true, follow: true },
    // Repli quand la fiche n'a pas pu être lue : identifiant de la route. Fiche lue : metadonneesFicheSociete pointe la
    // canonical vers son adresse publique (getProfilePath), le slug de la fiche même pour un accès par UUID.
    alternates: {
      canonical: `https://vitfix.io/fr/artisan/${slug}/`,
    },
  }))
}

export default async function SocietePage(props: ParamsFicheSociete) {
  return rendreFicheSociete(props, 'fr/societe')
}
