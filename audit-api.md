# Audit API — Vitfix.io

> Date : 12 avril 2026
> Périmètre : 143 endpoints dans `app/api/`, middleware (`proxy.ts`), libs support (`lib/rate-limit.ts`, `lib/validation.ts`, `lib/auth-helpers.ts`, `lib/sanitize.ts`, `lib/circuit-breaker.ts`, `lib/audit.ts`, `lib/logger.ts`), config (`next.config.ts`)
> Mode : read-only, aucune modification

---

## Cartographie du périmètre audité

### Surface API : 143 routes

| Catégorie | Routes | Méthodes principales |
|-----------|--------|---------------------|
| Syndic (gestion copropriété) | 28 | GET, POST, PATCH |
| Artisan/Pro | 14 | GET, POST, PATCH |
| Marketplace/marchés | 13 | GET, POST, PUT, DELETE |
| AI/LLM (agents IA) | 11 | POST |
| Documents/PDF | 11 | GET, POST |
| Admin | 8 | GET, POST, PATCH |
| Email agent | 7 | GET, POST |
| Sync (données externes) | 6 | GET, POST |
| Vérification (TVA, KYC, SIRET) | 6 | GET, POST, PATCH |
| Booking | 5 | GET, POST, PATCH |
| Referral | 5 | GET, POST |
| Tracking/analytics | 5 | GET, POST, DELETE |
| Stripe (paiements) | 4 | GET, POST |
| Auth | 4 | GET, POST |
| Cron jobs | 4 | GET |
| User (RGPD) | 3 | GET, POST, DELETE |
| Utilitaires | 15 | Mixte |

### Méthodes HTTP (total exports)

| Méthode | Count |
|---------|-------|
| POST | 89 |
| GET | 78 |
| PATCH | 25 |
| DELETE | 20 |
| PUT | 5 |

### Infrastructure sécurité en place

- **Rate limiting** : Upstash Redis + fallback in-memory (`lib/rate-limit.ts`)
- **Auth** : Supabase SSR + Bearer token + cache 15s (`lib/auth-helpers.ts`)
- **CSRF** : Vérification Origin sur requêtes mutantes (`proxy.ts:75-102`)
- **Validation** : 40+ schémas Zod (`lib/validation.ts`)
- **Sanitization** : 3 couches anti-XSS (`lib/sanitize.ts`)
- **Circuit breaker** : Protection cascade services externes (`lib/circuit-breaker.ts`)
- **Audit logging** : RGPD Art. 30 (`lib/audit.ts`)
- **Headers sécurité** : CSP, HSTS, X-Frame-Options DENY (`next.config.ts:134-159`)
- **Upload** : Magic bytes + MIME whitelist + 10 MB limit (`app/api/upload/route.ts`)

---

## Findings

### Légende sévérité

| Sévérité | Définition |
|----------|------------|
| P0 | Exploitation immédiate possible, impact critique |
| P1 | Risque élevé, exploitation plausible |
| P2 | Défense en profondeur manquante, hygiène |
| P3 | Amélioration, bonne pratique |

---

