import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
  // i18n: rewrite /pt/... to /... (locale stored in cookie)
  // /fr/ now has dedicated routes under app/fr/ (like /en/)
  // We keep specific rewrites for the 4 FR investor pages that live at root level
  async rewrites() {
    return {
      beforeFiles: [
        // FR investor pages (Porto-focused, served from root-level routes)
        { source: '/fr/plombier-porto', destination: '/plombier-porto' },
        { source: '/fr/plombier-porto/', destination: '/plombier-porto/' },
        { source: '/fr/electricien-porto', destination: '/electricien-porto' },
        { source: '/fr/electricien-porto/', destination: '/electricien-porto/' },
        { source: '/fr/travaux-appartement-porto', destination: '/travaux-appartement-porto' },
        { source: '/fr/travaux-appartement-porto/', destination: '/travaux-appartement-porto/' },
        { source: '/fr/entretien-appartement-porto', destination: '/entretien-appartement-porto' },
        { source: '/fr/entretien-appartement-porto/', destination: '/entretien-appartement-porto/' },
        // FR shared pages: root-level pages that should also work under /fr/ prefix
        // (auth, pro, client, syndic, contact, avis, etc.)
        { source: '/fr/auth/:path*', destination: '/auth/:path*' },
        { source: '/fr/pro/:path*', destination: '/pro/:path*' },
        { source: '/fr/client/:path*', destination: '/client/:path*' },
        { source: '/fr/syndic/:path*', destination: '/syndic/:path*' },
        { source: '/fr/contact', destination: '/contact' },
        { source: '/fr/contact/', destination: '/contact/' },
        { source: '/fr/avis', destination: '/avis' },
        { source: '/fr/avis/', destination: '/avis/' },
        { source: '/fr/inscription', destination: '/inscription' },
        { source: '/fr/inscription/', destination: '/inscription/' },
        { source: '/fr/recherche', destination: '/recherche' },
        { source: '/fr/recherche/', destination: '/recherche/' },
        { source: '/fr/reserver', destination: '/reserver' },
        { source: '/fr/reserver/', destination: '/reserver/' },
        { source: '/fr/tarifs', destination: '/tarifs' },
        { source: '/fr/tarifs/', destination: '/tarifs/' },
        { source: '/fr/mentions-legales', destination: '/mentions-legales' },
        { source: '/fr/mentions-legales/', destination: '/mentions-legales/' },
        { source: '/fr/a-propos', destination: '/a-propos' },
        { source: '/fr/a-propos/', destination: '/a-propos/' },
        { source: '/fr/sobre', destination: '/sobre' },
        { source: '/fr/sobre/', destination: '/sobre/' },
        { source: '/fr/cgu', destination: '/cgu' },
        { source: '/fr/cgu/', destination: '/cgu/' },
        { source: '/fr/confidentialite', destination: '/confidentialite' },
        { source: '/fr/confidentialite/', destination: '/confidentialite/' },
        { source: '/fr/cookies', destination: '/cookies' },
        { source: '/fr/cookies/', destination: '/cookies/' },
        { source: '/fr/artisan/:path*', destination: '/artisan/:path*' },
        { source: '/fr/admin/:path*', destination: '/admin/:path*' },
        { source: '/fr/coproprietaire/:path*', destination: '/coproprietaire/:path*' },
        { source: '/fr/confirmation', destination: '/confirmation' },
        { source: '/fr/confirmation/', destination: '/confirmation/' },
        { source: '/fr/tracking/:path*', destination: '/tracking/:path*' },
        // PT locale: rewrite /pt/... to /... (actual pages live at root)
        { source: '/pt', destination: '/' },
        { source: '/pt/:path*', destination: '/:path*' },
        // Note: dedicated /fr/ routes (services, blog, specialites, etc.) are handled by app/fr/
      ],
      afterFiles: [],
      fallback: [],
    }
  },
  async redirects() {
    return [
      // Alternate spelling: electricista → eletricista
      { source: '/servicos/electricista-:city/', destination: '/servicos/eletricista-:city/', permanent: true },
      { source: '/urgencia/electricista-urgente-:city/', destination: '/urgencia/eletricista-urgente-:city/', permanent: true },
      { source: '/perto-de-mim/electricista/', destination: '/perto-de-mim/eletricista/', permanent: true },
      { source: '/precos/electricista/', destination: '/precos/eletricista/', permanent: true },
      // Northern PT variant: picheleiro → canalizador
      { source: '/servicos/picheleiro-:city/', destination: '/servicos/canalizador-:city/', permanent: true },
      { source: '/urgencia/picheleiro-urgente-:city/', destination: '/urgencia/canalizador-urgente-:city/', permanent: true },
      { source: '/perto-de-mim/picheleiro/', destination: '/perto-de-mim/canalizador/', permanent: true },
      { source: '/precos/picheleiro/', destination: '/precos/canalizador/', permanent: true },
      // Common misspelling: marido de aluguer → faz-tudo
      { source: '/perto-de-mim/marido-de-aluguer/', destination: '/perto-de-mim/faz-tudo/', permanent: true },
      // Legacy Porto pages in French → redirect to PT equivalents
      { source: '/plombier-porto/', destination: '/pt/servicos/canalizador-porto/', permanent: true },
      { source: '/electricien-porto/', destination: '/pt/servicos/eletricista-porto/', permanent: true },
      { source: '/entretien-appartement-porto/', destination: '/pt/servicos/faz-tudo-porto/', permanent: true },
      { source: '/travaux-appartement-porto/', destination: '/pt/servicos/obras-remodelacao-porto/', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // CSP is now set dynamically in middleware.ts with per-request nonces
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
    ]
  },
};

export default withSentryConfig(nextConfig, {
  // Upload source maps for readable stack traces in Sentry
  silent: true,
  // Exclude Session Replay code from the client bundle
  bundleSizeOptimizations: {
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
});
