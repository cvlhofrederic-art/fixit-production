// ── Base de prix des travaux du bâtiment (France 2026) ──
// Fourchettes basses/hautes en euros, utilisées par le simulateur IA

export interface PrixTravail {
  label: string
  unite: string // m², unité, ml, forfait
  prix_bas: number
  prix_haut: number
}

export interface MetierPrix {
  metier: string
  travaux: Record<string, PrixTravail>
  questions: string[] // questions type à poser
}

export const BASE_PRIX: Record<string, MetierPrix> = {
  peinture: {
    metier: 'Peintre',
    travaux: {
      murs_simple: { label: 'Peinture murs (1 couche)', unite: 'm²', prix_bas: 15, prix_haut: 25 },
      murs_complet: { label: 'Peinture murs (2 couches + sous-couche)', unite: 'm²', prix_bas: 25, prix_haut: 40 },
      plafond: { label: 'Peinture plafond', unite: 'm²', prix_bas: 20, prix_haut: 35 },
      plafond_anti_humidite: { label: 'Peinture plafond anti-humidité', unite: 'm²', prix_bas: 35, prix_haut: 60 },
      boiseries: { label: 'Peinture boiseries (portes, plinthes)', unite: 'unité', prix_bas: 80, prix_haut: 150 },
      facade: { label: 'Ravalement façade', unite: 'm²', prix_bas: 40, prix_haut: 80 },
      preparation_murs: { label: 'Préparation murs (enduit, ponçage)', unite: 'm²', prix_bas: 10, prix_haut: 20 },
      depose_papier_peint: { label: 'Dépose papier peint', unite: 'm²', prix_bas: 8, prix_haut: 15 },
      pose_papier_peint: { label: 'Pose papier peint', unite: 'm²', prix_bas: 20, prix_haut: 45 },
    },
    questions: [
      'Quelle est la surface en m² à peindre ?',
      'Quel est l\'état actuel des murs ? (bon état / à reprendre / très abîmé)',
      'Les plafonds sont-ils à refaire aussi ?',
      'Quel niveau de gamme ? (économique / standard / haut de gamme)',
      'Dans quelle ville se situent les travaux ?',
    ],
  },

  plomberie: {
    metier: 'Plombier',
    travaux: {
      robinet_simple: { label: 'Remplacement robinet/mitigeur', unite: 'unité', prix_bas: 80, prix_haut: 200 },
      robinetterie_complete: { label: 'Robinetterie complète (douche + vasque)', unite: 'forfait', prix_bas: 200, prix_haut: 500 },
      wc_pose: { label: 'Pose WC complet', unite: 'unité', prix_bas: 250, prix_haut: 600 },
      wc_suspendu: { label: 'Pose WC suspendu (bâti-support)', unite: 'unité', prix_bas: 500, prix_haut: 1200 },
      chauffe_eau: { label: 'Remplacement chauffe-eau', unite: 'unité', prix_bas: 600, prix_haut: 1500 },
      chauffe_eau_thermo: { label: 'Chauffe-eau thermodynamique', unite: 'unité', prix_bas: 2000, prix_haut: 4000 },
      deplacement_arrivee: { label: 'Déplacement arrivée d\'eau', unite: 'unité', prix_bas: 300, prix_haut: 700 },
      deplacement_evacuation: { label: 'Déplacement évacuation', unite: 'unité', prix_bas: 400, prix_haut: 900 },
      fuite_reparation: { label: 'Réparation fuite', unite: 'forfait', prix_bas: 100, prix_haut: 300 },
      debouchage: { label: 'Débouchage canalisation', unite: 'forfait', prix_bas: 100, prix_haut: 350 },
      douche_italienne: { label: 'Douche italienne (receveur + paroi)', unite: 'forfait', prix_bas: 1200, prix_haut: 2500 },
      baignoire: { label: 'Pose baignoire', unite: 'unité', prix_bas: 500, prix_haut: 1500 },
      colonne_douche: { label: 'Colonne de douche', unite: 'unité', prix_bas: 150, prix_haut: 500 },
      salle_de_bain_complete: { label: 'Rénovation SdB complète (main d\'œuvre plomberie)', unite: 'forfait', prix_bas: 3000, prix_haut: 5000 },
    },
    questions: [
      'Quel type d\'intervention ? (remplacement, réparation, installation neuve)',
      'Quels équipements sont concernés ?',
      'Y a-t-il de la démolition/dépose à prévoir ?',
      'Quel niveau de gamme ? (économique / standard / haut de gamme)',
      'Dans quelle ville se situent les travaux ?',
    ],
  },

  electricite: {
    metier: 'Électricien',
    travaux: {
      prise: { label: 'Ajout/remplacement prise', unite: 'unité', prix_bas: 60, prix_haut: 120 },
      interrupteur: { label: 'Ajout/remplacement interrupteur', unite: 'unité', prix_bas: 50, prix_haut: 100 },
      luminaire: { label: 'Installation luminaire', unite: 'unité', prix_bas: 60, prix_haut: 150 },
      spot_encastre: { label: 'Spot encastré LED', unite: 'unité', prix_bas: 40, prix_haut: 90 },
      tableau_electrique: { label: 'Remplacement tableau électrique', unite: 'forfait', prix_bas: 800, prix_haut: 2000 },
      mise_aux_normes: { label: 'Mise aux normes NF C 15-100', unite: 'forfait', prix_bas: 1500, prix_haut: 4000 },
      tirage_cable: { label: 'Tirage de câble', unite: 'ml', prix_bas: 15, prix_haut: 35 },
      vmc: { label: 'Installation VMC simple flux', unite: 'forfait', prix_bas: 400, prix_haut: 1000 },
      vmc_double_flux: { label: 'Installation VMC double flux', unite: 'forfait', prix_bas: 2000, prix_haut: 5000 },
      domotique_base: { label: 'Pack domotique (volets + éclairage)', unite: 'forfait', prix_bas: 1500, prix_haut: 4000 },
    },
    questions: [
      'Quel type d\'intervention électrique ?',
      'Combien de points électriques (prises, interrupteurs, luminaires) ?',
      'Est-ce du neuf ou de la rénovation ?',
      'Dans quelle ville se situent les travaux ?',
    ],
  },

  carrelage: {
    metier: 'Carreleur',
    travaux: {
      pose_sol: { label: 'Pose carrelage sol', unite: 'm²', prix_bas: 35, prix_haut: 60 },
      pose_mural: { label: 'Pose faïence murale', unite: 'm²', prix_bas: 35, prix_haut: 60 },
      depose: { label: 'Dépose ancien carrelage', unite: 'm²', prix_bas: 15, prix_haut: 30 },
      ragrage: { label: 'Ragréage sol', unite: 'm²', prix_bas: 15, prix_haut: 25 },
      mosaique: { label: 'Pose mosaïque', unite: 'm²', prix_bas: 60, prix_haut: 120 },
      carrelage_grand_format: { label: 'Carrelage grand format (60×60+)', unite: 'm²', prix_bas: 45, prix_haut: 80 },
      terrasse_exterieure: { label: 'Carrelage terrasse extérieure', unite: 'm²', prix_bas: 40, prix_haut: 70 },
      joints: { label: 'Réfection joints', unite: 'ml', prix_bas: 5, prix_haut: 15 },
    },
    questions: [
      'Quelle surface en m² ?',
      'Sol, murs ou les deux ?',
      'L\'ancien carrelage est-il à déposer ?',
      'Quel format de carrelage ? (standard / grand format / mosaïque)',
      'Dans quelle ville se situent les travaux ?',
    ],
  },

  paysagisme: {
    metier: 'Paysagiste',
    travaux: {
      elagage_petit: { label: 'Élagage arbre < 5m', unite: 'unité', prix_bas: 150, prix_haut: 400 },
      elagage_moyen: { label: 'Élagage arbre 5-10m', unite: 'unité', prix_bas: 350, prix_haut: 800 },
      elagage_grand: { label: 'Élagage arbre 10-20m', unite: 'unité', prix_bas: 700, prix_haut: 1500 },
      elagage_tres_grand: { label: 'Élagage arbre > 20m', unite: 'unité', prix_bas: 1200, prix_haut: 3000 },
      abattage: { label: 'Abattage arbre', unite: 'unité', prix_bas: 300, prix_haut: 2000 },
      dessouchage: { label: 'Dessouchage', unite: 'unité', prix_bas: 200, prix_haut: 800 },
      taille_haie: { label: 'Taille de haie', unite: 'ml', prix_bas: 5, prix_haut: 15 },
      tonte_pelouse: { label: 'Tonte pelouse', unite: 'm²', prix_bas: 0.3, prix_haut: 0.8 },
      evacuation_dechets: { label: 'Évacuation déchets verts', unite: 'forfait', prix_bas: 120, prix_haut: 250 },
      creation_jardin: { label: 'Création espace vert', unite: 'm²', prix_bas: 30, prix_haut: 80 },
      cloture: { label: 'Pose clôture/grillage', unite: 'ml', prix_bas: 40, prix_haut: 100 },
      terrasse_bois: { label: 'Terrasse bois', unite: 'm²', prix_bas: 80, prix_haut: 180 },
    },
    questions: [
      'Quel type de travaux de jardin ?',
      'Combien d\'arbres / quelle surface ?',
      'Quelle hauteur approximative des arbres ?',
      'L\'évacuation des déchets est-elle souhaitée ?',
      'Dans quelle ville se situent les travaux ?',
    ],
  },

  menuiserie: {
    metier: 'Menuisier',
    travaux: {
      porte_interieure: { label: 'Pose porte intérieure', unite: 'unité', prix_bas: 200, prix_haut: 500 },
      porte_blindee: { label: 'Porte blindée', unite: 'unité', prix_bas: 1500, prix_haut: 3500 },
      fenetre_pvc: { label: 'Fenêtre PVC double vitrage', unite: 'unité', prix_bas: 300, prix_haut: 700 },
      fenetre_alu: { label: 'Fenêtre aluminium', unite: 'unité', prix_bas: 500, prix_haut: 1200 },
      baie_vitree: { label: 'Baie vitrée coulissante', unite: 'unité', prix_bas: 800, prix_haut: 2500 },
      volet_roulant: { label: 'Volet roulant (pose + motorisation)', unite: 'unité', prix_bas: 400, prix_haut: 900 },
      parquet_pose: { label: 'Pose parquet', unite: 'm²', prix_bas: 30, prix_haut: 70 },
      parquet_vitrification: { label: 'Vitrification parquet', unite: 'm²', prix_bas: 20, prix_haut: 40 },
      parquet_poncage: { label: 'Ponçage parquet', unite: 'm²', prix_bas: 15, prix_haut: 30 },
      placard: { label: 'Placard sur mesure', unite: 'ml', prix_bas: 400, prix_haut: 1000 },
      escalier: { label: 'Escalier bois sur mesure', unite: 'forfait', prix_bas: 3000, prix_haut: 8000 },
    },
    questions: [
      'Quel type de menuiserie ? (porte, fenêtre, parquet, placard)',
      'Combien d\'éléments à poser/remplacer ?',
      'Quel matériau ? (PVC, alu, bois)',
      'Dans quelle ville se situent les travaux ?',
    ],
  },

  couverture: {
    metier: 'Couvreur',
    travaux: {
      reparation_tuiles: { label: 'Remplacement tuiles cassées', unite: 'm²', prix_bas: 40, prix_haut: 80 },
      refection_toiture: { label: 'Réfection toiture complète', unite: 'm²', prix_bas: 80, prix_haut: 180 },
      gouttiere: { label: 'Pose/remplacement gouttière', unite: 'ml', prix_bas: 30, prix_haut: 70 },
      nettoyage_toiture: { label: 'Nettoyage + traitement toiture', unite: 'm²', prix_bas: 15, prix_haut: 35 },
      etancheite_terrasse: { label: 'Étanchéité terrasse/toit plat', unite: 'm²', prix_bas: 50, prix_haut: 120 },
      charpente_reparation: { label: 'Réparation charpente', unite: 'forfait', prix_bas: 1000, prix_haut: 5000 },
      velux: { label: 'Pose fenêtre de toit (Velux)', unite: 'unité', prix_bas: 500, prix_haut: 1500 },
      zinguerie: { label: 'Travaux de zinguerie', unite: 'ml', prix_bas: 30, prix_haut: 80 },
    },
    questions: [
      'Quel type de travaux de toiture ?',
      'Quelle surface approximative ?',
      'Le toit est en tuiles, ardoises ou autre ?',
      'Dans quelle ville se situent les travaux ?',
    ],
  },

  plaquiste: {
    metier: 'Plaquiste',
    travaux: {
      cloison: { label: 'Cloison placo (fourni + posé)', unite: 'm²', prix_bas: 30, prix_haut: 55 },
      doublage: { label: 'Doublage murs (isolation + placo)', unite: 'm²', prix_bas: 35, prix_haut: 65 },
      faux_plafond: { label: 'Faux plafond placo', unite: 'm²', prix_bas: 35, prix_haut: 60 },
      faux_plafond_deco: { label: 'Faux plafond décoratif (retombées)', unite: 'm²', prix_bas: 50, prix_haut: 90 },
      isolation_combles: { label: 'Isolation combles perdus', unite: 'm²', prix_bas: 20, prix_haut: 40 },
      isolation_murs_interieur: { label: 'Isolation thermique intérieure', unite: 'm²', prix_bas: 40, prix_haut: 80 },
      bandes_joints: { label: 'Bandes et joints (finition)', unite: 'm²', prix_bas: 8, prix_haut: 15 },
    },
    questions: [
      'Quel type de travaux ? (cloison, faux plafond, isolation)',
      'Quelle surface en m² ?',
      'Y a-t-il de la démolition à prévoir ?',
      'Dans quelle ville se situent les travaux ?',
    ],
  },

  chauffage: {
    metier: 'Chauffagiste',
    travaux: {
      chaudiere_gaz: { label: 'Remplacement chaudière gaz', unite: 'forfait', prix_bas: 2500, prix_haut: 6000 },
      chaudiere_condensation: { label: 'Chaudière gaz condensation', unite: 'forfait', prix_bas: 3500, prix_haut: 7000 },
      pac_air_air: { label: 'Pompe à chaleur air/air (clim réversible)', unite: 'forfait', prix_bas: 2000, prix_haut: 5000 },
      pac_air_eau: { label: 'Pompe à chaleur air/eau', unite: 'forfait', prix_bas: 8000, prix_haut: 15000 },
      radiateur: { label: 'Pose radiateur', unite: 'unité', prix_bas: 200, prix_haut: 600 },
      plancher_chauffant: { label: 'Plancher chauffant', unite: 'm²', prix_bas: 60, prix_haut: 120 },
      clim_split: { label: 'Climatisation split (1 unité)', unite: 'unité', prix_bas: 1000, prix_haut: 2500 },
      clim_multi_split: { label: 'Climatisation multi-split', unite: 'forfait', prix_bas: 3000, prix_haut: 8000 },
      entretien_chaudiere: { label: 'Entretien chaudière annuel', unite: 'forfait', prix_bas: 100, prix_haut: 200 },
      desembouage: { label: 'Désembouage circuit chauffage', unite: 'forfait', prix_bas: 400, prix_haut: 800 },
    },
    questions: [
      'Quel type d\'installation ? (chauffage, climatisation, pompe à chaleur)',
      'Quelle surface du logement en m² ?',
      'Combien de pièces à équiper ?',
      'Installation neuve ou remplacement ?',
      'Dans quelle ville se situent les travaux ?',
    ],
  },

  serrurerie: {
    metier: 'Serrurier',
    travaux: {
      ouverture_porte: { label: 'Ouverture de porte (sans casse)', unite: 'forfait', prix_bas: 80, prix_haut: 200 },
      ouverture_porte_blindee: { label: 'Ouverture porte blindée', unite: 'forfait', prix_bas: 150, prix_haut: 400 },
      changement_serrure: { label: 'Changement serrure (3 points)', unite: 'forfait', prix_bas: 150, prix_haut: 400 },
      changement_serrure_5pts: { label: 'Changement serrure 5 points', unite: 'forfait', prix_bas: 250, prix_haut: 600 },
      cylindre: { label: 'Remplacement cylindre', unite: 'unité', prix_bas: 80, prix_haut: 200 },
      blindage_porte: { label: 'Blindage porte existante', unite: 'forfait', prix_bas: 800, prix_haut: 2000 },
      grille_defense: { label: 'Grille de défense fenêtre', unite: 'unité', prix_bas: 200, prix_haut: 500 },
      digicode: { label: 'Installation digicode', unite: 'forfait', prix_bas: 400, prix_haut: 1000 },
    },
    questions: [
      'Quel type d\'intervention ? (ouverture, changement serrure, blindage)',
      'Est-ce une porte blindée ?',
      'Est-ce une urgence ?',
      'Dans quelle ville se situent les travaux ?',
    ],
  },

  nettoyage: {
    metier: 'Nettoyage',
    travaux: {
      menage_courant: { label: 'Ménage courant', unite: 'm²', prix_bas: 2, prix_haut: 5 },
      nettoyage_fin_chantier: { label: 'Nettoyage fin de chantier', unite: 'm²', prix_bas: 5, prix_haut: 12 },
      nettoyage_vitres: { label: 'Nettoyage vitres', unite: 'm²', prix_bas: 3, prix_haut: 8 },
      nettoyage_facade: { label: 'Nettoyage façade haute pression', unite: 'm²', prix_bas: 8, prix_haut: 20 },
      debarras: { label: 'Débarras/vidage logement', unite: 'm²', prix_bas: 15, prix_haut: 40 },
      nettoyage_toiture: { label: 'Nettoyage toiture + traitement', unite: 'm²', prix_bas: 15, prix_haut: 35 },
    },
    questions: [
      'Quel type de nettoyage ?',
      'Quelle surface en m² ?',
      'Y a-t-il des accès difficiles (hauteur, étages) ?',
      'Dans quelle ville se situent les travaux ?',
    ],
  },

  maconnerie: {
    metier: 'Maçon',
    travaux: {
      dalle_beton: { label: 'Dalle béton', unite: 'm²', prix_bas: 50, prix_haut: 100 },
      mur_parpaing: { label: 'Construction mur parpaing', unite: 'm²', prix_bas: 50, prix_haut: 90 },
      mur_brique: { label: 'Construction mur brique', unite: 'm²', prix_bas: 60, prix_haut: 110 },
      demolition_mur: { label: 'Démolition mur non porteur', unite: 'forfait', prix_bas: 500, prix_haut: 1500 },
      demolition_mur_porteur: { label: 'Ouverture mur porteur (IPN)', unite: 'forfait', prix_bas: 2000, prix_haut: 6000 },
      fondations: { label: 'Fondations', unite: 'ml', prix_bas: 100, prix_haut: 250 },
      enduit_facade: { label: 'Enduit de façade', unite: 'm²', prix_bas: 30, prix_haut: 60 },
      rejointoiement: { label: 'Rejointoiement pierre', unite: 'm²', prix_bas: 40, prix_haut: 80 },
      escalier_beton: { label: 'Escalier béton', unite: 'forfait', prix_bas: 2000, prix_haut: 6000 },
      terrassement: { label: 'Terrassement', unite: 'm³', prix_bas: 30, prix_haut: 60 },
    },
    questions: [
      'Quel type de travaux de maçonnerie ?',
      'Quelle surface ou dimensions ?',
      'Est-ce du neuf ou de la rénovation ?',
      'Y a-t-il un accès difficile pour les engins ?',
      'Dans quelle ville se situent les travaux ?',
    ],
  },
}

