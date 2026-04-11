# Audit de Securite — Vitfix.io (fixit-production)

**Date :** 11 avril 2026
**Scope :** Codebase Next.js 16.2.2 (App Router), Supabase, Vercel
**Methode :** Revue de code statique (read-only)
**Auditeur :** Claude Opus 4.6

---

## 1. Perimetre audite

| Composant | Quantite | Couverture |
|-----------|----------|------------|
| Routes API (`app/api/`) | 124 routes | 100% |
| Migrations Supabase (RLS) | 4 fichiers (041-044) | 100% |
| Auth helpers (`lib/auth-helpers.ts`) | 248 lignes | 100% |
| Security headers (`next.config.ts`) | Headers + CSP | 100% |
| CSRF/CORS (`proxy.ts`) | Middleware edge | 100% |
| Sanitisation (`lib/sanitize.ts`) | 124 lignes | 100% |
| Rate limiting (`lib/rate-limit.ts`) | Upstash + fallback | 100% |
| Uploads (`/api/upload`, `/api/artisan-photos`) | 2 endpoints | 100% |
| Dependances (`package.json`) | npm audit | 100% |
| Fichiers `.env*` | 3 fichiers + .gitignore | 100% |
| Storage RLS (Supabase buckets) | 5 buckets | 100% |

### Repartition auth des 124 routes

| Methode auth | Routes | % |
|--------------|--------|---|
| `getAuthUser()` (Bearer token) | 92 | 74% |
| Rate limit IP seul (public) | 17 | 14% |
| Cron secret (Bearer) | 6 | 5% |
| Token-based (RFQ) | 2 | 2% |
| Internal secret header | 1 | 1% |
| Stripe signature | 1 | 1% |
| **Aucune auth ni rate limit** | **5** | **4%** |

---

## 2. Tableau des findings

### P0 — Critique

| ID | Categorie | Source | Description | Repro | Fix suggere |
|----|-----------|--------|-------------|-------|-------------|
| **F01** | Auth / IDOR | `app/api/profile/specialties/route.ts:11-57` | **Aucune authentification.** Le POST accepte un `user_id` dans le body et upsert dans `profile_specialties` via `supabaseAdmin`. N'importe qui peut modifier les specialites de n'importe quel artisan. | `curl -X POST /api/profile/specialties -d '{"user_id":"<UUID_VICTIME>","slugs":["electricite"]}'` | Ajouter `getAuthUser(req)` et verifier `user.id === user_id` |
| **F02** | Auth / IDOR | `app/api/seed-motifs/route.ts:53-69` | **Pas d'authentification** (rate limit seul). Accepte `artisan_id` dans le body et insere des motifs par defaut. Un attaquant peut injecter des motifs sur n'importe quel profil artisan. | `curl -X POST /api/seed-motifs -d '{"artisan_id":"<UUID>","categories":["electricite"]}'` | Ajouter `getAuthUser(req)` et verifier ownership |
| **F03** | Auth / DoS | `app/api/facturx/generate/route.ts:73` | **Ni authentification ni rate limiting.** Genere des PDF/A-3 Factur-X (operation CPU-intensive). Ouvert au DoS et a l'abus de generation de factures. | `for i in $(seq 1 1000); do curl -X POST /api/facturx/generate -d '...' & done` | Ajouter `getAuthUser(req)` + rate limit 10/min |

### P1 — Haute

