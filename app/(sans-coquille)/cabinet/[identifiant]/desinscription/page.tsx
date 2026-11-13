import type { Metadata } from 'next'
import DesinscriptionDiffusionQr from '@/components/aj-signalement/DesinscriptionDiffusionQr'
import {
  FORMAT_IDENTIFIANT_CABINET_QR, LONGUEUR_MAX_IDENTIFIANT_CABINET_QR, LONGUEUR_MIN_IDENTIFIANT_CABINET_QR,
} from '@/lib/aj-signalement/chemin-cabinet'
import { cabinetDuCheminDesinscriptionQr } from '@/lib/aj-signalement/serveur-desinscription'

// ── AJ Signalement : désinscription des messages de diffusion (PR 3, lot 6 ; cahier § 7.5) ─────────────────────────
//
// vitfix.io/<identifiant>/desinscription/#<jeton>, bouton « Ne plus recevoir les informations sur cet immeuble » de
// chaque message de diffusion (et adresse un clic ouverte dans un navigateur, D-P5b). Servie par réécriture, publique,
// SANS session même si l'espace du cabinet est sous session (le middleware la reconnaît avant tout contrôle), sans la
// coquille de VitFix (mise en page racine de app/(sans-coquille)/). Le jeton est APRÈS le « # » : il n'arrive jamais au
// serveur, à Cloudflare ni dans l'en-tête Referer (referrer: no-referrer en plus) ; le composant le lit, l'efface de
// l'adresse, puis appelle les routes publiques avec l'identifiant du chemin, que le serveur compare au cabinet de la
// diffusion. Seule lecture ici : la langue et le contact du cabinet du chemin (page « lien non valable » quand le
// fragment manque, langue par défaut) ; l'ouverture n'a aucun effet.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Informations sur votre immeuble',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
}

export default async function PageDesinscriptionDiffusionQr({ params }: { params: Promise<{ identifiant: string }> }) {
  const { identifiant } = await params
  const valide = identifiant.length >= LONGUEUR_MIN_IDENTIFIANT_CABINET_QR
    && identifiant.length <= LONGUEUR_MAX_IDENTIFIANT_CABINET_QR
    && FORMAT_IDENTIFIANT_CABINET_QR.test(identifiant)
  // Identifiant hors format : page « lien non valable », sans lecture (jamais une 404 sèche depuis un e-mail).
  if (!valide) return <DesinscriptionDiffusionQr identifiant={null} cabinet={null} />
  const cabinet = await cabinetDuCheminDesinscriptionQr(identifiant)
  return <DesinscriptionDiffusionQr identifiant={identifiant} cabinet={cabinet} />
}