// ── Coefficients ──

export const COEFFICIENTS_ZONE: Record<string, { label: string; coeff: number }> = {
  '75': { label: 'Paris intra-muros', coeff: 1.30 },
  '77': { label: 'Seine-et-Marne', coeff: 1.20 },
  '78': { label: 'Yvelines', coeff: 1.20 },
  '91': { label: 'Essonne', coeff: 1.20 },
  '92': { label: 'Hauts-de-Seine', coeff: 1.20 },
  '93': { label: 'Seine-Saint-Denis', coeff: 1.20 },
  '94': { label: 'Val-de-Marne', coeff: 1.20 },
  '95': { label: 'Val-d\'Oise', coeff: 1.20 },
  '13': { label: 'Bouches-du-Rhône', coeff: 1.05 },
  '69': { label: 'Rhône (Lyon)', coeff: 1.10 },
  '31': { label: 'Haute-Garonne (Toulouse)', coeff: 1.05 },
  '33': { label: 'Gironde (Bordeaux)', coeff: 1.10 },
  '06': { label: 'Alpes-Maritimes (Nice)', coeff: 1.15 },
  '59': { label: 'Nord (Lille)', coeff: 1.05 },
  '67': { label: 'Bas-Rhin (Strasbourg)', coeff: 1.05 },
  '44': { label: 'Loire-Atlantique (Nantes)', coeff: 1.05 },
  '971': { label: 'Guadeloupe', coeff: 1.40 },
  '972': { label: 'Martinique', coeff: 1.40 },
  '973': { label: 'Guyane', coeff: 1.40 },
  '974': { label: 'La Réunion', coeff: 1.40 },
  '976': { label: 'Mayotte', coeff: 1.40 },
}

