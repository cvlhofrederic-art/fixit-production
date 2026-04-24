# Vitfix.io — Security & Compliance Audit (Phase 3)

> Date: 2026-04-24 | Codebase: fixit-production | Deploy: Cloudflare Workers

---

## 1. Authentication & Authorization

### Implementation actuelle

| Composant | Statut | Detail |
|-----------|--------|--------|
| Auth provider | Supabase Auth (JWT + cookies HTTP-only) | SPOF — pas de fallback |
| OAuth/SSO | Google OAuth uniquement (clients particuliers) | Pas de SAML, pas d'Apple/Facebook |
| 2FA/MFA | **NON IMPLEMENTE** | Pas de TOTP, SMS, ni authenticator |
| Password policy | 8 chars, 1 maj, 1 min, 1 chiffre | Pas de detection breach (HIBP), pas d'historique |
| Brute force | 5 echecs/15min par IP → soft lockout (429) | Pas d'exponential backoff, retry illimite apres 15min |
| Session | JWT 15-30s cache, refresh auto Supabase | Pas de limite sessions concurrentes, pas de revocation par device |
| RBAC | 7 roles (artisan, pro_societe, syndic, super_admin, etc.) | `app_metadata.role` non forgeable, verification server-side |
| Cabinet isolation | `resolveCabinetId()` + `verifyCabinetOwnership()` | Cache 60s — fenetre de revocation |
| API key rotation | Manuelle via dashboards | Pas de rotation automatique, pas de versioning |

### Risques auth

```
Risk                                  | Prob.   | Impact  | Score | Action
--------------------------------------|---------|---------|-------|--------
Pas de 2FA/MFA                        | Haute   | Haute   | 8/10  | Implémenter TOTP via Supabase Auth
Soft lockout sans backoff exponentiel  | Haute   | Moyenne | 6/10  | Ajouter backoff 1min→5min→15min→1h
Pas de detection mot de passe compromis| Moyenne | Haute   | 6/10  | Intégrer HIBP API à l'inscription
Sessions concurrentes illimitees       | Basse   | Moyenne | 4/10  | Tracker devices, permettre revocation
Google OAuth seul (pas d'Apple/SAML)   | Basse   | Basse   | 2/10  | Ajouter Apple Sign-In si mobile
```

---

## 2. API Security

### Rate limiting

| Endpoint | Limite | Fenetre | Fallback |
|----------|--------|---------|----------|
| Login | 10/IP + 5 echecs/email | 60s + 900s | In-memory |
| Password reset | 3/IP | 300s | In-memory |
| Export data | 5/user | 60s | In-memory |
| Delete account | 3/user | 60s | In-memory |
| Factur-X generate | 10/IP | 60s | In-memory |
| General API | 20/identifier | 60s | In-memory |
| AI endpoints | **PAS DE RATE LIMIT SPECIFIQUE** | — | — |
| Stripe webhook | **PAS DE RATE LIMIT** | — | — |

### CORS

- Origin validation sur toutes les mutations (POST/PATCH/PUT/DELETE) dans `proxy.ts`
- Origins autorisees : `vitfix.io`, `localhost:3000`, `capacitor://localhost`, `fixit-production.vercel.app`
- Requetes sans header Origin acceptees (server-to-server)
- `capacitor://localhost` trop permissif (accepte tout localhost)

### SQL Injection

- **Protege** : Supabase SDK utilise des requetes parametrees
- **RLS** : 60+ policies couvrant toutes les tables publiques
- **Risque** : 197 routes utilisent `supabaseAdmin` (bypass RLS) — si une route a un bug d'auth, acces DB complet

### XSS Prevention

| Mecanisme | Statut | Detail |
|-----------|--------|--------|
| `escapeHTML()` | OK | Echappe &, <, >, ", ' avant traitement markdown |
| `purifyHTML()` | OK | Strip tags non-autorises + attributs `on*` + `javascript:` |
| `safeMarkdownToHTML()` | OK | Pipeline complet : escape → markdown → purify |
| `sanitizeInput()` | OK | Strip tous les tags HTML pour stockage |
| CSP nonce | OK en prod | `strict-dynamic` avec nonce genere par `proxy.ts` |
| CSP `unsafe-inline` | **DEV ONLY** | En prod, nonce-based. `style-src 'unsafe-inline'` reste (Tailwind) |

