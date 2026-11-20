// Numéros de téléphone portugais écrits comme au Portugal (neuf chiffres, « 912 345 678 », « 22 123 4567 »,
// avec ou sans l'indicatif 351) : le masquage commun (lib/ai/sanitize-context) ne reconnaît que la forme « +351 ».
// Masqués ici, pour ce module seulement : ailleurs, neuf chiffres peuvent être un SIREN qu'un agent doit lire.
// Les jetons ont la forme de ceux du masquage commun et se rétablissent avec lui (resolveSanitizedToken).

// Mobile : 91, 92, 93 ou 96, puis sept chiffres, groupés 3-3-3. Fixe : 2, puis huit chiffres, groupés 3-3-3 ou 2-3-4.
// Bornés : pas de chiffre juste avant ni juste après (une suite plus longue n'est pas un numéro).
const MOBILE_PT = /(?<!\d)(?:(?:\+|00)?351[\s.-]?)?9[1236]\d(?:[\s.-]?\d{3}){2}(?!\d)/g
const FIXE_PT_3_3_3 = /(?<!\d)(?:(?:\+|00)?351[\s.-]?)?2\d{2}(?:[\s.-]?\d{3}){2}(?!\d)/g
const FIXE_PT_2_3_4 = /(?<!\d)(?:(?:\+|00)?351[\s.-]?)?2\d[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g

// Une suite suivie d'une unité est une liste de mesures (« paredes de 250-300-280 cm »), pas un numéro : le modèle
// en a besoin pour répondre.
const SUIVIE_D_UNE_UNITE = /^\s?(?:mm|cm|km|m|ml|cl|lt|l|kg|g|m2|m3|m²|m³|€|%)(?![a-z0-9])/i

/** Remplace les numéros portugais du texte par des jetons, ajoutés à `tokenMap` (un même numéro, un même jeton). */
export function masquerTelephonesPortugais(texte: string, tokenMap: Map<string, string>): string {
  const jetonDe = new Map<string, string>()
  for (const [jeton, valeur] of tokenMap) jetonDe.set(valeur, jeton)
  const remplacer = (numero: string, position: number, texteEntier: string): string => {
    if (SUIVIE_D_UNE_UNITE.test(texteEntier.slice(position + numero.length))) return numero
    const connu = jetonDe.get(numero)
    if (connu) return connu
    let rang = tokenMap.size
    let jeton = `<phone:${(0x7e000000 + rang).toString(16)}>`
    while (tokenMap.has(jeton)) jeton = `<phone:${(0x7e000000 + ++rang).toString(16)}>`
    tokenMap.set(jeton, numero)
    jetonDe.set(numero, jeton)
    return jeton
  }
  return texte.replace(MOBILE_PT, remplacer).replace(FIXE_PT_3_3_3, remplacer).replace(FIXE_PT_2_3_4, remplacer)
}
