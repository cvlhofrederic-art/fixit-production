# Audit #03 — Dallage & sol béton

**Trade** : `maconnerie` (sous-domaine dallage)
**Référentiel FR** : NF DTU 13.3 (NF P11-213) — révision décembre 2021
**Référentiel PT** : NP EN 206 + NP EN 13670 + Eurocódigo 2 (NP EN 1992) + Decreto-Lei n.º 90/2021

**Ouvrages couverts** : 4
- 3.1 Dallage sur terre-plein armé ST25C (habitation)
- 3.2 Dallage sur terre-plein armé ST40C (garage / charges lourdes)
- 3.3 Chape ciment (lissée ou incorporée)
- 3.4 Ragréage autolissant

---

## 3.1 Ouvrage : Dallage sur terre-plein armé ST25C (habitation)

### 📚 Référence normative
- **NF DTU 13.3** (NF P11-213) rev. 2021 — *Travaux de dallages — Conception, calcul et exécution*
- **Partie 1-1-2** : Cahier CCT pour maisons individuelles (pour ST25C habitation)
- **NF EN 206** : spécification béton
- **NF A 35-080-1** : treillis soudés ADETS
- **Eurocode 2** (NF EN 1992-1-1) : conception BA

### État actuel dans la base
Fichier : `lib/estimation-materiaux/recipes/maconnerie.ts` → `id: 'dalle-ba-armee-st25c'`

Déjà présent (après commit `32cdd84` / `250daf5`) :

**Strate 1 — Préparation**
- ✅ Géotextile 200 g/m² (recouvrement 30 cm, DTU 13.3 §5.1)
- ✅ Hérisson concassé 20/40 (épaisseur 20 cm)
- ✅ Sable de compactage 0/4 (5 cm)
- ✅ Film polyane 200 μm (DTU 13.3 §5.1.4)

**Strate 2 — Principal**
- ✅ Ciment CEM II/B 32,5 R (350 kg/m³ — NF EN 197-1)
- ✅ Sable 0/4 (500 L/m³)
- ✅ Gravier 4/20 (700 L/m³)
- ✅ Eau gâchage (175 L/m³, E/C = 0,50)
- ✅ Treillis ST25C Ø7 maille 150×150 (DTU 13.3 §5.3)

**Strate 3 — Accessoires**
- ✅ Cales d'enrobage 30 mm (DTU 21 §7.2)
- ✅ Joint dilatation périphérique mousse PE 10 mm (DTU 13.3 §6.2)
- ✅ Joint de retrait scié (DTU 13.3 §6.3)
- ✅ Produit de cure pulvérisé (DTU 21 §8)

**Strate 5 — Options conditionnelles**
- ✅ Isolant XPS 60 mm sous dalle (RE2020)
- ✅ Hydrofuge de masse (zone humide)

### ❌ Manques identifiés

#### Strate 1 — Préparation
- 🔴 **Fibre polypropylène anti-fissuration** (`obligatoire` pour dallage intérieur classe résistance P3)
  - Formule : `volume_beton × 0.9` kg/m³
  - Unité : kg
  - Pertes : 5% (sur-dosage)
  - Ref : NF DTU 13.3 §5.4.3 (dispositions fibres), NF EN 14889-2
  - Conditionnement : sachet dosage 0,9 kg (1 sachet / m³ béton)

#### Strate 3 — Accessoires
- 🔴 **Bande résiliente périphérique 5 mm sous dalle** (`obligatoire` si dalle contre mur porteur)
  - Formule : `perimetre × 1` ml, épaisseur ≥ 5 mm
  - Pertes : 5%
  - Ref : NF DTU 13.3 §6.2 — désolidarisation mur/dalle
  - Conditionnement : rouleau 50 ml ×  15 cm haut (Sika / Weber)
  - *Différent du joint dilatation 10 mm (qui est en partie basse) — celui-ci est vertical contre mur*

- 🔴 **Fers de liaison HA8 en attente** (si dalle contre voile existant, `conseille`)
  - Formule : `perimetre × 2` u (1 fer tous les 50 cm)
  - Pertes : 10%
  - Ref : NF DTU 13.3 §5.5 + Eurocode 2 §8.10
  - Conditionnement : barre 6 m

