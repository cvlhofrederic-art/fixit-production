// Interprétation de robots.txt (groupe User-agent: *) selon la règle Google :
// la règle la plus longue (la plus spécifique) l'emporte ; à longueur égale,
// Allow gagne. `*` = n'importe quoi, `$` = fin de chemin.
export function lireRobots(texte) {
  const groupes = []
  let courant = null
  for (const brute of String(texte).split(/\r?\n/)) {
    const ligne = brute.replace(/#.*$/, '').trim()
    if (!ligne) continue
    const m = ligne.match(/^([a-z-]+)\s*:\s*(.*)$/i)
    if (!m) continue
    const cle = m[1].toLowerCase()
    const val = m[2].trim()
    if (cle === 'user-agent') {
      if (!courant || courant.regles.length) {
        courant = { agents: [], regles: [], sitemaps: [] }
        groupes.push(courant)
      }
      courant.agents.push(val.toLowerCase())
    } else if ((cle === 'allow' || cle === 'disallow') && courant) {
      courant.regles.push({ type: cle, motif: val })
    } else if (cle === 'sitemap') {
      if (!courant) {
        courant = { agents: ['*'], regles: [], sitemaps: [] }
        groupes.push(courant)
      }
      courant.sitemaps.push(val)
    }
  }
  return groupes
}

function motifEnRegex(motif) {
  let r = ''
  for (const ch of motif) {
    if (ch === '*') r += '.*'
    else if (ch === '$') r += '$'
    else r += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + r)
}

export function autorise(groupes, chemin, agent = '*') {
  const g = groupes.find((x) => x.agents.includes(agent.toLowerCase())) || groupes.find((x) => x.agents.includes('*'))
  if (!g) return true
  let meilleure = null
  for (const regle of g.regles) {
    if (!regle.motif) continue
    if (motifEnRegex(regle.motif).test(chemin)) {
      const plusLongue = !meilleure || regle.motif.length > meilleure.motif.length
      const egaleEtAllow = meilleure && regle.motif.length === meilleure.motif.length && regle.type === 'allow'
      if (plusLongue || egaleEtAllow) meilleure = regle
    }
  }
  return !meilleure || meilleure.type === 'allow'
}

/** Règles du groupe `*` qui ne concernent pas le périmètre PT (pour détecter une régression hors PT). */
export function reglesHorsPt(groupes) {
  const g = groupes.find((x) => x.agents.includes('*'))
  if (!g) return []
  return g.regles.filter((r) => !/pt|pesquisar|og/i.test(r.motif)).map((r) => r.type + ': ' + r.motif)
}
