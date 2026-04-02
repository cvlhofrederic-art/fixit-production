// ------------------------------------------------------------------
// Category labels, mappings, and fuzzy search utilities
// Extracted from app/fr/recherche/page.tsx
// ------------------------------------------------------------------

export const CATEGORY_LABELS_FR: Record<string, string> = {
  plomberie: 'Plombier',
  electricite: 'Électricien',
  peinture: 'Peintre',
  maconnerie: 'Maçon',
  menuiserie: 'Menuisier',
  chauffage: 'Chauffagiste',
  climatisation: 'Climaticien',
  serrurerie: 'Serrurier',
  carrelage: 'Carreleur',
  toiture: 'Couvreur',
  'espaces-verts': 'Paysagiste',
  demenagement: 'Déménageur',
  nettoyage: 'Agent de nettoyage',
  renovation: 'Artisan rénovation',
  vitrerie: 'Vitrier',
  'traitement-nuisibles': 'Traitement nuisibles',
  'petits-travaux': 'Petits travaux',
  metallerie: 'Métallier / Ferronnier',
}

export const CATEGORY_LABELS_PT: Record<string, string> = {
  plomberie: 'Canalizador',
  electricite: 'Eletricista',
  peinture: 'Pintor',
  maconnerie: 'Pedreiro',
  menuiserie: 'Carpinteiro',
  chauffage: 'Técnico de aquecimento',
  climatisation: 'Técnico de ar condicionado',
  serrurerie: 'Serralheiro',
  carrelage: 'Ladrilhador',
  toiture: 'Técnico de telhados',
  'espaces-verts': 'Jardineiro',
  demenagement: 'Empresa de mudanças',
  nettoyage: 'Empresa de limpeza',
  renovation: 'Empresa de remodelação',
  vitrerie: 'Vidraceiro',
  'traitement-nuisibles': 'Controlo de pragas',
  'petits-travaux': 'Pequenos trabalhos',
  metallerie: 'Metaleiro / Ferreiro',
}

// Mapping catégorie slug → métiers catalogue (FR + PT)
export const CATEGORY_TO_METIERS: Record<string, string[]> = {
  plomberie:     ['Plombier', 'Plomberie', 'Canalizador', 'Canalização', 'Explicações de canalização'],
  electricite:   ['Électricien', 'Électricité', 'Eletricista', 'Eletricidade', 'Instalações elétricas'],
  serrurerie:    ['Serrurier', 'Serrurerie', 'Serralheiro', 'Serralharia'],
  chauffage:     ['Chauffagiste', 'Chauffage', 'Técnico de aquecimento', 'Aquecimento', 'Caldeira'],
  climatisation: ['Climatisation', 'Ar condicionado', 'AVAC', 'Climatização'],
  peinture:      ['Peintre', 'Peinture', 'Pintor', 'Pintura'],
  maconnerie:    ['Maçon', 'Maçonnerie', 'Pedreiro', 'Construção civil', 'Alvenaria'],
  menuiserie:    ['Menuisier', 'Menuiserie', 'Carpinteiro', 'Carpintaria'],
  carrelage:     ['Carreleur', 'Carrelage', 'Ladrilhador', 'Ladrilhamento', 'Cerâmica'],
  toiture:       ['Couvreur', 'Toiture', 'Telhador', 'Telhamento', 'Cobertura'],
  'espaces-verts': ['Espaces verts', 'Paysagiste', 'Jardinage', 'Jardinier', 'Jardineiro', 'Jardinagem', 'Paisagismo'],
  nettoyage:     ['Nettoyage', 'Limpeza', 'Serviços de limpeza'],
  demenagement:  ['Déménageur', 'Déménagement', 'Mudanças', 'Transportes e mudanças'],
  renovation:    ['Rénovation', 'Petits travaux', 'Remodelação', 'Obras e remodelações'],
  vitrerie:      ['Vitrier', 'Vitrerie', 'Vidraceiro', 'Vidraçaria'],
  'traitement-nuisibles': ['Traitement nuisibles', 'Dératisation', 'Désinsectisation', '3D', 'Controlo de pragas', 'Desratização', 'Desinfestação'],
  'petits-travaux': ['Petits travaux', 'Bricolage', 'Bricolagem', 'Pequenos trabalhos', 'Reparações gerais'],
  metallerie:    ['Métallier', 'Ferronnier', 'Métallerie', 'Ferronnerie', 'Metaleiro', 'Ferreiro', 'Serralharia de construção'],
}

