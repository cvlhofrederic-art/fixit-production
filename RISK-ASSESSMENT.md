# Vitfix.io — Risk Assessment (Phase 2)

> Date: 2026-04-24 | Codebase: fixit-production | Deploy: Cloudflare Workers | ~1M LoC | 197 API routes

---

## 1. Critical Paths — Business Impact Assessment

### Si auth tombe

| Composant | Technologie | Impact |
|-----------|------------|--------|
| Auth primaire | Supabase Auth (JWT, cookies HTTP-only) | **TOTAL** — aucun fallback |
| Token refresh | Automatique via middleware chaque requete | Cascade si Supabase lent (>500ms) |
| Cache auth | 15-30s en memoire par token suffix | Token revoque reste actif 15-30s |
| Brute force | 5 req/min par IP + 10/15min par email | IP spoofable derriere proxy |

**Impact business** : 100% des utilisateurs bloques. Pas de mode degrade. Pas de page de maintenance statique. Les dashboards pro/syndic/client sont inaccessibles. Les artisans ne peuvent pas generer de devis ni factures. Les paiements Stripe continuent (webhooks) mais les utilisateurs ne voient rien.

**SPOF** : Supabase Auth est le seul fournisseur. Pas de fallback OAuth local.

### Si DB corrompue

| Metrique | Valeur actuelle |
|----------|----------------|
| RPO (perte de donnees acceptable) | 24h (snapshots quotidiens) — PITR non confirme actif |
| RTO (temps de restauration) | 4-24h (restauration manuelle Supabase) |
| Restauration testee ? | Non — jamais |
| Migrations reversibles ? | Non — aucune procedure DOWN |

**Impact business** : Perte potentielle de 24h de devis, factures, reservations, paiements. 61 fichiers de migration mais 8 tables cle (bookings, profiles_artisan, services) creees via Dashboard sans migration — irrecuperables depuis le code seul.

**Donnees critiques non sauvegardees hors Supabase** : zero backup externe (pas de S3, pas de pg_dump automatise).

### Si perf degrade 50%

| Goulot | Impact mesure |
|--------|--------------|
| Middleware auth sur CHAQUE requete (images, CSS, API) | +50-200ms par requete, 5-20s cumule par page |
| `cookies()` dans root layout | Force le rendu dynamique sur TOUTES les pages (zero cache CDN) |
| 7 familles de polices Google (300-400KB) | Render-blocking au premier affichage |
| DevisFactureForm.tsx (3,839 lignes, 60+ useState) | Re-render a chaque keystroke, pas de memoization |
| 60+ requetes `.select('*')` sans `.limit()` | Over-fetching massif, 100KB+ par requete |

**Impact business** : TTFB degrade de 200-500ms sur toutes les pages. Les pages SEO (services, villes, profils artisans) qui devraient etre statiques sont generees dynamiquement. Perte directe de trafic organique.

### Si API down

| Service | Revenue impact |
|---------|---------------|
| Stripe down | Nouveaux paiements bloques. Abonnements existants continuent (cache local du `current_period_end`). |
| Groq AI down | 10 agents IA offline (Fixy, Simulateur, Materiaux, Comptable, etc.). Fallback vers Llama 3.1-8B puis OpenRouter. Si les 3 tombent : feature core morte. |
| Resend down | Emails perdus silencieusement. Rappels booking J-1 non envoyes. Utilisateurs jamais prevenus. |
| Supabase down | App entierement morte. Auth + DB + Storage = triple SPOF. |

---

## 2. Technical Risk Inventory

### Ce qui genere le plus de bugs potentiels

| Source | Quantite | Detail |
|--------|----------|--------|
| Routes API sans auth | 5 routes | `/api/profile/specialties`, `/api/seed-motifs`, `/api/facturx/generate` — IDOR + DoS |
| `dangerouslySetInnerHTML` | 15+ composants | Certains sans `safeMarkdownToHTML()` (ResumeActivite, ArquivoDigital) |
| Catch blocks vides | 146 blocs | Erreurs avalees silencieusement — bugs invisibles en prod |
| `Promise.all` sans garde individuelle | 16 instances | Si une requete echoue, tout echoue sans donnee partielle |
| Routes sans validation Zod | 82/197 routes | Inputs non valides acceptes sur uploads, estimations, syndic |

### Ce qui cause le plus de dette technique