| ID | Sévérité | Catégorie | Source | Description | Repro | Fix suggéré |
|----|----------|-----------|--------|-------------|-------|-------------|
| API-01 | **P0** | Auth | `app/api/syndic/mission-report/route.ts:9` | **Aucune authentification.** La route accepte `syndic_id`, `artisan_id`, `booking_id` du body sans vérifier l'identité. N'importe qui peut soumettre un faux rapport d'intervention, modifier le statut d'un booking en "completed", créer des notifications et uploader des photos pour n'importe quel syndic/artisan. Utilise `supabaseAdmin` (bypass RLS). | `curl -X POST /api/syndic/mission-report -d '{"syndic_id":"xxx","artisan_id":"yyy",...}'` depuis un client non authentifié | Ajouter `getAuthUser(request)` + vérifier que le caller est l'artisan assigné à la mission OU un membre du syndic concerné. Valider que `mission_id` appartient au `booking_id` et `syndic_id`. |
| API-02 | **P1** | Auth | `app/api/send-kyc-email/route.ts:1-12` | **Endpoint email sans authentification.** Permet d'envoyer des emails de validation/rejet KYC à n'importe quelle adresse. Vecteur de spam/phishing avec template officiel Vitfix. | `curl -X POST /api/send-kyc-email -d '{"to":"victim@email.com","name":"X","company":"Y","action":"approve"}'` | Ajouter auth `isSuperAdmin()`. Seuls les admins devraient déclencher des emails KYC. |
| API-03 | **P1** | Rate limit | `app/api/materiaux-ai/route.ts` | **Agent IA sans rate limiting.** Endpoint LLM (Groq Llama 3.3-70B + Tavily search) sans aucune protection. Coûts API illimités, DoS facile. Seul agent IA du projet sans rate limiting. | Boucle `while true; curl -X POST /api/materiaux-ai` | Ajouter `checkRateLimit()` — 10 req/min par user max (aligné sur `dce-analyse`). |
| API-04 | **P1** | Validation | `app/api/tenders/scan/route.ts:35` | **Input non validé.** `body.department` utilisé directement sans schéma Zod. Passé ensuite à des appels API externes. | POST avec `{"department":"'; DROP TABLE --"}` | Créer un schéma Zod : `z.object({ department: z.string().regex(/^\d{2,3}$/) })`. |
| API-05 | **P1** | Erreurs | `app/api/artisan-settings/route.ts:120` | **Fuite de messages Supabase.** `updateError.message` renvoyé directement au client. Peut exposer noms de colonnes, contraintes, structure de tables. | Envoyer un champ inexistant dans settings → la réponse contient le message PostgreSQL | Remplacer par message générique : `{ error: 'Erreur de sauvegarde' }`. Logger le détail côté serveur. |
| API-06 | **P1** | Erreurs | `app/api/marches/[id]/route.ts:122` | **Fuite de messages Supabase.** `{ error: updateError.message, id }` renvoyé au client, exposant message interne + ID de ressource. | PATCH avec données invalides | Masquer avec message générique, logger le détail. |
| API-07 | **P1** | Erreurs | `app/api/portugal-fiscal/series/route.ts:28,88,111` | **Fuite de messages d'erreur.** `error.message` renvoyé directement, exposant potentiellement des détails Supabase/infra. | Requête avec données malformées | Masquer les détails internes. |
| API-08 | **P1** | Erreurs | `app/api/admin/init-team-table/route.ts:48-52` | **Status 200 avec erreur.** Retourne `{ success: false, error: insertError?.message }` avec status HTTP 200. Le client ne peut pas distinguer succès/échec via le status code. | Upsert en conflit → réponse 200 avec `success: false` | Retourner status 500 quand `insertError` existe. |
| API-09 | **P1** | Erreurs | `app/api/artisan-settings/route.ts:100-102` | **Status 500 pour erreur client.** Retourne HTTP 500 quand des champs ne sont pas disponibles en BDD, alors que c'est une erreur de validation (devrait être 400). | Envoyer un champ non supporté | Changer en status 400. |
| API-10 | **P2** | Auth | `app/api/marches/route.ts:200-201` | **Création de marchés sans auth.** Commenté "pas d'auth requise". Rate limité (5/min) et validé Zod, mais n'importe qui peut créer des annonces. Vecteur de spam. | POST répété avec données valides | À CLARIFIER : décision produit intentionnelle ? Si oui, ajouter captcha/email verification. Sinon, ajouter auth. |
| API-11 | **P2** | Rate limit | `app/api/stripe/webhook/route.ts` | **Webhook Stripe sans rate limiting.** Bien que la signature Stripe soit vérifiée, l'absence de rate limiting permet des attaques par replay massif si la clé de signature est compromise. | Envoi massif de requêtes signées | Ajouter rate limit par IP (100 req/min). |
| API-12 | **P2** | Rate limit | `app/api/stripe/portal/route.ts` | **Portail Stripe sans rate limiting.** Endpoint financier sans protection anti-abus. | Boucle de requêtes POST | Ajouter rate limit (10 req/min par user). |
| API-13 | **P2** | Rate limit | `app/api/stripe/subscription/route.ts` | **Gestion abonnements sans rate limiting.** Opérations financières non protégées. | — | Ajouter rate limit (10 req/min par user). |
| API-14 | **P2** | Rate limit | `app/api/companies/search/route.ts` | **Recherche entreprises sans rate limiting.** Endpoint public, scraping possible pour extraire toute la base entreprises. | Script de scraping automatisé | Ajouter rate limit (30 req/min par IP). |
| API-15 | **P2** | Rate limit | `app/api/artisans-catalogue/route.ts` | **Catalogue artisans sans rate limiting.** Endpoint public, l'intégralité du répertoire artisans peut être aspirée. | Script de scraping | Ajouter rate limit (30 req/min par IP). |
| API-16 | **P2** | Rate limit | `app/api/rfq/route.ts` | **RFQ sans rate limiting.** Création de demandes de devis sans protection anti-flood. | — | Ajouter rate limit (10 req/min par user). |
| API-17 | **P2** | Rate limit | `app/api/doc-number/route.ts` | **Numérotation documents sans rate limiting.** Séquence atomique (Code de commerce L441-3). Un abus peut épuiser la séquence et créer des trous de numérotation. | — | Ajouter rate limit (20 req/min par user). |
| API-18 | **P2** | Rate limit | `app/api/syndic/mission-report/route.ts` | **Rapport de mission sans rate limiting** (en plus de l'absence d'auth — cf. API-01). | — | Ajouter rate limit après correction de l'auth. |
| API-19 | **P2** | Rate limit | `app/api/email-agent/action/route.ts` | **Actions email sans rate limiting.** Permet l'envoi d'emails via l'agent, sans protection anti-flood. | — | Ajouter rate limit (5 req/min par user). |
| API-20 | **P2** | Rate limit | `app/api/email-agent/poll/route.ts` | **Polling email sans rate limiting.** Requêtes récurrentes vers API Gmail sans contrôle de fréquence. | — | Ajouter rate limit (10 req/min par user). |
| API-21 | **P2** | Rate limit | `app/api/referral/generate-code/route.ts` | **Génération codes parrainage sans rate limiting.** Création illimitée de codes. | — | Ajouter rate limit (3 req/min par user). |
| API-22 | **P2** | Validation | `app/api/marketplace-btp/[id]/demande/route.ts:99-100` | **Status PATCH non validé par enum.** Le champ `status` n'est pas restreint à un whitelist. Un attaquant pourrait injecter un statut arbitraire. | PATCH avec `{"status":"admin_override"}` | Ajouter `z.enum(['accepted','rejected','pending'])` sur le champ status. |
| API-23 | **P2** | Validation | `app/api/marketplace-btp/[id]/route.ts:74-86` | **PUT sans schéma Zod.** Body parsé puis filtré manuellement sans validation de types. Assignment direct `body[key] = raw[key]`. | PUT avec types inattendus (nombre au lieu de string) | Créer un schéma Zod pour la mise à jour d'annonces marketplace. |
| API-24 | **P2** | Validation | `app/api/pro/channel/route.ts:24-36` | **contactId non validé en UUID.** Le paramètre query `contactId` est utilisé directement dans un filtre Supabase sans vérification de format. | GET avec `contactId=../../malicious` | Valider avec `z.string().uuid()`. |
| API-25 | **P2** | Validation | Routes dynamiques `[id]`, `[token]` (9 routes) | **Paramètres URL non validés.** Les segments dynamiques (`marches/[id]`, `marketplace-btp/[id]`, `rfq/offer/[token]`, `tracking/[token]`) ne vérifient pas le format (UUID, longueur). | `/api/marches/not-a-uuid` | Ajouter validation regex/UUID au début de chaque handler. |
| API-26 | **P2** | Validation | Multiples routes (`as any`) | **Type casting `as any` après validation.** 8+ routes font `validation.data as any` après Zod, annulant le bénéfice du typage. Fichiers : `syndic/mission-report`, `syndic/team`, `syndic/import-gecond`, `tracking/update`, `email-agent/action`, `portugal-fiscal/series`, `portugal-fiscal/register-document`, `pro/channel`. | — | Remplacer par destructuration typée : `const { field } = validation.data`. |
| API-27 | **P2** | Logging | 8+ routes | **`console.error/log` au lieu de `logger`.** Routes qui n'utilisent pas le logger structuré : `admin/subscriptions`, `cron/referral`, `email-agent/connect`, `service-etapes`, `stats/resume`, `syndic/assign-mission`, `syndic/planning-events`. Les erreurs ne remontent pas à Sentry. | — | Remplacer tous les `console.*` par `logger.*` dans les routes API. |
| API-28 | **P2** | Erreurs | Toutes les routes | **Format d'erreur incohérent.** Trois formats coexistent : `{ error: string }`, `{ error: string, details: object }`, `{ error: string, details: string }`. Les détails de validation varient entre `.flatten().fieldErrors`, `.flatten()`, `.error.issues.map().join()`. | — | Standardiser : `{ error: string, code?: string, details?: Record<string, string[]> }`. Utiliser `validateBody()` partout avec format unifié. |
| API-29 | **P2** | Rate limit | `app/api/pro/messagerie/route.ts` | **Messagerie sans rate limiting.** Système de messages pro (GET, POST, PATCH) sans protection anti-flood. | — | Ajouter rate limit (30 req/min par user). |
| API-30 | **P2** | Rate limit | `app/api/syndic/chatbot-whatsapp/route.ts` | **Chatbot WhatsApp sans rate limiting.** Endpoint de messagerie externe sans contrôle. | — | Ajouter rate limit (20 req/min par IP). |
| API-31 | **P3** | Documentation | Toutes les routes | **Pas de documentation OpenAPI/Swagger.** 143 endpoints sans contrat formalisé. Aucun fichier openapi.json ou swagger.yaml. | — | Générer un fichier OpenAPI 3.x à partir des schémas Zod existants (lib comme `zod-to-openapi`). |
| API-32 | **P3** | Versioning | Toutes les routes | **Pas de versioning API.** Toutes les routes sont en `/api/xxx` sans préfixe de version (`/api/v1/`). Aucune stratégie de breaking changes. | — | Documenter la politique de versioning. Pour une app interne, le header `API-Version` ou le path `/api/v1/` sont les options classiques. Pas urgent tant que l'API n'est pas publique. |
| API-33 | **P3** | CORS | `proxy.ts:84` | **Requêtes sans Origin autorisées.** Les requêtes server-to-server (sans header Origin) passent la vérification CSRF. Normal pour les webhooks/cron, mais à documenter explicitement. | Requête cURL sans header Origin | Documenter ce comportement. Optionnel : exiger Origin sauf pour les routes webhooks/cron spécifiquement. |
| API-34 | **P3** | Rate limit | `app/api/sync/*` (6 routes) | **Endpoints sync sans rate limiting.** Protégés par CRON_SECRET, mais si le secret est compromis, aucune limite de fréquence. | — | Ajouter rate limit (5 req/min par IP) comme défense en profondeur. |
| API-35 | **P3** | Rate limit | `app/api/cron/*` (4 routes) | **Cron jobs sans rate limiting.** Même logique que API-34. | — | Ajouter rate limit (5 req/min par IP). |
| API-36 | **P3** | Timeout | Majorité des routes | **Pas de timeout explicite sur les requêtes Supabase.** Les appels Supabase n'ont pas de timeout côté applicatif. Seuls les appels Groq/Tavily ont des timeouts (25-30s). | — | Ajouter un timeout global via `AbortSignal.timeout(10000)` sur les requêtes Supabase critiques. |
| API-37 | **P3** | Idempotence | Routes POST (hors webhook) | **Pas d'idempotence sur les créations.** Seul le webhook Stripe implémente la déduplication (`stripe_webhook_events`). Les POST sur bookings, marchés, RFQ, etc. peuvent créer des doublons en cas de retry réseau. | Double-clic sur "Créer un marché" → 2 marchés créés | Implémenter un header `Idempotency-Key` sur les routes de création critiques (bookings, marchés, rfq, doc-number). |

