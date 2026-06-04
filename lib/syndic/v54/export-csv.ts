// Export CSV générique pour les tableaux syndic v54 (compatible Excel / LibreOffice).
//
// Séparateur « ; » (défaut Excel FR/PT) + BOM UTF-8 pour que les accents (ã ç õ) s'affichent
// correctement à l'ouverture dans Excel. Aucune dépendance externe, génération côté navigateur.

export type CsvCell = string | number | null | undefined

/** Sérialise en CSV (délimiteur « ; », CRLF). Échappe guillemets/délimiteurs/sauts de ligne. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const esc = (v: CsvCell) => {
    const s = String(v ?? '')
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
}

/** Génère le CSV et déclenche le téléchargement (navigateur). Lève côté serveur. */
export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]): void {
  if (typeof document === 'undefined') throw new Error('Export CSV indisponível côté serveur')
  const blob = new Blob(["\uFEFF" + toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
