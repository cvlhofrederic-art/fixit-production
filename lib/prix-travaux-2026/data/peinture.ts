// lib/prix-travaux-2026/data/peinture.ts
//
// Bootstrap Peinture — 5 lignes prix prioritaires 2026.
// Méthodologie : docs/prix-2026-methodology.md
// Sources Tier 1 gratuites uniquement (CAPEB / FFB / INSEE / France Rénov').
// Pas de Batiprix (décision produit : free Tier 1 only).

import type { PriceLine } from '../types'

export const peintureLines: PriceLine[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Peinture murs intérieurs — 2 couches + sous-couche (€/m²)
  // moBrut    = 0.35 × 48 = 16.80
  // coutBrut  = 16.80 + 7 = 23.80
  // coutFinal = 23.80 × 1.12 = 26.66
  // ttc       = 26.66 × 1.10 = 29.32
  // priceMin  = round(29.32 × 0.92) = 27
  // priceMax  = round(29.32 × 1.08) = 32
  // spread    = (32 − 27) / 27 = 18.5 % ≤ 20 % ✓
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'peinture',
    taskId: 'peinture-murs-interieur-2couches',
    label: 'Peinture murs intérieurs — 2 couches + sous-couche',
    unit: 'm2',
    description: 'Préparation légère, sous-couche acrylique, 2 couches finition acrylique mat ou velours, marque pro',
    cost: {
      mainOeuvreHeures: 0.35,
      mainOeuvreTauxHoraire: 48,
      materiaux: 7,
      chargesEntreprise: 60,
      margeNette: 12,
    },
    priceMin: 27,
    priceMax: 32,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['peinture mur', 'mur intérieur', '2 couches', 'rénovation peinture'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires peinture',
        tier: 1,
        excerpt: 'Taux horaire ouvrier peintre chargé Bouches-du-Rhône : 48 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT16 — Peinture (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/series/103205830',
        excerpt: 'Évolution +2.8% vs T1 2025',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix peinture 2026',
        tier: 2,
        url: 'https://www.travaux.com/peinture/prix',
        excerpt: 'Fourchette 25-35 €/m² peinture murs 2 couches, milieu de gamme',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'high',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Peinture plafond — 2 couches (€/m²)
  // moBrut    = 0.40 × 48 = 19.20
  // coutBrut  = 19.20 + 4 = 23.20
  // coutFinal = 23.20 × 1.10 = 25.52
  // ttc       = 25.52 × 1.10 = 28.07
  // priceMin  = round(28.07 × 0.92) = 26
  // priceMax  = round(28.07 × 1.08) = 30
  // spread    = (30 − 26) / 26 = 15.4 % ≤ 20 % ✓
  // Rendement plafond ≈ 0.40 h/m² (vs 0.35 mur) — pose en plafond pénible.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'peinture',
    taskId: 'peinture-plafond-2couches',
    label: 'Peinture plafond — 2 couches mat',
    unit: 'm2',
    description: 'Protection sols et murs, sous-couche, 2 couches peinture plafond mat blanche, finition uniforme sans traces',
    cost: {
      mainOeuvreHeures: 0.40,
      mainOeuvreTauxHoraire: 48,
      materiaux: 4,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 26,
    priceMax: 30,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['peinture plafond', 'plafond mat', '2 couches plafond', 'rénovation plafond'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires peinture',
        tier: 1,
        excerpt: 'Taux horaire ouvrier peintre chargé Bouches-du-Rhône : 48 €/h (idem mur, rendement plafond ajusté)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT16 — Peinture (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/series/103205830',
        excerpt: 'Évolution +2.8% vs T1 2025 — applicable plafonds (mêmes matériaux acryliques)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix peinture plafond 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/revetement/mur/prix-travaux-peinture-m2',
        excerpt: 'Plafond bon état : 25-30 €/m² ; état moyen : 35-40 €/m² ; mauvais état : 50-55 €/m²',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix peinture plafond 2026',
        tier: 2,
        url: 'https://www.travaux.com/peinture/guide-des-prix/prix-peinture-plafond',
        excerpt: 'Fourchette 18-45 €/m² TTC pour pièce saine, 2 couches incluses',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'high',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Peinture boiseries — porte intérieure + encadrement + plinthes (€/unité)
  // Forfait par porte standard avec encadrement et plinthes périphériques (~10 ml).
  // moBrut    = 1.60 × 48 = 76.80
  // coutBrut  = 76.80 + 10 = 86.80
  // coutFinal = 86.80 × 1.10 = 95.48
  // ttc       = 95.48 × 1.10 = 105.03
  // priceMin  = round(105.03 × 0.92) = 97
  // priceMax  = round(105.03 × 1.08) = 113
  // spread    = (113 − 97) / 97 = 16.5 % ≤ 20 % ✓
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'peinture',
    taskId: 'peinture-boiseries-portes-plinthes',
    label: 'Peinture boiseries — porte + encadrement + plinthes (forfait)',
    unit: 'unite',
    description: 'Forfait porte intérieure standard 2 faces : ponçage léger, sous-couche bois, 2 couches finition glycéro ou acrylique boiseries, encadrement et plinthes périphériques (~10 ml) inclus',
    cost: {
      mainOeuvreHeures: 1.60,
      mainOeuvreTauxHoraire: 48,
      materiaux: 10,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 97,
    priceMax: 113,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['peinture porte', 'boiseries', 'plinthes', 'encadrement porte', 'peinture huisserie'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires peinture',
        tier: 1,
        excerpt: 'Taux horaire ouvrier peintre chargé Bouches-du-Rhône : 48 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT16 — Peinture (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/series/103205830',
        excerpt: 'Évolution +2.8% vs T1 2025 — peintures boiseries glycéro/acryliques inclus',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Monsieur Peinture — Prix peinture porte 2026',
        tier: 2,
        url: 'https://www.monsieurpeinture.com/prix-peinture-porte/',
        excerpt: 'Prix de base 60 €/face porte standard bon état (1 face, sous-couche + 2 couches) ; 70-100 € si moulurée',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix peinture portes & garnitures 2026',
        tier: 2,
        url: 'https://www.travaux.com/peinture/guide-des-prix/prix-de-peinture-de-portes-garnitures',
        excerpt: 'Forfait 80-150 €/face avec ponçage, sous-couche, 2 couches ; plinthes 8.5 €/ml mise en peinture incluse',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'high',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Ravalement façade — peinture acrylique (€/m² façade)
  // moBrut    = 0.55 × 48 = 26.40
  // coutBrut  = 26.40 + 13 = 39.40
  // coutFinal = 39.40 × 1.10 = 43.34
  // ttc       = 43.34 × 1.10 = 47.67
  // priceMin  = round(47.67 × 0.92) = 44
  // priceMax  = round(47.67 × 1.08) = 51
  // spread    = (51 − 44) / 44 = 15.9 % ≤ 20 % ✓
  // Hypothèse : façade en bon état, échafaudage léger inclus, hors traitement
  // anti-mousse / décapage lourd / fissures structurelles.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'peinture',
    taskId: 'peinture-ravalement-facade-acrylique',
    label: 'Ravalement façade — peinture acrylique standard',
    unit: 'm2',
    description: 'Façade en bon état : nettoyage haute pression, fixateur, 2 couches peinture acrylique microporeuse extérieure, échafaudage léger inclus. Hors décapage lourd / réparation fissures.',
    cost: {
      mainOeuvreHeures: 0.55,
      mainOeuvreTauxHoraire: 48,
      materiaux: 13,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 44,
    priceMax: 51,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['ravalement façade', 'peinture façade', 'acrylique extérieure', 'façade maison'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires peinture',
        tier: 1,
        excerpt: 'Taux horaire ouvrier peintre chargé Bouches-du-Rhône : 48 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT16 — Peinture (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/series/103205830',
        excerpt: 'Évolution +2.8% vs T1 2025 — peintures façade acryliques incluses',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Monsieur Peinture — Prix ravalement façade 2026',
        tier: 2,
        url: 'https://www.monsieurpeinture.com/prix-ravalement-facade/',
        excerpt: 'Peinture acrylique standard sans préparation lourde : 25-45 €/m² TTC',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix peinture façade 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/revetement/mur/prix-travaux-peinture-m2',
        excerpt: 'Façade extérieure : 30-90 €/m² HT selon état et préparation',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'high',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Pose papier peint standard — intissé classique (€/m²)
  // moBrut    = 0.30 × 48 = 14.40
  // coutBrut  = 14.40 + 14 = 28.40
  // coutFinal = 28.40 × 1.10 = 31.24
  // ttc       = 31.24 × 1.10 = 34.36
  // priceMin  = round(34.36 × 0.92) = 32
  // priceMax  = round(34.36 × 1.08) = 37
  // spread    = (37 − 32) / 32 = 15.6 % ≤ 20 % ✓
  // Hypothèse : papier peint intissé standard milieu de gamme, mur sain prêt à
  // poser (pas de décollage de l'ancien revêtement, pas de rebouchage lourd).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'peinture',
    taskId: 'peinture-papier-peint-pose-standard',
    label: 'Pose papier peint — intissé standard',
    unit: 'm2',
    description: 'Pose papier peint intissé standard milieu de gamme sur mur sain : encollage mur, raccord motif standard, finition arasée plinthes/plafond. Hors décollage ancien revêtement et préparation lourde.',
    cost: {
      mainOeuvreHeures: 0.30,
      mainOeuvreTauxHoraire: 48,
      materiaux: 14,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 32,
    priceMax: 37,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['papier peint', 'pose tapisserie', 'intissé', 'revêtement mural'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires peinture',
        tier: 1,
        excerpt: 'Taux horaire ouvrier peintre-décorateur chargé Bouches-du-Rhône : 48 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT16 — Peinture (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/series/103205830',
        excerpt: 'Évolution +2.8% vs T1 2025 — applicable papiers peints et revêtements muraux',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Monsieur Peinture — Prix pose papier peint 2026',
        tier: 2,
        url: 'https://www.monsieurpeinture.com/prix-pose-de-papier-peint/',
        excerpt: 'Pose papier intissé standard : 28 €/m² HT (main d\'œuvre seule), fourniture ~25 €/m² ; total ~51-58 €/m² TTC haut de gamme',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Hexoa — Prix pose papier peint 2026',
        tier: 2,
        url: 'https://www.hexoa.fr/blog/prix-de-la-pose-papier-peint-en-2026-tarifs-au-m%C2%B2-et-guide-des-couts/',
        excerpt: 'Pose seule 15-35 €/m² TTC ; fourniture + pose intissé classique 35-65 €/m²',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'high',
  },
]