export const COEFFICIENTS_GAMME: Record<string, { label: string; coeff: number }> = {
  economique: { label: 'Économique', coeff: 0.80 },
  standard: { label: 'Standard', coeff: 1.00 },
  milieu: { label: 'Milieu de gamme', coeff: 1.25 },
  haut: { label: 'Haut de gamme', coeff: 1.60 },
}

export const COEFFICIENTS_ETAT: Record<string, { label: string; coeff: number }> = {
  bon: { label: 'Bon état', coeff: 0.85 },
  moyen: { label: 'État moyen', coeff: 1.00 },
  mauvais: { label: 'Mauvais état', coeff: 1.20 },
  degrade: { label: 'Très dégradé', coeff: 1.40 },
}

// ── Mapping langage naturel → métier ──

export const KEYWORD_METIER_MAP: Record<string, string[]> = {
  peinture: ['repeindre', 'peinture', 'peindre', 'murs', 'tapisserie', 'papier peint', 'enduit', 'lasure'],
  plomberie: ['fuite', 'robinet', 'tuyau', 'wc', 'toilette', 'salle de bain', 'douche', 'baignoire', 'chauffe-eau', 'cumulus', 'ballon', 'canalisation', 'plombier', 'plomberie', 'évier', 'lavabo', 'vasque', 'mitigeur'],
  electricite: ['prise', 'interrupteur', 'tableau électrique', 'câble', 'électricien', 'électricité', 'luminaire', 'spot', 'led', 'vmc', 'domotique', 'disjoncteur'],
  carrelage: ['carrelage', 'faïence', 'carreleur', 'mosaïque', 'ragréage'],
  paysagisme: ['arbre', 'élagage', 'élaguer', 'tonte', 'jardin', 'haie', 'pelouse', 'gazon', 'paysagiste', 'clôture', 'terrasse bois', 'abattage'],
  menuiserie: ['fenêtre', 'porte', 'parquet', 'volet', 'menuisier', 'placard', 'escalier', 'baie vitrée', 'store'],
  couverture: ['toiture', 'toit', 'tuile', 'ardoise', 'gouttière', 'couvreur', 'fuite toit', 'velux', 'zinguerie', 'charpente'],
  plaquiste: ['cloison', 'placo', 'isolation', 'faux plafond', 'plaquiste', 'doublage', 'combles'],
  chauffage: ['chauffage', 'clim', 'climatisation', 'chaudière', 'pompe à chaleur', 'pac', 'radiateur', 'plancher chauffant', 'chauffagiste'],
  serrurerie: ['serrure', 'porte blindée', 'clé', 'grille', 'serrurier', 'blindage', 'digicode', 'ouverture de porte'],
  nettoyage: ['nettoyage', 'ménage', 'vitres', 'fin de chantier', 'débarras', 'vidage'],
  maconnerie: ['mur', 'béton', 'dalle', 'fondation', 'maçonnerie', 'maçon', 'parpaing', 'brique', 'terrassement', 'démolition'],
}