**Points XSS restants :**
- `ResumeActivite.tsx:140,158` — inline `.replace()` sans `safeMarkdownToHTML()` (donnees IA)
- `ArquivoDigitalSection.tsx:412` — `DOMPurify.sanitize()` avec regex sur input utilisateur

### CSRF

- Origin checking dans `proxy.ts` (pas de token CSRF explicite)
- SameSite=lax sur les cookies en prod
- `form-action 'self'` dans CSP
- **Suffisant** pour l'architecture actuelle (SPA + API, pas de forms classiques)

---

## 3. Data Protection

### Encryption

| Couche | Statut | Detail |
|--------|--------|--------|
| In transit | TLS 1.2+ (Cloudflare + Supabase) | HSTS 2 ans + preload |
| At rest (DB) | Supabase default (AES-256) | Pas de chiffrement par colonne |
| At rest (storage) | Supabase default | Buckets proteges par RLS |
| OAuth tokens | AES chiffre via `ENCRYPTION_KEY` | Stockes dans `syndic_oauth_tokens` |
| Passwords | bcrypt (Supabase Auth) | Pas d'historique de passwords |

### Secrets management

| Aspect | Statut |
|--------|--------|
| Secrets en code | **0** — tout via env vars |
| `.env` en clair sur disque | **OUI** — `.env.sentry` contient toutes les cles prod |
| Rotation automatique | **NON** — manuelle sur chaque dashboard |
| Backup des secrets | **NON** — pas d'export chiffre vers 1Password |
| Scan secrets CI | **OUI** — TruffleHog + Gitleaks dans `security.yml` |

### PII dans les logs

| Service | Redaction PII | Detail |
|---------|--------------|--------|
| Sentry | Partiel | Emails/phones rediges via regex, mais stack traces peuvent fuiter |
| Logger server | Email masking | `jo***@domain.fr` dans audit_logs |
| Console.log | **NON** | 40+ routes avec `console.error` contenant potentiellement du PII |

### Data retention

| Categorie | Retention definie | Cron actif |
|-----------|------------------|------------|
| Audit logs | 1 an | Oui (hebdo) |
| Analytics events | 90 jours | Oui (hebdo) |
| Idempotency keys | 24h | Oui (horaire) |
| Bookings | 3 ans puis anonymiser | **NON** — cron commente |
| Factures/devis | 6 ans FR / 10 ans PT | **NON** — archivage pas implemente |
| Photos/storage | Duree du compte | **NON** — pas de cleanup orphelins |
| Conversations IA | Non definie | **NON** |

---

## 4. RGPD Compliance

### Score global : 65/100

### Droits des utilisateurs

| Droit RGPD | Article | Statut | Implementation |
|------------|---------|--------|---------------|
| Information | Art. 13-14 | OK | `/confidentialite/page.tsx` — FR, PT, EN |
| Acces | Art. 15 | OK | `/api/user/export-data` — JSON complet, rate-limited |
| Rectification | Art. 16 | OK | Via dashboard profil |
| Effacement | Art. 17 | OK | `/api/user/delete-account` — cascade 26+ tables, confirmation explicite |
| Portabilite | Art. 20 | OK | Export JSON + CSV (`/api/user/export-csv`) |
| Opposition | Art. 21 | Partiel | DPO contact mais pas de bouton in-app |
| Limitation | Art. 18 | **NON** | Pas de mecanisme de gel de traitement |

### Consentement cookies

| Aspect | Statut |
|--------|--------|
| Banniere cookie | OK — 4 categories (necessaire, performance, personnalisation, publicite) |
| Granularite | OK — opt-in par categorie |
| Re-consentement | 12 mois (best practice) |
| Gate analytics | OK — Cloudflare beacon uniquement si consent.performance === true |
| Historique consent | **NON** — localStorage uniquement, pas de table DB |
| Version tracking | **NON** — pas de versioning de la politique |

### Sous-traitants declares

| Vendor | DPA | Region | Risque |
|--------|-----|--------|--------|
| Supabase | Auto via ToS | EU (Irlande) | Faible |
| Stripe | Standard | RGPD-compliant | Faible |
| Sentry | Disponible | EU (Allemagne) | Faible |
| Resend | Disponible | EU (Berlin) | Faible |
| Cloudflare | Standard | Multi-region | Faible |
| DocuSeal | Disponible | EU (eIDAS) | Faible |
| **Groq** | **AUCUN** | **US** | **CRITIQUE** — recoit conversations, adresses, descriptions problemes |
| **Tavily** | **AUCUN** | **US** | Moyen — recherche web materiaux |
| **OpenRouter** | **AUCUN** | **US** | Moyen — fallback LLM |
| **Langfuse** | **AUCUN** | **US** | Moyen — prompts + reponses IA stockes |
| **Upstash** | **Non verifie** | **US ?** | Moyen — rate limiting data |

