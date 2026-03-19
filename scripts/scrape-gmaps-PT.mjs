/**
 * scrape-gmaps-PT.mjs
 *
 * Scrape Google Maps pour les artisans PT — 16 services × 12 villes.
 * Utilise Playwright headless pour naviguer et extraire les données.
 *
 * Usage :
 *   npx playwright install chromium  (première fois)
 *   node scripts/scrape-gmaps-PT.mjs
 *   node scripts/scrape-gmaps-PT.mjs --city porto
 *   node scripts/scrape-gmaps-PT.mjs --service eletricista
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '../data/artisans-PT-gmaps-raw.json');

const SERVICES = [
  'eletricista', 'canalizador', 'pintor', 'pladur',
  'obras+remodelação', 'isolamento+térmico', 'impermeabilização',
  'desentupimento', 'serralheiro', 'telhados+cobertura',
  'vidraceiro', 'azulejador+ladrilhador', 'pedreiro',
  'ar+condicionado+instalação', 'carpinteiro', 'faz+tudo+reparações',
];

const CITIES = [
  { slug: 'marco-de-canaveses', name: 'Marco de Canaveses', query: 'Marco+de+Canaveses' },
  { slug: 'penafiel', name: 'Penafiel', query: 'Penafiel' },
  { slug: 'amarante', name: 'Amarante', query: 'Amarante+Porto' },
  { slug: 'baiao', name: 'Baião', query: 'Baião' },
  { slug: 'felgueiras', name: 'Felgueiras', query: 'Felgueiras' },
  { slug: 'lousada', name: 'Lousada', query: 'Lousada' },
  { slug: 'pacos-de-ferreira', name: 'Paços de Ferreira', query: 'Paços+de+Ferreira' },
  { slug: 'paredes', name: 'Paredes', query: 'Paredes+Porto' },
  { slug: 'porto', name: 'Porto', query: 'Porto' },
  { slug: 'vila-nova-de-gaia', name: 'Vila Nova de Gaia', query: 'Vila+Nova+de+Gaia' },
  { slug: 'braga', name: 'Braga', query: 'Braga' },
  { slug: 'maia', name: 'Maia', query: 'Maia+Porto' },
];

// Exclusion keywords — NOT construction professionals
const EXCLUSION_KEYWORDS = [
  'materiais', 'armazém', 'depósito', 'loja', 'store', 'shop',
  'comércio', 'distribuição', 'grossista', 'revendedor',
  'leroy', 'merlin', 'aki', 'bricomarché', 'maxmat', 'castorama',
  'automobile', 'automóveis', 'auto ', 'car service', 'car wash',
  'mécanique', 'mecânica', 'pneus', 'garage',
  'architecte', 'arquiteto', 'engenheiro civil', 'imobiliária',
  'formação', 'escola', 'universidade', 'instituto',
  'restaurante', 'café', 'hotel', 'alojamento',
];

function isExcluded(name, category) {
  const lower = (name + ' ' + category).toLowerCase();
  return EXCLUSION_KEYWORDS.some(kw => lower.includes(kw));
}

// Map Google Maps category to Vitfix service slug
function mapCategory(service, gmapCategory) {
  const serviceClean = service.replace(/\+/g, ' ').split(' ')[0].toLowerCase();
  const catMap = {
    'eletricista': 'eletricista', 'canalizador': 'canalizador',
    'pintor': 'pintor', 'pladur': 'pladur',
    'obras': 'obras-remodelacao', 'isolamento': 'isolamento-termico',
    'impermeabilização': 'impermeabilizacao', 'desentupimento': 'desentupimento',
    'serralheiro': 'serralheiro', 'telhados': 'telhador',
    'vidraceiro': 'vidraceiro', 'azulejador': 'azulejador',
    'pedreiro': 'pedreiro', 'ar': 'ar-condicionado',
    'carpinteiro': 'carpinteiro', 'faz': 'faz-tudo',
  };
  return catMap[serviceClean] || serviceClean;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function extractResults(page) {
  return page.evaluate(() => {
    const results = [];
    const items = document.querySelectorAll('[role="feed"] > div');
    for (const item of items) {
      const nameEl = item.querySelector('.fontHeadlineSmall');
      if (!nameEl) continue;
      const name = nameEl.textContent.trim();

      const ratingEl = item.querySelector('.MW4etd');
      const rating = ratingEl ? parseFloat(ratingEl.textContent.replace(',', '.')) : null;

      const reviewEl = item.querySelector('.UY7F9');
      const reviewCount = reviewEl ? parseInt(reviewEl.textContent.replace(/[^0-9]/g, '')) : 0;

      const allText = item.innerText;
      const phoneMatch = allText.match(/\b([29]\d{2}\s?\d{3}\s?\d{3})\b/);
      const phone = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : null;

      let category = '';
      let address = '';
      const descSpans = item.querySelectorAll('.W4Efsd');
      for (const d of descSpans) {
        const t = d.textContent.trim();
        if (t.includes('·')) {
          const parts = t.split('·').map(p => p.trim());
          if (!category && parts[0] && !parts[0].match(/^\d/) && parts[0].length > 2) {
            category = parts[0];
          }
          for (const p of parts) {
            if (p.match(/^(Rua|Av\.|R\.|Estrada|Largo|Praça|Trav|Viela|Alameda|Cam\.|EN|N\d|Zona|Bairro)/i) ||
                p.match(/\d{4}-\d{3}/)) {
              address = p.trim();
            }
          }
        }
      }

      // Check for website link
      const ariaLabel = item.querySelector('.fontHeadlineSmall')?.closest('a')?.getAttribute('href');

      results.push({ name, rating, reviewCount, phone, category, address });
    }
    return results;
  });
}

async function scrollAndLoad(page) {
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const feed = document.querySelector('[role="feed"]');
      if (feed && feed.parentElement) {
        feed.parentElement.scrollTop = feed.parentElement.scrollHeight;
      }
    });
    await sleep(1500);
  }
}

async function main() {
  const argCity = process.argv.find(a => a.startsWith('--city='))?.split('=')[1];
  const argService = process.argv.find(a => a.startsWith('--service='))?.split('=')[1];

  const servicesToScrape = argService
    ? SERVICES.filter(s => s.startsWith(argService))
    : SERVICES;

  const citiesToScrape = argCity
    ? CITIES.filter(c => c.slug === argCity || c.name.toLowerCase().includes(argCity.toLowerCase()))
    : CITIES;

  const totalCombos = servicesToScrape.length * citiesToScrape.length;
  console.log(`\n🇵🇹 Scraping Google Maps PT — ${servicesToScrape.length} services × ${citiesToScrape.length} villes`);
  console.log(`   Total combinaisons : ${totalCombos}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--lang=pt-PT'],
  });

  const context = await browser.newContext({
    locale: 'pt-PT',
    geolocation: { latitude: 41.1579, longitude: -8.6291 }, // Porto
    permissions: ['geolocation'],
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Accept cookies on first visit
  await page.goto('https://www.google.com/maps', { waitUntil: 'networkidle' });
  try {
    const acceptBtn = await page.locator('button:has-text("Aceitar"), button:has-text("Accept"), button:has-text("Tout accepter")').first();
    if (await acceptBtn.isVisible({ timeout: 3000 })) {
      await acceptBtn.click();
      await sleep(1000);
    }
  } catch (e) { /* no cookie banner */ }

  const allProfiles = [];
  let combo = 0;
  let errors = 0;

  for (const service of servicesToScrape) {
    const vitfixSlug = mapCategory(service, '');

    for (const city of citiesToScrape) {
      combo++;
      const query = `${service}+${city.query}`;
      const url = `https://www.google.com/maps/search/${query}`;

      process.stdout.write(`  [${combo}/${totalCombos}] ${vitfixSlug.padEnd(20)} ${city.name.padEnd(25)} `);

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(3000);

        // Scroll to load more results
        await scrollAndLoad(page);

        const results = await extractResults(page);

        // Filter and tag results
        let added = 0;
        for (const r of results) {
          if (isExcluded(r.name, r.category)) continue;

          allProfiles.push({
            company_name: r.name,
            phone: r.phone,
            company_address: r.address || null,
            city: city.name,
            country: 'PT',
            language: 'pt',
            categories: [vitfixSlug],
            source_name: 'google_maps',
            rating_avg: r.rating,
            rating_count: r.reviewCount,
            google_category: r.category,
            active: false,
            verified: false,
          });
          added++;
        }

        process.stdout.write(`${added} profils (${results.length} bruts)\n`);

      } catch (e) {
        process.stdout.write(`ERREUR: ${e.message.slice(0, 60)}\n`);
        errors++;
      }

      // Rate limiting
      await sleep(1200 + Math.random() * 800);
    }

    // Save intermediate every service
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
      scraped_at: new Date().toISOString(),
      source: 'google_maps',
      total_raw: allProfiles.length,
      profiles: allProfiles,
    }, null, 2));
    console.log(`  💾 Sauvegarde intermédiaire : ${allProfiles.length} profils\n`);
  }

  await browser.close();

  // Deduplicate by name + city (keep best = most reviews)
  const map = new Map();
  for (const p of allProfiles) {
    const key = p.company_name.toLowerCase().trim() + '|' + p.city;
    if (!map.has(key)) {
      map.set(key, { ...p });
    } else {
      const existing = map.get(key);
      // Merge categories
      const cats = new Set([...existing.categories, ...p.categories]);
      existing.categories = [...cats];
      // Keep best data
      if (!existing.phone && p.phone) existing.phone = p.phone;
      if (!existing.company_address && p.company_address) existing.company_address = p.company_address;
      if (p.rating_count > existing.rating_count) {
        existing.rating_avg = p.rating_avg;
        existing.rating_count = p.rating_count;
      }
    }
  }
  const unique = [...map.values()];

  // Score
  const scored = unique.map(p => {
    let score = 0;
    if (p.phone) score++;
    if (p.company_address) score++;
    if (p.rating_count > 0) score++;
    if (p.rating_avg >= 4) score++;
    if (p.categories.length > 1) score++;
    return { ...p, _score: score };
  });

  const toImport = scored.filter(p => p._score >= 3);
  const toReview = scored.filter(p => p._score >= 2 && p._score < 3);
  const autoReject = scored.filter(p => p._score < 2);

  console.log(`\n📊 Résultats finaux :`);
  console.log(`   Profils bruts : ${allProfiles.length}`);
  console.log(`   Profils uniques : ${unique.length}`);
  console.log(`   Score ≥ 3 (import direct) : ${toImport.length}`);
  console.log(`   Score 2 (révision)        : ${toReview.length}`);
  console.log(`   Score < 2 (rejeté auto)   : ${autoReject.length}`);
  console.log(`   Erreurs navigation        : ${errors}`);

  const finalOutput = {
    scraped_at: new Date().toISOString(),
    source: 'google_maps',
    total_raw: allProfiles.length,
    total_unique: unique.length,
    to_import: toImport.length,
    to_review: toReview.length,
    auto_rejected: autoReject.length,
    errors,
    profiles: scored,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalOutput, null, 2));
  console.log(`\n✅ Données sauvegardées → ${OUTPUT_FILE}`);
  console.log(`   Prochaine étape : node scripts/import-artisans-PT-gmaps.mjs\n`);
}

main().catch(err => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
