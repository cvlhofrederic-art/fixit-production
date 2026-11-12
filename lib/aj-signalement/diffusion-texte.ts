// ── AJ Signalement — diffusion : contrôle du texte, garantie technique « pas de promotion » (PR 3, lot 2) ──────────
//
// Cahier PR 3 § 5.3, décision H2 de Hugo (11/11/2026). Un message de diffusion ne parle que de l'exploitation de
// l'immeuble (fuite, coupure, intervention) : jamais de prospection, de publicité ni d'offre (droit § 2, J13). Fonction
// pure, appelée par la route ET par l'écran (message immédiat sous le champ), sur l'objet, le texte et le libellé d'un
// bâtiment ou d'un étage venu d'une saisie libre du formulaire public (§ 3.6). Refusés :
//   - lien : schémas (http:, https:, ftp:, mailto:, tel:…, tout « :// »), « www. », et tout nom de domaine « mot.tld »
//     dont le domaine de premier niveau est dans la liste COMPLÈTE de l'IANA (tld-iana.ts), y compris écrit en pleine
//     chasse ou avec un point idéographique (« 。 », que les navigateurs prennent pour un point) ;
//   - adresse_email : tout « @ » ;
//   - caractere : catégories Unicode Cc (contrôles C0 et C1), Cf (invisibles de format), Zl et Zp, demi-paires (Cs) et
//     autres points de code « ignorables par défaut » (remplissages invisibles) ; le texte garde seulement « \n » ;
//     un libellé de bâtiment ou d'étage n'a que lettres, chiffres et ponctuation simple ;
//   - a_completer : un champ de modèle « […] » non rempli ;
//   - telephone : un numéro (6 chiffres ou plus, séparateurs permis) qui n'est pas un des numéros déclarés par le
//     cabinet (H2) ; dates et heures ne sont pas des numéros ;
//   - terme_commercial : liste fermée H2, mots entiers, sans casse ni accents (dont « VitFix », « offre », « devis ») ;
//   - longueur, lignes : objet 3 à 120 caractères, texte 10 à 2 000 caractères et 30 lignes, libellé 1 à 50.
// La détection se fait sur une forme NFKC, en minuscules, sans accents ni invisibles, chiffres ramenés à 0-9. La liste
// de termes est un garde-fou, pas une garantie : le contenu reste de la responsabilité du cabinet qui compose (droit § 7).

import { TLD_IANA, TLD_IANA_UNICODE } from '@/lib/aj-signalement/tld-iana'

export type NatureTexteDiffusionQr = 'objet' | 'texte' | 'libelle'

export type MotifRefusTexteDiffusionQr =
  | 'lien' | 'adresse_email' | 'caractere' | 'a_completer' | 'telephone' | 'terme_commercial' | 'longueur' | 'lignes'

/** Conseil joint au refus d'un nom de domaine : « demain.Total » est un domaine, « demain. Total » n'en est pas un. */
export type ConseilTexteDiffusionQr = 'espace_apres_point'

export type ControleTexteDiffusionQr =
  | { ok: true; texte: string }
  | { ok: false; motif: MotifRefusTexteDiffusionQr; conseil?: ConseilTexteDiffusionQr }

export interface OptionsControleTexteDiffusionQr {
  /** Objet, texte ou libellé (bâtiment, étage) : les bornes et les caractères permis en dépendent. Défaut : texte. */
  nature?: NatureTexteDiffusionQr
  /** Numéros déclarés par le cabinet (signalements_qr_cabinets.diffusion_telephones), sous n'importe quelle écriture. */
  telephonesAutorises?: readonly string[]
}

/** Bornes du cahier (§ 5.3), comptées en caractères (points de code), comme char_length en base. */
export const BORNES_TEXTE_DIFFUSION_QR = {
  objet: { min: 3, max: 120, lignes: 1 },
  texte: { min: 10, max: 2000, lignes: 30 },
  libelle: { min: 1, max: 50, lignes: 1 },
} as const satisfies Record<NatureTexteDiffusionQr, { min: number; max: number; lignes: number }>

// ── Caractères ──

