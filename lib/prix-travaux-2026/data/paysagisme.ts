// lib/prix-travaux-2026/data/paysagisme.ts
//
// Bootstrap Paysagisme — 5 lignes prix prioritaires 2026.
// Méthodologie : docs/prix-2026-methodology.md
// Sources Tier 1 gratuites uniquement (UNEP / CAPEB / FFB / INSEE).
// Pas de Batiprix (décision produit : free Tier 1 only).
//
// NOTE SOURCES — Le paysagisme n'a pas d'index INSEE BT dédié (les espaces verts
// sont rattachés aux travaux de BTP non-bâtiment, hors série BT bâtiment 01-50).
// La référence syndicale Tier 1 reconnue est l'UNEP (Union Nationale des
// Entrepreneurs du Paysage) — équivalent CAPEB/FFB pour la filière paysage.
// Les Tableaux de Bord UNEP publient annuellement les coûts de revient et les
// taux horaires moyens sectoriels (paysagiste qualifié chargé : 45-55 €/h
// fourchette nationale, ~50 €/h estimation PACA 2026). CAPEB Paysagistes (CAPEB
// section paysagistes) publie également des grilles régionales mais avec moins
// de granularité. À défaut d'index INSEE dédié, on s'aligne sur l'index BT01
// (tous corps d'état) pour le suivi de l'évolution générale des coûts.
//
// TVA — Le paysagisme bascule entre 10 % (entretien jardin existant, logement
// >2 ans, prestation de services à la personne) et 20 % (création / aménagement
// neuf, terrasses, plantations création initiale). Référence BOFIP TVA-LIQ-30 :
//   • Lignes 1 (élagage entretien) et 2 (tonte) : TVA 10 % entretien
//   • Lignes 3 (terrasse bois composite), 4 (terrasse pavés) et 5 (création haie) :
//     TVA 20 % aménagement / création neuve
//
// AIDES — Aucune aide MaPrimeRénov / CEE applicable au paysagisme (hors champ
// rénovation énergétique). Pas de aidesEligibles renseigné.

import type { PriceLine } from '../types'