| ID | Categorie | Source | Description | Repro | Fix suggere |
|----|-----------|--------|-------------|-------|-------------|
| **F04** | XSS | `lib/sanitize.ts:20-26` | `purifyHTML()` supprime les tags non autorises mais **conserve les attributs** des tags autorises. Un `<div onclick="alert(1)">` passe tel quel car `div` est dans `ALLOWED_TAGS`. | Injecter via reponse IA : markdown contenant `<div onclick="steal()">` apres un prompt injection | Ajouter strip des attributs `on*` : `.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')` avant le return, ou mieux : ne conserver que `class` comme attribut autorise |
| **F05** | XSS | `components/simulateur/SimulateurChat.tsx:209-211` | Conversion markdown bold par regex `replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')` puis `dangerouslySetInnerHTML`. Le contenu vient de la reponse IA (Groq), pas de `escapeHTML()` prealable. Si prompt injection reussie, XSS direct. | Prompt injection dans le simulateur qui force l'IA a repondre avec `**</strong><img src=x onerror=alert(1)>**` | Utiliser `safeMarkdownToHTML()` de `lib/sanitize.ts` au lieu du regex inline |
| **F06** | Dep / DoS | `package.json` (next@16.2.2) | `npm audit` rapporte 1 vulnerabilite **high** : Next.js Denial of Service via Server Components (GHSA-q4gf-8mx6-v5v3). | `npm audit` | `npm audit fix` (met a jour next) |
| **F07** | Auth | Absence de `middleware.ts` | **Pas de middleware Next.js** protegeant les routes pages (`/pro/dashboard`, `/syndic/dashboard`, `/client/dashboard`). La protection repose sur des `useEffect` cote client qui redirigent si pas de session. Un utilisateur non authentifie peut voir le HTML initial avant redirect. | Desactiver JS dans le navigateur, naviguer vers `/pro/dashboard` | Creer `middleware.ts` a la racine, verifier la session Supabase, rediriger les routes protegees |
| **F08** | Auth | 93 routes utilisent `supabaseAdmin` | Toutes les routes API utilisent le service role key (bypass RLS). Si une seule route a un defaut d'auth (cf. F01, F02, F03), l'attaquant a un acces complet a la base sans restriction RLS. | Exploiter F01 pour ecrire dans `profile_specialties` sans restriction | Pour les operations simples (SELECT du propre profil), utiliser un client Supabase avec le token utilisateur (respecte RLS). Reserver `supabaseAdmin` aux operations cross-tenant. |
| **F09** | CSP | `next.config.ts:143-144` | CSP contient `script-src 'unsafe-inline'` et `style-src 'unsafe-inline'`. Annule la protection CSP contre les scripts/styles inline injectes. Le nonce genere dans `proxy.ts:55` n'est pas applique de maniere coherente. | Injecter un `<script>` inline via une XSS (cf. F04/F05) — CSP ne bloquera pas | Retirer `'unsafe-inline'` de `script-src`, deployer le nonce CSP sur toutes les pages. `style-src 'unsafe-inline'` est tolerable avec Tailwind. |

### P2 — Moyenne

| ID | Categorie | Source | Description | Repro | Fix suggere |
|----|-----------|--------|-------------|-------|-------------|
| **F10** | Upload | `app/api/artisan-photos/route.ts:117-131` | Validation MIME par `file.type.startsWith('image/')` seulement. Pas de validation magic bytes. Le MIME est controlable par le client. | Envoyer un fichier `.php` avec `Content-Type: image/jpeg` | Copier la validation magic bytes de `/api/upload/route.ts` |
| **F11** | Upload | `app/api/upload/route.ts:100` | Extension du fichier extraite du nom fourni par l'utilisateur sans whitelist. Double extension possible (`shell.php.jpg`). | Upload avec filename `exploit.svg.jpg` | Utiliser une whitelist d'extensions : `['jpg','jpeg','png','webp','pdf','mp3','wav']` |
| **F12** | Auth | `lib/auth-helpers.ts:83-125` | Cache cabinet_id avec TTL 5 min. Si un membre est retire de `syndic_team_members`, il conserve l'acces pendant max 5 min. | Retirer un collaborateur syndic, il peut encore faire des requetes pendant 5 min | Ajouter un mecanisme d'invalidation sur update de `syndic_team_members`, ou reduire le TTL a 60s |
| **F13** | CORS | `proxy.ts:82` | `http://localhost` dans la whitelist d'origines (Capacitor Android). Accepte TOUTE requete depuis localhost, pas seulement Capacitor. | Script malicieux local envoyant des requetes depuis `http://localhost` vers l'API | Restreindre a `http://localhost:3000` ou valider via un header Capacitor custom |
| **F14** | Rate limit | `lib/rate-limit.ts:116-122` | IP extraite de `x-forwarded-for` (spoofable derriere certains proxies). En production Vercel, ok car Vercel set le header. Risque si deploiement sur autre infra. | Header `x-forwarded-for: 1.2.3.4` avec chaque requete | Ajouter fallback sur `x-vercel-forwarded-for` ou `x-real-ip` en priorite |
| **F15** | Ops | `supabase/migrations/042_sprint2_audit_logs.sql:48` | Le cron de nettoyage des audit_logs (> 1 an) est **commente**. Les logs vont s'accumuler indefiniment. | Verifier la taille de la table audit_logs apres 6+ mois | Decommmenter et activer via pg_cron |
| **F16** | Validation | `app/api/facturx/generate/route.ts:66` | `acomptes: z.array(z.any()).optional()` — validation lache. Accepte n'importe quel contenu dans le tableau d'acomptes. | Envoyer des objets arbitraires dans le champ acomptes | Definir un schema Zod strict pour les acomptes |

