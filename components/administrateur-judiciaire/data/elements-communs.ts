import type { ChampFormulaireToast, OptionsDocument } from '@/components/administrateur-judiciaire/ui/toast'

/**
 * Éléments de démonstration repris à l'identique par plusieurs écrans (contenu figé, recopié de la maquette, où il
 * était répété dans chaque écran).
 */

/** Document « Récapitulatif d'export » ouvert par les boutons « Exporter » (visualiseur de documents générés). */
export const DOCUMENT_EXPORT_DONNEES: OptionsDocument = {
  kind: 'doc',
  icon: 'download',
  title: 'Export de données',
  eyebrow: 'Syndic judiciaire · Cabinet Delaunay',
  docTitle: "Récapitulatif d'export",
  meta: 'Généré le 19/06/2026 · format CSV / XLSX',
  lines: [
    "L'export contient l'ensemble des données du module sur la période sélectionnée.",
    {
      h: 'Contenu',
    },
    {
      k: 'Lignes exportées',
      v: '248',
    },
    {
      k: 'Période',
      v: '01/01/2026 — 19/06/2026',
    },
    {
      k: 'Format',
      v: 'CSV (UTF-8) et XLSX',
    },
    {
      k: 'Colonnes',
      v: '12',
    },
  ],
}

/** Champ « Copropriété » des formulaires rapides : liste figée des quatre copropriétés de démonstration. */
export const CHAMP_COPROPRIETE: ChampFormulaireToast = {
  label: 'Copropriété',
  type: 'select',
  options: ['Résidence Le Méridien', 'Le Clos des Vignes', 'Copropriété Les Tilleuls', 'Villa Montaigne'],
  full: true,
}
