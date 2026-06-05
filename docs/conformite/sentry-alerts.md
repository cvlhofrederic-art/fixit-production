# Sentry — Alertes patterns anormaux (FR-V3)

> Configurées dans le dashboard Sentry, projet Vitfix Production. Ce document trace les règles à maintenir.

## Alertes critiques (notification immédiate Slack/email)

### 1. Mass cancel detector
- **Trigger** : > 5 événements `category:doc-cancel` en 1 minute pour le même `user_id`
- **Action** : alerte email + ban temporaire automatique du user (rate limit dynamique)
- **Pourquoi** : signal d'attaque (compromise de compte) ou bug applicatif (loop)
- **Source** : breadcrumbs ajoutés par `app/api/document-cancel/route.ts`

### 2. Hash chain break detected
- **Trigger** : événement avec tag `chain_status=broken`
- **Action** : alerte critique immédiate
- **Pourquoi** : altération post-émission d'un document, ou bug de génération hash
- **Source** : à instrumenter dans une cron job nightly qui scan `v_*_chain_check`

### 3. Status transition rejected by trigger
- **Trigger** : événement avec exception PostgreSQL `check_violation` sur `validate_*_transition`
- **Action** : alerte email
- **Pourquoi** : tentative de retour en arrière de statut (ex: paid → pending) — signal de bug ou attaque
- **Source** : Sentry capture les exceptions Supabase automatiquement

### 4. Massive DELETE attempt on devis/factures
- **Trigger** : événement avec tag `agent_type=devis-sync` + exception RLS error mentionnant "denied"
- **Action** : alerte critique
- **Pourquoi** : tentative d'utiliser l'ancien chemin de hard delete (devrait être impossible côté API mais double sécurité)

## Alertes warning (notification email seulement)

### 5. PT fatura emission attempt
- **Trigger** : tag `agent_type=portugal-fiscal` avec status 410 (route désactivée)
- **Action** : email warning hebdomadaire si > 0 tentatives
- **Pourquoi** : détecter si un user PT essaie d'émettre — signal qu'on devrait accélérer l'intégration Moloni

### 6. Cron anonymisation fail
- **Trigger** : `cron job anonymize_old_devis OR anonymize_old_factures` non exécuté pendant > 35 jours
- **Action** : email warning
- **Pourquoi** : conformité RGPD — l'anonymisation doit tourner mensuellement

### 7. PA inbound webhook signature mismatch
- **Trigger** : événement avec tag `agent_type=pa-incoming` + status 401
- **Action** : email warning si > 5 occurrences/jour
- **Pourquoi** : signal de tentative de spam ou de mauvaise config HMAC

## Configuration recommandée

### Dashboard Sentry → Alerts → Create Alert

```yaml
- name: "Mass cancel detector"
  conditions:
    - "An event count for an issue is more than 5 in 1m"
  filters:
    - "tag breadcrumb.category equals doc-cancel"
  actions:
    - send notification to slack #vitfix-alerts
    - send notification to conformite@vitfix.io
  frequency: 5 minutes  # don't spam

- name: "Hash chain break"
  conditions:
    - "A new issue is created"
  filters:
    - "tag chain_status equals broken"
  actions:
    - send notification to slack #vitfix-alerts
    - send notification to conformite@vitfix.io
  frequency: instant

# (etc. pour 3-7)
```

## Action pour FR-V3 (à compléter post-merge)

- [ ] Créer les 7 alertes ci-dessus dans Sentry dashboard (config UI, pas de code)
- [ ] Tester l'alerte #1 en simulant un mass cancel sur un user de test
- [ ] Documenter le destinataire `conformite@vitfix.io` dans le DPIA
- [ ] Programmer un rappel trimestriel pour vérifier que les alertes fonctionnent encore (drift de format Sentry possible sur évolutions)
