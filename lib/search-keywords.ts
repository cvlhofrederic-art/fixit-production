// Mots-clés de recherche par catégorie (FR + PT)
// Utilisés par l'autocomplete du champ "Type de service" sur la landing page.
// Un mot-clé saisi (ex: "fuite", "piscina", "chape béton") route vers le bon slug.

export interface ServiceKeywords {
  slug: string
  fr: string[] // label principal en 1er, puis motifs courants
  pt: string[] // idem PT
}

export const SERVICE_KEYWORDS: ServiceKeywords[] = [
  {
    slug: 'plomberie',
    fr: ['Plomberie', 'plombier', 'fuite', 'fuite eau', 'robinet', 'robinetterie', 'chauffe-eau', 'ballon eau chaude', 'cumulus', 'WC', 'toilettes', 'chasse d\'eau', 'évier', 'lavabo', 'douche', 'baignoire', 'mitigeur', 'siphon', 'canalisation', 'tuyau percé', 'pression eau', 'remplacement robinet'],
    pt: ['Canalização', 'canalizador', 'fuga', 'fuga de água', 'torneira', 'esquentador', 'cilindro', 'sanita', 'autoclismo', 'pia', 'lavatório', 'chuveiro', 'banheira', 'misturadora', 'sifão', 'cano', 'tubagem', 'pressão de água', 'substituição torneira'],
  },
  {
    slug: 'electricite',
    fr: ['Électricité', 'électricien', 'panne électrique', 'prise', 'interrupteur', 'tableau électrique', 'disjoncteur', 'court-circuit', 'coupure courant', 'mise aux normes', 'installation prise', 'domotique', 'éclairage', 'spots', 'luminaire', 'VMC', 'coffret', 'différentiel'],
    pt: ['Eletricidade', 'eletricista', 'avaria elétrica', 'tomada', 'interruptor', 'quadro elétrico', 'disjuntor', 'curto-circuito', 'corte de corrente', 'domótica', 'iluminação', 'focos', 'candeeiro', 'VMC', 'diferencial', 'certificação elétrica'],
  },
  {
    slug: 'serrurerie',
    fr: ['Serrurerie', 'serrurier', 'clé cassée', 'porte claquée', 'porte bloquée', 'cylindre', 'barillet', 'serrure', 'blindage porte', 'ouverture porte', 'perte de clés', 'effraction', 'changement serrure', 'clé coincée'],
    pt: ['Serralharia', 'serralheiro', 'chave partida', 'porta fechada', 'porta bloqueada', 'canhão', 'fechadura', 'blindagem porta', 'abertura de porta', 'perda de chaves', 'arrombamento', 'substituição fechadura'],
  },
  {
    slug: 'chauffage',
    fr: ['Chauffage', 'chauffagiste', 'chaudière', 'radiateur', 'pompe à chaleur', 'PAC', 'plancher chauffant', 'entretien chaudière', 'gaz', 'fioul', 'thermostat', 'chauffage central', 'chaudière gaz', 'chaudière fioul', 'désembouage', 'révision chaudière'],
    pt: ['Aquecimento', 'técnico aquecimento', 'caldeira', 'radiador', 'bomba de calor', 'piso radiante', 'manutenção caldeira', 'gás', 'gasóleo', 'termostato', 'aquecimento central', 'revisão caldeira'],
  },
  {
    slug: 'peinture',
    fr: ['Peinture', 'peintre', 'peinture intérieure', 'peinture extérieure', 'façade', 'ravalement', 'enduit', 'papier peint', 'lasure', 'vernis', 'rafraîchissement peinture', 'peinture plafond', 'peinture mur'],
    pt: ['Pintura', 'pintor', 'pintura interior', 'pintura exterior', 'fachada', 'reboco', 'papel de parede', 'verniz', 'pintura teto', 'pintura parede'],
  },
  {
    slug: 'maconnerie',
    fr: ['Maçonnerie', 'maçon', 'mur', 'muret', 'dalle béton', 'chape béton', 'chape', 'fondation', 'enduit extérieur', 'parpaings', 'brique', 'démolition', 'ouverture mur porteur', 'IPN', 'linteau', 'escalier béton', 'cheminée béton'],
    pt: ['Alvenaria', 'pedreiro', 'parede', 'muro', 'laje betão', 'chapa betão', 'chapa de betão', 'fundação', 'reboco exterior', 'blocos', 'tijolo', 'demolição', 'abertura parede', 'lintel', 'escada betão'],
  },
  {
    slug: 'menuiserie',
    fr: ['Menuiserie', 'menuisier', 'porte intérieure', 'fenêtre bois', 'placard', 'dressing', 'escalier bois', 'parquet', 'plinthe', 'meuble sur mesure', 'terrasse bois', 'pergola bois'],
    pt: ['Carpintaria', 'carpinteiro', 'porta interior', 'janela madeira', 'roupeiro', 'closet', 'escada madeira', 'soalho', 'rodapé', 'móvel por medida', 'deque', 'pérgola'],
  },
  {
    slug: 'toiture',
    fr: ['Toiture', 'couvreur', 'toit', 'tuile', 'ardoise', 'fuite toiture', 'infiltration', 'gouttière', 'zinguerie', 'velux', 'fenêtre de toit', 'charpente', 'démoussage toiture', 'étanchéité toit'],
    pt: ['Telhado', 'telhadista', 'telha', 'ardósia', 'infiltração', 'caleira', 'velux', 'janela telhado', 'estrutura', 'impermeabilização telhado', 'limpeza telhado'],
  },
  {
    slug: 'climatisation',
    fr: ['Climatisation', 'clim', 'installation climatisation', 'pompe à chaleur air-air', 'split', 'multi-split', 'entretien clim', 'recharge gaz clim'],
    pt: ['Ar condicionado', 'instalação ar condicionado', 'split', 'multi-split', 'manutenção AC', 'recarga gás AC'],
  },
  {
    slug: 'demenagement',
    fr: ['Déménagement', 'déménageur', 'transport meubles', 'monte-meubles', 'emballage', 'débarras', 'location utilitaire', 'garde-meubles'],
    pt: ['Mudanças', 'transporte mobiliário', 'elevador de mudanças', 'embalagem', 'despejo', 'guarda-móveis'],
  },
  {
    slug: 'renovation',
    fr: ['Rénovation', 'réhabilitation', 'travaux globaux', 'rénovation appartement', 'rénovation maison', 'rénovation cuisine', 'rénovation salle de bain', 'rénovation énergétique'],
    pt: ['Renovação', 'reabilitação', 'obras de renovação', 'remodelação apartamento', 'remodelação casa', 'remodelação cozinha', 'remodelação casa de banho', 'renovação energética'],
  },
  {
    slug: 'vitrerie',
    fr: ['Vitrerie', 'vitrier', 'vitre cassée', 'double vitrage', 'triple vitrage', 'miroir', 'véranda', 'fenêtre alu', 'pare-douche', 'remplacement vitre'],
    pt: ['Vidraçaria', 'vidraceiro', 'vidro partido', 'vidro duplo', 'vidro triplo', 'espelho', 'marquise', 'janela alumínio', 'substituição vidro'],
  },
  {
    slug: 'petits-travaux',
    fr: ['Petits travaux', 'bricolage', 'homme toutes mains', 'handyman', 'petite réparation', 'montage meuble', 'fixation étagère', 'pose tringle'],
    pt: ['Pequenas obras', 'bricolage', 'faz-tudo', 'pequena reparação', 'montagem móvel', 'fixação prateleira'],
  },
  {
    slug: 'espaces-verts',
    fr: ['Espaces verts', 'jardinier', 'jardin', 'tonte pelouse', 'taille haie', 'élagage', 'abattage arbre', 'plantation', 'arrosage automatique', 'entretien jardin'],
    pt: ['Espaços verdes', 'jardineiro', 'jardim', 'corte de relva', 'poda sebes', 'poda', 'abate árvore', 'plantação', 'rega automática', 'manutenção jardim'],
  },
  {
    slug: 'nettoyage',
    fr: ['Nettoyage', 'ménage', 'femme de ménage', 'nettoyage appartement', 'nettoyage vitres', 'nettoyage sol'],
    pt: ['Limpeza', 'empregada limpeza', 'limpeza apartamento', 'limpeza vidros', 'limpeza pavimento'],
  },
  {
    slug: 'traitement-nuisibles',
    fr: ['Traitement nuisibles', 'désinsectisation', 'dératisation', 'désinfection', 'cafards', 'punaises de lit', 'rats', 'souris', 'guêpes', 'frelons', 'pigeons'],
    pt: ['Controlo de pragas', 'desinsetização', 'desratização', 'desinfeção', 'baratas', 'percevejos', 'ratos', 'vespas', 'formigas', 'pombos'],
  },
  {
    slug: 'amenagement-exterieur',
    fr: ['Aménagement extérieur', 'terrasse', 'dalle terrasse', 'allée de jardin', 'clôture', 'portail', 'pergola', 'pavage', 'gazon synthétique'],
    pt: ['Arranjos exteriores', 'terraço', 'deque terraço', 'caminho jardim', 'vedação', 'portão', 'pérgola', 'pavimento', 'relva sintética'],
  },
  {
    slug: 'carrelage',
    fr: ['Carrelage', 'carreleur', 'pose carrelage', 'faïence', 'joint carrelage', 'mosaïque', 'grès cérame', 'remplacement carrelage', 'carrelage salle de bain', 'carrelage cuisine'],
    pt: ['Azulejos', 'ladrilhador', 'colocação azulejos', 'revestimento cerâmico', 'juntas azulejos', 'mosaico', 'grês', 'azulejo casa de banho', 'azulejo cozinha'],
  },
  {
    slug: 'diagnostic',
    fr: ['Diagnostic', 'diagnostic immobilier', 'DPE', 'amiante', 'plomb', 'termites', 'électrique', 'gaz', 'audit énergétique'],
    pt: ['Diagnóstico', 'certificação energética', 'DPE', 'amianto', 'chumbo', 'térmitas', 'auditoria energética'],
  },
  {
    slug: 'nettoyage-travaux',
    fr: ['Nettoyage après travaux', 'nettoyage fin de chantier', 'dépoussiérage', 'enlèvement gravats'],
    pt: ['Limpeza pós-obras', 'limpeza fim de obra', 'remoção de entulho'],
  },
  {
    slug: 'nettoyage-copro',
    fr: ['Nettoyage copropriété', 'parties communes', 'entretien immeuble', 'hall d\'entrée', 'escalier immeuble'],
    pt: ['Limpeza condomínio', 'partes comuns', 'manutenção prédio', 'hall entrada', 'escadas prédio'],
  },
  {
    slug: 'nettoyage-industriel',
    fr: ['Nettoyage industriel', 'nettoyage entrepôt', 'nettoyage usine', 'nettoyage haute pression', 'décontamination'],
    pt: ['Limpeza industrial', 'limpeza armazém', 'limpeza fábrica', 'limpeza alta pressão', 'descontaminação'],
  },
  {
    slug: 'plaquiste',
    fr: ['Plaquiste', 'placo', 'cloison placo', 'faux plafond', 'doublage', 'isolation placo', 'BA13'],
    pt: ['Pladur', 'gesso cartonado', 'parede pladur', 'teto falso', 'duplagem', 'isolamento pladur'],
  },
  {
    slug: 'piscine',
    fr: ['Piscine', 'pisciniste', 'construction piscine', 'entretien piscine', 'liner', 'filtre piscine', 'pompe piscine', 'hivernage', 'bâche piscine', 'local technique'],
    pt: ['Piscina', 'técnico de piscinas', 'construção piscina', 'manutenção piscina', 'liner', 'filtro piscina', 'bomba piscina', 'invernagem', 'cobertura piscina'],
  },
  {
    slug: 'ramonage',
    fr: ['Ramonage', 'ramoneur', 'cheminée', 'poêle à bois', 'insert', 'conduit fumée', 'certificat ramonage'],
    pt: ['Limpeza de chaminé', 'chaminé', 'salamandra', 'recuperador de calor', 'conduta fumos', 'certificado limpeza'],
  },
  {
    slug: 'store-banne',
    fr: ['Store banne', 'store', 'installation store', 'réparation store', 'motorisation store', 'toile store'],
    pt: ['Toldo', 'instalação toldo', 'reparação toldo', 'motorização toldo', 'tela toldo'],
  },
  {
    slug: 'debouchage',
    fr: ['Débouchage', 'canalisation bouchée', 'évier bouché', 'WC bouché', 'douche bouchée', 'furet', 'hydrocurage', 'pompage fosse'],
    pt: ['Desentupimento', 'cano entupido', 'pia entupida', 'sanita entupida', 'ducha entupida', 'limpeza fossa', 'desobstrução tubagem'],
  },
  {
    slug: 'metallerie',
    fr: ['Métallerie', 'ferronnerie', 'garde-corps', 'portail métal', 'rampe escalier', 'grille défense', 'verrière atelier', 'structure métallique'],
    pt: ['Serralharia civil', 'ferro forjado', 'guarda-corpos', 'portão metálico', 'corrimão escada', 'grade segurança', 'estrutura metálica'],
  },
]