### Documents RGPD

| Document | Statut | Localisation |
|----------|--------|-------------|
| Politique de confidentialite | OK | `/app/confidentialite/page.tsx` |
| Page "Mes donnees" | OK | `/app/confidentialite/mes-donnees/page.tsx` |
| Politique retention | OK | `/docs/data-retention-policy.md` |
| Procedure breach | OK | `/docs/incident-response-breach.md` |
| Runbook incident | OK | `/docs/incident-runbook.md` |
| Registre de traitement (ROPA) | **MANQUANT** | A creer |
| Registre des violations | **MANQUANT** | Table DB a creer |
| DPA avec providers IA | **MANQUANT** | A signer |

---

## 5. Dependencies & CVE

### Vulnerabilites bloquantes

| Package | Version | CVE | Severite | Impact |
|---------|---------|-----|----------|--------|
| **jsPDF** | 4.2.1 | GHSA-7x6v, GHSA-wfv2 | CRITIQUE | PDF Object Injection + HTML Injection dans generation factures |
| **Next.js** | 16.2.2 | GHSA-q4gf | HAUTE | DoS via Server Components |

### Infrastructure de scan

| Outil | Declencheur | Bloquant CI | Detail |
|-------|------------|-------------|--------|
| CodeQL | PR + weekly | Oui | Analyse statique |
| TruffleHog | PR + weekly | Oui | Secrets (verified only) |
| Semgrep | PR + daily | Oui | OWASP + JWT + custom rules XSS/SQLi |
| Giskard | PR (fichiers IA) | Oui | Prompt injection detection |
| Trivy | PR + daily | CRITICAL bloque, HIGH warn | Deps vulnerables |
| Gitleaks | PR + daily | Oui | Secrets dans le code |
| Nuclei | Daily (vitfix.io) | Non | DAST web scanning |

### Sante des dependances

| Metrique | Valeur |
|----------|--------|
| Dependencies prod | 32 |
| DevDependencies | 19 |
| Packages a jour | 30/32 |
| Supply chain attacks | 0 detecte |
| Secrets dans le code | 0 |
| CVE bloquantes | **2** (jsPDF + Next.js) |

---

## 6. Risk Matrix consolidee

```
Risk                                    | Prob.   | Impact    | Score | Priorite
----------------------------------------|---------|-----------|-------|----------
DPA manquants providers IA (Groq, etc.) | Haute   | Critique  | 9/10  | FIX NOW
jsPDF CVE (injection PDF)               | Moyenne | Critique  | 8/10  | FIX NOW
Next.js CVE (DoS Server Components)     | Moyenne | Haute     | 7/10  | FIX NOW
Pas de 2FA/MFA                          | Haute   | Haute     | 8/10  | FIX ASAP
.env.sentry en clair sur disque local   | Haute   | Critique  | 8/10  | FIX ASAP
Crons retention/anonymisation inactifs  | Haute   | Haute     | 7/10  | FIX ASAP
ROPA (registre traitement) manquant     | Haute   | Moyenne   | 6/10  | Plan sprint
Historique consent pas en DB            | Moyenne | Moyenne   | 5/10  | Plan sprint
Rate limit absent sur endpoints IA      | Haute   | Moyenne   | 6/10  | Plan sprint
Pas de chiffrement par colonne (PII)    | Basse   | Haute     | 5/10  | Plan trimestre
Soft lockout sans backoff exponentiel   | Moyenne | Moyenne   | 5/10  | Plan sprint
supabaseAdmin partout (bypass RLS)      | Basse   | Haute     | 5/10  | Plan trimestre
XSS residuels (2 composants)            | Basse   | Moyenne   | 4/10  | Plan sprint
Privacy policy incomplete (IA providers)| Haute   | Moyenne   | 6/10  | FIX ASAP
```

---

## 7. Plan de remediation

### Immediat (< 48h)