| Probleme | Mesure |
|----------|--------|
| DevisFactureForm.tsx | 3,839 lignes, pas de code splitting |
| DevisFactureFormBTP.tsx | 2,385 lignes dupliquees (meme logique, variante BTP) |
| Composants `'use client'` | 263 — beaucoup pourraient etre Server Components |
| `select('*')` sans limit | 60+ instances — over-fetching systematique |
| Console.log en prod | 40+ routes API avec console.error au lieu de logger |
| Tests | ~10 unit + 7 E2E — couverture estimee <5% |

### Ce qui depend d'un seul service externe

| Service | Usage | Fallback |
|---------|-------|----------|
| **Supabase** | Auth + DB + Storage + Realtime | AUCUN — triple SPOF |
| **Stripe** | Paiements + abonnements + webhooks | AUCUN |
| **Groq** | LLM principal (Llama 3.3-70B) | Llama 3.1-8B puis OpenRouter |
| **Resend** | Tous les emails transactionnels | AUCUN — emails perdus |
| **Upstash Redis** | Rate limiting distribue | Fallback in-memory (ephemere sur serverless) |
| **Tavily** | Recherche web materiaux IA | DB locale (qualite degradee) |

---

## 3. Risk Matrix

```
Risk                              | Probabilite | Impact    | Score | Priorite
----------------------------------|-------------|-----------|-------|----------
IDOR sur 3 routes sans auth       | Haute       | Critique  | 10/10 | FIX NOW
Supabase = triple SPOF            | Moyenne     | Critique  | 9/10  | FIX NOW
XSS via sanitization incomplete   | Haute       | Haute     | 8/10  | FIX NOW
Pas de middleware server-side     | Haute       | Haute     | 8/10  | FIX NOW
  (pages protegees visibles)      |             |           |       |
PITR non confirme actif           | Moyenne     | Critique  | 8/10  | FIX ASAP
Restauration DB jamais testee     | Moyenne     | Critique  | 8/10  | FIX ASAP
Emails perdus silencieusement     | Haute       | Haute     | 7/10  | FIX ASAP
146 catch blocks vides            | Haute       | Moyenne   | 7/10  | FIX ASAP
Circuit breaker in-memory         | Haute       | Haute     | 7/10  | FIX ASAP
  (pas distribue sur Workers)     |             |           |       |
Pas d'alerting proactif           | Haute       | Haute     | 7/10  | FIX ASAP
82 routes sans validation Zod     | Moyenne     | Haute     | 6/10  | Plan sprint
CSP unsafe-inline (XSS bypass)   | Moyenne     | Haute     | 6/10  | Plan sprint
Middleware auth bloque tout       | Haute       | Moyenne   | 6/10  | Plan sprint
  (images, CSS, API = +200ms)     |             |           |       |
Root layout force dynamic render  | Haute       | Moyenne   | 6/10  | Plan sprint
7 polices Google (400KB)          | Haute       | Basse     | 4/10  | Plan trimestre
DevisForm 3839 lignes dupliquees  | Basse       | Moyenne   | 4/10  | Plan trimestre
263 composants 'use client'       | Basse       | Moyenne   | 4/10  | Plan trimestre
Sentry 100% tracing serveur      | Moyenne     | Basse     | 3/10  | Plan trimestre
Secrets non sauvegardes hors      | Basse       | Critique  | 5/10  | Plan sprint
  Vercel (pas de backup)          |             |           |       |
Cron jobs >30s incompatibles CF   | Haute       | Haute     | 7/10  | FIX ASAP
  Workers (pas migres en Queues)  |             |           |       |
```

---

## 4. Mitigation Plans

### P0 — Immediat (< 48h)

| Risk | Action | RTO | Effort |
|------|--------|-----|--------|
| IDOR 3 routes | Ajouter `getAuthUser()` + verification ownership sur `/api/profile/specialties`, `/api/seed-motifs`, `/api/facturx/generate` | 0 | 1h |
| XSS sanitization | Strip attributs `on*` dans `purifyHTML()`. Verifier `ResumeActivite.tsx` et `ArquivoDigitalSection.tsx` | 0 | 2h |
| Middleware server-side | Creer `middleware.ts` protegeant `/pro/*`, `/syndic/*`, `/client/*` | 0 | 2h |
| Webhook secret | Verifier que `STRIPE_WEBHOOK_SECRET` est bien set en prod | 0 | 5min |

### P1 — Semaine 1