// Détecte les métiers depuis un texte en langage naturel
export function detectMetiers(text: string): string[] {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const metiers: string[] = []

  for (const [metier, keywords] of Object.entries(KEYWORD_METIER_MAP)) {
    for (const kw of keywords) {
      const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (normalized.includes(normalizedKw)) {
        if (!metiers.includes(metier)) metiers.push(metier)
        break
      }
    }
  }

  // "rénovation complète" → multi-métiers
  if (normalized.includes('renovation complete') || normalized.includes('refaire entierement') || normalized.includes('renovation totale')) {
    return ['plomberie', 'electricite', 'carrelage', 'peinture', 'plaquiste']
  }

  // "rénovation salle de bain" → combo
  if (normalized.includes('renovation salle de bain') || normalized.includes('refaire salle de bain') || normalized.includes('refaire la salle de bain')) {
    const sdbMetiers = ['plomberie', 'carrelage', 'peinture']
    for (const m of sdbMetiers) {
      if (!metiers.includes(m)) metiers.push(m)
    }
  }

  return metiers
}

// Retourne le coefficient de zone pour un code postal
export function getCoeffZone(codePostal: string): { label: string; coeff: number } {
  const dept = codePostal.length >= 3 && codePostal.startsWith('97')
    ? codePostal.substring(0, 3)
    : codePostal.substring(0, 2)

  return COEFFICIENTS_ZONE[dept] || { label: 'Zone standard', coeff: 1.00 }
}
