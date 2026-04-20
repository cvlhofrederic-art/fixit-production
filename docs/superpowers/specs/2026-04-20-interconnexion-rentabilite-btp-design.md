# Interconnexion Facturation ↔ Analytique & Calcul de Rentabilité Réelle

**Date :** 2026-04-20
**Produit :** VitFix Pro
**Approche retenue :** Moteur de calcul + vue matérialisée enrichie + composants existants enrichis
**Juridictions :** FR et PT (mono-juridiction par compte)
**Dashboards :** Artisan (micro/auto/EI/ENI/Trabalhador Independente) + PRO BTP (sociétés)

---

## 1. Décisions validées

- **Pas de nouvelle page** — enrichissement des sections existantes du dashboard
- **Table `ref_taux` Supabase** avec CRUD admin complet, versioning temporel, audit trail
- **Toutes les formes juridiques** supportées dès le départ (7 FR + 5 PT)
- **Même granularité partout** — calcul par chantier pour tous, seul le moteur de charges s'adapte à la forme juridique
- **UX artisan-friendly** — 3 niveaux de lecture : chiffre clé → détail → audit
- **Table frais annexes** ajoutée dans le formulaire devis/factures (3ème table à côté de matériaux et main d'œuvre)
- **Charges fixes relationnelles** — migration du JSONB `frais_fixes_mensuels` vers table `charges_fixes`

---

## 2. Modèle de données

### 2.1. Table `ref_taux`

```sql
CREATE TABLE ref_taux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  juridiction TEXT NOT NULL CHECK (juridiction IN ('FR', 'PT')),
  type_charge TEXT NOT NULL,
  regime TEXT NOT NULL,
  taux NUMERIC(8,4) NOT NULL,
  seuil_min NUMERIC(12,2),
  seuil_max NUMERIC(12,2),
  date_debut_validite DATE NOT NULL,
  date_fin_validite DATE,
  source_reglementaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**type_charge** : `cotisations_sociales`, `charges_patronales`, `charges_salariales`, `is`, `irc`, `irs`, `ir`, `tva`, `iva`, `cibtp`, `oppbtp`, `pro_btp`, `intemperies`, `tsu`, `fct`, `fgct`, `seguro_acidentes`, `derrama_municipal`, `derrama_estadual`, `versement_liberatoire`

**regime** : `auto_entrepreneur`, `micro_bic`, `micro_bnc`, `ei`, `eurl_is`, `eurl_ir`, `sarl`, `sasu`, `sas`, `sa_fr`, `eni`, `trabalhador_independente`, `unipessoal_lda`, `lda`, `sa_pt`

### 2.2. Table `charges_fixes`

```sql
CREATE TABLE charges_fixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users NOT NULL,
  label TEXT NOT NULL,
  montant NUMERIC(10,2) NOT NULL,
  frequence TEXT NOT NULL CHECK (frequence IN ('mensuel', 'trimestriel', 'annuel')),
  categorie TEXT NOT NULL CHECK (categorie IN (
    'decennale', 'rc_pro', 'loyer', 'leasing',
    'comptabilite', 'vehicule', 'telephone',
    'logiciel', 'formation', 'autre'
  )),
  date_debut DATE,
  date_fin DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE charges_fixes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON charges_fixes
  FOR ALL USING (owner_id = auth.uid());
```

### 2.3. Liaison devis/factures ↔ chantier

```sql
ALTER TABLE devis ADD COLUMN chantier_id UUID REFERENCES chantiers_btp(id);
ALTER TABLE factures ADD COLUMN chantier_id UUID REFERENCES chantiers_btp(id);

CREATE INDEX idx_devis_chantier ON devis(chantier_id) WHERE chantier_id IS NOT NULL;
CREATE INDEX idx_factures_chantier ON factures(chantier_id) WHERE chantier_id IS NOT NULL;
```

### 2.4. Frais annexes dans devis/factures

```sql
ALTER TABLE devis ADD COLUMN frais_annexes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE factures ADD COLUMN frais_annexes JSONB DEFAULT '[]'::jsonb;
```

Structure JSONB par item :
```json
{
  "id": "uuid",
  "designation": "Déplacement A/R",
  "categorie": "deplacement",
  "quantite": 2,
  "unite": "forfait",
  "prix_unitaire_ht": 45.00,
  "tva_applicable": 20,
  "total_ht": 90.00
}
```

Catégories : `deplacement`, `location_materiel`, `hebergement`, `peage`, `carburant`, `autre`
Unités : `forfait`, `km`, `jour`, `heure`

### 2.5. Vue matérialisée `v_rentabilite_chantier` enrichie

Ajoute à la vue existante :
- `montant_facture_ht` — somme des factures liées au chantier
- `montant_devis_ht` — somme des devis liés au chantier
- `total_frais_annexes` — somme des frais annexes des factures liées
- `quote_part_fixes_mensuelle` — charges fixes mensuelles réparties au prorata
- `marge_brute` — montant_facture_ht - coûts directs
- `taux_marge_brute` — marge_brute / montant_facture_ht × 100

Les charges sociales/fiscales sont calculées côté moteur TS (dépendent de la forme juridique du profil, pas du chantier).

### 2.6. Migration des données existantes

- `settings_btp.frais_fixes_mensuels` JSONB → insertions dans `charges_fixes`
- Le champ JSONB est conservé en lecture seule pendant la transition, supprimé en phase 2

---

## 3. Moteur de calcul

### 3.1. Structure

```
lib/rentabilite/
├── engine.ts          -- calculeRentabilite(): fonction principale
├── ref-taux.ts        -- chargement et cache des taux depuis Supabase
├── charges.ts         -- calcul charges sociales/fiscales par forme juridique
├── repartition.ts     -- répartition charges fixes par chantier
└── types.ts           -- interfaces partagées
```

### 3.2. Interface

```typescript
interface CalculRentabiliteInput {
  chantier_id: string
  montant_facture_ht: number
  montant_devis_ht: number
  couts: {
    materiaux: number
    main_oeuvre: number
    sous_traitance: number
    frais_annexes: number
  }
  devis_detail?: {
    materiaux: number
    main_oeuvre: number
    sous_traitance: number
    frais_annexes: number
  }
  masse_salariale_brute: number
  juridiction: 'FR' | 'PT'
  forme_juridique: string
  regime_tva: string
  periode: Date
}

interface ResultatRentabilite {
  // Niveau 1 — chiffre clé
  benefice_net: number
  taux_marge_nette: number
  statut: 'rentable' | 'juste' | 'perte'

  // Niveau 2 — détail charges
  marge_brute: number
  taux_marge_brute: number
  charges_sociales: number
  charges_fiscales: number
  quote_part_fixes: number
  total_charges: number

  // Niveau 3 — écart devis vs réalisé
  ecart_devis: {
    materiaux: { prevu: number; reel: number; ecart_pct: number }
    main_oeuvre: { prevu: number; reel: number; ecart_pct: number }
    sous_traitance: { prevu: number; reel: number; ecart_pct: number }
    frais_annexes: { prevu: number; reel: number; ecart_pct: number }
    total: { prevu: number; reel: number; ecart_pct: number }
  }

  // Audit trail
  taux_appliques: { type: string; taux: number; source: string }[]
  date_calcul: Date
}
```

### 3.3. Règles de calcul par forme juridique

**Dashboard Artisan (FR) :**
| Forme | Cotisations sociales | Fiscal |
|-------|---------------------|--------|
| Auto-entrepreneur BTP | 22% du CA (URSSAF) | Versement libératoire 1,7% ou IR |
| Micro-BIC | 22% du CA | IR après abattement 50% |
| EI | SSI ~45% du bénéfice | IR barème progressif |

**Dashboard Artisan (PT) :**
| Forme | Cotisations sociales | Fiscal |
|-------|---------------------|--------|
| ENI | Segurança Social ~21,4% du revenu | IRS barème progressif |
| Trabalhador Independente | ~21,4% sur 70% du revenu | IRS avec retenção na fonte |

**Dashboard PRO BTP (FR) :**
| Forme | Charges patronales | Dirigeant | Fiscal |
|-------|--------------------|-----------|--------|
| EURL IS | ~42% masse salariale | SSI gérant TNS | IS 15%/25% |
| EURL IR | ~42% masse salariale | SSI gérant TNS | IR sur bénéfice |
| SARL | ~42% masse salariale | SSI gérant majoritaire | IS 15%/25% |
| SASU | ~42% masse salariale + ~80% rémunération dirigeant | Assimilé salarié | IS 15%/25% |
| SAS | idem SASU | Assimilé salarié | IS 15%/25% |
| SA FR | idem SAS | Assimilé salarié | IS 15%/25% |

**Dashboard PRO BTP (PT) :**
| Forme | Charges patronales | Fiscal |
|-------|--------------------|--------|
| Unipessoal Lda | TSU 23,75% + FCT/FGCT 1% | IRC 17%/21% + derrama |
| Lda | TSU 23,75% + FCT/FGCT 1% | IRC 17%/21% + derrama |
| SA PT | TSU 23,75% + FCT/FGCT 1% | IRC 21% + derrama |

**Contributions BTP spécifiques (ajoutées pour toutes les formes ayant des salariés) :**
- FR : CIBTP (congés payés ~19,8%), cotisation intempéries (~0,68%), OPPBTP (~0,11%), PRO BTP (prévoyance ~3,2%)
- PT : Seguro de acidentes de trabalho (~2-3%), CCP si marchés publics

### 3.4. Seuils de marge (codes couleur)

| Statut | Taux marge nette | Couleur | Message |
|--------|-----------------|---------|---------|
| `rentable` | > 15% | 🟢 vert | "Ce chantier t'a rapporté X €" |
| `juste` | 5% - 15% | 🟠 orange | "Ce chantier t'a rapporté X € — marge serrée" |
| `perte` | < 5% | 🔴 rouge | "Attention, ce chantier t'a coûté plus que prévu" |

Seuils configurables par l'artisan dans ses préférences.

### 3.5. Répartition des charges fixes

Deux modes au choix de l'artisan (préférence dans settings) :
1. **Prorata du CA** — quote-part = (CA chantier / CA total période) × charges fixes période
2. **Prorata du temps** — quote-part = (jours chantier / jours travaillés période) × charges fixes période

Par défaut : prorata du CA (plus intuitif pour un artisan).

---

## 4. Composants UI enrichis

### 4.1. RentabiliteChantierSection

**Enrichissements :**
- Remplacement du calcul de marge brute seule par le résultat complet du moteur
- 3 niveaux de lecture dépliables : chiffre clé → détail charges → écart devis
- Codes couleur vert/orange/rouge sur chaque indicateur
- Bouton "Lier un devis" si aucun devis associé
- Barre de progression encaissement (facturé vs encaissé)

### 4.2. ChantiersBTPV2 — Liaison devis/factures

**Ajouts :**
- Section "Devis et factures liés" dans la fiche chantier
- Bouton [+ Lier un devis] → modal avec liste des devis du même client (suggestion auto) + recherche
- Bouton [+ Créer un devis] → ouvre DevisFactureForm pré-rempli avec le client et chantier_id
- Affichage : numéro, montant, statut (brouillon/envoyé/signé/payé)
- Barre d'encaissement : facturé vs encaissé vs reste dû

### 4.3. ComptaBTPSection — Charges fixes

**Enrichissements :**
- Migration du JSONB vers la table relationnelle `charges_fixes`
- Regroupement par catégorie (assurances, local & véhicule, administratif)
- Alertes intelligentes : charges manquantes selon forme juridique et juridiction
  - FR BTP → "Tu n'as pas renseigné d'assurance décennale" si catégorie `decennale` absente
  - PT BTP → "Seguro de acidentes de trabalho non renseigné" si absent
- Total mensuel + coût par jour travaillé (÷ 22)

### 4.4. StatsRevenusSection — Bandeau de pilotage

**Ajout en haut du dashboard :**
- CA facturé du mois, charges totales, net dans ta poche, marge globale
- Nombre de chantiers en cours / terminés
- Meilleur chantier du mois (marge nette la plus haute)
- Alerte si un chantier est en dépassement
- Sparkline évolution sur 6 mois

### 4.5. DevisFactureForm — Table frais annexes

**Ajout :**
- 3ème onglet/section "Frais annexes" après "Matériaux" et "Main d'œuvre"
- Même pattern d'ajout de lignes que les tables existantes
- Champs : désignation, catégorie (dropdown), quantité, unité (dropdown), PU HT, TVA applicable
- Calcul auto du total HT par ligne et total section
- Report dans les totaux du devis/facture
- Catégories : déplacement, location matériel, hébergement, péage, carburant, autre
- Unités : forfait, km, jour, heure

---

## 5. Seed initial `ref_taux`

La migration inclut un seed des taux actuels (2026) pour les deux juridictions. Chaque entrée a sa `source_reglementaire`.

**FR (extraits) :**
- Auto-entrepreneur BTP artisanal : cotisations 22%, source URSSAF 2026
- IS taux réduit PME : 15% jusqu'à 42 500 €, source CGI art. 219
- IS taux normal : 25%, source CGI art. 219
- Charges patronales standard : ~42%, source URSSAF barème 2026
- CIBTP congés payés : 19,80%, source CIBTP 2026
- TVA taux normal : 20%, TVA travaux rénovation logement >2 ans : 10%

**PT (extraits) :**
- TSU patronal : 23,75%, source Código dos Regimes Contributivos
- TSU salarié : 11%, source idem
- Trabalhador Independente : 21,4% sur 70% du revenu, source idem
- IRC taux réduit PME : 17% jusqu'à 50 000 €, source CIRC art. 87
- IRC taux normal : 21%, source CIRC art. 87
- IVA normal : 23%, intermédiaire : 13%, réduit : 6%

---

## 6. Contraintes techniques

- **Aucun taux en dur dans le code** — tout passe par `ref_taux`
- **Non-rétroactivité** — les chantiers clôturés conservent les taux de leur période
- **Idempotence** — rejeu d'un calcul = même résultat
- **Traçabilité** — chaque résultat expose les taux utilisés et leur source
- **Performance** — cache client des taux (invalidé sur `updated_at`), vue matérialisée pour les agrégats lourds
- **RLS** — `charges_fixes`, `depenses_btp` filtrés par `owner_id = auth.uid()`
- **Arrondis** — au centime, selon règles comptables locales (arrondi au plus proche)

---

## 7. Admin `ref_taux`

Interface admin pour gérer les taux de référence :
- Liste filtrable par juridiction, type de charge, régime
- Création/modification d'un taux avec dates de validité
- Historique versionné (les anciens taux restent visibles, marqués "expiré")
- Champ `source_reglementaire` obligatoire à chaque modification
- Audit trail : qui a modifié, quand, ancienne valeur → nouvelle valeur
- Accessible uniquement aux rôles admin

---

## 8. Hors scope (phase ultérieure)

- OCR des factures fournisseurs
- Retenues de garantie, acomptes, paiements échelonnés
- Consolidation cross-comptes
- Chantiers à cheval sur deux exercices fiscaux
- Export SAF-T enrichi avec données de rentabilité