---

## Top risques

### 1. Mission report sans auth (API-01) — P0

Le seul vrai P0 du périmètre. Un attaquant peut soumettre de faux rapports d'intervention, marquer des bookings comme terminés, uploader des photos arbitraires, et créer des notifications pour n'importe quel syndic — sans aucune authentification. L'utilisation de `supabaseAdmin` (bypass RLS) aggrave le risque.

### 2. Email KYC sans auth (API-02) — P1

Permet d'envoyer des emails officiels Vitfix à n'importe quelle adresse. Template HTML complet avec branding. Vecteur de phishing crédible.

### 3. Agent IA sans rate limit (API-03) — P1

Le seul des 11 agents IA sans rate limiting. Appels Groq + Tavily coûteux. Les 10 autres agents sont protégés.

### 4. Fuites de messages internes (API-05/06/07) — P1

Trois routes exposent directement les messages d'erreur PostgreSQL/Supabase au client, révélant la structure de la base.

### 5. Couverture rate limiting à 63% (API-11 à API-35)

89 routes sur 143 sont rate-limitées. Les 54 restantes incluent des endpoints financiers (Stripe), des endpoints publics (catalogue, search), et des intégrations email.

---

## Plan de remédiation ordonné

### Phase 1 — Immédiat (P0/P1 critiques, 1-2 jours)

