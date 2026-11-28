// ── AJ Signalement : export CSV des copropriétés importées (navigateur ; pur) ─────────────────────────────────────
//
// SPEC § 1.9.7 : « Exporter la liste (CSV) » après un import — nom, adresse, CP, ville, gestionnaires, lien public du QR
// code (chemin du cabinet client vitfix.io/<identifiant>/signalement/<jeton>/, choix de Hugo du 10/11/2026). Généré dans
// le navigateur, conservé nulle part. Les noms viennent du fichier d'un tiers et la liste s'ouvre dans Excel : toute
// cellule qui commence par =, +, -, @, une tabulation ou un retour chariot est préfixée d'une apostrophe (injection de
// formule), AVANT la mise entre guillemets. UTF-8 avec BOM, séparateur « ; », fins de ligne CRLF.

import { urlSignalementQr, type LigneExportCoproprieteQr } from '@/lib/aj-signalement/types'

const DEBUT_FORMULE = /^[=+\-@\t\r]/

/** « =1+1 » → « '=1+1 » : une cellule ne peut pas devenir une formule à l'ouverture dans un tableur. */
export const neutraliserCelluleCsvQr = (valeur: string): string => (DEBUT_FORMULE.test(valeur) ? `'${valeur}` : valeur)

/** Cellule neutralisée, puis entre guillemets (doublés) si elle contient « ; », un guillemet ou un retour à la ligne. */
export function celluleCsvQr(valeur: string): string {
  const neutre = neutraliserCelluleCsvQr(valeur)
  return /[;"\r\n]/.test(neutre) ? `"${neutre.replace(/"/g, '""')}"` : neutre
}

const ENTETES = ['Nom', 'Adresse', 'Code postal', 'Ville', 'Gestionnaire(s)', 'Lien du QR code']

/** Liste des copropriétés créées, prête à télécharger (texte du fichier .csv). */
export function exportCoproprietesCsvQr(lignes: readonly LigneExportCoproprieteQr[], origine: string): string {
  const corps = lignes.map((l) => [
    l.nom, l.adresse, l.codePostal, l.ville, l.gestionnaires.join(', '), urlSignalementQr(l.jeton, origine, l.identifiantCabinet),
  ])
  return `﻿${[ENTETES, ...corps].map((l) => l.map(celluleCsvQr).join(';')).join('\r\n')}\r\n`
}
