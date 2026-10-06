import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { EXTENSIONS_HORS_MIDDLEWARE, POLITIQUE_CSP } from "./lib/securite/csp";
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
        // Racine de la succursale en règles exactes : sur OpenNext/Cloudflare, `:path*` vide laisse la destination
        // non compilée (« /administrateur-judiciaire/:path* ») → 404. Les règles exactes doivent précéder `:path*`.
        { source: '/fr/administrateur-judiciaire', destination: '/administrateur-judiciaire' },
        { source: '/fr/administrateur-judiciaire/', destination: '/administrateur-judiciaire/' },
        { source: '/fr/administrateur-judiciaire/:path*', destination: '/administrateur-judiciaire/:path*' },
        { source: '/fr/admin/:path*', destination: '/admin/:path*' },
        { source: '/fr/coproprietaire/:path*', destination: '/coproprietaire/:path*' },
        { source: '/fr/contact', destination: '/contact' },
        { source: '/fr/contact/', destination: '/contact/' },
        { source: '/fr/confirmation', destination: '/confirmation' },
        { source: '/fr/confirmation/', destination: '/confirmation/' },
        { source: '/fr/confidentialite', destination: '/confidentialite' },
        { source: '/fr/confidentialite/', destination: '/confidentialite/' },
        { source: '/fr/confidentialite/mes-donnees', destination: '/confidentialite/mes-donnees' },
        { source: '/fr/confidentialite/mes-donnees/', destination: '/confidentialite/mes-donnees/' },
        { source: '/fr/cookies', destination: '/cookies' },
        { source: '/fr/cookies/', destination: '/cookies/' },
        // Pages ouvertes par un lien e-mail ou SMS sans locale : le middleware les préfixe par la locale du visiteur (cookie,
        // pays, Accept-Language), donc /fr/ et /pt/ mais aussi /en/, /nl/, /es/ (règles en fin de liste). Sans réécriture : 404.
        // Suivi par « :token » et non « :path* » : sur OpenNext, « :path* » vide envoyait le littéral « /tracking/:path* »
        // à la route [token], servie en 200 sous /fr/tracking/. Parrainage : ${SITE_URL}/rejoindre?ref=CODE (lib/email-referral.ts) ;
        // réponse fournisseur BTP : ${BASE_URL}/rfq/repondre/<jeton> (lib/email-rfq.ts).
        { source: '/fr/tracking/:token', destination: '/tracking/:token' },
        { source: '/fr/rejoindre', destination: '/rejoindre' },
        { source: '/fr/rejoindre/', destination: '/rejoindre/' },
        { source: '/fr/rfq/repondre/:token', destination: '/rfq/repondre/:token' },
        // ── Shared root pages accessible via /pt/ prefix ──
        { source: '/pt/auth/:path*', destination: '/auth/:path*' },
        { source: '/pt/pro/:path*', destination: '/pro/:path*' },
        { source: '/pt/artisan/dashboard', destination: '/artisan/dashboard' },
        { source: '/pt/artisan/dashboard/', destination: '/artisan/dashboard/' },
        { source: '/pt/artisan/dashboard/:path*', destination: '/artisan/dashboard/:path*' },
        { source: '/pt/client/:path*', destination: '/client/:path*' },
        { source: '/pt/syndic/:path*', destination: '/syndic/:path*' },
        { source: '/pt/administrateur-judiciaire', destination: '/administrateur-judiciaire' },
        { source: '/pt/administrateur-judiciaire/', destination: '/administrateur-judiciaire/' },
        { source: '/pt/administrateur-judiciaire/:path*', destination: '/administrateur-judiciaire/:path*' },
        { source: '/pt/admin/:path*', destination: '/admin/:path*' },
        { source: '/pt/coproprietaire/:path*', destination: '/coproprietaire/:path*' },
        { source: '/pt/contact', destination: '/contact' },
        { source: '/pt/contact/', destination: '/contact/' },
        { source: '/pt/confirmation', destination: '/confirmation' },
        { source: '/pt/confirmation/', destination: '/confirmation/' },
        // PT legal pages now have dedicated routes: /pt/privacidade/, /pt/politica-cookies/
        { source: '/pt/tracking/:token', destination: '/tracking/:token' },
        { source: '/pt/rejoindre', destination: '/rejoindre' },
        { source: '/pt/rejoindre/', destination: '/rejoindre/' },
        { source: '/pt/rfq/repondre/:token', destination: '/rfq/repondre/:token' },
        // ── Mêmes liens e-mail suivis par un visiteur en/nl/es (pages partagées, contenu non traduit plutôt qu'un 404) ──
        { source: '/:locale(en|nl|es)/tracking/:token', destination: '/tracking/:token' },
        { source: '/:locale(en|nl|es)/rejoindre', destination: '/rejoindre' },
        { source: '/:locale(en|nl|es)/rejoindre/', destination: '/rejoindre/' },
        { source: '/:locale(en|nl|es)/rfq/repondre/:token', destination: '/rfq/repondre/:token' },
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
      { source: '/pt/precos/picheleiro/', destination: '/pt/precos/canalizador/', permanent: true },
      // Common misspelling: marido de aluguer → faz-tudo
      { source: '/pt/perto-de-mim/marido-de-aluguer/', destination: '/pt/perto-de-mim/faz-tudo/', permanent: true },
      // Legacy root PT paths → redirect to /pt/ prefix
      // Racine en règle exacte AVANT chaque `:path*` : sur OpenNext/Cloudflare, `:path*` vide laisse la destination
      // non compilée (« Location: /pt/servicos/:path* ») → 404. Vérifié par tests/next-config-routage-opennext.test.ts.
      // Destination `:path*/` avec barre finale (trailingSlash) : sinon chaque ancienne URL coûte un saut 308 de plus.
      { source: '/servicos/', destination: '/pt/servicos/', permanent: true },
      { source: '/servicos/:path*', destination: '/pt/servicos/:path*/', permanent: true },
      { source: '/urgencia/', destination: '/pt/urgencia/', permanent: true },
      { source: '/urgencia/:path*', destination: '/pt/urgencia/:path*/', permanent: true },
      { source: '/cidade/', destination: '/pt/cidade/', permanent: true },
      { source: '/cidade/:path*', destination: '/pt/cidade/:path*/', permanent: true },
      { source: '/perto-de-mim/', destination: '/pt/perto-de-mim/', permanent: true },
      { source: '/perto-de-mim/:path*', destination: '/pt/perto-de-mim/:path*/', permanent: true },
      { source: '/precos/', destination: '/pt/precos/', permanent: true },
      { source: '/precos/:path*', destination: '/pt/precos/:path*/', permanent: true },
      { source: '/sobre/', destination: '/pt/sobre/', permanent: true },
      { source: '/como-funciona/', destination: '/pt/como-funciona/', permanent: true },
      { source: '/especialidades/', destination: '/pt/especialidades/', permanent: true },
      { source: '/profissionais-verificados/', destination: '/pt/profissionais-verificados/', permanent: true },
      // Pas de page racine /pt/profissional/ (seulement [id]) : racine → recherche, parent des fiches, en un seul saut.
      { source: '/profissional/', destination: '/pt/pesquisar/', permanent: true },
      { source: '/pt/profissional/', destination: '/pt/pesquisar/', permanent: true },
      { source: '/profissional/:path*', destination: '/pt/profissional/:path*/', permanent: true },
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
      // Pas de page racine /fr/artisan/ (seulement [id] et le tableau de bord) : racine → recherche, en un seul saut.
      { source: '/artisan/', destination: '/fr/recherche/', permanent: true },
      { source: '/fr/artisan/', destination: '/fr/recherche/', permanent: true },
      { source: '/artisan/:path*', destination: '/fr/artisan/:path*/', permanent: true },
      { source: '/reserver/', destination: '/fr/reserver/', permanent: true },
      // French marketplace URLs → redirect to PT equivalents
      { source: '/pt/marches/publier/', destination: '/pt/mercados/publicar/', permanent: true },
      { source: '/pt/marches/gerer/', destination: '/pt/mercados/gerir/', permanent: true },
      // Pas de page racine /pt/mercados/ ni /fr/marches/ (seulement publier/publicar et gerer/gerir) : racine → publication.
      { source: '/pt/marches/', destination: '/pt/mercados/publicar/', permanent: true },
      { source: '/pt/mercados/', destination: '/pt/mercados/publicar/', permanent: true },
      { source: '/fr/marches/', destination: '/fr/marches/publier/', permanent: true },
      { source: '/pt/marches/:path*', destination: '/pt/mercados/:path*/', permanent: true },
      // Anciennes cibles littérales : avant les règles exactes ci-dessus, ces racines partaient en 308 vers « …/:path* »,
      // sans Cache-Control. Les navigateurs gardent ce 308 et retournent directement sur le littéral (« \\: » et « \\* » :
      // caractères littéraux dans la source) ; on les ramène là où mène la racine.
      { source: '/pt/servicos/\\:path\\*/', destination: '/pt/servicos/', permanent: true },
      { source: '/pt/urgencia/\\:path\\*/', destination: '/pt/urgencia/', permanent: true },
      { source: '/pt/cidade/\\:path\\*/', destination: '/pt/cidade/', permanent: true },
      { source: '/pt/perto-de-mim/\\:path\\*/', destination: '/pt/perto-de-mim/', permanent: true },
      { source: '/pt/precos/\\:path\\*/', destination: '/pt/precos/', permanent: true },
      { source: '/pt/profissional/\\:path\\*/', destination: '/pt/pesquisar/', permanent: true },
      { source: '/fr/artisan/\\:path\\*/', destination: '/fr/recherche/', permanent: true },
      { source: '/pt/mercados/\\:path\\*/', destination: '/pt/mercados/publicar/', permanent: true },
      // French root routes → redirect PT users to PT equivalents
      // Legal & info pages
      { source: '/pt/confidentialite/', destination: '/pt/privacidade/', permanent: true },
      { source: '/pt/confidentialite/mes-donnees/', destination: '/pt/privacidade/meus-dados/', permanent: true },
      { source: '/pt/cgu/', destination: '/pt/termos/', permanent: true },
      { source: '/pt/mentions-legales/', destination: '/pt/avisos-legais/', permanent: true },
      { source: '/pt/cookies/', destination: '/pt/politica-cookies/', permanent: true },
      { source: '/pt/a-propos/', destination: '/pt/sobre/', permanent: true },
      { source: '/pt/tarifs/', destination: '/pt/precos/', permanent: true },
      // Aucune page /pt/reservar/ : la réservation se fait depuis la fiche, trouvée par la recherche.
      { source: '/pt/reserver/', destination: '/pt/pesquisar/', permanent: true },
      // Ancienne cible de /pt/reserver/ (308 gardé en cache par les navigateurs).
      { source: '/pt/reservar/', destination: '/pt/pesquisar/', permanent: true },
      { source: '/pt/recherche/', destination: '/pt/pesquisar/', permanent: true },
      { source: '/pt/avis/', destination: '/pt/avaliacoes/', permanent: true },
      // Sauf « dashboard » : /pt/artisan/dashboard/ est réécrit vers le tableau de bord artisan (beforeFiles), et les
      // redirections passent avant les réécritures. Classes [Dd]… : OpenNext teste la regex du manifeste en respectant
      // la casse mais extrait les paramètres sans casse (« :slug » littéral pour /pt/artisan/DASHBOARD/ sinon).
      { source: '/pt/artisan/:slug((?![Dd][Aa][Ss][Hh][Bb][Oo][Aa][Rr][Dd]/)[^/]+)/', destination: '/pt/profissional/:slug/', permanent: true },
      // Navigateurs qui ont gardé en cache l'ancien 308 /pt/artisan/dashboard/ → /pt/profissional/dashboard/ (sans
      // Cache-Control) : retour temporaire, jamais mis en cache ; « ?retour=1 » donne une URL distincte de l'entrée en cache.
      { source: '/pt/profissional/dashboard/', destination: '/pt/artisan/dashboard/?retour=1', permanent: false },
      // Legacy Porto pages in French → redirect to PT equivalents
      { source: '/plombier-porto/', destination: '/pt/servicos/canalizador-porto/', permanent: true },
      { source: '/electricien-porto/', destination: '/pt/servicos/eletricista-porto/', permanent: true },
      { source: '/entretien-appartement-porto/', destination: '/pt/servicos/faz-tudo-porto/', permanent: true },
      { source: '/travaux-appartement-porto/', destination: '/pt/servicos/obras-remodelacao-porto/', permanent: true },
      // ─── GSC 404 cleanup (May 2026) ─────────────────────────────────────
      // FR services slug rename: noun → trade name (sitemap already emits new slugs)
      { source: '/fr/services/plomberie-:city/', destination: '/fr/services/plombier-:city/', permanent: true },
      { source: '/fr/services/electricite-:city/', destination: '/fr/services/electricien-:city/', permanent: true },
      { source: '/fr/services/peinture-:city/', destination: '/fr/services/peintre-:city/', permanent: true },
      // FR hub /pres-de-chez-moi/ has no root page (only [slug])
      { source: '/fr/pres-de-chez-moi/', destination: '/fr/', permanent: true },
      // EN routes that never existed (EN market is passive/SEO only)
      { source: '/en/search/', destination: '/en/', permanent: true },
      { source: '/en/contact/', destination: '/en/', permanent: true },
      { source: '/en/reviews/', destination: '/en/', permanent: true },
      // PT blog: 1 article renamed, 5 removed → hub
      { source: '/pt/blog/humidade-paredes-solucoes/', destination: '/pt/blog/humidade-parede-causas-reparacao/', permanent: true },
      { source: '/pt/blog/certificacao-eletrica/', destination: '/pt/blog/', permanent: true },
      { source: '/pt/blog/seguranca-eletrica-casa/', destination: '/pt/blog/', permanent: true },
      { source: '/pt/blog/paineis-solares-portugal/', destination: '/pt/blog/', permanent: true },
      { source: '/pt/blog/como-escolher-tinta/', destination: '/pt/blog/', permanent: true },
      { source: '/pt/blog/preparar-paredes-pintura/', destination: '/pt/blog/', permanent: true },
      // Orphan paths picked up by Google with no locale prefix
      { source: '/mois/', destination: '/fr/', permanent: true },
      // Forme encodée : le chemin arrive encodé (/m%C3%AAs/) et la source est comparée telle quelle (« /mês/ » ne correspondait jamais).
      { source: '/m%C3%AAs/', destination: '/pt/', permanent: true },
      // Simulateur devis: Toulon not in supported FR_CITIES → hub
      { source: '/fr/simulateur-devis/toulon/', destination: '/fr/simulateur-devis/', permanent: true },
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
          // Pas de Content-Security-Policy ici : sur OpenNext/Cloudflare, les en-têtes de cette config s'AJOUTENT à
          // ceux du middleware (clés de casse différente, toutes deux gardées) et le navigateur appliquait deux
          // politiques, la plus stricte bloquant GA4 et le repli SIRET. Voir les règles CSP ci-dessous.
        ],
      },
      // CSP des seules réponses que le middleware ne traite pas (chemins exclus de son matcher) : des routes
      // dynamiques y servent aussi du HTML (ex. /fr/artisan/foo.png). Même politique que le middleware
      // (lib/securite/csp.ts), jamais sur la même réponse. Test : tests/securite/csp-politique-unique.test.ts.
      {
        source: `/(.*)\\.(${EXTENSIONS_HORS_MIDDLEWARE})`,
        headers: [{ key: 'Content-Security-Policy', value: POLITIQUE_CSP }],
      },
      { source: '/manifest.json', headers: [{ key: 'Content-Security-Policy', value: POLITIQUE_CSP }] },
      { source: '/.well-known/:path*', headers: [{ key: 'Content-Security-Policy', value: POLITIQUE_CSP }] },
      // Syndic v54 dev sandbox : jamais indexable. Ceinture en plus du gate
      // hostname (404 hors localhost) et du <meta robots noindex>. Couvre le
      // cas où une URL preview/dev fuiterait à un crawler.
      {
        source: '/syndic/dev/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/fr/syndic/dev/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      // Succursale Administrateur Judiciaire : outil métier, jamais indexable.
      {
        source: '/:locale(fr|pt)/administrateur-judiciaire/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/administrateur-judiciaire/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
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