| Ordre | ID | Action | Effort |
|-------|----|--------|--------|
| 1 | API-01 | Ajouter auth + ownership check sur `/api/syndic/mission-report` | 30 min |
| 2 | API-02 | Ajouter auth `isSuperAdmin()` sur `/api/send-kyc-email` | 15 min |
| 3 | API-03 | Ajouter `checkRateLimit()` sur `/api/materiaux-ai` | 10 min |
| 4 | API-04 | Ajouter schéma Zod sur `/api/tenders/scan` | 10 min |
| 5 | API-05/06/07 | Masquer les messages Supabase (3 routes) | 20 min |
| 6 | API-08/09 | Corriger les status HTTP (2 routes) | 10 min |

### Phase 2 — Court terme (P2, 3-5 jours)

| Ordre | ID | Action | Effort |
|-------|----|--------|--------|
| 7 | API-11 à 21 | Ajouter rate limiting sur 11 routes prioritaires (Stripe, public, email) | 2h |
| 8 | API-22/23/24 | Corriger validation (status enum, PUT schema, UUID) | 1h |
| 9 | API-25 | Valider les paramètres URL dynamiques (9 routes) | 1h |
| 10 | API-26 | Supprimer les `as any` post-validation (8 routes) | 1h |
| 11 | API-27 | Remplacer `console.*` par `logger.*` (8 routes) | 30 min |
| 12 | API-28 | Standardiser le format d'erreur | 2h |
| 13 | API-29/30 | Rate limit messagerie + WhatsApp | 15 min |

