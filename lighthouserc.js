// ── Lighthouse CI — Configuration dynamique ─────────────────────────────────
// Lit les URLs depuis le fichier généré par le workflow CI.
// Fallback sur les pages critiques si le fichier est absent.

const fs = require('fs');

// URLs extraites du sitemap par le workflow CI
// Fallback : URLs connues pour exister sans redirection (testées via les routes
// /fr/ et /pt/ qui sont servies directement, pas de négociation de langue).
let urls = [
  'http://localhost:3000/fr/',
  'http://localhost:3000/pt/',
  'http://localhost:3000/fr/comment-ca-marche/',
  'http://localhost:3000/pt/como-funciona/',
];

try {
  const urlFile = '/tmp/lhci-urls.txt';
  if (fs.existsSync(urlFile)) {
    urls = fs.readFileSync(urlFile, 'utf8')
      .split('\n')
      .filter(Boolean);
  }
} catch {
  // Fallback silencieux
}

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx next start',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 30000,
      url: urls,
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
      },
    },
    assert: {
      // LHCI exige `assertions` OU `assertMatrix`, pas les deux (erreur :
      // "Cannot use assertMatrix with other options"). On utilise
      // `assertMatrix` avec les patterns spécifiques d'abord (first-match-wins)
      // et un catch-all `.*` final qui applique les seuils globaux par défaut.
      // TODO(perf): supprimer les exceptions per-URL après refactor des
      // pages massives (lazy load, code splitting, hydration).
      assertMatrix: [
        {
          matchingUrlPattern: '/(fr/recherche|pt/pesquisar)/?$',
          assertions: {
            'categories:performance':   ['error', { minScore: 0.65 }],
            'categories:accessibility': ['error', { minScore: 0.90 }],
            'categories:seo':           ['error', { minScore: 0.90 }],
            'categories:best-practices':['error', { minScore: 0.85 }],
          },
        },
        {
          matchingUrlPattern: '/(fr/marches/publier|pt/mercados/publicar)/?$',
          assertions: {
            'categories:performance':   ['error', { minScore: 0.75 }],
            'categories:accessibility': ['error', { minScore: 0.85 }],
            'categories:seo':           ['error', { minScore: 0.90 }],
            'categories:best-practices':['error', { minScore: 0.85 }],
          },
        },
        {
          matchingUrlPattern: '.*',
          assertions: {
            'categories:performance':   ['error', { minScore: 0.80 }],
            'categories:accessibility': ['error', { minScore: 0.90 }],
            'categories:seo':           ['error', { minScore: 0.90 }],
            'categories:best-practices':['error', { minScore: 0.85 }],
          },
        },
      ],
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
