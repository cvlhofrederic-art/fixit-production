// ── Single source of truth for all service categories ──────────────────────
// Used by: landing page, search dropdown, DB sync, seed scripts.
// To add/remove a category: edit CATEGORIES below, then run sync-categories API.

export interface Category {
  slug: string
  icon: string
  /** i18n key under "services.*" in locale files */
  i18nKey: string
  /** Display order (lower = first) */
  order: number
  /** Whether to show in the top 8 on the landing page */
  featured: boolean
}

export const CATEGORIES: Category[] = [
  // ── Featured (top 8, shown by default) ──
  { slug: 'plomberie',           icon: '🔧', i18nKey: 'plumbing',           order: 1,  featured: true },
  { slug: 'electricite',         icon: '⚡', i18nKey: 'electricity',        order: 2,  featured: true },
  { slug: 'serrurerie',          icon: '🔑', i18nKey: 'locksmith',          order: 3,  featured: true },
  { slug: 'chauffage',           icon: '🔥', i18nKey: 'heating',            order: 4,  featured: true },
  { slug: 'peinture',            icon: '🎨', i18nKey: 'painting',           order: 5,  featured: true },
  { slug: 'maconnerie',          icon: '🧱', i18nKey: 'masonry',            order: 6,  featured: true },
  { slug: 'menuiserie',          icon: '🪚', i18nKey: 'carpentry',          order: 7,  featured: true },
  { slug: 'toiture',             icon: '🏚️', i18nKey: 'roofing',            order: 8,  featured: true },

  // ── Extra (shown on expand) ──
  { slug: 'climatisation',       icon: '❄️', i18nKey: 'airConditioning',    order: 10, featured: false },
  { slug: 'demenagement',        icon: '🚚', i18nKey: 'moving',             order: 11, featured: false },
  { slug: 'renovation',          icon: '🏡', i18nKey: 'renovation',         order: 12, featured: false },
  { slug: 'vitrerie',            icon: '🪟', i18nKey: 'glazing',            order: 13, featured: false },
  { slug: 'petits-travaux',      icon: '🛠️', i18nKey: 'smallJobs',          order: 14, featured: false },
  { slug: 'espaces-verts',       icon: '🌳', i18nKey: 'greenSpaces',        order: 15, featured: false },
  { slug: 'nettoyage',           icon: '🧹', i18nKey: 'cleaning',           order: 16, featured: false },
  { slug: 'traitement-nuisibles',icon: '🐛', i18nKey: 'pestControl',        order: 17, featured: false },
  { slug: 'amenagement-exterieur',icon:'🏡', i18nKey: 'exteriorDesign',     order: 18, featured: false },
  { slug: 'carrelage',           icon: '🧱', i18nKey: 'tiling',             order: 19, featured: false },
  { slug: 'diagnostic',          icon: '🔍', i18nKey: 'diagnostic',         order: 20, featured: false },
  { slug: 'nettoyage-travaux',   icon: '🧹', i18nKey: 'postWorkCleaning',   order: 21, featured: false },
  { slug: 'nettoyage-copro',     icon: '🏢', i18nKey: 'condoCleaning',      order: 22, featured: false },
  { slug: 'nettoyage-industriel',icon: '🏭', i18nKey: 'industrialCleaning', order: 23, featured: false },
  { slug: 'plaquiste',           icon: '🔳', i18nKey: 'drywall',            order: 24, featured: false },
  { slug: 'piscine',             icon: '🏊', i18nKey: 'pool',               order: 25, featured: false },
  { slug: 'ramonage',            icon: '🔥', i18nKey: 'chimneySweep',       order: 26, featured: false },
  { slug: 'store-banne',         icon: '☀️', i18nKey: 'awning',             order: 27, featured: false },
  { slug: 'debouchage',          icon: '🚿', i18nKey: 'drainCleaning',      order: 28, featured: false },
  { slug: 'metallerie',          icon: '⚙️', i18nKey: 'metallerie',         order: 29, featured: false },
]

export const FEATURED_CATEGORIES = CATEGORIES.filter(c => c.featured)
export const EXTRA_CATEGORIES = CATEGORIES.filter(c => !c.featured)
export const ALL_CATEGORY_SLUGS = CATEGORIES.map(c => c.slug)

// Slugs that were removed (for DB cleanup)
export const DEPRECATED_SLUGS = ['jardinage', 'paysagiste']
