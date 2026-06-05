// lib/prix-travaux-2026/data/carrelage.ts
//
// Bootstrap Carrelage — 5 lignes prix prioritaires 2026.
// Méthodologie : docs/prix-2026-methodology.md
// Sources Tier 1 gratuites uniquement (CAPEB / FFB / INSEE / France Rénov').
// Pas de Batiprix (décision produit : free Tier 1 only).
//
// NOTE INSEE — l'index officiel "Carrelage et revêtements céramiques"
// est le BT09 (et non BT22 qui désigne "Fournitures et pose d'enduits
// monocouches d'imperméabilisation"). Toutes les sources INSEE référencent
// BT09 pour les prestations carrelage / faïence.

import type { PriceLine } from '../types'

export const carrelageLines: PriceLine[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Pose carrelage standard 30x30 — €/m²
  // moBrut    = 0.65 × 50 = 32.50
  // coutBrut  = 32.50 + 13 = 45.50
  // coutFinal = 45.50 × 1.13 = 51.42
  // ttc       = 51.42 × 1.10 = 56.56
  // priceMin  = round(56.56 × 0.92) = 52
  // priceMax  = round(56.56 × 1.08) = 61
  // spread    = (61 − 52) / 52 = 17.3 % ≤ 20 % ✓
  // Hypothèse : pose collée droite carrelage grès cérame émaillé 30x30 milieu
  // de gamme (~13 €/m² fourniture carreau + colle + croisillons + joint),
  // sol existant plan et propre, hors ragréage et hors dépose. TVA 10 %
  // logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'carrelage',
    taskId: 'carrelage-pose-standard-30x30',
    label: 'Pose carrelage sol — grès cérame 30x30 standard',
    unit: 'm2',
    description: 'Pose collée droite carrelage grès cérame émaillé 30x30 milieu de gamme sur sol existant plan : fourniture carreau + colle C2 + croisillons + joint hydrofuge (~13 €/m²), pose, jointoiement, finition arasée plinthes. Hors dépose ancien revêtement et hors ragréage du support.',
    cost: {
      mainOeuvreHeures: 0.65,
      mainOeuvreTauxHoraire: 50,
      materiaux: 13,
      chargesEntreprise: 60,
      margeNette: 13,
    },
    priceMin: 52,
    priceMax: 61,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['pose carrelage', 'carrelage 30x30', 'grès cérame', 'carrelage sol', 'pose droite'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires carrelage',
        tier: 1,
        excerpt: 'Taux horaire ouvrier carreleur chargé Bouches-du-Rhône : 50 €/h (estimation interne alignée fourchette nationale CAPEB 45-58 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT09 — Carrelage et revêtements céramiques (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710935',
        excerpt: 'Index BT09 Carrelage et revêtements céramiques base 100 = 2010, dernière mise à jour 15/04/2026. Référence indexation prestations carrelage bâtiment.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix pose carrelage 2026',
        tier: 2,
        url: 'https://www.travaux.com/carrelage/guide-des-prix/prix-de-la-pose-de-carrelage',
        excerpt: 'Pose carrelage sol 30x30 standard : 30-50 €/m² main-d\'œuvre seule ; fourniture + pose 50-70 €/m² TTC milieu de gamme',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix carrelage 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/revetement/sol/prix-pose-carrelage-m2',
        excerpt: 'Pose carrelage standard 30x30 grès cérame : 40-65 €/m² fourniture + pose ; pose simple droite 25-40 €/m² MO seule',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT09 (ranges nationale CAPEB 45-58 €/h chargé). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Pose carrelage grand format 60x60 — €/m²
  // moBrut    = 0.80 × 50 = 40.00
  // coutBrut  = 40.00 + 20 = 60.00
  // coutFinal = 60.00 × 1.13 = 67.80
  // ttc       = 67.80 × 1.10 = 74.58
  // priceMin  = round(74.58 × 0.92) = 69
  // priceMax  = round(74.58 × 1.08) = 81
  // spread    = (81 − 69) / 69 = 17.4 % ≤ 20 % ✓
  // Hypothèse : carrelage grand format 60x60 grès cérame rectifié milieu de
  // gamme (~20 €/m² fourniture carreau + colle C2S1 spéciale grand format +
  // croisillons auto-nivelants + joint), pose collée droite, sol existant
  // plan. Rendement plus lent qu'en 30x30 (manutention, planéité exigée).
  // Hors dépose et hors ragréage. TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'carrelage',
    taskId: 'carrelage-pose-grand-format-60x60',
    label: 'Pose carrelage sol — grès cérame 60x60 grand format',
    unit: 'm2',
    description: 'Pose collée droite carrelage grès cérame rectifié 60x60 milieu de gamme : fourniture carreau + colle C2S1 grand format + système croisillons auto-nivelants + joint (~20 €/m²), pose, jointoiement fin, finition. Sol existant plan exigé (planéité < 5 mm/2 m). Hors dépose ancien revêtement et hors ragréage support.',
    cost: {
      mainOeuvreHeures: 0.80,
      mainOeuvreTauxHoraire: 50,
      materiaux: 20,
      chargesEntreprise: 60,
      margeNette: 13,
    },
    priceMin: 69,
    priceMax: 81,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['carrelage grand format', 'carrelage 60x60', 'grès cérame rectifié', 'carrelage XXL', 'pose carrelage grand format'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires carrelage',
        tier: 1,
        excerpt: 'Taux horaire ouvrier carreleur chargé Bouches-du-Rhône : 50 €/h (estimation interne alignée fourchette nationale CAPEB 45-58 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT09 — Carrelage et revêtements céramiques (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710935',
        excerpt: 'Index BT09 Carrelage et revêtements céramiques base 100 = 2010, dernière mise à jour 15/04/2026. Couvre carrelages grand format et rectifiés.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix carrelage grand format 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/revetement/sol/prix-pose-carrelage-m2',
        excerpt: 'Pose carrelage grand format 60x60 grès cérame rectifié : 60-90 €/m² fourniture + pose ; supplément MO +20-30 % vs 30x30 (manutention, planéité)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Quotatis — Prix carrelage XXL 2026',
        tier: 2,
        url: 'https://www.quotatis.fr/conseils-travaux/prix-carrelage/',
        excerpt: 'Carrelage 60x60 et plus : 65-85 €/m² TTC pose comprise milieu de gamme ; +15-25 % vs format standard 30x30',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT09 (ranges nationale CAPEB 45-58 €/h chargé). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Dépose carrelage existant — €/m²
  // moBrut    = 0.40 × 50 = 20.00
  // coutBrut  = 20.00 + 1 = 21.00
  // coutFinal = 21.00 × 1.10 = 23.10
  // ttc       = 23.10 × 1.10 = 25.41
  // priceMin  = round(25.41 × 0.92) = 23
  // priceMax  = round(25.41 × 1.08) = 27
  // spread    = (27 − 23) / 23 = 17.4 % ≤ 20 % ✓
  // Hypothèse : dépose carrelage sol scellé sur dalle béton (sans amiante),
  // évacuation gravats vers benne ou déchetterie locale (~1 €/m² consommables
  // + part forfait évacuation), protection pièce voisines. Hors traitement
  // amiante (DTA obligatoire si bâtiment <1997 — gérer en prestation séparée)
  // et hors réparation chape sous-jacente. TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'carrelage',
    taskId: 'carrelage-depose-existant',
    label: 'Dépose carrelage existant — sol sur dalle béton',
    unit: 'm2',
    description: 'Dépose carrelage sol scellé sur dalle béton non amianté : protection pièces voisines, dépose mécanique au burineur, évacuation gravats (consommables + quote-part benne ~1 €/m²), nettoyage support. Hors diagnostic amiante (DTA obligatoire si construction <1997) et hors réparation chape sous-jacente.',
    cost: {
      mainOeuvreHeures: 0.40,
      mainOeuvreTauxHoraire: 50,
      materiaux: 1,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 23,
    priceMax: 27,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['dépose carrelage', 'enlèvement carrelage', 'démolition carrelage', 'retrait ancien carrelage'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires carrelage',
        tier: 1,
        excerpt: 'Taux horaire ouvrier carreleur chargé Bouches-du-Rhône : 50 €/h (estimation interne alignée fourchette nationale CAPEB 45-58 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT09 — Carrelage et revêtements céramiques (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710935',
        excerpt: 'Index BT09 Carrelage et revêtements céramiques base 100 = 2010, dernière mise à jour 15/04/2026. Applicable prestations dépose / repose.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix dépose carrelage 2026',
        tier: 2,
        url: 'https://www.travaux.com/carrelage/guide-des-prix/prix-de-la-depose-dun-carrelage',
        excerpt: 'Dépose carrelage sol : 15-30 €/m² TTC selon adhérence et évacuation gravats ; 25 €/m² moyenne nationale pour carrelage scellé sur dalle',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix dépose carrelage 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/revetement/sol/prix-depose-carrelage',
        excerpt: 'Dépose carrelage : 15-30 €/m² ; carrelage collé plus simple (15-20 €/m²) que carrelage scellé (25-30 €/m²) ; +5-10 €/m² évacuation gravats',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT09 (ranges nationale CAPEB 45-58 €/h chargé). Si bâtiment <1997, prévoir DTA amiante en amont (prestation distincte). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Ragréage sol — substrat avant pose carrelage — €/m²
  // moBrut    = 0.28 × 50 = 14.00
  // coutBrut  = 14.00 + 11 = 25.00
  // coutFinal = 25.00 × 1.10 = 27.50
  // ttc       = 27.50 × 1.10 = 30.25
  // priceMin  = round(30.25 × 0.92) = 28
  // priceMax  = round(30.25 × 1.08) = 33
  // spread    = (33 − 28) / 28 = 17.9 % ≤ 20 % ✓
  // Hypothèse : ragréage autolissant fibré épaisseur 5-10 mm sur dalle béton
  // ou ancien sol carrelé propre, primaire d'accrochage inclus, fourniture
  // mortier ragréage + primaire (~11 €/m²). Hors préparation lourde du
  // support (réparation fissures, décapage colle ancienne). Préalable
  // typique avant pose carrelage grand format ou planéité dégradée.
  // TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'carrelage',
    taskId: 'carrelage-ragreage-sol-substrat',
    label: 'Ragréage sol — autolissant fibré 5-10 mm avant pose',
    unit: 'm2',
    description: 'Ragréage autolissant fibré sur dalle béton ou ancien sol carrelé propre, épaisseur 5-10 mm : primaire d\'accrochage, application mortier ragréage autolissant fibré (~11 €/m² fourniture), tirage à la lisseuse, séchage avant pose revêtement. Hors réparation fissures structurelles et hors décapage de colle ancienne.',
    cost: {
      mainOeuvreHeures: 0.28,
      mainOeuvreTauxHoraire: 50,
      materiaux: 11,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 28,
    priceMax: 33,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['ragréage sol', 'ragréage autolissant', 'préparation sol carrelage', 'mortier ragréage', 'mise à niveau sol'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires carrelage',
        tier: 1,
        excerpt: 'Taux horaire ouvrier carreleur / chapiste chargé Bouches-du-Rhône : 50 €/h (estimation interne alignée fourchette nationale CAPEB 45-58 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT09 — Carrelage et revêtements céramiques (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710935',
        excerpt: 'Index BT09 Carrelage et revêtements céramiques base 100 = 2010, dernière mise à jour 15/04/2026. Couvre préparations supports (ragréage / chape mince).',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix ragréage sol 2026',
        tier: 2,
        url: 'https://www.travaux.com/sol/guide-des-prix/prix-dun-ragreage',
        excerpt: 'Ragréage sol autolissant fibré : 20-40 €/m² TTC fourniture + pose ; primaire d\'accrochage inclus 25-35 €/m² standard',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix ragréage sol 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/sol/prix-ragreage',
        excerpt: 'Ragréage autolissant 5-10 mm : 25-35 €/m² fourniture + pose ; ragréage fibré pour planéité avant grand format 30-40 €/m²',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT09 (ranges nationale CAPEB 45-58 €/h chargé). Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Pose mosaïque douche — €/m²
  // moBrut    = 1.70 × 50 = 85.00
  // coutBrut  = 85.00 + 35 = 120.00
  // coutFinal = 120.00 × 1.13 = 135.60
  // ttc       = 135.60 × 1.10 = 149.16
  // priceMin  = round(149.16 × 0.92) = 137
  // priceMax  = round(149.16 × 1.08) = 161
  // spread    = (161 − 137) / 137 = 17.5 % ≤ 20 % ✓
  // Hypothèse : pose mosaïque verre ou pâte de verre milieu de gamme sur
  // trame en douche italienne (~35 €/m² fourniture mosaïque + colle blanche
  // C2TE + joint hydrofuge spécial pièces humides), support déjà étanché
  // (SPEC type). Rendement très lent (1.70 h/m²) car découpes nombreuses
  // autour des bondes, niches, angles, et travail en zones étroites.
  // Hors étanchéité SPEC, hors pose receveur, hors plomberie. TVA 10 %
  // logement >2 ans (rénovation salle de bain).
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'carrelage',
    taskId: 'carrelage-pose-mosaique-douche',
    label: 'Pose mosaïque — douche italienne (verre ou pâte de verre)',
    unit: 'm2',
    description: 'Pose mosaïque verre ou pâte de verre sur trame en douche italienne : fourniture mosaïque + colle blanche C2TE + joint hydrofuge pièces humides (~35 €/m²), traçage, découpes autour bondes/niches/angles, jointoiement fin. Support étanché (SPEC) requis en amont. Hors étanchéité SPEC, hors receveur, hors plomberie.',
    cost: {
      mainOeuvreHeures: 1.70,
      mainOeuvreTauxHoraire: 50,
      materiaux: 35,
      chargesEntreprise: 60,
      margeNette: 13,
    },
    priceMin: 137,
    priceMax: 161,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['mosaïque', 'pose mosaïque', 'mosaïque douche', 'douche italienne', 'pâte de verre', 'mosaïque salle de bain'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires carrelage',
        tier: 1,
        excerpt: 'Taux horaire ouvrier carreleur chargé Bouches-du-Rhône : 50 €/h (estimation interne alignée fourchette nationale CAPEB 45-58 €/h chargé)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT09 — Carrelage et revêtements céramiques (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710935',
        excerpt: 'Index BT09 Carrelage et revêtements céramiques base 100 = 2010, dernière mise à jour 15/04/2026. Couvre mosaïques verre / pâte de verre / céramique.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix pose mosaïque 2026',
        tier: 2,
        url: 'https://www.travaux.com/carrelage/guide-des-prix/prix-de-la-pose-de-mosaique',
        excerpt: 'Pose mosaïque douche italienne : 100-180 €/m² fourniture + pose milieu de gamme ; pose seule 60-110 €/m² (plus longue qu\'un carrelage standard)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Quotatis — Prix mosaïque salle de bain 2026',
        tier: 2,
        url: 'https://www.quotatis.fr/conseils-travaux/prix-mosaique/',
        excerpt: 'Mosaïque verre douche italienne : 130-200 €/m² TTC pose comprise ; rendement 1.5-2 h/m² selon découpes et complexité',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — taux horaire 50 €/h is internal estimate aligned with 2025 baseline + INSEE BT09 (ranges nationale CAPEB 45-58 €/h chargé). Étanchéité SPEC support à prévoir en amont (prestation distincte). Refresh via prix-freshness workflow when grid lands.',
  },
]
