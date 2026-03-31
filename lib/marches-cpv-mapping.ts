// ── Mapping métier BTP → Codes CPV + Mots-clés ─────────────────────────────
// Le cœur du filtrage intelligent : chaque métier est associé à ses codes CPV
// (nomenclature européenne des marchés publics) et des mots-clés de détection.
// Les strongKeywords sont utilisés pour le filtre BOAMP API (haute précision).
// Les weakKeywords sont utilisés pour le scoring post-fetch uniquement.
// IMPORTANT : chaque categoryId du dropdown UI doit mapper vers au moins 1 métier.

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
  // ─── COUVREUR ──────────────────────────────────────────────────────────────
  couvreur: {
    labelFr: 'Couvreur',
    labelPt: 'Telhador',
    cpv: ['45261210', '45261900', '45261100', '45261200', '45261300', '45261410'],
    strongKeywords: [
      'couverture', 'toiture', 'couvreur', 'zinguerie', 'ardoise', 'tuile', 'toit',
      'bac acier', 'étanchéité', 'charpente', 'lot couverture', 'lot toiture',
      'lot charpente', 'réfection couverture', 'réfection toiture', 'refection toiture',
      'travaux couverture', 'travaux toiture', 'travaux de couverture', 'travaux de toiture',
      'réfection de toiture', 'remise en état toiture', 'reprise de couverture',
    ],
    weakKeywords: [
      'gouttière', 'faîtage', 'faitage', 'noue', 'zinc', 'cheneau', 'chéneau',
      'descente EP', 'descente eaux pluviales', 'étanchéité terrasse', 'membrane',
      'pare-vapeur', 'sous-toiture', 'lucarne', 'vélux', 'velux', 'combles',
      'surtoiture', 'solins', 'rive', 'égout de toit', 'lauze', 'fibrociment',
      'désamiantage toiture', 'couverture zinc', 'couverture tuiles', 'couverture ardoise',
      'écran sous toiture', 'ventilation toiture', 'fenêtre de toit', 'tabatière',
      'abergement', 'solin', 'bavette', 'bandeau de rive', 'planche de rive',
      'rampant', 'panne', 'chevron', 'liteau', 'voliges', 'lattage',
    ],
    keywords: ['couverture', 'toiture', 'couvreur', 'zinguerie', 'ardoise', 'tuile', 'toit', 'bac acier', 'étanchéité', 'charpente', 'gouttière', 'faîtage', 'noue', 'zinc', 'membrane', 'combles', 'solins'],
    keywordsPt: ['telhado', 'cobertura', 'telha', 'caleira', 'impermeabilização de cobertura', 'zinco', 'chapa', 'mansarda', 'cumeeira', 'beiral'],
    categoryIds: ['telhados', 'impermeabilizacao'],
  },

  // ─── ÉLECTRICIEN ───────────────────────────────────────────────────────────
  electricien: {
    labelFr: 'Électricien',
    labelPt: 'Eletricista',
    cpv: ['45310000', '45311000', '45311100', '45311200', '45315000', '45315100', '45315300', '45316000'],
    strongKeywords: [
      'électricité', 'electricite', 'installation électrique', 'tableau électrique',
      'câblage', 'éclairage public', 'éclairage', 'eclairage', 'IRVE',
      'borne de recharge', 'lot électricité', 'lot electricite', 'lot CFO', 'lot CFA',
      'courant fort', 'courant faible', 'travaux électriques', 'travaux electriques',
      'rénovation électrique', 'mise en conformité électrique', 'installation electrique',
    ],
    weakKeywords: [
      'norme NF C 15-100', 'disjoncteur', 'armoire électrique', 'chemin de câble',
      'GTL', 'TGBT', 'photovoltaïque', 'panneaux solaires', 'luminaire',
      'détection incendie', 'SSI', 'alarme incendie', 'vidéosurveillance',
      'contrôle accès', 'interphonie', 'domotique', 'haute tension', 'basse tension',
      'transformateur', 'groupe électrogène', 'onduleur', 'parafoudre', 'prise de terre',
      'terre', 'réseau informatique', 'fibre optique', 'colonne montante électrique',
      'compteur', 'Enedis', 'raccordement électrique',
    ],
    keywords: ['électricité', 'installation électrique', 'tableau électrique', 'câblage', 'éclairage', 'IRVE', 'borne de recharge', 'courant fort', 'courant faible', 'TGBT', 'photovoltaïque'],
    keywordsPt: ['eletricidade', 'cablagem', 'quadro elétrico', 'iluminação', 'instalação elétrica', 'ITED', 'corrente forte', 'corrente fraca'],
    categoryIds: ['eletricidade'],
  },

  // ─── PLOMBIER ──────────────────────────────────────────────────────────────
  plombier: {
    labelFr: 'Plombier',
    labelPt: 'Canalizador',
    cpv: ['45330000', '45332000', '45332200', '45332300', '45332400'],
    strongKeywords: [
      'plomberie', 'plombier', 'sanitaire', 'canalisation', 'robinetterie',
      'chauffe-eau', 'lot plomberie', 'lot sanitaire', 'travaux plomberie',
      'installation sanitaire', 'réseaux sanitaires', 'travaux sanitaires',
      'adduction eau', 'réseau eau', 'eau potable',
    ],
    weakKeywords: [
      'tuyauterie', 'assainissement', 'évacuation', 'ballon', 'ECS',
      'eau chaude sanitaire', 'production eau chaude', 'colonne montante',
      'nourrice', 'collecteur', 'WC', 'douche', 'lavabo', 'baignoire',
      'réseaux EU', 'eaux usées', 'eaux pluviales', 'vidange', 'fosse septique',
      'tout-à-l\'égout', 'branchement eau', 'compteur eau', 'vanne',
      'surpresseur', 'disconnecteur', 'cuivre', 'PER', 'multicouche',
      'siphon', 'bonde', 'mitigeur', 'thermostatique',
    ],
    keywords: ['plomberie', 'plombier', 'sanitaire', 'canalisation', 'robinetterie', 'chauffe-eau', 'tuyauterie', 'adduction eau', 'assainissement', 'ECS'],
    keywordsPt: ['canalização', 'tubagem', 'sanitário', 'torneira', 'esgoto', 'abastecimento água', 'canalizador', 'sifão'],
    categoryIds: ['canalizacao', 'desentupimentos'],
  },

  // ─── MAÇON ─────────────────────────────────────────────────────────────────
  macon: {
    labelFr: 'Maçon',
    labelPt: 'Pedreiro',
    cpv: ['45262500', '45262000', '45223000', '45223200', '45223300', '45262300', '45262100'],
    strongKeywords: [
      'maçonnerie', 'maconnerie', 'gros œuvre', 'gros oeuvre', 'béton', 'beton',
      'parpaing', 'brique', 'fondation', 'démolition', 'lot maçonnerie',
      'lot gros œuvre', 'lot gros oeuvre', 'travaux maçonnerie', 'travaux maconnerie',
      'construction bâtiment', 'construction batiment', 'gros-œuvre',
    ],
    weakKeywords: [
      'mur', 'dalle', 'radier', 'élévation', 'terrassement', 'structure',
      'coffrage', 'ferraillage', 'armature', 'voile béton', 'longrine',
      'agglo', 'bloc béton', 'enduit', 'dallage', 'extension', 'surélévation',
      'reprise en sous-œuvre', 'sous-oeuvre', 'chaînage', 'chainage', 'linteau',
      'appui de fenêtre', 'seuil', 'pilier', 'poteau', 'poutre', 'plancher',
      'hourdis', 'prédalle', 'semelle filante', 'micropieux', 'décaissement',
      'remblai', 'enrochement', 'mur de soutènement', 'clôture', 'muret',
    ],
    keywords: ['maçonnerie', 'gros œuvre', 'béton', 'parpaing', 'brique', 'fondation', 'démolition', 'mur', 'dalle', 'terrassement', 'structure', 'coffrage', 'ferraillage'],
    keywordsPt: ['alvenaria', 'fundação', 'betão', 'parede', 'tijolo', 'laje', 'demolição', 'terraplanagem', 'estrutura', 'cofragem'],
    categoryIds: ['construcao', 'construction'],
  },

  // ─── PEINTRE ───────────────────────────────────────────────────────────────
  peintre: {
    labelFr: 'Peintre',
    labelPt: 'Pintor',
    cpv: ['45442100', '45442000', '45442110', '45442120', '45443000'],
    strongKeywords: [
      'peinture', 'peintre', 'ravalement', 'revêtement mural', 'revetement mural',
      'papier peint', 'lot peinture', 'travaux peinture', 'travaux de peinture',
      'ravalement façade', 'ravalement de façade', 'ravalement facade',
    ],
    weakKeywords: [
      'enduit', 'façade', 'facade', 'décoration', 'laque', 'badigeon', 'crépi',
      'faux plafond', 'plafond suspendu', 'sol souple', 'moquette',
      'revêtement de sol', 'fibre de verre', 'nettoyage façade', 'traitement façade',
      'finition', 'sous-couche', 'lasure', 'vernis', 'résine', 'époxy',
      'peinture intérieure', 'peinture extérieure', 'boiserie', 'ferronnerie peinte',
      'signalétique au sol', 'marquage au sol', 'peinture routière',
      'imperméabilisant', 'hydrofuge façade', 'anti-graffiti',
    ],
    keywords: ['peinture', 'peintre', 'ravalement', 'revêtement mural', 'papier peint', 'enduit', 'façade', 'faux plafond', 'lasure'],
    keywordsPt: ['pintura', 'revestimento', 'fachada', 'estuque', 'reboco', 'decoração', 'pintor', 'verniz', 'teto falso'],
    categoryIds: ['pintura'],
  },

  // ─── MENUISIER ─────────────────────────────────────────────────────────────
  menuisier: {
    labelFr: 'Menuisier',
    labelPt: 'Carpinteiro',
    cpv: ['45421000', '45422000', '45421100', '45421130', '45421140', '45421150', '45421160'],
    strongKeywords: [
      'menuiserie', 'menuisier', 'fenêtre', 'fenetre', 'huisserie', 'volet',
      'parquet', 'lot menuiserie', 'travaux menuiserie', 'travaux de menuiserie',
      'menuiserie intérieure', 'menuiserie extérieure', 'menuiserie bois',
      'menuiserie PVC', 'menuiserie aluminium', 'menuiserie alu',
    ],
    weakKeywords: [
      'porte', 'bois', 'escalier', 'agencement', 'placard', 'PVC', 'aluminium',
      'store', 'brise-soleil', 'occultation', 'claustra', 'bardage bois',
      'terrasse bois', 'pergola', 'charpente bois', 'ossature bois',
      'lambris', 'plinthes', 'moulures', 'habillage', 'cloison bois',
      'porte coupe-feu', 'porte blindée', 'porte automatique', 'porte sectionnelle',
      'portail', 'clôture bois', 'garde-corps bois', 'main courante',
      'bloc-porte', 'dormant', 'ouvrant', 'vitrage', 'double vitrage',
    ],
    keywords: ['menuiserie', 'menuisier', 'fenêtre', 'huisserie', 'volet', 'parquet', 'porte', 'bois', 'escalier', 'agencement', 'PVC', 'aluminium'],
    keywordsPt: ['carpintaria', 'janela', 'porta', 'madeira', 'caixilharia', 'estore', 'escada', 'soalho', 'carpinteiro', 'PVC', 'alumínio'],
    categoryIds: ['carpintaria'],
  },

  // ─── CHAUFFAGISTE / CLIMATICIEN ────────────────────────────────────────────
  chauffagiste: {
    labelFr: 'Chauffagiste / Climaticien',
    labelPt: 'Técnico AVAC',
    cpv: ['45331000', '45331100', '45331110', '45331200', '45331210', '45331220', '45331230'],
    strongKeywords: [
      'chauffage', 'climatisation', 'pompe à chaleur', 'pompe a chaleur', 'chaudière',
      'chaudiere', 'VMC', 'CVC', 'lot chauffage', 'lot CVC', 'lot climatisation',
      'travaux chauffage', 'installation chauffage', 'génie climatique',
      'ventilation', 'travaux de chauffage', 'travaux de climatisation',
    ],
    weakKeywords: [
      'CTA', 'centrale traitement air', 'plancher chauffant', 'radiateur', 'PAC',
      'géothermie', 'geothermie', 'HVAC', 'fluides', 'réseau chaleur',
      'production chaleur', 'gaz', 'raccordement gaz', 'traitement air',
      'désenfumage', 'desenfumage', 'régulation', 'calorifuge', 'tuyauterie chauffage',
      'split', 'gainable', 'VRV', 'VRF', 'groupe froid', 'refroidissement',
      'chauffe-eau thermodynamique', 'ballon thermodynamique', 'ECS solaire',
      'panneau solaire thermique', 'condensation', 'aérotherme', 'convecteur',
      'sèche-serviettes', 'thermostat', 'robinet thermostatique',
    ],
    keywords: ['chauffage', 'climatisation', 'pompe à chaleur', 'chaudière', 'VMC', 'CVC', 'ventilation', 'PAC', 'géothermie', 'génie climatique'],
    keywordsPt: ['aquecimento', 'climatização', 'bomba de calor', 'caldeira', 'ventilação', 'AVAC', 'ar condicionado', 'piso radiante'],
    categoryIds: ['climatizacao', 'gas'],
  },

  // ─── CARRELEUR ─────────────────────────────────────────────────────────────
  carreleur: {
    labelFr: 'Carreleur',
    labelPt: 'Ladrilhador',
    cpv: ['45431000', '45431100', '45431200', '45432100', '45432110', '45432111'],
    strongKeywords: [
      'carrelage', 'carreleur', 'faïence', 'faience', 'grès cérame', 'gres cerame',
      'revêtement de sol', 'revetement de sol', 'lot carrelage',
      'travaux carrelage', 'travaux de carrelage', 'pose de carrelage',
    ],
    weakKeywords: [
      'mosaïque', 'chape', 'ragréage', 'ragreage', 'pose de sol', 'dallage intérieur',
      'sol stratifié', 'parquet collé', 'sol PVC', 'sol vinyle', 'linoleum',
      'résine de sol', 'béton ciré', 'terrazzo', 'granito', 'pierre naturelle',
      'marbre', 'travertin', 'tomettes', 'terre cuite', 'émaux',
      'plinthes carrelage', 'joint carrelage', 'croisillons', 'colle carrelage',
    ],
    keywords: ['carrelage', 'carreleur', 'faïence', 'grès cérame', 'revêtement de sol', 'mosaïque', 'chape', 'ragréage', 'dallage'],
    keywordsPt: ['azulejo', 'ladrilho', 'mosaico', 'pavimento', 'revestimento de piso', 'cerâmica', 'mármore', 'granito'],
    categoryIds: ['construcao', 'renovacao'],
  },

  // ─── SERRURIER / MÉTALLIER ─────────────────────────────────────────────────
  serrurier: {
    labelFr: 'Serrurier / Métallier',
    labelPt: 'Serralheiro',
    cpv: ['45421160', '44316000', '45341000', '44316400', '45421148'],
    strongKeywords: [
      'serrurerie', 'serrurier', 'métallerie', 'metallerie', 'ferronnerie',
      'garde-corps', 'garde corps', 'portail', 'lot serrurerie', 'lot métallerie',
      'travaux serrurerie', 'travaux metallerie', 'travaux de serrurerie',
      'charpente métallique', 'charpente metallique', 'structure métallique',
    ],
    weakKeywords: [
      'grille', 'clôture', 'cloture', 'porte blindée', 'contrôle accès', 'acier',
      'escalier métallique', 'escalier metal', 'passerelle métallique', 'rampe',
      'main courante', 'inox', 'aluminium', 'soudure', 'galvanisation',
      'porte coupe-feu', 'porte sectionnelle', 'rideau métallique',
      'barreaudage', 'palissade', 'borne anti-bélier', 'poteau',
      'construction métallique', 'ossature métallique', 'bardage métallique',
    ],
    keywords: ['serrurerie', 'serrurier', 'métallerie', 'ferronnerie', 'garde-corps', 'portail', 'grille', 'clôture', 'acier', 'charpente métallique'],
    keywordsPt: ['serralharia', 'grade', 'portão', 'ferro', 'guarda-corpo', 'vedação', 'serralheiro', 'aço', 'inox'],
    categoryIds: ['serralharia', 'seguranca'],
  },

  // ─── PAYSAGISTE / JARDINIER ────────────────────────────────────────────────
  paysagiste: {
    labelFr: 'Paysagiste / Jardinier',
    labelPt: 'Jardineiro / Paisagista',
    cpv: ['77310000', '77300000', '77311000', '77312000', '77313000', '77314000', '45112700'],
    strongKeywords: [
      'espaces verts', 'espace vert', 'élagage', 'elagage', 'paysage', 'paysager',
      'paysagiste', 'engazonnement', 'tonte', 'lot espaces verts',
      'entretien espaces verts', 'travaux espaces verts', 'travaux paysagers',
      'aménagement paysager', 'amenagement paysager', 'création espaces verts',
      'entretien des espaces verts',
    ],
    weakKeywords: [
      'plantation', 'jardin', 'arrosage', 'abattage', 'haie', 'parc',
      'débroussaillage', 'debroussaillage', 'débroussaillement', 'débroussailler',
      'fauchage', 'fauche', 'désherbage', 'desherbage', 'taille', 'taille de haie',
      'arbre', 'arbuste', 'massif', 'pelouse', 'gazon', 'semis',
      'arrosage automatique', 'système irrigation', 'goutte à goutte',
      'clôture végétale', 'palissade bois', 'terreau', 'engrais', 'paillage',
      'mulching', 'broyage', 'compostage', 'bûcheronnage', 'dessouchage',
      'abattage arbre', 'haubanage', 'émondage', 'ébranchage', 'ramassage feuilles',
      'jardinière', 'bac à fleurs', 'pergola', 'treillage',
      'aire de jeux', 'mobilier urbain', 'banc', 'allée piétonne',
      'revêtement perméable', 'stabilisé', 'gravier', 'pas japonais',
    ],
    keywords: ['espaces verts', 'élagage', 'paysage', 'engazonnement', 'tonte', 'plantation', 'jardin', 'arrosage', 'abattage', 'haie', 'débroussaillage', 'fauchage'],
    keywordsPt: ['espaços verdes', 'poda', 'plantação', 'jardim', 'paisagismo', 'rega', 'relva', 'sebe', 'parque', 'corte de árvores', 'desmatação', 'manutenção jardins'],
    categoryIds: ['jardinagem'],
  },

  // ─── ISOLATION / FAÇADIER ──────────────────────────────────────────────────
  isolation: {
    labelFr: 'Isolation / Façadier',
    labelPt: 'Isolamento',
    cpv: ['45320000', '45321000', '45323000', '45324000'],
    strongKeywords: [
      'isolation thermique', 'isolation phonique', 'isolation acoustique', 'ITE',
      'bardage', 'rénovation énergétique', 'renovation energetique',
      'lot isolation', 'travaux isolation', 'travaux d\'isolation',
      'isolation par l\'extérieur', 'isolation extérieure', 'isolation intérieure',
      'isolation des combles', 'isolation toiture', 'calorifugeage',
    ],
    weakKeywords: [
      'isolation', 'isolant', 'laine de verre', 'laine de roche', 'polystyrène',
      'polyuréthane', 'soufflage', 'RGE', 'performance énergétique',
      'DPE', 'audit énergétique', 'CEE', 'certificat économie énergie',
      'ETICS', 'enduit isolant', 'complexe isolant', 'doublage',
      'contre-cloison isolante', 'pare-pluie', 'frein-vapeur',
      'ouate de cellulose', 'fibre de bois', 'liège', 'chanvre',
      'mousse projetée', 'panneau sandwich', 'R thermique',
      'pont thermique', 'rupture de pont thermique', 'étanchéité à l\'air',
      'VMC double flux', 'récupération chaleur',
    ],
    keywords: ['isolation thermique', 'isolation phonique', 'ITE', 'bardage', 'rénovation énergétique', 'isolation', 'laine de verre', 'polystyrène', 'soufflage', 'RGE'],
    keywordsPt: ['isolamento', 'isolamento térmico', 'isolamento acústico', 'capoto', 'ETICS', 'poliestireno', 'lã de rocha', 'eficiência energética'],
    categoryIds: ['isolamento'],
  },

  // ─── RÉNOVATION GÉNÉRALE ───────────────────────────────────────────────────
  renovation: {
    labelFr: 'Rénovation générale',
    labelPt: 'Renovação geral',
    cpv: ['45454000', '45454100', '45453000', '45400000', '45210000'],
    strongKeywords: [
      'rénovation', 'renovation', 'réhabilitation', 'rehabilitation', 'réfection',
      'refection', 'tous corps d\'état', 'tous corps d\'etat', 'TCE',
      'lot TCE', 'travaux TCE', 'entreprise générale', 'entreprise generale',
      'rénovation globale', 'réhabilitation lourde', 'restructuration',
      'mise aux normes', 'remise en état',
    ],
    weakKeywords: [
      'aménagement', 'amenagement', 'second œuvre', 'second oeuvre',
      'travaux intérieurs', 'travaux interieurs', 'aménagement intérieur',
      'réaménagement', 'reamenagement', 'transformation', 'reconversion',
      'changement d\'usage', 'extension', 'surélévation', 'surelevation',
      'ravalement', 'accessibilité PMR', 'mise en accessibilité',
      'désamiantage', 'déplombage', 'curage', 'déconstruction sélective',
      'rénovation énergétique', 'rénovation thermique',
    ],
    keywords: ['rénovation', 'réhabilitation', 'réfection', 'TCE', 'entreprise générale', 'aménagement', 'restructuration', 'mise aux normes'],
    keywordsPt: ['renovação', 'reabilitação', 'remodelação', 'obras interiores', 'obras de melhoramento', 'reestruturação'],
    categoryIds: ['renovacao'],
  },

  // ─── NETTOYAGE ─────────────────────────────────────────────────────────────
  nettoyage: {
    labelFr: 'Nettoyage',
    labelPt: 'Limpeza',
    cpv: ['90910000', '90911000', '90911200', '90919000', '90914000'],
    strongKeywords: [
      'nettoyage', 'propreté', 'proprete', 'nettoyage industriel',
      'lot nettoyage', 'travaux nettoyage', 'entretien propreté',
      'nettoyage bâtiment', 'nettoyage batiment', 'nettoyage locaux',
      'marché de nettoyage', 'prestation nettoyage', 'service nettoyage',
    ],
    weakKeywords: [
      'entretien ménager', 'ménage', 'menage', 'désinfection', 'parties communes',
      'nettoyage vitrerie', 'nettoyage vitres', 'remise en état',
      'décapage', 'lustrage', 'cristallisation', 'shampouinage',
      'nettoyage haute pression', 'karcher', 'nettoyage façade',
      'nettoyage graffiti', 'nettoyage après travaux', 'nettoyage fin de chantier',
      'dératisation', 'désinsectisation', 'désinfection', '3D',
      'hygiène', 'collecte déchets', 'tri sélectif', 'bennes',
    ],
    keywords: ['nettoyage', 'propreté', 'nettoyage industriel', 'entretien', 'ménage', 'désinfection', 'parties communes'],
    keywordsPt: ['limpeza', 'higienização', 'desinfeção', 'manutenção', 'partes comuns', 'lavagem'],
    categoryIds: ['limpeza'],
  },

  // ─── ASCENSORISTE ──────────────────────────────────────────────────────────
  ascenseur: {
    labelFr: 'Ascensoriste',
    labelPt: 'Elevadores',
    cpv: ['42416000', '42416100', '42416200', '50750000', '45313100'],
    strongKeywords: [
      'ascenseur', 'élévateur', 'elevateur', 'monte-charge',
      'lot ascenseur', 'travaux ascenseur', 'installation ascenseur',
      'maintenance ascenseur', 'modernisation ascenseur',
      'mise en conformité ascenseur', 'remplacement ascenseur',
    ],
    weakKeywords: [
      'monte-personne', 'plateforme élévatrice', 'escalier mécanique',
      'escalator', 'tapis roulant', 'monte-escalier', 'élévateur PMR',
      'cabine ascenseur', 'gaine ascenseur', 'machinerie', 'treuil',
      'câble ascenseur', 'porte palière', 'bouton appel',
      'contrôle technique ascenseur', 'SAV ascenseur', 'dépannage ascenseur',
    ],
    keywords: ['ascenseur', 'élévateur', 'monte-charge', 'maintenance ascenseur', 'modernisation ascenseur'],
    keywordsPt: ['elevador', 'monta-cargas', 'manutenção elevador', 'modernização elevador', 'plataforma elevatória'],
    categoryIds: ['elevadores'],
  },

  // ─── VITRIER / MIROITIER ──────────────────────────────────────────────────
  vitrerie: {
    labelFr: 'Vitrier / Miroitier',
    labelPt: 'Vidraceiro',
    cpv: ['45441000', '44221000', '44221100'],
    strongKeywords: [
      'vitrerie', 'vitrier', 'vitrage', 'miroiterie', 'double vitrage',
      'lot vitrerie', 'travaux vitrerie', 'remplacement vitrage',
      'pose de vitrage', 'travaux de vitrerie',
    ],
    weakKeywords: [
      'verre', 'vitrine', 'triple vitrage', 'vitrage isolant',
      'vitrage feuilleté', 'verre trempé', 'verre sécurit',
      'miroir', 'paroi vitrée', 'cloison vitrée', 'mur rideau',
      'verrière', 'puits de lumière', 'film solaire', 'film sécurité',
      'joint vitrage', 'mastic', 'silicone', 'pare-douche',
      'crédence verre', 'garde-corps verre', 'balustrade vitrée',
    ],
    keywords: ['vitrerie', 'vitrier', 'vitrage', 'miroiterie', 'double vitrage', 'verre', 'verrière', 'mur rideau'],
    keywordsPt: ['vidraçaria', 'vidro', 'vidro duplo', 'montra', 'vidraceiro', 'espelho'],
    categoryIds: ['vidracaria'],
  },

  // ─── VRD / VOIRIE (nouveau — couvre les marchés fréquents de voirie) ──────
  vrd: {
    labelFr: 'VRD / Voirie',
    labelPt: 'Infraestruturas',
    cpv: ['45233000', '45233100', '45233200', '45232000', '45232400', '45111000'],
    strongKeywords: [
      'voirie', 'VRD', 'réseaux divers', 'reseaux divers', 'enrobé', 'enrobe',
      'lot VRD', 'lot voirie', 'travaux VRD', 'travaux voirie', 'travaux de voirie',
      'assainissement', 'réseau assainissement',
    ],
    weakKeywords: [
      'bitume', 'trottoir', 'bordure', 'chaussée', 'chaussee', 'caniveau',
      'avaloir', 'regard', 'tuyau PVC', 'réseau EP', 'réseau EU',
      'tranchée', 'fouille', 'terrassement', 'compactage', 'empierrement',
      'grave', 'concassé', 'géotextile', 'géomembrane',
      'signalisation', 'marquage', 'ralentisseur', 'borne',
      'éclairage public', 'candélabre', 'mât', 'luminaire voirie',
      'parking', 'stationnement', 'aire de jeux', 'mobilier urbain',
    ],
    keywords: ['voirie', 'VRD', 'enrobé', 'trottoir', 'assainissement', 'réseaux divers', 'terrassement', 'signalisation'],
    keywordsPt: ['estrada', 'pavimentação', 'asfalto', 'infraestruturas', 'saneamento', 'drenagem'],
    categoryIds: ['construcao'],
  },

  // ─── DÉMÉNAGEMENT ──────────────────────────────────────────────────────────
  demenagement: {
    labelFr: 'Déménagement',
    labelPt: 'Mudanças',
    cpv: ['60100000', '98392000'],
    strongKeywords: [
      'déménagement', 'demenagement', 'lot déménagement', 'transfert mobilier',
      'prestation déménagement', 'marché déménagement', 'service déménagement',
    ],
    weakKeywords: [
      'emballage', 'transport mobilier', 'manutention', 'garde-meuble',
      'stockage mobilier', 'monte-meuble', 'transfert de site',
      'relogement', 'déplacement bureau', 'installation mobilier',
    ],
    keywords: ['déménagement', 'transfert mobilier', 'transport mobilier', 'emballage', 'manutention'],
    keywordsPt: ['mudanças', 'transporte mobiliário', 'embalagem', 'armazenamento'],
    categoryIds: ['mudancas'],
  },

  // ─── DIVERS / AUTRE (catch-all pour "Autre" dans le dropdown) ──────────────
  divers: {
    labelFr: 'Autre / Divers',
    labelPt: 'Outro',
    cpv: ['45000000'],
    strongKeywords: [
      'travaux', 'chantier', 'ouvrage', 'construction', 'bâtiment', 'batiment',
      'marché de travaux', 'appel d\'offres travaux',
    ],
    weakKeywords: [
      'génie civil', 'genie civil', 'lot technique', 'sous-traitance',
      'entreprise générale', 'entreprise generale', 'maître d\'ouvrage',
      'maîtrise d\'œuvre', 'maitrise d\'oeuvre', 'BTP', 'bâtiment travaux publics',
    ],
    keywords: ['travaux', 'chantier', 'construction', 'bâtiment', 'BTP', 'génie civil'],
    keywordsPt: ['obras', 'construção', 'empreitada', 'trabalhos'],
    categoryIds: ['outro'],
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

  // Build reverse index: categoryId → metier keys (1:N, a categoryId can map to multiple metiers)
  const catIdToMetiers = new Map<string, string[]>()
  const labelToMetier = new Map<string, string>()
  for (const [key, m] of Object.entries(METIER_CPV_MAP)) {
    for (const cid of m.categoryIds) {
      const lower = cid.toLowerCase()
      if (!catIdToMetiers.has(lower)) catIdToMetiers.set(lower, [])
      catIdToMetiers.get(lower)!.push(key)
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

    // Match on categoryId (can resolve to multiple metiers)
    if (catIdToMetiers.has(lower)) {
      for (const key of catIdToMetiers.get(lower)!) resolved.add(key)
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
