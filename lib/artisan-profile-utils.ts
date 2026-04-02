// Utility functions for artisan profile pages
// Extracted from app/fr/artisan/[id]/page.tsx

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export type PriceTier = { label: string; price: string; widths?: { label: string; price: string }[] }
export type PriceInfo = {
  type: 'fixed' | 'devis' | 'per_sqm' | 'per_ml' | 'hourly' | 'tiered'
  label: string
  tiers?: PriceTier[]
}

// ------------------------------------------------------------------
// Locale-aware day/month name helpers
// ------------------------------------------------------------------
export function getDayName(dayIndex: number, localeCode: string): string {
  const date = new Date(2024, 0, 7 + dayIndex)
  const name = date.toLocaleDateString(localeCode, { weekday: 'long' })
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function getMonthName(monthIndex: number, localeCode: string): string {
  const date = new Date(2024, monthIndex, 1)
  const name = date.toLocaleDateString(localeCode, { month: 'long' })
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// ------------------------------------------------------------------
// Smart price helper — returns meaningful price info based on service
// ------------------------------------------------------------------
export function getSmartPrice(serviceName: string, priceTTC: number): PriceInfo {
  const n = (serviceName || '').toLowerCase()

  // ── PT: parseServiceTag a priorité — si [unit:x|min:y|max:z] présent, géré ailleurs ──

  // ── Poda (PT) — même logique que Élagage (FR) ────────────────────
  const isPoda = n.includes('poda')
  const isAbate = n.includes('abate')
  if (isPoda && n.includes('palmeira')) return { type: 'fixed', label: '150 – 450€/u' }
  if (isPoda && (n.includes('pequena') || n.includes('< 5m') || n.includes('<5m'))) return { type: 'fixed', label: '150 – 350€/u' }
  if (isPoda && (n.includes('média') || n.includes('media') || (n.includes('5') && n.includes('10m')))) return { type: 'fixed', label: '350 – 800€/u' }
  if (isPoda && (n.includes('grande') && !n.includes('muito') || (n.includes('10') && n.includes('20m')))) return { type: 'fixed', label: '800 – 1 600€/u' }
  if (isPoda && (n.includes('muito grande') || n.includes('> 20m') || n.includes('>20m'))) return { type: 'fixed', label: '1 600 – 3 000€/u' }
  if (isPoda) return { type: 'tiered', label: 'Conforme altura da árvore', tiers: [
    { label: '< 5 m', price: '150 – 350€' }, { label: '5 – 10 m', price: '350 – 800€' },
    { label: '10 – 20 m', price: '800 – 1 600€' }, { label: '> 20 m', price: '1 600 – 3 000€' },
  ]}
  // ── Abate (PT) ───────────────────────────────────────────────────
  if (isAbate && (n.includes('pequena') || n.includes('< 10m'))) return { type: 'fixed', label: '450 – 900€/u' }
  if (isAbate && (n.includes('grande') || n.includes('> 10m'))) return { type: 'fixed', label: '900 – 3 500€/u' }
  if (isAbate) return { type: 'devis', label: 'Orçamento no local' }
  // ── Relva / Escarificação (PT) ───────────────────────────────────
  if (n.includes('relva') || n.includes('relvado') || n.includes('corte de') ) {
    if (n.includes('escarif') || n.includes('arejamento')) return { type: 'per_sqm', label: '0,80 – 1,50€/m²' }
    return { type: 'per_sqm', label: '0,80 – 1,80€/m²' }
  }
  if (n.includes('escarif')) return { type: 'per_sqm', label: '0,80 – 1,50€/m²' }
  // ── Sebes / Arbustos (PT) ─────────────────────────────────────────
  if (n.includes('sebe') || n.includes('arbust')) return { type: 'per_ml', label: '8 – 20€/ml' }
  // ── Rega / Irrigação (PT) ─────────────────────────────────────────
  if (n.includes('rega') || n.includes('irrigaç')) return { type: 'per_sqm', label: '8 – 25€/m²' }
  // ── Manutenção jardim (PT) ────────────────────────────────────────
  if (n.includes('manutenção') || n.includes('manutencao') || n.includes('jardim')) return { type: 'hourly', label: '35 – 60€/h' }
  // ── Desinfestação / Ervas (PT) ───────────────────────────────────
  if (n.includes('desinfest') || n.includes('ervas') || n.includes('canteiros')) return { type: 'per_sqm', label: '3 – 8€/m²' }
  // ── Criação relvado (PT) ──────────────────────────────────────────
  if (n.includes('criação') || n.includes('sementeira') || n.includes('relvado natural')) return { type: 'per_sqm', label: '8 – 15€/m²' }
  // ── Aménagement paysager (PT) ─────────────────────────────────────
  if (n.includes('paisag') || n.includes('aménagement')) return { type: 'per_sqm', label: '80 – 300€/m²' }

  // ── Élagage spécifique par taille ────────────────────────────────
  if ((n.includes('élagage') || n.includes('elagage')) && n.includes('palmier')) {
    return { type: 'fixed', label: '150 – 450€/palmier' }
  }
  if ((n.includes('élagage') || n.includes('elagage')) && (n.includes('petit') || n.includes('< 5m') || n.includes('<5m'))) {
    return { type: 'fixed', label: '150 – 350€/u' }
  }
  if ((n.includes('élagage') || n.includes('elagage')) && (n.includes('moyen') || (n.includes('5') && n.includes('10m')))) {
    return { type: 'fixed', label: '350 – 800€/u' }
  }
  if ((n.includes('élagage') || n.includes('elagage')) && (n.includes('grand') && !n.includes('très') && !n.includes('tres') || (n.includes('10') && n.includes('20m')))) {
    return { type: 'fixed', label: '800 – 1 600€/u' }
  }
  if ((n.includes('élagage') || n.includes('elagage')) && (n.includes('très grand') || n.includes('tres grand') || n.includes('> 20m') || n.includes('>20m'))) {
    return { type: 'fixed', label: '1 600 – 3 000€/u' }
  }
  // ── Élagage générique — paliers hauteur ──────────────────────────
  if (n.includes('élagage') || n.includes('elagage') || n.includes('elaguage')) {
    return {
      type: 'tiered',
      label: 'Selon hauteur de l\'arbre',
      tiers: [
        { label: '< 5 m',    price: '150 – 350€' },
        { label: '5 – 10 m', price: '350 – 800€' },
        { label: '10 – 20 m',price: '800 – 1 600€' },
        { label: '> 20 m',   price: '1 600 – 3 000€' },
      ],
    }
  }

  // ── Abattage par taille ───────────────────────────────────────────
  if (n.includes('abattage') && (n.includes('petit') || n.includes('< 10m') || n.includes('<10m'))) {
    return { type: 'fixed', label: '450 – 900€/u' }
  }
  if (n.includes('abattage') && (n.includes('moyen') || (n.includes('10') && n.includes('20m')))) {
    return { type: 'fixed', label: '900 – 1 800€/u' }
  }
  if (n.includes('abattage') && (n.includes('grand') || n.includes('> 20m') || n.includes('>20m'))) {
    return { type: 'fixed', label: '1 800 – 3 500€/u' }
  }
  if (n.includes('abattage')) {
    return { type: 'devis', label: 'Sur devis' }
  }

  // ── Taille fruitiers ──────────────────────────────────────────────
  if (n.includes('fruitier')) {
    return { type: 'fixed', label: '180 – 500€/u' }
  }

  // ── Taille arbustes / rosiers ─────────────────────────────────────
  if (n.includes('arbuste') || n.includes('rosier')) {
    return { type: 'per_sqm', label: '4 – 10€/m²' }
  }

  // ── Taille de haie ────────────────────────────────────────────────
  if (n.includes('haie')) {
    return { type: 'per_ml', label: '8 – 20€/ml' }
  }

  // ── Tonte pelouse ─────────────────────────────────────────────────
  if (n.includes('tonte') || (n.includes('pelouse') && !n.includes('scarif'))) {
    return { type: 'per_sqm', label: '0,80 – 1,80€/m²' }
  }

  // ── Scarification ─────────────────────────────────────────────────
  if (n.includes('scarif')) {
    return { type: 'per_sqm', label: '0,80 – 1,50€/m²' }
  }

  // ── Ramassage feuilles ────────────────────────────────────────────
  if (n.includes('feuille') || n.includes('ramassage')) {
    return { type: 'per_sqm', label: '0,50 – 1,00€/m²' }
  }

  // ── Débroussaillage ───────────────────────────────────────────────
  if (n.includes('débroussail') || n.includes('debroussail') || n.includes('broussaille')) {
    return { type: 'per_sqm', label: '0,90 – 1,80€/m²' }
  }

  // ── Désherbage & nettoyage massifs ────────────────────────────────
  if (n.includes('désherb') || n.includes('desherb') || (n.includes('nettoyage') && n.includes('massif'))) {
    return { type: 'per_sqm', label: '3 – 8€/m²' }
  }

  // ── Broyage de branches ───────────────────────────────────────────
  if (n.includes('broyage')) {
    return { type: 'fixed', label: '150 – 300€/tonne' }
  }

  // ── Évacuation déchets verts ──────────────────────────────────────
  if (n.includes('évacuation') || n.includes('evacuation') || n.includes('déchets verts') || n.includes('dechets verts')) {
    return { type: 'fixed', label: '120 – 250€/tonne' }
  }

  // ── Gazon synthétique ─────────────────────────────────────────────
  if (n.includes('synthét') || n.includes('synthet')) {
    return { type: 'per_sqm', label: '35 – 70€/m²' }
  }

  // ── Gazon en rouleaux ─────────────────────────────────────────────
  if (n.includes('rouleau')) {
    return { type: 'per_sqm', label: '18 – 35€/m²' }
  }

  // ── Semis gazon naturel ───────────────────────────────────────────
  if (n.includes('semis') || (n.includes('gazon') && n.includes('naturel'))) {
    return { type: 'per_sqm', label: '8 – 15€/m²' }
  }

  // ── Arrosage automatique ──────────────────────────────────────────
  if (n.includes('arrosage')) {
    return { type: 'per_sqm', label: '8 – 25€/m²' }
  }

  // ── Création massifs / Plantations ───────────────────────────────
  if ((n.includes('création') || n.includes('creation')) && (n.includes('massif') || n.includes('plantation'))) {
    return { type: 'per_sqm', label: '40 – 120€/m²' }
  }

  // ── Création allées / bordures ────────────────────────────────────
  if (n.includes('allée') || n.includes('allee') || (n.includes('bordure') && (n.includes('création') || n.includes('creation')))) {
    return { type: 'per_sqm', label: '60 – 150€/m²' }
  }

  // ── Aménagement paysager complet ──────────────────────────────────
  if (n.includes('aménagement') || n.includes('amenagement') || n.includes('paysager')) {
    return { type: 'per_sqm', label: '80 – 300€/m²' }
  }

  // ── Dessouchage / Rognage ─────────────────────────────────────────
  if (n.includes('dessouchage') || n.includes('rognage') || n.includes('souche')) {
    return { type: 'devis', label: 'Sur devis' }
  }

  // ── Copropriété / Entretien espaces verts collectifs ─────────────
  if (n.includes('copropriété') || n.includes('copropriete') || n.includes('copro') || (n.includes('espaces verts') && n.includes('entretien'))) {
    return { type: 'devis', label: 'Sur devis' }
  }

  // ── Traitement ────────────────────────────────────────────────────
  if (n.includes('traitement') || n.includes('charançon') || n.includes('charancon') || n.includes('phytosanitaire')) {
    return { type: 'devis', label: 'Sur devis' }
  }

  // ── Nettoyage de terrain ──────────────────────────────────────────
  if (n.includes('nettoyage de terrain') || (n.includes('nettoyage') && n.includes('terrain'))) {
    return { type: 'devis', label: 'Sur devis' }
  }

  // ── Devis ─────────────────────────────────────────────────────────
  if (n.includes('devis')) {
    return { type: 'devis', label: 'Gratuit (chantier standard)' }
  }

  // ── Entretien jardin / espaces verts ──────────────────────────────
  if (n.includes('entretien') || n.includes('jardinage')) {
    return { type: 'hourly', label: '35 – 60€/h' }
  }

  // ── Prix fixe renseigné ───────────────────────────────────────────
  if (priceTTC > 0) return { type: 'fixed', label: `${priceTTC}€` }

  return { type: 'devis', label: 'Sur devis' }
}

// Calcule une estimation de prix selon la quantité saisie
export function calculateEstimatedPrice(priceInfo: PriceInfo, qty: number): string {
  if (!qty || qty <= 0) return ''
  const match = priceInfo.label.match(/([\d,]+)\s*[–\-]\s*([\d,]+)/)
  if (!match) return priceInfo.label
  const low  = parseFloat(match[1].replace(',', '.'))
  const high = parseFloat(match[2].replace(',', '.'))
  const totalLow  = Math.round(low  * qty)
  const totalHigh = Math.round(high * qty)
  const unit = priceInfo.type === 'per_ml' ? 'ml' : 'm²'
  return `${totalLow} – ${totalHigh}€ pour ${qty} ${unit}`
}

// ── Multi-service helpers ──────────────────────────────────────────
export function parseServiceTag(service: any): { unit: string; min: number; max: number } | null {
  const match = (service.description || '').match(/\[unit:([^|]+)\|min:([\d.]+)\|max:([\d.]+)\]/)
  if (match) {
    return { unit: match[1], min: parseFloat(match[2]), max: parseFloat(match[3]) }
  }
  return null
}

export function cleanServiceDesc(service: any): string {
  return (service.description || '')
    .replace(/\s*\[unit:[^\]]+\]\s*/g, '')
    .replace(/\s*\[(m²|heure|unité|forfait|ml)\]\s*/g, '')
    .trim()
}

export const UNIT_LABELS: Record<string, string> = { m2: 'm²', ml: 'ml', m3: 'm³', heure: 'h', forfait: '', unite: 'unité(s)', arbre: 'unité(s)', kg: 'kg', tonne: 't', lot: 'lot' }

export function getServiceEstimate(service: any, qty: string): { minVal: number; maxVal: number; needsQty: boolean; unit: string } {
  const tag = parseServiceTag(service)
  if (tag) {
    const needsQty = ['m2', 'ml', 'arbre', 'tonne', 'unite', 'm3', 'kg', 'lot'].includes(tag.unit)
    const q = parseFloat(qty) || 0
    if (needsQty && q > 0) return { minVal: Math.round(tag.min * q * 100) / 100, maxVal: Math.round(tag.max * q * 100) / 100, needsQty, unit: tag.unit }
    return { minVal: tag.min, maxVal: tag.max, needsQty, unit: tag.unit }
  }
  // Fallback: getSmartPrice label
  const info = getSmartPrice(service.name, service.price_ttc)
  const rm = info.label.match(/([\d,]+)\s*[–\-]\s*([\d,]+)/)
  if (rm) {
    const mn = parseFloat(rm[1].replace(',', '.')), mx = parseFloat(rm[2].replace(',', '.'))
    const needsQty = info.type === 'per_sqm' || info.type === 'per_ml'
    const q = parseFloat(qty) || 0
    if (needsQty && q > 0) return { minVal: Math.round(mn * q), maxVal: Math.round(mx * q), needsQty, unit: info.type === 'per_ml' ? 'ml' : 'm2' }
    return { minVal: mn, maxVal: mx, needsQty, unit: info.type === 'per_ml' ? 'ml' : 'm2' }
  }
  return { minVal: service.price_ttc || 0, maxVal: service.price_ttc || 0, needsQty: false, unit: 'forfait' }
}

// ── Service categories ──────────────────────────────────────────────
const SERVICE_CATEGORIES_FR: { key: string; label: string; emoji: string; keywords: string[] }[] = [
  { key: 'elagage', label: 'Élagage', emoji: '🌳', keywords: ['élagage', 'elagage'] },
  { key: 'traitement', label: 'Traitements', emoji: '💊', keywords: ['traitement', 'phytosanitaire', 'charançon'] },
  { key: 'abattage', label: 'Abattage & Dessouchage', emoji: '🪓', keywords: ['abattage', 'dessouchage', 'rognage', 'souche'] },
  { key: 'taille', label: 'Taille & Haies', emoji: '✂️', keywords: ['taille', 'haie', 'arbuste', 'rosier', 'fruitier'] },
  { key: 'pelouse', label: 'Pelouse & Gazon', emoji: '🌿', keywords: ['tonte', 'pelouse', 'gazon', 'scarification'] },
  { key: 'entretien', label: 'Entretien', emoji: '🧹', keywords: ['entretien', 'débroussaillage', 'debroussaillage', 'désherbage', 'desherbage', 'ramassage', 'feuille'] },
  { key: 'amenagement', label: 'Aménagement', emoji: '🏡', keywords: ['aménagement', 'amenagement', 'création', 'creation', 'plantation', 'massif', 'allée', 'allee', 'bordure', 'arrosage'] },
  { key: 'evacuation', label: 'Évacuation & Nettoyage', emoji: '♻️', keywords: ['broyage', 'évacuation', 'evacuation', 'nettoyage de terrain', 'déchet'] },
]
const SERVICE_CATEGORIES_PT: { key: string; label: string; emoji: string; keywords: string[] }[] = [
  { key: 'elagage', label: 'Poda', emoji: '🌳', keywords: ['poda', 'élagage', 'elagage'] },
  { key: 'traitement', label: 'Tratamentos', emoji: '💊', keywords: ['tratamento', 'traitement', 'fitossanitário', 'charançon'] },
  { key: 'abattage', label: 'Abate & Remoção de tocos', emoji: '🪓', keywords: ['abate', 'abattage', 'dessouchage', 'rognage', 'toco'] },
  { key: 'taille', label: 'Poda & Sebes', emoji: '✂️', keywords: ['sebe', 'taille', 'arbusto', 'roseira', 'fruteira'] },
  { key: 'pelouse', label: 'Relva & Relvado', emoji: '🌿', keywords: ['corte', 'relva', 'relvado', 'escarificação', 'tonte', 'pelouse', 'gazon'] },
  { key: 'entretien', label: 'Manutenção', emoji: '🧹', keywords: ['manutenção', 'entretien', 'desmatação', 'ervas', 'limpeza', 'folhas'] },
  { key: 'amenagement', label: 'Paisagismo', emoji: '🏡', keywords: ['paisagismo', 'aménagement', 'criação', 'plantação', 'canteiro', 'caminho', 'rega'] },
  { key: 'evacuation', label: 'Evacuação & Limpeza', emoji: '♻️', keywords: ['trituração', 'evacuação', 'evacuation', 'limpeza de terreno', 'resíduos'] },
]

export function getServiceCategories(loc: string) { return loc === 'pt' ? SERVICE_CATEGORIES_PT : SERVICE_CATEGORIES_FR }

export function getServiceCategory(name: string, loc: string): string {
  const lower = name.toLowerCase()
  for (const cat of getServiceCategories(loc)) {
    if (cat.keywords.some(kw => lower.includes(kw))) return cat.key
  }
  return 'autres'
}

export function groupServicesByCategory(servicesList: any[], loc: string): { key: string; label: string; emoji: string; services: any[] }[] {
  const cats = getServiceCategories(loc)
  const grouped: Record<string, any[]> = {}
  for (const svc of servicesList) {
    const cat = getServiceCategory(svc.name, loc)
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(svc)
  }
  const result: { key: string; label: string; emoji: string; services: any[] }[] = []
  for (const cat of cats) {
    if (grouped[cat.key]?.length) {
      result.push({ key: cat.key, label: cat.label, emoji: cat.emoji, services: grouped[cat.key] })
    }
  }
  if (grouped['autres']?.length) {
    result.push({ key: 'autres', label: loc === 'pt' ? 'Outros serviços' : 'Autres services', emoji: '🔧', services: grouped['autres'] })
  }
  return result
}

// Mapping of service name keywords to emojis
export function getServiceEmoji(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('plomb')) return '\uD83D\uDD27'
  if (lower.includes('electr') || lower.includes('électr')) return '\u26A1'
  if (lower.includes('serrur')) return '\uD83D\uDD11'
  if (lower.includes('chauff')) return '\uD83D\uDD25'
  if (lower.includes('vitr')) return '\uD83E\uDE9F'
  if (lower.includes('jardin') || lower.includes('vert') || lower.includes('tonte') || lower.includes('haie') || lower.includes('pelouse')) return '\uD83C\uDF33'
  if (lower.includes('nettoy') || lower.includes('menage') || lower.includes('ménage')) return '\uD83E\uDDF9'
  if (lower.includes('peintur')) return '\uD83C\uDFA8'
  if (lower.includes('carrel')) return '\uD83E\uDDF1'
  if (lower.includes('toiture') || lower.includes('toit')) return '\uD83C\uDFE0'
  if (lower.includes('démouss') || lower.includes('demouss')) return '\uD83C\uDF3F'
  return '\uD83D\uDD27'
}

export function getArtisanInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}
