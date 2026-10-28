/**
 * Arrondi au centime par la méthode des plus forts restes, en arithmétique ENTIÈRE (pas de reste en virgule flottante :
 * deux restes égaux sont vraiment égaux). Partagé par la répartition des appels et l'imputation des encaissements.
 */

/**
 * Répartit `montant` (centimes entiers ≥ 0) proportionnellement à des poids entiers > 0 : part = ⌊montant × poids /
 * total⌋, puis un centime à chacun des plus forts restes, départage par l'ordre reçu. La somme des parts égale exactement
 * le montant.
 */
export function repartirAuxPlusFortsRestes(montant: number, poids: number[]): number[] {
  const total = poids.reduce((somme, p) => somme + p, 0)
  if (total <= 0) throw new Error('Répartition impossible : total des poids nul.')
  const bruts = poids.map((p, rang) => {
    const produit = montant * p
    const reste = produit % total
    return { rang, part: (produit - reste) / total, reste }
  })
  let aDistribuer = montant - bruts.reduce((somme, b) => somme + b.part, 0)
  for (const b of [...bruts].sort((x, y) => y.reste - x.reste || x.rang - y.rang)) {
    if (aDistribuer === 0) break
    b.part += 1
    aDistribuer -= 1
  }
  return bruts.map((b) => b.part)
}
