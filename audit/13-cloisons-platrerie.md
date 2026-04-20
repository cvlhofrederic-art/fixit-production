# Audit #13 — Cloisons & plâtrerie

**Trade** : `placo` (existant)
**Référentiels FR** :
- **NF DTU 25.41** — Ouvrages en plaques de plâtre sur ossature (cloisons, plafonds, doublages) — homologué 2012, en vigueur
- **NF DTU 25.31** — Plafonds fixés en plaques de plâtre
- **NF DTU 25.1** — Plâtrerie traditionnelle (si applicable)

**Référentiel PT** : NP EN 520 (plaques plâtre) + NP EN 14195 (ossatures métalliques)

**Ouvrages couverts** : 6
- 13.1 Cloison BA13 72/48 simple peau (existant, à enrichir)
- 13.2 Cloison BA13 98/48 double peau (existant, à enrichir)
- 13.3 Cloison alvéolaire (**création**)
- 13.4 Doublage collé Placomur® (**création**)
- 13.5 Doublage sur ossature (existant, à vérifier)
- 13.6 Plafond suspendu BA13 sur F530 (existant, à enrichir)

---

## 13.1 Ouvrage : Cloison placo BA13 72/48 simple peau

### 📚 Référence
- **NF DTU 25.41** §5.1 (mise en œuvre ossature), §6 (pose plaques), §7 (traitement joints)

### État actuel
Fichier : `recipes/placo.ts` → `id: 'cloison-placo-72-48'` — enrichi partiellement le 2026-04-19 (phases + hypothèses)

**Déjà présent** :
- ✅ Plaque BA13 (2 m²/m²)
- ✅ Rail R48 (0,8 ml/m²)
- ✅ Montant M48 (1,80 ml/m²)
- ✅ Vis TTPC 25 mm (30 u/m²)
- ✅ Cheville à frapper 6×40 (2 u/m²)
- ✅ Bande à joints papier (1,8 ml/m²)
- ✅ Enduit à joints (0,5 kg/m²)
- ✅ Laine verre 45 mm (1 m²/m²)
- ✅ Joint acoustique PU en option

### ❌ Manques identifiés

#### Strate 1 — Préparation
- 🔴 **Tracé au cordeau + pieds de rail caoutchouc** — petit consommable `conseille`
  - Formule : `perimetre_rail × 2` u (1 pied / 60 cm)
  - Pertes : 15%

#### Strate 3 — Accessoires
- 🔴 **Cornière d'angle métallique** (renfort angles sortants) `obligatoire` si angles > 90°
  - Formule : `nb_angles × hauteur` ml
  - Pertes : 10%
  - Ref : NF DTU 25.41 §6.5
  - Conditionnement : longueur 2,50 m

- 🔴 **Enduit de finition (2e passe)** `obligatoire` — DTU 25.41 §7.3
  - Formule : `surface × 0.3` kg (seconde passe après bandes)
  - Pertes : 15%
  - Fabricant : Placo PR4 ou Weber Lisso

- 🔴 **Papier de verre grain 180** (ponçage inter-passes) `obligatoire`
  - Formule : `surface × 0.1` u
  - Conditionnement : paquet 10 feuilles

#### Strate 4 — Finitions
- 🔴 **Apprêt plaques BA13** (avant peinture) `conseille`
  - Formule : `surface × 0.12` L
  - *Note : actuellement dans recette peinture — à dé-dupliquer*

#### Renfort (options)
- 🔴 **Rail de renfort à impact (plaque porte-charge)** `optionnel_selon_contexte`
  - Condition : « Si pose mobilier lourd (WC suspendu, vasque, TV, biblio) »
  - Référence : fabricant Placo® 80×60 mm

### 🔧 Correctif à appliquer

Ajouter dans `cloison-placo-72-48`.materials[] :

