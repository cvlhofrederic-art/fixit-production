# Audit #22 — Électricité CFA (courants faibles)

**Trade** : `electricite` (existant — étendre)
**Référentiels FR** :
- **NF C 15-100** §521.9 — cohabitation CFO/CFA
- **NF EN 50173-1** — Câblage informatique structuré
- **NF C 15-100** — amendement A5 (maintenance préventive domotique)
- Certification **RE2T** sécurité (alarme type 2)

**Ouvrages couverts** : 4
- 22.1 Câblage RJ45 (réseau informatique)
- 22.2 Câblage coaxial / fibre optique
- 22.3 Système d'alarme anti-intrusion
- 22.4 Vidéosurveillance / contrôle d'accès

---

## 22.1 Câblage RJ45 (réseau)

### 📚 Référence
- **NF EN 50173-1** — câblage classe E (cat 6 mini)
- **NF C 15-100** §771.5 — précâblage informatique obligatoire logement neuf

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Câble U/FTP cat 6a** (ou cat 7) — `bobine 305 m`
  - Formule : `nb_prises × 15` ml (estimation 15 m par prise vers baie brassage)
  - Pertes : 10%
  - Fabricant : Nexans, Legrand, Belden

- **Prises RJ45** (mural, avec plaque + mécanisme)
  - Formule : `1` u par prise
  - Fabricant : Legrand Mosaic, Schneider

- **Patch panel** (dans baie brassage)
  - Formule : `1` u (24 ports standard)

- **Cordons de brassage RJ45** (court 2 m vers patch panel)
  - Formule : `nb_prises × 1` u

#### Accessoires
- **Baie de brassage 19"** (GTL ou dédiée)
  - Formule : `1` u (9U ou 12U standard logement)
- **Switch/routeur** (équipement actif)
- **Gaine ICTA** (protection câble) — cf. CFO

### 🧪 Test
**Input** : « Câblage RJ45 cat 6a - 8 prises (T4) »
**Output** : 132 ml câble + 8 prises + 1 baie + 1 patch panel + 8 cordons + gaines.

---

## 22.2 Câblage coaxial / fibre optique

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal (coaxial satellite/TNT)
- **Câble coaxial 17 VAtC** (satellite/TNT)
  - Formule : `nb_prises × 15` ml

- **Prises murales TV coaxiales**
- **Répartiteur/amplificateur** (pour distribuer signal)

#### Principal (fibre optique)
- **Boîtier point de terminaison optique (PTO)**
  - Formule : `1` u (arrivée fibre opérateur)
- **Cordon optique** monomode (SC/APC)

### 🧪 Test
**Input** : « Câblage TV 4 prises + arrivée fibre »
**Output** : 60 ml coaxial + 4 prises TV + 1 répartiteur + 1 PTO fibre.

---

## 22.3 Système d'alarme anti-intrusion

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Centrale d'alarme** (filaire ou radio) + sirène
  - Fabricant : Ajax, Diagral, Somfy Protexiom
- **Détecteurs de mouvement IR** (1 par zone)
- **Détecteurs d'ouverture** (portes/fenêtres — 1 par ouverture protégée)
- **Clavier de commande** (1 u)
- **Télécommandes** (2 u)
- **Sirène intérieure + extérieure**
- **Module GSM** (alertes téléphoniques) — Ajax / Daitem

#### Accessoires
- **Câblage bus** (si filaire)
- **Batterie de secours**
- **Autocollants dissuasion**

### 🧪 Test
**Input** : « Alarme T3 (4 détecteurs mouvement + 3 détecteurs ouverture) »
**Output** : 1 centrale + 4 DIR + 3 DO + 1 clavier + 2 télécommandes + 2 sirènes + module GSM.

---

## 22.4 Vidéosurveillance

### État actuel : 🔴 ABSENT

### Structure cible

#### Principal
- **Caméras IP** (intérieur/extérieur, HD/4K)
  - Fabricant : Dahua, Hikvision, Reolink
- **Enregistreur NVR** (disque dur 2-4 To)
- **Câbles Ethernet cat 6** (ou caméras WiFi)
- **Alimentation POE** (via switch PoE)

#### Accessoires
- Supports muraux caméras
- Raccords étanches (extérieur)

### 🧪 Test
**Input** : « Vidéosurveillance 4 caméras extérieures »
**Output** : 4 caméras IP + 1 NVR + 1 disque dur + 4 câbles PoE + switch PoE + supports.

---

## 📋 Synthèse trade #22

| Ouvrage | État | À créer |
|---|:-:|:-:|
| 22.1 RJ45 | 🔴 | recette (7 matériaux) |
| 22.2 Coax/fibre | 🔴 | recette (5 matériaux) |
| 22.3 Alarme | 🔴 | recette (9 matériaux) |
| 22.4 Vidéosurveillance | 🔴 | recette (6 matériaux) |

**Volume** : 4 recettes, ~27 matériaux.
**Temps impl.** : ~1 h 30.
