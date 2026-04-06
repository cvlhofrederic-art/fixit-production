# Procédure de Notification en cas de Violation de Données

**Version:** 1.0
**Date:** 2026-04-06
**Référence réglementaire:** RGPD Art. 33 et 34
**Responsable:** DPO (dpo@vitfix.io)

---

## 1. Objectif

Ce document définit la procédure de réponse à une violation de données personnelles conformément au RGPD :

- **Art. 33** : toute violation présentant un risque pour les droits et libertés des personnes doit être notifiée à l'autorité de contrôle compétente dans un délai de **72 heures** après sa découverte.
- **Art. 34** : si la violation est susceptible d'engendrer un risque élevé pour les personnes concernées, celles-ci doivent être notifiées **sans délai injustifié**.

L'absence de notification sans justification valable constitue une infraction directe au RGPD et expose l'organisation à des sanctions.

---

## 2. Définition d'une Violation de Données

Une violation de données personnelles désigne tout incident de sécurité entraînant, de manière accidentelle ou illicite :

- **L'accès non autorisé** à des données personnelles (intrusion, credential stuffing, fuite d'API key)
- **La perte** de données (suppression accidentelle, défaillance de backup)
- **La destruction** de données (ransomware, suppression malveillante)
- **L'altération** de données (modification non autorisée d'enregistrements)
- **La divulgation** de données à des tiers non habilités (mauvaise configuration S3, log public)

Toute suspicion raisonnable d'un de ces événements déclenche cette procédure.

---

## 3. Détection

Les vecteurs de détection à surveiller activement :

**Sentry**
- Alertes sur des erreurs d'authentification en masse
- Exceptions exposant des données personnelles dans les stack traces
- Pics anormaux d'erreurs 500 ou 403

**audit_logs (base de données)**
- Accès inhabituels à des tables contenant des PII (users, payments, addresses)
- Volume de requêtes anormalement élevé depuis une IP ou un compte
- Actions administratives en dehors des plages horaires normales

**Rapports utilisateurs**
- Signalements de connexions non reconnues
- Emails de réinitialisation de mot de passe non sollicités
- Plaintes sur des données incorrectes ou modifiées

**UptimeRobot / monitoring**
- Indisponibilité soudaine d'un service (peut indiquer une compromission)
- Changements de certificats TLS non planifiés

Tout membre de l'équipe ayant connaissance d'un incident potentiel doit **immédiatement** en informer le DPO et l'équipe technique.

---

## 4. Classification de la Sévérité

| Niveau | Description | Exemples |
|--------|-------------|----------|
| **Critique** | Données personnelles sensibles exposées ou exfiltrées | Emails, noms, données de paiement (numéros de carte), mots de passe en clair, adresses |
| **Élevé** | Accès non autorisé à des comptes utilisateurs actifs | Prise de contrôle de compte, session hijacking, token volé |
| **Moyen** | Fuite de données techniques contenant des PII | Stack traces avec emails ou IDs exposés dans des logs publics, erreurs Sentry mal filtrées |
| **Faible** | Tentative d'accès échouée sans compromission confirmée | Brute force bloqué, scan de vulnérabilités, credential stuffing sans succès |

Les niveaux Critique et Élevé déclenchent systématiquement l'évaluation pour notification CNIL/CNPD. Les niveaux Moyen et Faible sont documentés dans le registre même sans notification.

---

## 5. Procédure de Réponse (Timeline)

### T+0 : Détection et Confinement

Dès la confirmation d'un incident :

- Identifier la source et le vecteur d'attaque
- **Couper l'accès** : désactiver le compte ou service compromis, bloquer les IPs identifiées
- **Révoquer les tokens** : API keys, sessions actives, tokens OAuth concernés
- Activer un snapshot ou une sauvegarde de l'état actuel pour préserver les preuves
- Ouvrir un canal de communication interne dédié à l'incident (Slack #incident-YYYYMMDD)

Ne pas modifier les logs existants avant l'analyse forensique.

### T+1h : Évaluation de l'Impact

- Quelles catégories de données sont concernées (emails, paiements, adresses, mots de passe) ?
- Combien d'utilisateurs sont potentiellement affectés ?
- Quelle est la durée d'exposition (depuis quand la faille existait-elle) ?
- Les données ont-elles été exfiltrées, ou seulement consultées ?
- L'incident est-il terminé ou en cours ?

Documenter les réponses dans un rapport d'incident interne (voir section 8).

### T+4h : Notification Interne

Informer obligatoirement :

- **DPO** (dpo@vitfix.io) : pilote la décision de notification aux autorités
- **Direction** : valide les décisions et les communications externes
- **Équipe technique** : coordonne la remédiation
- **Support client** : prépare les réponses aux utilisateurs si besoin

