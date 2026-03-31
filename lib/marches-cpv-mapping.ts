// ── Mapping métier BTP → Codes CPV + Mots-clés ─────────────────────────────
// Le cœur du filtrage intelligent : chaque métier est associé à ses codes CPV
// (nomenclature européenne des marchés publics) et des mots-clés de détection.

export interface MetierMapping {
  labelFr: string
  labelPt: string
  cpv: string[]
  /** Mots-clés forts : spécifiques au métier, utilisés pour le filtre BOAMP (haute précision) */
  strongKeywords: string[]
  /** Mots-clés larges : contextuels, utilisés uniquement pour le scoring post-fetch (pas pour le filtre API) */
  weakKeywords: string[]
  /** Rétrocompat : tous les keywords combinés */
  keywords: string[]
  keywordsPt: string[]
  categoryIds: string[]
}

export const METIER_CPV_MAP: Record<string, MetierMapping> = {
  couvreur: {
    labelFr: 'Couvreur',
    labelPt: 'Telhador',
    cpv: ['45261210', '45261900', '45261100', '45261200', '45261300', '45261410'],
    strongKeywords: ['couverture', 'toiture', 'couvreur', 'zinguerie', 'ardoise', 'tuile', 'toit', 'bac acier'],
    weakKeywords: ['étanchéité toiture', 'charpente', 'gouttière', 'faîtage', 'noue', 'zinc'],
    keywords: ['couverture', 'toiture', 'couvreur', 'zinguerie', 'ardoise', 'tuile', 'toit', 'bac acier', 'étanchéité toiture', 'charpente', 'gouttière', 'faîtage', 'noue', 'zinc'],
    keywordsPt: ['telhado', 'cobertura', 'telha', 'caleira', 'impermeabilização de cobertura', 'zinco', 'chapa'],
    categoryIds: ['telhados', 'impermeabilizacao'],
  },
  electricien: {
    labelFr: 'Électricien',
    labelPt: 'Eletricista',
    cpv: ['45310000', '45311000', '45311100', '45311200', '45315000', '45315100', '45315300', '45316000'],
    strongKeywords: ['électricité', 'installation électrique', 'tableau électrique', 'câblage', 'éclairage public', 'IRVE', 'borne de recharge'],
    weakKeywords: ['courant fort', 'courant faible', 'mise en conformité électrique', 'norme NF C 15-100'],
    keywords: ['électricité', 'installation électrique', 'tableau électrique', 'câblage', 'éclairage', 'IRVE', 'borne de recharge', 'courant fort', 'courant faible', 'mise en conformité électrique', 'norme NF C 15-100'],
    keywordsPt: ['eletricidade', 'cablagem', 'quadro elétrico', 'iluminação', 'instalação elétrica', 'ITED'],
    categoryIds: ['eletricidade'],
  },
  plombier: {
    labelFr: 'Plombier',
    labelPt: 'Canalizador',
    cpv: ['45330000', '45332000', '45332200', '45332300', '45332400'],
    strongKeywords: ['plomberie', 'plombier', 'sanitaire', 'canalisation', 'robinetterie', 'chauffe-eau'],
    weakKeywords: ['tuyauterie', 'adduction eau', 'assainissement', 'évacuation', 'ballon'],
    keywords: ['plomberie', 'plombier', 'sanitaire', 'canalisation', 'robinetterie', 'chauffe-eau', 'tuyauterie', 'adduction eau', 'assainissement', 'évacuation', 'ballon'],
    keywordsPt: ['canalização', 'tubagem', 'sanitário', 'torneira', 'esgoto', 'abastecimento água', 'canalizador'],
    categoryIds: ['canalizacao', 'desentupimentos'],
  },
  macon: {
    labelFr: 'Maçon',
    labelPt: 'Pedreiro',
    cpv: ['45262500', '45262000', '45223000', '45223200', '45223300', '45262300', '45262100'],
    strongKeywords: ['maçonnerie', 'gros œuvre', 'béton', 'parpaing', 'brique', 'fondation', 'démolition'],
    weakKeywords: ['mur', 'dalle', 'radier', 'élévation', 'terrassement', 'structure'],
    keywords: ['maçonnerie', 'gros œuvre', 'béton', 'parpaing', 'brique', 'fondation', 'démolition', 'mur', 'dalle', 'radier', 'élévation', 'terrassement', 'structure'],
    keywordsPt: ['alvenaria', 'fundação', 'betão', 'parede', 'tijolo', 'laje', 'demolição', 'terraplanagem', 'estrutura'],
    categoryIds: ['construcao'],
  },
  peintre: {
    labelFr: 'Peintre',
    labelPt: 'Pintor',
    cpv: ['45442100', '45442000', '45442110', '45442120', '45443000'],
    strongKeywords: ['peinture', 'peintre', 'ravalement', 'revêtement mural', 'papier peint'],
    weakKeywords: ['enduit', 'façade', 'décoration', 'laque', 'badigeon', 'crépi'],
    keywords: ['peinture', 'peintre', 'ravalement', 'revêtement mural', 'papier peint', 'enduit', 'façade', 'décoration', 'laque', 'badigeon', 'crépi'],
    keywordsPt: ['pintura', 'revestimento', 'fachada', 'estuque', 'reboco', 'decoração', 'pintor'],
    categoryIds: ['pintura'],
  },
  menuisier: {
    labelFr: 'Menuisier',
    labelPt: 'Carpinteiro',
    cpv: ['45421000', '45422000', '45421100', '45421130', '45421140', '45421150', '45421160'],
    strongKeywords: ['menuiserie', 'menuisier', 'fenêtre', 'huisserie', 'volet', 'parquet'],
    weakKeywords: ['porte', 'bois', 'escalier', 'agencement', 'placard', 'PVC', 'aluminium'],
    keywords: ['menuiserie', 'menuisier', 'fenêtre', 'huisserie', 'volet', 'parquet', 'porte', 'bois', 'escalier', 'agencement', 'placard', 'PVC', 'aluminium'],
    keywordsPt: ['carpintaria', 'janela', 'porta', 'madeira', 'caixilharia', 'estore', 'escada', 'soalho', 'carpinteiro'],
    categoryIds: ['carpintaria'],
  },
  chauffagiste: {
    labelFr: 'Chauffagiste / Climaticien',
    labelPt: 'Técnico AVAC',
    cpv: ['45331000', '45331100', '45331110', '45331200', '45331210', '45331220', '45331230'],
    strongKeywords: ['chauffage', 'climatisation', 'pompe à chaleur', 'chaudière', 'VMC', 'CVC'],
    weakKeywords: ['ventilation', 'CTA', 'plancher chauffant', 'radiateur', 'PAC', 'géothermie', 'HVAC'],
    keywords: ['chauffage', 'climatisation', 'pompe à chaleur', 'chaudière', 'VMC', 'CVC', 'ventilation', 'CTA', 'plancher chauffant', 'radiateur', 'PAC', 'géothermie', 'HVAC'],
    keywordsPt: ['aquecimento', 'climatização', 'bomba de calor', 'caldeira', 'ventilação', 'AVAC', 'ar condicionado', 'piso radiante'],
    categoryIds: ['climatizacao', 'gas'],
  },
  carreleur: {
    labelFr: 'Carreleur',
    labelPt: 'Ladrilhador',
    cpv: ['45431000', '45431100', '45431200', '45432100', '45432110', '45432111'],
    strongKeywords: ['carrelage', 'carreleur', 'faïence', 'grès cérame', 'revêtement de sol'],
    weakKeywords: ['mosaïque', 'chape', 'ragréage', 'pose de sol'],
    keywords: ['carrelage', 'carreleur', 'faïence', 'grès cérame', 'revêtement de sol', 'mosaïque', 'chape', 'ragréage', 'pose de sol'],
    keywordsPt: ['azulejo', 'ladrilho', 'mosaico', 'pavimento', 'revestimento de piso', 'cerâmica'],
    categoryIds: ['construcao', 'renovacao'],
  },
  serrurier: {
    labelFr: 'Serrurier / Métallier',
    labelPt: 'Serralheiro',
    cpv: ['45421160', '44316000', '45341000', '44316400', '45421148'],
    strongKeywords: ['serrurerie', 'serrurier', 'métallerie', 'ferronnerie', 'garde-corps', 'portail'],
    weakKeywords: ['grille', 'clôture', 'porte blindée', 'contrôle accès', 'acier'],
    keywords: ['serrurerie', 'serrurier', 'métallerie', 'ferronnerie', 'garde-corps', 'portail', 'grille', 'clôture', 'porte blindée', 'contrôle accès', 'acier'],
    keywordsPt: ['serralharia', 'grade', 'portão', 'ferro', 'guarda-corpo', 'vedação', 'serralheiro', 'aço'],
    categoryIds: ['serralharia', 'seguranca'],
  },
  paysagiste: {
    labelFr: 'Paysagiste / Jardinier',
    labelPt: 'Jardineiro / Paisagista',
    cpv: ['77310000', '77300000', '77311000', '77312000', '77313000', '77314000', '45112700'],
    strongKeywords: ['espaces verts', 'élagage', 'paysage', 'engazonnement', 'tonte'],
    weakKeywords: ['plantation', 'jardin', 'arrosage', 'abattage', 'haie', 'parc'],
    keywords: ['espaces verts', 'élagage', 'paysage', 'engazonnement', 'tonte', 'plantation', 'jardin', 'arrosage', 'abattage', 'haie', 'parc'],
    keywordsPt: ['espaços verdes', 'poda', 'plantação', 'jardim', 'paisagismo', 'rega', 'relva', 'sebe', 'parque'],
    categoryIds: ['jardinagem'],
  },
  isolation: {
    labelFr: 'Isolation / Façadier',
    labelPt: 'Isolamento',
    cpv: ['45320000', '45321000', '45323000', '45324000'],
    strongKeywords: ['isolation thermique', 'isolation phonique', 'ITE', 'bardage', 'rénovation énergétique'],
    weakKeywords: ['isolation', 'laine de verre', 'laine de roche', 'polystyrène', 'soufflage', 'RGE'],
    keywords: ['isolation thermique', 'isolation phonique', 'ITE', 'bardage', 'rénovation énergétique', 'isolation', 'laine de verre', 'laine de roche', 'polystyrène', 'soufflage', 'RGE'],
    keywordsPt: ['isolamento', 'isolamento térmico', 'isolamento acústico', 'capoto', 'ETICS', 'poliestireno', 'lã de rocha'],
    categoryIds: ['isolamento'],
  },
  renovation: {
    labelFr: 'Rénovation générale',
    labelPt: 'Renovação geral',
    cpv: ['45454000', '45454100', '45453000', '45400000', '45210000'],
    strongKeywords: ['rénovation', 'réhabilitation', 'réfection', 'tous corps d\'état', 'TCE'],
    weakKeywords: ['aménagement', 'second œuvre', 'travaux intérieurs', 'mise aux normes'],
    keywords: ['rénovation', 'réhabilitation', 'réfection', 'tous corps d\'état', 'TCE', 'aménagement', 'second œuvre', 'travaux intérieurs', 'mise aux normes'],
    keywordsPt: ['renovação', 'reabilitação', 'remodelação', 'obras interiores', 'obras de melhoramento'],
    categoryIds: ['renovacao', 'construcao'],
  },
  nettoyage: {
    labelFr: 'Nettoyage',
    labelPt: 'Limpeza',
    cpv: ['90910000', '90911000', '90911200', '90919000', '90914000'],
    strongKeywords: ['nettoyage', 'propreté', 'nettoyage industriel'],
    weakKeywords: ['entretien', 'ménage', 'désinfection', 'parties communes'],
    keywords: ['nettoyage', 'propreté', 'nettoyage industriel', 'entretien', 'ménage', 'désinfection', 'parties communes'],
    keywordsPt: ['limpeza', 'higienização', 'desinfeção', 'manutenção', 'partes comuns'],
    categoryIds: ['limpeza'],
  },
  ascenseur: {
    labelFr: 'Ascensoriste',
    labelPt: 'Elevadores',
    cpv: ['42416000', '42416100', '42416200', '50750000', '45313100'],
    strongKeywords: ['ascenseur', 'élévateur', 'monte-charge'],
    weakKeywords: ['maintenance ascenseur', 'modernisation ascenseur', 'mise en conformité ascenseur'],
    keywords: ['ascenseur', 'élévateur', 'monte-charge', 'maintenance ascenseur', 'modernisation ascenseur', 'mise en conformité ascenseur'],
    keywordsPt: ['elevador', 'monta-cargas', 'manutenção elevador', 'modernização elevador'],
    categoryIds: ['elevadores'],
  },
  vitrerie: {
    labelFr: 'Vitrier / Miroitier',
    labelPt: 'Vidraceiro',
    cpv: ['45441000', '44221000', '44221100'],
    strongKeywords: ['vitrerie', 'vitrier', 'vitrage', 'miroiterie', 'double vitrage'],
    weakKeywords: ['verre', 'vitrine'],
    keywords: ['vitrerie', 'vitrier', 'vitrage', 'miroiterie', 'double vitrage', 'verre', 'vitrine'],
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

/**
 * Résout des identifiants métier mixtes (clés METIER_CPV_MAP, categoryIds,
 * labels FR/PT, ou texte libre) vers les clés canoniques du mapping.
 * Ex: ['telhados', 'couvreur', 'Électricien', 'plomberie'] → ['couvreur', 'electricien', 'plombier']
 */
export function resolveMetierKeys(inputs: string[]): string[] {
  const resolved = new Set<string>()

  // Build reverse index: categoryId → metier key
  const catIdToMetier = new Map<string, string>()
  const labelToMetier = new Map<string, string>()
  for (const [key, m] of Object.entries(METIER_CPV_MAP)) {
    for (const cid of m.categoryIds) {
      catIdToMetier.set(cid.toLowerCase(), key)
    }
    labelToMetier.set(m.labelFr.toLowerCase(), key)
    labelToMetier.set(m.labelPt.toLowerCase(), key)
  }

  for (const input of inputs) {
    const lower = input.toLowerCase().trim()
    if (!lower) continue

    // Direct match on metier key
    if (METIER_CPV_MAP[lower]) {
      resolved.add(lower)
      continue
    }

    // Match on categoryId
    if (catIdToMetier.has(lower)) {
      resolved.add(catIdToMetier.get(lower)!)
      continue
    }

    // Match on label FR/PT
    if (labelToMetier.has(lower)) {
      resolved.add(labelToMetier.get(lower)!)
      continue
    }

    // Fuzzy: check if input is substring of any keyword
    for (const [key, m] of Object.entries(METIER_CPV_MAP)) {
      const allKw = [...m.keywords, ...m.keywordsPt, ...m.categoryIds]
      if (allKw.some(kw => kw.toLowerCase().includes(lower) || lower.includes(kw.toLowerCase()))) {
        resolved.add(key)
        break
      }
    }
  }

  return [...resolved]
}
