# Audit #25 — Clôtures & portails

**Trade** : `cloture` (nouveau)
**Référentiels FR** :
- **NF DTU 18.1** (clôtures grillagées) — si existe
- **NF EN 13241** — portes et portails (cf. #12)
- **RNU** + PLU local (hauteur max)

**Ouvrages couverts** : 4
- 25.1 Grillage souple / rigide
- 25.2 Panneaux rigides bois / composite
- 25.3 Mur bahut maçonné
- 25.4 Portail (cf. #12.7)

---

## 25.1 Grillage

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Grillage souple simple torsion** OU **rigide (panneaux rigides soudés)**
  - Formule : `longueur × 1.05` ml
  - Pertes : 5%
  - Fabricant : Dirickx, Betafence

- **Poteaux acier galvanisé** (tous les 2-3 m)
  - Formule : `longueur / 2.5` u (entraxe 2,5 m)
  - Pertes : 10%

- **Bavolet haut** (finition grillage souple — tendeur)
  - Formule : `longueur × 1` ml

#### Accessoires
- **Béton de scellement poteaux**
  - Formule : `nb_poteaux × 0.03` m³ (massif 30×30×30 cm)
- **Jambes de force** (aux angles)
- **Fil de tension** (grillage souple)

### 🧪 Test
**Input** : « Grillage rigide 30 ml, hauteur 1,50 m »
**Output** : 30 m² panneaux + 13 poteaux + 0,4 m³ béton.

---

## 25.2 Panneaux rigides bois / composite

### Structure cible
- Panneaux pré-fabriqués (1,80 m typique)
- Poteaux bois ou alu
- Quincaillerie bois
- Traitement classe 4 (bois contact sol)

### 🧪 Test
**Input** : « Clôture bois 25 ml »
**Output** : ~14 panneaux + poteaux + quincaillerie.

---

## 25.3 Mur bahut maçonné

### Structure cible
Cf. #02.1 (semelle filante) + #04.1 (mur parpaing) + #04.6 (enduit).

- Semelle filante (fondation)
- Mur parpaing 20 cm
- Chapeau / couvre-mur béton
- Enduit extérieur

---

## 25.4 Portail
Cf. #12.7.

---

## 📋 Synthèse trade #25

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 25.1 Grillage | 🔴 | recette (6 matériaux) |
| 25.2 Panneaux bois | 🔴 | recette (4 matériaux) |
| 25.3 Mur bahut | 🔴 | compose #02 + #04 |
| 25.4 Portail | cf. #12.7 | |

**Volume** : 2 recettes dédiées + composition.
**Temps impl.** : ~1 h.
