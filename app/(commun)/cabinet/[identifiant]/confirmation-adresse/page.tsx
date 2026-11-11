import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ConfirmationAdresseQr from '@/components/aj-signalement/ConfirmationAdresseQr'
import {
  FORMAT_IDENTIFIANT_CABINET_QR, LONGUEUR_MAX_IDENTIFIANT_CABINET_QR, LONGUEUR_MIN_IDENTIFIANT_CABINET_QR,
} from '@/lib/aj-signalement/chemin-cabinet'

// ── AJ Signalement : confirmation d'adresse d'un gestionnaire (SPEC § 1.7.4) ────────────────────────────────────
//
// vitfix.io/<identifiant>/confirmation-adresse/#<jeton>, lien de l'e-mail envoyé à la création de la fiche. Servie par
// réécriture, publique (aucune session : le titulaire de la boîte n'a pas de compte en PR 1). Le jeton est APRÈS le
// « # » : il n'arrive jamais au serveur, à Cloudflare ni dans l'en-tête Referer (referrer: no-referrer en plus). Le
// composant client le lit, l'efface de l'adresse, puis appelle les routes publiques avec l'identifiant du chemin, que le
// serveur compare au cabinet de la fiche. Aucune lecture de base ici.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AJ Signalement — Confirmation de votre adresse',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
}

export default async function PageConfirmationAdresseQr({ params }: { params: Promise<{ identifiant: string }> }) {
  const { identifiant } = await params
  const valide = identifiant.length >= LONGUEUR_MIN_IDENTIFIANT_CABINET_QR
    && identifiant.length <= LONGUEUR_MAX_IDENTIFIANT_CABINET_QR
    && FORMAT_IDENTIFIANT_CABINET_QR.test(identifiant)
  if (!valide) notFound()
  return <ConfirmationAdresseQr identifiant={identifiant} />
}
