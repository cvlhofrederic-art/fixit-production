// ── Lighthouse CI — Configuration dynamique ─────────────────────────────────
// Lit les URLs depuis le fichier généré par le workflow CI.
// Fallback sur les pages critiques si le fichier est absent.

const fs = require('fs');

// URLs extraites du sitemap par le workflow CI
let urls = [
  'http://localhost:3000/',
  'http://localhost:3000/fr/',
  'http://localhost:3000/pt/',
  'http://localhost:3000/contact/',
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
      assertions: {
        'categories:performance': ['error', { minScore: 0.80 }],
        'categories:accessibility': ['error', { minScore: 0.90 }],
        'categories:seo': ['error', { minScore: 0.90 }],
        'categories:best-practices': ['error', { minScore: 0.85 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
