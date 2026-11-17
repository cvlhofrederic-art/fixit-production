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

// ── Emails ────────────────────────────────────────────────────────────────────

/** Email de contact public */
export const CONTACT_EMAIL = 'contact@vitfix.io'
/** Email expéditeur (transactionnel Resend) */
export const NOREPLY_EMAIL = 'noreply@vitfix.io'
/** Email support artisan */
export const SUPPORT_EMAIL = 'support@fixit.fr'

// ── URLs ─────────────────────────────────────────────────────────────────────

/** URL de production */
export const SITE_URL = 'https://vitfix.io'

/** URLs API externes */
export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
export const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions'
export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
export const TAVILY_API_URL = 'https://api.tavily.com/search'
export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
export const GOUV_ADRESSE_API_URL = 'https://api-adresse.data.gouv.fr'
export const GOUV_ENTREPRISES_API_URL = 'https://recherche-entreprises.api.gouv.fr'

/** URLs Google APIs */
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1'
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

// ── AI Models ────────────────────────────────────────────────────────────────
//
// Groq a retiré de ses offres gratuite et développeur (console.groq.com/docs/deprecations, relu le 15/11/2026)
// `llama-3.3-70b-versatile` et `llama-3.1-8b-instant` le 16/08/2026, et son modèle de vision
// `meta-llama/llama-4-scout-17b-16e-instruct` le 17/07/2026 : depuis, tous les agents qui les nommaient répondaient
// en erreur (« Model does not exist »). Remplaçants indiqués par Groq ci-dessous ; ils ne lisent pas les images.
// Les modèles nommés ici ne s'écrivent plus en dur dans les routes.

/** Modèle Groq principal : `openai/gpt-oss-120b`, remplaçant indiqué par Groq de `llama-3.3-70b-versatile`. */
export const GROQ_MODEL_PRIMARY = 'openai/gpt-oss-120b'
/** Modèle Groq des petits appels (classement, listes courtes) : `openai/gpt-oss-20b`, remplaçant de `llama-3.1-8b-instant`. */
export const GROQ_MODEL_RAPIDE = 'openai/gpt-oss-20b'
/** Modèle Groq de repli, essayé quand le principal échoue : le petit modèle, qui a son propre quota. */
export const GROQ_MODEL_FALLBACK = GROQ_MODEL_RAPIDE

/**
 * Modèle Cerebras du secours inter-fournisseurs (lib/groq.ts). `llama-3.3-70b` a été retiré par Cerebras (annonce
 * du 16/02/2026, inference-docs.cerebras.ai/support/deprecation) : c'est lui qui répondait « Cerebras 404 » en
 * production. `gpt-oss-120b` est le remplaçant recommandé par Cerebras.
 */
export const CEREBRAS_MODEL_PRIMARY = 'gpt-oss-120b'

/**
 * Modèle Claude des agents Syndic, Administrateur judiciaire et Copropriétaire (lib/claude.ts), et du relais de
 * l'Estimation et du Dictionnaire matériaux.
 */
export const CLAUDE_MODEL_AGENTS = 'claude-sonnet-5-5'

/**
 * Modèles de Workers AI (binding du Worker, lib/workers-ai.ts) qui relaient les agents artisan / BTP quand Groq
 * échoue et lisent les images des documents (lib/ai/relais.ts), dans l'ordre d'essai : Gemma 4 26B (0,10 $ / 0,30 $
 * le million de jetons) puis Qwen 3.8 27B (0,45 $ / 3,20 $), tous deux lisent les images (pages des modèles de
 * Cloudflare, relues le 17/11/2026 ; mêmes choix que le Dictionnaire matériaux). Cloudflare retire souvent des
 * modèles : le second relaie un retrait du premier.
 */
export const WORKERS_AI_MODELES = ['@cf/google/gemma-4-26b-a4b-it', '@cf/qwen/qwen3.8-27b'] as const

// ── Misc ─────────────────────────────────────────────────────────────────────

/** User-Agent pour requêtes HTTP sortantes */
export const USER_AGENT = 'Vitfix/1.0'

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

/** NIF de l'entité légale Vitfix au Portugal */
export const PT_NIF_EMPRESA = '276873297'

/** NIF placeholder pour documents fiscaux sans NIF client */
export const PT_NIF_CONSUMIDOR_FINAL = '999999990'