export const KEYWORD_TO_CATEGORY: Record<string, string> = {
  // Plomberie
  plombier: 'plomberie', plombiers: 'plomberie', fuite: 'plomberie',
  robinet: 'plomberie', chauffe: 'plomberie', wc: 'plomberie', toilette: 'plomberie',
  canalisation: 'plomberie', debouchage: 'plomberie', ballon: 'plomberie',
  douche: 'plomberie', baignoire: 'plomberie', lavabo: 'plomberie', evier: 'plomberie',
  siphon: 'plomberie', tuyau: 'plomberie',
  // Electricité
  electricien: 'electricite', electriciens: 'electricite', electrique: 'electricite',
  prise: 'electricite', tableau: 'electricite', disjoncteur: 'electricite',
  eclairage: 'electricite', lumiere: 'electricite', interrupteur: 'electricite',
  // Serrurerie
  serrurier: 'serrurerie', serruriers: 'serrurerie', serrure: 'serrurerie',
  porte: 'serrurerie', cle: 'serrurerie', blindage: 'serrurerie', verrou: 'serrurerie',
  // Chauffage
  chauffagiste: 'chauffage', chauffagistes: 'chauffage', chaudiere: 'chauffage',
  radiateur: 'chauffage',
  // Climatisation
  climatiseur: 'climatisation', clim: 'climatisation',
  // Peinture
  peintre: 'peinture', peintres: 'peinture', ravalement: 'peinture', facade: 'peinture',
  // Maçonnerie
  macon: 'maconnerie', macons: 'maconnerie', beton: 'maconnerie', mur: 'maconnerie',
  cloture: 'maconnerie', dalle: 'maconnerie',
  // Menuiserie
  menuisier: 'menuiserie', menuisiers: 'menuiserie', fenetre: 'menuiserie',
  volet: 'menuiserie', parquet: 'menuiserie', bois: 'menuiserie', dressing: 'menuiserie',
  // Carrelage
  carreleur: 'carrelage', carreleurs: 'carrelage', faience: 'carrelage',
  // Toiture
  couvreur: 'toiture', couvreurs: 'toiture', toit: 'toiture', gouttiere: 'toiture',
  tuile: 'toiture', zinguerie: 'toiture',
  // Espaces verts
  jardinier: 'espaces-verts', jardiniers: 'espaces-verts', paysagiste: 'espaces-verts',
  paysagistes: 'espaces-verts', elagage: 'espaces-verts', elagueur: 'espaces-verts',
  elagueurs: 'espaces-verts', tonte: 'espaces-verts',
  haie: 'espaces-verts', pelouse: 'espaces-verts', arbre: 'espaces-verts', taille: 'espaces-verts',
  gazon: 'espaces-verts', debroussaillage: 'espaces-verts', abattage: 'espaces-verts',
  dessouchage: 'espaces-verts', rognage: 'espaces-verts', espaces: 'espaces-verts',
  jardinage: 'espaces-verts', jardin: 'espaces-verts',
  // Nettoyage
  nettoyeur: 'nettoyage', menage: 'nettoyage',
  // Déménagement
  demenageur: 'demenagement', demenageurs: 'demenagement',
  // Rénovation
  renovateur: 'renovation', travaux: 'renovation',
  // Vitrerie
  vitrier: 'vitrerie', vitriers: 'vitrerie', vitre: 'vitrerie', vitrage: 'vitrerie', miroir: 'vitrerie',
  // Traitement nuisibles
  nuisible: 'traitement-nuisibles', nuisibles: 'traitement-nuisibles',
  deratisation: 'traitement-nuisibles', desinsectisation: 'traitement-nuisibles',
  punaise: 'traitement-nuisibles', punaises: 'traitement-nuisibles',
  termite: 'traitement-nuisibles', termites: 'traitement-nuisibles',
  cafard: 'traitement-nuisibles', cafards: 'traitement-nuisibles',
  guepe: 'traitement-nuisibles', guepes: 'traitement-nuisibles',
  frelon: 'traitement-nuisibles', frelons: 'traitement-nuisibles',
  rat: 'traitement-nuisibles', rats: 'traitement-nuisibles',
  souris: 'traitement-nuisibles',
  // ── Mots-clés portugais (PT) ──────────────────────────────────────
  // Plomberie PT
  canalizador: 'plomberie', canalizadores: 'plomberie', canalizacao: 'plomberie',
  explicacoes: 'plomberie', torneira: 'plomberie', sanita: 'plomberie',
  // Electricité PT
  eletricista: 'electricite', eletricistas: 'electricite', eletricidade: 'electricite',
  instalacoes: 'electricite', tomada: 'electricite', disjuntor: 'electricite',
  // Serrurerie PT
  serralheiro: 'serrurerie', serralheiros: 'serrurerie', serralharia: 'serrurerie',
  fechadura: 'serrurerie', porta: 'serrurerie', chave: 'serrurerie',
  // Chauffage PT
  aquecimento: 'chauffage', caldeira: 'chauffage', radiador: 'chauffage',
  // Climatisation PT
  'ar condicionado': 'climatisation', avac: 'climatisation', climatizacao: 'climatisation',
  // Peinture PT
  pintor: 'peinture', pintores: 'peinture', pintura: 'peinture',
  // Maçonnerie PT
  pedreiro: 'maconnerie', pedreiros: 'maconnerie', alvenaria: 'maconnerie',
  construcao: 'maconnerie', betao: 'maconnerie',
  // Menuiserie PT
  carpinteiro: 'menuiserie', carpinteiros: 'menuiserie', carpintaria: 'menuiserie',
  // Carrelage PT
  ladrilhador: 'carrelage', ladrilhamento: 'carrelage', ceramica: 'carrelage',
  azulejo: 'carrelage', mosaico: 'carrelage',
  // Toiture PT
  telhador: 'toiture', telhadores: 'toiture', telhamento: 'toiture', cobertura: 'toiture',
  // Espaces verts PT
  jardineiro: 'espaces-verts', jardineiros: 'espaces-verts', jardinagem: 'espaces-verts',
  jardim: 'espaces-verts', podas: 'espaces-verts', paisagismo: 'espaces-verts',
  // Nettoyage PT
  limpeza: 'nettoyage', servicos: 'nettoyage',
  // Déménagement PT
  mudancas: 'demenagement', transporte: 'demenagement',
  // Rénovation PT
  remodelacao: 'renovation', obras: 'renovation', reparacoes: 'renovation',
  // Vitrerie PT
  vidraceiro: 'vitrerie', vidraceiros: 'vitrerie', vidracaria: 'vitrerie', vidro: 'vitrerie',
  // Nuisibles PT
  pragas: 'traitement-nuisibles', desratizacao: 'traitement-nuisibles',
  desinfestacao: 'traitement-nuisibles', barata: 'traitement-nuisibles',
  rato: 'traitement-nuisibles', ratos: 'traitement-nuisibles',
  // Bricolage PT
  bricolagem: 'petits-travaux', reparacoes2: 'petits-travaux',
  // Métallerie / Ferronnerie FR
  metallier: 'metallerie', ferronnier: 'metallerie', metallerie: 'metallerie',
  ferronnerie: 'metallerie', portail: 'metallerie', portails: 'metallerie',
  grille: 'metallerie', grilles: 'metallerie', garde: 'metallerie',
  balustrade: 'metallerie', rampe: 'metallerie', escalier: 'metallerie',
  // Métallerie PT
  metaleiro: 'metallerie', ferreiro: 'metallerie',
  portao: 'metallerie', grade: 'metallerie', grades: 'metallerie',
}