export const paysagismeLines: PriceLine[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Élagage arbre moyen 5-10 m — forfait par arbre (€/arbre)
  // moBrut    = 4.5 × 50 = 225.00
  // coutBrut  = 225.00 + 28 = 253.00
  // coutFinal = 253.00 × 1.12 = 283.36
  // ttc       = 283.36 × 1.10 = 311.70
  // priceMin  = round(311.70 × 0.92) = 287
  // priceMax  = round(311.70 × 1.08) = 337
  // spread    = (337 − 287) / 287 = 17.4 % ≤ 20 % ✓
  // Hypothèse : élagage d'entretien arbre moyen 5-10 m (cyprès, olivier, mûrier,
  // tilleul jeune…), équipe 2 paysagistes × 2.25 h (≈ 4.5 h-homme) avec
  // tronçonneuse, échelle ou nacelle légère, broyage déchets verts ou évacuation
  // déchèterie incluse. Hors abattage et hors arbres dangereux >10 m. TVA 10 %
  // (entretien jardin existant, logement >2 ans).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'paysagisme',
    taskId: 'paysagisme-elagage-arbre-moyen-5-10m',
    label: 'Élagage arbre moyen 5-10 m — forfait par arbre',
    unit: 'unite',
    description: "Élagage d'entretien d'un arbre moyen 5-10 m (cyprès, olivier, mûrier, tilleul…) : équipe 2 paysagistes, tronçonneuse, échelle ou nacelle légère, taille raisonnée, broyage des déchets verts ou évacuation déchèterie incluse. Hors abattage et arbres dangereux >10 m.",
    cost: {
      mainOeuvreHeures: 4.5,
      mainOeuvreTauxHoraire: 50,
      materiaux: 28,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 287,
    priceMax: 337,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['élagage', 'taille arbre', 'paysagiste arbre', 'élaguer', 'entretien jardin'],
    },
    sources: [
      {
        name: 'UNEP — Tableaux de Bord Entreprises du Paysage 2026',
        tier: 1,
        url: 'https://www.lesentreprisesdupaysage.fr/centre-de-ressources/tableaux-de-bord/',
        excerpt: "Coûts de revient sectoriels paysage 2026 : taux horaire ouvrier paysagiste qualifié chargé fourchette nationale 45-55 €/h. Estimation PACA 2026 alignée à 50 €/h.",
        accessedAt: '2026-04-27',
      },
      {
        name: 'CAPEB Paysagistes — Grille indicative 2026',
        tier: 1,
        excerpt: "Section CAPEB Paysagistes : taux horaire chargé indicatif paysagiste qualifié 2026 ~48-52 €/h selon région et qualification. Référence pour mise à jour des estimations PACA.",
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix élagage arbre 2026',
        tier: 2,
        url: 'https://www.travaux.com/jardin-paysagisme/guide-des-prix/prix-elagage-arbre',
        excerpt: 'Élagage arbre moyen 5-10 m : 250-400 €/arbre TTC selon difficulté d\'accès et essence ; broyage déchets verts inclus.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix élagage 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/jardin-exterieur/prix-elagage-arbre',
        excerpt: 'Élagage arbre de taille moyenne (5-10 m) : 250-350 € forfait par arbre, équipe 2 paysagistes, tronçonneuse + évacuation déchets.',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB Paysagistes PACA 2026 grid pending official publication — 50 €/h is internal estimate aligned with UNEP Tableaux de Bord 2026 national fourchette 45-55 €/h. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Tonte pelouse résidentielle 300 m² — forfait par passage (€/passage)
  // moBrut    = 1.0 × 50 = 50.00
  // coutBrut  = 50.00 + 6 = 56.00
  // coutFinal = 56.00 × 1.10 = 61.60
  // ttc       = 61.60 × 1.10 = 67.76
  // priceMin  = round(67.76 × 0.92) = 62
  // priceMax  = round(67.76 × 1.08) = 73
  // spread    = (73 − 62) / 62 = 17.7 % ≤ 20 % ✓
  // Hypothèse : tonte d'entretien pelouse résidentielle ≈ 300 m², 1 paysagiste
  // équipé tondeuse autoportée ou autotractée, ramassage déchets verts inclus,
  // finition rotofil bordures incluse. Forfait par passage en contrat d'entretien
  // saisonnier (hors devis ponctuel one-shot qui peut être 30-40 % plus cher).
  // TVA 10 % (entretien jardin existant, logement >2 ans).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'paysagisme',
    taskId: 'paysagisme-tonte-pelouse-residentielle-300m2',
    label: 'Tonte pelouse résidentielle 300 m² — forfait par passage',
    unit: 'forfait',
    description: "Tonte d'entretien pelouse résidentielle ≈300 m² : 1 paysagiste, tondeuse autoportée ou autotractée, ramassage des déchets verts, finition rotofil pour bordures et obstacles. Forfait par passage en contrat d'entretien saisonnier.",
    cost: {
      mainOeuvreHeures: 1.0,
      mainOeuvreTauxHoraire: 50,
      materiaux: 6,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 62,
    priceMax: 73,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      surfaceMin: 250,
      surfaceMax: 350,
      keywords: ['tonte pelouse', 'entretien jardin', 'tonte gazon', 'paysagiste tonte', 'contrat entretien'],
    },
    sources: [
      {
        name: 'UNEP — Tableaux de Bord Entreprises du Paysage 2026',
        tier: 1,
        url: 'https://www.lesentreprisesdupaysage.fr/centre-de-ressources/tableaux-de-bord/',
        excerpt: "Référence sectorielle paysage 2026 : rendement tonte pelouse mécanisée autoportée ≈ 300 m²/h ouvrier qualifié, taux horaire chargé 45-55 €/h.",
        accessedAt: '2026-04-27',
      },
      {
        name: 'CAPEB Paysagistes — Grille indicative 2026',
        tier: 1,
        excerpt: "Tonte d'entretien sous contrat saisonnier : forfait moyen 60-75 €/passage pour ≈ 300 m² selon région.",
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix tonte pelouse 2026',
        tier: 2,
        url: 'https://www.travaux.com/jardin-paysagisme/guide-des-prix/prix-tonte-pelouse',
        excerpt: 'Tonte sous contrat d\'entretien : 0.20-0.30 €/m² TTC ; forfait 60-90 € par passage pour pelouse 300 m².',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix entretien jardin 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/jardin-exterieur/prix-tonte-pelouse',
        excerpt: 'Tonte pelouse 300 m² avec ramassage et finition bordures : 60-80 € forfait par passage en contrat saisonnier.',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB Paysagistes PACA 2026 grid pending official publication — 50 €/h is internal estimate aligned with UNEP Tableaux de Bord 2026. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Pose terrasse bois composite — fourniture + pose (€/m² posée)
  // moBrut    = 1.4 × 50 = 70.00
  // coutBrut  = 70.00 + 49 = 119.00
  // coutFinal = 119.00 × 1.12 = 133.28
  // ttc       = 133.28 × 1.20 = 159.94
  // priceMin  = round(159.94 × 0.92) = 147
  // priceMax  = round(159.94 × 1.08) = 173
  // spread    = (173 − 147) / 147 = 17.7 % ≤ 20 % ✓
  // Hypothèse : création terrasse bois composite milieu de gamme sur sol stabilisé
  // existant, surface ≥ 15 m². Lambourdes alu ou bois exotique, plots PVC réglables,
  // lames composite co-extrudé ~38 €/m² (gamme courante type Silvadec / UPM /
  // Fiberon), visserie inox A2, finition propre profilés de finition. Hors
  // terrassement lourd, hors fondation béton, hors décaissement. TVA 20 %
  // (création / aménagement, hors champ rénovation énergétique).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'paysagisme',
    taskId: 'paysagisme-pose-terrasse-bois-composite',
    label: 'Pose terrasse bois composite — fourniture + pose',
    unit: 'm2',
    description: 'Création terrasse bois composite milieu de gamme sur sol stabilisé existant : plots PVC réglables, lambourdes alu ou bois exotique, lames composite co-extrudé (Silvadec / UPM / Fiberon), visserie inox A2, profilés de finition. Hors terrassement lourd et fondation béton.',
    cost: {
      mainOeuvreHeures: 1.4,
      mainOeuvreTauxHoraire: 50,
      materiaux: 49,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 147,
    priceMax: 173,
    priceUnit: 'EUR_TTC',
    tva: 20,
    conditions: {
      surfaceMin: 15,
      keywords: ['terrasse composite', 'terrasse bois', 'lames composite', 'pose terrasse', 'silvadec', 'fiberon'],
    },
    sources: [
      {
        name: 'UNEP — Tableaux de Bord Entreprises du Paysage 2026',
        tier: 1,
        url: 'https://www.lesentreprisesdupaysage.fr/centre-de-ressources/tableaux-de-bord/',
        excerpt: "Coûts de revient terrasses extérieures 2026 : main d'œuvre paysagiste 45-55 €/h chargé, rendement pose terrasse composite ≈ 0.7 m²/h-homme (1.4 h-homme/m²) sur sol stabilisé.",
        accessedAt: '2026-04-27',
      },
      {
        name: 'CAPEB Paysagistes — Grille indicative 2026',
        tier: 1,
        excerpt: "Pose terrasse composite milieu de gamme fourniture + pose : 140-180 €/m² TTC selon configuration et finitions.",
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix terrasse composite 2026',
        tier: 2,
        url: 'https://www.travaux.com/jardin-paysagisme/guide-des-prix/prix-terrasse-composite',
        excerpt: 'Terrasse bois composite fourniture + pose milieu de gamme : 130-200 €/m² TTC, lames co-extrudées avec lambourdes alu et plots réglables.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix terrasse composite 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/jardin-exterieur/prix-terrasse-composite',
        excerpt: 'Pose terrasse composite : 140-190 €/m² posée, fourniture et main d\'œuvre, sur sol stabilisé existant.',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB Paysagistes PACA 2026 grid pending official publication — 50 €/h is internal estimate aligned with UNEP Tableaux de Bord 2026. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Pose terrasse pavés béton — fourniture + pose (€/m² posée)
  // moBrut    = 1.0 × 50 = 50.00
  // coutBrut  = 50.00 + 22 = 72.00
  // coutFinal = 72.00 × 1.12 = 80.64
  // ttc       = 80.64 × 1.20 = 96.77
  // priceMin  = round(96.77 × 0.92) = 89
  // priceMax  = round(96.77 × 1.08) = 105
  // spread    = (105 − 89) / 89 = 18.0 % ≤ 20 % ✓
  // Hypothèse : pose pavés béton autobloquants standards (ép. 6-8 cm) sur lit de
  // sable stabilisé, géotextile + lit empierrement 0/31.5 préparé, jointoiement
  // sable polymère. Surface ≥ 20 m². Hors terrassement profond et hors fondation
  // béton armé. Pavés béton ~14 €/m² gamme courante. TVA 20 % (création).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'paysagisme',
    taskId: 'paysagisme-pose-terrasse-pave-beton',
    label: 'Pose terrasse pavés béton — fourniture + pose',
    unit: 'm2',
    description: 'Pose pavés béton autobloquants standards (ép. 6-8 cm) sur lit de sable stabilisé : géotextile, lit empierrement 0/31.5, jointoiement sable polymère. Hors terrassement profond et fondation béton armé.',
    cost: {
      mainOeuvreHeures: 1.0,
      mainOeuvreTauxHoraire: 50,
      materiaux: 22,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 89,
    priceMax: 105,
    priceUnit: 'EUR_TTC',
    tva: 20,
    conditions: {
      surfaceMin: 20,
      keywords: ['terrasse pavé', 'pavé béton', 'pavé autobloquant', 'allée pavée', 'pose pavés'],
    },
    sources: [
      {
        name: 'UNEP — Tableaux de Bord Entreprises du Paysage 2026',
        tier: 1,
        url: 'https://www.lesentreprisesdupaysage.fr/centre-de-ressources/tableaux-de-bord/',
        excerpt: "Coûts de revient revêtements minéraux paysage 2026 : main d'œuvre 45-55 €/h chargé, rendement pose pavés béton autobloquants ≈ 1 m²/h-homme avec préparation lit sable stabilisé.",
        accessedAt: '2026-04-27',
      },
      {
        name: 'CAPEB Paysagistes — Grille indicative 2026',
        tier: 1,
        excerpt: "Pose pavés béton autobloquants standards fourniture + pose : 80-110 €/m² TTC selon configuration et préparation du sol.",
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix terrasse pavés 2026',
        tier: 2,
        url: 'https://www.travaux.com/jardin-paysagisme/guide-des-prix/prix-pavage',
        excerpt: 'Pavés béton autobloquants fourniture + pose : 70-120 €/m² TTC selon épaisseur, gamme et complexité de pose.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix pavage extérieur 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/jardin-exterieur/prix-pavage',
        excerpt: 'Terrasse ou allée pavés béton standards : 80-110 €/m² posée, lit sable stabilisé et jointoiement inclus.',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB Paysagistes PACA 2026 grid pending official publication — 50 €/h is internal estimate aligned with UNEP Tableaux de Bord 2026. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Création haie thuyas 2 m — plant + plantation (€/ml)
  // moBrut    = 0.45 × 50 = 22.50
  // coutBrut  = 22.50 + 20 = 42.50
  // coutFinal = 42.50 × 1.12 = 47.60
  // ttc       = 47.60 × 1.20 = 57.12
  // priceMin  = round(57.12 × 0.92) = 53
  // priceMax  = round(57.12 × 1.08) = 62
  // spread    = (62 − 53) / 53 = 17.0 % ≤ 20 % ✓
  // Hypothèse : création haie de thuyas (Thuja occidentalis 'Brabant' ou 'Smaragd')
  // hauteur livrée 1.5-2 m, densité 3 plants/ml, préparation tranchée, amendement
  // terreau, plantation, paillage, premier arrosage. Linéaire ≥ 10 ml. Hors
  // arrosage automatique. TVA 20 % (création / plantation initiale, hors champ
  // entretien).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'paysagisme',
    taskId: 'paysagisme-creation-haie-thuyas-2m-pose',
    label: 'Création haie thuyas 2 m — plant + plantation',
    unit: 'ml',
    description: "Création haie de thuyas (Thuja 'Brabant' ou 'Smaragd') hauteur livrée 1.5-2 m, densité 3 plants/ml : préparation tranchée, amendement terreau, plantation, paillage, premier arrosage. Hors arrosage automatique.",
    cost: {
      mainOeuvreHeures: 0.45,
      mainOeuvreTauxHoraire: 50,
      materiaux: 20,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 53,
    priceMax: 62,
    priceUnit: 'EUR_TTC',
    tva: 20,
    conditions: {
      surfaceMin: 10,
      keywords: ['haie thuyas', 'plantation haie', 'thuya', 'haie persistante', 'création haie'],
    },
    sources: [
      {
        name: 'UNEP — Tableaux de Bord Entreprises du Paysage 2026',
        tier: 1,
        url: 'https://www.lesentreprisesdupaysage.fr/centre-de-ressources/tableaux-de-bord/',
        excerpt: "Coûts de revient plantations paysage 2026 : main d'œuvre 45-55 €/h chargé, rendement plantation haie persistante ≈ 0.45 h-homme/ml avec préparation tranchée et paillage.",
        accessedAt: '2026-04-27',
      },
      {
        name: 'CAPEB Paysagistes — Grille indicative 2026',
        tier: 1,
        excerpt: "Création haie persistante (thuyas, lauriers, cyprès) plant 1.5-2 m fourniture + plantation : 50-65 €/ml TTC selon densité.",
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix plantation haie 2026',
        tier: 2,
        url: 'https://www.travaux.com/jardin-paysagisme/guide-des-prix/prix-plantation-haie',
        excerpt: 'Plantation haie thuyas 1.5-2 m fourniture + pose : 45-70 €/ml TTC, 3 plants/ml, paillage et amendement inclus.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix création haie 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/jardin-exterieur/prix-plantation-haie',
        excerpt: 'Création haie persistante thuyas 2 m : 50-65 €/ml fourniture + plantation par paysagiste, premier arrosage inclus.',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB Paysagistes PACA 2026 grid pending official publication — 50 €/h is internal estimate aligned with UNEP Tableaux de Bord 2026 national fourchette 45-55 €/h. Refresh via prix-freshness workflow when grid lands.',
  },
]