### P3 — Basse

| ID | Categorie | Source | Description | Repro | Fix suggere |
|----|-----------|--------|-------------|-------|-------------|
| **F17** | RLS | `supabase/migrations/041_rls_complete_audit.sql:112` | `availability` a une policy `USING (true)` en lecture. Toutes les disponibilites de tous les artisans sont lisibles par tout utilisateur authentifie. | Query directe Supabase : `from('availability').select('*')` | Acceptable si voulu (affichage public). Sinon, filtrer par `active=true` |
| **F18** | RLS | `supabase/migrations/041_rls_complete_audit.sql` | `sync_jobs` en lecture publique (`USING (true)`). Expose le statut et l'historique des sync. | Query directe Supabase | Restreindre a `service_role` ou admin |
| **F19** | Auth cache | `lib/auth-helpers.ts:11-12` | Cache auth user 30s TTL. Fenetre mineure apres revocation de token. | Revoquer un token, il reste valide max 30s | Acceptable. Reduire a 10s si critique. |
| **F20** | Info leak | `app/api/health/route.ts` | Endpoint health public. Risque minimal si ne fournit que `{ status: 'ok' }`. | `curl /api/health` | Verifier qu'il n'expose pas de versions/configs |

---

## 3. Top 5 risques

| Rang | Risk | Impact | Findings |
|------|------|--------|----------|
| 1 | **IDOR sur endpoints non authentifies** | Modification de donnees d'autres utilisateurs sans authentification | F01, F02 |
| 2 | **XSS via reponse IA + sanitisation incomplete** | Vol de session, exfiltration de donnees, actions au nom de l'utilisateur | F04, F05, F09 |
| 3 | **DoS sur generation PDF sans protection** | Epuisement CPU/memoire serveur, factures frauduleuses | F03 |
| 4 | **Bypass RLS systematique** | Un seul defaut d'auth = acces complet a la base | F08, F01, F02, F03 |
| 5 | **Pas de protection serveur sur les pages** | Fuite HTML initiale avant redirect client | F07 |

---

## 4. Plan de remediation

### Sprint 1 — Immediat (< 48h)

| Priorite | Finding | Action | Effort |
|----------|---------|--------|--------|
| P0 | F01 | Ajouter `getAuthUser()` + verifier `user.id === user_id` dans `/api/profile/specialties` | 15 min |
| P0 | F02 | Ajouter `getAuthUser()` + verifier ownership dans `/api/seed-motifs` | 15 min |
| P0 | F03 | Ajouter `getAuthUser()` + `checkRateLimit()` dans `/api/facturx/generate` | 20 min |
| P1 | F04 | Ajouter strip des attributs evenements dans `purifyHTML()` | 30 min |
| P1 | F05 | Remplacer le regex inline par `safeMarkdownToHTML()` dans `SimulateurChat.tsx` | 15 min |

### Sprint 2 — Semaine 1

| Priorite | Finding | Action | Effort |
|----------|---------|--------|--------|
| P1 | F06 | `npm audit fix` — mettre a jour Next.js | 30 min + tests |
| P1 | F07 | Creer `middleware.ts` avec protection des routes `/pro/*`, `/syndic/*`, `/client/*` | 2h |
| P1 | F09 | Retirer `'unsafe-inline'` de `script-src`, deployer nonce CSP | 3h |
| P2 | F10 | Ajouter validation magic bytes dans `/api/artisan-photos` | 30 min |
| P2 | F11 | Whitelist d'extensions dans `/api/upload` | 20 min |

### Sprint 3 — Semaine 2-3

| Priorite | Finding | Action | Effort |
|----------|---------|--------|--------|
| P1 | F08 | Refactor progressif : utiliser le client user-scoped (avec token) pour les operations simples au lieu de `supabaseAdmin` partout | 8h+ |
| P2 | F12 | Reduire TTL cache cabinet a 60s ou invalider sur update | 1h |
| P2 | F13 | Restreindre origin localhost a un port specifique | 15 min |
| P2 | F14 | Ajouter detection IP Vercel en priorite | 30 min |
| P2 | F15 | Activer le cron nettoyage audit_logs | 15 min |
| P2 | F16 | Schema Zod strict pour acomptes | 20 min |

