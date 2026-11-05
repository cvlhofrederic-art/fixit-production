import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import AppSignalementQr from '@/components/aj-signalement/AppSignalementQr'
import { lireCoproprieteParJeton } from '@/lib/aj-signalement/serveur'
import { estJetonQr } from '@/lib/aj-signalement/types'

// ── AJ Signalement : page ouverte par le QR code d'une copropriété ────────────
//
// Servie par réécriture depuis /fr/signalement/<jeton>/ (next.config.ts), sans session ni cookie : le
// jeton suffit. Composant serveur : la copropriété est lue par son jeton (clé service) ; un jeton inconnu,
// mal formé ou désactivé donne la page 404 du site. La langue vient du chemin (x-locale posé par le
// middleware) : /fr/ en pratique, /pt/ possible. Le formulaire lui-même est un composant client.

export const dynamic = 'force-dynamic'

export default async function PageSignalementQr({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  if (!estJetonQr(jeton)) notFound()
  const lecture = await lireCoproprieteParJeton(jeton)
  if (!lecture.ok || !lecture.copropriete) notFound()
  const langue = (await headers()).get('x-locale') === 'pt' ? 'pt' : 'fr'
  return (
    <AppSignalementQr
      jeton={jeton}
      copropriete={{ nom: lecture.copropriete.nom ?? '', adresse: lecture.copropriete.adresse ?? '' }}
      langue={langue}
    />
  )
}
