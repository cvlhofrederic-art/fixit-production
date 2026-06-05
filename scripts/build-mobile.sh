#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Fixit Pro — Script de build pour l'application mobile (Capacitor)
# Usage:
#   chmod +x scripts/build-mobile.sh
#   ./scripts/build-mobile.sh [ios|android|both]
# ─────────────────────────────────────────────────────────────────

set -e

PLATFORM="${1:-both}"
echo "🏗️  Build Fixit Pro Mobile — Plateforme: $PLATFORM"

# 0. Pré-flight : valider la compatibilité mobile (SSR-only imports interdits)
echo ""
echo "🧪 Étape 0 : Vérification compatibilité mobile..."
bash "$(dirname "$0")/check-mobile-compat.sh"

# 1. Build Next.js en mode export statique
echo ""
echo "📦 Étape 1/4 : Build Next.js (export statique)..."
cp next.config.ts next.config.backup.ts 2>/dev/null || true
cat > next.config.ts << 'EOF'
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
EOF

# MOBILE_BUILD=true : signale aux guards applicatifs (app/layout.tsx, etc.) de
# skipper les appels SSR-only (cookies(), headers()) qui crashent en export.
# NEXT_PUBLIC_API_URL : embed dans le bundle JS pour absolutiser les fetch
# vers l'API depuis l'app Capacitor (origine capacitor://localhost ne peut
# pas résoudre les paths /api/ relatifs).
export MOBILE_BUILD=true
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://vitfix.io}"

npm run build

# Restore original config
cp next.config.backup.ts next.config.ts 2>/dev/null || true

echo "✅ Build Next.js terminé — dossier 'out/' créé"

# 2. Sync avec Capacitor
echo ""
echo "🔄 Étape 2/4 : Synchronisation Capacitor..."
npx cap sync

echo "✅ Synchronisation terminée"

# 3. Ouvrir les projets natifs
echo ""
echo "📱 Étape 3/4 : Ouverture des projets natifs..."

if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "both" ]; then
  echo "🍎 Ouverture Xcode (iOS)..."
  npx cap open ios
fi

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "both" ]; then
  echo "🤖 Ouverture Android Studio..."
  npx cap open android
fi

echo ""
echo "✅ ─────────────────────────────────────────────────"
echo "   Build terminé ! Fixit Pro est prêt."
echo ""
echo "   📋 Prochaines étapes :"
echo "   1. Dans Xcode/Android Studio → Configurer les identifiants de signature"
echo "   2. Changer l'ID d'app si nécessaire (actuellement : com.fixit.artisan)"
echo "   3. Uploader sur App Store Connect / Google Play Console"
echo "   ─────────────────────────────────────────────────"
