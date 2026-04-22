#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Cloudflare secrets push — vitfix.io
# Lit .env.production (local, non commité) et pousse chaque secret vers CF.
#
# Prérequis :
#   1. wrangler login terminé
#   2. .env.production existe à la racine avec les clés CRITICAL/HIGH/MEDIUM
#   3. bash scripts/cf-provision.sh a déjà créé KV + Queues
#
# Usage : bash scripts/cf-secrets-template.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BOLD=$'\033[1m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; RED=$'\033[0;31m'; RESET=$'\033[0m'
info() { echo "${BOLD}${GREEN}▶${RESET} $*"; }
warn() { echo "${BOLD}${YELLOW}!${RESET} $*"; }
fail() { echo "${BOLD}${RED}✗${RESET} $*" >&2; exit 1; }

ENV_FILE="${ENV_FILE:-.env.production}"
[[ -f "$ENV_FILE" ]] || fail "Fichier introuvable : $ENV_FILE — crée-le d'abord (cp .env.local $ENV_FILE ; ajuster pour prod)"

# Tiers de secrets (ordre = priorité pour rollback rapide)
CRITICAL=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  NEXT_PUBLIC_APP_URL
  GROQ_API_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  STRIPE_PRICE_ARTISAN_PRO
  STRIPE_PRICE_SYNDIC_ESSENTIAL
  STRIPE_PRICE_SYNDIC_PREMIUM
)
HIGH=(
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  RESEND_API_KEY
  RESEND_FROM_EMAIL
  CRON_SECRET
  ENCRYPTION_KEY
  ADMIN_EMAIL
  INTERNAL_API_SECRET
)
MEDIUM=(
  TAVILY_API_KEY
  OPENROUTER_API_KEY
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  NEXT_PUBLIC_SENTRY_DSN
  SENTRY_AUTH_TOKEN
  SENTRY_ORG
  SENTRY_PROJECT
)
OPTIONAL=(
  LANGFUSE_SECRET_KEY
  LANGFUSE_PUBLIC_KEY
  LANGFUSE_HOST
  DOCUSEAL_API_KEY
  DOCUSEAL_API_URL
  RAPPORT_IA_ACTIF
  VITFIX_PT_NIF
  PT_FISCAL_CERT_NUMBER
  PT_FISCAL_PRIVATE_KEY
)

# Charge l'env file sans polluer le shell courant
load_env() {
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

push_secret() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    warn "  $name : absent de $ENV_FILE — skip"
    return
  fi
  echo -n "  $name : "
  # Echo value via stdin (wrangler secret put lit stdin)
  printf '%s' "$value" | npx wrangler pages secret put "$name" --project-name vitfix >/dev/null 2>&1 \
    && echo "${GREEN}ok${RESET}" \
    || echo "${RED}échec${RESET}"
}

push_tier() {
  local tier_name="$1"; shift
  local tier_vars=("$@")
  info "── Tier : $tier_name (${#tier_vars[@]} secrets) ──"
  for v in "${tier_vars[@]}"; do push_secret "$v"; done
  echo
}

load_env
info "Envoi des secrets vers Cloudflare Pages (projet : vitfix)…"
echo

push_tier "CRITICAL" "${CRITICAL[@]}"
push_tier "HIGH"     "${HIGH[@]}"
push_tier "MEDIUM"   "${MEDIUM[@]}"
push_tier "OPTIONAL" "${OPTIONAL[@]}"

info "Secrets poussés."
warn "Vérifier sur le dashboard : https://dash.cloudflare.com → Pages → vitfix → Settings → Environment variables"