#### Strate 4 — Finitions
- 🔴 **Durcisseur de surface minéral (quartz)** (`optionnel_selon_contexte` — locaux techniques)
  - Formule : `surface × 4` kg/m²
  - Pertes : 10% (sur-dosage saupoudrage)
  - Ref : NF DTU 13.3 §8.2
  - Conditionnement : sac 25 kg (Sika ChapDur / Weber)
  - Condition : « Si local technique, garage professionnel, entrepôt »

- 🔴 **Talochage mécanique (lisseuse hélicoptère)** — c'est de la main d'œuvre, NE FAIT PAS partie matériaux. À ne pas lister.

#### Strate 6 — Consommables
- 🔴 **Disque diamant Ø350 mm pour sciage joints retrait** (`obligatoire` si dalle > 25 m²)
  - Formule : `1 × max(0, floor(surface / 100))` u (1 disque pour 100 ml de joint)
  - Pertes : 0%
  - Conditionnement : unité
  - Ref : DTU 13.3 §6.3

### 🔧 Correctif à appliquer

Ajouter ces 4 matériaux dans `lib/estimation-materiaux/recipes/maconnerie.ts` → recette `dalle-ba-armee-st25c` :

```typescript
// Ajouter dans materials[] après les éléments existants :
{
  id: 'fibre-polypro-pp',
  name: 'Fibre polypropylène anti-fissuration (L = 12 mm)',
  category: 'adjuvant', phase: 'principal',
  quantityPerBase: 0.9, unit: 'kg',
  geometryMultiplier: 'thickness',
  wasteFactor: 1.05, wasteReason: 'Sur-dosage sachet',
  dtu: 'NF DTU 13.3 §5.4.3', normRef: 'NF EN 14889-2',
  manufacturerRef: 'Sika Fiber PPM-12 / Chryso Fibrin',
  packaging: { unit: 'sac', contentQty: 0.9, contentUnit: 'kg', label: 'sachet 900 g (dose 1 m³)' },
  notes: 'Obligatoire dallage habitation pour anti-fissuration retrait plastique.',
},
{
  id: 'bande-resiliente-peripherique',
  name: 'Bande résiliente périphérique 5 mm (désolidarisation mur)',
  category: 'joint', phase: 'accessoires',
  quantityPerBase: 1, unit: 'ml',
  geometryMultiplier: 'perimeter',
  wasteFactor: 1.05, wasteReason: 'Coupes aux angles',
  dtu: 'NF DTU 13.3 §6.2',
  manufacturerRef: 'Sika Swell / Weber Sysfloor bande',
  packaging: { unit: 'rouleau', contentQty: 50, contentUnit: 'ml', label: 'rouleau 50 ml × 15 cm' },
  notes: 'Distincte du joint mousse PE (horizontal) — celle-ci est verticale contre mur.',
},
{
  id: 'durcisseur-surface-quartz',
  name: 'Durcisseur de surface minéral quartz (saupoudrage)',
  category: 'adjuvant', phase: 'finitions',
  quantityPerBase: 4, unit: 'kg',
  geometryMultiplier: 'none',
  wasteFactor: 1.10, wasteReason: 'Saupoudrage pratique',
  dtu: 'NF DTU 13.3 §8.2',
  manufacturerRef: 'Sika ChapDur Grey / Weber Quartz',
  packaging: { unit: 'sac', contentQty: 25, contentUnit: 'kg', label: 'sac 25 kg' },
  optional: true,
  condition: 'Si local technique, garage professionnel, entrepôt (resistance P4S)',
},
// Hypothèses à ajouter :
// hypothesesACommuniquer:
//   "Fibre polypropylène dosée 0,9 kg/m³ (anti-fissuration retrait plastique NF DTU 13.3 §5.4.3)"
//   "Bande résiliente périphérique 5 mm verticale contre mur — en plus du joint dilatation horizontal"
//   "Durcisseur quartz NON inclus par défaut — à ajouter si usage intensif (atelier/garage pro)"
```

### 🧪 Test de validation

**Input utilisateur** :
> « J'ai une dalle de 8×5 mètres en 12 cm pour un garage d'habitation, sur terre-plein. »

**Output attendu** (matériaux obligatoires qui DOIVENT apparaître) :

