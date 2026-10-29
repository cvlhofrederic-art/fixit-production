/**
 * Arrondi au centime par la méthode des plus forts restes, en arithmétique ENTIÈRE EXACTE : produits et restes en BigInt,
 * sans virgule flottante ni dépassement des entiers sûrs (deux restes égaux sont vraiment égaux, même pour un montant de
 * plusieurs millions d'euros réparti sur des poids en centimes). Partagé par la répartition des appels, l'imputation des
 * encaissements et les appels de cotisation au fonds de travaux.
 */

/**
 * Répartit `montant` (centimes entiers ≥ 0) proportionnellement à des poids entiers ≥ 0, de total > 0 : part =
 * ⌊montant × poids / total⌋, puis un centime à chacun des plus forts restes, départage par l'ordre reçu. La somme des
 * parts égale exactement le montant.
 */
export function repartirAuxPlusFortsRestes(montant: number, poids: number[]): number[] {
  if (!Number.isSafeInteger(montant) || montant < 0)
    throw new Error(`Montant à répartir invalide (${montant}) : centimes entiers positifs ou nuls attendus.`)
  for (const p of poids)
    if (!Number.isSafeInteger(p) || p < 0) throw new Error(`Poids de répartition invalide (${p}) : entier positif ou nul attendu.`)
  const total = poids.reduce((somme, p) => somme + p, 0)
  if (total <= 0) throw new Error('Répartition impossible : total des poids nul.')
  const totalExact = BigInt(total)
  const montantExact = BigInt(montant)
  const bruts = poids.map((p, rang) => {
    const produit = montantExact * BigInt(p)
    const reste = produit % totalExact
    return { rang, part: Number((produit - reste) / totalExact), reste }
  })
  let aDistribuer = montant - bruts.reduce((somme, b) => somme + b.part, 0)
  for (const b of [...bruts].sort((x, y) => (y.reste > x.reste ? 1 : y.reste < x.reste ? -1 : x.rang - y.rang))) {
    if (aDistribuer === 0) break
    b.part += 1
    aDistribuer -= 1
  }
  return bruts.map((b) => b.part)
}
