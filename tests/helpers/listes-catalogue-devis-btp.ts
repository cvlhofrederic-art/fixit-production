// tests/helpers/listes-catalogue-devis-btp.ts — listes déroulantes du formulaire de devis et facture BTP
// (components/DevisFactureFormBTP.tsx) qui proposent le catalogue du module Prestations : ouvrir la liste d'un champ
// et lire ce qu'elle propose. Communes aux tests de ce catalogue.

import { screen, fireEvent } from '@testing-library/react'

/** Texte d'aide du champ « prestation » d'une ligne de main d'œuvre. */
export const CHAMP_PRESTATION = 'Saisissez ou sélectionnez une prestation…'
/** Texte d'aide du champ « matériau » d'une ligne de matériaux. */
export const CHAMP_MATERIAU = 'Saisissez ou sélectionnez un matériau…'

/** Ouvre la liste attachée au champ (bouton ▾ voisin) et rend le texte de chacune de ses lignes. */
export function ouvrirListe(texteAide: string): string[] {
  const champ = screen.getByPlaceholderText(texteAide)
  fireEvent.click(champ.nextElementSibling as HTMLElement)
  const liste = champ.parentElement!.querySelector('div') as HTMLElement
  return Array.from(liste.children).map((n) => n.textContent || '')
}

/** Libellé proposé sans son prix (« Nom — 12,00 € » ; un nom peut lui-même contenir « — »). */
export function nomPropose(libelle: string): string {
  const fin = libelle.lastIndexOf(' — ')
  return fin < 0 ? libelle : libelle.slice(0, fin)
}
