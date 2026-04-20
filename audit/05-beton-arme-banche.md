# Audit #05 — Béton armé / Béton banché

**Trade** : `maconnerie` (sous-domaine BA/banché)
**Référentiels FR** :
- **NF DTU 23.1** — Murs en béton banché (mai 1993, en vigueur)
- **NF DTU 21** — Exécution des ouvrages en béton
- **NF DTU 21.4** — Utilisation du béton auto-plaçant
- **NF DTU 22.1** — Dalles et murs en béton préfabriqué
- **NF EN 206** — Spécification béton
- **Eurocode 2** (NF EN 1992-1-1)
- **NF EN 13670** — Exécution structures béton

**Référentiel PT** : NP EN 13670 + NP EN 1992 + DL 90/2021

**Ouvrages couverts** : 7
- 5.1 Voile béton banché (mur porteur intérieur/extérieur)
- 5.2 Poteau béton armé
- 5.3 Poutre béton armé
- 5.4 Plancher dalle pleine
- 5.5 Plancher poutrelles-hourdis
- 5.6 Prédalle
- 5.7 Escalier béton coulé en place

---

## 5.1 Voile béton banché

### 📚 Référence
- **NF DTU 23.1** — §6 (coffrage), §7 (armatures), §8 (bétonnage), §9 (décoffrage)

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation (obligatoire)
- **Coffrage modulaire ou banches** (bois contreplaqué CTBX 18 mm OU panneaux métalliques)
  - Formule : `surface × 2` m² (2 faces à coffrer)
  - Pertes : 15% (réutilisable, mais chutes + usure)
  - Ref : NF DTU 23.1 §6
  - *Note : le coffrage est en grande partie du matériel loué — on compte seulement consommables*
- **Huile de décoffrage** `obligatoire` NF DTU 23.1 §6.4
  - Formule : `surface × 0.15` L (1,5 L / 10 m²)
  - Pertes : 10%
  - Fabricant : Sika Separol, Chryso Decofrage
  - Conditionnement : bidon 25 L

#### Strate 2 — Principal
- **Béton C25/30** (dosage 350 kg/m³)
  - Ciment CEM II 32,5 R — `volume × 350` kg
  - Sable 0/4 — `volume × 0.5` m³
  - Gravier 4/20 — `volume × 0.7` m³
  - Eau — `volume × 175` L
  - Pertes : 5%

- **Armatures verticales HA12** (tous les 25 cm, section mini)
  - Formule : `hauteur × 4` kg/m² (section 15 cm épaisseur typique)
  - Pertes : 10%
  - Ref : NF DTU 23.1 §7

- **Armatures horizontales HA10** (tous les 30 cm)
  - Formule : `surface × 2.5` kg

- **Armatures de chaînage d'angle** (4 HA14 × 2 angles)
  - Formule : `hauteur × nb_angles × 0.62 × 4` kg

#### Strate 3 — Accessoires (obligatoire)
- **Entretoises banches / tiges d'écartement** (tire-banches)
  - Formule : `surface × 4` u
  - Pertes : 15%

- **Cales d'enrobage 30 mm**
  - Formule : `surface × 8` u (4 par face)

- **Bouchon de tige / chapeau d'étanchéité**
  - Formule : idem `surface × 4` u

- **Ligatures fil recuit**
  - Formule : `surface × 0.3` kg

#### Strate 4 — Finitions
- **Ragréage ponctuel** (nid de cailloux, bulles) — mortier de reprise
  - Formule : `surface × 0.5` kg (estimation 5% surface à reprendre)
  - Conditionnement : sac 25 kg

- **Cure béton** (protection contre dessiccation)
  - Formule : `surface × 0.15` L

### 🔧 Correctif : recette `voile-beton-banche`

### 🧪 Test
**Input** : « Voile béton banché 8 × 2,70 m, ép. 20 cm »
**Output** : 4,32 m³ béton + 1,5 t ciment + 172 kg armatures + décoffrant + accessoires.

---

## 5.2 Poteau béton armé

### 📚 Référence
- **NF DTU 21** §5 + **Eurocode 2** §5.8 (poteaux)

### État actuel : 🔴 ABSENT

### Structure cible (poteau 25×25 cm type habitation)

#### Principal
- Béton C25/30 : `hauteur × 0.0625` m³
- 4 aciers longitudinaux HA12 : `hauteur × 4 × 0.888` kg = `hauteur × 3.55` kg
- Cadres HA6 tous 20 cm : `hauteur × 5 × 0.222` kg = `hauteur × 1.11` kg
- Coffrage : `hauteur × 1` m² (4 faces × 0,25 m = 1 ml / ml poteau)
- Décoffrant, ligatures, cales

### 🧪 Test
**Input** : « 4 poteaux BA 25×25 × 2,70 m »
**Output** : 0,68 m³ béton + 38 kg HA12 + 12 kg HA6 + coffrage + accessoires.

---

## 5.3 Poutre béton armé

### 📚 Référence
- **NF DTU 21** + **Eurocode 2** §9.2 (poutres)

### État actuel : 🔴 ABSENT

