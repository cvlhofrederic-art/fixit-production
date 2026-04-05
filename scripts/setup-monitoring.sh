#!/bin/bash
# ── Setup monitoring externe — Exécuter une seule fois ────────────────────────
# Crée les monitors UptimeRobot + alert contacts pour fixit-production.
#
# Prérequis : créer un compte gratuit sur https://uptimerobot.com
# puis récupérer ta clé API : Dashboard > Integrations & API > API > Main API Key
#
# Usage : UPTIMEROBOT_API_KEY=ur_xxxxx bash scripts/setup-monitoring.sh

set -euo pipefail

SITE_URL="https://fixit-production.vercel.app"
API="https://api.uptimerobot.com/v2"

if [ -z "${UPTIMEROBOT_API_KEY:-}" ]; then
  echo "❌ Variable UPTIMEROBOT_API_KEY manquante."
  echo "   → Récupère-la sur https://uptimerobot.com > Integrations & API > API"
  echo "   → Puis relance : UPTIMEROBOT_API_KEY=ur_xxxxx bash $0"
  exit 1
fi

echo "=== Setup UptimeRobot pour $SITE_URL ==="

# 1. Health check endpoint (JSON, vérifie status 200)
echo "→ Création monitor: Health Check API"
curl -s -X POST "$API/newMonitor" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "api_key=$UPTIMEROBOT_API_KEY" \
  -d "friendly_name=Vitfix - Health Check" \
  -d "url=${SITE_URL}/api/health" \
  -d "type=1" \
  -d "interval=300" \
  -d "keyword_type=2" \
  -d "keyword_value=healthy" | python3 -m json.tool

echo ""

# 2. Homepage FR
echo "→ Création monitor: Homepage FR"
curl -s -X POST "$API/newMonitor" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "api_key=$UPTIMEROBOT_API_KEY" \
  -d "friendly_name=Vitfix - Homepage FR" \
  -d "url=${SITE_URL}/fr/" \
  -d "type=1" \
  -d "interval=300" | python3 -m json.tool

echo ""

# 3. Homepage PT
echo "→ Création monitor: Homepage PT"
curl -s -X POST "$API/newMonitor" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "api_key=$UPTIMEROBOT_API_KEY" \
  -d "friendly_name=Vitfix - Homepage PT" \
  -d "url=${SITE_URL}/pt/" \
  -d "type=1" \
  -d "interval=300" | python3 -m json.tool

echo ""

# 4. Stripe webhook endpoint (vérifie qu'il répond, même en 405)
echo "→ Création monitor: Stripe Webhook"
curl -s -X POST "$API/newMonitor" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "api_key=$UPTIMEROBOT_API_KEY" \
  -d "friendly_name=Vitfix - Stripe Webhook" \
  -d "url=${SITE_URL}/api/stripe/webhook" \
  -d "type=1" \
  -d "interval=600" | python3 -m json.tool

echo ""
echo "=== Monitors créés ==="
echo ""
echo "📋 Étapes manuelles restantes :"
echo "   1. UptimeRobot Dashboard > ajouter un Alert Contact (email ou Slack webhook)"
echo "   2. Associer l'alert contact aux 4 monitors créés"
echo "   3. Sentry > Alerts > Create Alert Rule :"
echo "      - Condition: 'Number of events > 5 in 5 minutes'"
echo "      - Action: 'Send notification to email/Slack'"
echo "   4. Vercel > Settings > Notifications > activer Slack/email pour deploy failures"
echo "   5. Supabase > Organization > Billing > activer les budget alerts"
echo "   6. Vérifier MFA activé sur : GitHub, Vercel, Supabase, Stripe"
