// ─────────────────────────────────────────────────────────────────────────────
// Création du compte auto-entrepreneur FR : Frédéric Neiva Carvalho
// Source : KBIS INPI — Attestation d'immatriculation au RNE du 21/04/2026
// ─────────────────────────────────────────────────────────────────────────────
// Usage : node --env-file=.env.local scripts/seed-frederic-neivacarvalho.cjs
// Idempotent : upsert du profil, skip auth si l'utilisateur existe déjà.
// ─────────────────────────────────────────────────────────────────────────────

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL_BASE || !KEY) {
  console.error('❌ Env vars manquantes : NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const EMAIL = 'cvlho.frederic@gmail.com'
const PASSWORD = 'NosTress1313.#@'
const FULL_NAME = 'Frédéric Neiva Carvalho'

// ── HTTP helper sur Supabase REST + Auth admin ───────────────────────────────
async function sb(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  if (text) { try { data = JSON.parse(text) } catch { data = text } }
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText} — ${typeof data === 'string' ? data : JSON.stringify(data)}`)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

async function findUserByEmail(email) {
  let page = 1
  while (true) {
    const data = await sb(`/auth/v1/admin/users?page=${page}&per_page=1000`)
    const users = data?.users || []
    const found = users.find(u => u.email === email)
    if (found) return found
    if (users.length < 1000) return null
    page++
  }
}

async function main() {
  console.log('🌱 Création compte auto-entrepreneur FR — Frédéric Neiva Carvalho\n')

  // ── 1. Catégorie "Nettoyage" ───────────────────────────────────────────
  console.log('1️⃣  Catégorie Nettoyage…')
  const cats = await sb(`/rest/v1/categories?slug=eq.nettoyage&limit=1`)
  let cat = Array.isArray(cats) && cats[0]
  if (!cat) {
    const [created] = await sb('/rest/v1/categories', {
      method: 'POST',
      body: { name: 'Nettoyage', slug: 'nettoyage', icon: '🧽', description: 'Nettoyage de bâtiments, bureaux et copropriétés', active: true },
    })
    cat = created
    console.log('   ✅ Catégorie créée')
  } else {
    console.log('   ✅ Catégorie déjà présente')
  }

  // ── 2. Compte Auth ─────────────────────────────────────────────────────
  console.log('\n2️⃣  Compte Auth…')
  const existingUser = await findUserByEmail(EMAIL)
  let userId
  if (existingUser) {
    userId = existingUser.id
    console.log(`   ℹ️  User existe (id=${userId.substring(0, 8)}…) — credentials & role inchangés`)
  } else {
    const created = await sb('/auth/v1/admin/users', {
      method: 'POST',
      body: {
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: FULL_NAME,
          role: 'artisan',
          locale: 'fr',
          country: 'FR',
        },
      },
    })
    userId = created.id
    console.log(`   ✅ Compte créé (id=${userId.substring(0, 8)}…)`)
  }

  // ── 3. Profil artisan (insert ou update) ───────────────────────────────
  console.log('\n3️⃣  Profil artisan…')
  const existing = await sb(`/rest/v1/profiles_artisan?user_id=eq.${userId}&select=id&limit=1`)
  const hasProfile = Array.isArray(existing) && existing.length > 0

  const profileData = {
    user_id: userId,
    company_name: 'Frédéric Neiva Carvalho',
    email: EMAIL,
    bio: "Auto-entrepreneur Hommes Toutes Mains — tous vos travaux à portée de main. Deux pôles d'activité : nettoyage courant des bâtiments (code APE 8121Z) en copropriétés, bureaux et parties communes ; et petits travaux / prestations homme toutes mains (tous travaux n'excédant pas 2 h et ne relevant pas d'une qualification obligatoire). Intervention sur Roquefort-la-bédoule (13830) et alentours.",
    siren: '880978978',
    siret: '88097897800018',
    categories: ['nettoyage', 'nettoyage-copro', 'petits-travaux'],
    company_address: 'Allée Hippolyte Gondrexon, RDC',
    company_city: 'Roquefort-la-bédoule',
    company_postal_code: '13830',
    latitude: 43.2789,
    longitude: 5.6036,
    zone_radius_km: 30,
    active: true,
    verified: false,
    language: 'fr',
    kyc_market: 'FR',
    legal_form: 'EI',
    type_activite: 'auto-entrepreneur',
    naf_code: '8121Z',
    naf_label: 'Nettoyage courant des bâtiments',
    subscription_tier: 'artisan_starter',
    kbis_extracted: {
      source: 'INPI — Attestation RNE du 21/04/2026',
      nom_entreprise: 'Neiva Carvalho Frédéric',
      siren: '880978978',
      siret: '88097897800018',
      code_ape: '8121Z',
      libelle_ape: 'Nettoyage courant des bâtiments',
      code_aprm: '8121ZZ',
      nature_activite: 'Artisanale',
      forme_juridique: 'Entrepreneur individuel',
      activite_principale:
        "Prestation homme toutes mains (tous travaux n'excédant pas 2 heures et ne relevant pas d'une qualification professionnelle obligatoire)",
      adresse_ligne1: 'Allée Hippolyte Gondrexon',
      adresse_ligne2: 'RDC',
      code_postal: '13830',
      ville: 'Roquefort-la-bédoule',
      pays: 'France',
      date_debut_activite: '2019-11-25',
      date_immatriculation_rne: '2020-01-28',
      date_naissance: '09/1993',
    },
  }

  if (hasProfile) {
    await sb(`/rest/v1/profiles_artisan?user_id=eq.${userId}`, { method: 'PATCH', body: profileData })
    console.log('   ✅ Profil mis à jour')
  } else {
    await sb('/rest/v1/profiles_artisan', { method: 'POST', body: profileData })
    console.log('   ✅ Profil créé')
  }

  // ── 4. Upload attestation RNE (équivalent KBIS auto-entrepreneur) ──────
  console.log('\n4️⃣  Upload attestation RNE…')
  const fs = require('fs')
  const PDF_PATH = '/Users/elgato_fofo/Documents/Export_Portail_Data_NEIVA_CARVALHO_Du_21-04-2026.pdf'
  try {
    const pdfBuffer = fs.readFileSync(PDF_PATH)
    const storageKey = `${userId}/kbis/attestation-rne-2026-04-21.pdf`
    const uploadRes = await fetch(`${URL_BASE}/storage/v1/object/artisan-documents/${storageKey}`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: pdfBuffer,
    })
    if (!uploadRes.ok) {
      const txt = await uploadRes.text()
      console.error(`   ⚠️  Upload échoué (${uploadRes.status}) : ${txt}`)
    } else {
      const publicUrl = `${URL_BASE}/storage/v1/object/public/artisan-documents/${storageKey}`
      await sb(`/rest/v1/profiles_artisan?user_id=eq.${userId}`, {
        method: 'PATCH',
        body: { kbis_url: publicUrl },
      })
      console.log('   ✅ PDF uploadé + kbis_url mis à jour')
      console.log(`   🔗 ${publicUrl}`)
    }
  } catch (err) {
    console.warn(`   ⚠️  Impossible de lire ${PDF_PATH} — ignoré (${err.message})`)
  }

  // ── Résumé ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(62))
  console.log('🎉  COMPTE AUTO-ENTREPRENEUR PRÊT')
  console.log('═'.repeat(62))
  console.log(`👤 Nom        : ${FULL_NAME}`)
  console.log(`📧 Email      : ${EMAIL}`)
  console.log(`🔐 Password   : ${PASSWORD}`)
  console.log(`🏢 SIRET      : 880 978 978 00018`)
  console.log(`🧽 APE        : 8121Z — Nettoyage courant des bâtiments`)
  console.log(`📍 Adresse    : Allée Hippolyte Gondrexon, RDC — 13830 Roquefort-la-bédoule`)
  console.log(`🔗 Connexion  : https://vitfix.io/fr/auth/login`)
  console.log('═'.repeat(62))
}

main().catch(err => { console.error('❌ Fatal :', err); process.exit(1) })