// ------------------------------------------------------------------
// Suggestions d'autocomplétion spécialités
// ------------------------------------------------------------------

export interface SpecialtySuggestion {
  label: string
  category: string
  icon: string
  subtitle?: string
  type: 'primary' | 'intervention'
}

export const SPECIALTY_SUGGESTIONS_FR: SpecialtySuggestion[] = [
  // Métiers principaux
  { label: 'Plombier', category: 'plomberie', icon: '🔧', type: 'primary' },
  { label: 'Électricien', category: 'electricite', icon: '⚡', type: 'primary' },
  { label: 'Serrurier', category: 'serrurerie', icon: '🔑', type: 'primary' },
  { label: 'Chauffagiste', category: 'chauffage', icon: '🔥', type: 'primary' },
  { label: 'Climaticien', category: 'climatisation', icon: '❄️', type: 'primary' },
  { label: 'Peintre', category: 'peinture', icon: '🖌️', type: 'primary' },
  { label: 'Maçon', category: 'maconnerie', icon: '🏗️', type: 'primary' },
  { label: 'Menuisier', category: 'menuiserie', icon: '🪚', type: 'primary' },
  { label: 'Carreleur', category: 'carrelage', icon: '🧱', type: 'primary' },
  { label: 'Couvreur', category: 'toiture', icon: '🏠', type: 'primary' },
  { label: 'Paysagiste', category: 'espaces-verts', icon: '🌿', type: 'primary' },
  { label: 'Déménageur', category: 'demenagement', icon: '📦', type: 'primary' },
  { label: 'Nettoyage', category: 'nettoyage', icon: '🧹', type: 'primary' },
  { label: 'Rénovation', category: 'renovation', icon: '🔨', type: 'primary' },
  { label: 'Vitrier', category: 'vitrerie', icon: '🪟', type: 'primary' },
  { label: 'Traitement nuisibles', category: 'traitement-nuisibles', icon: '🐛', type: 'primary' },
  { label: 'Petits travaux', category: 'petits-travaux', icon: '🔩', type: 'primary' },
  // Types d'intervention courants
  { label: 'Fuite d\'eau', category: 'plomberie', icon: '💧', subtitle: 'Plombier', type: 'intervention' },
  { label: 'Débouchage WC', category: 'plomberie', icon: '🚽', subtitle: 'Plombier', type: 'intervention' },
  { label: 'Robinet qui fuit', category: 'plomberie', icon: '🔧', subtitle: 'Plombier', type: 'intervention' },
  { label: 'Chauffe-eau en panne', category: 'plomberie', icon: '🚿', subtitle: 'Plombier', type: 'intervention' },
  { label: 'Serrure claquée', category: 'serrurerie', icon: '🔑', subtitle: 'Serrurier', type: 'intervention' },
  { label: 'Porte blindée', category: 'serrurerie', icon: '🚪', subtitle: 'Serrurier', type: 'intervention' },
  { label: 'Panne électrique', category: 'electricite', icon: '⚡', subtitle: 'Électricien', type: 'intervention' },
  { label: 'Tableau électrique', category: 'electricite', icon: '🔌', subtitle: 'Électricien', type: 'intervention' },
  { label: 'Chaudière en panne', category: 'chauffage', icon: '🔥', subtitle: 'Chauffagiste', type: 'intervention' },
  { label: 'Radiateur froid', category: 'chauffage', icon: '🌡️', subtitle: 'Chauffagiste', type: 'intervention' },
  { label: 'Taille de haies', category: 'espaces-verts', icon: '✂️', subtitle: 'Paysagiste', type: 'intervention' },
  { label: 'Tonte de pelouse', category: 'espaces-verts', icon: '🌿', subtitle: 'Paysagiste', type: 'intervention' },
  { label: 'Abattage d\'arbres', category: 'espaces-verts', icon: '🌳', subtitle: 'Paysagiste', type: 'intervention' },
  { label: 'Élagage', category: 'espaces-verts', icon: '🌱', subtitle: 'Paysagiste', type: 'intervention' },
  { label: 'Pose de parquet', category: 'menuiserie', icon: '🪵', subtitle: 'Menuisier', type: 'intervention' },
  { label: 'Vitres cassées', category: 'vitrerie', icon: '🪟', subtitle: 'Vitrier', type: 'intervention' },
  { label: 'Ravalement de façade', category: 'peinture', icon: '🖌️', subtitle: 'Peintre', type: 'intervention' },
  { label: 'Dératisation', category: 'traitement-nuisibles', icon: '🐀', subtitle: 'Traitement nuisibles', type: 'intervention' },
  { label: 'Punaises de lit', category: 'traitement-nuisibles', icon: '🐜', subtitle: 'Traitement nuisibles', type: 'intervention' },
  { label: 'Nid de frelons', category: 'traitement-nuisibles', icon: '🐝', subtitle: 'Traitement nuisibles', type: 'intervention' },
  { label: 'Montage de meubles', category: 'petits-travaux', icon: '🔩', subtitle: 'Petits travaux', type: 'intervention' },
  { label: 'Bricolage à domicile', category: 'petits-travaux', icon: '🛠️', subtitle: 'Petits travaux', type: 'intervention' },
  { label: 'Pose de carrelage', category: 'carrelage', icon: '🧱', subtitle: 'Carreleur', type: 'intervention' },
  { label: 'Réparation de toiture', category: 'toiture', icon: '🏠', subtitle: 'Couvreur', type: 'intervention' },
  // Nouveaux métiers
  { label: 'Plaquiste', category: 'plaquiste', icon: '🔳', type: 'primary' },
  { label: 'Ramoneur', category: 'ramonage', icon: '🔥', type: 'primary' },
  { label: 'Pisciniste', category: 'piscine', icon: '🏊', type: 'primary' },
  { label: 'Store Banne', category: 'store-banne', icon: '☀️', type: 'primary' },
  { label: 'Paysagiste', category: 'paysagiste', icon: '🌿', type: 'primary' },
  { label: 'Débouchage', category: 'debouchage', icon: '🚿', type: 'primary' },
  { label: 'Pose de placo', category: 'plaquiste', icon: '🔳', subtitle: 'Plaquiste', type: 'intervention' },
  { label: 'Ramonage cheminée', category: 'ramonage', icon: '🔥', subtitle: 'Ramoneur', type: 'intervention' },
  { label: 'Entretien piscine', category: 'piscine', icon: '🏊', subtitle: 'Pisciniste', type: 'intervention' },
  { label: 'Pose store banne', category: 'store-banne', icon: '☀️', subtitle: 'Store Banne', type: 'intervention' },
  { label: 'Canalisation bouchée', category: 'debouchage', icon: '🚿', subtitle: 'Débouchage', type: 'intervention' },
  { label: 'Métallier / Ferronnier', category: 'metallerie', icon: '⚙️', type: 'primary' },
  { label: 'Portail métallique', category: 'metallerie', icon: '🚧', subtitle: 'Métallier', type: 'intervention' },
  { label: 'Grille de sécurité', category: 'metallerie', icon: '⚙️', subtitle: 'Ferronnier', type: 'intervention' },
  { label: 'Garde-corps', category: 'metallerie', icon: '🔩', subtitle: 'Métallier', type: 'intervention' },
]

