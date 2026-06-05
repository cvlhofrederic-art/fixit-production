// ═══════════════════════════════════════════════
// HELPERS for DevisFactureForm
// Extracted from components/DevisFactureForm.tsx
// ═══════════════════════════════════════════════

import type { ProductLine } from '@/lib/devis-types'
import { UNITE_VALUES } from '@/lib/devis-types'
import type { Locale } from '@/lib/i18n/config'

/**
 * Identité STABLE d'un document (UUID v4). Générée une seule fois à la création
 * d'un devis/facture, immuable de brouillon → émis. Sert de clé d'upsert serveur
 * (onConflict='id', cf. app/api/devis/sync/route.ts) ET de clé localStorage.
 * Le format DOIT être un UUID valide (le schéma Zod `devisSyncSchema` le valide),
 * y compris le fallback pour les WebViews Capacitor anciens sans crypto.randomUUID.
 * Conséquence : un brouillon n'a PAS de numéro (numéro légal tiré de
 * next_doc_number UNIQUEMENT à la validation) et deux brouillons ne peuvent
 * jamais s'écraser via un numéro réémis.
 */
export function stableDocId(): string {
  // WebCrypto uniquement (PRNG fort) : crypto.randomUUID en priorité, sinon
  // construction d'un UUID v4 via crypto.getRandomValues (dispo bien plus
  // largement, y compris WebViews Capacitor anciens). Aucun Math.random.
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const b = crypto.getRandomValues(new Uint8Array(16))
      b[6] = (b[6] & 0x0f) | 0x40 // version 4
      b[8] = (b[8] & 0x3f) | 0x80 // variant RFC 4122
      const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'))
      return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`
    }
  } catch { /* environnement sans WebCrypto (très improbable) : fallback ci-dessous */ }
  // Dernier recours : horodatage + compteur de module (unicité intra-session).
  // Pas de Math.random (PRNG faible). Cas quasi-mort : tout WebView cible a WebCrypto.
  _idFallbackCounter = (_idFallbackCounter + 1) % 0xffffff
  const t = Date.now().toString(16).padStart(12, '0').slice(-12)
  const c = _idFallbackCounter.toString(16).padStart(6, '0')
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-4${c.slice(0, 3)}-8${c.slice(3, 6)}-${t.slice(0, 8)}${c.slice(0, 4)}`
}
let _idFallbackCounter = 0

/**
 * Vrai si `id` est un identifiant de document CANONIQUE — un UUID, tel que
 * généré par stableDocId(). Les documents LEGACY (créés avant la refonte
 * stableDocId) portent un `id` horodaté `Date.now()` (ex "1779539827817") ou
 * vide : ce ne sont PAS des id canoniques et doivent être identifiés par leur
 * `docNumber` côté sync.
 *
 * /api/devis/sync s'en sert pour (a) choisir la clé d'upsert — UUID →
 * onConflict='id', sinon → numero — et (b) ne JAMAIS écrire une valeur non-UUID
 * dans la colonne `uuid` de la DB (sinon Postgres 22P02). Sans ce garde, le
 * schéma Zod `devisSyncSchema` rejetait ces id legacy → sync de TOUS les docs
 * legacy refusée côté client (« Document invalide — sync refusée :
 * doc.id: id doit être un UUID valide »).
 *
 * Regex UUID générique 8-4-4-4-12 (toutes versions) : couvre crypto.randomUUID
 * (v4) ET le fallback v4 de stableDocId, et correspond à ce que le type `uuid`
 * PostgreSQL accepte.
 */
export function isStableDocId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
}

/**
 * Clé d'identité d'un document pour dédup / match / suppression côté UI :
 * `id` stable en priorité (un brouillon n'a PAS de numéro), fallback `docNumber`
 * pour les docs legacy sans id. Chaîne vide seulement si aucun des deux (ne
 * devrait pas arriver : tout doc créé après la refonte porte un id stable).
 */
export function docIdentityKey(
  d: { id?: string | null; docNumber?: string | null } | null | undefined,
): string {
  return (d?.id as string) || (d?.docNumber as string) || ''
}

/**
 * Fusionne deux listes de documents par identité stable (docIdentityKey) :
 * `incoming` prime sur `existing` à clé égale, l'ordre de `existing` est
 * préservé, et les entrées de `incoming` absentes sont ajoutées. Les docs sans
 * identité ne sont jamais fusionnés (clé de repli unique). Mutualise la dédup
 * du merge cloud (dashboard) ET du refresh localStorage des listes V5.
 */
