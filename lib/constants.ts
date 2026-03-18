// ── lib/constants.ts ─────────────────────────────────────────────────────────
// Valeurs centralisées pour tout le projet Vitfix.io
// Modifier ici = modifier partout.
// ─────────────────────────────────────────────────────────────────────────────

// ── Contact ──────────────────────────────────────────────────────────────────

/** Numéro WhatsApp / contact France */
export const PHONE_FR = '+33634468897'
/** Numéro secondaire France (contact page) */
export const PHONE_FR_SECONDARY = '+33757910711'
/** Numéro WhatsApp / contact Portugal */
export const PHONE_PT = '+351912014971'

/** Lien WhatsApp France */
export const WHATSAPP_FR = `https://wa.me/${PHONE_FR.replace('+', '')}`
/** Lien WhatsApp Portugal */
export const WHATSAPP_PT = `https://wa.me/${PHONE_PT.replace('+', '')}`

// ── URLs ─────────────────────────────────────────────────────────────────────

/** URL de production */
export const SITE_URL = 'https://vitfix.io'

/** URLs API externes */
export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
export const TAVILY_API_URL = 'https://api.tavily.com/search'
export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
export const GOUV_ADRESSE_API_URL = 'https://api-adresse.data.gouv.fr'
export const GOUV_ENTREPRISES_API_URL = 'https://recherche-entreprises.api.gouv.fr'

// ── Timeouts (ms) ────────────────────────────────────────────────────────────

/** Timeout court pour APIs rapides (geocoding, adresse) */
export const API_TIMEOUT_SHORT = 5_000
/** Timeout standard pour APIs moyennes (SIRET, PDF) */
export const API_TIMEOUT_DEFAULT = 10_000
/** Timeout long pour APIs IA (Groq, Tavily) */
export const AI_TIMEOUT = 30_000
/** Timeout pour streaming IA */
export const AI_STREAM_TIMEOUT = 30_000

// ── Toast / UI feedback (ms) ─────────────────────────────────────────────────

/** Durée courte pour feedback copier/coller */
export const TOAST_SHORT = 2_000
/** Durée standard pour messages de succès */
export const TOAST_DEFAULT = 3_000
/** Durée longue pour notifications importantes */
export const TOAST_LONG = 5_000

// ── Polling intervals (ms) ───────────────────────────────────────────────────

/** Polling messages en temps réel */
export const POLL_MESSAGES = 5_000
/** Polling missions / ordres */
export const POLL_MISSIONS = 10_000
/** Polling notifications */
export const POLL_NOTIFICATIONS = 30_000
/** Polling votes / lent */
export const POLL_SLOW = 60_000

// ── Rate limits ──────────────────────────────────────────────────────────────

/** Fenêtre standard rate limit (1 minute) */
export const RATE_LIMIT_WINDOW = 60_000
/** Fenêtre longue rate limit (5 minutes) */
export const RATE_LIMIT_WINDOW_LONG = 300_000

// ── Pagination ───────────────────────────────────────────────────────────────

/** Taille de page par défaut pour les listes */
export const PAGE_SIZE_DEFAULT = 50
/** Taille de page pour les listes longues (messages, photos) */
export const PAGE_SIZE_LARGE = 100
/** Taille max pour les exports / sitemap */
export const PAGE_SIZE_MAX = 500

// ── Fiscal PT ────────────────────────────────────────────────────────────────

/** NIF placeholder pour documents fiscaux sans NIF client */
export const PT_NIF_CONSUMIDOR_FINAL = '999999990'
