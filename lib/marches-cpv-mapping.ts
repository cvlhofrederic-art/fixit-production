// ── Mapping métier BTP → Codes CPV + Mots-clés ─────────────────────────────
// Le cœur du filtrage intelligent : chaque métier est associé à ses codes CPV
// (nomenclature européenne des marchés publics) et des mots-clés de détection.

export interface MetierMapping {
  labelFr: string
  labelPt: string
  cpv: string[]
  keywords: string[]
  keywordsPt: string[]
  categoryIds: string[] // IDs des catégories existantes dans BourseAuxMarchesSection
}

export const METIER_CPV_MAP: Record<string, MetierMapping> = {
  couvreur: {
    labelFr: 'Couvreur',
    labelPt: 'Telhador',
    cpv: ['45261210', '45261900', '45261100', '45261200', '45261300', '45261410'],
    keywords: ['couverture', 'toiture', 'zinguerie', 'étanchéité toiture', 'charpente', 'ardoise', 'tuile', 'gouttière', 'faîtage', 'noue', 'toit', 'couvreur', 'zinc', 'bac acier'],
    keywordsPt: ['telhado', 'cobertura', 'telha', 'caleira', 'impermeabilização de cobertura', 'zinco', 'chapa'],
    categoryIds: ['telhados', 'impermeabilizacao'],
  },
  electricien: {
    labelFr: 'Électricien',
    labelPt: 'Eletricista',
    cpv: ['45310000', '45311000', '45311100', '45311200', '45315000', '45315100', '45315300', '45316000'],
    keywords: ['électricité', 'câblage', 'tableau électrique', 'courant fort', 'courant faible', 'éclairage', 'installation électrique', 'mise en conformité électrique', 'norme NF C 15-100', 'IRVE', 'borne de recharge'],
    keywordsPt: ['eletricidade', 'cablagem', 'quadro elétrico', 'iluminação', 'instalação elétrica', 'ITED'],
    categoryIds: ['eletricidade'],
  },
  plombier: {
    labelFr: 'Plombier',
    labelPt: 'Canalizador',
    cpv: ['45330000', '45332000', '45332200', '45332300', '45332400'],
    keywords: ['plomberie', 'canalisation', 'sanitaire', 'robinetterie', 'tuyauterie', 'adduction eau', 'assainissement', 'évacuation', 'chauffe-eau', 'ballon', 'plombier'],
    keywordsPt: ['canalização', 'tubagem', 'sanitário', 'torneira', 'esgoto', 'abastecimento água', 'canalizador'],
    categoryIds: ['canalizacao', 'desentupimentos'],
  },
  macon: {
    labelFr: 'Maçon',
    labelPt: 'Pedreiro',
    cpv: ['45262500', '45262000', '45223000', '45223200', '45223300', '45262300', '45262100'],
    keywords: ['maçonnerie', 'gros œuvre', 'fondation', 'béton', 'mur', 'parpaing', 'brique', 'dalle', 'radier', 'élévation', 'démolition', 'terrassement', 'structure'],
    keywordsPt: ['alvenaria', 'fundação', 'betão', 'parede', 'tijolo', 'laje', 'demolição', 'terraplanagem', 'estrutura'],
    categoryIds: ['construcao'],
  },
  peintre: {
    labelFr: 'Peintre',
    labelPt: 'Pintor',
    cpv: ['45442100', '45442000', '45442110', '45442120', '45443000'],
    keywords: ['peinture', 'ravalement', 'enduit', 'façade', 'décoration', 'revêtement mural', 'papier peint', 'laque', 'peintre', 'badigeon', 'crépi'],
    keywordsPt: ['pintura', 'revestimento', 'fachada', 'estuque', 'reboco', 'decoração', 'pintor'],
    categoryIds: ['pintura'],
  },
  menuisier: {
    labelFr: 'Menuisier',
    labelPt: 'Carpinteiro',
    cpv: ['45421000', '45422000', '45421100', '45421130', '45421140', '45421150', '45421160'],
    keywords: ['menuiserie', 'fenêtre', 'porte', 'bois', 'huisserie', 'volet', 'parquet', 'escalier', 'agencement', 'placard', 'PVC', 'aluminium', 'menuisier'],
    keywordsPt: ['carpintaria', 'janela', 'porta', 'madeira', 'caixilharia', 'estore', 'escada', 'soalho', 'carpinteiro'],
    categoryIds: ['carpintaria'],
  },
  chauffagiste: {
    labelFr: 'Chauffagiste / Climaticien',
    labelPt: 'Técnico AVAC',
    cpv: ['45331000', '45331100', '45331110', '45331200', '45331210', '45331220', '45331230'],
    keywords: ['chauffage', 'climatisation', 'pompe à chaleur', 'chaudière', 'VMC', 'ventilation', 'CTA', 'plancher chauffant', 'radiateur', 'PAC', 'géothermie', 'CVC', 'HVAC'],
    keywordsPt: ['aquecimento', 'climatização', 'bomba de calor', 'caldeira', 'ventilação', 'AVAC', 'ar condicionado', 'piso radiante'],
    categoryIds: ['climatizacao', 'gas'],
  },
  carreleur: {
    labelFr: 'Carreleur',
    labelPt: 'Ladrilhador',
    cpv: ['45431000', '45431100', '45431200', '45432100', '45432110', '45432111'],
    keywords: ['carrelage', 'faïence', 'mosaïque', 'sol', 'revêtement de sol', 'grès cérame', 'chape', 'ragréage', 'carreleur', 'pose de sol'],
    keywordsPt: ['azulejo', 'ladrilho', 'mosaico', 'pavimento', 'revestimento de piso', 'cerâmica'],
    categoryIds: ['construcao', 'renovacao'],
  },
  serrurier: {
    labelFr: 'Serrurier / Métallier',
    labelPt: 'Serralheiro',
    cpv: ['45421160', '44316000', '45341000', '44316400', '45421148'],
    keywords: ['serrurerie', 'métallerie', 'grille', 'portail', 'ferronnerie', 'garde-corps', 'clôture', 'porte blindée', 'contrôle accès', 'serrurier', 'acier'],
    keywordsPt: ['serralharia', 'grade', 'portão', 'ferro', 'guarda-corpo', 'vedação', 'serralheiro', 'aço'],
    categoryIds: ['serralharia', 'seguranca'],
  },
  paysagiste: {
    labelFr: 'Paysagiste / Jardinier',
    labelPt: 'Jardineiro / Paisagista',
    cpv: ['77310000', '77300000', '77311000', '77312000', '77313000', '77314000', '45112700'],
    keywords: ['espaces verts', 'élagage', 'plantation', 'jardin', 'paysage', 'engazonnement', 'arrosage', 'abattage', 'tonte', 'haie', 'parc'],
    keywordsPt: ['espaços verdes', 'poda', 'plantação', 'jardim', 'paisagismo', 'rega', 'relva', 'sebe', 'parque'],
    categoryIds: ['jardinagem'],
  },
  isolation: {
    labelFr: 'Isolation / Façadier',
    labelPt: 'Isolamento',
    cpv: ['45320000', '45321000', '45323000', '45324000'],
    keywords: ['isolation', 'ITE', 'isolation thermique', 'isolation phonique', 'laine de verre', 'laine de roche', 'polystyrène', 'soufflage', 'RGE', 'rénovation énergétique', 'bardage'],
    keywordsPt: ['isolamento', 'isolamento térmico', 'isolamento acústico', 'capoto', 'ETICS', 'poliestireno', 'lã de rocha'],
    categoryIds: ['isolamento'],
  },
  renovation: {
    labelFr: 'Rénovation générale',
    labelPt: 'Renovação geral',
    cpv: ['45454000', '45454100', '45453000', '45400000', '45210000'],
    keywords: ['rénovation', 'réhabilitation', 'aménagement', 'second œuvre', 'travaux intérieurs', 'réfection', 'mise aux normes', 'tous corps d\'état', 'TCE'],
    keywordsPt: ['renovação', 'reabilitação', 'remodelação', 'obras interiores', 'obras de melhoramento'],
    categoryIds: ['renovacao', 'construcao'],
  },
  nettoyage: {
    labelFr: 'Nettoyage',
    labelPt: 'Limpeza',
    cpv: ['90910000', '90911000', '90911200', '90919000', '90914000'],
    keywords: ['nettoyage', 'entretien', 'propreté', 'ménage', 'désinfection', 'parties communes', 'nettoyage industriel'],
    keywordsPt: ['limpeza', 'higienização', 'desinfeção', 'manutenção', 'partes comuns'],
    categoryIds: ['limpeza'],
  },
  ascenseur: {
    labelFr: 'Ascensoriste',
    labelPt: 'Elevadores',
    cpv: ['42416000', '42416100', '42416200', '50750000', '45313100'],
    keywords: ['ascenseur', 'élévateur', 'monte-charge', 'maintenance ascenseur', 'modernisation ascenseur', 'mise en conformité ascenseur'],
    keywordsPt: ['elevador', 'monta-cargas', 'manutenção elevador', 'modernização elevador'],
    categoryIds: ['elevadores'],
  },
  vitrerie: {
    labelFr: 'Vitrier / Miroitier',
    labelPt: 'Vidraceiro',
    cpv: ['45441000', '44221000', '44221100'],
    keywords: ['vitrerie', 'vitrage', 'miroiterie', 'double vitrage', 'verre', 'vitrine', 'vitrier'],
    keywordsPt: ['vidraçaria', 'vidro', 'vidro duplo', 'montra', 'vidraceiro'],
    categoryIds: ['vidracaria'],
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Tous les codes CPV couverts */
export function getAllCPVCodes(): string[] {
  const set = new Set<string>()
  for (const m of Object.values(METIER_CPV_MAP)) {
    m.cpv.forEach(c => set.add(c))
  }
  return [...set]
}

/** Trouver les métiers qui matchent un code CPV */
export function findMetiersByCPV(cpvCode: string): string[] {
  return Object.entries(METIER_CPV_MAP)
    .filter(([, m]) => m.cpv.some(c => cpvCode.startsWith(c) || c.startsWith(cpvCode)))
    .map(([key]) => key)
}

/** Trouver les métiers qui matchent un texte (titre + description) */
export function findMetiersByText(text: string, country: 'FR' | 'PT' = 'FR'): { metier: string; score: number }[] {
  const lower = text.toLowerCase()
  const results: { metier: string; score: number }[] = []

  for (const [key, mapping] of Object.entries(METIER_CPV_MAP)) {
    const kw = country === 'PT' ? [...mapping.keywords, ...mapping.keywordsPt] : mapping.keywords
    let matchCount = 0
    for (const word of kw) {
      if (lower.includes(word.toLowerCase())) matchCount++
    }
    if (matchCount > 0) {
      results.push({ metier: key, score: Math.min(matchCount / kw.length * 100, 100) })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

/** CPV codes pour un métier donné */
export function getCPVForMetier(metier: string): string[] {
  return METIER_CPV_MAP[metier]?.cpv || []
}
