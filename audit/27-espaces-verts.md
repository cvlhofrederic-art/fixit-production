# Audit #27 — Espaces verts

**Trade** : `jardin` (nouveau)
**Référentiels FR** :
- **NF P98-332** — Pelouses
- **NF V12-040** — Terre végétale

**Ouvrages couverts** : 3
- 27.1 Gazon (semé / plaqué)
- 27.2 Plantations
- 27.3 Arrosage automatique

---

## 27.1 Gazon

### État actuel : 🔴 ABSENT

### Structure cible

#### Gazon semé
- **Terre végétale** (10-15 cm enrichie)
  - Formule : `surface × 0.10` m³
  - Conditionnement : big bag 1 m³ ou camion
- **Amendement organique** (compost, fumier)
  - Formule : `surface × 0.02` m³
- **Semences gazon** (mix rustique / ornement)
  - Formule : `surface × 40` g (densité 40 g/m²)
  - Fabricant : Naturasemus, Vilmorin

#### Gazon plaqué (rouleaux)
- **Rouleaux gazon** (1 m² ou 2 m²)
  - Formule : `surface × 1.05` m²
  - Fabricant : GreenProd, plantations locales

#### Accessoires
- **Engrais démarrage** (NPK équilibré)
- **Fil traceur** / cordeau

### 🧪 Test
**Input** : « Gazon semé 100 m² »
**Output** : 10 m³ terre végétale + 2 m³ compost + 4 kg semences.

---

## 27.2 Plantations

### État actuel : 🔴 ABSENT

### Structure cible
- **Plants / arbustes / arbres** (unités variables)
- **Terreau plantation** par trou
- **Engrais de plantation**
- **Tuteur + lien**
- **Paillage** (écorces, chanvre, lin)

### 🧪 Test
**Input** : « 10 arbustes haie + 1 arbre »
**Output** : 11 plants + terreau + tuteurs + engrais + paillage.

---

## 27.3 Arrosage automatique

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Programmateur** (2-8 voies)
- **Électrovannes** (1 par zone)
- **Tuyaux PE Ø25** (réseau principal)
  - Formule : `longueur × 1.05` ml
- **Goutteurs ou arroseurs** (tournants ou escamotables)

#### Accessoires
- Raccords PE
- Tuyère / arroseur
- Filtre entrée réseau
- Réducteur pression (si >4 bar)

### 🧪 Test
**Input** : « Arrosage auto 3 zones gazon + 1 goutte-à-goutte »
**Output** : 1 programmateur + 4 électrovannes + 60 ml PE + 16 arroseurs + filtre.

---

## 📋 Synthèse trade #27

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 27.1 Gazon | 🔴 | recette (5 matériaux) |
| 27.2 Plantations | 🔴 | recette variable |
| 27.3 Arrosage auto | 🔴 | recette (6 matériaux) |

**Volume** : 3 recettes, ~15 matériaux.
**Temps impl.** : ~1 h.
