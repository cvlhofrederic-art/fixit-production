# Audit #16 — Revêtements muraux

**Trade** : `peinture` / `carrelage` (existants — à étendre)
**Référentiels FR** :
- **NF DTU 59.1** — Peinture des bâtiments
- **NF DTU 59.4** — Papier peint / tentures
- **NF DTU 52.2** — Faïence murale (cf. #15)
- **NF DTU 25.1** — Plâtrerie traditionnelle (enduits décoratifs plâtre)

**Ouvrages couverts** : 5
- 16.1 Peinture murs neuf/entretien (existant — enrichi)
- 16.2 Faïence salle de bain / cuisine
- 16.3 Papier peint
- 16.4 Enduit décoratif (chaux, tadelakt)
- 16.5 Lambris bois

---

## 16.1 Peinture murs

### État actuel : 🟡 — existe `peinture-murs-neuf-acryl` et `-entretien`, enrichi (phases)

### Manques complémentaires

- 🔴 **Brosse / rouleau / bac à peinture** (consommables)
  - Formule : 1 kit standard / chantier (pas au m²)
  - Conditionnement : kit 10 € chez Castorama

- 🔴 **Toiles de protection sol / mobilier** — `conseille`
  - Formule : `surface_pièce × 0.5` m² (protection sol + meubles)

### 🔧 Correctif : ajouter 2 accessoires "consommables chantier" aux recettes existantes.

---

## 16.2 Faïence salle de bain

### État actuel : 🟡 — existe `carrelage-mur-faience-20`, enrichi

### Manques
- 🔴 **Listel décoratif / frise**
  - Formule : `perimetre × 0.2` ml (estimation)
  - Optionnel

- 🔴 **Membrane SPEC sous faïence** (douche italienne contre paroi)
  - Déjà couvert par #9.3

### 🧪 Test
Cf. `carrelage-mur-faience-20` déjà testé.

---

## 16.3 Papier peint

### 📚 Référence
- **NF DTU 59.4** — Papier peint

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Lessive de décrassage** (murs propres)
- **Enduit lissage** (si support Placo classe A)
  - Formule : `surface × 0.3` kg
- **Primaire papiers peints** (sous-couche dédiée)
  - Formule : `surface × 0.1` L

#### Strate 2 — Principal
- **Papier peint** (rouleau 10 m × 0,53 m)
  - Formule : `surface / 5.3 × 1.1` u (surface rouleau utile × 1.1 pour raccords motifs)
  - Pertes : 10-20% selon raccord motif

- **Colle** (à papier peint)
  - Formule : `surface × 0.1` kg
  - Conditionnement : sachet 200-300 g (pour ≈ 25 m²)

#### Strate 3 — Accessoires
- **Brosse à encoller**
- **Cutter + règle**
- **Lisseuse à papier peint**

### 🧪 Test
**Input** : « Papier peint 25 m² »
**Output** : 5 rouleaux + 1 sachet colle + enduit lissage + primaire + kit accessoires.

---

## 16.4 Enduit décoratif (chaux, tadelakt, stuc)

### 📚 Référence
- **NF DTU 25.1** — Plâtrerie traditionnelle + référentiels fabricants

### État actuel : 🔴 ABSENT

### Structure cible (tadelakt par exemple)

#### Principal
- **Chaux aérienne CL90** (base tadelakt)
  - Formule : `surface × 6` kg
  - Fabricant : Saint-Astier

- **Sable fin** (pigmenté)
  - Formule : `surface × 0.015` m³

- **Pigments** naturels (selon teinte)
- **Savon noir liquide** (finition imperméabilisante tadelakt)

#### Accessoires
- **Truelle, taloche, fer, chiffons**

### 🧪 Test
**Input** : « Tadelakt 15 m² »
**Output** : 90 kg chaux + 0,22 m³ sable + pigments + savon noir.

---

## 16.5 Lambris bois

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Lames lambris bois** (pin, sapin — 10 mm épaisseur typique)
  - Formule : `surface × 1.08` m²
  - Pertes : 8%
- **Tasseaux ossature 27×40** (entraxe 50 cm)
  - Formule : `surface × 2.1` ml

#### Accessoires
- **Clous lambris sans tête** (fixation lame sur tasseau)
  - Formule : `surface × 8` u
- **Cornières d'angle / finitions**

#### Finitions
- **Vernis ou cire** (traitement bois)

### 🧪 Test
**Input** : « Lambris pin 12 m² »
**Output** : 13 m² lambris + 26 ml tasseaux + 100 clous + cornières + vernis.

---

## 📋 Synthèse trade #16

| Ouvrage | État | Action |
|---|:-:|---|
| 16.1 Peinture murs | 🟡 | 2 accessoires à ajouter |
| 16.2 Faïence | 🟡 | listel optionnel |
| 16.3 Papier peint | 🔴 | recette (6 matériaux) |
| 16.4 Enduit décoratif | 🔴 | recette (4 matériaux) |
| 16.5 Lambris bois | 🔴 | recette (5 matériaux) |

**Volume à créer/enrichir** : 3 recettes, 4 matériaux sur existants.
**Temps impl.** : ~1 h 30.
