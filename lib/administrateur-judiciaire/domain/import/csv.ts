import { dateFrVersIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'

/** Primitives d'import CSV (relevés bancaires, listes de copropriétaires). */

/**
 * Date d'une cellule de relevé → ISO : « AAAA-MM-JJ… », « JJ/MM/AAAA… » (séparateurs / . -) ou « JJ/MM/AA » (20AA).
 * Null si illisible ou invalide. Sert aussi à reconnaître qu'une première ligne n'est pas un en-tête.
 */
export function parserDateReleve(texte: string): string | null {
  const valeur = texte.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valeur)
  if (m) return estDateIsoValide(`${m[1]}-${m[2]}-${m[3]}`) ? `${m[1]}-${m[2]}-${m[3]}` : null
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(valeur)
  if (m) return dateFrVersIso(`${m[1]}/${m[2]}/${m[3]}`)
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/.exec(valeur)
  return m ? dateFrVersIso(`${m[1]}/${m[2]}/20${m[3]}`) : null
}

/**
 * Montant d'une cellule : espaces, « € » et « EUR » ignorés ; négatif entre parenthèses ou suivi de « - ».
 * Si « , » et « . » coexistent, le dernier des deux est le séparateur décimal. Vide ou illisible → null.
 */
export function parserMontant(texte: string): number | null {
  let valeur = texte.replace(/[\s  €]/g, '').replace(/EUR$/i, '')
  if (!valeur) return null
  let negatif = false
  if (/^\(.*\)$/.test(valeur)) {
    negatif = true
    valeur = valeur.slice(1, -1)
  }
  if (valeur.endsWith('-')) {
    negatif = true
    valeur = valeur.slice(0, -1)
  }
  if (valeur.includes(',') && valeur.includes('.'))
    valeur =
      valeur.lastIndexOf(',') > valeur.lastIndexOf('.')
        ? valeur.replace(/\./g, '').replace(',', '.')
        : valeur.replace(/,/g, '')
  else valeur = valeur.replace(',', '.')
  if (!/^[-+]?\d+(\.\d+)?$/.test(valeur)) return null
  const montant = Number(valeur)
  return Number.isFinite(montant) ? (negatif ? -Math.abs(montant) : montant) : null
}

/** Découpe une ligne CSV (guillemets doublés échappés), cellules rognées. */
export function decouperLigneCsv(ligne: string, separateur: string): string[] {
  const cellules: string[] = []
  let cellule = '',
    entreGuillemets = false
  for (let i = 0; i < ligne.length; i++) {
    const caractere = ligne[i]
    if (caractere === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') {
        cellule += '"'
        i++
      } else entreGuillemets = !entreGuillemets
    } else if (caractere === separateur && !entreGuillemets) {
      cellules.push(cellule)
      cellule = ''
    } else cellule += caractere
  }
  cellules.push(cellule)
  return cellules.map((c) => c.trim())
}

/** Séparateur le plus fréquent parmi « ; », tabulation, « , » et « | » (à égalité, dans cet ordre). */
export function detecterSeparateurCsv(ligne: string): string {
  return [';', '\t', ',', '|']
    .map((separateur) => ({
      s: separateur,
      n: ligne.split(separateur).length,
    }))
    .sort((a, b) => b.n - a.n)[0].s
}

/** Index de la première colonne reconnue par le premier motif qui trouve ; null si aucune. */
export function trouverColonne(colonnes: string[], ...motifs: RegExp[]): number | null {
  for (const motif of motifs) {
    const index = colonnes.findIndex((colonne) => motif.test(colonne))
    if (index >= 0) return index
  }
  return null
}
