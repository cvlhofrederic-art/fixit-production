// Mesures de contenu : séquences glissantes de 5 mots, fréquence documentaire
// (df) par modèle, part « propre » (df == 1) et « partage10 » (df >= 10).
// Méthode identique à celle du rapport du 13/10/2026 (section 11).

export function sequences(motsPage, n = 5) {
  const s = new Set()
  for (let i = 0; i + n <= motsPage.length; i++) s.add(motsPage.slice(i, i + n).join(' '))
  return s
}

/**
 * pages : [{ cle, mots }]. Renvoie Map(cle -> { sequences_n, propre, partage10 }).
 * Les mesures sont calculées contre les autres pages du MÊME tableau.
 */
export function mesurerGroupe(pages) {
  const seqParPage = new Map()
  const df = new Map()
  for (const p of pages) {
    const s = sequences(p.mots)
    seqParPage.set(p.cle, s)
    for (const q of s) df.set(q, (df.get(q) || 0) + 1)
  }
  const res = new Map()
  for (const p of pages) {
    const s = seqParPage.get(p.cle)
    let propre = 0
    let partage10 = 0
    for (const q of s) {
      const d = df.get(q)
      if (d === 1) propre++
      if (d >= 10) partage10++
    }
    res.set(p.cle, { sequences_n: s.size, propre: s.size ? propre / s.size : 0, partage10: s.size ? partage10 / s.size : 0 })
  }
  return res
}

/** Part des séquences de A présentes dans B (chevauchement orienté). */
export function chevauchement(motsA, motsB) {
  const a = sequences(motsA)
  const b = sequences(motsB)
  if (!a.size) return 0
  let c = 0
  for (const q of a) if (b.has(q)) c++
  return c / a.size
}

export function moyenne(valeurs) {
  const v = valeurs.filter((x) => typeof x === 'number' && !Number.isNaN(x))
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0
}

export const pct = (x, d = 1) => (100 * x).toFixed(d) + ' %'
