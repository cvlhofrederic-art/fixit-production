// Route /fr/societe/<slug> — URL canonique des sociétés (SARL, SAS, EURL, SASU, SA).
// Les comptes artisan individuels (auto-entrepreneur, EI) restent sur /fr/artisan/<slug>.
// La logique de rendu est partagée avec /fr/artisan/[id] (la page lit le slug ou l'UUID).
export { default } from '@/app/fr/artisan/[id]/page'

import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Société | Vitfix`,
    robots: { index: true, follow: true },
  }
}
