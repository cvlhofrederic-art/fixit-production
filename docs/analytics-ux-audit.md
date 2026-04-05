# Phase 11 : Audit Analytics & Expérience Utilisateur

**Date :** 5 avril 2026
**Projet :** Fixit Production
**Scope :** Couverture analytics, funnels de conversion, suivi comportemental, erreurs frontend, adoption fonctionnalités, performance perçue, satisfaction, A/B testing, segmentation, cohortes, infrastructure données
**Statut :** Audit structurel (aucune donnée de production exploitable à ce jour)

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Funnel de conversion](#2-funnel-de-conversion)
3. [Suivi comportemental utilisateurs](#3-suivi-comportemental-utilisateurs)
4. [Suivi erreurs frontend](#4-suivi-erreurs-frontend)
5. [Usage des fonctionnalités](#5-usage-des-fonctionnalités)
6. [Perception de performance](#6-perception-de-performance)
7. [Satisfaction utilisateur](#7-satisfaction-utilisateur)
8. [Infrastructure A/B testing](#8-infrastructure-ab-testing)
9. [Segmentation](#9-segmentation)
10. [Analyse de cohortes](#10-analyse-de-cohortes)
11. [Infrastructure données](#11-infrastructure-données)
12. [Plan d'action priorisé](#12-plan-daction-priorisé)

---

## 1. Résumé exécutif

### État actuel

Fixit dispose d'une couverture analytics minimale, suffisante pour le monitoring technique mais
largement insuffisante pour piloter la croissance produit. Cinq briques sont en place :

| Brique | Rôle | Limite principale |
|--------|------|-------------------|
| Vercel Analytics | Pages vues, Web Vitals | Aucun événement custom, consent-gated |
| Sentry | Erreurs frontend/backend | Sampling à 10%, Session Replay désactivé |
| Langfuse | Traces LLM (Fixy AI, comptable AI, Max Expert) | Pas de corrélation avec les actions utilisateur |
| Upstash | Rate limiting analytics | Données opérationnelles uniquement |
| audit_logs (Supabase) | Trail RGPD Art. 30 | Rétention 1 an, pas conçu pour l'analyse produit |

### Lacunes majeures identifiées

**Aucun tracking d'événements custom.** La plateforme ne capture ni clics, ni interactions, ni
progressions dans les parcours utilisateurs. Les seules métriques disponibles sont les pages vues
agrégées de Vercel Analytics.

**Aucun framework A/B testing.** Pas de feature flags, pas d'expérimentations, pas de rollout
progressif. Chaque déploiement touche 100% des utilisateurs sans possibilité de comparaison.

**Aucun enregistrement de session.** Sentry Session Replay est configuré mais désactivé
(`replaysOnErrorSampleRate: 0`). Aucune alternative (LogRocket, Clarity, PostHog) n'est intégrée.

**Aucune mesure de satisfaction.** Pas de NPS, pas de widget feedback, pas d'enquête de sortie,
pas de suivi tickets support.

**Aucun suivi de funnel de conversion.** Les trois parcours utilisateurs (client, artisan, syndic)
ne sont pas instrumentés. Les taux de drop-off à chaque étape sont inconnus.

**Aucune analyse de cohortes.** Les timestamps `created_at` existent dans les tables `profiles` et
`bookings`, mais aucun outil ne les exploite pour suivre la rétention.

### Score de maturité analytics

| Dimension | Score (0-5) | Commentaire |
|-----------|-------------|-------------|
| Collecte événements | 1/5 | Pages vues uniquement |
| Suivi erreurs | 2/5 | Sentry fonctionnel mais sous-configuré |
| Funnels | 0/5 | Aucun funnel instrumenté |
| Satisfaction | 0/5 | Aucune mesure |
| A/B testing | 0/5 | Aucune infrastructure |
| Segmentation | 1/5 | Rôles en base, pas exploités analytiquement |
| Cohortes | 0/5 | Aucun suivi |
| Infrastructure données | 1/5 | Briques isolées, pas de pipeline |

**Score global : 5/40 (12.5%)**

La plateforme vole à l'aveugle sur tous les indicateurs produit et croissance.

---

## 2. Funnel de conversion

Trois funnels distincts ont été identifiés par analyse du code source. Aucun n'est instrumenté.
Les points de drop-off sont estimés sur la base de patterns UX standards, pas sur des données réelles.

### 2.1 Funnel Client (particulier/entreprise)

```
Étape 1: Landing page
    │
    │  [Risque: bounce rate élevé si proposition de valeur floue]
    │  [Aucune mesure du scroll depth ou du temps passé]
    ▼
Étape 2: Recherche artisan (par spécialité, zone, disponibilité)
    │
    │  [Risque: résultats vides dans les zones non couvertes]
    │  [Risque: filtres trop restrictifs sans feedback]
    │  [Pas de tracking des termes de recherche]
    ▼
Étape 3: Consultation profil artisan
    │
    │  [Risque: profil incomplet (pas de photo, peu d'avis)]
    │  [Risque: absence d'indicateurs de confiance visibles]
    │  [Pas de tracking du temps passé sur le profil]
    ▼
Étape 4: Réservation
    │
    │  [Risque: formulaire trop long ou informations manquantes]
    │  [Risque: créneaux horaires limités]
    │  [Point critique: création de compte obligatoire]
    ▼
Étape 5: Confirmation & paiement
    │
    │  [Risque: abandon au paiement (friction Stripe)]
    │  [Stripe webhooks captent le succès/échec mais pas les abandons]
    ▼
Étape 6: Avis post-intervention
    │
    │  [Risque: faible taux de complétion des avis]
    │  [Aucune relance automatique détectée dans le code]
    ▼
Étape 7: Upgrade / Fidélisation
    [Aucun mécanisme de rétention identifié]
    [Pas de programme de fidélité]
```

**Métriques manquantes à chaque étape :**

| Étape | Métrique nécessaire | Existe ? |
|-------|---------------------|----------|
| Landing | Bounce rate, scroll depth, CTA click rate | Non |
| Recherche | Termes recherchés, résultats vides, filtres utilisés | Non |
| Profil | Temps sur page, clic sur "Réserver", clic téléphone | Non |
| Réservation | Taux de complétion formulaire, champs abandonnés | Non |
| Confirmation | Taux de conversion paiement, raisons d'abandon | Non |
| Avis | Taux de soumission, note moyenne, délai post-intervention | Non |
| Upgrade | Taux de retour, fréquence de réservation | Non |

### 2.2 Funnel Artisan

```
Étape 1: Landing page pro (/devenir-artisan ou équivalent)
    │
    │  [Risque: proposition de valeur pas assez différenciée]
    │  [Aucun tracking source d'acquisition]
    ▼
Étape 2: Inscription (SIRET pour FR, NIF pour PT)
    │
    │  [Risque: validation SIRET/NIF bloquante]
    │  [Risque: formulaire multi-étapes avec abandon]
    │  [Point critique: vérification identité professionnelle]
    ▼
Étape 3: Profil complet (assurance, spécialités, zones, photos)
    │
    │  [Risque: profil incomplet = moins de visibilité]
    │  [Risque: upload assurance complexe]
    │  [Champ insurance_verified: boolean, pas de suivi du délai]
    ▼
Étape 4: Première réservation reçue
    │
    │  [Risque: temps d'attente trop long = churn]
    │  [auto_accept: certains artisans configurés, pas de suivi]
    │  [Aucune alerte si pas de réservation après X jours]
    ▼
Étape 5: Premier devis Fixy AI
    │
    │  [Risque: non-découverte de la fonctionnalité]
    │  [Risque: qualité du devis généré insuffisante]
    │  [Langfuse trace l'appel LLM, pas l'adoption utilisateur]
    ▼
Étape 6: Abonnement Pro (49€/mois)
    │
    │  [Risque: valeur perçue insuffisante vs. gratuit]
    │  [Stripe gère le paiement, pas la décision]
    │  [Aucun suivi du parcours décisionnel]
```

**Points de friction estimés (sans données) :**

- Étape 2 vers 3 : drop-off probable de 40-60% (pattern standard formulaires longs)
- Étape 3 vers 4 : dépend du volume de demandes dans la zone
- Étape 5 vers 6 : conversion freemium vers payant, taux inconnu

### 2.3 Funnel Syndic

```
Étape 1: Inscription syndic
    │
    │  [Canal d'acquisition inconnu: organique? commercial? partenariat?]
    │  [Aucun tracking UTM ou source]
    ▼
Étape 2: Ajout du premier immeuble
    │
    │  [Risque: saisie des données immeuble trop lourde]
    │  [Risque: import bulk non disponible]
    ▼
Étape 3: Premier signalement
    │
    │  [Risque: workflow signalement pas intuitif]
    │  [Risque: copropriétaires pas encore onboardés]
    ▼
Étape 4: Première mission assignée à un artisan
    │
    │  [Risque: pas assez d'artisans dans la zone]
    │  [Risque: processus de validation interne complexe]
    ▼
Étape 5: Abonnement (99€ essential / 199€ premium par mois)
    │
    │  [Risque: ROI pas démontré avant la première mission complète]
    │  [Aucun suivi du nombre de missions avant conversion]
```

**Durée estimée du funnel syndic :** 2-8 semaines entre inscription et abonnement (cycle de
décision B2B classique). Cette durée n'est pas mesurée.

### 2.4 Recommandations funnel

Pour chaque funnel, les événements suivants devraient être trackés au minimum :

```typescript
// Événements client
track('search_performed', { query, filters, results_count })
track('artisan_profile_viewed', { artisan_id, source })
track('booking_started', { artisan_id })
track('booking_completed', { booking_id, amount })
track('booking_abandoned', { step, reason })
track('review_submitted', { booking_id, rating })

// Événements artisan
track('artisan_signup_started', { source })
track('artisan_signup_completed', { has_siret, has_nif })
track('artisan_profile_completed', { completeness_pct })
track('first_booking_received', { days_since_signup })
track('fixy_ai_devis_generated', { artisan_id })
track('pro_subscription_started', { plan })

// Événements syndic
track('syndic_signup_completed', { source })
track('building_added', { syndic_id, building_count })
track('signalement_created', { building_id })
track('mission_assigned', { signalement_id, artisan_id })
track('syndic_subscription_started', { plan, tier })
```

---

## 3. Suivi comportemental utilisateurs

### 3.1 État actuel

**Vercel Analytics** est la seule source de données comportementales. Sa couverture :

| Donnée | Disponible | Détail |
|--------|-----------|--------|
| Pages vues | Oui | Agrégées, pas par utilisateur |
| Web Vitals (LCP, FID, CLS) | Oui | Via Vercel Speed Insights |
| Référents | Oui | Source de trafic basique |
| Géolocalisation | Oui | Pays/ville, agrégé |
| Device/navigateur | Oui | Agrégé |
| Événements custom | Non | Pas implémenté |
| Identité utilisateur | Non | Données anonymes uniquement |
| Sessions | Non | Pas de concept de session |

**Consent-gating :** Vercel Analytics est conditionné au consentement utilisateur (conforme RGPD).
Les utilisateurs qui refusent les cookies ne sont pas comptés. Le taux d'opt-in est inconnu.

### 3.2 Données manquantes critiques

**Événements d'interaction :**
- Clics sur les CTAs principaux (réserver, contacter, s'inscrire)
- Interactions avec les formulaires (champs remplis, erreurs, abandons)
- Utilisation des filtres de recherche
- Interactions avec les éléments IA (Fixy, comptable, Max Expert)
- Téléchargements (devis PDF, rapports)

**Métriques de session :**
- Durée de session
- Profondeur de navigation (pages par session)
- Taux de rebond par page
- Parcours de navigation (flow entre pages)
- Temps passé par page

**Métriques d'engagement :**
- Scroll depth sur les pages clés (landing, profils artisans)
- Heatmaps de clics
- Zones mortes (éléments jamais cliqués)
- Rage clicks (indicateur de frustration)
- Dead clicks (clics sur éléments non-interactifs)

### 3.3 Impact de l'absence de tracking

Sans tracking comportemental, les décisions produit reposent sur :
- L'intuition des développeurs
- Les retours informels (emails, bouche-à-oreille)
- Les métriques Stripe (paiements uniquement)
- Les logs Sentry (erreurs uniquement)

Aucune question produit fondamentale ne peut recevoir de réponse chiffrée :
- Quel pourcentage d'utilisateurs utilise la recherche vs. browse direct ?
- Combien de profils artisans un client consulte avant de réserver ?
- Les utilisateurs trouvent-ils les fonctionnalités IA ?
- Quel est le parcours type d'un syndic la première semaine ?

### 3.4 Recommandation

Implémenter un SDK de tracking événementiel côté client. Deux options viables :

| Critère | PostHog (self-hosted) | Mixpanel (SaaS) |
|---------|----------------------|-----------------|
| Coût (10k users/mois) | Gratuit (self-hosted) ou ~0€ (free tier) | Gratuit (free tier 20M events) |
| Session recording | Inclus | Non (nécessite outil tiers) |
| Heatmaps | Inclus | Non |
| Funnels | Inclus | Inclus |
| Cohortes | Inclus | Inclus |
| Feature flags | Inclus | Non |
| RGPD | Self-hosted = contrôle total | Données US (DPA disponible) |
| Intégration Next.js | SDK officiel | SDK officiel |

**Recommandation : PostHog.** Il couvre tracking, session recording, heatmaps, funnels, cohortes
et feature flags en un seul outil. Le self-hosting garantit la conformité RGPD pour les marchés
FR et PT.

---

## 4. Suivi erreurs frontend

### 4.1 Configuration Sentry actuelle

Sentry est intégré avec les paramètres suivants :

| Paramètre | Valeur | Commentaire |
|-----------|--------|-------------|
| `tracesSampleRate` | 0.1 (10%) | 90% des transactions ignorées |
| `replaysSessionSampleRate` | 0 | Session Replay désactivé en session normale |
| `replaysOnErrorSampleRate` | 0 | Session Replay désactivé même en cas d'erreur |
| Tagging AI agents | Oui | Les erreurs des agents IA sont taguées séparément |
| Logger structuré | Oui | Logs formatés avec contexte (userId, action) |

### 4.2 Problèmes identifiés

**Sampling trop bas.** À 10%, les erreurs rares mais critiques (paiement, réservation) peuvent
passer inaperçues pendant des jours. Pour une plateforme en phase de lancement avec un trafic
modéré, un sampling de 50-100% est préférable.

**Session Replay complètement désactivé.** Les deux paramètres de replay sont à 0 :
- `replaysSessionSampleRate: 0` : aucune session enregistrée proactivement
- `replaysOnErrorSampleRate: 0` : même quand une erreur se produit, le replay n'est pas capturé

C'est la fonctionnalité Sentry la plus utile pour comprendre le contexte d'un bug. Son
activation à `replaysOnErrorSampleRate: 1.0` n'a aucun impact sur les performances en
conditions normales (le buffer n'est envoyé qu'en cas d'erreur).

**Pas d'alerting granulaire.** Les alertes Sentry ne sont pas configurées par :
- Criticité (erreur paiement vs. erreur UI cosmétique)
- Volume (spike d'erreurs vs. erreur ponctuelle)
- Segment utilisateur (syndic premium vs. client free)

### 4.3 Erreurs non captées

| Type d'erreur | Capté par Sentry ? | Solution |
|---------------|-------------------|----------|
| Exception JavaScript | Oui (10%) | Augmenter sampling |
| Erreur réseau (API timeout) | Partiellement | Ajouter breadcrumbs réseau |
| Erreur silencieuse (catch vide) | Non | Audit des catch blocks |
| Frustration UX (rage click) | Non | Session recording |
| Dégradation performance | Non | Sentry Performance ou Web Vitals alerting |
| Erreur formulaire (validation) | Non | Tracking événements formulaire |

### 4.4 Recommandations

1. **Immédiat :** Passer `replaysOnErrorSampleRate` à `1.0`. Coût negligible, valeur diagnostique
   maximale.

2. **Immédiat :** Augmenter `tracesSampleRate` à `0.5` minimum pendant la phase de lancement.
   Réduire à `0.1` quand le trafic dépasse 100k transactions/mois.

3. **Court terme :** Configurer des alertes Sentry par criticité :
   - P0 (Slack immédiat) : erreurs paiement, authentification, réservation
   - P1 (digest quotidien) : erreurs API, erreurs formulaire
   - P2 (digest hebdomadaire) : erreurs UI, warnings

4. **Court terme :** Auditer tous les blocs `catch` du codebase pour éliminer les erreurs
   silencieuses. Chaque catch devrait soit logger via le logger structuré, soit remonter à Sentry.

---

## 5. Usage des fonctionnalités

### 5.1 Méthodologie

En l'absence de tracking événementiel, l'adoption des fonctionnalités est déduite des champs
booléens et des compteurs en base de données. Cette approche donne une vue binaire (utilisé/pas
utilisé) sans granularité sur la fréquence, la récence ou la profondeur d'usage.

### 5.2 Fonctionnalités Artisan

| Fonctionnalité | Indicateur en base | Type | Limite de l'indicateur |
|----------------|-------------------|------|----------------------|
| Auto-accept réservations | `auto_accept` (boolean) | Configuration | On/off, pas de suivi du taux d'acceptation réel |
| Rayon d'intervention | `zone_radius_km` (number) | Configuration | Valeur statique, pas de suivi des modifications |
| Assurance vérifiée | `insurance_verified` (boolean) | Validation | Date de vérification absente, expiration non suivie |
| Fixy AI (devis) | Langfuse traces | Usage IA | Nombre d'appels LLM, pas d'adoption par artisan |
| Devis PDF | Aucun | Fonctionnalité | Aucun compteur de génération |
| Comptable AI | Langfuse traces | Usage IA | Traces LLM uniquement |
| Rapport IA | Langfuse traces | Usage IA | Traces LLM uniquement |

**Constats :**
- Fixy AI, comptable AI et rapport IA sont tracés côté LLM (Langfuse) mais pas côté utilisateur.
  On sait combien de tokens sont consommés, pas combien d'artisans utilisent ces outils ni à
  quelle fréquence.
- La génération de devis PDF n'a aucun tracking. Impossible de savoir si cette fonctionnalité est
  adoptée.
- `auto_accept` et `zone_radius_km` sont des configurations statiques. Aucun historique des
  modifications n'est conservé.

### 5.3 Fonctionnalités Client

| Fonctionnalité | Indicateur en base | Type | Limite de l'indicateur |
|----------------|-------------------|------|----------------------|
| Réservations | `bookings` count | Transaction | Nombre total, pas de fréquence ni récence |
| Avis | `reviews` count | Contenu | Taux de soumission post-réservation inconnu |
| Favoris | `favoris` (relation) | Engagement | Existence de la relation, pas d'usage |
| Simulateur travaux | Aucun | Fonctionnalité | Aucun tracking |

**Constats :**
- Le nombre de réservations par client est calculable via jointure mais pas exposé dans un
  dashboard analytics.
- Le taux de conversion réservation vers avis est inconnu.
- Le simulateur de travaux n'a aucun indicateur d'adoption. On ne sait pas combien de clients
  l'ont essayé ni s'ils ont trouvé le résultat utile.

### 5.4 Fonctionnalités Syndic

| Fonctionnalité | Indicateur en base | Type | Limite de l'indicateur |
|----------------|-------------------|------|----------------------|
| Immeubles gérés | `buildings` count | Configuration | Nombre total uniquement |
| Signalements vers missions | `signalements` → `missions` | Workflow | Taux de conversion calculable mais pas instrumenté |
| Membres d'équipe | `team_members` count | Configuration | Pas de suivi d'activité par membre |
| Assemblées générales | `assemblees` count | Fonctionnalité | Pas de suivi de participation |
| Max Expert AI | Langfuse traces | Usage IA | Traces LLM, pas d'adoption syndic |

**Constats :**
- Le workflow signalement vers mission est le coeur de la valeur syndic. Son taux de conversion et
  ses délais ne sont pas mesurés.
- Les assemblées générales sont une fonctionnalité différenciante. Aucune métrique d'adoption ou
  de satisfaction n'existe.
- Max Expert AI, l'assistant IA syndic, est tracé dans Langfuse pour le monitoring LLM mais pas
  pour mesurer l'adoption par les gestionnaires.

### 5.5 Matrice adoption par fonctionnalité

```
                    Tracking     Adoption    Fréquence    Satisfaction
                    existant     mesurable   mesurable    mesurable
Fixy AI             Langfuse     Non         Non          Non
Comptable AI        Langfuse     Non         Non          Non
Max Expert AI       Langfuse     Non         Non          Non
Devis PDF           Rien         Non         Non          Non
Simulateur          Rien         Non         Non          Non
Auto-accept         Boolean      Oui/Non     Non          Non
Réservations        Count        Oui         Partiellement Non
Avis                Count        Oui         Non          Non
Signalements        Count        Oui         Non          Non
Assemblées          Count        Oui         Non          Non
```

Aucune fonctionnalité n'atteint le niveau "fréquence mesurable" ou "satisfaction mesurable".

---

## 6. Perception de performance

### 6.1 Monitoring existant

**Vercel Speed Insights :** collecte les Core Web Vitals en conditions réelles (RUM) :
- LCP (Largest Contentful Paint)
- FID (First Input Delay) / INP (Interaction to Next Paint)
- CLS (Cumulative Layout Shift)

**Lighthouse CI :** tests automatisés en CI avec les seuils suivants :

| Catégorie | Seuil minimum | Commentaire |
|-----------|---------------|-------------|
| Performance | 80 | Acceptable pour le lancement |
| Accessibilité | 90 | Bon seuil |
| SEO | 90 | Bon seuil |
| Bonnes pratiques | 85 | Acceptable |

### 6.2 Problèmes identifiés

**7 polices bloquant le rendu.** Identifié dans l'audit Phase 10, 7 fichiers de polices sont
chargés de manière bloquante. Impact direct sur le LCP et le FCP (First Contentful Paint).
Le lazy loading de polices non critiques réduirait le temps de blocage de 200-500ms estimé.

**Loading states.** Des indicateurs de chargement sont présents dans les dashboards (artisan,
syndic, client). Leur présence indique que les développeurs ont anticipé des temps de chargement
perceptibles, mais leur fréquence d'apparition et leur durée ne sont pas mesurées.

**Pas de budget performance.** Les seuils Lighthouse CI sont des minimums, pas des budgets.
Aucune alerte n'est déclenchée si le score passe de 95 à 82 (toujours au-dessus du seuil).
Un budget performance détecterait les régressions progressives.

### 6.3 Métriques de performance perçue manquantes

| Métrique | Description | Collectée ? |
|----------|-------------|-------------|
| Time to Interactive | Temps avant que la page soit utilisable | Via Lighthouse CI uniquement |
| First Contentful Paint | Premier élément visible | Via Speed Insights |
| Largest Contentful Paint | Élément principal visible | Via Speed Insights |
| Cumulative Layout Shift | Stabilité visuelle | Via Speed Insights |
| Time to First Byte | Réponse serveur | Non mesuré côté client |
| API response times | Latence des appels API | Sentry (10% sampling) |
| Skeleton/spinner duration | Durée perçue des chargements | Non mesuré |
| Image load time | Chargement des images artisans | Non mesuré |

### 6.4 Recommandations

1. Corriger les 7 polices bloquantes (gain LCP estimé 200-500ms).
2. Implémenter un budget performance en CI : alerte si un score baisse de plus de 5 points entre
   deux builds.
3. Ajouter des métriques custom pour la durée des spinners et skeletons.
4. Monitorer les API response times côté client (pas seulement côté serveur).

---

## 7. Satisfaction utilisateur

### 7.1 État actuel

**Aucun mécanisme de mesure de satisfaction n'est en place.**

| Mécanisme | Implémenté ? | Commentaire |
|-----------|-------------|-------------|
| NPS (Net Promoter Score) | Non | Aucune enquête périodique |
| CSAT (Customer Satisfaction Score) | Non | Aucun sondage post-interaction |
| CES (Customer Effort Score) | Non | Aucune mesure de l'effort utilisateur |
| Widget feedback in-app | Non | Pas de bouton "feedback" visible |
| Enquête de sortie (churn) | Non | Aucune question quand un utilisateur se désabonne |
| Enquête onboarding | Non | Aucune question après l'inscription |
| Suivi tickets support | Non | Pas de système de ticketing intégré |
| Avis sur stores | N/A | Pas d'application mobile |
| Reviews externes | Non suivi | Pas de monitoring Trustpilot/Google Reviews |

### 7.2 Données de satisfaction indirectes

Certains signaux de satisfaction existent en base mais ne sont pas exploités :

- **Avis clients sur artisans :** les notes (1-5 étoiles) et commentaires existent pour les
  réservations complétées. Ils mesurent la satisfaction vis-à-vis de l'artisan, pas de la
  plateforme.
- **Taux de rebond :** disponible via Vercel Analytics, non analysé.
- **Churn :** les désabonnements Stripe sont loggés mais pas corrélés à un feedback.

### 7.3 Recommandations par priorité

**Priorité haute (sprint suivant) :**
- NPS in-app : enquête 1 question déclenchée après la 3e réservation (client) ou après 30 jours
  (artisan/syndic). Un simple score 0-10 avec un champ texte optionnel.
- Widget feedback flottant : bouton persistant "Un problème ?" lié à un formulaire minimal
  (catégorie + texte libre).

**Priorité moyenne (prochain trimestre) :**
- Enquête de sortie churn : quand un artisan/syndic annule son abonnement, afficher un
  questionnaire à choix multiples (prix, fonctionnalités manquantes, concurrent, autre).
- CSAT post-réservation : après chaque réservation complétée, demander "Cette réservation s'est-
  elle bien passée ?" (pouce haut/bas).

**Priorité basse (6 mois) :**
- CES sur les parcours critiques : mesurer l'effort perçu pour les tâches complexes (inscription
  artisan, ajout immeuble syndic).
- Monitoring avis externes : Google Business Profile, éventuels avis Trustpilot.

---

## 8. Infrastructure A/B testing

### 8.1 État actuel

**Aucune infrastructure d'A/B testing n'existe.**

| Composant | Présent ? |
|-----------|-----------|
| Feature flags | Non |
| Framework d'expérimentation | Non |
| Allocation utilisateur (bucketing) | Non |
| Calcul de significativité statistique | Non |
| Rollout progressif | Non |
| Kill switch | Non |
| Historique des expérimentations | Non |

### 8.2 Impact

Sans A/B testing, chaque changement produit est un pari non validé :
- Les modifications de la landing page sont déployées sans mesure d'impact sur la conversion.
- Les changements de pricing ne sont pas testés sur un sous-ensemble d'utilisateurs.
- Les nouvelles fonctionnalités sont activées pour 100% des utilisateurs simultanément.
- Les régressions UX ne sont détectées que via feedback informel (si elles le sont).

### 8.3 Cas d'usage prioritaires pour l'A/B testing

| Expérimentation | Impact potentiel | Complexité |
|-----------------|-----------------|------------|
| Variantes landing page (CTA, copy, layout) | Conversion +10-30% | Faible |
| Ordre des résultats recherche artisan | Réservation +5-15% | Faible |
| Onboarding simplifié artisan (moins d'étapes) | Complétion +20-40% | Moyenne |
| Pricing page (présentation des plans) | Conversion payant +5-20% | Faible |
| Prompt Fixy AI (qualité devis) | Satisfaction artisan | Moyenne |
| Flow réservation (2 étapes vs. 3) | Conversion +10-25% | Moyenne |

### 8.4 Recommandations

**Option 1 : PostHog Feature Flags (recommandé si PostHog est adopté pour le tracking)**
- Intégré au même SDK que le tracking événementiel
- Feature flags, rollout progressif, expérimentations
- Pas de coût additionnel si self-hosted

**Option 2 : Statsig**
- Spécialisé A/B testing et feature flags
- Free tier généreux (500M events/mois)
- SDK Next.js officiel avec SSR support

**Option 3 : Implémentation custom (non recommandé)**
- Feature flags via base de données ou edge config Vercel
- Pas de calcul de significativité automatique
- Maintenance et dette technique

---

## 9. Segmentation

### 9.1 Segments par rôle

7 rôles utilisateur identifiés dans le système d'authentification :

| Rôle | Description | Marché cible |
|------|-------------|-------------|
| `client` | Particulier cherchant un artisan | FR, PT, EN |
| `artisan` | Artisan individuel | FR, PT |
| `pro_societe` | Société de services (multi-employés) | FR, PT |
| `pro_conciergerie` | Service de conciergerie | FR, PT |
| `pro_gestionnaire` | Gestionnaire de biens | FR, PT |
| `syndic` | Syndic de copropriété | FR |
| `copropriétaire` | Résident de copropriété | FR |

**Exploitation analytique actuelle : nulle.** Les rôles sont utilisés pour le routage applicatif
(dashboards différents, permissions) mais pas pour segmenter les métriques analytics. Vercel
Analytics ne sait pas quel rôle visite quelle page.

### 9.2 Segments par marché

3 marchés géographiques et linguistiques :

| Marché | Langue | Zone | Monnaie | Spécificités |
|--------|--------|------|---------|-------------|
| FR | Français | Marseille / PACA | EUR | SIRET obligatoire, assurance décennale |
| PT | Portugais | Porto / Tâmega e Sousa | EUR | NIF obligatoire, régime fiscal PT |
| EN | Anglais | Porto (expats) | EUR | Interface EN, artisans PT |

**Exploitation analytique actuelle : nulle.** Le marché de l'utilisateur est stocké en base
(locale, timezone, adresse) mais aucune segmentation analytics n'est en place. Impossible de
comparer :
- Taux de conversion FR vs. PT
- Coût d'acquisition par marché
- Adoption des fonctionnalités par marché
- Churn par marché

### 9.3 Segments par abonnement

4 tiers d'abonnement gérés via Stripe :

| Tier | Prix | Cible | Fonctionnalités clés |
|------|------|-------|---------------------|
| Starter (gratuit) | 0€ | Artisans débutants | Profil, réservations limitées |
| Pro | 49€/mois | Artisans établis | Fixy AI, devis PDF, comptable AI, rapport IA |
| Syndic Essential | 99€/mois | Petits syndics | Max Expert AI, signalements, missions |
| Syndic Premium | 199€/mois | Grands syndics | Assemblées, multi-team, reporting avancé |

**Exploitation analytique actuelle : partielle via Stripe.** Stripe fournit le MRR, le churn rate
et les métriques de paiement par plan. Mais ces données ne sont pas corrélées avec l'usage
produit. Questions sans réponse :
- Les artisans Pro utilisent-ils réellement Fixy AI ?
- Quel pourcentage des fonctionnalités premium est utilisé par chaque tier ?
- Le tier Syndic Premium justifie-t-il son prix par un usage différencié ?

### 9.4 Segments par type de client

2 types de clients identifiés :

| Type | Description | Volume estimé |
|------|-------------|--------------|
| Particulier | Personne physique, besoin ponctuel | Majorité du trafic |
| Entreprise | Personne morale, besoins récurrents | Volume inconnu |

**Exploitation analytique actuelle : nulle.** Le type est un champ en base mais pas une dimension
d'analyse.

### 9.5 Segmentation croisée recommandée

Les dimensions de segmentation devraient être croisées dans l'outil analytics :

```
Rôle x Marché x Abonnement x Ancienneté

Exemples de segments à monitorer :
- Artisans Pro FR inscrits depuis > 6 mois (power users)
- Clients PT n'ayant fait qu'une réservation (rétention)
- Syndics Premium avec < 3 missions/mois (churn risk)
- Artisans gratuits FR avec > 5 réservations (upsell candidates)
```

---

## 10. Analyse de cohortes

### 10.1 État actuel

**Aucune analyse de cohortes n'est en place.**

Les données nécessaires existent en base :
- `profiles.created_at` : date d'inscription de chaque utilisateur
- `bookings.created_at` : date de chaque réservation
- `subscriptions.created_at` : date de début d'abonnement
- `reviews.created_at` : date de chaque avis

Ces timestamps permettraient de construire des cohortes d'inscription et de mesurer la rétention,
mais aucun outil ni requête ne le fait aujourd'hui.

### 10.2 Cohortes à implémenter

**Cohorte d'inscription client :**
```
Semaine d'inscription → % ayant fait 1 réservation à S+1, S+2, S+4, S+8, S+12
```
Objectif : mesurer le time-to-first-value et la rétention client.

**Cohorte d'inscription artisan :**
```
Semaine d'inscription → % ayant un profil complet à S+1
                      → % ayant reçu 1 réservation à S+2
                      → % ayant utilisé Fixy AI à S+4
                      → % converti en Pro à S+8
```
Objectif : mesurer l'activation et la conversion freemium.

**Cohorte d'abonnement :**
```
Mois de premier abonnement → % encore abonné à M+1, M+3, M+6, M+12
```
Objectif : mesurer le churn par cohorte et identifier les périodes critiques.

**Cohorte par source d'acquisition :**
```
Source (organique, payant, referral) x Mois → conversion, rétention, LTV
```
Objectif : allouer le budget marketing aux canaux rentables.
(Nécessite le tracking UTM, non implémenté.)

### 10.3 Implémentation

Deux approches possibles :

**Approche 1 : Requêtes SQL directes (court terme)**
Écrire des requêtes Supabase/PostgreSQL qui agrègent les cohortes à partir des timestamps
existants. Avantage : pas de nouvel outil. Inconvénient : pas de visualisation, maintenance
manuelle.

**Approche 2 : Outil analytics dédié (moyen terme)**
PostHog, Mixpanel ou Amplitude construisent les cohortes automatiquement à partir des événements
trackés. Avantage : visualisation, alertes automatiques, comparaison entre cohortes. Inconvénient :
nécessite le tracking événementiel (section 3).

**Recommandation :** Commencer par 2-3 requêtes SQL de cohortes basiques pour avoir des données
immédiates, puis migrer vers un outil dédié quand le tracking événementiel est en place.

---

## 11. Infrastructure données

### 11.1 Stack actuelle

```
┌─────────────────────────────────────────────────────┐
│                   Sources de données                 │
├──────────────┬──────────────┬───────────────────────┤
│ Vercel       │ Sentry       │ Supabase              │
│ Analytics    │              │                       │
│              │              │                       │
│ - Page views │ - Errors     │ - audit_logs (RGPD)   │
│ - Web Vitals │ - 10% traces │ - profiles            │
│ - Referrers  │ - AI tags    │ - bookings            │
│              │              │ - subscriptions       │
├──────────────┼──────────────┼───────────────────────┤
│ Langfuse     │ Upstash      │ Stripe                │
│              │              │                       │
│ - LLM traces │ - Rate limit │ - Payments            │
│ - Token usage│   counters   │ - Subscriptions       │
│ - Latency    │              │ - Webhooks (7j dedup) │
└──────────────┴──────────────┴───────────────────────┘
```

### 11.2 Isolation des données

Chaque brique fonctionne en silo :

| Source | Dashboard | API | Export | Alertes |
|--------|-----------|-----|--------|---------|
| Vercel Analytics | Vercel UI | Non | Non | Non |
| Sentry | Sentry UI | Oui | Oui | Slack/email |
| Langfuse | Langfuse UI | Oui | Oui | Limitées |
| Upstash | Upstash Console | Oui | Non | Oui |
| Stripe | Stripe Dashboard | Oui | Oui | Webhooks |
| audit_logs | Aucun | Supabase API | SQL | Non |

**Problème principal :** aucune corrélation entre les sources. Impossible de répondre à des
questions transversales comme :
- "Les utilisateurs qui rencontrent des erreurs Sentry ont-ils un taux de conversion plus bas ?"
- "Les artisans qui utilisent Fixy AI (Langfuse) ont-ils plus de réservations (Supabase) ?"
- "Les utilisateurs avec un LCP > 3s (Vercel) convertissent-ils moins (Stripe) ?"

### 11.3 Table audit_logs

La table `audit_logs` remplit l'obligation RGPD Art. 30 (registre des activités de traitement) :

| Champ | Description |
|-------|-------------|
| `id` | UUID |
| `user_id` | Référence utilisateur |
| `action` | Type d'action (login, update_profile, delete_data, etc.) |
| `resource_type` | Type de ressource concernée |
| `resource_id` | ID de la ressource |
| `metadata` | JSON avec détails de l'action |
| `ip_address` | IP de l'utilisateur |
| `created_at` | Timestamp |

**Rétention :** 1 an (conforme RGPD, suffisant pour les besoins légaux).

Cette table pourrait servir de source de données analytics de base (elle contient les actions
utilisateur), mais elle n'est pas conçue pour ça : pas d'index analytics, pas de champs
d'enrichissement (device, session, etc.), pas de requêtes optimisées pour l'agrégation.

### 11.4 Stripe Webhooks

Les webhooks Stripe sont configurés avec une déduplication de 7 jours. Événements captés :

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Ces événements sont traités par les API routes Next.js et stockés dans Supabase. Ils constituent
la source de données la plus fiable pour les métriques de conversion payante.

### 11.5 Manques infrastructure

| Composant | Statut | Impact |
|-----------|--------|--------|
| Event pipeline (collecte centralisée) | Absent | Données dispersées, pas corrélables |
| Data warehouse | Absent | Pas d'agrégation cross-source |
| ETL/ELT | Absent | Pas de transformation des données brutes |
| Dashboard unifié | Absent | Chaque source a son propre UI |
| Alertes business | Absent | Pas d'alerte sur les métriques produit |
| Data retention policy | Partiel | audit_logs = 1 an, reste = par défaut |

### 11.6 Architecture cible recommandée

```
┌──────────────────────────────────────────────────────────────┐
│                     Collecte événements                       │
│                                                              │
│  PostHog SDK (client)     Stripe Webhooks     Sentry SDK     │
│         │                       │                  │         │
│         ▼                       ▼                  ▼         │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              PostHog (self-hosted)                    │     │
│  │                                                     │     │
│  │  - Événements custom    - Funnels                   │     │
│  │  - Session recording    - Cohortes                  │     │
│  │  - Feature flags        - A/B testing               │     │
│  │  - Heatmaps             - Alertes                   │     │
│  └─────────────────────────────────────────────────────┘     │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              PostgreSQL (PostHog)                     │     │
│  │              + Supabase (app data)                    │     │
│  │                                                     │     │
│  │  Requêtes SQL cross-source pour les métriques       │     │
│  │  business avancées                                   │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  Conservés en parallèle :                                    │
│  - Vercel Analytics (Web Vitals, gratuit)                    │
│  - Sentry (erreurs, replay activé)                           │
│  - Langfuse (traces LLM spécialisées)                        │
│  - audit_logs (conformité RGPD)                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 12. Plan d'action priorisé

### Phase 1 : Fondations (Semaines 1-2)

**Objectif :** Avoir une visibilité minimale sur le comportement utilisateur et les erreurs.

| Action | Effort | Impact | Responsable |
|--------|--------|--------|-------------|
| Activer Sentry Session Replay (`replaysOnErrorSampleRate: 1.0`) | 1h | Diagnostics erreurs x10 | Frontend |
| Augmenter Sentry `tracesSampleRate` à 0.5 | 30min | Couverture erreurs x5 | Frontend |
| Implémenter une librairie de tracking événementiel (PostHog SDK ou wrapper custom) | 2-3 jours | Fondation pour tout le reste | Frontend |
| Tracker les 10 événements les plus critiques (voir liste ci-dessous) | 2 jours | Visibilité funnels basique | Frontend + Backend |
| Configurer les alertes Sentry P0 (paiement, auth, réservation) | 2h | Réduction MTTR | Ops |

**10 événements prioritaires à tracker :**

1. `signup_completed` (rôle, marché, source)
2. `login` (méthode, device)
3. `search_performed` (termes, filtres, nombre de résultats)
4. `artisan_profile_viewed` (artisan_id, source)
5. `booking_started` (artisan_id, montant estimé)
6. `booking_completed` (booking_id, montant, méthode paiement)
7. `booking_abandoned` (étape d'abandon, raison si connue)
8. `ai_feature_used` (feature: fixy/comptable/max_expert, rôle)
9. `subscription_started` (tier, montant)
10. `profile_completed` (rôle, pourcentage de complétion)

### Phase 2 : Funnels et satisfaction (Sprint suivant, semaines 3-6)

**Objectif :** Mesurer les funnels de conversion et la satisfaction utilisateur.

| Action | Effort | Impact | Responsable |
|--------|--------|--------|-------------|
| Configurer les 3 funnels dans PostHog/Mixpanel | 1-2 jours | Visibilité drop-off | Product |
| Implémenter le tracking de cohortes | 1 jour | Rétention mesurable | Product |
| Ajouter un widget NPS in-app | 2-3 jours | Satisfaction mesurable | Frontend |
| Implémenter le tracking d'onboarding (% complétion par étape) | 2 jours | Activation mesurable | Frontend |
| Écrire 3 requêtes SQL de cohortes basiques | 1 jour | Données rétention immédiates | Backend |
| Tracker les événements IA (adoption, pas juste appels LLM) | 1-2 jours | Usage fonctionnalités IA | Frontend |
| Ajouter le tracking UTM pour les sources d'acquisition | 1 jour | ROI marketing mesurable | Marketing |

### Phase 3 : Expérimentation et analyse avancée (Trimestre suivant)

**Objectif :** Optimiser les parcours via l'expérimentation et la segmentation avancée.

| Action | Effort | Impact | Responsable |
|--------|--------|--------|-------------|
| Déployer PostHog Feature Flags ou Statsig | 3-5 jours | A/B testing opérationnel | Frontend + Backend |
| Activer PostHog Session Recording (ou alternative) | 1 jour | Compréhension UX qualitative | Frontend |
| Première expérimentation A/B (variante landing page) | 1 semaine | Validation de la méthodo | Product |
| Implémenter la segmentation croisée (rôle x marché x tier) | 2-3 jours | Analyse granulaire | Product |
| Dashboard unifié (PostHog + Stripe + données Supabase) | 1 semaine | Vue business consolidée | Backend |
| Enquête de sortie churn (artisans/syndics qui se désabonnent) | 2 jours | Compréhension churn | Product |
| CSAT post-réservation | 1-2 jours | Satisfaction transactionnelle | Frontend |
| Heatmaps sur les 5 pages les plus visitées | 1 jour (si PostHog) | Optimisation UI | Product |
| Budget performance en CI (alerte sur régression) | 1 jour | Prévention dégradation | Ops |

### Phase 4 : Maturité (6 mois et au-delà)

| Action | Effort | Impact |
|--------|--------|--------|
| CES sur les parcours critiques | 2 jours | Réduction friction |
| Modèle prédictif de churn | 1-2 semaines | Rétention proactive |
| Alertes automatiques sur anomalies métriques | 1 semaine | Détection incidents business |
| Pipeline ETL Supabase vers data warehouse | 2 semaines | Analyse cross-source avancée |
| Monitoring NPS continu avec segmentation | 1 semaine | Satisfaction par segment |

### Estimation coût

| Outil | Coût estimé | Commentaire |
|-------|-------------|-------------|
| PostHog self-hosted | 0€ (infra existante) | Nécessite un VPS dédié (~20-50€/mois) |
| PostHog Cloud | 0€ (free tier 1M events) | Suffisant pour le lancement |
| Sentry (plan actuel) | Inchangé | Session Replay inclus dans le plan |
| Statsig (si choisi) | 0€ (free tier) | Alternative à PostHog pour A/B uniquement |

**Coût humain estimé Phase 1 :** 1 développeur frontend, 1 semaine.
**Coût humain estimé Phases 1-3 :** 1 développeur frontend + 1 product, ~6 semaines cumulées.

---

## Annexe A : Glossaire

| Terme | Définition |
|-------|------------|
| LCP | Largest Contentful Paint. Temps de chargement du plus grand élément visible. |
| CLS | Cumulative Layout Shift. Mesure de la stabilité visuelle. |
| INP | Interaction to Next Paint. Réactivité aux interactions utilisateur. |
| NPS | Net Promoter Score. Mesure de la propension à recommander (0-10). |
| CSAT | Customer Satisfaction Score. Mesure de satisfaction post-interaction. |
| CES | Customer Effort Score. Mesure de l'effort perçu pour accomplir une tâche. |
| MRR | Monthly Recurring Revenue. Revenu mensuel récurrent. |
| LTV | Lifetime Value. Valeur totale d'un client sur sa durée de vie. |
| MTTR | Mean Time To Resolution. Temps moyen de résolution d'un incident. |
| RUM | Real User Monitoring. Mesure de performance en conditions réelles. |
| UTM | Urchin Tracking Module. Paramètres URL pour le suivi des sources de trafic. |

## Annexe B : Événements recommandés (schéma complet)

```typescript
// ---- Événements d'acquisition ----
interface SignupCompleted {
  event: 'signup_completed'
  properties: {
    role: 'client' | 'artisan' | 'syndic' | 'copropriétaire'
    market: 'FR' | 'PT' | 'EN'
    source: string        // utm_source ou 'organic'
    method: 'email' | 'google' | 'apple'
  }
}

interface LoginEvent {
  event: 'login'
  properties: {
    method: 'email' | 'google' | 'apple'
    device: 'mobile' | 'tablet' | 'desktop'
  }
}

// ---- Événements de recherche ----
interface SearchPerformed {
  event: 'search_performed'
  properties: {
    query: string
    filters: Record<string, string>
    results_count: number
    market: 'FR' | 'PT' | 'EN'
  }
}

interface ArtisanProfileViewed {
  event: 'artisan_profile_viewed'
  properties: {
    artisan_id: string
    source: 'search' | 'favorites' | 'direct' | 'recommendation'
    has_reviews: boolean
    review_count: number
    rating_avg: number
  }
}

// ---- Événements de réservation ----
interface BookingStarted {
  event: 'booking_started'
  properties: {
    artisan_id: string
    category: string
    estimated_amount: number
  }
}

interface BookingCompleted {
  event: 'booking_completed'
  properties: {
    booking_id: string
    artisan_id: string
    amount: number
    payment_method: string
    time_to_complete_seconds: number
  }
}

interface BookingAbandoned {
  event: 'booking_abandoned'
  properties: {
    step: 'details' | 'datetime' | 'payment' | 'confirmation'
    artisan_id: string
    time_spent_seconds: number
  }
}

// ---- Événements IA ----
interface AIFeatureUsed {
  event: 'ai_feature_used'
  properties: {
    feature: 'fixy_devis' | 'comptable_ai' | 'max_expert' | 'rapport_ia' | 'simulateur'
    role: string
    market: 'FR' | 'PT' | 'EN'
    success: boolean
    latency_ms: number
  }
}

// ---- Événements abonnement ----
interface SubscriptionStarted {
  event: 'subscription_started'
  properties: {
    tier: 'pro' | 'syndic_essential' | 'syndic_premium'
    amount_monthly: number
    trial: boolean
    days_since_signup: number
  }
}

interface SubscriptionCancelled {
  event: 'subscription_cancelled'
  properties: {
    tier: string
    months_subscribed: number
    reason: string | null
  }
}

// ---- Événements onboarding ----
interface OnboardingStepCompleted {
  event: 'onboarding_step_completed'
  properties: {
    role: string
    step: string
    step_number: number
    total_steps: number
    time_spent_seconds: number
  }
}

interface ProfileCompleted {
  event: 'profile_completed'
  properties: {
    role: string
    completeness_percent: number
    missing_fields: string[]
  }
}

// ---- Événements syndic ----
interface BuildingAdded {
  event: 'building_added'
  properties: {
    syndic_id: string
    building_count: number
    units_count: number
  }
}

interface SignalementCreated {
  event: 'signalement_created'
  properties: {
    building_id: string
    category: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    source: 'syndic' | 'copropriétaire'
  }
}

interface MissionAssigned {
  event: 'mission_assigned'
  properties: {
    signalement_id: string
    artisan_id: string
    days_since_signalement: number
  }
}

// ---- Événements satisfaction ----
interface NPSSubmitted {
  event: 'nps_submitted'
  properties: {
    score: number           // 0-10
    role: string
    market: string
    comment: string | null
    months_since_signup: number
  }
}

interface ReviewSubmitted {
  event: 'review_submitted'
  properties: {
    booking_id: string
    rating: number          // 1-5
    has_comment: boolean
    days_since_booking: number
  }
}
```

## Annexe C : Requêtes SQL de cohortes (exemples)

### Cohorte d'inscription client (rétention hebdomadaire)

```sql
WITH cohorts AS (
  SELECT
    id AS user_id,
    DATE_TRUNC('week', created_at) AS cohort_week
  FROM profiles
  WHERE role = 'client'
),
activity AS (
  SELECT
    user_id,
    DATE_TRUNC('week', created_at) AS activity_week
  FROM bookings
)
SELECT
  c.cohort_week,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT CASE
    WHEN a.activity_week = c.cohort_week + INTERVAL '1 week'
    THEN c.user_id END) AS retained_w1,
  COUNT(DISTINCT CASE
    WHEN a.activity_week = c.cohort_week + INTERVAL '2 weeks'
    THEN c.user_id END) AS retained_w2,
  COUNT(DISTINCT CASE
    WHEN a.activity_week = c.cohort_week + INTERVAL '4 weeks'
    THEN c.user_id END) AS retained_w4
FROM cohorts c
LEFT JOIN activity a ON c.user_id = a.user_id
GROUP BY c.cohort_week
ORDER BY c.cohort_week;
```

### Cohorte d'activation artisan (time-to-first-booking)

```sql
WITH artisan_signup AS (
  SELECT
    id AS artisan_id,
    created_at AS signup_date,
    DATE_TRUNC('week', created_at) AS cohort_week
  FROM profiles
  WHERE role = 'artisan'
),
first_booking AS (
  SELECT
    artisan_id,
    MIN(created_at) AS first_booking_date
  FROM bookings
  GROUP BY artisan_id
)
SELECT
  a.cohort_week,
  COUNT(*) AS cohort_size,
  COUNT(fb.artisan_id) AS activated,
  ROUND(100.0 * COUNT(fb.artisan_id) / COUNT(*), 1) AS activation_rate_pct,
  AVG(EXTRACT(DAY FROM fb.first_booking_date - a.signup_date))
    AS avg_days_to_first_booking
FROM artisan_signup a
LEFT JOIN first_booking fb ON a.artisan_id = fb.artisan_id
GROUP BY a.cohort_week
ORDER BY a.cohort_week;
```

### Cohorte churn abonnement (rétention mensuelle)

```sql
WITH sub_cohorts AS (
  SELECT
    user_id,
    DATE_TRUNC('month', created_at) AS cohort_month,
    tier
  FROM subscriptions
  WHERE status = 'active'
),
sub_status AS (
  SELECT
    user_id,
    DATE_TRUNC('month', period_end) AS active_month
  FROM subscriptions
  WHERE status IN ('active', 'past_due')
)
SELECT
  sc.cohort_month,
  sc.tier,
  COUNT(DISTINCT sc.user_id) AS cohort_size,
  COUNT(DISTINCT CASE
    WHEN ss.active_month = sc.cohort_month + INTERVAL '1 month'
    THEN sc.user_id END) AS retained_m1,
  COUNT(DISTINCT CASE
    WHEN ss.active_month = sc.cohort_month + INTERVAL '3 months'
    THEN sc.user_id END) AS retained_m3,
  COUNT(DISTINCT CASE
    WHEN ss.active_month = sc.cohort_month + INTERVAL '6 months'
    THEN sc.user_id END) AS retained_m6
FROM sub_cohorts sc
LEFT JOIN sub_status ss ON sc.user_id = ss.user_id
GROUP BY sc.cohort_month, sc.tier
ORDER BY sc.cohort_month, sc.tier;
```
