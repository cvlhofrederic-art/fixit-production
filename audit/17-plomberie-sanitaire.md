# Audit #17 — Plomberie sanitaire

**Trade** : `plomberie` (nouveau)
**Référentiels FR** :
- **NF DTU 60.1** — Plomberie sanitaire pour bâtiments
- **NF DTU 60.5** — Canalisations en cuivre (distribution eau F/C, évacuations, installations gaz)
- **NF DTU 60.11** — Règles de calcul des installations de plomberie sanitaire
- **NF DTU 60.31** — Canalisations PVC-U (alimentation eau froide avec pression)
- **NF DTU 60.32** — Canalisations PVC-U (évacuation EU/EV)
- **NF DTU 60.33** — Canalisations PVC-U (évacuation extérieure)

**Référentiel PT** : NP EN 806 (installations intérieures) + NP EN 12056 (évacuation gravitaire) + Decreto-Lei n.º 23/95

**Ouvrages couverts** : 8
- 17.1 Alimentation eau PER / multicouche
- 17.2 Alimentation eau cuivre
- 17.3 Évacuations PVC (EU + EV)
- 17.4 WC (suspendu ou posé)
- 17.5 Lavabo + vasque
- 17.6 Douche (bac + paroi + receveur)
- 17.7 Baignoire
- 17.8 Chauffe-eau (thermodynamique / électrique / gaz)

---

## 17.1 Ouvrage : Alimentation eau PER / multicouche

### 📚 Référence
- **NF DTU 60.1** §5.1 (choix matériaux)
- **NF DTU 60.11** (dimensionnement sections)
- **NF EN ISO 15875-1** (tubes PER)
- **NF EN 21003-1** (multicouche)

### État actuel : 🔴 ABSENT

### Structure cible (par logement standard T3-T4 ≈ 4 points d'eau)

#### Strate 2 — Principal
- **Tube PER Ø16 bleu (EF)** — alimentation eau froide
  - Formule : `nb_points_eau × 8` ml (estimation 8 ml par point depuis nourrice)
  - Pertes : 10% (coupes + cintrage)
  - Ref : NF DTU 60.1 / NF EN ISO 15875
  - Fabricant : Comap MultiSkin, Uponor, Giacomini
  - Conditionnement : couronne 50 ml ou 100 ml

- **Tube PER Ø16 rouge (ECS)** — alimentation eau chaude
  - Formule identique

- **Gaine ICTA** ou gaine préformée (isolation + passage tubes)
  - Formule : `somme_longueur_tubes × 1` ml
  - Pertes : 5%
  - Conditionnement : couronne 50 ml

- **Nourrice PER** (collecteur pour distribution en étoile)
  - Formule : `1` u (1 nourrice par logement)
  - Fabricant : Comap, Giacomini

#### Strate 3 — Accessoires (obligatoire)
- **Raccords PER à glissement** (coudes, tés)
  - Formule : `nb_points_eau × 4` u (4 raccords/point)
  - Pertes : 10%

- **Robinet d'arrêt général** `obligatoire`
  - Formule : `1` u
  - Fabricant : Comap / Watts

- **Clapet anti-retour** `obligatoire` (après compteur — NF DTU 60.1 §5.4)
  - Formule : `1` u

- **Collier de fixation PER** (tous les 50 cm en horizontal)
  - Formule : `somme_longueur_tubes × 2` u
  - Pertes : 10%

- **Gaines fourreau protection passage mur** — `perimetre_passages × 1` ml