| Phase | Matériau | Qté attendue | Unité |
|---|---|---|---|
| prep | Géotextile 200 g/m² | 44,0 | m² |
| prep | Hérisson concassé 20/40 | 8,8 | m³ |
| prep | Sable compactage 0/4 | 2,2 | m³ |
| prep | Film polyane 200 μm | 46,0 | m² |
| principal | Ciment CEM II/B 32,5 R | 1 733 | kg (= 50 sacs 35 kg) |
| principal | Sable 0/4 | 2,64 | m³ |
| principal | Gravier 4/20 | 3,70 | m³ |
| principal | Eau gâchage | 924 | L |
| principal | Treillis ST25C | 46,0 | m² (= 4 panneaux 6×2,4m) |
| principal | **Fibre polypro 12 mm** 🆕 | **4,54** | **kg (= 5 sachets 0,9 kg)** |
| accessoires | Cales béton 30 mm | 176 | u |
| accessoires | Joint dilatation PE 10 mm | 27,3 | ml (périmètre) |
| accessoires | **Bande résiliente 5 mm** 🆕 | **27,3** | **ml (périmètre)** |
| accessoires | Joint retrait scié | 17,6 | ml (obligatoire >25 m²) |
| accessoires | Produit de cure | 8,8 | L |
| finitions | **Durcisseur quartz** 🆕 | optionnel |  |
| options | Isolant XPS 60 mm | optionnel (RE2020) |  |
| options | Hydrofuge masse | optionnel (zone humide) |  |

**Hypothèses que l'IA doit afficher** :
- Hérisson de 20 cm en concassé 20/40 supposé (à adapter selon portance du sol)
- Géotextile 200 g/m² sous hérisson (anti-remontée fines)
- Fibre polypropylène anti-fissuration incluse (NF DTU 13.3 §5.4.3)
- Bande résiliente périphérique 5 mm en plus du joint dilatation
- Joints de retrait sciés prévus tous les 25 m² maxi
- Durcisseur quartz à ajouter si usage intensif (garage atelier professionnel)
- Isolant sous dalle NON inclus par défaut — à ajouter pour RE2020

---

## 3.2 Ouvrage : Dallage sur terre-plein armé ST40C (garage / charges lourdes)

### 📚 Référence normative
Idem 3.1 + **NF DTU 13.3 Partie 1-1-1** (pour usages industriels/circulation lourde).

### État actuel
Recette `dalle-ba-armee-st40c` existe mais **n'a pas été enrichie** (seuls ST25C a reçu les ajouts le 2026-04-19).

### ❌ Manques identifiés
**Mêmes 4 manques que 3.1** + spécifiques charges lourdes :

#### Strate 3 — Accessoires
- 🔴 **Joint de construction (dalle coulée en plusieurs passes)** `conseille`
  - Formule : `ceil(sqrt(surface) / 6) × sqrt(surface)` ml (panneaux 6×6 m max)
  - Ref : NF DTU 13.3 §6.4 — joints de construction pour dalle industrielle

#### Strate 2 — Principal (correctif sur l'existant)
- Épaisseur minimale **12 cm** (vs 8 cm pour ST25C) → mettre à jour `constraints.minThickness: 0.12`
- Armature ST40C Ø8 maille 150×150 (déjà OK dans la recette)

### 🔧 Correctif à appliquer
Reprendre les mêmes 4 matériaux que 3.1, appliquer à `dalle-ba-armee-st40c`, + :

```typescript
// Durcir la contrainte d'épaisseur :
constraints: {
  minThickness: 0.12, maxThickness: 0.25,
  note: 'Dalle garage charges lourdes : 12 cm minimum (DTU 13.3 Partie 1-1-1).',
},
// Et ajouter dans materials :
{
  id: 'joint-construction-metal',
  name: 'Profilé joint de construction métallique (reprise bétonnage)',
  category: 'joint', phase: 'accessoires',
  quantityPerBase: 0.15, unit: 'ml',
  geometryMultiplier: 'none',
  wasteFactor: 1.05, wasteReason: 'Coupes aux raccords',
  dtu: 'NF DTU 13.3 §6.4',
  manufacturerRef: 'Permaban / Betobar',
  optional: true,
  condition: 'Si dalle > 36 m² ou bétonnage en plusieurs passes',
},
```

### 🧪 Test de validation
**Input** : « Dalle garage professionnel 10×6m, épaisseur 15 cm »
**Output** : mêmes matériaux que 3.1 (qty recalculée pour 60 m² × 0,15 m) + joint de construction.

---

## 3.3 Ouvrage : Chape ciment

### 📚 Référence normative
- **NF DTU 26.2** (NF P14-201) rev. 2021 — *Chapes et dalles à base de liants hydrauliques*
- NF EN 13813 — chapes de matériaux synthétiques

