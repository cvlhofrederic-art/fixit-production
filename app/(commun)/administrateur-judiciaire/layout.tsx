import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { administrateurJudiciaireActif } from '@/lib/administrateur-judiciaire/flag'
import '@/components/administrateur-judiciaire/styles/aj.css'

/**
 * Succursale « Administrateur Judiciaire » — logiciel du syndic judiciaire
 * (loi du 10 juillet 1965, décret du 17 mars 1967), séparé du logiciel Syndic.
 *
 * - Garde : lib/administrateur-judiciaire/flag.ts (404 en production tant que non activé).
 * - Styles : feuille de la maquette scopée sous #aj-root (aucun effet hors de ce wrapper).
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