export interface ServiceSuggestion {
  slug: string
  label: string // nom principal de la catégorie (1er élément de fr/pt)
  match: string // mot-clé qui a matché
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function searchServices(query: string, locale: 'fr' | 'pt', limit = 10): ServiceSuggestion[] {
  const raw = query.trim()
  const out: ServiceSuggestion[] = []
  const seen = new Set<string>()

  // Sans requete : renvoie les 8 premieres categories (featured) pour montrer le dropdown au focus
  if (raw.length < 1) {
    for (const cat of SERVICE_KEYWORDS.slice(0, 8)) {
      const list = locale === 'pt' ? cat.pt : cat.fr
      if (!list.length) continue
      out.push({ slug: cat.slug, label: list[0], match: list[0] })
    }
    return out.slice(0, limit)
  }

  const q = norm(raw)
  for (const cat of SERVICE_KEYWORDS) {
    const list = locale === 'pt' ? cat.pt : cat.fr
    if (!list.length) continue
    const label = list[0]
    // startsWith prioritaire
    let matched: string | null = null
    for (const kw of list) {
      if (norm(kw).startsWith(q)) { matched = kw; break }
    }
    if (!matched) {
      for (const kw of list) {
        if (norm(kw).includes(q)) { matched = kw; break }
      }
    }
    if (matched && !seen.has(cat.slug)) {
      seen.add(cat.slug)
      out.push({ slug: cat.slug, label, match: matched })
      if (out.length >= limit) break
    }
  }
  return out
}
