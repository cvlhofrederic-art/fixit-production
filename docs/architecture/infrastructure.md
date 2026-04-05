# Vitfix — Infrastructure & DevOps Diagram

> Dernière mise à jour : 5 avril 2026

---

## 1. Infrastructure de production

```mermaid
graph TB
    subgraph Users["Utilisateurs"]
        BROWSER[Navigateur Web]
        MOBILE[App Mobile<br/>Capacitor iOS/Android]
    end

    subgraph Vercel["Vercel — Hosting"]
        EDGE[Edge Network / CDN<br/>Static assets, images]
        SSR[Serverless Functions<br/>API routes, SSR pages]
        CRON[Vercel Cron<br/>11 jobs planifiés]
    end

    subgraph Supabase["Supabase — Backend"]
        PG[(PostgreSQL<br/>+ RLS 41 policies)]
        AUTH[Auth<br/>JWT + OAuth]
        STORE[Storage<br/>5 buckets RLS]
        BACKUP[Backups<br/>Daily, 7j retention]
    end

    subgraph AI["Services IA"]
        GROQ[Groq API<br/>Llama 3.3 70B + 8B fallback]
        TAVILY[Tavily API<br/>Recherche matériaux]
    end

    subgraph Payments["Paiements"]
        STRIPE[Stripe<br/>Checkout + Webhooks]
    end

    subgraph Observability["Observabilité"]
        SENTRY[Sentry<br/>Errors + Traces 10%]
        LANGFUSE[Langfuse<br/>LLM tracing]
    end

    subgraph Security["Sécurité runtime"]
        UPSTASH[Upstash Redis<br/>Rate limiting]
        CB[Circuit Breaker<br/>Groq + Gov APIs]
    end

    subgraph Email["Email"]
        RESEND[Resend<br/>Transactionnel]
        GMAIL[Gmail API<br/>Email Agent syndic]
    end

    BROWSER --> EDGE
    MOBILE --> EDGE
    EDGE --> SSR
    SSR --> PG
    SSR --> AUTH
    SSR --> STORE
    SSR --> GROQ
    SSR --> STRIPE
    SSR --> RESEND
    SSR --> UPSTASH
    SSR --> SENTRY
    SSR --> LANGFUSE
    SSR --> TAVILY
    SSR --> GMAIL
    SSR --> CB
    CRON --> SSR
    STRIPE -->|Webhook| SSR
    PG --> BACKUP
    GROQ -.->|Fallback 8B| GROQ
```

---

## 2. Pipeline CI/CD

```mermaid
graph LR
    subgraph Dev["Développement"]
        CODE[Push / PR]
    end

    subgraph CI["GitHub Actions — Bloquant"]
        BUILD[ci.yml<br/>Build prod]
        TESTS[tests.yml<br/>Vitest + Playwright + Axe]
        QUALITY[code-quality.yml<br/>ESLint + tsc + SonarCloud]
        SEC[security.yml<br/>CodeQL + TruffleHog<br/>+ Semgrep + Giskard + Trivy]
        LH[lighthouse.yml<br/>Perf/A11y/SEO audit]
        AIEVAL[ai-eval.yml<br/>DeepEval prompts]
    end

    subgraph NonBlock["GitHub Actions — Non-bloquant"]
        I18N[i18n.yml<br/>Clés FR/PT]
        RELEASE[release.yml<br/>Changelog auto]
        LANGEVAL[langfuse-eval.yml<br/>Nightly IA quality]
    end

    subgraph Deploy["Déploiement"]
        VERCEL[Vercel auto-deploy<br/>Push main]
        SMOKE[post-deploy.yml<br/>Smoke test production]
    end

    CODE --> BUILD & TESTS & QUALITY & SEC & LH & AIEVAL
    CODE --> I18N & RELEASE
    BUILD -->|main only| VERCEL
    VERCEL --> SMOKE
```

---

## 3. Flux réseau & sécurité

```mermaid
graph TB
    subgraph Internet
        CLIENT[Client HTTP]
    end

    subgraph Edge["Vercel Edge"]
        TLS[TLS 1.3<br/>Auto-managed]
        CDN_CACHE[CDN Cache<br/>Static: 1 year immutable]
        MW[Middleware<br/>CSP + HSTS + CSRF + i18n + RBAC]
    end

    subgraph App["Application"]
        RATE[Rate Limiter<br/>Upstash Redis<br/>20 req/60s default]
        VALID[Validation<br/>Zod schemas]
        SANIT[Sanitization<br/>DOMPurify]
        API[API Route Handler]
    end

    subgraph DB["Base de données"]
        RLS[Row-Level Security<br/>auth.uid() checks]
        PG2[(PostgreSQL)]
    end

    CLIENT -->|HTTPS| TLS
    TLS --> CDN_CACHE
    CDN_CACHE -->|Dynamic| MW
    MW --> RATE
    RATE -->|429 si dépassé| CLIENT
    RATE --> VALID
    VALID --> SANIT
    SANIT --> API
    API -->|service_role + RLS| RLS
    RLS --> PG2
```

---

## 4. Headers de sécurité

| Header | Valeur |
|--------|--------|
| Content-Security-Policy | `default-src 'self'; script-src stripe.com, vercel, sentry` |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| X-XSS-Protection | `1; mode=block` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | camera, microphone, geolocation restricted |

---

## 5. Cron jobs

| Job | Fréquence | Route |
|-----|-----------|-------|
| Health check | Daily 6h | `/api/health` |
| Email agent poll | Daily 8h | `/api/email-agent/poll` |
| Referral sync | Daily 2h | `/api/cron/referral` |
| Tender scan | Lundi 5h | `/api/tenders/scan` |
| DECP sync | Lundi 7h | `/api/sync/decp-13` |
| SITADEL sync | Lundi 7h | `/api/sync/sitadel-13` |
| Mairies sync | Lundi 7h30 | `/api/sync/mairies-13` |
| Base GOV PT | Lundi 8h | `/api/sync/base-gov-pt` |
| TED Porto | Lundi 8h30 | `/api/sync/ted-porto` |
| Obras Porto | Lundi 9h | `/api/sync/obras-porto` |

---

## 6. Métriques de résilience

| Composant | Stratégie | Config |
|-----------|-----------|--------|
| Groq API | Circuit breaker + model fallback | 5 failures → open, 30s reset, 70B → 8B |
| Gov APIs | Circuit breaker | 3 failures → open, 60s reset |
| Rate limiting | Upstash Redis + in-memory fallback | 20 req/60s, fallback 10k entries max |
| DB backups | Supabase auto | Daily, 7j retention |
| Code rollback | Vercel promote | Manuel via dashboard |
