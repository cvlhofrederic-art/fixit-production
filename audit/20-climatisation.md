# Audit #20 — Climatisation

**Trade** : `climatisation` (nouveau)
**Référentiels FR** :
- **NF EN 378** — Systèmes frigorifiques et PAC (sécurité fluide)
- Certification **F-Gaz** pour les techniciens (obligatoire)
- **NF EN 1363-3** — Performance climatisation
- **NF C 15-100** — Raccordement électrique

**Ouvrages couverts** : 3
- 20.1 Climatisation split mural (mono ou multi)
- 20.2 Climatisation gainable
- 20.3 Climatisation cassette

---

## 20.1 Climatisation split mural

### État actuel : 🔴 ABSENT

### Structure cible (mono-split 1 pièce)

#### Principal
- **Unité intérieure murale** (2,5 / 3,5 / 5 kW)
  - Fabricant : Daikin Emura, Mitsubishi MSZ, Panasonic Etherea
  - Fluide : R32 (depuis 2020, remplace R410A)

- **Unité extérieure** (condenseur) — puissance adaptée
- **Liaisons frigorifiques cuivre isolé** (Ø6+10 ou Ø6+12 mm)
  - Formule : `distance_unites × 2` ml
  - Conditionnement : couronne pré-isolée

- **Câble de liaison** (4 brins + terre)
  - Formule : `distance × 1` ml

#### Accessoires
- **Support mural unité extérieure** (consoles)
- **Bac évacuation condensats + tube PVC**
  - Tube condensats : `distance × 1` ml
- **Passage mur étanche** (carottage + étanchéité)
- **Disjoncteur + câblage 230 V** (dédié au tableau)
- **Télécommande** (incluse)

### 🧪 Test
**Input** : « Split mural 3,5 kW salon, liaison 5 ml »
**Output** : 1 UE + 1 UI + 10 ml liaisons frigo + 5 ml câble liaison + support + condensats + disjoncteur.

---

## 20.2 Climatisation gainable

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Unité intérieure gainable** (à encastrer en faux-plafond)
- **Unité extérieure** (plus puissante : 8-14 kW)
- **Liaisons frigo + câbles**
- **Gaines isolées flexibles** (distribution aux pièces)
  - Formule : `nb_pieces × 5` ml
- **Bouches de soufflage** (1 par pièce)
- **Bouches de reprise** (1-2 centralisées)

#### Accessoires
- Plénum modulaire
- Regard visite filtres
- Télécommande centrale + thermostats

### 🧪 Test
**Input** : « Climatisation gainable T4 (4 pièces) »
**Output** : 1 UI gainable + 1 UE + liaisons + 20 ml gaines + 4 bouches soufflage + 2 reprises + plénum.

---

## 20.3 Climatisation cassette

### État actuel : 🔴 ABSENT

### Structure cible
- Cassette encastrée plafond (4 voies soufflage)
- Unité extérieure
- Liaisons frigo + câbles
- Plafond modulaire (découpe 60×60 cm)

### 🧪 Test
**Input** : « 1 cassette 3,5 kW bureau »
**Output** : 1 cassette + 1 UE + liaisons + accessoires.

---

## 📋 Synthèse trade #20

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 20.1 Split mural | 🔴 | recette (8 matériaux) |
| 20.2 Gainable | 🔴 | recette (10 matériaux) |
| 20.3 Cassette | 🔴 | recette (6 matériaux) |

**Volume** : 3 recettes, ~24 matériaux.
**Temps impl.** : ~1 h 30.

---

## ⚠️ Points critiques clim

- **Certification F-Gaz** obligatoire technicien (fluide frigorigène)
- **Fluide R32** depuis 2020 (abandon R410A)
- **Attestation fluide** après installation