// ------------------------------------------------------------------
// Fuzzy search utilities
// ------------------------------------------------------------------

export function normalizeForSearch(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  // Quick bail: if length diff > 2, skip full computation
  if (Math.abs(a.length - b.length) > 2) return 3
  const matrix: number[][] = []
  for (let i = 0; i <= a.length; i++) matrix[i] = [i]
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[a.length][b.length]
}

export function fuzzyMatchCategory(input: string): string | null {
  const norm = normalizeForSearch(input)
  if (!norm) return null

  // 1. Exact slug match
  if (CATEGORY_TO_METIERS[norm]) return norm

  // 2. Keyword exact match (each word of input)
  const words = norm.split(/\s+/).filter(w => w.length >= 2)
  for (const word of words) {
    if (KEYWORD_TO_CATEGORY[word]) return KEYWORD_TO_CATEGORY[word]
    if (CATEGORY_TO_METIERS[word]) return word
  }

  // 3. Prefix match on slugs and keywords (e.g. "plomb" → plomberie)
  for (const word of words) {
    if (word.length < 3) continue
    for (const slug of Object.keys(CATEGORY_TO_METIERS)) {
      if (slug.startsWith(word) || word.startsWith(slug)) return slug
    }
    for (const [kw, slug] of Object.entries(KEYWORD_TO_CATEGORY)) {
      if (kw.startsWith(word) || word.startsWith(kw)) return slug
    }
  }

  // 4. Levenshtein <= 2 on keywords and slugs
  for (const word of words) {
    if (word.length < 3) continue
    let bestDist = 3
    let bestSlug: string | null = null
    for (const [kw, slug] of Object.entries(KEYWORD_TO_CATEGORY)) {
      const d = levenshtein(word, kw)
      if (d < bestDist) { bestDist = d; bestSlug = slug }
    }
    for (const slug of Object.keys(CATEGORY_TO_METIERS)) {
      const d = levenshtein(word, slug)
      if (d < bestDist) { bestDist = d; bestSlug = slug }
    }
    if (bestSlug && bestDist <= 2) return bestSlug
  }

  return null
}

export function getCategoryLabel(cat: string, locale: 'fr' | 'pt' = 'fr'): string {
  const labels = locale === 'pt' ? CATEGORY_LABELS_PT : CATEGORY_LABELS_FR
  const resolved = labels[cat] ? cat : fuzzyMatchCategory(cat)
  if (resolved && labels[resolved]) return labels[resolved]
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

export function metierToCategory(metier: string): string {
  for (const [cat, metiers] of Object.entries(CATEGORY_TO_METIERS)) {
    if (metiers.includes(metier)) return cat
  }
  return metier.toLowerCase()
}