#### Strate 4 — Finitions
- **Test de pression** (pas un matériau — main d'œuvre)
- **Isolant tube ECS** (obligatoire RE2020 sur circuits > 3 m dans volume non chauffé)
  - Formule : `longueur_tube_ecs × 1` ml
  - Ref : RT2012 + RE2020

### 🔧 Correctif : recette `plomberie-alim-per`

### 🧪 Test
**Input** : « Alim PER appartement T3 (4 points eau : cuisine + lavabo + douche + WC) »
**Output** : ~70 ml PER bleu + ~35 ml PER rouge (WC pas ECS) + nourrice + 16 raccords + vannes + colliers + isolant ECS.

---

## 17.2 Ouvrage : Alimentation eau cuivre

### 📚 Référence
- **NF DTU 60.5** — Canalisations cuivre
- **NF EN 1057** — tubes cuivre

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 2 — Principal
- **Tube cuivre Ø14/16/18** (selon débit — NF DTU 60.11)
  - Formule : `longueur_reseau × 1` ml
  - Pertes : 10%
  - Fabricant : KME / Wieland

#### Strate 3 — Accessoires
- **Raccords à sertir ou brasage capillaire**
  - Brasage : étain (Sn 97/Cu3) + décapant
  - Sertissage : raccords inox (Viega Profipress, Comap Press)

- **Colliers cuivre isolés**
- **Vannes** d'arrêt

### 🧪 Test
**Input** : « Alim cuivre salle de bain - 20 ml »
**Output** : 20 ml cuivre Ø16 + raccords + brasage/sertissage + colliers.

---

## 17.3 Ouvrage : Évacuations PVC (EU + EV)

### 📚 Référence
- **NF DTU 60.32** — évacuation PVC intérieure
- **NF DTU 60.33** — évacuation PVC extérieure
- **NF EN 1451-1** (PVC évacuation)

### État actuel : 🔴 ABSENT

### Structure cible

#### Strate 2 — Principal
- **Tube PVC Ø32 mm** (lavabo, bidet)
- **Tube PVC Ø40 mm** (douche, lave-linge)
- **Tube PVC Ø50 mm** (évier, baignoire)
- **Tube PVC Ø100 mm** (WC → chute)
- Conditionnement : barre 4 ml (tube) ou 1 ml (manchons courts)

#### Strate 3 — Accessoires (obligatoires)
- **Colle PVC spéciale** — NF DTU 60.32 §6.2
  - Formule : `nb_raccords × 0.02` L
  - Fabricant : Griffon, Bostik
  - Conditionnement : boîte 1 L

- **Coudes, tés, manchons** (PVC) — ≈ 3 raccords par 3 ml

- **Colliers de fixation** (1 tous les 80 cm horizontal, 2 m vertical)

- **Tampon de visite / regard** (obligatoire tous les 15 m linéaire ou au changement de direction)

- **Siphons** (un par évacuation sanitaire — lavabo, évier, bidet, douche)

#### Strate 4 — Finitions
- **Ventilation primaire** (ventilation de chute — obligatoire DTU 60.11 §7)
  - Formule : `1` u par chute
  - Ref : chapeau ventilation PVC Ø100

### 🔧 Correctif : recette `plomberie-evacuation-pvc`

### 🧪 Test
**Input** : « Évacuations salle de bain : 1 WC + 1 douche + 1 lavabo »
**Output** : 12 ml PVC Ø100 + 6 ml Ø40 + 4 ml Ø32 + coudes + tés + 2 siphons + colle + colliers + 1 ventilation primaire.

---

## 17.4 Ouvrage : WC (suspendu)

### Structure cible

#### Principal
- **Bâti-support WC suspendu** (Geberit Duofix, Grohe Rapid SL, Wirquin)
  - 1 u
- **Cuvette WC sans bride** (Villeroy & Boch, Duravit, Roca)
- **Abattant WC** (frein de chute)
- **Plaque de commande** (double débit 3/6 L)
- **Raccord EV Ø100**

#### Accessoires
- **Raccordement arrivée eau EF** (flexible Gripp)
- **Kit de scellement bâti** (chevilles, tire-fond)
- **Joints d'étanchéité silicone**

### 🧪 Test
**Input** : « Installation 1 WC suspendu »
**Output** : bâti + cuvette + abattant + plaque + flexible arrivée + kit scellement + silicone.

---

## 17.5 Ouvrage : Lavabo / vasque

### Structure cible

#### Principal
- **Lavabo ou vasque** (à poser, encastrer, semi-encastrer, mural)
- **Mitigeur** (chromé standard ou thermostatique) — Grohe Eurosmart / Hansgrohe
- **Siphon laiton Ø32** chromé

#### Accessoires
- **Flexibles inox** (2× G3/8 × G1/2, long. 50 cm)
- **Robinets d'arrêt EF/EC** (2 u)
- **Bonde clic-clac**
- **Silicone sanitaire** (joint périphérique)

### 🧪 Test
**Input** : « 1 lavabo avec mitigeur »
**Output** : lavabo + mitigeur + siphon + 2 flexibles + 2 robinets arrêt + bonde + silicone.

---

## 17.6 Ouvrage : Douche (bac + paroi + receveur)

### Structure cible

#### Principal
- **Receveur douche** (céramique, résine, extra-plat) — 1 u
- **Paroi douche** (vitrée) — 1 u
- **Colonne douche** (mitigeur + pommeau fixe + douchette)
- **Bonde douche** (grand débit Ø90)

#### Accessoires
- **Raccord multicouche EF/EC**
- **Silicone SEL** (cordon d'étanchéité périphérique)
- **Membrane étanchéité SEL** (sous receveur) — DTU 52.2 / DTU 43.5
  - Pour douche à l'italienne (sans receveur) obligatoire
- **Kit d'évacuation Ø40**

### 🧪 Test
**Input** : « Douche 90×90 avec paroi + colonne »
**Output** : receveur + paroi + colonne + bonde + silicone + membrane SEL + raccords.

---

## 17.7 Ouvrage : Baignoire

### Structure cible

#### Principal
- **Baignoire** (acier, acrylique, fonte — selon budget)
- **Tablier baignoire**
- **Robinetterie mitigeur** (mural ou sur gorge)
- **Set de vidage** (bonde + trop-plein + flexible)

#### Accessoires
- **Pieds réglables** (parfois inclus, parfois à part)
- **Mousse acoustique** (sous baignoire — anti-vibration)
- **Silicone sanitaire** (périphérique)

### 🧪 Test
**Input** : « Baignoire 170×70 acrylique + robinetterie »
**Output** : baignoire + tablier + mitigeur + set vidage + pieds + mousse acoustique + silicone.

---

## 17.8 Ouvrage : Chauffe-eau

### Types et spécifiques

**Électrique (cumulus)**
- Cumulus 150/200/300 L (Atlantic Chauffeo, Thermor Duralis)
- **Groupe de sécurité** `obligatoire` NF DTU 60.1 §6.4
- **Siphon d'évacuation groupe sécurité**
- **Flexibles inox** (EF entrée, ECS sortie)
- **Vanne d'arrêt**

**Thermodynamique (PAC ballon)**
- Ballon ACT + unité extérieure si split
- Évacuation condensats
- Ref : RE2020 privilégié

**Gaz instantané**
- Chaudière gaz murale (en existant ou dédiée)
- Évacuation fumées (conduit concentrique)
- Gaz : raccordement certifié PGN

#### Accessoires communs
- **Raccords laiton DN20**
- **Robinets thermostatiques** (si installation avec radiateurs sur même circuit)
- **Vase d'expansion** (obligatoire sur ECS > 50 L NF DTU 60.11)

### 🧪 Test
**Input** : « Chauffe-eau thermodynamique 250 L »
**Output** : ballon ACT + groupe sécurité + vase expansion + flexibles inox + robinet arrêt + évacuation condensats.

---

## 📋 Synthèse trade #17

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 17.1 Alim PER/multicouche | 🔴 | recette complète (9 matériaux) |
| 17.2 Alim cuivre | 🔴 | recette complète (6 matériaux) |
| 17.3 Évacuations PVC | 🔴 | recette complète (10 matériaux) |
| 17.4 WC suspendu | 🔴 | recette complète (7 matériaux) |
| 17.5 Lavabo | 🔴 | recette complète (7 matériaux) |
| 17.6 Douche | 🔴 | recette complète (8 matériaux) |
| 17.7 Baignoire | 🔴 | recette complète (6 matériaux) |
| 17.8 Chauffe-eau | 🔴 | recette complète (8 matériaux) |

**Volume à créer** : 8 recettes, ~60 matériaux.
**Temps implémentation** : ~4 h.

---

## ⚠️ Points critiques plomberie

1. **Test de pression obligatoire** (NF DTU 60.1) avant fermeture gaines — à mentionner dans hypothèses
2. **Groupe de sécurité** obligatoire tout ballon ECS
3. **Ventilation primaire** obligatoire chute EV Ø100
4. **Clapet anti-retour** après compteur général
5. **Vase d'expansion** obligatoire sur ECS

---

## ✅ Statut audit #17

- [x] NF DTU 60.1, 60.5, 60.11, 60.32 vérifiés
- [x] 8 ouvrages structurés avec DTU
- [ ] Implémentation : attente P3

**Prochain audit** : #21 Électricité CFO.