### Phase 3 — Moyen terme (P3, backlog)

| Ordre | ID | Action | Effort |
|-------|----|--------|--------|
| 14 | API-31 | Générer documentation OpenAPI depuis schémas Zod | 1 jour |
| 15 | API-37 | Implémenter Idempotency-Key sur routes de création | 1 jour |
| 16 | API-36 | Ajouter timeouts Supabase | 2h |
| 17 | API-32 | Documenter politique de versioning | 1h |
| 18 | API-33/34/35 | Rate limit défense en profondeur (cron, sync, no-origin) | 1h |

---

## Questions ouvertes

| # | Question | Contexte |
|---|----------|----------|
| 1 | `/api/marches` POST sans auth est-il intentionnel ? (API-10) | Le commentaire "pas d'auth requise" suggère une décision produit. Si c'est un choix pour permettre aux visiteurs de poster des appels d'offres, un captcha ou une vérification email serait nécessaire. |
| 2 | Le format d'erreur cible est-il défini ? (API-28) | La standardisation nécessite un choix : `{ error, code, details }` semble le meilleur compromis. Un `ErrorResponse` type partagé simplifierait le frontend. |
| 3 | Les sync endpoints doivent-ils accepter POST ? (API-34) | Actuellement déclenchés par cron (GET suffirait). Le POST semble hérité. Réduire la surface en supprimant POST si inutilisé. |
| 4 | Plan de migration OpenAPI ? (API-31) | `zod-to-openapi` ou `next-swagger-doc` ? Le choix impacte l'effort de maintenance. |
| 5 | Idempotency-Key : scope minimal ? (API-37) | Quelles routes de création sont critiques business ? Suggestion : `bookings`, `marches`, `rfq`, `doc-number` minimum. |

---

## Résumé exécutif

| Métrique | Valeur |
|----------|--------|
| Routes auditées | 143 |
| Findings totaux | 37 |
| P0 (critique) | 1 |
| P1 (élevé) | 8 |
| P2 (moyen) | 21 |
| P3 (faible) | 7 |
| Routes avec auth | 117/143 (82%) |
| Routes avec rate limiting | 89/143 (62%) |
| Routes avec validation Zod | 108/143 (76%) |
| Documentation OpenAPI | 0% |
| Versioning API | Non implémenté |
| CSRF protection | Oui (Origin check sur mutations) |
| Idempotence (hors webhook) | Non implémenté |

L'infrastructure sécurité est solide (auth, rate limiting, validation, CSRF, CSP, HSTS). Les findings sont majoritairement des trous de couverture dans des patterns déjà bien établis — la remédiation consiste à étendre les protections existantes aux routes non couvertes plutôt qu'à implémenter de nouveaux mécanismes.
