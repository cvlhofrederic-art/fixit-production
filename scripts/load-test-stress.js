/**
 * Test de stress k6 — Vitfix.io (fixit-production)
 *
 * Objectif : trouver le point de rupture de l'application.
 * Monte progressivement de 10 à 500 VUs sur 10 minutes,
 * puis redescend pour observer la récupération.
 *
 * Installation :
 *   brew install k6
 *
 * Exécution :
 *   k6 run scripts/load-test-stress.js
 *
 * Avec une URL custom :
 *   k6 run -e BASE_URL=http://localhost:3000 scripts/load-test-stress.js
 *
 * Exporter les résultats (pour analyse post-mortem) :
 *   k6 run --out json=results/stress-test.json scripts/load-test-stress.js
 *
 * ATTENTION : ce test génère une charge importante.
 * Ne pas lancer contre la production sans accord préalable.
 * Vercel a des limites de concurrence sur le plan gratuit/pro.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// --- Métriques personnalisées par endpoint ---
// Permet d'identifier quel endpoint casse en premier sous la charge
const healthTrend = new Trend('stress_health_duration', true);
const homeFrTrend = new Trend('stress_home_fr_duration', true);
const homePtTrend = new Trend('stress_home_pt_duration', true);
const catalogueTrend = new Trend('stress_catalogue_duration', true);
const marchesTrend = new Trend('stress_marches_duration', true);

const healthErrors = new Counter('stress_health_errors');
const homeFrErrors = new Counter('stress_home_fr_errors');
const homePtErrors = new Counter('stress_home_pt_errors');
const catalogueErrors = new Counter('stress_catalogue_errors');
const marchesErrors = new Counter('stress_marches_errors');

const globalErrorRate = new Rate('stress_error_rate');

// --- URL de base ---
const BASE_URL = __ENV.BASE_URL || 'https://fixit-production.vercel.app';

// --- Configuration du stress test ---
// Montée en 5 paliers pour identifier précisément le seuil de dégradation.
// Chaque palier dure assez longtemps pour stabiliser les métriques.
export const options = {
  stages: [
    // Phase 1 : Warmup — 10 VUs pendant 1 minute
    { duration: '1m', target: 10 },

    // Phase 2 : Charge normale — montée à 50 VUs
    { duration: '2m', target: 50 },

    // Phase 3 : Charge élevée — montée à 100 VUs
    { duration: '2m', target: 100 },

    // Phase 4 : Pré-rupture — montée à 250 VUs
    { duration: '2m', target: 250 },

    // Phase 5 : Stress maximum — montée à 500 VUs
    { duration: '2m', target: 500 },

    // Phase 6 : Récupération — descente à 0 pour observer le comportement post-stress
    { duration: '1m', target: 0 },
  ],

  thresholds: {
    // Seuils volontairement plus souples que le test de charge standard.
    // L'objectif ici est de mesurer, pas de bloquer.
    http_req_duration: ['p(95)<2000'],                  // 2s au p95 (on s'attend à de la dégradation)
    stress_error_rate: ['rate<0.10'],                   // Jusqu'à 10% d'erreurs tolérées
    stress_health_duration: ['p(95)<1000'],              // Health devrait rester rapide
    stress_catalogue_duration: ['p(95)<3000'],           // Catalogue peut dégrader sous charge
    stress_marches_duration: ['p(95)<3000'],
    stress_home_fr_duration: ['p(95)<3000'],
    stress_home_pt_duration: ['p(95)<3000'],
  },
};

// --- Headers ---
const defaultHeaders = {
  'User-Agent': 'k6-stress-test/1.0 (Vitfix monitoring)',
  'Accept': 'text/html,application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9,pt;q=0.8',
};

// --- Fonction utilitaire : exécute une requête et enregistre les métriques ---
function hitEndpoint(name, url, trend, errorCounter, checks) {
  const res = http.get(url, { headers: defaultHeaders, tags: { endpoint: name } });

  const passed = check(res, checks);
  trend.add(res.timings.duration);

  if (!passed) {
    errorCounter.add(1);
  }
  globalErrorRate.add(!passed);

  return res;
}

// --- Scénario principal ---
// Chaque VU effectue un cycle complet sur tous les endpoints.
// Cela simule un utilisateur qui navigue sur la plateforme.
export default function () {
  // 1. Health check — le canari dans la mine
  group('health', () => {
    hitEndpoint(
      'health',
      `${BASE_URL}/api/health`,
      healthTrend,
      healthErrors,
      {
        'health: status 200': (r) => r.status === 200,
        'health: body contient healthy': (r) => r.body.includes('healthy'),
      }
    );
  });

  sleep(0.5);

  // 2. Page d'accueil FR — SSR Next.js, la page la plus visitée
  group('home_fr', () => {
    hitEndpoint(
      'home_fr',
      `${BASE_URL}/fr`,
      homeFrTrend,
      homeFrErrors,
      {
        'home FR: status 200': (r) => r.status === 200,
      }
    );
  });

  sleep(0.5);

  // 3. Page d'accueil PT — deuxième marché
  group('home_pt', () => {
    hitEndpoint(
      'home_pt',
      `${BASE_URL}/pt`,
      homePtTrend,
      homePtErrors,
      {
        'home PT: status 200': (r) => r.status === 200,
      }
    );
  });

  sleep(0.5);

  // 4. Catalogue artisans — requête Supabase, potentiel goulot d'étranglement
  group('catalogue', () => {
    const services = ['plombier', 'electricien', 'peintre', 'serrurier', 'couvreur',
                      'carreleur', 'macon', 'climatisation', 'couvreur', 'vitrier'];
    const service = services[Math.floor(Math.random() * services.length)];

    hitEndpoint(
      'catalogue',
      `${BASE_URL}/api/artisans-catalogue?service=${service}`,
      catalogueTrend,
      catalogueErrors,
      {
        'catalogue: status 200': (r) => r.status === 200,
        'catalogue: JSON valide': (r) => {
          try { JSON.parse(r.body); return true; } catch { return false; }
        },
      }
    );
  });

  sleep(0.5);

  // 5. Marchés — endpoint avec pagination, géo et rate limiting
  group('marches', () => {
    hitEndpoint(
      'marches',
      `${BASE_URL}/api/marches?page=1&limit=10`,
      marchesTrend,
      marchesErrors,
      {
        'marchés: status 200': (r) => r.status === 200 || r.status === 304,
      }
    );
  });

  // Pause entre les cycles — simule le temps de réflexion d'un utilisateur.
  // Réduit par rapport au test de charge pour augmenter la pression.
  sleep(1);
}

// --- Résumé affiché en fin de test ---
export function handleSummary(data) {
  // Identifie le palier de VUs où les erreurs commencent à monter
  const p95 = data.metrics.http_req_duration
    ? data.metrics.http_req_duration.values['p(95)']
    : 'N/A';
  const errRate = data.metrics.stress_error_rate
    ? (data.metrics.stress_error_rate.values.rate * 100).toFixed(2)
    : 'N/A';

  const summary = `
===================================================
  RAPPORT DE STRESS TEST — Vitfix.io
===================================================
  URL testée : ${BASE_URL}
  VUs max    : 500
  Durée      : 10 minutes

  Latence p95 globale  : ${typeof p95 === 'number' ? p95.toFixed(0) + 'ms' : p95}
  Taux d'erreur global : ${errRate}%

  Détail par endpoint (p95) :
    Health     : ${formatP95(data, 'stress_health_duration')}
    Home FR    : ${formatP95(data, 'stress_home_fr_duration')}
    Home PT    : ${formatP95(data, 'stress_home_pt_duration')}
    Catalogue  : ${formatP95(data, 'stress_catalogue_duration')}
    Marchés    : ${formatP95(data, 'stress_marches_duration')}

  Erreurs par endpoint :
    Health     : ${formatCount(data, 'stress_health_errors')}
    Home FR    : ${formatCount(data, 'stress_home_fr_errors')}
    Home PT    : ${formatCount(data, 'stress_home_pt_errors')}
    Catalogue  : ${formatCount(data, 'stress_catalogue_errors')}
    Marchés    : ${formatCount(data, 'stress_marches_errors')}
===================================================
`;

  return {
    stdout: summary,
  };
}

function formatP95(data, metricName) {
  const m = data.metrics[metricName];
  if (!m) return 'N/A';
  const val = m.values['p(95)'];
  return typeof val === 'number' ? val.toFixed(0) + 'ms' : 'N/A';
}

function formatCount(data, metricName) {
  const m = data.metrics[metricName];
  if (!m) return '0';
  return String(m.values.count || 0);
}