### Sprint 4 — Hardening continu

| Priorite | Finding | Action | Effort |
|----------|---------|--------|--------|
| P3 | F17-F18 | Restreindre RLS sur availability et sync_jobs si non necessaire en public | 30 min |
| P3 | F19 | Reduire TTL auth cache si necessaire | 5 min |
| P3 | F20 | Verifier contenu du health endpoint | 5 min |
| — | — | Ajouter DOMPurify comme couche supplementaire de sanitisation | 2h |
| — | — | Audit de penetration externe (OWASP ZAP / Burp Suite) | Externe |

---

## 5. Points positifs

| Domaine | Observation |
|---------|-------------|
| **RLS Supabase** | Policies completes sur toutes les tables publiques (041_rls_complete_audit.sql). Ownership verifie via `auth.uid()`. Storage buckets proteges (044). |
| **Validation inputs** | 89% des routes (110/124) utilisent Zod avec schemas stricts. `lib/validation.ts` centralise les schemas partages. |
| **Roles** | Roles extraits de `app_metadata` (non forgeable cote client, defini serveur uniquement). |
| **Auth helpers** | `getAuthUser()`, `verifyCabinetOwnership()`, `verifyArtisanOwnership()` = defense en profondeur. |
| **CSRF** | Origin validation dans `proxy.ts` sur toutes les mutations API. |
| **Security headers** | HSTS 2 ans + preload, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict. |
| **Rate limiting** | Upstash Redis distribue en prod, fallback in-memory en dev. Deploye sur 17 endpoints publics. |
| **Secrets** | Aucun secret hardcode dans le code source. Tous en `process.env`. `.env*` dans `.gitignore`. |
| **Audit logs** | Table `audit_logs` avec IP, user_agent, details JSONB. RLS service_role + super_admin read. |
| **SECURITY DEFINER** | Fonctions PL/pgSQL avec `search_path` restreint et verification ownership (043). |
| **Stripe** | Webhook avec verification de signature. Secret key cote serveur uniquement. |
| **Upload** | `/api/upload` a validation magic bytes + MIME + taille (10 MB). |
| **Debug** | `/api/debug/conversations` desactive (retourne 404). |

---

## 6. Questions ouvertes

| # | Question | Impact |
|---|----------|--------|
| 1 | Les policies RLS 041 sont-elles **appliquees en production** ? (Verifier via `SELECT tablename, policies FROM pg_policies` sur la base prod) | Si non appliquees, toutes les tables sont ouvertes |
| 2 | Le `CRON_SECRET` est-il unique et different entre staging et production ? | Si identique, un attaquant qui compromet un env peut declencher les crons de l'autre |
| 3 | Y a-t-il un WAF (Cloudflare, Vercel Firewall) devant l'application ? | Impacte la criticite de F03 (DoS) et F14 (IP spoofing) |
| 4 | Les tokens Supabase ont-ils une duree d'expiration configuree ? (default JWT = 1h) | Impacte la fenetre d'exploitation apres vol de token |
| 5 | Le Stripe webhook secret (`whsec_`) est-il configure en variable d'env sur Vercel ? | S'il est absent, la verification de signature echoue silencieusement |
| 6 | L'endpoint `/api/marketplace-btp` et ses sous-routes utilisent `getAnon().auth.getUser(token)` au lieu de `getAuthUser()` — est-ce intentionnel ? | Pattern d'auth different du reste de l'app, plus fragile |

---

## 7. Resume des metriques

| Metrique | Valeur |
|----------|--------|
| Routes audites | 124 |
| Findings totaux | 20 |
| P0 (Critique) | 3 |
| P1 (Haute) | 6 |
| P2 (Moyenne) | 7 |
| P3 (Basse) | 4 |
| Routes avec auth | 92/124 (74%) |
| Routes avec validation Zod | 110/124 (89%) |
| Vulnerabilite npm audit | 1 (high — Next.js DoS) |
| Secrets exposes dans le code | 0 |
| Tables avec RLS | Toutes les tables publiques |
| Buckets storage avec RLS | 5/5 |