export function dedupeDocsByIdentity<T>(existing: T[], incoming: T[]): T[] {
  const byKey = new Map<string, T>()
  let noId = 0
  const keyOf = (d: T): string =>
    docIdentityKey(d as { id?: string | null; docNumber?: string | null }) || `__noid_${noId++}`
  for (const d of existing) byKey.set(keyOf(d), d)
  for (const d of incoming) byKey.set(keyOf(d), d)
  return Array.from(byKey.values())
}

/**
 * Extrait un entier comparable depuis un docNumber type "DEV-2026-003" ou "FACT-2026-012".
 * Permet le tri "du plus récent émis au plus ancien émis" basé sur le numéro de séquence
 * (et non sur created_at, qui peut être trompé par un document recréé tardivement).
 *
 * Les docs sans numéro valide (brouillons "BR-1779..." ou autres) reçoivent MAX_SAFE_INTEGER
 * et apparaissent en tête d'une liste triée descendante (action requise).
 */
export const getDocSeq = (doc: { docNumber?: string }): number => {
  const m = (doc.docNumber || '').match(/-(\d{4})-(\d+)$/)
  if (!m) return Number.MAX_SAFE_INTEGER
  return parseInt(m[1], 10) * 1000000 + parseInt(m[2], 10)
}

/**
 * Horodatage de récence d'un document (ms epoch) pour le tri « du plus récent au
 * plus ancien ». Basé sur l'émission réelle : sentAt → savedAt → docDate.
 *
 * À utiliser à la place de getDocSeq pour TRIER quand des séries indépendantes
 * coexistent : AC- (acomptes) a son propre compteur repartant à 1, donc comparer
 * la séquence AC-2026-002 (2) à FACT-2026-017 (17) est faux — l'acompte récent
 * se retrouvait en bas de liste. getDocSeq reste utile en départage (même date).
 */
export const getDocTime = (doc: { sentAt?: string; savedAt?: string; docDate?: string }): number => {
  const ts = doc.sentAt || doc.savedAt || doc.docDate || ''
  const t = ts ? Date.parse(ts) : NaN
  return Number.isFinite(t) ? t : 0
}

/** Convertit la valeur stockée en affichage PDF lisible (m2→m², m3→m³) */
export const formatUnitForPdf = (unit: string, customUnit?: string): string => {
  if (unit === 'autre') return customUnit || 'u'
  if (unit === 'm2' || unit === 'm²') return 'm²'
  if (unit === 'm3' || unit === 'm³') return 'm³'
  return unit || 'u'
}

/** Résout l'unité effective d'une ligne (gère 'autre' + rétrocompat anciens formats) */
export const resolveLineUnit = (line: ProductLine): string => {
  if (line.unit === 'autre') return line.customUnit || 'u'
  return line.unit || 'u'
}

/** Pour le select : si la valeur existante n'est pas dans la liste, traiter comme 'autre' */
export const getSelectValue = (line: ProductLine): string => {
  const legacyMap: Record<string, string> = {
    'm²': 'm2', 'm³': 'm3', 'forfait': 'f', 'tonne': 't',
  }
  const mapped = legacyMap[line.unit] || line.unit
  if (UNITE_VALUES.has(mapped)) return mapped
  return 'autre'
}

/**
 * Normalise un nom (personne ou entreprise) ALL CAPS en Title Case lisible.
 * Cas typique : data SIRENE qui renvoie "FREDERIC NEIVA CARVALHO" → "Frédéric Neiva Carvalho".
 * (Les accents ne peuvent pas être restaurés à partir d'une chaîne sans accents : voir
 *  `restoreCommonAccents` ci-dessous pour les substitutions sûres FR/PT.)
 *
 * Préserve les acronymes courts (≤ 3 caractères : "JCB", "JF", "SAS", "EURL"…).
 * Conserve la casse si la chaîne n'est PAS toute en majuscules (déjà bien formatée).
 */
