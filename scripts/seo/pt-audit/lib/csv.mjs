// Lecture/écriture CSV (RFC 4180, UTF-8, BOM toléré en lecture).
export function lireCsv(texte) {
  const t = String(texte).replace(/^﻿/, '')
  const lignes = []
  let champ = ''
  let ligne = []
  let q = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) {
      if (ch === '"') {
        if (t[i + 1] === '"') { champ += '"'; i++ } else q = false
      } else champ += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { ligne.push(champ); champ = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      ligne.push(champ)
      champ = ''
      if (ligne.some((x) => x !== '')) lignes.push(ligne)
      ligne = []
    } else champ += ch
  }
  if (champ !== '' || ligne.length) {
    ligne.push(champ)
    if (ligne.some((x) => x !== '')) lignes.push(ligne)
  }
  const entete = lignes.shift() || []
  return lignes.map((l) => Object.fromEntries(entete.map((k, i) => [k, l[i] ?? ''])))
}

export function champCsv(v) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function ecrireCsv(lignes, colonnes) {
  const cols = colonnes || Object.keys(lignes[0] || {})
  return [cols.join(','), ...lignes.map((l) => cols.map((c) => champCsv(l[c])).join(','))].join('\n') + '\n'
}
