# DPIA — Analyse d'impact relative à la protection des données

> Article 35 du RGPD (UE 2016/679). Document de conformité interne, à mettre à jour à chaque modification substantielle du traitement des données personnelles.

**Version** : 1.0 — 5 mai 2026
**Responsable du traitement** : SAS Kinnova Group, 951 819 010, 115 Rue Claude Nicolas Ledoux, 13290 Aix-en-Provence (FR)
**DPO** : pas désigné formellement (entreprise < 250 employés, pas d'activité principale impliquant traitement à grande échelle de données sensibles). Contact RGPD : `rgpd@vitfix.io`.

## 1. Description systématique des opérations de traitement

### 1.1 Finalités principales
1. **Mise en relation** entre clients (particuliers / professionnels) et artisans BTP en France et au Portugal
2. **Émission de devis et factures** pour les artisans (B2B et B2C)
3. **Stockage des chantiers BTP** (équipes, photos, rapports d'intervention)
4. **Communication** entre artisans et clients (messagerie in-app, emails de relance)
5. **Paiement et abonnement** (Stripe pour la facturation Vitfix → artisan)
6. **Statistiques agrégées d'activité** (CA, marge, conversion devis/facture)

### 1.2 Catégories de données

| Catégorie | Données | Source | Finalité |
|---|---|---|---|
| Identification artisan | Nom, prénom, email, téléphone, SIRET, adresse pro | Inscription | Mise en relation, contractualisation, facturation Vitfix |
| Identification client BTP/particulier | Nom, email, téléphone, adresse postale, NIF (PT) | Saisie par artisan | Émission devis/facture, contact |
| Données financières | Montants HT/TTC, IBAN/BIC artisan, paiements | Calculs internes + Stripe | Comptabilité artisan |
| Données techniques | Adresses IP, user agent, logs d'erreurs | Sessions web | Sécurité, débogage |
| Photos chantier | Images JPEG géolocalisées | App mobile artisan | Documentation chantier (rapport intervention) |
| Documents administratifs | KBIS, RC Pro, décennale (artisan) | Upload artisan | Vérification de conformité affichée au client |

### 1.3 Catégories de personnes concernées
- Artisans (utilisateurs payants, B2B)
- Clients des artisans (particuliers et entreprises)
- Membres d'équipe BTP (employés des artisans)
- Visiteurs du site public (cookies essentiels uniquement)

### 1.4 Destinataires des données

| Destinataire | Données partagées | Base légale |
|---|---|---|
| Supabase (USA, mais région UE Frankfurt) | Toutes données stockées | Sous-traitant — DPA signé |
| Cloudflare (USA) | Trafic web, logs | Sous-traitant — DPA signé |
| Sentry (USA, EU region disponible) | Logs d'erreurs anonymisés | Sous-traitant — DPA signé |
| Stripe (USA, EU subsidiaries) | Paiements artisan | Sous-traitant — DPA signé, certifié PCI-DSS |
| Resend (USA) | Emails transactionnels | Sous-traitant — DPA signé |
| Groq (USA) | Prompts IA anonymisés (pas de données client) | Sous-traitant |
| Stripe Atlas / DGFiP (FR) | Données fiscales artisan agrégées | Obligation légale |

### 1.5 Transferts hors UE
Plusieurs sous-traitants sont basés aux USA. Les transferts s'appuient sur :
- **Clauses Contractuelles Types** (CCT 2021) intégrées aux DPA
- **Décision d'adéquation EU-US Data Privacy Framework** (DPF) pour Cloudflare (CDN), Sentry, Resend (vérifié sur dataprivacyframework.gov)
- **Région EU** activée explicitement chez Supabase (Frankfurt) et Sentry (Frankfurt) pour le stockage primaire

## 2. Évaluation de la nécessité et de la proportionnalité

### 2.1 Justification de la collecte
Toutes les données collectées sont **strictement nécessaires** à la prestation du service :
- Sans nom + email artisan → impossible de créer un compte
- Sans nom + adresse client → impossible de générer un devis légal (mention obligatoire arrêté 24 janvier 2017)
- Sans IBAN → impossible de gérer la facturation/règlement
- Sans NIF (PT) → impossible d'émettre une fatura conforme

### 2.2 Durée de conservation
Cf. politique de rétention (FR-V5) :

| Type | Conservation | Base légale |
|---|---|---|
| Compte actif (artisan, équipe) | Durée du contrat + 3 ans | Prescription civile contrat |
| Documents fiscaux (devis, facture) | 10 ans | Art. L. 123-22 Code commerce, L. 102 B LPF |
| Logs techniques | 1 an (puis purge auto) | Proportionnalité RGPD |
| Données client après suppression compte | Anonymisées sous 30 jours | Droit à l'oubli RGPD |
| Paiements Stripe | Selon Stripe (10 ans pour conformité fiscale) | Délégation sous-traitant |

### 2.3 Information des personnes
- Inscription artisan : politique de confidentialité acceptée explicitement (case à cocher)
- Devis client : mention « les données saisies sont stockées pour générer le devis et conservées 10 ans » dans les conditions générales d'utilisation
- Page publique : `https://vitfix.io/fr/confidentialite/` détaillant les traitements

### 2.4 Droits des personnes
Tous les droits RGPD sont exerçables via `rgpd@vitfix.io` :
- Accès (Art. 15)
- Rectification (Art. 16)
- Effacement (Art. 17) — sous 30 jours, hors documents fiscaux conservés 10 ans
- Limitation (Art. 18)
- Portabilité (Art. 20) — export JSON ou CSV des devis/factures
- Opposition (Art. 21)
- Décisions automatisées (Art. 22) — n/a, aucune décision juridique automatisée

## 3. Risques pour les droits et libertés

### 3.1 Catalogue des risques

| Risque | Vraisemblance | Gravité | Mesure |
|---|---|---|---|
| Accès illégitime aux données client (intrusion) | Faible | Forte | RLS Supabase + WAF Cloudflare + audits CodeQL/Semgrep |
| Modification non autorisée d'un devis émis | Moyenne avant FR-V1, Très faible après | Forte | Hash chain + RLS no-DELETE + triggers transition |
| Perte de données (panne, cyber-attaque) | Faible | Forte | PITR Supabase 30j + sauvegardes chiffrées AWS S3 mensuelles |
| Fuite via sous-traitant (Supabase, Cloudflare) | Très faible | Forte | DPA + chiffrement at-rest + monitoring Sentry |
| Profilage sans consentement | Très faible | Moyenne | Aucun ciblage publicitaire, aucun cookie tiers en dehors essentiels |
| Réidentification après anonymisation | Très faible | Moyenne | Anonymisation = suppression complète du nom/email/NIF, montants seuls conservés |

### 3.2 Mesures techniques mises en place
- RLS PostgreSQL par utilisateur sur toutes tables sensibles
- Authentification MFA disponible
- Chiffrement TLS 1.3 partout
- Chiffrement at-rest AES-256 (Supabase)
- Audit log dédié `documents_audit_log` (10 ans rétention)
- Hash chain SHA-256 + HMAC sur documents émis (FR-V1)
- Rate limiting sur endpoints sensibles (10/min sur cancel)
- Sentry alerts sur patterns anormaux (mass cancel, transitions backwards)
- Scans sécurité CI : CodeQL, Semgrep OWASP, TruffleHog secrets, Trivy

### 3.3 Mesures organisationnelles
- Accès aux données prod restreint à 2 administrateurs (Frédéric, ?)
- Process de réponse aux incidents : Sentry → notification < 5min → triage manuel
- Politique de mot de passe forte exigée (min 12 chars)
- Formation RGPD interne (auto-formation via guides CNIL)

## 4. Conclusions et plan d'action

### 4.1 Acceptabilité du traitement
✅ **Acceptable** sous réserve des mesures listées en section 3 et de la mise en conformité progressive (FR-V1 à FR-V5).

### 4.2 Plan de revue
Cette DPIA est révisée :
- À chaque modification substantielle du traitement (ajout d'un sous-traitant, nouvelle finalité, etc.)
- Annuellement au minimum
- En cas d'incident de sécurité avéré
- Sur demande explicite de la CNIL

### 4.3 Notification
La CNIL n'est pas saisie en consultation préalable car l'analyse ne révèle pas de **risque résiduel élevé** au sens de l'art. 36 RGPD après mise en place des mesures.

---

**Signature numérique** :
Document signé par Frédéric Carvalho, représentant légal SAS Kinnova Group, le 5 mai 2026.
Hash de version : à calculer à chaque mise à jour et à archiver dans `docs/conformite/dpia-rgpd-versions.md`.
