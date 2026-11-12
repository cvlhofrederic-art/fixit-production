import { headers } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'
import AppSignalementQr from '@/components/aj-signalement/AppSignalementQr'
import { lireCoproprieteEtCabinetParJetonQr } from '@/lib/aj-signalement/serveur'
import { estJetonQr } from '@/lib/aj-signalement/types'

// ── AJ Signalement : page ouverte par le QR code d'une copropriété ────────────
//
// Servie par réécriture depuis /fr/signalement/<jeton>/ (next.config.ts), sans session ni cookie : le
// jeton suffit. Composant serveur : la copropriété est lue par son jeton (clé service) ; un jeton inconnu,
// mal formé ou désactivé donne la page 404 du site. La langue vient du chemin (x-locale posé par le
// middleware) : /fr/ en pratique, /pt/ possible. Le formulaire lui-même est un composant client.
// Copropriété rattachée à un cabinet client (choix de Hugo du 10/11/2026) : redirection permanente (308) vers
// vitfix.io/<identifiant>/signalement/<jeton>/. Les QR codes déjà imprimés continuent donc de marcher ; le 308 peut être
// gardé par les navigateurs sans risque, car le rattachement est définitif et l'identifiant figé (triggers en base).

export const dynamic = 'force-dynamic'

export default async function PageSignalementQr({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  if (!estJetonQr(jeton)) notFound()
  const lecture = await lireCoproprieteEtCabinetParJetonQr(jeton)
  if (!lecture.ok || !lecture.copropriete) notFound()
  if (lecture.cabinet?.identifiant) permanentRedirect(`/${lecture.cabinet.identifiant}/signalement/${jeton}/`)
  const langue = (await headers()).get('x-locale') === 'pt' ? 'pt' : 'fr'
  return (
    <AppSignalementQr
      jeton={jeton}
      copropriete={{ nom: lecture.copropriete.nom ?? '', adresse: lecture.copropriete.adresse ?? '' }}
      langue={langue}
    />
  )
}
