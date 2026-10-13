// Graphe de liens internes : liens entrants par page et profondeur par
// parcours en largeur depuis /pt/.

/** pages : Map(chemin -> [chemins liés]). */
export function construireGraphe(pages) {
  const entrants = new Map()
  for (const [src, cibles] of pages) {
    for (const c of new Set(cibles)) {
      if (c === src) continue
      if (!entrants.has(c)) entrants.set(c, new Set())
      entrants.get(c).add(src)
    }
  }
  return { entrants }
}

export function profondeurs(pages, depart = '/pt/') {
  const prof = new Map([[depart, 0]])
  const file = [depart]
  let tete = 0
  while (tete < file.length) {
    const u = file[tete++]
    const d = prof.get(u)
    for (const c of new Set(pages.get(u) || [])) {
      if (!prof.has(c)) {
        prof.set(c, d + 1)
        file.push(c)
      }
    }
  }
  return prof
}