// Cc, Cf, Zl, Zp, Cs, et les autres « ignorables par défaut » (U+034F, U+115F, U+1160, U+3164, U+FFA0, U+180B…), sauf
// les sélecteurs de variante U+FE0E et U+FE0F, qui ne servent qu'à l'affichage des émojis.
const INVISIBLES = String.raw`[\p{Cf}\p{Cs}]|(?![\uFE0E\uFE0F])\p{Default_Ignorable_Code_Point}`
const INTERDITS_LIGNE = new RegExp(String.raw`[\p{Cc}\p{Zl}\p{Zp}]|${INVISIBLES}`, 'u')
const INTERDITS_TEXTE = new RegExp(String.raw`(?!\n)[\p{Cc}\p{Zl}\p{Zp}]|${INVISIBLES}`, 'u')
// Libellé (nom de bâtiment ou d'étage écrit dans l'e-mail) : lettres, chiffres, espace et ponctuation simple.
const PERMIS_LIBELLE = /^[\p{L}\p{M}\p{N} .,'’()/&°ºª-]+$/u
const RETIRES_NETTOYAGE = new RegExp(INVISIBLES, 'gu')

/**
 * Une ligne lisible : NFC, contrôles et séparateurs de ligne remplacés par une espace, invisibles retirés, espaces
 * réduites, coupée à `max` caractères si demandé. Sert au libellé d'un bâtiment saisi et au nom d'un cabinet.
 */
export function nettoyerLigneDiffusionQr(saisie: string, max?: number): string {
  const propre = saisie.normalize('NFC')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(RETIRES_NETTOYAGE, '')
    .replace(/\s+/g, ' ')
    .trim()
  return max === undefined ? propre : Array.from(propre).slice(0, max).join('').trim()
}

// ── Forme de détection ──

// Points que les navigateurs prennent pour un point dans un nom de domaine (UTS 46) : après NFKC, seul U+3002 reste.
const POINTS_ASSIMILES = /[\u3002\uFE12\uFE52\uFF0E\uFF61\u2024]/g
const TIRETS = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g
const CHIFFRE_UNICODE = /\p{Nd}/u

/**
 * Chiffre décimal d'une autre écriture (arabe, devanagari…) → 0-9. Unicode garantit que les chiffres décimaux sont
 * assignés par suites de dix points de code consécutifs, de 0 à 9 : la place dans la suite donne la valeur.
 */
function chiffreAscii(chiffre: string): string {
  const point = chiffre.codePointAt(0) ?? 0
  let debut = point
  while (debut > 0 && CHIFFRE_UNICODE.test(String.fromCodePoint(debut - 1))) debut -= 1
  return String((point - debut) % 10)
}

/** NFKC, points et tirets ramenés à « . » et « - », invisibles retirés, chiffres en 0-9, minuscules (accents gardés). */
function formeMinuscule(texte: string): string {
  return texte.normalize('NFKC')
    .replace(POINTS_ASSIMILES, '.')
    .replace(TIRETS, '-')
    .replace(/\p{Default_Ignorable_Code_Point}/gu, '')
    .replace(/(?![0-9])\p{Nd}/gu, chiffreAscii)
    .toLowerCase()
}

/** Forme de détection : formeMinuscule sans accents ni autres marques combinantes. */
function formeDetection(texte: string): string {
  return formeMinuscule(texte).normalize('NFD').replace(/\p{M}/gu, '')
}

// ── Liens ──

const TLD = new Set<string>([...TLD_IANA, ...Object.values(TLD_IANA_UNICODE).map(formeDetection)])

/** Le libellé est-il un domaine de premier niveau de la liste de l'IANA (forme ASCII ou Unicode, sans casse) ? */
export function estTldIanaQr(libelle: string): boolean {
  return TLD.has(formeDetection(libelle))
}

const SCHEMA_DOUBLE_BARRE = /(?<![a-z0-9+.-])[a-z][a-z0-9+.-]*:\/\//
const SCHEMAS = /(?<![\p{L}\p{N}])(?:https?|ftp|file|data|javascript|vbscript):/u
// Schémas sans « // » : refusés quand ils sont collés à leur valeur (« tel:0612… »), jamais « Tél : 06 … ».
const SCHEMAS_COLLES = /(?<![\p{L}\p{N}])(?:mailto|tel|sms|callto|skype|whatsapp|viber|facetime|tg|geo):(?=\S)/u
const WWW = /(?<![\p{L}\p{N}])www\./u
// Suite de libellés séparés par des points, commencée au début d'un mot (séparateur obligatoire entre deux
// répétitions : coût linéaire, pas de retour arrière coûteux).
const HOTE = /(?<![\p{L}\p{N}-])[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu

function contientDomaine(detection: string): boolean {
  for (const hote of detection.match(HOTE) ?? []) {
    // Tout libellé qui suit un point et qui est un domaine de premier niveau : « exemple.fr », « exemple.fr.Merci ».
    const libelles = hote.split('.').slice(1).map((l) => l.replace(/^-+|-+$/g, ''))
    if (libelles.some((l) => l !== '' && TLD.has(l))) return true
  }
  return false
}

function controlerLiens(minuscule: string, detection: string): ControleTexteDiffusionQr | null {
  if (SCHEMA_DOUBLE_BARRE.test(detection) || SCHEMAS.test(minuscule) || SCHEMAS_COLLES.test(minuscule) || WWW.test(detection)) {
    return { ok: false, motif: 'lien' }
  }
  if (contientDomaine(detection)) return { ok: false, motif: 'lien', conseil: 'espace_apres_point' }
  return null
}

// ── Numéros de téléphone ──

/**
 * Forme comparable d'un numéro (chiffres seuls) : indicatif « 00 » retiré ; numéro français (0 + 9 chiffres) ou
 * portugais (9 chiffres commençant par 2 ou 9) ramené à sa forme internationale, pour que « 06 12 34 56 78 »,
 * « +33 6 12 34 56 78 » et « 0033 6 12 34 56 78 » soient le même numéro.
 */
function formeComparableTelephone(chiffres: string): string {
  const numero = chiffres.startsWith('00') ? chiffres.slice(2) : chiffres
  if (/^0[1-9]\d{8}$/.test(numero)) return `33${numero.slice(1)}`
  if (/^[29]\d{8}$/.test(numero)) return `351${numero}`
  return numero
}

const ZERO_ENTRE_PARENTHESES = / ?\(0\) ?/g

/**
 * Numéro saisi à l'activation du cabinet → forme gardée en base (chiffres seuls, 6 à 15, indicatif « 00 » retiré,
 * « (0) » ignoré) : « +33 6 12 34 56 78 » → « 33612345678 », « 06 12 34 56 78 » → « 0612345678 ». Toute autre
 * écriture (lettres, deux numéros) → null.
 */
export function normaliserTelephoneDeclareQr(saisie: string): string | null {
  const propre = saisie.normalize('NFKC').trim().replace(ZERO_ENTRE_PARENTHESES, ' ')
  if (!/^\+?[\d .-]+$/.test(propre)) return null
  const chiffres = propre.replace(/\D/g, '')
  const numero = chiffres.startsWith('00') ? chiffres.slice(2) : chiffres
  return /^\d{6,15}$/.test(numero) ? numero : null
}

// Suites de chiffres séparées par une espace, un point ou un tiret (un seul séparateur entre deux groupes).
const CANDIDAT_TELEPHONE = /\+?\d+(?:[ .-]\d+)*/g
// Dates (12.11.2026, 12-11-26, 2026-11-12), heures (10.30) et années (2026-2027) ne sont pas des numéros, seules
// ou enchaînées par une espace ou un tiret (« 12.11.2026 10.30 »).
const JOUR = String.raw`(?:0?[1-9]|[12]\d|3[01])`
const MOIS = String.raw`(?:0?[1-9]|1[0-2])`
const ANNEE = String.raw`(?:20\d{2}|\d{2})`
const ELEMENT_DATE = [
  String.raw`${JOUR}\.${MOIS}\.${ANNEE}`, `${JOUR}-${MOIS}-${ANNEE}`, String.raw`20\d{2}-${MOIS}-${JOUR}`,
  String.raw`(?:[01]?\d|2[0-3])\.[0-5]\d`, String.raw`(?:19|20)\d{2}-(?:19|20)\d{2}`,
].join('|')
const DATES_ET_HEURES = new RegExp(`^(?:${ELEMENT_DATE})(?:[ -](?:${ELEMENT_DATE}))*$`)

interface GroupeChiffres {
  chiffres: string
  debut: number
  fin: number
}

/** Groupes couverts par un numéro déclaré (« 06 12 34 56 78 » dans « 06 12 34 56 78 24 h sur 24 »). */
function groupesDeclares(groupes: readonly GroupeChiffres[], declares: ReadonlySet<string>): boolean[] {
  const couverts = groupes.map(() => false)
  for (let i = 0; i < groupes.length; i += 1) {
    let chiffres = ''
    for (let j = i; j < groupes.length && chiffres.length <= 15; j += 1) {
      chiffres += groupes[j].chiffres
      if (chiffres.length >= 6 && declares.has(formeComparableTelephone(chiffres))) couverts.fill(true, i, j + 1)
    }
  }
  return couverts
}

/**
 * Une suite de chiffres contient-elle un numéro non déclaré ? Les groupes couverts par un numéro déclaré sont mis à
 * part ; chaque reste de 6 chiffres ou plus qui n'est pas une date ou une heure est un numéro non déclaré.
 */
function contientNumeroNonDeclare(candidat: string, declares: ReadonlySet<string>): boolean {
  const groupes: GroupeChiffres[] = Array.from(candidat.matchAll(/\d+/g), (m) => {
    const debut = m.index ?? 0
    return { chiffres: m[0], debut, fin: debut + m[0].length }
  })
  const couverts = groupesDeclares(groupes, declares)
  let i = 0
  while (i < groupes.length) {
    if (couverts[i]) {
      i += 1
      continue
    }
    let j = i
    while (j + 1 < groupes.length && !couverts[j + 1]) j += 1
    const reste = candidat.slice(groupes[i].debut, groupes[j].fin)
    if (reste.replace(/\D/g, '').length >= 6 && !DATES_ET_HEURES.test(reste)) return true
    i = j + 1
  }
  return false
}

function contientTelephoneNonDeclare(detection: string, autorises: readonly string[]): boolean {
  // Liste relue en base : un élément qui ne serait pas une chaîne (NULL) est ignoré, jamais une exception (la contrainte
  // signalements_qr_cabinets_diffusion_telephones_format le refuse aussi).
  const declares = new Set(autorises.filter((t): t is string => typeof t === 'string')
    .map((t) => formeComparableTelephone(t.replace(/\D/g, ''))))
  const candidats = detection.replace(ZERO_ENTRE_PARENTHESES, ' ').match(CANDIDAT_TELEPHONE) ?? []
  return candidats.some((candidat) => contientNumeroNonDeclare(candidat, declares))
}

// ── Termes commerciaux (liste fermée H2, sans accents) ──

const TERMES_COMMERCIAUX = [
  // français
  'promo', 'promos', 'promotion', 'promotions', 'reduction', 'reductions', 'gratuit', 'gratuite', 'gratuits', 'gratuites',
  'tarif', 'tarifs', 'abonnement', 'abonnements', 'parrainage', 'decouvrez', 'profitez', 'bon plan', 'bons plans', 'soldes',
  'euro', 'euros', 'vitfix', 'offre', 'offres', 'devis', 'payant', 'payante', 'payants', 'payantes', 'nos services',
  'nos offres', 'partenaire', 'partenaires', 'code promo',
  // portugais
  'promocao', 'promocoes', 'desconto', 'descontos', 'gratis', 'tarifa', 'tarifas', 'assinatura', 'assinaturas',
  'aproveite', 'descubra', 'oferta', 'ofertas', 'orcamento', 'orcamentos', 'pago', 'paga', 'os nossos servicos',
  'parceiro', 'parceiros',
] as const
const TERMES = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:${TERMES_COMMERCIAUX.map((t) => t.replace(/ /g, String.raw`\s+`)).join('|')})(?![\p{L}\p{N}])`,
  'u',
)
// « € » et une remise en pourcentage (« -30 % », « −30% »).
const PRIX = /€|(?<![\p{L}\p{N}])-\s?\d+(?:[.,]\d+)?\s?%/u

// ── Contrôle ──

const refus = (motif: MotifRefusTexteDiffusionQr): ControleTexteDiffusionQr => ({ ok: false, motif })

/**
 * Contrôle d'un objet, d'un texte ou d'un libellé de diffusion. Rend la forme gardée (retours « \n », NFC, sans blancs
 * de tête ni de fin) ou le premier motif de refus.
 */
export function controlerTexteDiffusionQr(saisie: string, options: OptionsControleTexteDiffusionQr = {}): ControleTexteDiffusionQr {
  const nature = options.nature ?? 'texte'
  const bornes = BORNES_TEXTE_DIFFUSION_QR[nature]
  const brut = saisie.replace(/\r\n?/g, '\n')
  // Avant de rogner : trim() retirerait sans bruit U+FEFF ou U+2028 en tête ou en fin.
  if ((nature === 'texte' ? INTERDITS_TEXTE : INTERDITS_LIGNE).test(brut)) return refus('caractere')
  const texte = brut.normalize('NFC').trim()
  if (nature === 'libelle' && !PERMIS_LIBELLE.test(texte)) return refus('caractere')
  const longueur = Array.from(texte).length
  if (longueur < bornes.min || longueur > bornes.max) return refus('longueur')
  if (texte.split('\n').length > bornes.lignes) return refus('lignes')

  const minuscule = formeMinuscule(texte)
  const detection = formeDetection(texte)
  if (/\[[^\]\n]*\]/.test(detection)) return refus('a_completer')
  const lien = controlerLiens(minuscule, detection)
  if (lien) return lien
  if (detection.includes('@')) return refus('adresse_email')
  if (contientTelephoneNonDeclare(detection, options.telephonesAutorises ?? [])) return refus('telephone')
  if (TERMES.test(detection) || PRIX.test(detection)) return refus('terme_commercial')
  return { ok: true, texte }
}
