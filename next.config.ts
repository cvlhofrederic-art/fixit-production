import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  trailingSlash: true,
  experimental: {
    optimizePackageImports: ['sonner', 'recharts', 'jspdf', '@supabase/supabase-js', 'date-fns', 'lucide-react', 'pdf-lib', 'zod'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
  // Locale routing: PT pages live in app/pt/, FR pages in app/fr/
  // Rewrites only needed for shared pages at root (auth, pro, client, syndic, etc.)
  async rewrites() {
    return {
      beforeFiles: [
        // ── Shared root pages accessible via /fr/ prefix ──
        { source: '/fr/auth/:path*', destination: '/auth/:path*' },
        { source: '/fr/pro/:path*', destination: '/pro/:path*' },
        // /fr/artisan/dashboard → dashboard (évite le conflit avec la route SEO /fr/artisan/[id])
        { source: '/fr/artisan/dashboard', destination: '/artisan/dashboard' },
        { source: '/fr/artisan/dashboard/', destination: '/artisan/dashboard/' },
        { source: '/fr/artisan/dashboard/:path*', destination: '/artisan/dashboard/:path*' },
        { source: '/fr/client/:path*', destination: '/client/:path*' },
        { source: '/fr/syndic/:path*', destination: '/syndic/:path*' },
        { source: '/fr/admin/:path*', destination: '/admin/:path*' },
        { source: '/fr/coproprietaire/:path*', destination: '/coproprietaire/:path*' },
        { source: '/fr/contact', destination: '/contact' },
        { source: '/fr/contact/', destination: '/contact/' },
        { source: '/fr/confirmation', destination: '/confirmation' },
        { source: '/fr/confirmation/', destination: '/confirmation/' },
        { source: '/fr/confidentialite', destination: '/confidentialite' },
        { source: '/fr/confidentialite/', destination: '/confidentialite/' },
        { source: '/fr/cookies', destination: '/cookies' },
        { source: '/fr/cookies/', destination: '/cookies/' },
        { source: '/fr/tracking/:path*', destination: '/tracking/:path*' },
        // ── Shared root pages accessible via /pt/ prefix ──
        { source: '/pt/auth/:path*', destination: '/auth/:path*' },
        { source: '/pt/pro/:path*', destination: '/pro/:path*' },
        { source: '/pt/artisan/dashboard', destination: '/artisan/dashboard' },
        { source: '/pt/artisan/dashboard/', destination: '/artisan/dashboard/' },
        { source: '/pt/artisan/dashboard/:path*', destination: '/artisan/dashboard/:path*' },
        { source: '/pt/client/:path*', destination: '/client/:path*' },
        { source: '/pt/syndic/:path*', destination: '/syndic/:path*' },
        { source: '/pt/admin/:path*', destination: '/admin/:path*' },
        { source: '/pt/coproprietaire/:path*', destination: '/coproprietaire/:path*' },
        { source: '/pt/contact', destination: '/contact' },
        { source: '/pt/contact/', destination: '/contact/' },
        { source: '/pt/confirmation', destination: '/confirmation' },
        { source: '/pt/confirmation/', destination: '/confirmation/' },
        // PT legal pages now have dedicated routes: /pt/privacidade/, /pt/politica-cookies/
        { source: '/pt/tracking/:path*', destination: '/tracking/:path*' },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
  async redirects() {
    return [
      // Alternate spelling: electricista → eletricista (PT pages now under /pt/)
      { source: '/pt/servicos/electricista-:city/', destination: '/pt/servicos/eletricista-:city/', permanent: true },
      { source: '/pt/urgencia/electricista-urgente-:city/', destination: '/pt/urgencia/eletricista-urgente-:city/', permanent: true },
      { source: '/pt/perto-de-mim/electricista/', destination: '/pt/perto-de-mim/eletricista/', permanent: true },
      { source: '/pt/precos/electricista/', destination: '/pt/precos/eletricista/', permanent: true },
      // Northern PT variant: picheleiro → canalizador
      { source: '/pt/servicos/picheleiro-:city/', destination: '/pt/servicos/canalizador-:city/', permanent: true },
      { source: '/pt/urgencia/picheleiro-urgente-:city/', destination: '/pt/urgencia/canalizador-urgente-:city/', permanent: true },
      { source: '/pt/perto-de-mim/picheleiro/', destination: '/pt/perto-de-mim/canalizador/', permanent: true },
      { source: '/pt/precos/picheleiro/', destination: '/pt/precos/canalizador/', permanent: true },
      // Common misspelling: marido de aluguer → faz-tudo
      { source: '/pt/perto-de-mim/marido-de-aluguer/', destination: '/pt/perto-de-mim/faz-tudo/', permanent: true },
      // Legacy root PT paths → redirect to /pt/ prefix
      { source: '/servicos/:path*', destination: '/pt/servicos/:path*', permanent: true },
      { source: '/urgencia/:path*', destination: '/pt/urgencia/:path*', permanent: true },
      { source: '/cidade/:path*', destination: '/pt/cidade/:path*', permanent: true },
      { source: '/perto-de-mim/:path*', destination: '/pt/perto-de-mim/:path*', permanent: true },
      { source: '/precos/:path*', destination: '/pt/precos/:path*', permanent: true },
      { source: '/sobre/', destination: '/pt/sobre/', permanent: true },
      { source: '/como-funciona/', destination: '/pt/como-funciona/', permanent: true },
      { source: '/especialidades/', destination: '/pt/especialidades/', permanent: true },
      { source: '/profissionais-verificados/', destination: '/pt/profissionais-verificados/', permanent: true },
      { source: '/profissional/:path*', destination: '/pt/profissional/:path*', permanent: true },
      { source: '/torne-se-parceiro/', destination: '/pt/torne-se-parceiro/', permanent: true },
      { source: '/pesquisar/', destination: '/pt/pesquisar/', permanent: true },
      { source: '/condominio/', destination: '/pt/condominio/', permanent: true },
      { source: '/simulador-orcamento/', destination: '/pt/simulador-orcamento/', permanent: true },
      // Pro login pages removed — single auth entry point
      { source: '/pro/espace-pro/', destination: '/auth/login/', permanent: true },
      { source: '/pro/login/', destination: '/auth/login/', permanent: true },
      // Legacy root FR paths → redirect to /fr/ prefix
      { source: '/a-propos/', destination: '/fr/a-propos/', permanent: true },
      { source: '/recherche/', destination: '/fr/recherche/', permanent: true },
      { source: '/tarifs/', destination: '/fr/tarifs/', permanent: true },
      { source: '/cgu/', destination: '/fr/cgu/', permanent: true },
      { source: '/mentions-legales/', destination: '/fr/mentions-legales/', permanent: true },
      { source: '/artisan/:path*', destination: '/fr/artisan/:path*', permanent: true },
      { source: '/reserver/', destination: '/fr/reserver/', permanent: true },
      // French marketplace URLs → redirect to PT equivalents
      { source: '/pt/marches/publier/', destination: '/pt/mercados/publicar/', permanent: true },
      { source: '/pt/marches/gerer/', destination: '/pt/mercados/gerir/', permanent: true },
      { source: '/pt/marches/:path*', destination: '/pt/mercados/:path*', permanent: true },
      // French root routes → redirect PT users to PT equivalents
      // Legal & info pages
      { source: '/pt/confidentialite/', destination: '/pt/privacidade/', permanent: true },
      { source: '/pt/confidentialite/mes-donnees/', destination: '/pt/privacidade/meus-dados/', permanent: true },
      { source: '/pt/cgu/', destination: '/pt/termos/', permanent: true },
      { source: '/pt/mentions-legales/', destination: '/pt/avisos-legais/', permanent: true },
      { source: '/pt/cookies/', destination: '/pt/politica-cookies/', permanent: true },
      { source: '/pt/a-propos/', destination: '/pt/sobre/', permanent: true },
      { source: '/pt/tarifs/', destination: '/pt/precos/', permanent: true },
      { source: '/pt/reserver/', destination: '/pt/reservar/', permanent: true },
      { source: '/pt/recherche/', destination: '/pt/pesquisar/', permanent: true },
      { source: '/pt/avis/', destination: '/pt/avaliacoes/', permanent: true },
      { source: '/pt/artisan/:slug/', destination: '/pt/profissional/:slug/', permanent: true },
      // Legacy Porto pages in French → redirect to PT equivalents
      { source: '/plombier-porto/', destination: '/pt/servicos/canalizador-porto/', permanent: true },
      { source: '/electricien-porto/', destination: '/pt/servicos/eletricista-porto/', permanent: true },
      { source: '/entretien-appartement-porto/', destination: '/pt/servicos/faz-tudo-porto/', permanent: true },
      { source: '/travaux-appartement-porto/', destination: '/pt/servicos/obras-remodelacao-porto/', permanent: true },
    ]
  },
  async headers() {
    return [
      // Static assets: aggressive caching (images, fonts, icons)
      {
        source: '/(.*)\\.(png|jpg|jpeg|webp|avif|svg|ico|woff2|woff)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Security headers on all routes
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // F09: CSP statique sans unsafe-inline (middleware.ts injecte un nonce en prod)
          { key: 'Content-Security-Policy', value: [
            "default-src 'self'",
            `script-src 'self'${process.env.NODE_ENV === 'development' ? " 'unsafe-inline' 'unsafe-eval'" : ''} https://js.stripe.com https://static.cloudflareinsights.com https://*.sentry.io`,
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://lh3.googleusercontent.com https://ui-avatars.com https://*.stripe.com",
            "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://api.groq.com https://api-adresse.data.gouv.fr https://nominatim.openstreetmap.org https://geocoding-api.open-meteo.com https://api.open-meteo.com https://cloudflareinsights.com",
            "frame-src 'self' https://js.stripe.com https://*.stripe.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
            "worker-src 'self' blob:",
          ].join('; ') },
        ],
      },
    ]
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  bundleSizeOptimizations: {
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
});
