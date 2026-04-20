# Audit #26 — Terrasses extérieures

**Trade** : `terrasse_ext` (nouveau)
**Référentiels FR** :
- **NF DTU 51.4** — Platelages bois extérieurs (rev. 2018)
- **NF DTU 52.2** — Carrelage extérieur collé (cf. #15.1)
- **NF DTU 43.1** — Si terrasse-toiture (cf. #09.2)

**Ouvrages couverts** : 3
- 26.1 Terrasse bois sur lambourdes
- 26.2 Terrasse composite
- 26.3 Terrasse carrelage extérieur / pierre

---

## 26.1 Terrasse bois

### 📚 Référence
- **NF DTU 51.4** — Platelages extérieurs bois

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 1 — Préparation
- **Plots réglables PVC** (ou semelles béton si pose scellée)
  - Formule : `surface × 4` u (4 plots/m² moyen)
  - Pertes : 5%
  - Fabricant : Jouplast, Alphaplot

#### Strate 2 — Principal
- **Lambourdes bois exotique ou pin traité classe 4** (45×70)
  - Formule : `surface × 3` ml (entraxe 40 cm)
  - Pertes : 10%

- **Lames terrasse bois** (ipé, douglas, pin classe 4)
  - Formule : `surface × 1.1` m²
  - Pertes : 10%

#### Strate 3 — Accessoires
- **Vis inox A2 ou A4** (bord de mer) — 1 vis × 2 par ml lame
  - Formule : `surface × 25` u

- **Profils de finition alu** (départ / arrêt)
  - Formule : `perimetre × 1` ml

- **Cales espacement** (ou système clips invisibles)

### 🧪 Test
**Input** : « Terrasse bois ipé 30 m² »
**Output** : 120 plots + 90 ml lambourdes + 33 m² lames + 750 vis inox + profils.

---

## 26.2 Terrasse composite

### État actuel : 🔴 ABSENT

### Structure cible (identique 26.1 sauf lames)
- Lames composite (WPC) — Silvadec, Fiberon
- Fixations clips invisibles (souvent fournies avec lames)
- Pas de traitement (durée vie 25+ ans)

### 🧪 Test
**Input** : « Terrasse composite 25 m² »
**Output** : lames + lambourdes alu + plots + clips.

---

## 26.3 Terrasse carrelage extérieur

Cf. #15.1 pour carrelage + spécificités ext :
- Colle C2S2 (flexible extérieur) — obligatoire
- Joints plus larges (5-8 mm) anti-dilatation
- Plots rédables si dallage sur plots (drainage)
- Classement **R11 anti-dérapant** (obligatoire ext.)

### 🧪 Test
**Input** : « Carrelage terrasse 20 m² grès R11 »
**Output** : ~ idem #15.1 avec colle C2S2 + joints 5 mm + classement R11.

---

## 📋 Synthèse trade #26

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 26.1 Terrasse bois | 🔴 | recette (6 matériaux) |
| 26.2 Terrasse composite | 🔴 | recette (5 matériaux) |
| 26.3 Carrelage ext. | 🟡 | adaptation #15.1 |

**Volume** : 2-3 recettes.
**Temps impl.** : ~1 h 30.