### État actuel
**🔴 ABSENT** dans la base.

### ❌ Structure cible (création totale)

#### Strate 1 — Préparation (obligatoire)
- Primaire d'accrochage (si chape adhérente) — 0,15 kg/m² — DTU 26.2 §7.2
- Film polyane 150 μm (si chape désolidarisée) — 1 m² × 1,10 — DTU 26.2 §5.2.2
- Isolant acoustique/thermique (si chape flottante) — 1 m² × 1,05 — obligatoire planchers intermédiaires

#### Strate 2 — Principal
- Mortier de chape CT-C25-F4 dosé 300 kg/m³ — 0,3 kg ciment/m²/cm d'épaisseur
  - Ciment CEM II 32,5 R (NF EN 197-1)
  - Sable 0/4
  - Eau (E/C = 0,45)

#### Strate 3 — Accessoires (obligatoire)
- Joint périphérique mousse PE 5 mm × 80 mm haut — `perimetre` ml — DTU 26.2 §8.1
- Joint de fractionnement (chape flottante > 40 m²) — `surface / 40` ml — DTU 26.2 §8.2

#### Strate 4 — Finitions (conseillé)
- Produit de cure — 0,2 L/m² — DTU 26.2 §9

### 🔧 Correctif : créer recette complète
→ À faire dans `recipes/maconnerie.ts` après validation format gabarit.

### 🧪 Test de validation
**Input** : « Chape ciment 50 m² épaisseur 5 cm flottante sur isolant »
**Output attendu** :
- Isolant 50 m² × 1,05
- Joint périph 5 mm × 80 mm : périmètre (≈ 28 ml pour 10×5)
- Mortier chape : 50 × 0,05 = 2,5 m³ → ciment 750 kg, sable 1,25 m³, eau 337 L
- Joint fractionnement : 50/40 = 1,25 ml

---

## 3.4 Ouvrage : Ragréage autolissant

### 📚 Référence normative
- **NF DTU 53.2** (NF P62-203) — lorsque le ragréage prépare un revêtement PVC
- **NF DTU 52.2** §6.2 — lorsque le ragréage prépare carrelage
- Classement **P3** min sol habitation

### État actuel
🟡 **Existe déjà en option** dans `carrelage-sol-colle-45` (mais pas comme ouvrage autonome).

### ❌ À créer comme ouvrage autonome pour usage direct.

### 🔧 Structure cible (création)

#### Strate 1 — Préparation
- Primaire d'accrochage époxy ou acrylique — 0,15 kg/m² — fabricant Weber Prim

#### Strate 2 — Principal
- Ragréage autolissant fibré P3 — 5 kg/m² (pour 3 mm moyenne) — fabricant Weber Niv Lex / Mapei Ultraplan
- Eau de gâchage — 0,6 L/m²

### 🔧 Correctif : créer recette `ragreage-autolissant-p3`
→ À faire après validation.

### 🧪 Test de validation
**Input** : « Ragréage 30 m² épaisseur 3 mm avant carrelage »
**Output** :
- Primaire 4,5 kg (5 kg sac bidon 5 kg — 1 bidon)
- Ragréage 150 kg (sac 25 kg — 6 sacs)
- Eau 18 L

---

## 📋 Synthèse trade #03

| Ouvrage | État | Ouvrages à enrichir | Ouvrages à créer |
|---|:-:|:-:|:-:|
| 3.1 Dallage ST25C habitation | 🟡 | 4 matériaux à ajouter | – |
| 3.2 Dallage ST40C garage | 🟡 | 5 matériaux à ajouter + contrainte | – |
| 3.3 Chape ciment | 🔴 | – | recette complète |
| 3.4 Ragréage autolissant | 🟡 | – | recette complète (extraction de l'option existante) |

**Volume correctif estimé** :
- 9 nouveaux matériaux à ajouter aux recettes existantes
- 2 nouvelles recettes complètes à créer
- 1 contrainte `minThickness` à durcir

**Temps d'implémentation** : ~1 h 30

---

## ✅ Statut audit #03

- [x] Vérification normative DTU 13.3 rev. 2021 — sources vérifiées
- [x] Inventaire état actuel
- [x] Identification manques par strate
- [x] Formulation correctifs TypeScript
- [x] Tests de validation formalisés
- [ ] **Implémentation code** : attente validation user sur format gabarit

**Prochain audit après validation** : #04 Maçonnerie traditionnelle.