export function titleCaseName(name: string): string {
  if (!name) return name
  // Si déjà mixte (pas tout en majuscules) → on ne touche pas
  if (name !== name.toUpperCase()) return name
  const lowerWords = new Set(['de', 'da', 'do', 'du', 'des', 'le', 'la', 'les', 'l', 'el', 'en', 'et', 'au', 'aux', 'sur', 'von', 'van'])
  const keepUpper = new Set(['SARL', 'EURL', 'SAS', 'SASU', 'SA', 'SCI', 'SCM', 'EI', 'AE', 'EI/AE', 'LDA', 'SA.', 'BTP', 'TP', 'JC', 'JCB', 'JF', 'JM', 'JP', 'JL'])
  return name.split(/(\s+|-|,\s*)/g).map((part, idx) => {
    const t = part.trim()
    if (!t || /^[\s,-]+$/.test(part)) return part
    // Acronymes courts (≤3 lettres) ou listés → garder UPPER
    if (keepUpper.has(t) || (t.length <= 2 && /^[A-Z]+$/.test(t))) return t
    const lo = t.toLowerCase()
    if (idx > 0 && lowerWords.has(lo)) return lo
    return restoreCommonAccents(lo.charAt(0).toUpperCase() + lo.slice(1))
  }).join('')
}

/**
 * Restaure quelques accents FR/PT courants pour les prénoms et villes.
 * Ne couvre pas tous les cas — c'est un best-effort sur les noms les plus fréquents.
 * Préfère extension à la liste plutôt que dictionnaire complet (perf + simplicité).
 */
function restoreCommonAccents(s: string): string {
  const map: Record<string, string> = {
    'Frederic': 'Frédéric', 'Frederique': 'Frédérique', 'Stephane': 'Stéphane', 'Stephanie': 'Stéphanie',
    'Helene': 'Hélène', 'Andre': 'André', 'Andrea': 'Andrea', 'Cedric': 'Cédric', 'Jerome': 'Jérôme',
    'Jeremie': 'Jérémie', 'Jeremy': 'Jérémy', 'Mathieu': 'Mathieu', 'Matheo': 'Mathéo',
    'Theo': 'Théo', 'Theodore': 'Théodore', 'Therese': 'Thérèse', 'Sebastien': 'Sébastien',
    'Bartelemy': 'Barthélémy', 'Genevieve': 'Geneviève', 'Eleonore': 'Éléonore', 'Edouard': 'Édouard',
    'Eric': 'Éric', 'Elise': 'Élise', 'Elodie': 'Élodie', 'Emile': 'Émile', 'Emilie': 'Émilie',
    'Emmanuelle': 'Emmanuelle', 'Etienne': 'Étienne',
    // Villes FR courantes
    'Marseille': 'Marseille', 'Lyon': 'Lyon', 'Bedoule': 'Bédoule',
    // PT courants
    'Joao': 'João', 'Antonio': 'António', 'Joaquim': 'Joaquim', 'Sao': 'São',
  }
  return map[s] || s
}