```typescript
{
  id: 'corniere-angle-metal',
  name: 'Cornière d\'angle métallique (renfort angles sortants)',
  category: 'accessoire', phase: 'accessoires',
  quantityPerBase: 0.3, unit: 'ml',  // hypothèse 0,3 ml/m² (1 angle / ~3 m²)
  geometryMultiplier: 'height',
  wasteFactor: 1.10, wasteReason: 'Coupes + casse transport',
  dtu: 'NF DTU 25.41 §6.5',
  manufacturerRef: 'Placo® cornière 2,50 m',
  packaging: { unit: 'u', contentQty: 2.5, contentUnit: 'ml', label: 'cornière 2,50 m' },
},
{
  id: 'enduit-finition-placo',
  name: 'Enduit de finition 2e passe',
  category: 'enduit', phase: 'finitions',
  quantityPerBase: 0.3, unit: 'kg',
  geometryMultiplier: 'none',
  wasteFactor: 1.15, wasteReason: 'Résidus taloche, sur-dosage',
  dtu: 'NF DTU 25.41 §7.3',
  manufacturerRef: 'Placo PR4 / Weber Lisso',
  packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
},
{
  id: 'papier-verre-180-placo',
  name: 'Papier de verre grain 180 (ponçage plaques)',
  category: 'accessoire', phase: 'finitions',
  quantityPerBase: 0.1, unit: 'u',
  geometryMultiplier: 'none',
  wasteFactor: 1.20, wasteReason: 'Usure feuille',
  packaging: { unit: 'u', contentQty: 10, contentUnit: 'u', label: 'paquet 10 feuilles' },
},
```

+ Compléter `hypothesesACommuniquer` avec :
```typescript
'Cornière d\'angle inclusmatière pour 1 angle sortant tous les 3 m² (hypothèse)',
'Enduit 2 passes obligatoire (DTU 25.41 §7.3) : 1re passe sur bande + 2e de finition',
'Apprêt avant peinture à prévoir côté trade peinture (DTU 59.1)',
'Rail renfort mobilier NON inclus — à ajouter si WC suspendu / biblio / TV',
```

### 🧪 Test de validation
**Input** : « Cloison BA13 72/48 — 15 m² (5 ml × 3 m h), 2 angles sortants »

**Output attendu** :
| Phase | Matériau | Qté |
|---|---|---|
| prep | Plaque BA13 | 33 m² (11 plaques) |
| prep | Rail R48 | 13,2 ml |
| prep | Montant M48 | 29,7 ml |
| prep | Laine verre 45 mm | 16,05 m² |
| accessoires | Vis TTPC 25 | 519 u |
| accessoires | Cheville frapper 6×40 | 36 u |
| accessoires | **Cornière angle** 🆕 | 6,6 ml (3 cornières 2,50 m) |
| finitions | Bande joints papier | 29,7 ml |
| finitions | Enduit joints (1re passe) | 9 kg |
| finitions | **Enduit finition** 🆕 | 5,4 kg |
| finitions | **Papier verre 180** 🆕 | 2 feuilles (1 paquet) |

---

## 13.2 Ouvrage : Cloison placo BA13 98/48 double peau

### État actuel : 🟡 existe, enrichissement similaire 13.1
Manques identiques : cornières d'angle, enduit finition, papier verre.

### Spécifiques double peau
- 4 plaques BA13 / m² de mur (vs 2)
- Isolation acoustique renforcée (laine 60 mm)
- Cloison à performance acoustique 49 dB

### 🔧 Correctif : mêmes 3 ajouts que 13.1 + vérifier présence isolant.

---

## 13.3 Ouvrage : Cloison alvéolaire — **CRÉATION**

### 📚 Référence
- **NF DTU 25.41** §9 — Cloisons alvéolaires
- Fabricant : Placo® Placopan / Knauf Alba

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 2 — Principal
- **Panneau alvéolaire Placopan** (épaisseur 50/70/100 mm)
  - Formule : `surface × 1.05` m²
  - Pertes : 5%
  - Conditionnement : panneau 2,50 × 1,20 m

- **Colle polyuréthane** (jonction panneaux + angles)
  - Formule : `perimetre_panneaux × 0.05` L
  - Conditionnement : cartouche 310 ml

#### Strate 3 — Accessoires
- **Rail U de finition périphérique** (périmètre)
- **Mousse PU remplissage tête/pied**
- **Vis TTPC** pour fixation sur rails

#### Strate 4 — Finitions
- Bande + enduit finition (sur les joints)

### 🔧 Correctif : nouvelle recette `cloison-alveolaire-placopan`.

### 🧪 Test
**Input** : « Cloison alvéolaire 72 mm, 12 m² »
**Output** : 12,6 m² panneau + colle PU + rails U + bande + enduit.

