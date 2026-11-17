'use client'

// ── QR code d'une copropriété dessiné en SVG (un seul <path>, aucun HTML injecté) ────────────────────
//
// La matrice est calculée par lib/aj-signalement/qr (bibliothèque `qrcode`, chargée à la demande) ; en
// attendant, un carré vide de la même taille évite tout saut de mise en page.

import { useEffect, useState } from 'react'
import { cheminSvgQr, coteSvgQr, matriceQr, type MatriceQr } from '@/lib/aj-signalement/qr'

export interface PropsQrCodeSvg {
  /** Texte encodé (l'adresse publique du formulaire). */
  texte: string
  /** Libellé lu par les lecteurs d'écran. */
  libelle: string
  /** Côté affiché, en pixels CSS. */
  taille?: number
  className?: string
  /** Reçoit la matrice une fois calculée (téléchargements PNG / PDF). */
  onMatrice?: (matrice: MatriceQr) => void
}

export default function QrCodeSvg({ texte, libelle, taille = 192, className = '', onMatrice }: Readonly<PropsQrCodeSvg>) {
  const [matrice, setMatrice] = useState<MatriceQr | null>(null)

  useEffect(() => {
    let annule = false
    setMatrice(null)
    matriceQr(texte)
      .then((m) => {
        if (annule) return
        setMatrice(m)
        onMatrice?.(m)
      })
      .catch((e: unknown) => {
        // Bibliothèque indisponible (déploiement en cours) : le lien et les boutons restent utilisables.
        console.warn('[aj-signalement] QR code non dessiné', e)
      })
    return () => { annule = true }
    // onMatrice : rappel d'affichage, volontairement hors dépendances (une nouvelle fonction à chaque rendu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte])

  if (!matrice) {
    return <div aria-hidden="true" className={`rounded-lg bg-white ${className}`} style={{ width: taille, height: taille }} />
  }
  const cote = coteSvgQr(matrice)
  return (
    <svg
      role="img"
      aria-label={libelle}
      viewBox={`0 0 ${cote} ${cote}`}
      width={taille}
      height={taille}
      shapeRendering="crispEdges"
      className={`rounded-lg bg-white ${className}`}
    >
      <rect width={cote} height={cote} fill="#FFFFFF" />
      <path d={cheminSvgQr(matrice)} fill="#0D1B2E" />
    </svg>
  )
}