/** Normalise une adresse ALL CAPS (API BAN) en Title Case */
export function titleCaseAddress(addr: string): string {
  if (!addr) return addr
  if (addr !== addr.toUpperCase()) return addr
  const lowerWords = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'l', 'en', 'et', 'au', 'aux', 'sur'])
  const abbrMap: Record<string, string> = {
    'RES': 'Rés.', 'RESIDENCE': 'Résidence', 'BAT': 'Bât.', 'BATIMENT': 'Bâtiment',
    'AV': 'Av.', 'AVENUE': 'Avenue', 'BD': 'Bd', 'BOULEVARD': 'Boulevard',
    'RUE': 'Rue', 'IMPASSE': 'Impasse', 'ALLEE': 'Allée', 'CHEMIN': 'Chemin',
    'PLACE': 'Place', 'ROUTE': 'Route', 'COURS': 'Cours', 'CEDEX': 'Cedex',
  }
  // Capitalise un mot simple (ex: "EGLISE" → "Eglise"). Préserve l'accent si présent.
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  // Capitalise un mot composé avec tirets (ex: "AIX-EN-PROVENCE" → "Aix-en-Provence")
  // Les particules courantes (en, sur, le, la, ...) restent en minuscules à l'intérieur.
  const capitalizeHyphenated = (s: string) => s.split('-').map((seg, i) => {
    if (!seg) return seg
    const lo = seg.toLowerCase()
    if (i > 0 && lowerWords.has(lo)) return lo
    return capitalize(seg)
  }).join('-')
  return addr.split(/(\s+|,\s*)/g).map((part, idx) => {
    const t = part.trim()
    if (!t || /^[\s,]+$/.test(part)) return part
    if (/^\d{5}$/.test(t)) return t
    if (abbrMap[t]) return abbrMap[t]
    // Particule avec apostrophe : L'…, D' (typographique ' ou droite '). La particule
    // en minuscule, le mot qui suit capitalisé. Ex: "L'ÉGLISE" → "l'Église", "D'AIX" → "d'Aix".
    const apoMatch = t.match(/^([LD])(['’])(.+)$/i)
    if (apoMatch) {
      const [, particle, , rest] = apoMatch
      return `${particle.toLowerCase()}’${capitalizeHyphenated(rest)}`
    }
    const lo = t.toLowerCase()
    if (idx > 0 && lowerWords.has(lo)) return lo
    // Mots composés avec tirets (Aix-en-Provence, Saint-Étienne)
    if (t.includes('-')) return capitalizeHyphenated(t)
    return capitalize(t)
  }).join('')
}

/** Map official legal form labels from API to internal codes */
export function mapLegalFormToCode(legalForm: string): string {
  if (!legalForm) return 'ei'
  const lower = legalForm.toLowerCase()
  if (lower.includes('auto-entrepreneur') || lower.includes('micro-entrepreneur')) return 'ae'
  if (lower.includes('sarl') && !lower.includes('eurl')) return 'sarl'
  if (lower.includes('eurl')) return 'eurl'
  if (lower.includes('sas') && !lower.includes('sasu')) return 'sas'
  if (lower.includes('sasu')) return 'sas'
  if (lower.includes('entreprise individuelle') || lower.includes('entrepreneur individuel')) return 'ei'
  if (lower.includes('personne physique')) return 'ei'
  if (lower.includes('sarl')) return 'sarl'
  if (lower.includes('sas')) return 'sas'
  return 'ei'
}

/** Map internal code back to display label (locale-aware) */
export function getStatusLabel(code: string, t?: (key: string, fallback?: string) => string): string {
  if (t) {
    const translated = t(`devis.statusLabels.${code}`)
    if (translated !== `devis.statusLabels.${code}`) return translated
  }
  const labels: Record<string, string> = {
    'ei': 'Entreprise Individuelle (EI)',
    'ae': 'Auto-Entrepreneur',
    'eurl': 'EURL',
    'sarl': 'SARL',
    'sas': 'SAS',
    'eni': 'Empresário em Nome Individual (ENI)',
    'unipessoal': 'Unipessoal Lda.',
    'lda': 'Sociedade por Quotas (Lda.)',
    'sa': 'Sociedade Anónima (SA)',
  }
  return labels[code] || code
}

/** Get company statuses for current locale */
export function getCompanyStatuses(locale: Locale): Array<{ value: string; label: string }> {
  if (locale === 'pt') {
    return [
      { value: 'eni', label: 'Empresário em Nome Individual (ENI)' },
      { value: 'unipessoal', label: 'Unipessoal Lda.' },
      { value: 'lda', label: 'Sociedade por Quotas (Lda.)' },
      { value: 'sa', label: 'Sociedade Anónima (SA)' },
    ]
  }
  return [
    { value: 'ei', label: 'Entreprise Individuelle (EI)' },
    { value: 'ae', label: 'Auto-Entrepreneur' },
    { value: 'eurl', label: 'EURL' },
    { value: 'sarl', label: 'SARL' },
    { value: 'sas', label: 'SAS' },
  ]
}

/** Check if status is a société-type (needing capital, RCS etc.) */
export function isSocieteStatus(status: string, locale: Locale): boolean {
  if (locale === 'pt') return ['lda', 'sa'].includes(status)
  return ['sarl', 'eurl', 'sas'].includes(status)
}

/** Check if status is AE/EI equivalent (VAT exempt by default) */
export function isSmallBusinessStatus(status: string, locale: Locale): boolean {
  if (locale === 'pt') return ['eni'].includes(status)
  return ['ae', 'ei'].includes(status)
}

/**
 * Champs de liaison devis → facture (méthode pro 2026). Une facture issue d'un
 * devis garde la référence du devis source (`sourceDevisNumber`/`sourceDevisId`)
 * pour la traçabilité et la reprise de l'échéancier d'acomptes (50/30/20) côté
 * facture. Renvoie {} si aucun devis source (création directe).
 */
export function devisLinkFields(
  devis: { id?: unknown; docNumber?: unknown } | null | undefined,
): { sourceDevisId?: string; sourceDevisNumber?: string } {
  if (!devis || typeof devis !== 'object') return {}
  const out: { sourceDevisId?: string; sourceDevisNumber?: string } = {}
  if (devis.id) out.sourceDevisId = String(devis.id)
  if (devis.docNumber) out.sourceDevisNumber = String(devis.docNumber)
  return out
}
