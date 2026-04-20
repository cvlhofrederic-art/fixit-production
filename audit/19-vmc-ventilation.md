# Audit #19 — Ventilation (VMC)

**Trade** : `ventilation` (nouveau)
**Référentiels FR** :
- **NF DTU 68.3** — Installations de ventilation mécanique (rev. 2017)
- **NF EN 13141** — Performance composants ventilation
- **RE2020** — Ventilation double flux favorisée

**Ouvrages couverts** : 3
- 19.1 VMC simple flux autoréglable ou hygroréglable
- 19.2 VMC double flux avec échangeur thermique
- 19.3 VMI (ventilation mécanique par insufflation)

---

## 19.1 VMC simple flux

### 📚 Référence
- **NF DTU 68.3** — §5 (conception), §6 (mise en œuvre)
- **NF EN 13141-4** — Performance

### État actuel : 🔴 ABSENT

### Structure cible (logement T3 standard)

#### Principal
- **Caisson VMC hygroréglable Type B** (3-4 bouches)
  - Formule : `1` u
  - Fabricant : Aldes, Unelvent, Atlantic
  - Ref : NF DTU 68.3 §5.4

- **Gaine semi-rigide Ø125** (ou isolée en combles)
  - Formule : `nb_bouches × 5` ml (estimation 5 ml par bouche vers caisson)
  - Pertes : 10%

- **Bouche d'extraction** (SDB, WC, cuisine)
  - Formule : `nb_pieces_humides × 1` u
  - T3 typique : 1 cuisine + 1 SDB + 1 WC = 3 bouches

- **Entrée d'air autoréglable** (façade)
  - Formule : `nb_pieces_seches × 1` u (chambre, salon)

- **Rejet toiture** (Ø125) ou sortie pignon
  - Formule : `1` u par système

#### Accessoires
- **Manchettes de raccord**
- **Colliers de fixation gaines**
- **Câble électrique 3G1,5** (alimentation caisson)
- **Disjoncteur dédié** (au tableau)

### 🔧 Correctif : recette `vmc-simple-flux`

### 🧪 Test
**Input** : « VMC simple flux hygroréglable T3 »
**Output** : 1 caisson + 15 ml gaines + 3 bouches extraction + 3 entrées d'air + 1 rejet toit + câblage.

---

## 19.2 VMC double flux

### 📚 Référence
- **NF DTU 68.3** + **NF EN 13141-7** (performance échangeurs)

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Caisson VMC double flux avec échangeur thermique haut rendement** (>85% RE2020)
  - Fabricant : Atlantic DuolyPro, Aldes DeeFly

- **Gaines isolées Ø125 et Ø160**
  - 2 circuits : soufflage (pièces sèches) + extraction (pièces humides)
  - Formule : `nb_bouches_soufflage × 5 + nb_bouches_extraction × 5` ml

- **Bouches de soufflage** (1 par pièce sèche — chambre, salon)
- **Bouches d'extraction** (1 par pièce humide)
- **Rejet toit** + **prise d'air neuf**

#### Accessoires
- **Pièges à son** (si circulation longue)
- **Filtres G4/F7** (1 jeu installation + 1 rechange)
- **Évacuation condensats** (PVC Ø32)
- **Commande programmable**

### 🧪 Test
**Input** : « VMC double flux T4 (3 ch + séjour + cuisine + SDB + WC) »
**Output** : 1 caisson + 30 ml gaines isolées + 4 bouches soufflage + 3 bouches extraction + rejet + prise air + filtres + condensats.

---

## 19.3 VMI (ventilation par insufflation)

### État actuel : 🔴 ABSENT (moins courant)

### Structure cible
- Caisson VMI en combles
- Gaines de soufflage dans pièces de vie
- Filtre G4
- Évacuation d'air par défaut par conduits existants

### 🧪 Test
Rarement utilisé — à traiter en P3 si demandé.

---

## 📋 Synthèse trade #19

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 19.1 VMC simple flux | 🔴 | recette (9 matériaux) |
| 19.2 VMC double flux | 🔴 | recette (11 matériaux) |
| 19.3 VMI | 🔴 | recette (6 matériaux) |

**Volume** : 3 recettes, ~26 matériaux.
**Temps impl.** : ~1 h 30.
