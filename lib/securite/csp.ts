/**
 * Content-Security-Policy de Vitfix : une seule définition, deux points de pose qui ne se recouvrent jamais.
 *
 * - middleware.ts la pose sur toutes les réponses qu'il traite ;
 * - next.config.ts headers() la pose UNIQUEMENT sur les chemins que le matcher du middleware exclut (fichiers
 *   .png/.txt/.xml…, manifest, .well-known) : des routes dynamiques y servent aussi des pages HTML
 *   (ex. /fr/artisan/foo.png).
 * Sur OpenNext/Cloudflare, les en-têtes de la config s'AJOUTENT à ceux du middleware (clés de casse différente) : une
 * CSP posée aux deux endroits ferait appliquer deux politiques par le navigateur. Test :
 * tests/securite/csp-politique-unique.test.ts.
 *
 * GA4 (Google Analytics 4) : script depuis www.googletagmanager.com, mesures vers *.google-analytics.com (dont
 * region1 pour les visiteurs de l'UE) et *.analytics.google.com. Chargé UNIQUEMENT après consentement
 * (components/common/ConsentAnalytics.tsx).
 *
 * Module sans dépendance : importé par le middleware (edge) et par next.config.ts (chargé au build).
 */
export const POLITIQUE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://static.cloudflareinsights.com https://*.sentry.io https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.groq.com https://recherche-entreprises.api.gouv.fr https://api-adresse.data.gouv.fr https://nominatim.openstreetmap.org https://geocoding-api.open-meteo.com https://api.open-meteo.com https://*.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://cloudflareinsights.com https://*.google-analytics.com https://www.googletagmanager.com https://*.analytics.google.com https://*.g.doubleclick.net",
  "frame-src 'self' https://js.stripe.com https://*.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "worker-src 'self' blob:",
].join('; ')

/** Extensions que le matcher de middleware.ts exclut (liste identique, vérifiée par le test : le matcher reste littéral). */
export const EXTENSIONS_HORS_MIDDLEWARE = 'svg|png|jpg|jpeg|gif|webp|avif|woff2|woff|ico|mp4|xml|txt|webmanifest'
