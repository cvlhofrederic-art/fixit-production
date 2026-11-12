import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AppSignalementQr from '@/components/aj-signalement/AppSignalementQr'
import { lireCoproprieteEtCabinetParJetonQr } from '@/lib/aj-signalement/serveur'
import {
  FORMAT_IDENTIFIANT_CABINET_QR, LONGUEUR_MAX_IDENTIFIANT_CABINET_QR, LONGUEUR_MIN_IDENTIFIANT_CABINET_QR,
} from '@/lib/aj-signalement/chemin-cabinet'
import { estJetonQr } from '@/lib/aj-signalement/types'

// ── AJ Signalement : page ouverte par le QR code, sous le chemin du cabinet client ────────────────────────────
//
// vitfix.io/<identifiant>/signalement/<jeton>/ (choix de Hugo du 10/11/2026), servie par réécriture (next.config.ts)
// après le middleware, qui la laisse passer sans langue ni session. Le jeton suffit, mais il doit appartenir au cabinet
// du chemin : identifiant ou jeton mal formé → 404 sans lecture ; copropriété inconnue, désactivée, sans cabinet ou
// d'un AUTRE cabinet → le même 404, sans indice. La page est dans la langue du cabinet (colonne langue, FR par défaut) ;
// la coquille du site reste en français (x-locale posé par le middleware).

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AJ Signalement — Signaler un problème',
}

const identifiantValide = (identifiant: string): boolean =>
  identifiant.length >= LONGUEUR_MIN_IDENTIFIANT_CABINET_QR
  && identifiant.length <= LONGUEUR_MAX_IDENTIFIANT_CABINET_QR
  && FORMAT_IDENTIFIANT_CABINET_QR.test(identifiant)

export default async function PageSignalementCabinetQr({ params }: { params: Promise<{ identifiant: string; jeton: string }> }) {
  const { identifiant, jeton } = await params
  if (!identifiantValide(identifiant) || !estJetonQr(jeton)) notFound()
  const lecture = await lireCoproprieteEtCabinetParJetonQr(jeton)
  if (!lecture.ok || !lecture.copropriete || !lecture.cabinet || lecture.cabinet.identifiant !== identifiant) notFound()
  const langue = lecture.cabinet.langue === 'pt' ? 'pt' : 'fr'
  return (
    <div lang={langue}>
      <AppSignalementQr
        jeton={jeton}
        copropriete={{ nom: lecture.copropriete.nom ?? '', adresse: lecture.copropriete.adresse ?? '' }}
        langue={langue}
      />
    </div>
  )
}