| Risk | Action | Runbook |
|------|--------|---------|
| PITR | Confirmer activation dans Supabase Dashboard > Database > Backups | Documenter la procedure de restauration |
| Restauration DB | Tester un restore complet sur un projet Supabase test | Ecrire un runbook etape par etape |
| Emails silencieux | Ajouter toast/notification quand Resend echoue + retry queue | Alerter Sentry sur echec email |
| Alerting | Configurer Sentry alerts > Slack pour error rate >5% | Uptime Robot sur /api/health |
| Next.js CVE | `npm audit fix` — DoS via Server Components (GHSA-q4gf-8mx6-v5v3) | CI bloque si HIGH/CRITICAL |
| Secrets backup | Exporter vars Vercel vers 1Password/Bitwarden chiffre | Rotation trimestrielle |

### P2 — Sprint suivant

| Risk | Action |
|------|--------|
| Circuit breaker | Migrer etat vers Upstash Redis (cross-instance) |
| Catch blocks vides | Remplacer par `logger.error()` + toast utilisateur |
| Validation Zod | Ajouter schemas sur les 82 routes manquantes (prioriser admin + paiements) |
| CSP | Supprimer `unsafe-inline`, implementer nonces |
| Middleware perf | Exclure assets statiques du middleware auth |
| Root layout | Deplacer `cookies()` hors du layout racine → debloquer le cache CDN |
| Cron > 30s | Migrer vers Cloudflare Queues (scan-marches, sync DECP/SITADEL, tenders) |
| Rate limit IA | Ajouter 1 req/5s par user sur `/api/fixy-ai`, `/api/comptable-ai`, `/api/materiaux-ai` |

### P3 — Plan trimestre

| Risk | Action |
|------|--------|
| Supabase SPOF | Evaluer read replicas + backup externe automatise (pg_dump → S3/R2) |
| DevisForm duplication | Extraire composant partage avec flag `useBtpDesign` |
| select('*') | Audit des 60+ requetes — specifier colonnes + ajouter `.limit()` |
| Polices | Reduire a 2-3 familles (DM Sans + Syne suffisent) |
| Tests | Objectif couverture 30% sur les chemins critiques (auth, paiement, devis) |
| RGPD | Implementer `delete_user_data()`, activer pg_cron anonymisation |

---

## 5. Recovery Objectives

| Composant | RTO actuel | RTO cible | RPO actuel | RPO cible |
|-----------|-----------|-----------|-----------|-----------|
| Code (deploy) | <1h (Git → CF) | <15min | 0 (Git) | 0 |
| Database | 4-24h | <1h | 24h | <10s (PITR) |
| Secrets | Manuel (Vercel UI) | <30min | Inconnu | 0 (1Password) |
| Storage (fichiers) | Inclus dans DB | <1h | 24h | <10s (PITR) |
| AI agents | Immediat (fallback) | Immediat | N/A | N/A |
| Emails | Pas de retry | <5min | Perdus | File d'attente |

---

## 6. Architecture des dependances critiques

```
Utilisateur
    |
    v
Cloudflare Workers (proxy.ts middleware)
    |
    +---> Supabase Auth (JWT)          ← SPOF #1
    +---> Supabase PostgreSQL          ← SPOF #1 (meme fournisseur)
    +---> Supabase Storage             ← SPOF #1 (meme fournisseur)
    +---> Stripe (paiements)           ← SPOF #2
    +---> Groq → OpenRouter (LLM)     ← Fallback chain OK
    +---> Resend (emails)              ← SPOF #3 (pas de retry)
    +---> Upstash Redis (rate limit)   ← Fallback in-memory (partiel)
    +---> Tavily (recherche web)       ← Fallback DB locale
    +---> Google OAuth (email agent)   ← Feature non critique
```

**Conclusion** : Supabase concentre 3 services critiques (auth + DB + storage) sur un seul fournisseur, une seule region, sans replica. C'est le risque #1 de l'architecture.

---

## Checklist de verification

- [ ] IDOR fixes deployed (3 routes)
- [ ] XSS sanitization hardened
- [ ] Server-side middleware.ts created
- [ ] PITR confirmed enabled in Supabase
- [ ] DB restore tested on staging
- [ ] Sentry alerts → Slack configured
- [ ] Secrets exported to 1Password
- [ ] npm audit fix applied
- [ ] Circuit breaker migrated to Redis
- [ ] Cron jobs >30s migrated to Queues
- [ ] Health check expanded (Stripe, Storage, Redis)
- [ ] Uptime monitoring active
