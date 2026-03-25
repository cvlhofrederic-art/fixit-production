// ═══════════════════════════════════════════════
// HELPERS for DevisFactureForm
// Extracted from components/DevisFactureForm.tsx
// ═══════════════════════════════════════════════

import type { ProductLine } from '@/lib/devis-types'
import { UNITE_VALUES } from '@/lib/devis-types'
import type { Locale } from '@/lib/i18n/config'

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
  return addr.split(/(\s+|,\s*)/g).map((part, idx) => {
    const t = part.trim()
    if (!t || /^[\s,]+$/.test(part)) return part
    if (/^\d{5}$/.test(t)) return t
    if (abbrMap[t]) return abbrMap[t]
    const lo = t.toLowerCase()
    if (idx > 0 && lowerWords.has(lo)) return lo
    return lo.charAt(0).toUpperCase() + lo.slice(1)
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
