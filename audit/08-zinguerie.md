# Audit #08 — Zinguerie

**Trade** : `couverture` (sous-domaine zinguerie)
**Référentiels FR** :
- **NF DTU 40.5** — Évacuation des eaux pluviales
- **NF DTU 60.11** — Règles de calcul (dimensionnement descentes EP)
- **NF DTU 40.41** — Zinc joint debout (compléments)

**Ouvrages couverts** : 4
- 8.1 Gouttières (zinc, alu, PVC, acier prélaqué)
- 8.2 Descentes eaux pluviales
- 8.3 Noues (en zinc, alu, plomb)
- 8.4 Habillages (solins, couronnement)

---

## 8.1 Gouttières

### 📚 Référence
- **NF DTU 40.5** — §5 (dimensionnement), §6 (mise en œuvre)

### État actuel : 🔴 ABSENT

### Structure cible (gouttière demi-ronde zinc 25)

#### Principal
- **Gouttière zinc** (sur mesure ou éléments 4 ml)
  - Formule : `longueur_facade × 1.05` ml
  - Pertes : 5%
  - Ref : NF DTU 40.5 § 6.4
  - Fabricant : VMZinc, RheinZink, Umicore
  - Conditionnement : élément 4 ml ou bobine 30 kg

- **Naissance** (raccord gouttière → descente EP)
  - Formule : `nb_descentes × 1` u
  - Pertes : 10%

#### Accessoires
- **Crochets de gouttière** (tous les 60 cm — NF DTU 40.5 §6.5)
  - Formule : `longueur × 1.7` u (1,67 u/ml arrondi)
  - Pertes : 10%
  - Types : crochet à bande (fixation volige) / crochet à plat (fixation chevron)

- **Jonction gouttière** (manchons, soudures étain)
  - Formule : `longueur / 4` u (1 jonction tous 4 ml)

- **Tampon obturateur** (extrémités)
  - Formule : `2` u (2 bouts)

- **Étain de soudure** (assemblages)
  - Formule : `longueur × 0.03` kg
  - Conditionnement : bobine 500 g

### 🧪 Test
**Input** : « Gouttière zinc demi-ronde 30 ml + 2 descentes »
**Output** : 31,5 ml gouttière + 2 naissances + 51 crochets + 8 jonctions + 2 tampons + étain.

---

## 8.2 Descentes eaux pluviales

### 📚 Référence
- **NF DTU 40.5** — §7 dimensionnement (Ø80 / Ø100 selon m² toiture drainée)
- **NF DTU 60.11** — Règles calcul section : Ø80 pour < 50 m², Ø100 pour > 50 m²

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Tube descente zinc Ø80 ou Ø100** (ou PVC, alu)
  - Formule : `hauteur_batiment × 1.1` ml
  - Pertes : 10%
  - Conditionnement : élément 2 ml

- **Coudes** (raccord naissance → tube, ou changement de direction)
  - Formule : `2-3 × nb_descentes` u

- **Dauphin fonte** (protection partie basse, 50 cm)
  - Formule : `nb_descentes × 1` u
  - Ref : NF DTU 40.5 (obligatoire pour protection anti-chocs)

#### Accessoires
- **Colliers de fixation** (tous les 1,5 m verticaux)
  - Formule : `hauteur × 0.67` u

- **Raccord de cuvette** (si évacuation dans regard)
  - Formule : `nb_descentes × 1` u

### 🧪 Test
**Input** : « 2 descentes EP Ø100 hauteur 6 m »
**Output** : 13,2 ml tube + 4-6 coudes + 2 dauphins + 8 colliers + 2 raccords cuvette.

---

## 8.3 Noues

### 📚 Référence
- **NF DTU 40.21** §6.7 (noues tuiles)
- **NF DTU 40.41** §7 (noues zinc)

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Bande zinc pré-formée en V** (zinc 0,65 mm épaisseur mini)
  - Formule : `longueur_noue × 1` ml
  - Pertes : 10%
  - Conditionnement : élément 2 ml

#### Accessoires
- **Pattes fixes + coulissantes**
- **Soudure étain**
- **Bande porte-solin** (raccord mur si noue contre mur)

### 🧪 Test
**Input** : « Noue zinc 5 ml »
**Output** : 5,5 ml bande noue + pattes + soudure.

---

## 8.4 Habillages (solins, couronnement)

### 📚 Référence
- **NF DTU 40.5** + **NF DTU 40.41**

### État actuel : 🔴 ABSENT

### Structure cible (ensemble compléments zinguerie)

- **Solins zinc** (raccordement tuiles → cheminée / mur)
  - Formule : `perimetre_raccord × 1` ml

- **Couronnement acrotère** (zinc plié, toiture-terrasse)
  - Formule : `perimetre_toiture × 1` ml

- **Chapeau cheminée**
  - Formule : `1` u par cheminée

- **Bandes d'étanchéité EPDM** (complément)

### 🧪 Test
**Input** : « Solin cheminée 4 ml + chapeau »
**Output** : 4,4 ml solin + 1 chapeau + accessoires.

---

## 📋 Synthèse trade #08

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 8.1 Gouttières | 🔴 | recette (6 matériaux) |
| 8.2 Descentes EP | 🔴 | recette (5 matériaux) |
| 8.3 Noues | 🔴 | recette (4 matériaux) |
| 8.4 Habillages | 🔴 | recette (5 matériaux) |

**Volume à créer** : 4 recettes, ~20 matériaux.
**Temps impl.** : ~1 h 30.
