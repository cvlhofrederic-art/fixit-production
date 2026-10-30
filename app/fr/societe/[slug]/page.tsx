// Route /fr/societe/<slug> - URL canonique des sociétés (SARL, SAS, EURL, SASU, SA).
// Les comptes artisan individuels (auto-entrepreneur, EI) restent sur /fr/artisan/<slug>.
// La logique de rendu est partagée avec /fr/artisan/[id] (la page lit le slug ou l'UUID) ; slug inconnu : 404.
import type { Metadata } from 'next'
import { metadonneesFicheSociete, rendreFicheSociete, type ParamsFicheSociete } from './fiche-societe'

export async function generateMetadata(props: ParamsFicheSociete): Promise<Metadata> {
  return metadonneesFicheSociete(props, 'fr/societe', () => ({
    title: `Société | Vitfix`,
    robots: { index: true, follow: true },
  }))
}

export default async function SocietePage(props: ParamsFicheSociete) {
  return rendreFicheSociete(props, 'fr/societe')
}
