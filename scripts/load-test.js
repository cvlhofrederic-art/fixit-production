/**
 * Test de charge k6 — Vitfix.io (fixit-production)
 *
 * Installation :
 *   brew install k6
 *
 * Exécution :
 *   k6 run scripts/load-test.js
 *
 * Avec une URL custom :
 *   k6 run -e BASE_URL=http://localhost:3000 scripts/load-test.js
 *
 * Exporter les résultats en JSON :
 *   k6 run --out json=results/load-test.json scripts/load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// --- Métriques personnalisées par groupe d'endpoints ---
const healthDuration = new Trend('health_duration', true);
const homeFrDuration = new Trend('home_fr_duration', true);
const homePtDuration = new Trend('home_pt_duration', true);
const catalogueDuration = new Trend('catalogue_duration', true);
const marchesDuration = new Trend('marches_duration', true);
const errorRate = new Rate('errors');

// --- URL de base (configurable via variable d'environnement) ---
const BASE_URL = __ENV.BASE_URL || 'https://fixit-production.vercel.app';

// --- Seuils de performance ---
// Les pages HTML ont un budget de 500ms au p95.
// Les endpoints API purs doivent répondre en moins de 200ms au p95.
export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'],                    // < 1% d'erreurs globales
    health_duration: ['p(95)<200'],                     // API health < 200ms
    catalogue_duration: ['p(95)<200'],                  // API catalogue < 200ms
    marches_duration: ['p(95)<200'],                    // API marchés < 200ms
    home_fr_duration: ['p(95)<500'],                    // Page FR < 500ms
    home_pt_duration: ['p(95)<500'],                    // Page PT < 500ms
  },

  // --- Scénarios parallèles avec montée progressive (ramping-vus) ---
  scenarios: {
    // Scénario 1 : Health check — endpoint léger, vérifie la stabilité de base
    health_check: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 25 },               // Montée progressive
        { duration: '1m', target: 50 },                 // Charge soutenue
        { duration: '30s', target: 0 },                 // Descente
      ],
      exec: 'healthCheck',
      tags: { group: 'health' },
    },

    // Scénario 2 : Page d'accueil FR — SSR Next.js, composants lourds
    homepage_fr: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 15 },
        { duration: '1m', target: 30 },
        { duration: '30s', target: 0 },
      ],
      exec: 'homepageFr',
      tags: { group: 'homepage_fr' },
    },

    // Scénario 3 : Page d'accueil PT — même logique, marché Portugal
    homepage_pt: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 15 },
        { duration: '1m', target: 30 },
        { duration: '30s', target: 0 },
      ],
      exec: 'homepagePt',
      tags: { group: 'homepage_pt' },
    },

    // Scénario 4 : Catalogue artisans — endpoint API avec query Supabase
    artisan_catalogue: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      exec: 'artisanCatalogue',
      tags: { group: 'catalogue' },
    },

    // Scénario 5 : Recherche marchés — endpoint API avec pagination et géo
    search_marches: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      exec: 'searchMarches',
      tags: { group: 'marches' },
    },
  },
};

// --- Headers communs (simule un navigateur réel) ---
const defaultHeaders = {
  'User-Agent': 'k6-load-test/1.0 (Vitfix monitoring)',
  'Accept': 'text/html,application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9,pt;q=0.8',
};

// --- Fonctions de scénario ---

// GET /api/health — Vérifie Supabase + env vars
export function healthCheck() {
  const res = http.get(`${BASE_URL}/api/health`, { headers: defaultHeaders });

  const passed = check(res, {
    'health: status 200': (r) => r.status === 200,
    'health: body contient "healthy"': (r) => r.body.includes('healthy'),
    'health: réponse JSON valide': (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
  });

  healthDuration.add(res.timings.duration);
  errorRate.add(!passed);
  sleep(1);
}

// GET /fr/ — Page d'accueil marché France (Marseille/PACA)
export function homepageFr() {
  const res = http.get(`${BASE_URL}/fr`, { headers: defaultHeaders });

  const passed = check(res, {
    'home FR: status 200': (r) => r.status === 200,
    'home FR: contient balise HTML': (r) => r.body.includes('</html>'),
  });

  homeFrDuration.add(res.timings.duration);
  errorRate.add(!passed);
  sleep(2);
}

// GET /pt/ — Page d'accueil marché Portugal (Porto/Tâmega e Sousa)
export function homepagePt() {
  const res = http.get(`${BASE_URL}/pt`, { headers: defaultHeaders });

  const passed = check(res, {
    'home PT: status 200': (r) => r.status === 200,
    'home PT: contient balise HTML': (r) => r.body.includes('</html>'),
  });

  homePtDuration.add(res.timings.duration);
  errorRate.add(!passed);
  sleep(2);
}

// GET /api/artisans-catalogue — Liste les artisans par métier
export function artisanCatalogue() {
  // Teste avec un service courant pour avoir des résultats
  const services = ['plombier', 'electricien', 'peintre', 'serrurier', 'couvreur'];
  const service = services[Math.floor(Math.random() * services.length)];

  const res = http.get(`${BASE_URL}/api/artisans-catalogue?service=${service}`, {
    headers: defaultHeaders,
  });

  const passed = check(res, {
    'catalogue: status 200': (r) => r.status === 200,
    'catalogue: réponse JSON': (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
  });

  catalogueDuration.add(res.timings.duration);
  errorRate.add(!passed);
  sleep(1.5);
}

// GET /api/marches — Recherche de marchés avec pagination
export function searchMarches() {
  const res = http.get(`${BASE_URL}/api/marches?page=1&limit=10`, {
    headers: defaultHeaders,
  });

  const passed = check(res, {
    'marchés: status 200 ou 304': (r) => r.status === 200 || r.status === 304,
    'marchés: réponse JSON': (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
  });

  marchesDuration.add(res.timings.duration);
  errorRate.add(!passed);
  sleep(1.5);
}