Le DPO évalue si le seuil de notification réglementaire est atteint.

### T+24h : Documentation Complète

- Rapport d'incident complet avec timeline, données affectées, actions prises
- Capture des logs pertinents archivée de façon sécurisée
- Enregistrement dans le registre des violations (voir section 8)

### T+72h maximum : Notification CNIL ou CNPD

Si l'incident présente un risque pour les droits et libertés des personnes :

- **Opérations France** : notifier la CNIL via le portail en ligne
- **Opérations Portugal** : notifier la CNPD
- Joindre le rapport d'impact et les mesures de confinement déjà prises
- Si les 72h ne peuvent pas être respectées, notifier quand même en expliquant le délai

### T+72h : Notification des Personnes Concernées

Si le risque est qualifié d'**élevé** (données sensibles, financières, ou risque d'usurpation d'identité) :

- Contacter directement les utilisateurs affectés par email
- Ne pas attendre d'avoir tous les détails pour notifier : envoyer un premier message puis un suivi
- Ne pas minimiser l'incident dans la communication

---

## 6. Contenu de la Notification

### Notification à l'autorité (Art. 33.3)

La notification à la CNIL ou CNPD doit contenir :

1. La nature de la violation (type d'incident, catégories et volume de données concernées, nombre approximatif de personnes)
2. Les coordonnées du DPO ou du point de contact
3. Les conséquences probables de la violation
4. Les mesures prises ou envisagées pour remédier à la violation et en atténuer les effets
5. Si toutes les informations ne sont pas disponibles à T+72h, les fournir en plusieurs étapes en le précisant

### Notification aux personnes concernées (Art. 34)

La communication aux utilisateurs doit contenir :

1. Une description claire de ce qui s'est passé, en langage simple
2. Les catégories de données personnelles concernées
3. Les coordonnées du DPO pour toute question
4. Les risques probables et leurs conséquences concrètes pour l'utilisateur
5. Les mesures recommandées pour se protéger (changer de mot de passe, surveiller ses relevés bancaires, activer la 2FA)
6. Les actions déjà prises par l'organisation

Ne pas utiliser de langage juridique opaque. La notification doit être compréhensible pour un utilisateur non technique.

---

## 7. Actions de Remédiation

Après confinement, exécuter dans les 48h suivant la résolution :

**Rotation des secrets**
- Regénérer toutes les API keys potentiellement exposées
- Changer les mots de passe des comptes de service
- Invalider toutes les sessions actives des utilisateurs concernés
- Renouveler les certificats si compromis

**Patch de sécurité**
- Identifier et corriger la vulnérabilité exploitée
- Déployer le correctif en staging avant production
- Vérifier l'absence d'autres vecteurs similaires

**Audit post-incident**
- Revue complète des logs de la période concernée
- Vérification de l'intégrité des données (aucune modification non autorisée persistante)
- Test de pénétration ciblé sur le vecteur exploité
- Revue des règles de filtrage Sentry pour éviter les fuites de PII dans les logs

---

## 8. Registre des Violations

L'Art. 33.5 impose de tenir un registre de toutes les violations, **y compris celles ne nécessitant pas de notification**.

Chaque entrée doit contenir :

- Date et heure de détection
- Date et heure de résolution
- Description de l'incident
- Catégories et volume de données concernées
- Nombre d'utilisateurs affectés
- Classification de sévérité
- Actions de confinement prises
- Décision de notification (oui/non) et justification
- Référence au rapport d'incident complet

Le registre est conservé par le DPO et accessible lors d'un audit réglementaire. Durée de conservation minimale : 3 ans.

---

## 9. Contacts

| Rôle | Contact |
|------|---------|
| DPO interne | dpo@vitfix.io |
| CNIL (France) | https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles |
| CNPD (Portugal) | https://www.cnpd.pt/ |

La notification CNIL se fait via le portail en ligne NotifCNIL, accessible avec un compte professionnel. Créer le compte avant tout incident.

---

## 10. Test et Révision

**Simulation annuelle**

Une simulation de violation de données doit être organisée une fois par an :

- Scénario fictif préparé par le DPO (ex. : fuite d'une table users via une injection SQL)
- Exercice chronométré sur la timeline T+0 à T+72h
- Debriefing sur les écarts entre procédure et exécution réelle
- Mise à jour de ce document en conséquence

**Révision après incident réel**

Après chaque incident ayant déclenché cette procédure, une révision est obligatoire :

- Identifier ce qui a fonctionné et ce qui a failli
- Mettre à jour les seuils de détection si l'incident n'a pas été détecté assez tôt
- Ajuster les délais si la timeline s'est révélée irréaliste
- Partager les enseignements avec l'équipe (sans données sensibles)

La version de ce document est incrémentée après chaque révision substantielle.
