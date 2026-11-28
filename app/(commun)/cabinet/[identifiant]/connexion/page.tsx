import type { Metadata } from 'next'
import ChargeurConnexionEspaceQr from '@/components/aj-signalement/espace/ChargeurConnexionEspaceQr'
import { cabinetDeLaPageQr } from '@/lib/aj-signalement/cabinet-du-chemin'
import { contexteConnexionCabinetQr, titreOngletConnexionQr } from '@/lib/aj-signalement/connexion-espace'
import { lireLogoPageCabinetQr } from '@/lib/aj-signalement/serveur-logo'

// ── AJ Signalement : connexion professionnelle d'un cabinet client (vitfix.io/<identifiant>/connexion/, PR 2) ─────────
//
// Décision de Hugo du 11/11/2026 (SPEC § 6) : chaque cabinet a SA page de connexion professionnelle (e-mail et mot de
// passe, « Mot de passe oublié ? », sans choix Particulier / Artisan / Pro ni Google). Même composant que la connexion de
// l'espace global (#669), avec le contexte du cabinet : nom au-dessus du titre, arrivée sur /<identifiant>/suivi/, et
// l'identifiant pour la décision d'accès (gestionnaire de CE cabinet seul ; super admin renvoyé vers son espace global ;
// tout autre compte : message neutre). Servie par réécriture (next.config.ts) après le middleware, qui envoie déjà le
// gestionnaire connecté de ce cabinet vers son suivi. Cabinet lu par son identifiant (clé service) : inconnu → 404.
// Jamais indexée (robots redits ici, X-Robots-Tag posé en plus par le middleware et next.config.ts).
// Logo du cabinet (demande de Hugo du 13/11/2026) : lu APRÈS le cabinet (inconnu → 404 sans autre lecture), à la place
// de l'icône ; aucun logo (cabinet sans logo, migration 20261114 absente, erreur) → contexte d'avant.

export const dynamic = 'force-dynamic'

const ROBOTS: Metadata['robots'] = { index: false, follow: false, noarchive: true }

export async function generateMetadata({ params }: { params: Promise<{ identifiant: string }> }): Promise<Metadata> {
  const { identifiant } = await params
  const cabinet = await cabinetDeLaPageQr(identifiant)
  return { title: titreOngletConnexionQr(cabinet.nom), robots: ROBOTS }
}

export default async function PageConnexionCabinetQr({ params }: { params: Promise<{ identifiant: string }> }) {
  const { identifiant } = await params
  const cabinet = await cabinetDeLaPageQr(identifiant)
  const logo = await lireLogoPageCabinetQr({ identifiant })
  return <ChargeurConnexionEspaceQr contexte={contexteConnexionCabinetQr(cabinet, logo)} />
}
