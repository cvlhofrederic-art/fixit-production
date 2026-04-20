# Audit #21 — Électricité CFO (courant fort)

**Trade** : `electricite` (nouveau)
**Référentiel FR principal** : **NF C 15-100** (édition 2015 + amendements A1-A5 jusqu'à 2023)
  - Installations électriques à basse tension — toutes installations logement/tertiaire
  - **AMENDEMENT A5** (2023) : IRVE + pilotage + sécurité incendie
**Autres DTU connexes** :
- **NF DTU 70.1** — Installations électriques dans les bâtiments à usage d'habitation (normes techniques de pose)
- **NF C 14-100** — branchement

**Référentiel PT** : RTIEBT (Regras Técnicas Instalações Elétricas Baixa Tensão, DL 101/2007 + Portaria 949-A/2006) + Eurocode

**Ouvrages couverts** : 6
- 21.1 Tableau électrique (panneau principal)
- 21.2 Câblage courant fort (prises, interrupteurs, lumières)
- 21.3 Mise à la terre (prise de terre + liaison équipotentielle)
- 21.4 Éclairage extérieur
- 21.5 Borne de recharge véhicule électrique (IRVE)
- 21.6 Parafoudre + protection

---

## 21.1 Ouvrage : Tableau électrique

### 📚 Référence
- **NF C 15-100** §771 (logement : dimensionnement GTL, équipements mini)
- **Amendement A5 2023** : protection départs, différentiels
- **UTE C 15-712-1** (installations photovoltaïques reliées au réseau)

### État actuel : 🔴 ABSENT

### Structure cible (appartement T3/T4 standard)

#### Strate 1 — Préparation
- **GTL (Gaine Technique Logement)** `obligatoire` NF C 15-100 §771.558
  - Dimensions mini : 600 × 2300 mm (1,5 m de profondeur)
  - Formule : `1` u par logement
  - Matériau : panneau à rails DIN ou armoire coffret + carotage si passage technique
  - Ref : NF C 15-100 §11.1

#### Strate 2 — Principal
- **Tableau (coffret électrique)** — Hager Volta, Schneider Resi9, Legrand Drivia
  - Formule : `1` u — 2 à 4 rangées selon nb circuits
  - Capacité : 2 × 13 modules (appart T2-T3) à 4 × 13 modules (T5+)
  - Ref : NF EN 61439-3
  - Conditionnement : coffret unique

#### Strate 3 — Accessoires (obligatoire)
- **Disjoncteur différentiel 30 mA 40 A type AC** (circuits prises 16A et lumière)
  - Formule : `2` u (1 pour lumière + prises 16A, 1 secondaire)
  - Ref : NF C 15-100 §411.3.2.5

- **Disjoncteur différentiel 30 mA 40 A type A** (circuits spécialisés — lave-linge, IRVE, PAC)
  - Formule : `1` u (obligatoire si IRVE ou lave-linge)
  - Ref : NF C 15-100 §531.2.1.4 (depuis A5)

- **Disjoncteurs magnéto-thermiques** (1 par circuit)
  - Circuits d'éclairage 10 A : ≈ 3-4 u (1 par pièce ou par 8 points lumineux max)
  - Circuits prises 16 A : 5-6 u (max 8 prises/circuit — NF C 15-100 §771.314)
  - Circuits spécialisés 20 A : 4 u (cuisine : four, plaque, lave-vaisselle, lave-linge)
  - Circuit chauffage : 1 par pièce (si convecteurs) ou 1 PAC
  - Circuit sèche-linge, VMC : +2 u
  - **Total typique T3** : ≈ 16-20 disjoncteurs

- **Peigne de raccordement** (barrette d'alimentation des disjoncteurs)
  - Formule : `nb_rangees` u
  - Fabricant : Hager, Schneider, Legrand

- **Bornier de terre**
- **Bornier de neutre** (séparé en TT)
- **Interrupteurs sectionneurs**

#### Strate 4 — Finitions
- **Schéma électrique imprimé** (collé à l'intérieur du coffret) — NF C 15-100 §514.5
- **Étiquetage circuits** — auto-adhésif

### 🔧 Correctif : recette `elec-tableau-principal`

### 🧪 Test
**Input** : « Tableau électrique appartement T3 standard »

**Output attendu** :
| Phase | Matériau | Qté |
|---|---|---|
| prep | GTL 250×60 | 1 u |
| principal | Coffret 3 rangées 13 mod | 1 u |
| accessoires | Disjoncteur diff 30 mA type AC | 2 u |
| accessoires | Disjoncteur diff 30 mA type A | 1 u |
| accessoires | Disjoncteurs magnéto-thermiques | 18 u |
| accessoires | Peigne raccordement | 3 u |
| accessoires | Bornier terre + neutre | 2 u |
| finitions | Étiquetage circuits | 1 planche |

---

## 21.2 Ouvrage : Câblage courant fort (prises, interrupteurs, lumières)

### 📚 Référence
- **NF C 15-100** §771 — équipements mini par pièce
- **NF C 15-100 §531.2** — sections conducteurs
- **NF C 15-100 §558** — appareillages

### État actuel : 🔴 ABSENT

### Structure cible (par circuit)

#### Strate 1 — Préparation
- **Traçage + saignées** (main d'œuvre — pas matériau)

#### Strate 2 — Principal
- **Gaine ICTA Ø20** (circuits éclairage + prises 16A)
  - Formule : `longueur_circuit × 1.1` ml
  - Pertes : 10%
  - Fabricant : Iboco, Ledvance
  - Conditionnement : couronne 25 ml ou 100 ml

- **Fil H07V-U 1,5 mm²** (circuits éclairage — 3 couleurs : phase + neutre + terre)
  - Formule : `longueur × 3` ml
  - Pertes : 10%
  - Conditionnement : bobine 100 m

- **Fil H07V-U 2,5 mm²** (circuits prises 16A — idem 3 couleurs)
  - Formule : `longueur × 3` ml
  - Pertes : 10%

- **Fil H07V-U 6 mm²** (circuits 32A — four, plaque, lave-linge séchant, IRVE)
  - Formule : `longueur × 3` ml
  - Pertes : 10%

- **Boîtes d'encastrement** (DCL éclairage + prises 16A)
  - **Boîte DCL** (appareillage éclairage) — 1 par point lumineux
    - Min. NF C 15-100 : 1/pièce + 1/7 m² (max)
  - **Boîte prise 16A** — min. 3/pièce principale, 6/séjour, 1/couloir, etc. — cf. §771.314
  - Fabricant : Legrand Mosaic 65 mm, Schneider Odace 65 mm
  - Pertes : 5%

- **Prises de courant 16A 2P+T** — Legrand, Schneider, Niko
  - Formule : selon comptage par pièce
  - Conditionnement : unité (avec plaque + mécanisme)

- **Interrupteurs simple/va-et-vient** — Legrand Céliane, Schneider Odace
  - Formule : selon nb points lumineux
  - 1 simple minimum par pièce

#### Strate 3 — Accessoires
- **Boîte de dérivation** (dans gaine technique ou murale) — 1 par zone
- **Dominos** (connexion 3 sorties) — aujourd'hui remplacés par **bornes à levier** (Wago)
  - Fabricant : Wago 221
  - Conditionnement : boîte 100 u

- **Colliers attache** — fixation ICTA dans gaines
- **Chevilles Molly** (fixation appareillages sur BA13)

### 🔧 Correctif : recette `elec-cablage-cfo` (par m² de logement ou par nb circuits)

### 🧪 Test
**Input** : « Câblage électrique maison 100 m² — 16 circuits »

**Output approximatif** :
| Matériau | Qté |
|---|---|
| Gaine ICTA Ø20 | 450 ml |
| Fil H07V-U 1,5 mm² | 600 ml |
| Fil H07V-U 2,5 mm² | 800 ml |
| Fil H07V-U 6 mm² | 60 ml |
| Boîtes DCL éclairage | 15 u |
| Boîtes prises 16A | 30 u |
| Prises 16A complètes | 30 u |
| Interrupteurs | 15 u |
| Bornes Wago 221 | 1 boîte |

---

## 21.3 Ouvrage : Mise à la terre

### 📚 Référence
- **NF C 15-100 §542** — prise de terre
- **NF C 15-100 §541** — liaisons équipotentielles principales + supplémentaires

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 2 — Principal
- **Piquet de terre** 1,50 m acier galvanisé ou cuivre (NF C 15-100 §542.2.1)
  - Formule : `1` u minimum
  - Objectif : Ra < 100 Ω (si disjoncteur diff 30 mA)
  - Fabricant : Nvent / Erico

- **Câble cuivre nu 25 mm²** (liaison piquet → répartiteur)
  - Formule : estimation 15 ml

- **Câble cuivre H07V-K 6 mm²** (liaison équipotentielle principale vers tuyauterie eau + gaz)
  - Formule : estimation 10 ml

#### Strate 3 — Accessoires
- **Barrette de coupure mise à la terre** (NF C 15-100 §542.4.2) `obligatoire`
  - Formule : `1` u

- **Cosses sertissage** (liaison vers tuyauterie)
  - Formule : `nb_liaisons × 2` u (≈ 6-10)

- **Collier de liaison équipotentielle** (serrage sur tuyau)
  - Formule : `nb_tuyaux × 1` u (liaison eau + gaz + chauffage)

#### Strate 4 — Finitions
- **Schéma de mise à la terre** consigné + test résistance

### 🔧 Correctif : recette `elec-mise-terre`

### 🧪 Test
**Input** : « MALT maison individuelle »
**Output** : 1 piquet + 15 ml cuivre nu 25 mm² + 10 ml H07V-K 6 mm² + barrette + cosses + colliers équipotentiels.

---

## 21.4 Ouvrage : Éclairage extérieur

### 📚 Référence
- **NF C 15-100 §559** — appareillage et luminaires éclairage extérieur (IP min 44)

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Luminaire extérieur** (applique murale, borne, spot enterré) — IP 44 min
- **Câble U-1000 R2V 3G1,5** (extérieur enterré min 60 cm sous grillage avertisseur rouge)
  - Formule : `longueur_reseau × 1.1` ml
  - Ref : NF C 15-100 §528

#### Accessoires
- **Grillage avertisseur rouge** (sur câble enterré — obligatoire)
  - Formule : `longueur × 1` ml
- **Gaine TPC rouge Ø40** (protection câble)
- **Boîtes de dérivation étanches IP 65**
- **Détecteurs de mouvement** (optionnel)

### 🧪 Test
**Input** : « 4 appliques extérieures murales »
**Output** : 4 appliques IP44 + câble + gaines + grillage + 2 boîtes étanches.

---

## 21.5 Ouvrage : Borne de recharge véhicule électrique (IRVE)

### 📚 Référence
- **NF C 15-100 Amendement A5** (2023) — nouveautés IRVE
- **NF C 15-722** (spécifique IRVE)
- **Décret Lom** (Loi d'orientation des mobilités) : pré-équipement obligatoire logements neufs

### État actuel : 🔴 ABSENT

### Structure cible (borne murale 7 kW — Wallbox, Schneider EV-Link, Legrand)

#### Principal
- **Wallbox** 7 kW mode 3 type 2 (Schneider EV-Link, Legrand, Wallbox Pulsar)
- **Protection dédiée dans tableau** :
  - Disjoncteur différentiel 30 mA type A (obligatoire IRVE)
  - Disjoncteur magnéto-thermique 32 A (selon puissance wallbox)
- **Câble U-1000 R2V 3G6** (entre tableau et borne — section selon longueur + puissance)
  - Formule : `distance_tableau_borne × 1.1` ml
- **Gaine TPC Ø40** (si passage enterré)

#### Accessoires
- **Socle de fixation mural** (inclus borne)
- **Câble de charge type 2** (si borne sans câble intégré) — fourni par conducteur souvent
- **Étiquetage obligatoire** (risque électrique)

### 🧪 Test
**Input** : « Borne IRVE 7 kW à 15 m du tableau »
**Output** : 1 wallbox + disjoncteur diff type A + magnéto 32A + 16,5 ml câble 3G6 + gaine TPC + fixations.

---

## 21.6 Ouvrage : Parafoudre + protection

### 📚 Référence
- **NF C 15-100 §534** — protection contre les surtensions
- **Amendement A5 2023** : parafoudre **obligatoire** pour certaines zones à densité de foudroiement NG > 2,5

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Parafoudre Type 2** (logement individuel) ou **Type 1+2** (si paratonnerre)
  - Fabricant : Hager SPD, Schneider iQuick PRD, Legrand
  - Conditionnement : 2 modules DIN dans tableau

- **Disjoncteur amont parafoudre** (protection du parafoudre — obligatoire NF C 15-100 §534)
  - Disjoncteur magnéto-thermique 25 A min

#### Accessoires
- **Câble de liaison à la terre du parafoudre** (10 mm² min)

### 🧪 Test
**Input** : « Parafoudre zone AQ2 »
**Output** : 1 parafoudre Type 2 + 1 disjoncteur 25A amont + câble liaison terre.

---

## 📋 Synthèse trade #21

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 21.1 Tableau électrique | 🔴 | recette complète (9 matériaux, variable selon T1-T5) |
| 21.2 Câblage CFO | 🔴 | recette complète (~12 matériaux) |
| 21.3 Mise à la terre | 🔴 | recette complète (6 matériaux) |
| 21.4 Éclairage extérieur | 🔴 | recette complète (7 matériaux) |
| 21.5 Borne IRVE | 🔴 | recette complète (6 matériaux) |
| 21.6 Parafoudre | 🔴 | recette simple (3 matériaux) |

**Volume à créer** : 6 recettes, ~45 matériaux.
**Temps implémentation** : ~3 h 30.

---

## ⚠️ Spécificités électricité

- **Norme en vigueur** : NF C 15-100 amendement A5 (2023) — inclure IRVE, parafoudre obligatoire selon zone
- **Consuel obligatoire** (pas un matériau — étape administrative)
- **Respect minimums NF C 15-100 §771** pour appartement T3/T4 :
  - Éclairage : 1 point lumineux minimum par pièce
  - Cuisine : 6 prises 16A + 1 × 32A plaque + 1 spécialisée four + 1 LV + 1 hotte
  - Salle de bain : volumes 0/1/2/hors-volumes avec IP correspondant

---

## ✅ Statut audit #21

- [x] NF C 15-100 rev. 2015 + A5 2023 vérifiés
- [x] 6 ouvrages structurés
- [x] Amendement A5 IRVE intégré
- [ ] Implémentation : attente P3

**Fin de la Vague 1 — les 8 trades critiques sont audités.**