| # | Action | Effort |
|---|--------|--------|
| 1 | `npm update jspdf` — corriger CVE injection PDF | 15min |
| 2 | `npm update next` — corriger CVE DoS Server Components | 30min |
| 3 | Supprimer `.env.sentry` et `.env.vercel` du disque local | 5min |
| 4 | Mettre a jour la privacy policy : ajouter Groq, Tavily, OpenRouter, Langfuse | 2h |

### Semaine 1

| # | Action | Effort |
|---|--------|--------|
| 5 | Contacter Groq pour signer un DPA (ou evaluer Mistral AI, EU-based) | 1-2j |
| 6 | Activer les crons pg_cron : anonymisation bookings 3 ans, cleanup audit_logs | 2h |
| 7 | Ajouter rate limit specifique sur `/api/fixy-ai`, `/api/comptable-ai`, `/api/materiaux-ai` (1 req/5s/user) | 2h |
| 8 | Implementer backoff exponentiel sur le login lockout (1min → 5min → 15min → 1h) | 3h |
| 9 | Fixer XSS dans `ResumeActivite.tsx` (utiliser `safeMarkdownToHTML()`) | 30min |

### Sprint suivant

| # | Action | Effort |
|---|--------|--------|
| 10 | Creer le ROPA (Registre de Traitement Art. 30) dans `docs/ROPA.md` | 2-3j |
| 11 | Creer table `consent_records` pour historique consentement en DB | 1j |
| 12 | Ajouter 2FA/MFA optionnel via Supabase Auth (TOTP) | 3-5j |
| 13 | Integrer HIBP API pour detection mots de passe compromis a l'inscription | 1j |
| 14 | Verifier region Upstash Redis — migrer vers EU (Frankfurt) si US | 0.5j |
| 15 | Creer table `data_breaches` pour registre des violations | 1j |

### Plan trimestre

| # | Action | Effort |
|---|--------|--------|
| 16 | Migrer progressivement de `supabaseAdmin` vers client user-scoped (defense in depth) | 2-3 sprints |
| 17 | Ajouter chiffrement par colonne pour emails/telephones (pgcrypto) | 1 sprint |
| 18 | Tracking sessions par device + revocation | 1 sprint |
| 19 | Audit WCAG 2.1 AA externe | Budget 5-10k |
| 20 | Procedure DPA exit strategy pour chaque vendor critique | 2-3j |

---

## 8. Conformite par juridiction

### France

| Obligation | Statut |
|------------|--------|
| RGPD droits utilisateurs | OK (export, suppression, rectification) |
| Cookie consent (CNIL) | OK (banniere granulaire, re-consent 12 mois) |
| Factur-X (EN 16931) | OK (PDF/A-3 avec XML embarque) |
| RC Pro obligatoire artisans | OK (verifie a l'inscription) |
| Conservation factures 6 ans | **PARTIEL** — pas d'archivage automatise |
| Franchise TVA 293B | OK |
| DPO designe | OK (`dpo@vitfix.io`) |

### Portugal

| Obligation | Statut |
|------------|--------|
| RGPD/CNPD | OK |
| SAF-T compliance | OK (ATCUD, QR code, hash chain) |
| NIF validation (modulo 11) | OK |
| Conservation fiscale 10 ans | **PARTIEL** — pas d'archivage automatise |
| IVA seuil 14 500 | OK |

---

## 9. Points forts

1. **Defense in depth** : RLS + verification ownership server-side + middleware role checks
2. **7 outils de scan securite** en CI (CodeQL, Semgrep, Trivy, TruffleHog, Gitleaks, Nuclei, Giskard)
3. **Export/suppression RGPD** completement implementes avec cascade 26+ tables
4. **Cookie consent granulaire** avec gate analytics
5. **CSP nonce-based** en production avec `strict-dynamic`
6. **Audit trail** avec masking email + retention 1 an
7. **Input validation Zod** sur 89% des routes (110/124)
8. **Breach response** documente avec timeline CNIL/CNPD 72h

## 10. Faiblesses critiques

1. **DPA manquants** avec 4 providers IA US (Groq, Tavily, OpenRouter, Langfuse) — non-conformite RGPD Art. 28
2. **Pas de 2FA/MFA** — risque compromission comptes sensibles (syndics, admins)
3. **2 CVE bloquantes** (jsPDF + Next.js) non patchees
4. **Secrets en clair** sur disque local (`.env.sentry`)
5. **Crons anonymisation/retention** commentes — non-conformite politique de retention declaree
