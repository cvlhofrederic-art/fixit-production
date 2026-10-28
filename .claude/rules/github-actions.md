# GitHub Actions — Workflows installés (19)

## Pipeline production
- `deploy-cloudflare.yml` — **Seul pipeline de prod**. Build OpenNext + `wrangler deploy`. Cf. [project_deploy_cloudflare_only](../../memory/project_deploy_cloudflare_only.md). Plus jamais Vercel.
- `post-deploy.yml` — Smoke tests post-déploiement Cloudflare.

## Workflows bloquants (PR)
- `tests.yml` — Vitest unitaires + Playwright E2E (chromium/firefox/webkit) + Axe-core WCAG
- `ci.yml` — Build production Next.js
- `code-quality.yml` — ESLint + `tsc --noEmit` + SonarCloud
- `lighthouse.yml` — Audit perf/a11y/SEO depuis sitemap (seuils : perf 80, a11y 90, SEO 90, BP 85)
- `security.yml` — CodeQL + TruffleHog + Semgrep (OWASP + JWT) + Giskard (prompts IA)
- `gitleaks.yml` — Secrets (binaire gitleaks 8.30.1 à somme vérifiée, config `security/.gitleaks.toml`) : état du dépôt sur push main et PR, plus commits base..head de la PR. Jamais de valeur de secret dans le dépôt (lot 1 Aikido, 28/10/2026) ; en local, `.husky/pre-commit` lance le même scan si gitleaks est installé. **Bloquant seulement une fois le check « Gitleaks — Scan des secrets » ajouté aux required status checks de `main` (Settings > Branches, action Frédéric) ; d'ici là le job est informatif et une PR rouge reste fusionnable.**
- `ai-eval.yml` — DeepEval régression prompts (sur modif fichiers IA uniquement)

## Workflows non-bloquants
- `security-daily.yml` — Scan sécurité quotidien (CodeQL + dépendances).
- `i18n.yml` — Comparaison clés FR/PT (warning si manquantes).
- `langfuse-eval.yml` — Éval nocturne qualité IA (crée issue si qualité < 0.7).
- `release.yml` — Release Please (changelog auto, préfixes : `feat` / `fix` / `ai` / `voice` / `perf`).

## Automatisations (cron, workflow_run, manuel)
- `indexnow-post-deploy.yml` — Ping IndexNow après « Deploy to Cloudflare Workers » (secret `INDEXNOW_KEY` au niveau de l'étape).
- `crons.yml` — Crons quotidiens (ex-wrangler.toml).
- `run-automations.yml` — Tempo, automatisations planifiées.
- `run-lea-documents-process.yml` — Léa documents, OCR/extraction en attente.
- `renew-gmail-watches.yml` — Renouvellement des watches Gmail (Alfredo).
- `ingest-legal-corpus-pt.yml` — Ingestion du corpus légal PT (manuel).

## Secrets requis (GitHub > Settings > Secrets > Actions)
- **Build** : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la clé anon est aussi passée au Worker au déploiement par l'entrée `vars` de wrangler-action : elle n'est plus dans `wrangler.toml`)
- **IndexNow** : `INDEXNOW_KEY` (même valeur que le secret Cloudflare `wrangler secret put INDEXNOW_KEY`, servi à `/indexnow-key.txt`) — absent : les pings IndexNow sont ignorés avec un `::warning::`
- **Cloudflare** : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Sentry** : `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_SENTRY_DSN`
- **SonarCloud** : `SONAR_TOKEN`
- **IA** (optionnels) : `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`, `GISKARD_API_KEY`
- **Langfuse** : `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`
