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
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch { /* WebView ancien : fallback RFC4122 ci-dessous */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
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