---

## 13.4 Ouvrage : Doublage collé Placomur® PSE — **CRÉATION**

### 📚 Référence
- **NF DTU 25.42** — Ouvrages complexes de doublage collés
- Fabricant : Placo® Placomur

### État actuel : 🔴 ABSENT (une option existe dans cloison-placo-98-48 mais pas ouvrage autonome)

### Structure cible

#### Strate 1 — Préparation
- **Primaire régulateur adhérence** (sur support fortement absorbant) — `conseille`
  - Formule : `surface × 0.15` L

#### Strate 2 — Principal
- **Panneau Placomur® PSE Th38** (80+13 ou 120+13 mm selon perf thermique)
  - Formule : `surface × 1` m²
  - Pertes : 5% (découpes)
  - Conditionnement : panneau 2,50 × 1,20 m

- **MAP (Mortier Adhésif pour Panneau)** — obligatoire DTU 25.42
  - Formule : `surface × 4` kg
  - Pertes : 10%
  - Fabricant : Placo® MAP Formule+
  - Conditionnement : sac 25 kg

#### Strate 3 — Accessoires
- **Chevilles à frapper 6×40** (renfort : ≈ 3/m²)
- **Bande armée coin** (renfort jonctions)
- **Cales bois** (verticalité)

#### Strate 4 — Finitions
- **Bande à joints**
- **Enduit** (1re + 2e passe)

### 🔧 Correctif : nouvelle recette `doublage-placomur-pse`.

### 🧪 Test
**Input** : « Doublage collé Placomur 80+13, 40 m² »
**Output** : 42 m² panneau + 176 kg MAP (7 sacs 25 kg) + chevilles + bande + enduit.

---

## 13.5 Ouvrage : Doublage sur ossature (100/70 ou 120/70)

### État actuel : 🟡 existe dans `cloison-placo-98-48` mais comme cloison double peau — à clarifier

Notes :
- Doublage = habillage d'un mur EXISTANT (intérieur)
- Cloison = structure PORTEUSE d'un espace intérieur
- Structurellement similaire (montants + plaques + laine) mais :
  - Doublage : face unique contre le mur existant
  - Cloison : deux faces

### 🔧 Correctif : séparer en recettes distinctes
- `doublage-placo-100-70` (nouveau)
- `cloison-placo-98-48` (existant, reste cloison)

### 🧪 Test
**Input** : « Doublage sur ossature 100+60, 30 m² »
**Output** : plaques BA13 (30 m²) + rails + montants + laine 60 mm + vis + bande + enduit.

---

## 13.6 Ouvrage : Plafond suspendu BA13 sur F530

### État actuel
`id: 'plafond-placo-f530'` — existe, enrichissement similaire.

### ❌ Manques
- Apprêt avant peinture
- Enduit finition 2e passe
- **Trappes d'accès** si faux-plafond cache gaines
  - Formule : `1` u / 20 m² (estimation)
  - Condition : « Si faux-plafond cache gaines/évacuations »
- **Papier verre**

### 🔧 Correctif : mêmes ajouts que 13.1 + trappes en option.

---

## 📋 Synthèse trade #13

| Ouvrage | État | Action |
|---|:-:|---|
| 13.1 Cloison 72/48 | 🟡 | 3 matériaux à ajouter |
| 13.2 Cloison 98/48 | 🟡 | 3 matériaux à ajouter |
| 13.3 Cloison alvéolaire | 🔴 | recette complète (8 matériaux) |
| 13.4 Doublage Placomur | 🔴 | recette complète (10 matériaux) |
| 13.5 Doublage ossature | 🟡 | créer recette dédiée (séparer de cloison 98/48) |
| 13.6 Plafond F530 | 🟡 | 4 matériaux à ajouter + trappes option |

**Volume à créer / enrichir** : 3 nouvelles recettes, 13 matériaux à ajouter sur existants.

**Temps implémentation** : ~2 h 30.

---

## ✅ Statut audit #13

- [x] NF DTU 25.41 + 25.42 vérifiés
- [x] Distinction cloison / doublage clarifiée
- [x] 6 ouvrages structurés
- [ ] Implémentation : attente P3

**Prochain audit** : #17 Plomberie sanitaire.
