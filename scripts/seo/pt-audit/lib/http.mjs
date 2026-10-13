// Client HTTP minimal pour l'audit SEO PT : fetch natif Node 20+, redirections
// non suivies (on veut voir le 3xx), nouvelle tentative sur erreur réseau,
// file d'attente à concurrence bornée. Aucune dépendance.

export const USER_AGENT = 'Mozilla/5.0 (compatible; vitfix-seo-audit/1.0; +https://vitfix.io/)'

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Requête sans suivre les redirections. Renvoie { status, headers, body, url, location }.
 * `body` n'est lu que si `lireCorps` est vrai (jamais pour HEAD).
 */
export async function requete(url, { methode = 'GET', lireCorps = true, delaiMs = 30000, tentatives = 3, enTetes = {} } = {}) {
  let derniereErreur
  for (let i = 1; i <= tentatives; i++) {
    const ctrl = new AbortController()
    const minuteur = setTimeout(() => ctrl.abort(), delaiMs)
    try {
      const rep = await fetch(url, {
        method: methode,
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xml,text/plain;q=0.9,*/*;q=0.8', ...enTetes },
      })
      const headers = {}
      rep.headers.forEach((v, k) => { headers[k.toLowerCase()] = v })
      let body = ''
      if (lireCorps && methode !== 'HEAD') body = await rep.text()
      return { status: rep.status, headers, body, url, location: headers.location || '' }
    } catch (e) {
      derniereErreur = e
      if (i < tentatives) await dormir(500 * i)
    } finally {
      clearTimeout(minuteur)
    }
  }
  return { status: 0, headers: {}, body: '', url, location: '', erreur: String((derniereErreur && derniereErreur.message) || derniereErreur) }
}

/** Suit les redirections à la main (max 10 sauts) et renvoie la chaîne complète. */
export async function suivre(url, options = {}) {
  const sauts = []
  let courant = url
  for (let i = 0; i < 10; i++) {
    const r = await requete(courant, { ...options, lireCorps: options.lireCorps ?? true })
    sauts.push({ url: courant, status: r.status, location: r.location })
    if (r.status >= 300 && r.status < 400 && r.location) {
      courant = new URL(r.location, courant).toString()
      continue
    }
    return { finale: courant, status: r.status, sauts, reponse: r }
  }
  return { finale: courant, status: 0, sauts, reponse: null, erreur: 'boucle de redirection' }
}

/** Exécute `taches` (fonctions renvoyant une promesse) avec au plus `n` en parallèle. */
export async function enParallele(taches, n = 8, surProgression) {
  const resultats = new Array(taches.length)
  let index = 0
  let faits = 0
  async function ouvrier() {
    while (index < taches.length) {
      const i = index++
      try {
        resultats[i] = await taches[i]()
      } catch (e) {
        resultats[i] = { erreur: String((e && e.message) || e) }
      }
      faits++
      if (surProgression) surProgression(faits, taches.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, taches.length) }, ouvrier))
  return resultats
}
