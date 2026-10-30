# GitHub Actions — Workflows installés (17)

## Règles communes (lot 6 Aikido, 28/10/2026 — `zizmor .github/workflows` à 0 finding High/Medium)
- `permissions: {}` au niveau du workflow (ou `contents: read` seul) ; les droits d'écriture sont déclarés par job, jamais `write-all` ni `read-all`.
- Toute action épinglée par SHA de commit (`uses: owner/repo@<sha> # vX.Y.Z`), toute image de conteneur par digest (`image: ns/repo:tag@sha256:…`).
- `persist-credentials: false` sur chaque `actions/checkout` (aucun job ne pousse avec le jeton par défaut).
- Jamais d'expression `${{ … }}` dans un `run:` : secrets, `github.*`, `inputs.*`, `matrix.*`, `needs.*`, `steps.*` passent par `env:`.
- Jamais de trigger `workflow_run` ni `pull_request_target` : un traitement « après déploiement » est un job `needs: deploy` du pipeline lui-même.
- Pas de cache npm dans le workflow de déploiement (`package-manager-cache: false`) ; paquets installés à la volée épinglés (`pip install x==…`, `npm install x@…`).

## Pipeline production
- `deploy-cloudflare.yml` — **Seul pipeline de prod**, trois jobs en chaîne : `deploy` (build OpenNext, garde du pré-rendu `scripts/seo/verifier-prerendu.mjs`, copie de `.open-next/cache` dans `.open-next/assets/cdn-cgi/_next_cache`, puis `wrangler deploy`, `environment: production`, smoke test immédiat `/`, `/fr`, `/robots.txt`). La copie est indispensable : les pages pré-rendues sont servies par le cache OpenNext en assets statiques, en lecture seule (`open-next.config.ts`) ; sans elle, le Worker rend chaque page à la demande → `smoke-test` (après 30 s de propagation : `/api/health`, `/fr/`, `/pt/`, `x-nextjs-cache: HIT` attendu sur `/pt/servicos/canalizador-porto/` avec un avertissement sinon, consigne de rollback en cas d'échec) → `indexnow` (sur `main` seulement : soumet à IndexNow toutes les URL de tous les sitemaps, secret `INDEXNOW_KEY` au niveau de l'étape, issue `seo-alert` en cas de HTTP 429). `post-deploy.yml` et `indexnow-post-deploy.yml` (trigger `workflow_run`) ont été repliés ici le 28/10/2026 : un seul ping IndexNow par déploiement. Le job `indexnow` est en `continue-on-error: true` (SEO best-effort : un échec du ping laisse le run de déploiement vert, le job apparaît en échec dans le graphe et ses annotations dans le résumé). Il n'a plus de déclencheur manuel propre : pour re-pinger sans nouveau commit (ex. après un HTTP 429), relancer « Deploy to Cloudflare Workers » par `workflow_dispatch` sur `main` (même code redéployé, puis `smoke-test` et `indexnow`). `smoke-test` tourne avec `permissions: {}` (ni checkout ni API GitHub). Cf. [project_deploy_cloudflare_only](../../memory/project_deploy_cloudflare_only.md). Plus jamais Vercel.

## Workflows bloquants (PR)
- `tests.yml` — Vitest unitaires + Playwright E2E (chromium/firefox/webkit) + Axe-core WCAG
- `ci.yml` — Build production Next.js, puis garde du pré-rendu des pages SEO (`scripts/seo/verifier-prerendu.mjs` : planchers par section, pages témoins, aucun `revalidate`)
- `code-quality.yml` — ESLint + `tsc --noEmit` + actionlint (reviewdog) + migrations SQL + SonarQube Cloud (`SonarSource/sonarqube-scan-action`, successeur de l'action SonarCloud archivée)
- `lighthouse.yml` — Audit perf/a11y/SEO depuis sitemap (seuils : perf 80, a11y 90, SEO 90, BP 85)
- `security.yml` — CodeQL + TruffleHog + Semgrep (OWASP + JWT) + Trivy + Giskard (prompts IA)
- `gitleaks.yml` — Secrets (binaire gitleaks 8.30.1 à somme vérifiée, config `security/.gitleaks.toml`) : état du dépôt sur push main et PR, plus commits base..head de la PR. Jamais de valeur de secret dans le dépôt (lot 1 Aikido, 28/10/2026) ; en local, `.husky/pre-commit` lance le même scan si gitleaks est installé. **Bloquant seulement une fois le check « Gitleaks — Scan des secrets » ajouté aux required status checks de `main` (Settings > Branches, action Frédéric) ; d'ici là le job est informatif et une PR rouge reste fusionnable.**
- `ai-eval.yml` — DeepEval régression prompts (sur modif fichiers IA uniquement)

## Workflows non-bloquants
- `security-daily.yml` — Scan sécurité quotidien (Trivy, gitleaks binaire sur tout l'historique, Nuclei, Semgrep ; issue si échec).
- `i18n.yml` — Comparaison clés FR/PT (warning si manquantes).
- `langfuse-eval.yml` — Éval nocturne qualité IA (crée issue si qualité < 0.7).
- `release.yml` — Release Please (changelog auto, préfixes : `feat` / `fix` / `ai` / `voice` / `perf`) ; `contents: write` et `pull-requests: write` sur le seul job `release`.

## Automatisations (cron, manuel)
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
