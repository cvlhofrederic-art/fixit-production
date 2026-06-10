// Helpers de formatage numérique FR partagés par les formulaires devis/facture
// (artisan V2 + BTP V3). Extraits à l'identique (corps strictement égal) des
// deux composants — audit 2026-06-10, Vague 4. Présentation pure : aucune
// logique métier, aucun état React → mutualisation sans impact RÈGLE #1
// (artisan vs BTP). Couple avec inputMode="decimal" + parseDecimalInput.

/** Quantité : "1", "1,5", '' si 0/null. (toString natif JS, virgule FR.) */
export const fmtQty = (n: number | null | undefined): string => {
  if (!n || !Number.isFinite(n)) return ''
  return n.toString().replace('.', ',')
}

/** Prix HT : 2 décimales, virgule FR, '' si 0. */
export const fmtN = (n: number | null | undefined): string => {
  if (!n || !Number.isFinite(n)) return ''
  return n.toFixed(2).replace('.', ',')
}

/** Prix unitaire : 4 décimales max (étude de prix), zéros traînants retirés
 *  (9.0909 → "9,0909", 9.09 → "9,09", 9.0 → "9"), '' si 0. */
export const fmtN4 = (n: number | null | undefined): string => {
  if (!n || !Number.isFinite(n)) return ''
  // Retrait des zéros décimaux traînants puis du point résiduel SANS regex :
  // `toFixed(4)` produit toujours "X.XXXX", on coupe la fin à la main. (Évite
  // un faux positif ReDoS Sonar ; l'entrée est de toute façon bornée.)
  const fixed = n.toFixed(4)
  let end = fixed.length
  while (end > 0 && fixed[end - 1] === '0') end--
  if (end > 0 && fixed[end - 1] === '.') end--
  return fixed.slice(0, end).replace('.', ',')
}
