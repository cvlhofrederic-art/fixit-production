import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { administrateurJudiciaireActif } from '@/lib/administrateur-judiciaire/flag'
import '@/components/administrateur-judiciaire/styles/aj.css'
// Après aj.css (feuille générée, réécrite à chaque extraction) : règles écrites à la main du haut de page.
import '@/components/administrateur-judiciaire/styles/aj-selecteur-copro.css'

/**
 * Succursale « Administrateur Judiciaire » — logiciel du syndic judiciaire
 * (loi du 10 juillet 1965, décret du 17 mars 1967), séparé du logiciel Syndic.
 *
 * - Garde : lib/administrateur-judiciaire/flag.ts (404 en production tant que non activé).
 * - Styles : feuille de la maquette scopée sous #aj-root (aucun effet hors de ce wrapper), puis les règles écrites à
 *   la main du sélecteur de copropriété et de la barre de recherche du haut de page (aj-selecteur-copro.css).
 * - noindex : outil métier, jamais indexé.
 */
export const metadata: Metadata = {
  title: 'VitFix Pro — Syndic judiciaire',
  robots: { index: false, follow: false, nocache: true },
}

export default function AdministrateurJudiciaireLayout({ children }: { children: React.ReactNode }) {
  if (!administrateurJudiciaireActif()) {
    notFound()
  }
  return (
    <div id="aj-root" lang="fr">
      {children}
    </div>
  )
}