### Structure cible (poutre 25×40 cm)

#### Principal
- Béton C25/30 : `longueur × 0.1` m³
- 4 HA14 longitudinaux : `longueur × 4 × 1.21` kg
- Cadres HA8 tous 15 cm : `longueur × 6.67 × 0.395` kg
- Coffrage : `longueur × 1.3` m² (fond + 2 flancs)
- Étais (temporaires, matériel)

### 🧪 Test
**Input** : « Poutre BA 25×40 × 5 ml »
**Output** : 0,5 m³ béton + 24 kg HA14 + 13 kg HA8 + coffrage + accessoires.

---

## 5.4 Plancher dalle pleine coulée

### 📚 Référence
- **NF DTU 21** + **NF DTU 13.3** (si plancher = dalle sur terre-plein)
- Épaisseur standard 20 cm habitation

### État actuel : 🔴 ABSENT

### Structure cible (par m² de plancher)

#### Principal
- Béton C25/30 : `surface × epaisseur` m³
- **Double nappe** armatures (haut + bas) HA12 maille 15×15 : `surface × 4` kg (2 × 2 kg/m²)
- Coffrage plafond (étaiements + planchers) : `surface × 1` m²
- Cales enrobage : `surface × 8` u (4 haut + 4 bas)

#### Accessoires
- Chaises d'armatures (support nappe supérieure) : `surface × 2` u
- Décoffrant, ligatures

### 🧪 Test
**Input** : « Plancher dalle pleine 10×8 m ép. 20 cm »
**Output** : 16 m³ béton + 320 kg HA12 + 80 m² coffrage + accessoires.

---

## 5.5 Plancher poutrelles-hourdis

### 📚 Référence
- **NF DTU 23.2** (prédalles + planchers béton) + **NF DTU 22.1**

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Poutrelles précontraintes** (KP1 / Rector) : `surface / 0.6` ml (entraxe 60 cm)
  - Ratio : `1.67` ml/m²
- **Hourdis polystyrène ou béton** : `surface / 0.33` u (format 60×20×20 cm)
  - Pour 0.6 m entraxe × 0.5 m longueur hourdis = 3,3 hourdis/m²
- **Treillis soudé ST10C** (nappe supérieure) : `surface × 1.05` m²
- **Béton de compression 5 cm** : `surface × 0.05` m³
- **Chaînage périphérique** (4 HA10 + cadres HA6)

### 🧪 Test
**Input** : « Plancher poutrelles-hourdis 60 m² »
**Output** : 100 ml poutrelles + 200 hourdis + 63 m² treillis + 3 m³ béton compression + chaînage.

---

## 5.6 Prédalle

### 📚 Référence
- **NF DTU 23.2** Partie 1 (prédalles)

### État actuel : 🔴 ABSENT

### Structure cible
- Prédalle préfabriquée (4-5 cm épaisseur, largeur 2,40 m) : `surface × 1.02` m²
- Béton complémentaire de 15 cm : `surface × 0.15` m³
- Armatures complémentaires (treillis + chapeaux) : `surface × 2` kg
- Étais temporaires (matériel)

### 🧪 Test
**Input** : « Prédalle 40 m² »
**Output** : 40,8 m² prédalles + 6 m³ béton + 80 kg acier.

---

## 5.7 Escalier béton coulé en place

### 📚 Référence
- **NF DTU 21** + **Eurocode 2**

### État actuel : 🔴 ABSENT

### Structure cible (escalier 2,70 m hauteur / 14 marches)

#### Principal
- Volume béton : `hauteur × emprise × 0.15` m³ ≈ 0,5-0,7 m³ pour escalier standard
- Armatures paillasse : 25 kg
- Armatures marches : 10 kg
- Coffrage (contreplaqué découpé + tasseaux) : 15 m² typique

### 🧪 Test
**Input** : « 1 escalier béton droit 2,70 m hauteur, 1 m largeur »
**Output** : 0,6 m³ béton + 35 kg armatures + coffrage + accessoires.

---

## 📋 Synthèse trade #05

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 5.1 Voile béton banché | 🔴 | recette complète (12 matériaux) |
| 5.2 Poteau BA | 🔴 | recette complète (7 matériaux) |
| 5.3 Poutre BA | 🔴 | recette complète (7 matériaux) |
| 5.4 Plancher dalle pleine | 🔴 | recette complète (8 matériaux) |
| 5.5 Plancher poutrelles | 🔴 | recette complète (9 matériaux) |
| 5.6 Prédalle | 🔴 | recette complète (5 matériaux) |
| 5.7 Escalier BA | 🔴 | recette complète (6 matériaux) |

**Volume à créer** : 7 recettes, ~55 matériaux.
**Temps impl.** : ~3 h.

**Sources** :
- [NF DTU 23.1 — Bâtirama](https://www.batirama.com/article/12054-dtu-23.1-murs-en-beton-banche.html)
- [NF DTU 23.1 — CSTB](https://boutique.cstb.fr/Detail/Documents-Techniques-Unifies/DTU-NF-DTU/23-Ouvrages-en-beton/DTU-23-1-Murs-en-beton-banche)
