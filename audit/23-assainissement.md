# Audit #23 — Assainissement

**Trade** : `assainissement` (nouveau)
**Référentiels FR** :
- **NF DTU 64.1** — Assainissement non collectif (rev. 2013 + A1 2020)
- **NF EN 12566** — Petites installations de traitement eaux usées
- **Arrêté 7 septembre 2009** — prescriptions techniques installations ANC
- **DTU 60.33** — Canalisations enterrées

**Ouvrages couverts** : 4
- 23.1 Fosse toutes eaux + épandage
- 23.2 Microstation
- 23.3 Filtre compact
- 23.4 Raccordement réseau collectif

---

## 23.1 Fosse toutes eaux + épandage

### 📚 Référence
- **NF DTU 64.1** — §5 (dimensionnement), §6 (pose)

### État actuel : 🔴 ABSENT

### Structure cible (maison T4 = 5 EH, fosse 5 000 L)

#### Principal
- **Fosse toutes eaux 5 000 L béton ou PE** (selon nb EH)
  - Fabricant : Sotralentz, Grafvidane, Simop
  - Ref : NF DTU 64.1 §5

- **Tranchée d'épandage** (épandage drainant 90 m linéaire mini pour 5 EH)
  - **Drain PVC Ø100 perforé** : `longueur × 1.05` ml
  - **Gravier calibré 10/30 ou 20/40** : `longueur × 0.9` m³ (30 cm H × 60 cm L × longueur)
  - **Géotextile** : `longueur × 2` m² (enveloppement tranchée)
  - **Film polyéthylène PE** (surface drainante) ou feutre anti-colmatage

#### Accessoires
- **Regard de répartition** (avant épandage)
- **Regard de bouclage** (après épandage)
- **Ventilation primaire + secondaire** (aération fosse)
  - Chapeau ventilation Ø100 en toiture
- **Bac dégraisseur** `optionnel_selon_contexte`
  - Condition : « Si cuisine > 5 m du fosse OU rejet graisses important »

### 🔧 Correctif : recette `anc-fosse-epandage`

### 🧪 Test
**Input** : « ANC maison T4 : fosse 5 000 L + épandage 90 ml »
**Output** : 1 fosse + 94,5 ml drain + 81 m³ gravier + 180 m² géotextile + 2 regards + ventilation.

---

## 23.2 Microstation

### 📚 Référence
- **NF DTU 64.1** §4.2 (agréments ministériels — liste officielle)
- **NF EN 12566-3**

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Microstation agréée** (2,5 à 20 EH — cloche Graf, Tricel Novo, BionetSimop)
  - Fabricant : agréé Ministère (liste publiée)
- **Raccordement électrique** (230 V, disjoncteur diff 30 mA dédié)

#### Accessoires
- **Rehausse** (si nappe haute)
- **Extracteur d'air** intégré
- **Raccordement évacuation** (vers milieu superficiel ou infiltration)

### 🧪 Test
**Input** : « Microstation 5 EH »
**Output** : 1 microstation + raccordement électrique + évacuation.

---

## 23.3 Filtre compact

### État actuel : 🔴 ABSENT

### Structure cible (alternative épandage quand terrain défavorable)
- Module filtre à sable ou filtre coco (agréé)
- Préfiltre
- Massif filtrant sable calibré

### 🧪 Test
**Input** : « Filtre compact 5 EH »
**Output** : 1 filtre agréé + préfiltre + massif sable.

---

## 23.4 Raccordement réseau collectif

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Tube PVC Ø125 ou 160** (selon trafic)
  - Formule : `longueur_collecteur × 1.05` ml
- **Coudes, tés, manchons**
- **Regard de branchement** (sur domaine public, fin du privé)
  - Formule : `1` u

#### Accessoires
- Colle PVC, colliers, lit sable, grillage, remblai

### 🧪 Test
**Input** : « Raccordement collectif 20 ml »
**Output** : 21 ml PVC Ø160 + raccords + 1 regard + sable lit + grillage.

---

## 📋 Synthèse trade #23

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 23.1 Fosse + épandage | 🔴 | recette (8 matériaux) |
| 23.2 Microstation | 🔴 | recette (3 matériaux) |
| 23.3 Filtre compact | 🔴 | recette (3 matériaux) |
| 23.4 Raccord collectif | 🔴 | recette (5 matériaux) |

**Volume** : 4 recettes, ~19 matériaux.
**Temps impl.** : ~1 h 30.
