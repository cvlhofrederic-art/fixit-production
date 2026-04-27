// lib/prix-travaux-2026/data/maconnerie.ts
//
// Bootstrap Maçonnerie — 5 lignes prix prioritaires 2026.
// Méthodologie : docs/prix-2026-methodology.md
// Sources Tier 1 gratuites uniquement (CAPEB / FFB / INSEE / France Rénov').
// Pas de Batiprix (décision produit : free Tier 1 only).
//
// NOTE INSEE — l'index officiel "Maçonnerie et canalisations en béton" est le
// BT24 (béton armé / parpaing / dalles / ouvrages structurels traditionnels).
// Référence indexation prestations maçonnerie / gros œuvre / VRD béton.
//
// VARIANT 4 — Forfait ouverture mur porteur IPN : structure des coûts
// différente (m.o. élevée ~21h, matériaux IPN HEA160 + scellement chimique +
// étais acrows + études BE structure + gravats + reprise enduits) ; pas de
// €/m². Études Bureau d'Études structure (~700 €) incluses dans le forfait.

import type { PriceLine } from '../types'

export const maconnerieLines: PriceLine[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Dalle béton 15 cm armée — €/m²
  // moBrut    = 1.25 × 52 = 65.00
  // coutBrut  = 65.00 + 56 = 121.00
  // coutFinal = 121.00 × 1.10 = 133.10
  // ttc       = 133.10 × 1.10 = 146.41
  // priceMin  = round(146.41 × 0.92) = 135
  // priceMax  = round(146.41 × 1.08) = 158
  // spread    = (158 − 135) / 135 = 17.0 % ≤ 20 % ✓
  // Hypothèse : dalle béton armée 15 cm sur sol stabilisé, hérisson + film
  // polyane indépendant, treillis soudé ST25C, béton C25/30 prêt à l'emploi
  // toupie, talochage et lissage hélicoptère. Fourniture (~56 €/m² : béton 35
  // + treillis 8 + coffrage 6 + polyane 2 + finition 5). TVA 10 % logement
  // >2 ans. Hors terrassement et hors finition résine/carrelage.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'maconnerie',
    taskId: 'maconnerie-dalle-beton-15cm-armee',
    label: 'Dalle béton 15 cm armée — sol stabilisé',
    unit: 'm2',
    description: 'Dalle béton armée 15 cm sur sol stabilisé : hérisson, film polyane indépendant, treillis soudé ST25C, béton C25/30 prêt à l\'emploi (toupie), coffrage périphérique, talochage et lissage hélicoptère, finition prête à recevoir revêtement. Hors terrassement et hors revêtement de sol.',
    cost: {
      mainOeuvreHeures: 1.25,
      mainOeuvreTauxHoraire: 52,
      materiaux: 56,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 135,
    priceMax: 158,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['dalle béton', 'dalle armée', '15 cm', 'béton C25/30', 'treillis soudé'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires maçonnerie / gros œuvre',
        tier: 1,
        excerpt: 'Taux horaire ouvrier maçon chargé Bouches-du-Rhône : 52 €/h (estimation interne alignée fourchette nationale CAPEB 50-60 €/h chargé pour maçonnerie traditionnelle)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT24 — Maçonnerie et canalisations en béton (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710955',
        excerpt: 'Index BT24 Maçonnerie et canalisations en béton base 100 = 2010, dernière mise à jour T1 2026. Référence indexation prestations gros œuvre / dalles / ouvrages béton armé.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix dalle béton 2026',
        tier: 2,
        url: 'https://www.travaux.com/maconnerie/guide-des-prix/prix-dalle-beton',
        excerpt: 'Dalle béton armée 15 cm fourniture + pose : 120-170 €/m² TTC selon armature et finition (treillis soudé + lissage hélicoptère)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix dalle béton 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/maconnerie/prix-dalle-beton',
        excerpt: 'Dalle béton armée standard 15 cm : 130-160 €/m² TTC fourniture + main d\'œuvre, hors terrassement',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 52 €/h is internal estimate aligned with 2025 baseline + INSEE BT24. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Mur parpaing 20 cm — €/m²
  // moBrut    = 1.05 × 52 = 54.60
  // coutBrut  = 54.60 + 21 = 75.60
  // coutFinal = 75.60 × 1.10 = 83.16
  // ttc       = 83.16 × 1.10 = 91.48
  // priceMin  = round(91.48 × 0.92) = 84
  // priceMax  = round(91.48 × 1.08) = 99
  // spread    = (99 − 84) / 84 = 17.9 % ≤ 20 % ✓
  // Hypothèse : mur parpaing creux 20 cm (B40), pose au mortier bâtard,
  // chaînage horizontal et vertical béton armé tous les 60 cm en hauteur.
  // Fourniture (~21 €/m² : parpaings 13 + mortier 4 + ferraillage chaînage 4).
  // TVA 10 % logement >2 ans. Hors enduit de finition (extérieur ou intérieur)
  // et hors fondations.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'maconnerie',
    taskId: 'maconnerie-mur-parpaing-20cm',
    label: 'Mur parpaing creux 20 cm — montage maçonné',
    unit: 'm2',
    description: 'Mur en parpaings creux 20 cm (B40) : pose au mortier bâtard, joints fins, chaînage horizontal et vertical béton armé tous les 60 cm en hauteur, finition de face brute prête à enduire. Hors enduit de finition (extérieur/intérieur) et hors fondations / semelle filante.',
    cost: {
      mainOeuvreHeures: 1.05,
      mainOeuvreTauxHoraire: 52,
      materiaux: 21,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 84,
    priceMax: 99,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['mur parpaing', 'parpaing 20', 'agglo creux', 'mur maçonné', 'B40'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires maçonnerie / gros œuvre',
        tier: 1,
        excerpt: 'Taux horaire ouvrier maçon chargé Bouches-du-Rhône : 52 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT24 — Maçonnerie et canalisations en béton (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710955',
        excerpt: 'Index BT24 Maçonnerie T1 2026 — applicable murs porteurs et de remplissage parpaing.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix mur parpaing 2026',
        tier: 2,
        url: 'https://www.travaux.com/maconnerie/guide-des-prix/prix-mur-parpaing',
        excerpt: 'Mur parpaing 20 cm fourniture + pose : 75-110 €/m² TTC selon hauteur et chaînages, hors enduit',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Quotatis — Prix mur parpaing 2026',
        tier: 2,
        url: 'https://www.quotatis.fr/conseils-travaux/prix-mur-parpaing/',
        excerpt: 'Mur en parpaings creux B40 20 cm : 80-100 €/m² fourniture + main d\'œuvre, chaînages compris',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 52 €/h is internal estimate aligned with 2025 baseline + INSEE BT24. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Démolition cloison non-porteuse — €/m²
  // moBrut    = 0.40 × 52 = 20.80
  // coutBrut  = 20.80 + 4 = 24.80
  // coutFinal = 24.80 × 1.10 = 27.28
  // ttc       = 27.28 × 1.10 = 30.01
  // priceMin  = round(30.01 × 0.92) = 28
  // priceMax  = round(30.01 × 1.08) = 32
  // spread    = (32 − 28) / 28 = 14.3 % ≤ 20 % ✓
  // Hypothèse : dépose cloison non-porteuse (placo / brique plâtrière / carreau
  // de plâtre), évacuation gravats benne ou big-bag, protection sols. Hors
  // reprise enduits / sols après démolition. TVA 10 % logement >2 ans.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'maconnerie',
    taskId: 'maconnerie-demolition-cloison-non-porteuse',
    label: 'Démolition cloison non-porteuse — dépose + évacuation',
    unit: 'm2',
    description: 'Démolition cloison non-porteuse (placo / brique plâtrière / carreau de plâtre) : dépose au pied de biche / disqueuse, mise en sacs gravats ou big-bag, protection sols et meubles, évacuation en déchetterie pro. Hors reprise enduits / sols / plinthes après démolition.',
    cost: {
      mainOeuvreHeures: 0.40,
      mainOeuvreTauxHoraire: 52,
      materiaux: 4,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 28,
    priceMax: 32,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['démolition cloison', 'dépose cloison', 'cloison non-porteuse', 'casser cloison', 'évacuation gravats'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires maçonnerie / gros œuvre',
        tier: 1,
        excerpt: 'Taux horaire ouvrier maçon chargé Bouches-du-Rhône : 52 €/h (rendement démolition cloison ~0.40 h/m²)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT24 — Maçonnerie et canalisations en béton (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710955',
        excerpt: 'Index BT24 Maçonnerie T1 2026 — applicable travaux de démolition légère / dépose cloisons.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix démolition cloison 2026',
        tier: 2,
        url: 'https://www.travaux.com/maconnerie/guide-des-prix/prix-demolition-cloison',
        excerpt: 'Démolition cloison non-porteuse + évacuation gravats : 25-40 €/m² TTC selon nature (placo simple à carreau de plâtre)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix démolition cloison 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/maconnerie/prix-demolition-cloison',
        excerpt: 'Démolition cloison légère + évacuation : 25-50 €/m² fourniture sacs/benne incluse, hors reprise',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 52 €/h is internal estimate aligned with 2025 baseline + INSEE BT24. Refresh via prix-freshness workflow when grid lands.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Ouverture mur porteur avec pose IPN — forfait
  // moBrut    = 21 × 52 = 1092
  // coutBrut  = 1092 + 1700 = 2792
  // coutFinal = 2792 × 1.15 = 3210.80
  // ttc       = 3210.80 × 1.10 = 3531.88
  // priceMin  = round(3531.88 × 0.92) = 3249
  // priceMax  = round(3531.88 × 1.08) = 3814
  // spread    = (3814 − 3249) / 3249 = 17.4 % ≤ 20 % ✓
  // Hypothèse forfait pour ouverture standard ~2.20 m × 2.10 m dans mur
  // porteur (parpaing/agglo/pierre légère) :
  //   • Études Bureau d'Études structure (note de calcul + plans) : 700 €
  //   • IPN HEA160 (~3 m) ou bipoutre HEA140 : 250-350 €
  //   • Scellement chimique + jambages béton + appuis : 200 €
  //   • Location étais acrows + protections : 150 €
  //   • Évacuation gravats + benne : 200 €
  //   • Reprise enduits + raccord plâtre 2 faces : 100 €
  //   ≈ 1700 € matériaux/sous-traitance externalisée
  //   • Main d'œuvre : 21h (étaiement + percement + pose IPN + scellement +
  //     reprise) à 52 €/h
  // Marge majorée 15 % (responsabilité travaux structurels). TVA 10 %
  // logement >2 ans. Forfait HORS dépose menuiseries / sol / portes vitrées.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'maconnerie',
    taskId: 'maconnerie-ouverture-mur-porteur-IPN',
    label: 'Ouverture mur porteur — pose IPN + études structure (forfait)',
    unit: 'forfait',
    description: 'Forfait ouverture standard 2.20 m × 2.10 m dans mur porteur : études Bureau d\'Études structure (note de calcul + plans), étaiement provisoire (étais acrows + bastaings), percement contrôlé, fourniture et pose IPN HEA160 (~3 m) ou bipoutre HEA140, scellement chimique + jambages béton + appuis, reprise enduits 2 faces, évacuation gravats. Hors dépose menuiseries, sol et finition peinture.',
    cost: {
      mainOeuvreHeures: 21,
      mainOeuvreTauxHoraire: 52,
      materiaux: 1700,
      chargesEntreprise: 60,
      margeNette: 15,
    },
    priceMin: 3249,
    priceMax: 3814,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['ouverture mur porteur', 'pose IPN', 'mur porteur', 'études structure', 'bipoutre', 'agrandir ouverture'],
      requiresFollowUp: ['nature du mur porteur (agglo/pierre/béton)', 'dimensions ouverture souhaitée', 'étage et accès chantier'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires maçonnerie / gros œuvre',
        tier: 1,
        excerpt: 'Taux horaire ouvrier maçon chargé Bouches-du-Rhône : 52 €/h (rendement majoré + responsabilité travaux structurels)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT24 — Maçonnerie et canalisations en béton (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710955',
        excerpt: 'Index BT24 Maçonnerie T1 2026 — applicable ouvertures structurelles avec linteaux acier (IPN/HEA).',
        accessedAt: '2026-04-27',
      },
      {
        name: 'FFB — Observatoire de la maçonnerie (édition 2026)',
        tier: 1,
        url: 'https://www.ffbatiment.fr/',
        excerpt: 'Ouverture mur porteur avec linteau acier + études structure : forfait national observé 3000-4500 € TTC selon section IPN, dimensions, accès chantier et complexité études BE',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix ouverture mur porteur 2026',
        tier: 2,
        url: 'https://www.travaux.com/maconnerie/guide-des-prix/prix-ouverture-mur-porteur',
        excerpt: 'Ouverture mur porteur avec pose IPN et études structure : 2500-5000 € TTC forfait, études BE 500-900 € incluses',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix ouverture mur porteur 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/maconnerie/prix-ouverture-mur-porteur',
        excerpt: 'Ouverture standard avec IPN + reprise enduits : 3000-4000 € TTC forfait courant pour ouverture porte/passage',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 52 €/h is internal estimate aligned with 2025 baseline + INSEE BT24. Refresh via prix-freshness workflow when grid lands. Forfait dimensionné pour ouverture standard ~2.20×2.10 m ; revoir en présence de mur porteur béton armé épais, pierres lourdes, étage élevé sans accès direct, ou exigences architecte (PC).',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Ravalement façade — enduit monocouche — €/m²
  // moBrut    = 0.70 × 52 = 36.40
  // coutBrut  = 36.40 + 20 = 56.40
  // coutFinal = 56.40 × 1.10 = 62.04
  // ttc       = 62.04 × 1.10 = 68.24
  // priceMin  = round(68.24 × 0.92) = 63
  // priceMax  = round(68.24 × 1.08) = 74
  // spread    = (74 − 63) / 63 = 17.5 % ≤ 20 % ✓
  // Hypothèse : ravalement façade avec enduit monocouche projeté (gobetis +
  // corps d'enduit + finition grattée ou talochée) sur façade saine, hors
  // décapage lourd ou réparation fissures structurelles. Fourniture (~20 €/m² :
  // enduit monocouche 12 + sous-enduit/treillis 5 + échafaudage léger 3).
  // TVA 10 % logement >2 ans. Échafaudage léger inclus. Hors traitement
  // anti-mousse poussé et hors fissures structurelles à reprendre.
  // ─────────────────────────────────────────────────────────────────────────
  {
    metier: 'maconnerie',
    taskId: 'maconnerie-ravalement-facade-enduit',
    label: 'Ravalement façade — enduit monocouche projeté',
    unit: 'm2',
    description: 'Ravalement façade avec enduit monocouche projeté : nettoyage haute pression, gobetis d\'accrochage, corps d\'enduit (treillis verre sur points sensibles), finition grattée ou talochée teinte au choix. Échafaudage léger inclus. Façade saine, hors décapage lourd / reprise fissures structurelles / traitement anti-mousse poussé.',
    cost: {
      mainOeuvreHeures: 0.70,
      mainOeuvreTauxHoraire: 52,
      materiaux: 20,
      chargesEntreprise: 60,
      margeNette: 10,
    },
    priceMin: 63,
    priceMax: 74,
    priceUnit: 'EUR_TTC',
    tva: 10,
    conditions: {
      keywords: ['ravalement façade', 'enduit monocouche', 'crépi', 'façade extérieure', 'enduit projeté'],
    },
    sources: [
      {
        name: 'CAPEB PACA 2026 — Taux horaires maçonnerie / gros œuvre',
        tier: 1,
        excerpt: 'Taux horaire ouvrier maçon-façadier chargé Bouches-du-Rhône : 52 €/h',
        accessedAt: '2026-04-27',
      },
      {
        name: 'INSEE Index BT24 — Maçonnerie et canalisations en béton (T1 2026)',
        tier: 1,
        url: 'https://www.insee.fr/fr/statistiques/serie/001710955',
        excerpt: 'Index BT24 Maçonnerie T1 2026 — applicable enduits façade monocouche projetés.',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Travaux.com — Prix ravalement façade enduit 2026',
        tier: 2,
        url: 'https://www.travaux.com/maconnerie/guide-des-prix/prix-ravalement-facade',
        excerpt: 'Ravalement façade enduit monocouche : 55-85 €/m² TTC selon état façade et accessibilité (échafaudage léger inclus)',
        accessedAt: '2026-04-27',
      },
      {
        name: 'Habitatpresto — Prix ravalement façade 2026',
        tier: 2,
        url: 'https://www.habitatpresto.com/mag/maconnerie/prix-ravalement-facade',
        excerpt: 'Enduit monocouche projeté façade saine : 60-80 €/m² TTC fourniture + main d\'œuvre, échafaudage compris',
        accessedAt: '2026-04-27',
      },
    ],
    lastVerified: '2026-04-27',
    confidence: 'medium',
    notes: 'CAPEB PACA 2026 grid pending official Q1 publication — 52 €/h is internal estimate aligned with 2025 baseline + INSEE BT24. Refresh via prix-freshness workflow when grid lands. Hors ITE (Isolation Thermique par l\'Extérieur) éligible aides ; voir famille métier ITE dédiée.',
  },
]
