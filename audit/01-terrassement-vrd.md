# Audit #01 — Terrassement & VRD

**Trade** : `vrd` (nouveau)
**Référentiels FR** :
- **NF DTU 12** — Terrassements pour bâtiments (rev. 1964, en vigueur)
- **NF P98-331** — Tranchées, ouverture, remblayage, réfection
- **NF EN 1610** — Construction réseaux d'évacuation
- **Fascicule 70** (CCTG) — canalisations d'assainissement

**Ouvrages couverts** : 6
- 1.1 Décaissement / déblais
- 1.2 Remblais
- 1.3 Réseaux enterrés (eau potable, EU, EP, gaz, élec)
- 1.4 Regards de visite / regards EP
- 1.5 Grillage avertisseur
- 1.6 Évacuation déblais (bennes)

---

## 1.1 Décaissement / déblais

### État actuel : 🔴 ABSENT — et **presque pas de matériau** (c'est de la main d'œuvre + matériel)

### Structure cible
Cet ouvrage est quasi exclusivement du **matériel + MO** :
- Pelle mécanique (location)
- Camion bennes (évacuation)

**Matériaux à prévoir** : aucun directement sur cette tâche.

**⚠️ Note pour l'estimateur** : cet ouvrage doit être listé dans l'estimateur comme **ouvrage zéro-matériau** (info uniquement) ou **exclu** du quantitatif. Décision produit à prendre.

---

## 1.2 Remblais

### État actuel : 🔴 ABSENT

### Structure cible

#### Matériaux
- **Grave naturelle 0/31,5** (remblai structurant)
  - Formule : `volume_tranchee` m³
  - Pertes : 15% (compactage)
  - Conditionnement : camion 6-20 m³ ou big bag

- **Sable 0/4** (lit sur canalisations)
  - Formule : `volume_lit_sable` m³

### 🧪 Test
**Input** : « Remblai fondation 30 m³ »
**Output** : 35 m³ grave + 5 m³ sable.

---

## 1.3 Réseaux enterrés

### 📚 Référence
- **NF EN 1610** — Construction réseaux d'évacuation

### État actuel : 🔴 ABSENT

### Structure cible (par réseau)

#### Matériaux de base (communs à tous réseaux enterrés)
- **Sable pour lit de pose + enrobage** (5-10 cm autour canalisation)
  - Formule : `longueur × largeur_tranchee × 0.2` m³
- **Grillage avertisseur** (couleur selon réseau)
  - Bleu = eau potable
  - Rouge = électricité
  - Jaune = gaz
  - Formule : `longueur × 1` ml

#### Par type de réseau
- **Eau potable** : tube PE bleu Ø25/32 PN16 + raccords
- **Évacuation EU/EP** : PVC Ø100/160 + coudes + tés
- **Électricité** : gaine TPC rouge Ø63 ou 90 + grillage rouge
- **Gaz** : tube PE jaune + grillage jaune
- **Télécom/fibre** : gaine TPC verte

### 🧪 Test
**Input** : « Réseau EU + EP 30 ml en terrain meuble »
**Output** : 30 ml PVC Ø160 + 30 ml PVC Ø100 + 3 m³ sable lit + 60 ml grillage + coudes/tés.

---

## 1.4 Regards de visite

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Regard préfabriqué béton** (40×40, 50×50, 60×60 cm)
  - Fabricant : Alkern, Dupré Préfa
- **Tampon fonte** (type PMR si accessible) classe adaptée au passage (A15, B125, C250, D400)
- **Rehausse béton** si profondeur > 60 cm

#### Accessoires
- **Joints étanches** (entre éléments)
- **Mortier scellement**

### 🧪 Test
**Input** : « 3 regards 40×40 + 3 tampons fonte A15 »
**Output** : 3 regards + 3 tampons + joints + mortier.

---

## 1.5 Grillage avertisseur
Cf. 1.3 (intégré aux réseaux).

---

## 1.6 Évacuation déblais

### État actuel : 🔴 ABSENT — **pas de matériau** (service)

**Matériel / service** :
- Location benne déchet (6, 10, 15 m³)
- Transport vers centre enfouissement / recyclage

**⚠️ Note** : à traiter en coût main d'œuvre / service, pas en matériau.

---

## 📋 Synthèse trade #01

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 1.1 Décaissement | 🔴 | ouvrage "zéro matériau" (MO) |
| 1.2 Remblais | 🔴 | recette (2 matériaux) |
| 1.3 Réseaux enterrés | 🔴 | recette modulable par type (6-8 mat./réseau) |
| 1.4 Regards | 🔴 | recette (4 matériaux) |
| 1.5 Grillage avertisseur | cf. 1.3 | intégré |
| 1.6 Évacuation | 🔴 | ouvrage "zéro matériau" (service) |

**Volume** : 4 recettes matériaux, ~20 matériaux.
**Temps impl.** : ~1 h 30.

**Cas particuliers** : 2 ouvrages "zéro matériau" (décaissement + évacuation déblais) → soit on les exclut de l'estimateur, soit on les affiche avec une note "Ouvrage main d'œuvre/matériel uniquement".
