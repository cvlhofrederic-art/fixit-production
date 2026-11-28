/**
 * Écrans du patrimoine et de la conformité affichés selon la copropriété choisie dans le sélecteur du haut de page
 * (demande de Hugo du 29/10/2026) : règles communes, sans React.
 */

/** Prestataire lu pour le rattacher à une copropriété (fiche détaillée facultative). */
export interface PrestataireRattachable {
  id: string
  fiche?: { intervientPour: readonly string[] } | null
}

/**
 * Vrai si le prestataire travaille pour la copropriété : un contrat les lie, ou sa fiche déclare qu'il y intervient
 * (nom exact de la copropriété). Règle des « entreprises de l'immeuble » de la fiche copropriété.
 */
export function prestataireDeLaCopro(
  prestataire: PrestataireRattachable,
  copro: { id: string; nom: string },
  contrats: readonly { prestataireId: string; coproprieteId: string }[],
): boolean {
  const sousContrat = contrats.some(
    (contrat) => contrat.prestataireId === prestataire.id && contrat.coproprieteId === copro.id,
  )
  return sousContrat || (prestataire.fiche?.intervientPour.includes(copro.nom) ?? false)
}

/**
 * Lignes retenues par `estDeLaCopro` d'abord, puis les autres (chaque groupe dans son ordre d'origine) ; seulement les
 * lignes retenues si `seulementCopro`. Toujours un nouveau tableau.
 */
export function enPremierPourCopro<T>(lignes: readonly T[], estDeLaCopro: (ligne: T) => boolean, seulementCopro: boolean): T[] {
  const retenues = lignes.filter(estDeLaCopro)
  if (seulementCopro) return retenues
  return [...retenues, ...lignes.filter((ligne) => !estDeLaCopro(ligne))]
}

const CLASSES_DPE = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

/**
 * Classe énergétique moyenne d'un parc (rang moyen des classes A à G, arrondi vers la classe la plus performante à
 * égalité) ; les classes inconnues sont ignorées, null s'il n'en reste aucune.
 */
export function classeDpeMoyenne(classes: readonly string[]): string | null {
  const rangs = classes
    .map((classe) => CLASSES_DPE.indexOf(classe.trim().toUpperCase() as (typeof CLASSES_DPE)[number]))
    .filter((rang) => rang >= 0)
  if (rangs.length === 0) return null
  const moyenne = rangs.reduce((total, rang) => total + rang, 0) / rangs.length
  return CLASSES_DPE[Math.ceil(moyenne - 0.5)]
}
