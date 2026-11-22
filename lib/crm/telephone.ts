// ── CRM du secrétariat : numéros de téléphone ───────────────────────────────
// Module pur. Un numéro est rangé au format international E.164 (+351912345678) : c'est la clé qui relie un appel
// à la fiche du client, et le format qu'attend un lien wa.me.
//
// Saisie tolérée : espaces, points, tirets, parenthèses, barres ; préfixe 00 ; numéro national portugais (9 chiffres
// commençant par 2 ou 9) ou français (10 chiffres commençant par 0). Tout le reste est refusé (null) plutôt que deviné.

const SEPARATEURS = /[\s.\-()/]/g
const E164 = /^\+[1-9]\d{7,14}$/
// « (0) » écrit après l'indicatif (+33 (0)6…, +351 (0) 912…) : le 0 national ne fait pas partie du numéro international.
const ZERO_NATIONAL_ENTRE_PARENTHESES = /^((?:\+|00)\s?\d{1,3})\s?\(0\)/
// Portugal et France : exactement 9 chiffres après l'indicatif.
const LONGUEURS_PAR_INDICATIF: ReadonlyArray<readonly [string, number]> = [
  ['+351', 9],
  ['+33', 9],
]

function longueurValable(e164: string): boolean {
  const regle = LONGUEURS_PAR_INDICATIF.find(([indicatif]) => e164.startsWith(indicatif))
  return !regle || e164.length - regle[0].length === regle[1]
}

/** Numéro saisi → format E.164, ou null s'il n'est pas reconnu. */
export function normaliserTelephone(saisie: string | null | undefined): string | null {
  if (typeof saisie !== 'string') return null
  let brut = saisie.trim().replace(ZERO_NATIONAL_ENTRE_PARENTHESES, '$1').replace(SEPARATEURS, '')
  if (brut === '') return null
  if (brut.startsWith('00')) brut = `+${brut.slice(2)}`
  if (brut.startsWith('+')) return E164.test(brut) && longueurValable(brut) ? brut : null
  if (!/^\d+$/.test(brut)) return null
  if (brut.length === 9 && (brut.startsWith('9') || brut.startsWith('2'))) return `+351${brut}`
  if (brut.length === 10 && brut.startsWith('0') && brut[1] !== '0') return `+33${brut.slice(1)}`
  return null
}

/** Affichage lisible d'un numéro E.164 (Portugal et France groupés, autres pays tels quels). */
export function formaterTelephone(e164: string | null | undefined): string {
  if (!e164) return ''
  if (/^\+351\d{9}$/.test(e164)) {
    const n = e164.slice(4)
    return `+351 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }
  if (/^\+33\d{9}$/.test(e164)) {
    const n = e164.slice(3)
    return `+33 ${n[0]} ${n.slice(1, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`
  }
  return e164
}

/** Lien qui ouvre la conversation WhatsApp du numéro (application WhatsApp du poste ou du téléphone), ou null. */
export function lienWhatsApp(e164: string | null | undefined): string | null {
  if (!e164 || !E164.test(e164)) return null
  return `https://wa.me/${e164.slice(1)}`
}

/** Lien d'appel classique (tel:), ou null. */
export function lienAppel(e164: string | null | undefined): string | null {
  if (!e164 || !E164.test(e164)) return null
  return `tel:${e164}`
}
