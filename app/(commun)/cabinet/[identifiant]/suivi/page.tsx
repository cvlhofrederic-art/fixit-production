import type { Metadata } from 'next'
import ChargeurEspaceQr from '@/components/aj-signalement/espace/ChargeurEspaceQr'
import { cabinetDeLaPageQr } from '@/lib/aj-signalement/cabinet-du-chemin'

// ── AJ Signalement : espace de suivi d'un cabinet client (vitfix.io/<identifiant>/suivi/, PR 2) ────────────────────
//
// Décisions de Hugo du 11/11/2026 (SPEC § 6) : l'espace personnel du cabinet, même présentation que l'espace global
// (vues par ancre #tableau-de-bord, #coproprietes, #signalements). Servie par réécriture (next.config.ts) après le
// middleware, qui n'y laisse entrer que le gestionnaire de CE cabinet (rôle serveur et repère de routage) ; la garde du
// navigateur refait la même décision avec le cabinet de la page, et chaque route /api/aj-signalement/* relit la fiche du
// gestionnaire (désactivée ou bloquée : 403). Cabinet lu par son identifiant (clé service) : inconnu → 404. Aucune donnée
// de session ni de signalement dans le HTML : l'espace est entièrement client.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AJ Signalement',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function PageSuiviCabinetQr({ params }: { params: Promise<{ identifiant: string }> }) {
  const { identifiant } = await params
  const cabinet = await cabinetDeLaPageQr(identifiant)
  return <ChargeurEspaceQr cabinet={cabinet} />
}
